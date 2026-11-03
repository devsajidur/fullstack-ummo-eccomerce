import { getMasterAdminEmail } from "../security.js";

export function maskEmail(rawEmail) {
  const email = String(rawEmail || "").trim();
  if (!email || !email.includes("@")) return "c***@example.com";
  const [local, domain] = email.split("@");
  if (!local || !domain) return "c***@example.com";
  const visiblePrefix = local.length <= 2 ? local.slice(0, 1) : local.slice(0, 2);
  return `${visiblePrefix}***@${domain}`;
}

export function maskPhone(rawPhone) {
  const phone = String(rawPhone || "").trim();
  if (!phone) return "";
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 4) return "••••••";
  const prefix = phone.startsWith("+") ? `+${digits.slice(0, 3)}` : digits.slice(0, 2);
  const suffix = digits.slice(-3);
  return `${prefix}•••••${suffix}`;
}

export function maskName(rawName) {
  const name = String(rawName || "").trim();
  if (!name) return "Customer";
  const parts = name.split(/\s+/).filter(Boolean);
  if (parts.length === 1) {
    const w = parts[0];
    return w.length <= 2 ? `${w[0]}•` : `${w.slice(0, 3)}••`;
  }
  const first = parts[0];
  const lastInitial = parts[parts.length - 1].charAt(0).toUpperCase();
  return `${first} ${lastInitial}.`;
}

export function maskUid(rawUid) {
  const s = String(rawUid || "").trim();
  if (!s || s === "guest") return "guest";
  return `usr_${s.slice(0, 6)}•••`;
}

export function maskAddressItem(addr) {
  if (!addr || typeof addr !== "object") return {};
  return {
    id: addr.id || "addr-demo",
    label: addr.label || "Shipping",
    fullName: maskName(addr.fullName || addr.name || "Customer"),
    street: "••• [Protected Street Address]",
    streetAddress: "••• [Protected Street Address]",
    apartment: "",
    city: addr.city || "Dhaka",
    province: addr.province || "",
    postcode: "•••",
    country: addr.country || "Bangladesh",
    phone: maskPhone(addr.phone || ""),
    isDefault: Boolean(addr.isDefault),
  };
}

export function projectOrderForDemoAdmin(order) {
  if (!order || typeof order !== "object") return order;
  const fullName =
    order.username ||
    `${order.firstName || ""} ${order.lastName || ""}`.trim() ||
    "Customer";
  const maskedFull = maskName(fullName);
  const nameParts = maskedFull.split(" ");
  const rawBilling = order.billing && typeof order.billing === "object" ? order.billing : {};

  return {
    orderId: order.orderId || order.id,
    id: order.orderId || order.id,
    userUid: maskUid(order.userUid),
    username: maskedFull,
    firstName: nameParts[0] || "Customer",
    lastName: nameParts.slice(1).join(" ") || "",
    email: maskEmail(order.email),
    OrderItems: Array.isArray(order.OrderItems)
      ? order.OrderItems.map((item) => ({
          id: item.id ?? item.productId,
          productId: item.productId ?? item.id,
          variantId: item.variantId || "standard",
          size: item.size || item.selectedSize || "",
          color: item.color || item.selectedColor || "",
          title: item.title || item.productNameSnapshot || "Product",
          productNameSnapshot:
            item.productNameSnapshot || item.title || "Product",
          productImageSnapshot:
            item.productImageSnapshot || item.image || item.thumbnail || "",
          image: item.image || item.productImageSnapshot || item.thumbnail || "",
          quantity: Number(item.quantity || 1),
          price: Number(item.price ?? item.unitPriceSnapshot ?? 0),
          unitPriceSnapshot: Number(item.unitPriceSnapshot ?? item.price ?? 0),
          originalPrice: Number(item.originalPrice ?? item.price ?? 0),
          discountPercent: Number(item.discountPercent || 0),
          optionalMessage: item.optionalMessage
            ? "[Protected Customer Product Note]"
            : "",
        }))
      : [],
    freeGifts: [],
    subtotal: Number(order.subtotal ?? order.total ?? 0),
    tieredDiscount: Number(order.tieredDiscount || 0),
    discount: Number(order.discount || 0),
    couponCode: order.couponCode || null,
    shipping: Number(order.shipping || 0),
    freeShippingUnlocked: Boolean(order.freeShippingUnlocked),
    shippingMethod: order.shippingMethod || "flat",
    giftWrap: Boolean(order.giftWrap),
    giftWrapCost: Number(order.giftWrapCost || 0),
    giftNote: order.giftNote ? "[Protected Gift Note]" : "",
    vat: Number(order.vat || 0),
    total: Number(order.total ?? order.totalAmount ?? 0),
    totalAmount: Number(order.totalAmount ?? order.total ?? 0),
    refundedAmount: Number(order.refundedAmount || 0),
    paymentMethod: order.paymentMethod || "cod",
    paymentGateway: order.paymentGateway || order.paymentMethod || "cod",
    paymentStatus: order.paymentStatus || "PENDING_VERIFICATION",
    gatewayTransactionId: order.gatewayTransactionId
      ? `TXN-••••${String(order.gatewayTransactionId).slice(-4)}`
      : "",
    status: order.status || "PENDING",
    inventoryDeducted: Boolean(order.inventoryDeducted),
    inventoryRestocked: Boolean(order.inventoryRestocked),
    date: order.date || null,
    updatedAt: order.updatedAt || null,
    billing: {
      company: rawBilling.company ? "•••" : "",
      country: rawBilling.country || "Bangladesh",
      streetAddress: "••• [Protected Street Address]",
      apartment: "",
      city: rawBilling.city || "Dhaka",
      postcode: "•••",
      province: rawBilling.province || "",
      phone: maskPhone(rawBilling.phone),
      orderNotes: rawBilling.orderNotes ? "[Protected Customer Note]" : "",
    },
  };
}

