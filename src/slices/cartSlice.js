import { createSlice } from "@reduxjs/toolkit";
import { resolveProductImage } from "../utils/productImage";

const getNormalizedSize = (obj) => obj?.size || obj?.selectedSize || "M";
const getNormalizedColor = (obj) => {
  const raw = obj?.color || obj?.selectedColor || "Black";
  return raw === "Default" ? "Black" : raw;
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

const buildLineId = (id, size, color, msg, idx = 0) =>
  `${id || "item"}-${size}-${color}-${msg ? encodeURIComponent(msg.slice(0, 32)) : "nomessage"}-${idx}`;

const normalizeCartItem = (item, idx = 0) => {
  if (!item || typeof item !== "object") return null;
  const size = getNormalizedSize(item);
  const color = getNormalizedColor(item);
  const optionalMessage = getNormalizedMessage(item);
  const resolvedImg = resolveProductImage(item);
  return {
    ...item,
    productId: item.productId ?? item.id,
    variantId: item.variantId || `${item.id}-${size}-${color}`,
    cartLineId:
      item.cartLineId || buildLineId(item.id, size, color, optionalMessage, idx),
    quantity: Math.max(1, Number(item.quantity) || 1),
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
        existing.quantity += norm.quantity;
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
    const saved = localStorage.getItem("appliedCoupon");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const isSameVariantAndMessage = (item, target) =>
  String(item?.id) === String(target?.id) &&
  getNormalizedSize(item) === getNormalizedSize(target) &&
  getNormalizedColor(item) === getNormalizedColor(target) &&
  getNormalizedMessage(item) === getNormalizedMessage(target);

const findCartTarget = (products, payload) => {
  if (payload?.cartLineId) {
    const byLineId = products.find(
      (item) => item.cartLineId && item.cartLineId === payload.cartLineId
    );
    if (byLineId) return byLineId;
  }
  const exact = products.find((item) => isSameVariantAndMessage(item, payload));
  if (exact) return exact;
  const byVariant = products.find(
    (item) =>
      String(item?.id) === String(payload?.id) &&
      getNormalizedSize(item) === getNormalizedSize(payload) &&
      getNormalizedColor(item) === getNormalizedColor(payload)
  );
  if (byVariant) return byVariant;
  return products.find((item) => String(item?.id) === String(payload?.id));
};

const initialState = {
  products: loadCarts(),
  shippingMethod: localStorage.getItem("shippingMethod") || "flat",
  appliedCoupon: loadCoupon(),
  giftWrap: localStorage.getItem("ummo_gift_wrap") === "true",
  giftNote: localStorage.getItem("ummo_gift_note") || "",
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const incomingQty = Math.max(1, Number(action.payload?.quantity) || 1);
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

      if (existing) {
        existing.quantity =
          Math.max(1, Number(existing.quantity) || 1) + incomingQty;
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
        state.products.push({
          ...action.payload,
          productId: action.payload?.productId ?? action.payload?.id,
          variantId: `${action.payload?.id}-${incomingSize}-${incomingColor}`,
          cartLineId: buildLineId(
            action.payload?.id,
            incomingSize,
            incomingColor,
            incomingMessage,
            Date.now()
          ),
          quantity: incomingQty,
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
      localStorage.setItem("carts", JSON.stringify(state.products));
    },
    quentityIncrease: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (found) {
        found.quantity = Math.max(1, Number(found.quantity) || 1) + 1;
        localStorage.setItem("carts", JSON.stringify(state.products));
      }
    },
    quentityDecrease: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (found) {
        found.quantity = Math.max(0, (Number(found.quantity) || 1) - 1);
        if (found.quantity < 1) {
          state.products = state.products.filter((item) => item !== found);
        }
        localStorage.setItem("carts", JSON.stringify(state.products));
      }
    },
    updateItemMessage: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (found) {
        found.optionalMessage = sanitizeClientProductMessage(
          action.payload?.optionalMessage ?? ""
        );
        localStorage.setItem("carts", JSON.stringify(state.products));
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
      localStorage.setItem("carts", JSON.stringify(state.products));
    },
    EmptyCart: (state) => {
      state.products = [];
      state.appliedCoupon = null;
      state.giftWrap = false;
      state.giftNote = "";
      localStorage.setItem("carts", JSON.stringify(state.products));
      localStorage.removeItem("appliedCoupon");
      localStorage.removeItem("ummo_gift_wrap");
      localStorage.removeItem("ummo_gift_note");
    },
    setShippingMethod: (state, action) => {
      state.shippingMethod = action.payload;
      localStorage.setItem("shippingMethod", action.payload);
    },
    applyCoupon: (state, action) => {
      state.appliedCoupon = action.payload;
      localStorage.setItem("appliedCoupon", JSON.stringify(action.payload));
    },
    removeCoupon: (state) => {
      state.appliedCoupon = null;
      localStorage.removeItem("appliedCoupon");
    },
    setGiftWrap: (state, action) => {
      state.giftWrap = Boolean(action.payload);
      localStorage.setItem("ummo_gift_wrap", String(state.giftWrap));
    },
    setGiftNote: (state, action) => {
      state.giftNote = String(action.payload || "");
      localStorage.setItem("ummo_gift_note", state.giftNote);
    },
  },
});

export const {
  addToCart,
  quentityIncrease,
  quentityDecrease,
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
