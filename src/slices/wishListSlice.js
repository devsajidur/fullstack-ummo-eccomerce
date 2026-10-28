import { createSlice } from "@reduxjs/toolkit";

const loadWishList = () => {
  try {
    const saved = localStorage.getItem("wishList");
    return saved ? JSON.parse(saved) : [];
  } catch {
    return [];
  }
};

const initialState = {
  wishProduct: loadWishList(),
  boolean: null,
};

export const wishListSlice = createSlice({
  name: "wishList",
  initialState,
  reducers: {
    addWishList: (state, action) => {
      const existingProduct = state.wishProduct.find(
        (item) => item.id === action.payload.id
      );
      if (existingProduct) {
        return;
      }
      state.wishProduct.push(action.payload);
      localStorage.setItem("wishList", JSON.stringify(state.wishProduct));
    },
    deleteWishEndevisual: (state, action) => {
      state.wishProduct = state.wishProduct.filter(
        (item) => item.id !== action.payload.id
      );
      localStorage.setItem("wishList", JSON.stringify(state.wishProduct));
    },
    clearWishList: (state) => {
      state.wishProduct = [];
      localStorage.removeItem("wishList");
    },
    deletebydoubleckick: (state, action) => {
      state.boolean = action.payload;
    },
  },
});

export const {
  addWishList,
  deleteWishEndevisual,
  clearWishList,
  deletebydoubleckick,
} = wishListSlice.actions;

export default wishListSlice.reducer;
