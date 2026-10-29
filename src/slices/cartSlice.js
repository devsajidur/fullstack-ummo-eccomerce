import { createSlice } from "@reduxjs/toolkit";

const loadCarts = () => {
  try {
    const saved = localStorage.getItem("carts");
    return saved ? JSON.parse(saved) : [];
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
  String(item.id) === String(target.id) &&
  (item.size || "M") === (target.size || "M") &&
  (item.color || "Default") === (target.color || "Default");

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
      const incomingQty = Number(action.payload.quantity) || 1;
      const incomingSize =
        action.payload.size || action.payload.selectedSize || "M";
      const incomingColor =
        action.payload.color || action.payload.selectedColor || "Default";

      const existing = state.products.find((fitem) =>
        isSameVariant(fitem, {
          id: action.payload.id,
          size: incomingSize,
          color: incomingColor,
        })
      );

      if (existing) {
        existing.quantity += incomingQty;
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
      const found = state.products.find((item) =>
        isSameVariant(item, action.payload)
      );
      if (found) {
        found.quantity++;
        localStorage.setItem("carts", JSON.stringify(state.products));
      }
    },
    quentityDecrease: (state, action) => {
      const found = state.products.find((item) =>
        isSameVariant(item, action.payload)
      );
      if (found) {
        found.quantity--;
        if (found.quantity < 1) {
          state.products = state.products.filter(
            (item) => !isSameVariant(item, action.payload)
          );
        }
        localStorage.setItem("carts", JSON.stringify(state.products));
      }
    },
    RemoveItem: (state, action) => {
      state.products = state.products.filter(
        (item) => !isSameVariant(item, action.payload)
      );
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
