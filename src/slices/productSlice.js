import { createSlice } from "@reduxjs/toolkit";
import { getInitialCatalogSnapshot } from "../services/api";

const initialCatalog = getInitialCatalogSnapshot();

const initialState = {
  products: initialCatalog,
  filter: initialCatalog,
  options: {
    searchQuery: "",
    category: "",
    brands: [],
    minPrice: null,
    maxPrice: null,
    minRating: 0,
    inStockOnly: false,
    sort: "default",
  },
};

const getFilteredProducts = (products, options) => {
  const q = (options.searchQuery || "").toLowerCase().trim();

  const filtered = products.filter((product) => {
    const matchesSearch =
      !q ||
      product.title?.toLowerCase().includes(q) ||
      product.category?.toLowerCase().includes(q) ||
      product.brand?.toLowerCase().includes(q) ||
      product.description?.toLowerCase().includes(q) ||
      String(product.sku || "").toLowerCase().includes(q);

    const matchesCategory =
      !options.category ||
      product.category?.toLowerCase() === options.category.toLowerCase();

    const matchesBrand =
      options.brands.length === 0 || options.brands.includes(product.brand);

    const matchesMinPrice =
      options.minPrice === null || Number(product.price) >= options.minPrice;

    const matchesMaxPrice =
      options.maxPrice === null || Number(product.price) <= options.maxPrice;

    const matchesRating =
      !options.minRating || Number(product.rating || 4.5) >= options.minRating;

    const matchesStock =
      !options.inStockOnly || Number(product.stock ?? 10) > 0;

    return (
      matchesSearch &&
      matchesCategory &&
      matchesBrand &&
      matchesMinPrice &&
      matchesMaxPrice &&
      matchesRating &&
      matchesStock
    );
  });

  return [...filtered].sort((first, second) => {
    if (options.sort === "low") return Number(first.price) - Number(second.price);
    if (options.sort === "high") return Number(second.price) - Number(first.price);
    if (options.sort === "rating")
      return Number(second.rating || 4.5) - Number(first.rating || 4.5);
    if (options.sort === "discount")
      return (
        Number(second.discountPercentage || 0) -
        Number(first.discountPercentage || 0)
      );
    return 0;
  });
};

export const counterSlice = createSlice({
  name: "products",
  initialState,
  reducers: {
    addProduct: (state, action) => {
      state.products = action.payload;
      state.filter = getFilteredProducts(action.payload, state.options);
    },
    filterProduct: (state, action) => {
      state.filter = action.payload;
    },
    setShopOptions: (state, action) => {
      state.options = { ...state.options, ...action.payload };
      state.filter = getFilteredProducts(state.products, state.options);
    },
    resetShopOptions: (state) => {
      state.options = { ...initialState.options };
      state.filter = [...state.products];
    },
    allCat: (state, action) => {
      state.AllCat = action.payload;
    },
  },
});

export const {
  addProduct,
  filterProduct,
  allCat,
  setShopOptions,
  resetShopOptions,
} = counterSlice.actions;
export default counterSlice.reducer;
