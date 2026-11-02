import { createSlice } from "@reduxjs/toolkit";
import { resolveProductImage } from "../utils/productImage.js";

export const CART_DRAWER_OPEN_EVENT = "ummo:open-cart-drawer";

export function requestOpenCartDrawer(detail = {}) {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent(CART_DRAWER_OPEN_EVENT, { detail }));
  }
}

const getNormalizedSize = (obj) => {
  if (obj && (obj.size !== undefined || obj.selectedSize !== undefined)) {
    return String(obj.size ?? obj.selectedSize ?? "").trim();
  }
  return "";
};

const getNormalizedColor = (obj) => {
  if (obj && (obj.color !== undefined || obj.selectedColor !== undefined)) {
    const raw = String(obj.color ?? obj.selectedColor ?? "").trim();
    return raw === "Default" ? "" : raw;
  }
  return "";
};

export const sanitizeClientProductMessage = (raw) => {
  if (raw === null || raw === undefined) return "";
  return String(raw)
    .replace(/<\s*\/?\s*script[^>]*>/gi, "")
    .replace(/[<>]/g, "")
    .slice(0, 500);
};

const getNormalizedMessage = (obj) =>
  sanitizeClientProductMessage(
    obj?.optionalMessage ?? obj?.itemMessage ?? obj?.productMessage ?? ""
  ).trim();

const resolveMaxStock = (item, payload) => {
  const candidates = [payload?.maxStock, payload?.stock, item?.stock];
  for (const c of candidates) {
    if (c !== undefined && c !== null && c !== "") {
      const parsed = Number(c);
      if (Number.isFinite(parsed) && parsed >= 0) {
        return Math.floor(parsed);
      }
    }
  }
  return 999;
};

const persistCartProducts = (products) => {
  try {
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("carts", JSON.stringify(products));
    }
  } catch {
    // ignore storage quota errors
  }
};

const buildLineId = (id, size, color, msg, idx = 0) =>
  `${id || "item"}-${size || "std"}-${color || "std"}-${msg ? encodeURIComponent(msg.slice(0, 32)) : "nomessage"}-${idx}`;

const normalizeCartItem = (item, idx = 0) => {
  if (!item || typeof item !== "object") return null;
  const size = getNormalizedSize(item);
  const color = getNormalizedColor(item);
  const optionalMessage = getNormalizedMessage(item);
  const resolvedImg = resolveProductImage(item);
  const rawQty = Number(item.quantity ?? item.qun ?? 1);
  const safeQty = Number.isFinite(rawQty) && rawQty > 0 ? Math.floor(rawQty) : 1;
  const maxStock = resolveMaxStock(item, null);
  return {
    ...item,
    productId: item.productId ?? item.id,
    variantId: item.variantId || `${item.id}-${size || "std"}-${color || "std"}`,
    cartLineId:
      item.cartLineId || buildLineId(item.id, size, color, optionalMessage, idx),
    quantity: maxStock > 0 ? Math.min(safeQty, maxStock) : safeQty,
    ...(maxStock < 999 ? { stock: maxStock } : {}),
    size,
    color,
    selectedSize: size,
    selectedColor: color,
    image: resolvedImg,
    thumbnail: resolvedImg,
    productImageSnapshot: resolvedImg,
    productNameSnapshot: item.productNameSnapshot || item.title || item.name || "",
    optionalMessage,
  };
};

const loadCarts = () => {
  try {
    if (typeof localStorage === "undefined") return [];
    const saved = localStorage.getItem("carts");
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    const merged = [];
    parsed.forEach((rawItem, idx) => {
      const norm = normalizeCartItem(rawItem, idx);
      if (!norm) return;
      const existing = merged.find(
        (m) =>
          String(m.id) === String(norm.id) &&
          m.size === norm.size &&
          m.color === norm.color &&
          getNormalizedMessage(m) === norm.optionalMessage
      );
      if (existing) {
        const cap = resolveMaxStock(existing, norm);
        existing.quantity = Math.min(cap, existing.quantity + norm.quantity);
        if (norm.price !== undefined) existing.price = Number(norm.price);
        if (norm.originalPrice !== undefined) {
          existing.originalPrice = Number(norm.originalPrice);
        }
        if (norm.discountPercent !== undefined) {
          existing.discountPercent = Number(norm.discountPercent);
        }
        if (norm.discountEndTime !== undefined) {
          existing.discountEndTime = norm.discountEndTime;
        }
        if (norm.freeGift !== undefined) {
          existing.freeGift = norm.freeGift;
        }
      } else {
        merged.push(norm);
      }
    });
    return merged;
  } catch {
    return [];
  }
};

