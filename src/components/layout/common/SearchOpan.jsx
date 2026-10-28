import React, { useMemo, useState } from "react";
import { IoSearchOutline, IoCloseOutline } from "react-icons/io5";
import { useDispatch, useSelector } from "react-redux";
import { productDetail } from "../../../slices/ProductDetailsSlice";
import { setShopOptions } from "../../../slices/productSlice";
import { useNavigate } from "react-router";

const QUICK_CATEGORIES = [
  { label: "Women's Dresses", value: "womens-dresses" },
  { label: "Men's Shoes", value: "mens-shoes" },
  { label: "Women's Bags", value: "womens-bags" },
  { label: "Men's Watches", value: "mens-watches" },
  { label: "Fragrances", value: "fragrances" },
  { label: "Sunglasses", value: "sunglasses" },
];

const SearchOpan = ({ searchOpen, setSearchOpen }) => {
  const Alldata = useSelector((state) => state.AllProduct.Products) || [];
  const [Input, setInput] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const dispatch = useDispatch();
  const navigate = useNavigate();

  const matchedProducts = useMemo(() => {
    const q = Input.toLowerCase().trim();
    return Alldata.filter((item) => {
      const catMatch = !selectedCat || item.category === selectedCat;
      if (!catMatch) return false;
      if (!q) return Boolean(selectedCat);
      return (
        item.title?.toLowerCase().includes(q) ||
        item.category?.toLowerCase().includes(q) ||
        item.brand?.toLowerCase().includes(q) ||
        item.description?.toLowerCase().includes(q) ||
        String(item.sku || "").toLowerCase().includes(q)
      );
    }).slice(0, 8);
  }, [Alldata, Input, selectedCat]);

  function handleSelectProduct(product) {
    dispatch(productDetail(product));
    setSearchOpen(false);
    navigate(`/shopsingle?id=${product.id}`);
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    const q = Input.trim();
    dispatch(
      setShopOptions({
        searchQuery: q,
        category: selectedCat || "",
      })
    );
    setSearchOpen(false);
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (selectedCat) params.set("category", selectedCat);
    navigate(`/shop${params.toString() ? `?${params.toString()}` : ""}`);
  }

  function handleQuickCategory(catValue) {
    const next = selectedCat === catValue ? "" : catValue;
    setSelectedCat(next);
  }

  return (
    <div className="bg-white w-full px-4 xl:px-0 overflow-y-auto absolute top-20 py-7 border-t border-b border-gray-200 shadow-2xl z-50 left-0 max-h-[80vh]">
      <div className="container mx-auto">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xs font-bold tracking-widest uppercase text-gray-500">
            WHAT ARE YOU LOOKING FOR?
          </h3>
          <button
            type="button"
            onClick={() => setSearchOpen(false)}
            className="text-gray-500 hover:text-gray-900 p-1 cursor-pointer"
            aria-label="Close search"
          >
            <IoCloseOutline size={24} />
          </button>
        </div>

        <form
          onSubmit={handleSearchSubmit}
          className="border-b-2 border-gray-900 flex pb-2.5 items-center gap-3"
        >
          <IoSearchOutline size={20} className="text-gray-500 shrink-0" />
          <input
            value={Input}
            onChange={(e) => setInput(e.target.value)}
            type="text"
            autoFocus
            placeholder="Search by product name, brand, category, or SKU..."
            className="w-full outline-none text-sm sm:text-base text-gray-900"
          />
          {Input && (
            <button
              type="button"
              onClick={() => setInput("")}
              className="text-xs text-gray-400 hover:text-gray-700 cursor-pointer"
            >
              Clear
            </button>
          )}
          <button
            type="submit"
            className="bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded cursor-pointer hover:bg-gray-800 shrink-0"
          >
            Search Shop
          </button>
        </form>

        {/* Quick Category Filter Pills */}
        <div className="mt-4 flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold uppercase text-gray-400 mr-1">
            Popular:
          </span>
          {QUICK_CATEGORIES.map((cat) => (
            <button
              key={cat.value}
              type="button"
              onClick={() => handleQuickCategory(cat.value)}
              className={`text-xs px-3 py-1 rounded-full border transition-colors cursor-pointer ${
                selectedCat === cat.value
                  ? "bg-gray-900 text-white border-gray-900"
                  : "bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-400"
              }`}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Instant Search Results Grid */}
        <div className="mt-6">
          {Input.trim() === "" && !selectedCat ? (
            <p className="text-xs text-gray-400">
              Start typing or pick a popular category above to see instant product matches.
            </p>
          ) : matchedProducts.length === 0 ? (
            <div className="py-6 text-center">
              <p className="text-sm text-gray-600 font-medium">
                No matching products found for "{Input}"
              </p>
              <p className="text-xs text-gray-400 mt-1">
                Try searching for dresses, shoes, bags, watches, or fragrances.
              </p>
            </div>
          ) : (
            <>
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-semibold uppercase text-gray-500">
                  Instant Matches ({matchedProducts.length})
                </span>
                <button
                  type="button"
                  onClick={handleSearchSubmit}
                  className="text-xs font-semibold underline text-gray-900 cursor-pointer"
                >
                  View all results in Shop →
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                {matchedProducts.map((product) => (
                  <div
                    key={product.id}
                    onClick={() => handleSelectProduct(product)}
                    className="flex items-center gap-3 p-2.5 border border-gray-200 rounded-lg hover:border-gray-900 hover:bg-gray-50 transition-all cursor-pointer"
                  >
                    <img
                      src={product.thumbnail}
                      alt={product.title}
                      loading="lazy"
                      className="w-14 h-14 object-contain rounded bg-white border border-gray-100 shrink-0"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-[10px] uppercase tracking-wider text-gray-400 truncate">
                        {product.category}
                      </p>
                      <h4 className="text-xs font-semibold text-gray-900 truncate">
                        {product.title}
                      </h4>
                      <div className="flex items-center justify-between mt-1">
                        <span className="text-xs font-bold text-gray-900">
                          ${Number(product.price || 0).toFixed(2)}
                        </span>
                        <span className="text-[11px] text-amber-600 font-medium">
                          ★ {Number(product.rating || 4.5).toFixed(1)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchOpan;
