import { asSafeEmail, asSafeId } from "./security.js";

const SHIPPING_RATES = {
  flat: 8,
  pickup: 0,
  free: 0,
  express: 15,
};

const ALLOWED_PAYMENT_METHODS = new Set([
  "bank-transfer",
  "check",
  "cod",
  "paypal",
]);

const DEFAULT_COUPONS = [
  { code: "WELCOME10", type: "percentage", value: 10, minOrder: 30, active: true },
  { code: "UMMO20", type: "fixed", value: 20, minOrder: 100, active: true },
  { code: "VIP25", type: "percentage", value: 25, minOrder: 200, active: true },
];

const DEFAULT_CART_RULES = {
  freeShippingEnabled: true,
  freeShippingThreshold: 150,
  tieredDiscountEnabled: true,
  tieredMinSpend: 200,
  tieredDiscountPercent: 10,
  giftWrapEnabled: true,
  giftWrapFee: 5,
};

function computeEffectiveServerPrice(product) {
  const basePrice = Number(product.originalPrice ?? product.price ?? 0);
  const discPct = Number(product.discountPercentage || 0);
  if (discPct <= 0) return Number(basePrice.toFixed(2));

  if (product.discountEndTime && product.discountEndTime !== "none") {
    const endMs = new Date(product.discountEndTime).getTime();
    if (!Number.isNaN(endMs) && endMs <= Date.now()) {
      // Discount timer has expired; charge full base price
      return Number(basePrice.toFixed(2));
    }
  }
  return Number((basePrice * (1 - discPct / 100)).toFixed(2));
}

/**
 * Validates and constructs an authoritative order on the server.
 * Prevents price tampering, negative/excessive quantities, out-of-stock checkout,
 * deleted product checkout, coupon abuse, shipping tampering, and payment status spoofing.
 */
