import { createSlice } from "@reduxjs/toolkit";
import { getInitialCatalogSnapshot } from "../services/api";

const initialState = {
  Products: getInitialCatalogSnapshot(),
};

export const AllProductSlice = createSlice({
  name: "counter",
  initialState,
  reducers: {
    Allitem: (state, action) => {
      state.Products = action.payload;
    },
  },
});

export const { Allitem } = AllProductSlice.actions;

export default AllProductSlice.reducer;
