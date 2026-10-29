import { apiClient, initStoreConfigSync } from "../services/api";
import { getProductDiscountState } from "./discountTimer";

const CART_RULES_STORAGE_KEY = "ummo_admin_cart_rules_v2";
const RECENTLY_VIEWED_KEY = "ummo_recently_viewed_v1";

export const DEFAULT_CART_RULES = {
  freeShippingEnabled: true,
  freeShippingThreshold: 100,
  tieredDiscountEnabled: true,
  tieredMinSpend: 200,
  tieredDiscountPercent: 10,
  giftWrapFee: 5,
};

export function getStoredCartRules() {
  try {
    const raw = localStorage.getItem(CART_RULES_STORAGE_KEY);
    if (raw) {
      return { ...DEFAULT_CART_RULES, ...JSON.parse(raw) };
    }
  } catch {
    // ignore
  }
  return DEFAULT_CART_RULES;
}

export async function saveStoredCartRules(rules) {
  const merged = {
    ...DEFAULT_CART_RULES,
    ...rules,
    freeShippingThreshold: Math.max(
      0,
      Number(rules.freeShippingThreshold) || 0
    ),
    tieredMinSpend: Math.max(0, Number(rules.tieredMinSpend) || 200),
    tieredDiscountPercent: Math.max(
      0,
      Math.min(80, Number(rules.tieredDiscountPercent) || 10)
    ),
    giftWrapFee: Math.max(0, Number(rules.giftWrapFee ?? 5)),
  };
  try {
    localStorage.setItem(CART_RULES_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(
      new CustomEvent("ummo:cart-rules-updated", { detail: merged })
    );
  } catch {
    // ignore
  }
  await apiClient.post("/store-config", { cartRules: merged }).catch(() => {});
  return merged;
}

export function initCartRulesSync(onRulesUpdated) {
  const handler = (e) => {
    if (typeof onRulesUpdated === "function" && e?.detail) {
      onRulesUpdated({ ...DEFAULT_CART_RULES, ...e.detail });
    }
  };
  window.addEventListener("ummo:cart-rules-updated", handler);
  initStoreConfigSync();

  return () => {
    window.removeEventListener("ummo:cart-rules-updated", handler);
  };
}

/**
 * Resolves the active per-product Free Gift configuration set by Admin.
 * Example: Buy 1 kg oil -> Get 1 Pen Free.
 */
export function getProductFreeGiftConfig(product, catalogProducts = []) {
  if (!product) return null;
  const liveMatch = Array.isArray(catalogProducts)
    ? catalogProducts.find((p) => String(p.id) === String(product.id))
    : null;
  const fg = liveMatch?.freeGift ?? product.freeGift;
  if (!fg || !fg.enabled || !String(fg.giftName || "").trim()) {
    return null;
  }
  return {
    enabled: true,
    minBuyQty: Math.max(1, Number(fg.minBuyQty || 1)),
    giftName: String(fg.giftName).trim(),
    giftQty: Math.max(1, Number(fg.giftQty || 1)),
    giftImage: fg.giftImage || "",
    giftProductId: fg.giftProductId || "",
  };
}

/**
 * Computes how many free gift units a single cart item has unlocked (or needs to unlock).
 */
export function evaluateCartItemFreeGift(cartItem, catalogProducts = []) {
  const config = getProductFreeGiftConfig(cartItem, catalogProducts);
  if (!config) {
    return { hasFreeGiftRule: false };
  }
  const qty = Math.max(1, Number(cartItem?.quantity || 1));
  const unlocked = qty >= config.minBuyQty;
  const multiplier = Math.floor(qty / config.minBuyQty);
  const earnedGiftQty = unlocked ? multiplier * config.giftQty : 0;
  const qtyNeededToUnlock = unlocked ? 0 : config.minBuyQty - qty;

  return {
    hasFreeGiftRule: true,
    unlocked,
    minBuyQty: config.minBuyQty,
    giftName: config.giftName,
    giftQtyPerBundle: config.giftQty,
    earnedGiftQty,
    qtyNeededToUnlock,
    giftImage: config.giftImage,
    giftProductId: config.giftProductId,
    parentProductId: cartItem.id,
    parentProductTitle: cartItem.title,
  };
}

/**
 * Resolves the live discounted unit price and original price of a cart item,
 * dynamically checking catalogProducts (and countdown timer expiration) first.
 */
export function resolveCartItemPricing(cartItem, catalogProducts = []) {
  if (!cartItem) {
    return {
      unitPrice: 0,
      originalPrice: 0,
      discountPercent: 0,
      isDiscountActive: false,
      savingsPerUnit: 0,
    };
  }
  const liveMatch = Array.isArray(catalogProducts)
    ? catalogProducts.find((p) => String(p.id) === String(cartItem.id))
    : null;

  if (liveMatch) {
    const state = getProductDiscountState(liveMatch);
    return {
      unitPrice: state.effectivePrice,
      originalPrice: state.originalPrice,
      discountPercent: state.discountPercent,
      isDiscountActive: state.isDiscountActive,
      savingsPerUnit: state.savingsAmount,
    };
  }

  const baseOriginal = Number(cartItem.originalPrice || cartItem.price || 0);
  const rawPct = Number(
    cartItem.discountPercentage ?? cartItem.discountPercent ?? 0
  );
  if (baseOriginal > 0 && rawPct > 0) {
    const state = getProductDiscountState({
      price: baseOriginal,
      discountPercentage: rawPct,
      discountEndTime: cartItem.discountEndTime || null,
    });
    return {
      unitPrice: state.effectivePrice,
      originalPrice: state.originalPrice,
      discountPercent: state.discountPercent,
      isDiscountActive: state.isDiscountActive,
      savingsPerUnit: state.savingsAmount,
    };
  }

  const unitPrice = Number(Number(cartItem.price || 0).toFixed(2));
  const originalPrice = Number(
    Math.max(unitPrice, Number(cartItem.originalPrice || unitPrice)).toFixed(2)
  );
  return {
    unitPrice,
    originalPrice,
    discountPercent: 0,
    isDiscountActive: originalPrice > unitPrice,
    savingsPerUnit: Number((originalPrice - unitPrice).toFixed(2)),
  };
}

/**
 * Computes all active cart promotions:
 * - Subtotal & Total Unit Count (always using live discounted unit prices)
 * - Total Product-Level Discount Savings
 * - Free Shipping threshold progress & automatic free delivery unlock
 * - Per-Product Free Gifts unlocked by items in the cart
 * - Tiered Spend automatic VIP discount
 */
export function computeCartPromotions(
  cartItems = [],
  rules = getStoredCartRules(),
  catalogProducts = []
) {
  const items = Array.isArray(cartItems) ? cartItems : [];
  let rawSubtotal = 0;
  let rawOriginalSubtotal = 0;

  items.forEach((item) => {
    const qty = Math.max(1, Number(item?.quantity || 1));
    const pricing = resolveCartItemPricing(item, catalogProducts);
    rawSubtotal += pricing.unitPrice * qty;
    rawOriginalSubtotal += pricing.originalPrice * qty;
  });

  const subtotal = Number(rawSubtotal.toFixed(2));
  const originalSubtotal = Number(rawOriginalSubtotal.toFixed(2));
  const productDiscountSavings = Number(
    Math.max(0, originalSubtotal - subtotal).toFixed(2)
  );

  const totalUnits = items.reduce(
    (sum, item) => sum + Math.max(1, Number(item?.quantity || 1)),
    0
  );

  // 1. Free Shipping Threshold Calculation
  const threshold = Number(rules.freeShippingThreshold || 100);
  const freeShippingUnlocked =
    Boolean(rules.freeShippingEnabled) &&
    subtotal > 0 &&
    subtotal >= threshold;
  const amountNeededForFreeShipping = rules.freeShippingEnabled
    ? Math.max(0, Number((threshold - subtotal).toFixed(2)))
    : 0;
  const freeShippingProgress =
    threshold > 0
      ? Math.min(100, Math.round((subtotal / threshold) * 100))
      : 100;

  // 2. Per-Product Free Gifts Calculation (Admin-configured on specific products)
  const unlockedFreeGifts = [];
  const pendingFreeGifts = [];

  items.forEach((item) => {
    const evalGift = evaluateCartItemFreeGift(item, catalogProducts);
    if (evalGift.hasFreeGiftRule) {
      if (evalGift.unlocked) {
        unlockedFreeGifts.push(evalGift);
      } else {
        pendingFreeGifts.push(evalGift);
      }
    }
  });

  // 3. Tiered Spend Automatic Discount
  let tieredDiscount = 0;
  const tieredMin = Number(rules.tieredMinSpend || 200);
  const tieredPct = Number(rules.tieredDiscountPercent || 10);

  if (
    rules.tieredDiscountEnabled &&
    tieredMin > 0 &&
    subtotal >= tieredMin
  ) {
    tieredDiscount = Number(((subtotal * tieredPct) / 100).toFixed(2));
  }

  return {
    subtotal,
    originalSubtotal,
    productDiscountSavings,
    totalUnits,
    freeShippingEnabled: Boolean(rules.freeShippingEnabled),
    freeShippingThreshold: threshold,
    freeShippingUnlocked,
    amountNeededForFreeShipping,
    freeShippingProgress,
    unlockedFreeGifts,
    pendingFreeGifts,
    tieredDiscountEnabled: Boolean(rules.tieredDiscountEnabled),
    tieredMinSpend: tieredMin,
    tieredDiscountPercent: tieredPct,
    tieredDiscount,
    giftWrapFee: Number(rules.giftWrapFee ?? 5),
  };
}

/**
 * Tracks and retrieves Recently Viewed Products for personalized cross-selling.
 */
export function recordRecentlyViewedProduct(product) {
  if (!product?.id) return;
  try {
    const existing = getRecentlyViewedProducts().filter(
      (p) => String(p.id) !== String(product.id)
    );
    const compact = {
      id: product.id,
      title: product.title,
      price: product.price,
      discountPercentage: product.discountPercentage,
      discountEndTime: product.discountEndTime,
      freeGift: product.freeGift || null,
      thumbnail: product.thumbnail,
      category: product.category,
      brand: product.brand,
      rating: product.rating,
      stock: product.stock,
    };
    const next = [compact, ...existing].slice(0, 8);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
}

export function getRecentlyViewedProducts() {
  try {
    const raw = localStorage.getItem(RECENTLY_VIEWED_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch {
    // ignore
  }
  return [];
}
