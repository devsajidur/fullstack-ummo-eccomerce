import { createSlice } from "@reduxjs/toolkit";

const loadSelectedProduct = () => {
  try {
    const saved = localStorage.getItem("selectedProductDetails");
    return saved ? JSON.parse(saved) : null;
  } catch {
    return null;
  }
};

const initialState = {
  Details: loadSelectedProduct() || {},
};

export const ProductDetailsSlice = createSlice({
  name: "ProductDetails",
  initialState,
  reducers: {
    productDetail: (state, action) => {
      state.Details = action.payload;
      if (action.payload) {
        localStorage.setItem(
          "selectedProductDetails",
          JSON.stringify(action.payload)
        );
      }
    },
  },
});

export const { productDetail } = ProductDetailsSlice.actions;

export default ProductDetailsSlice.reducer;