export function validateAndBuildServerOrder(body, state, caller, idempotencyKey = "") {
  const rawItems = Array.isArray(body.OrderItems)
    ? body.OrderItems
    : Array.isArray(body.items)
      ? body.items
      : [];

  if (rawItems.length === 0) {
    const err = new Error("Cart is empty. Cannot place an order with zero items.");
    err.statusCode = 400;
    throw err;
  }

  if (rawItems.length > 50) {
    const err = new Error("Too many distinct line items in a single order (max 50).");
    err.statusCode = 400;
    throw err;
  }

  const deletedIds = new Set(
    (state.storeConfig?.deletedIds || []).map((id) => String(id))
  );
  const customProducts = Array.isArray(state.storeConfig?.customProducts)
    ? state.storeConfig.customProducts
    : [];
  const customMap = new Map(customProducts.map((p) => [String(p.id), p]));

  const validatedItems = [];
  const unlockedFreeGifts = [];
  let authoritativeSubtotal = 0;

  for (const rawItem of rawItems) {
    const itemId = asSafeId(rawItem?.id ?? rawItem?.productId, 64);
    if (!itemId) {
      const err = new Error("Invalid product ID in order items.");
      err.statusCode = 400;
      throw err;
    }

    if (deletedIds.has(itemId)) {
      const err = new Error(`Product ${itemId} is no longer available.`);
      err.statusCode = 400;
      throw err;
    }

    const qty = Number(rawItem?.quantity);
    if (!Number.isInteger(qty) || qty < 1 || qty > 99) {
      const err = new Error(
        `Invalid quantity (${rawItem?.quantity}) for product ${itemId}. Must be an integer between 1 and 99.`
      );
      err.statusCode = 400;
      throw err;
    }

    const catalogOverride = customMap.get(itemId);
    if (catalogOverride && catalogOverride.active === false) {
      const err = new Error(`Product ${itemId} is currently inactive.`);
      err.statusCode = 400;
      throw err;
    }

    // Inventory check
    const authoritativeStock =
      catalogOverride?.stock !== undefined
        ? Number(catalogOverride.stock)
        : rawItem?.stock !== undefined
          ? Number(rawItem.stock)
          : 25;

    if (Number.isNaN(authoritativeStock) || authoritativeStock <= 0 || qty > authoritativeStock) {
      const err = new Error(
        `Insufficient stock for "${catalogOverride?.title || rawItem?.title || itemId}". Available: ${Math.max(0, authoritativeStock)}, requested: ${qty}.`
      );
      err.statusCode = 400;
      throw err;
    }

    // Price integrity check
    let unitPrice;
    if (catalogOverride && Number(catalogOverride.price) > 0) {
      unitPrice = computeEffectiveServerPrice(catalogOverride);
    } else {
      // Check if item's own discountEndTime expired
      if (
        rawItem?.discountEndTime &&
        rawItem.discountEndTime !== "none" &&
        new Date(rawItem.discountEndTime).getTime() <= Date.now() &&
        Number(rawItem?.originalPrice) > Number(rawItem?.price)
      ) {
        unitPrice = Number(rawItem.originalPrice);
      } else {
        unitPrice = Number(rawItem?.price);
      }
    }

    if (!Number.isFinite(unitPrice) || unitPrice <= 0 || unitPrice > 100000) {
      const err = new Error(`Invalid or tampered price for product ${itemId}.`);
      err.statusCode = 400;
      throw err;
    }

    // Detect explicit client price tampering when catalog product exists
    if (
      catalogOverride &&
      rawItem?.price !== undefined &&
      Math.abs(Number(rawItem.price) - unitPrice) > 1.0 &&
      Number(rawItem.price) < unitPrice - 1.0
    ) {
      const err = new Error(
        `Price tampering detected for product ${itemId}. Submitted ${rawItem.price}, expected ${unitPrice}.`
      );
      err.statusCode = 400;
      throw err;
    }

    unitPrice = Number(unitPrice.toFixed(2));
    authoritativeSubtotal += unitPrice * qty;

    const fg = catalogOverride?.freeGift || rawItem?.freeGift;
    if (fg && fg.enabled && fg.giftName) {
      const minBuy = Math.max(1, Number(fg.minBuyQty || 1));
      const giftPerBundle = Math.max(1, Number(fg.giftQty || 1));
      if (qty >= minBuy) {
        const multiplier = Math.floor(qty / minBuy);
        const earnedQty = multiplier * giftPerBundle;
        const safeParentTitle = asSafeId(
          catalogOverride?.title || rawItem?.title || "Product",
          160
        );
        unlockedFreeGifts.push({
          parentProductId: itemId,
          parentTitle: safeParentTitle,
          parentProductTitle: safeParentTitle,
          giftName: asSafeId(fg.giftName, 120),
          giftImage: asSafeId(fg.giftImage || "", 300),
          totalFreeGiftQty: earnedQty,
          earnedGiftQty: earnedQty,
        });
      }
    }

    const resolvedThumb = asSafeId(
      catalogOverride?.thumbnail || rawItem?.image || rawItem?.thumbnail || "",
      300
    );
    const resolvedSize = asSafeId(
      rawItem?.size || rawItem?.selectedSize || "M",
      32
    );
    const resolvedColor = asSafeId(
      rawItem?.color || rawItem?.selectedColor || "Black",
      32
    );
    validatedItems.push({
      id: itemId,
      title: asSafeId(catalogOverride?.title || rawItem?.title || `Product #${itemId}`, 160),
      price: unitPrice,
      quantity: qty,
      image: resolvedThumb,
      thumbnail: resolvedThumb,
      size: resolvedSize,
      color: resolvedColor,
      selectedSize: resolvedSize,
      selectedColor: resolvedColor,
    });
  }

  authoritativeSubtotal = Number(authoritativeSubtotal.toFixed(2));

  // Cart rules & Tiered VIP discount calculation
  const rules = {
    ...DEFAULT_CART_RULES,
    ...(state.storeConfig?.cartRules || {}),
  };

  const tieredDiscount =
    rules.tieredDiscountEnabled && authoritativeSubtotal >= Number(rules.tieredMinSpend || 200)
      ? Number(
          (
            (authoritativeSubtotal * Number(rules.tieredDiscountPercent || 10)) /
            100
          ).toFixed(2)
        )
      : 0;

  // Authoritative Coupon validation
  let couponDiscount = 0;
  let validatedCouponCode = null;
  const submittedCode = asSafeId(body.couponCode, 32).toUpperCase();
  if (submittedCode) {
    const availableCoupons =
      Array.isArray(state.storeConfig?.coupons) && state.storeConfig.coupons.length
        ? state.storeConfig.coupons
        : DEFAULT_COUPONS;
    const matchedCoupon = availableCoupons.find(
      (c) => String(c.code || "").toUpperCase() === submittedCode && c.active !== false
    );
    const eligibleAmount = Math.max(0, authoritativeSubtotal - tieredDiscount);
    if (!matchedCoupon) {
      const err = new Error(`Invalid or expired coupon code: ${submittedCode}`);
      err.statusCode = 400;
      throw err;
    }
    if (eligibleAmount < Number(matchedCoupon.minOrder || 0)) {
      const err = new Error(
        `Order subtotal does not meet minimum requirement ($${matchedCoupon.minOrder}) for coupon ${submittedCode}.`
      );
      err.statusCode = 400;
      throw err;
    }
    validatedCouponCode = matchedCoupon.code;
    if (matchedCoupon.type === "percentage") {
      couponDiscount = Number(
        ((eligibleAmount * Number(matchedCoupon.value || 0)) / 100).toFixed(2)
      );
    } else {
      couponDiscount = Number(
        Math.min(eligibleAmount, Number(matchedCoupon.value || 0)).toFixed(2)
      );
    }
  }

  // Authoritative Shipping calculation
  const shippingMethod = Object.prototype.hasOwnProperty.call(
    SHIPPING_RATES,
    body.shippingMethod
  )
    ? body.shippingMethod
    : "flat";
  const freeShippingUnlocked =
    Boolean(rules.freeShippingEnabled) &&
    authoritativeSubtotal >= Number(rules.freeShippingThreshold || 150);
  const shippingCost = freeShippingUnlocked ? 0 : SHIPPING_RATES[shippingMethod];

  const giftWrap = Boolean(body.giftWrap);
  const giftWrapCost = giftWrap ? Number(rules.giftWrapFee || 5) : 0;
  const vat = 19;

  const authoritativeTotal = Number(
    Math.max(
      0,
      authoritativeSubtotal -
        tieredDiscount -
        couponDiscount +
        shippingCost +
        giftWrapCost +
        vat
    ).toFixed(2)
  );

  // Payment method & status integrity (never trust client 'PAID' status)
  const paymentMethod = ALLOWED_PAYMENT_METHODS.has(body.paymentMethod)
    ? body.paymentMethod
    : "bank-transfer";

  const resolvedUserUid =
    caller?.uid || asSafeId(body.userUid || body.id, 128) || "guest";
  const orderId =
    asSafeId(body.orderId, 64) ||
    (idempotencyKey ? `ORD-${idempotencyKey.slice(0, 24)}` : `ORD-${Date.now()}`);

  const rawBilling = body.billing && typeof body.billing === "object" ? body.billing : {};

  return {
    orderId,
    id: orderId,
    idempotencyKey: asSafeId(idempotencyKey, 128) || orderId,
    userUid: resolvedUserUid,
    username: asSafeId(body.username || `${body.firstName || ""} ${body.lastName || ""}`.trim(), 120),
    firstName: asSafeId(body.firstName, 60),
    lastName: asSafeId(body.lastName, 60),
    email: asSafeEmail(body.email) || caller?.email || "",
    OrderItems: validatedItems,
    freeGifts: unlockedFreeGifts,
    subtotal: authoritativeSubtotal,
    tieredDiscount,
    discount: couponDiscount,
    couponCode: validatedCouponCode,
    shipping: shippingCost,
    freeShippingUnlocked,
    shippingMethod,
    giftWrap,
    giftWrapCost,
    giftNote: asSafeId(body.giftNote, 250),
    vat,
    total: authoritativeTotal,
    paymentMethod,
    paymentStatus: "PENDING_VERIFICATION",
    status: "PENDING",
    date: new Date().toISOString(),
    billing: {
      company: asSafeId(rawBilling.company, 120),
      country: asSafeId(rawBilling.country || "Bangladesh", 80),
      streetAddress: asSafeId(rawBilling.streetAddress, 200),
      apartment: asSafeId(rawBilling.apartment, 120),
      city: asSafeId(rawBilling.city, 100),
      postcode: asSafeId(rawBilling.postcode, 40),
      province: asSafeId(rawBilling.province, 100),
      phone: asSafeId(rawBilling.phone, 40),
      orderNotes: asSafeId(rawBilling.orderNotes, 500),
    },
  };
}

/**
 * Deducts inventory for ordered items in `state.storeConfig.customProducts`.
 */
export function deductOrderInventory(state, orderItems) {
  if (!Array.isArray(state?.storeConfig?.customProducts)) return;
  const qtyByProduct = new Map();
  for (const item of orderItems) {
    const id = String(item.id);
    qtyByProduct.set(id, (qtyByProduct.get(id) || 0) + Number(item.quantity || 1));
  }

  state.storeConfig.customProducts = state.storeConfig.customProducts.map((p) => {
    const deduct = qtyByProduct.get(String(p.id));
    if (!deduct) return p;
    const currentStock = Number(p.stock ?? 25);
    return {
      ...p,
      stock: Math.max(0, currentStock - deduct),
    };
  });
}
