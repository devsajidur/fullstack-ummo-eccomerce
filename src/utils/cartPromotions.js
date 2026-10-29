import { onValue, ref, set } from "firebase/database";
import { db } from "../../firebase.config";

const CART_RULES_STORAGE_KEY = "ummo_admin_cart_rules_v1";
const RECENTLY_VIEWED_KEY = "ummo_recently_viewed_v1";

export const DEFAULT_CART_RULES = {
  freeShippingEnabled: true,
  freeShippingThreshold: 100,
  bogoEnabled: true,
  bogoBuyCount: 2,
  bogoFreeCount: 1,
  bogoLabel: "Buy 2 Get 1 FREE",
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

export function saveStoredCartRules(rules) {
  const merged = {
    ...DEFAULT_CART_RULES,
    ...rules,
    freeShippingThreshold: Math.max(0, Number(rules.freeShippingThreshold) || 0),
    bogoBuyCount: Math.max(1, Number(rules.bogoBuyCount) || 2),
    bogoFreeCount: Math.max(1, Number(rules.bogoFreeCount) || 1),
    tieredMinSpend: Math.max(0, Number(rules.tieredMinSpend) || 200),
    tieredDiscountPercent: Math.max(
      0,
      Math.min(80, Number(rules.tieredDiscountPercent) || 10)
    ),
  };
  try {
    localStorage.setItem(CART_RULES_STORAGE_KEY, JSON.stringify(merged));
    window.dispatchEvent(
      new CustomEvent("ummo:cart-rules-updated", { detail: merged })
    );
  } catch {
    // ignore
  }
  set(ref(db, "storeConfig/cartRules"), merged).catch(() => {});
  return merged;
}

let cartRulesSubscribed = false;
export function initCartRulesSync() {
  if (cartRulesSubscribed) return;
  cartRulesSubscribed = true;
  try {
    onValue(ref(db, "storeConfig/cartRules"), (snap) => {
      if (!snap.exists()) return;
      const val = snap.val();
      if (val && typeof val === "object") {
        const merged = { ...DEFAULT_CART_RULES, ...val };
        localStorage.setItem(CART_RULES_STORAGE_KEY, JSON.stringify(merged));
        window.dispatchEvent(
          new CustomEvent("ummo:cart-rules-updated", { detail: merged })
        );
      }
    });
  } catch {
    // ignore
  }
}

/**
 * Computes all active international e-commerce cart promotions:
 * - Subtotal & Total Unit Count
 * - Free Shipping threshold progress & automatic free delivery unlock
 * - Buy X Get Y Free (BOGO) automatic discount (both per-item & mix-and-match across cart)
 * - Tiered Spend automatic VIP discount
 */
export function computeCartPromotions(
  cartItems = [],
  rules = getStoredCartRules()
) {
  const items = Array.isArray(cartItems) ? cartItems : [];
  const subtotal = Number(
    items
      .reduce(
        (sum, item) =>
          sum + Number(item.price || 0) * Number(item.quantity || 1),
        0
      )
      .toFixed(2)
  );

  const totalUnits = items.reduce(
    (sum, item) => sum + Number(item.quantity || 1),
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
    threshold > 0 ? Math.min(100, Math.round((subtotal / threshold) * 100)) : 100;

  // 2. Buy X Get Y Free (BOGO) Calculation
  const buyX = Math.max(1, Number(rules.bogoBuyCount || 2));
  const getY = Math.max(1, Number(rules.bogoFreeCount || 1));
  const groupSize = buyX + getY;

  let bogoDiscount = 0;
  let bogoFreeUnitsCount = 0;
  let unitsNeededForNextBogo = 0;

  if (rules.bogoEnabled && totalUnits > 0) {
    // Expand all units in cart sorted by price ascending so every Nth cheapest unit in each group is free
    const unitPrices = [];
    items.forEach((it) => {
      const qty = Math.max(1, Number(it.quantity || 1));
      const p = Number(it.price || 0);
      for (let i = 0; i < qty; i += 1) {
        unitPrices.push(p);
      }
    });
    unitPrices.sort((a, b) => a - b);

    const fullGroups = Math.floor(totalUnits / groupSize);
    bogoFreeUnitsCount = fullGroups * getY;

    for (let i = 0; i < bogoFreeUnitsCount; i += 1) {
      bogoDiscount += unitPrices[i] || 0;
    }
    bogoDiscount = Number(bogoDiscount.toFixed(2));

    const remainder = totalUnits % groupSize;
    if (remainder >= buyX) {
      unitsNeededForNextBogo = groupSize - remainder;
    } else if (fullGroups === 0) {
      unitsNeededForNextBogo = groupSize - totalUnits;
    }
  }

  // 3. Tiered Spend Automatic Discount
  const netAfterBogo = Math.max(0, subtotal - bogoDiscount);
  let tieredDiscount = 0;
  const tieredMin = Number(rules.tieredMinSpend || 200);
  const tieredPct = Number(rules.tieredDiscountPercent || 10);

  if (
    rules.tieredDiscountEnabled &&
    tieredMin > 0 &&
    netAfterBogo >= tieredMin
  ) {
    tieredDiscount = Number(((netAfterBogo * tieredPct) / 100).toFixed(2));
  }

  return {
    subtotal,
    totalUnits,
    freeShippingEnabled: Boolean(rules.freeShippingEnabled),
    freeShippingThreshold: threshold,
    freeShippingUnlocked,
    amountNeededForFreeShipping,
    freeShippingProgress,
    bogoEnabled: Boolean(rules.bogoEnabled),
    bogoBuyCount: buyX,
    bogoFreeCount: getY,
    bogoGroupSize: groupSize,
    bogoFreeUnitsCount,
    bogoDiscount,
    unitsNeededForNextBogo,
    tieredDiscountEnabled: Boolean(rules.tieredDiscountEnabled),
    tieredMinSpend: tieredMin,
    tieredDiscountPercent: tieredPct,
    tieredDiscount,
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