const loadCoupon = () => {
  try {
    if (typeof localStorage === "undefined") return null;
    const saved = localStorage.getItem("appliedCoupon");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const safeGetStorage = (key, fallback = "") => {
  try {
    if (typeof localStorage === "undefined") return fallback;
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
};

const isSameVariantAndMessage = (item, target) =>
  String(item?.id) === String(target?.id) &&
  getNormalizedSize(item) === getNormalizedSize(target) &&
  getNormalizedColor(item) === getNormalizedColor(target) &&
  getNormalizedMessage(item) === getNormalizedMessage(target);

const findCartTarget = (products, payload) => {
  if (!payload || typeof payload !== "object") return undefined;
  if (payload.cartLineId) {
    const byLineId = products.find(
      (item) => item.cartLineId && item.cartLineId === payload.cartLineId
    );
    if (byLineId) return byLineId;
  }
  const exact = products.find((item) => isSameVariantAndMessage(item, payload));
  if (exact) return exact;

  const hasExplicitVariantOrMsg =
    payload.cartLineId !== undefined ||
    payload.size !== undefined ||
    payload.selectedSize !== undefined ||
    payload.color !== undefined ||
    payload.selectedColor !== undefined ||
    payload.optionalMessage !== undefined;

  if (!hasExplicitVariantOrMsg && payload.id !== undefined) {
    return products.find((item) => String(item?.id) === String(payload.id));
  }
  return undefined;
};

const initialState = {
  products: loadCarts(),
  shippingMethod: safeGetStorage("shippingMethod", "flat") || "flat",
  appliedCoupon: loadCoupon(),
  giftWrap: safeGetStorage("ummo_gift_wrap", "false") === "true",
  giftNote: safeGetStorage("ummo_gift_note", ""),
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      if (!action.payload || action.payload.id === undefined) return;
      const rawQty =
        action.payload.quantity !== undefined
          ? Number(action.payload.quantity)
          : action.payload.qun !== undefined
            ? Number(action.payload.qun)
            : 1;
      if (!Number.isFinite(rawQty) || rawQty <= 0) {
        return;
      }
      const incomingQty = Math.floor(rawQty);
      const incomingSize = getNormalizedSize(action.payload);
      const incomingColor = getNormalizedColor(action.payload);
      const incomingMessage = getNormalizedMessage(action.payload);
      const resolvedImg = resolveProductImage(action.payload);

      const existing = state.products.find((fitem) =>
        isSameVariantAndMessage(fitem, {
          id: action.payload?.id,
          size: incomingSize,
          color: incomingColor,
          optionalMessage: incomingMessage,
        })
      );

      const maxStock = resolveMaxStock(existing, action.payload);
      if (maxStock <= 0) {
        return;
      }

      if (existing) {
        const currentQty = Math.max(1, Number(existing.quantity) || 1);
        existing.quantity = Math.min(maxStock, currentQty + incomingQty);
        if (maxStock < 999) {
          existing.stock = maxStock;
        }
        existing.image = resolvedImg;
        existing.thumbnail = resolvedImg;
        existing.productImageSnapshot = resolvedImg;
        if (action.payload.price !== undefined) {
          existing.price = Number(action.payload.price);
        }
        if (action.payload.originalPrice !== undefined) {
          existing.originalPrice = Number(action.payload.originalPrice);
        }
        if (action.payload.discountPercent !== undefined) {
          existing.discountPercent = Number(action.payload.discountPercent);
        }
        if (action.payload.discountEndTime !== undefined) {
          existing.discountEndTime = action.payload.discountEndTime;
        }
        if (action.payload.freeGift !== undefined) {
          existing.freeGift = action.payload.freeGift;
        }
      } else {
        const cappedQty = Math.min(maxStock, incomingQty);
        state.products.push({
          ...action.payload,
          productId: action.payload?.productId ?? action.payload?.id,
          variantId: `${action.payload?.id}-${incomingSize || "std"}-${incomingColor || "std"}`,
          cartLineId: buildLineId(
            action.payload?.id,
            incomingSize,
            incomingColor,
            incomingMessage,
            `${Date.now()}-${state.products.length}`
          ),
          quantity: cappedQty,
          ...(maxStock < 999 ? { stock: maxStock } : {}),
          size: incomingSize,
          color: incomingColor,
          selectedSize: incomingSize,
          selectedColor: incomingColor,
          image: resolvedImg,
          thumbnail: resolvedImg,
          productImageSnapshot: resolvedImg,
          productNameSnapshot:
            action.payload?.title || action.payload?.name || "",
          optionalMessage: incomingMessage,
        });
      }
      persistCartProducts(state.products);
    },
    quentityIncrease: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (!found) return;
      const maxStock = resolveMaxStock(found, action.payload);
      if (maxStock < 999) {
        found.stock = maxStock;
      }
      const currentQty = Math.max(1, Number(found.quantity) || 1);
      if (currentQty >= maxStock) {
        found.quantity = Math.max(1, maxStock);
        persistCartProducts(state.products);
        return;
      }
      found.quantity = Math.min(maxStock, currentQty + 1);
      persistCartProducts(state.products);
    },
    quentityDecrease: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (!found) return;
      found.quantity = Math.max(0, (Number(found.quantity) || 1) - 1);
      if (found.quantity < 1) {
        state.products = state.products.filter((item) => item !== found);
      }
      persistCartProducts(state.products);
    },
    setCartItemQuantity: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (!found) return;
      const requested = Number(action.payload?.quantity);
      if (!Number.isFinite(requested) || requested < 1) {
        return;
      }
      const maxStock = resolveMaxStock(found, action.payload);
      if (maxStock < 999) {
        found.stock = maxStock;
      }
      found.quantity = Math.max(1, Math.min(maxStock, Math.floor(requested)));
      persistCartProducts(state.products);
    },
    updateItemMessage: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (found) {
        found.optionalMessage = sanitizeClientProductMessage(
          action.payload?.optionalMessage ?? ""
        );
        persistCartProducts(state.products);
      }
    },
    RemoveItem: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (found) {
        state.products = state.products.filter((item) => item !== found);
      } else {
        state.products = state.products.filter(
          (item) => !isSameVariantAndMessage(item, action.payload)
        );
      }
      persistCartProducts(state.products);
    },
    EmptyCart: (state) => {
      state.products = [];
      state.appliedCoupon = null;
      state.giftWrap = false;
      state.giftNote = "";
      persistCartProducts(state.products);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("appliedCoupon");
          localStorage.removeItem("ummo_gift_wrap");
          localStorage.removeItem("ummo_gift_note");
        }
      } catch {
        // ignore
      }
    },
    setShippingMethod: (state, action) => {
      state.shippingMethod = action.payload;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("shippingMethod", action.payload);
        }
      } catch {
        // ignore
      }
    },
    applyCoupon: (state, action) => {
      state.appliedCoupon = action.payload;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("appliedCoupon", JSON.stringify(action.payload));
        }
      } catch {
        // ignore
      }
    },
    removeCoupon: (state) => {
      state.appliedCoupon = null;
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.removeItem("appliedCoupon");
        }
      } catch {
        // ignore
      }
    },
    setGiftWrap: (state, action) => {
      state.giftWrap = Boolean(action.payload);
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("ummo_gift_wrap", String(state.giftWrap));
        }
      } catch {
        // ignore
      }
    },
    setGiftNote: (state, action) => {
      state.giftNote = String(action.payload || "");
      try {
        if (typeof localStorage !== "undefined") {
          localStorage.setItem("ummo_gift_note", state.giftNote);
        }
      } catch {
        // ignore
      }
    },
  },
});

export const {
  addToCart,
  quentityIncrease,
  quentityDecrease,
  setCartItemQuantity,
  updateItemMessage,
  RemoveItem,
  EmptyCart,
  setShippingMethod,
  applyCoupon,
  removeCoupon,
  setGiftWrap,
  setGiftNote,
} = cartSlice.actions;

export default cartSlice.reducer;