export function projectPaymentForDemoAdmin(payment) {
  if (!payment || typeof payment !== "object") return payment;
  return {
    paymentId: payment.paymentId,
    orderId: payment.orderId,
    userUid: maskUid(payment.userUid),
    gateway: payment.gateway,
    environment: payment.environment || "sandbox",
    providerMode: payment.providerMode || "sandbox",
    tranId: payment.tranId
      ? `TXN-••••${String(payment.tranId).slice(-4)}`
      : "",
    amount: Number(payment.amount || 0),
    currency: payment.currency || "USD",
    refundedAmount: Number(payment.refundedAmount || 0),
    status: payment.status || "INITIATED",
    createdAt: payment.createdAt || null,
    updatedAt: payment.updatedAt || null,
  };
}

export function projectUserForDemoAdmin(user) {
  if (!user || typeof user !== "object") return user;
  const masterEmail = getMasterAdminEmail();
  const isOwnerRecord =
    String(user.email || "").trim().toLowerCase() === masterEmail ||
    user.uid === "admin-ummo-master";

  return {
    uid: isOwnerRecord ? "usr_owner•••" : maskUid(user.uid),
    email: isOwnerRecord ? "ow***@ummo.com" : maskEmail(user.email),
    username: isOwnerRecord
      ? "Store Owner (Protected)"
      : maskName(user.username || user.displayName || user.name || "Customer"),
    displayName: isOwnerRecord
      ? "Store Owner (Protected)"
      : maskName(user.displayName || user.username || user.name || "Customer"),
    phone: maskPhone(user.phone || ""),
    bio: "",
    profile_picture: "",
    role: user.role === "ADMIN" ? "ADMIN" : "CUSTOMER",
    updatedAt: user.updatedAt || null,
    lastLoginAt: user.lastLoginAt || null,
  };
}

export function projectMessageForDemoAdmin(msg) {
  if (!msg || typeof msg !== "object") return msg;
  return {
    id: msg.id,
    name: maskName(msg.name || "Visitor"),
    email: maskEmail(msg.email),
    message: "[Confidential customer inquiry hidden in Read-Only Demo Mode]",
    createdAt: msg.createdAt || null,
  };
}

export function projectSubscriberForDemoAdmin(sub) {
  if (!sub || typeof sub !== "object") return sub;
  return {
    id: sub.id,
    email: maskEmail(sub.email),
    createdAt: sub.createdAt || sub.subscribedAt || null,
    subscribedAt: sub.subscribedAt || sub.createdAt || null,
  };
}

export function projectStoreDataForDemoAdmin(state, paymentGateways) {
  return {
    status: "ok",
    demoReadOnly: true,
    storeConfig: projectPublicConfig(state?.storeConfig || {}),
    orders: Array.isArray(state?.orders)
      ? state.orders.map(projectOrderForDemoAdmin)
      : [],
    payments: Array.isArray(state?.payments)
      ? state.payments.map(projectPaymentForDemoAdmin)
      : [],
    paymentGateways,
    users: Array.isArray(state?.users)
      ? state.users.map(projectUserForDemoAdmin)
      : [],
    addresses: {},
    reviews: {},
    messages: Array.isArray(state?.messages)
      ? state.messages.map(projectMessageForDemoAdmin)
      : [],
    subscribers: Array.isArray(state?.subscribers)
      ? state.subscribers.map(projectSubscriberForDemoAdmin)
      : [],
  };
}

// Allow only storefront configuration fields; private/unknown nested fields are omitted.
const PUBLIC_CONFIG_KEYS = new Set(`heroSlides dealBanner promoCards shopHeader tag titleBold titleRegular bgColor textColor categoryFilter timerEnabled countdownDate maxUsesPerUser targetDepartment targetCategory targetProductIds applyTo stackWithCoupons buyQty giftQty minSubtotal freeShipping giftWrap tiers taxRate coupons banners featuredCollection customProducts deletedIds cartRules discountCampaigns customTaxonomy updatedAt id title name description code type value enabled active isActive startDate endDate startsAt endsAt startTime endTime discountStartTime discountEndTime discountPercentage discountPercent discountFixedAmount minOrder minimumPurchase maxDiscount usageLimit usageCount perUserLimit productIds categoryIds categories category department subcategory stock quantity sku price originalPrice thumbnail image images url link href alt label subtitle buttonText buttonLink ctaText ctaLink desktop mobile desktopImage mobileImage hero slides position order size sizes color colors variants variantId variantStock selectedSize selectedColor rating brand tags weight featured isFeatured featuredCategoryIds selectedProductIds products collectionTitle collectionSubtitle freeShippingThreshold freeShippingEnabled giftWrapEnabled giftWrapCost vatPercent shippingCost tieredDiscounts threshold percent amount freeGift minBuyQty giftName giftQty giftImage giftProductId optionalMessageEnabled showCountdown discountEnabled salePrice slug parentId children icon target scope priority stackable maxUses uses totalUsage limit currency status`.split(/\s+/));
function projectPublicConfig(value) {
  if (Array.isArray(value)) return value.map(projectPublicConfig);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(Object.entries(value)
    .filter(([key]) => PUBLIC_CONFIG_KEYS.has(key))
    .map(([key, item]) => [key, projectPublicConfig(item)]));
}
