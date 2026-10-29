import { createSlice } from "@reduxjs/toolkit";

const getNormalizedSize = (obj) => obj?.size || obj?.selectedSize || "M";
const getNormalizedColor = (obj) => {
  const raw = obj?.color || obj?.selectedColor || "Black";
  return raw === "Default" ? "Black" : raw;
};

const normalizeCartItem = (item) => {
  if (!item || typeof item !== "object") return null;
  const size = getNormalizedSize(item);
  const color = getNormalizedColor(item);
  return {
    ...item,
    quantity: Math.max(1, Number(item.quantity) || 1),
    size,
    color,
    selectedSize: size,
    selectedColor: color,
  };
};

const loadCarts = () => {
  try {
    const saved = localStorage.getItem("carts");
    if (!saved) return [];
    const parsed = JSON.parse(saved);
    if (!Array.isArray(parsed)) return [];
    return parsed.map(normalizeCartItem).filter(Boolean);
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

const isSameVariant = (item, target) =>
  String(item?.id) === String(target?.id) &&
  getNormalizedSize(item) === getNormalizedSize(target) &&
  getNormalizedColor(item) === getNormalizedColor(target);

const findCartTarget = (products, payload) => {
  const exact = products.find((item) => isSameVariant(item, payload));
  if (exact) return exact;
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

      const existing = state.products.find((fitem) =>
        isSameVariant(fitem, {
          id: action.payload?.id,
          size: incomingSize,
          color: incomingColor,
        })
      );

      if (existing) {
        existing.quantity = Math.max(1, Number(existing.quantity) || 1) + incomingQty;
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
          quantity: incomingQty,
          size: incomingSize,
          color: incomingColor,
          selectedSize: incomingSize,
          selectedColor: incomingColor,
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
    RemoveItem: (state, action) => {
      const found = findCartTarget(state.products, action.payload);
      if (found) {
        state.products = state.products.filter((item) => item !== found);
      } else {
        state.products = state.products.filter(
          (item) => !isSameVariant(item, action.payload)
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
  RemoveItem,
  EmptyCart,
  setShippingMethod,
  applyCoupon,
  removeCoupon,
  setGiftWrap,
  setGiftNote,
} = cartSlice.actions;

export default cartSlice.reducer;
