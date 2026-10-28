import { createSlice } from "@reduxjs/toolkit";

const loadCarts = () => {
  try {
    const saved = localStorage.getItem("carts");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const initialState = {
  products: loadCarts(),
  shippingMethod: localStorage.getItem("shippingMethod") || "free",
};

export const cartSlice = createSlice({
  name: "cart",
  initialState,
  reducers: {
    addToCart: (state, action) => {
      const existing = state.products.find(
        (fitem) => fitem.id === action.payload.id
      );
      if (existing) {
        existing.quantity++;
      } else {
        state.products.push({ ...action.payload, quantity: 1 });
      }
      localStorage.setItem("carts", JSON.stringify(state.products));
    },
    quentityIncrease: (state, action) => {
      const found = state.products.find((item) => item.id == action.payload.id);
      if (found) {
        found.quantity++;
        localStorage.setItem("carts", JSON.stringify(state.products));
      }
    },
    quentityDecrease: (state, action) => {
      const found = state.products.find((item) => item.id == action.payload.id);
      if (found) {
        found.quantity--;
        if (found.quantity < 1) {
          state.products = state.products.filter(
            (item) => item.id != action.payload.id
          );
        }
        localStorage.setItem("carts", JSON.stringify(state.products));
      }
    },
    RemoveItem: (state, action) => {
      state.products = state.products.filter(
        (item) => item.id != action.payload.id
      );
      localStorage.setItem("carts", JSON.stringify(state.products));
    },
    EmptyCart: (state) => {
      state.products = [];
      localStorage.setItem("carts", JSON.stringify(state.products));
    },
    setShippingMethod: (state, action) => {
      state.shippingMethod = action.payload;
      localStorage.setItem("shippingMethod", action.payload);
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
} = cartSlice.actions;

export default cartSlice.reducer;
