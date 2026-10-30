import { useState } from "react";
import { FaChevronUp } from "react-icons/fa6";
import { FiSearch } from "react-icons/fi";
import { useSelector, useDispatch } from "react-redux";
import { resetShopOptions, setShopOptions } from "../../slices/productSlice";

function SectionHeader({ title, open, onToggle }) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className="flex w-full items-center justify-between py-2 text-left cursor-pointer"
    >
      <span className="font-jost text-[12px] text-nowrap xl:text-base font-semibold uppercase tracking-wide text-primary">
        {title}
      </span>
      <FaChevronUp
        strokeWidth={2}
        className={`text-primary text-sm transition-transform duration-200 ${
          open ? "" : "rotate-180"
        }`}
      />
    </button>
  );
}

export default function ShopFilter({ setCurrentPage = () => {} }) {
  const [openSections, setOpenSections] = useState({
    search: true,
    categories: true,
    rating: true,
    brands: true,
    price: true,
  });

  const Products = useSelector((state) => state.Products.products) || [];
  const options = useSelector((state) => state.Products.options);
  const CATEGORIES = [
    ...new Set(Products.map((item) => item.category).filter(Boolean)),
  ];
  const BRANDS = [
    ...new Set(Products.map((item) => item.brand).filter(Boolean)),
  ];
  const [brandSearch, setBrandSearch] = useState("");
  const dispatch = useDispatch();

  const prices = Products.map((item) => Number(item.price)).filter(
    (price) => !Number.isNaN(price) && price > 0
  );
  const PRICE_FLOOR = prices.length ? Math.floor(Math.min(...prices)) : 0;
  const PRICE_CEIL = prices.length ? Math.ceil(Math.max(...prices)) : 1000;

  const minPrice = options.minPrice ?? PRICE_FLOOR;
  const maxPrice = options.maxPrice ?? PRICE_CEIL;

  const toggleSection = (key) =>
    setOpenSections((prev) => ({ ...prev, [key]: !prev[key] }));

  function updateOptions(changes) {
    dispatch(setShopOptions(changes));
    setCurrentPage(1);
  }

  const handleMinChange = (e) => {
    const value = Math.min(Number(e.target.value), maxPrice - 1);
    updateOptions({ minPrice: value });
  };

  const handleMaxChange = (e) => {
    const value = Math.max(Number(e.target.value), minPrice + 1);
    updateOptions({ maxPrice: value });
  };

  const filteredBrands = BRANDS.filter((brand) =>
    brand.toLowerCase().includes(brandSearch.toLowerCase().trim())
  );

  const hasActiveFilters =
    Boolean(options.searchQuery) ||
    Boolean(options.category) ||
    options.brands.length > 0 ||
    options.minRating > 0 ||
    options.inStockOnly ||
    options.minPrice !== null ||
    options.maxPrice !== null;

  return (
    <div className="font-jost w-64 sm:w-72 lg:w-60 xl:w-80 xl:px-1 text-primary -mt-3 xl:-mt-2 px-2 pt-2 xl:pt-0">
      {/* Active Filter Reset Banner */}
      {hasActiveFilters && (
        <div className="mb-4 p-3 bg-gray-100 rounded-md flex items-center justify-between">
          <span className="text-xs font-semibold text-gray-700">
            Active Filters
          </span>
          <button
            type="button"
            onClick={() => {
              dispatch(resetShopOptions());
              setCurrentPage(1);
            }}
            className="text-xs font-bold text-red-600 hover:underline cursor-pointer"
          >
            Reset All
          </button>
        </div>
      )}

      {/* Keyword Search Filter */}
      <div className="border-b border-gray-200 pb-5 mb-4">
        <SectionHeader
          title="Search Catalog"
          open={openSections.search}
          onToggle={() => toggleSection("search")}
        />
        {openSections.search && (
          <div className="relative mt-2">
            <input
              type="text"
              value={options.searchQuery || ""}
              onChange={(e) => updateOptions({ searchQuery: e.target.value })}
              placeholder="Keyword, SKU, category..."
              className="w-full border border-gray-300 py-2 pl-3 pr-8 text-xs xl:text-sm text-primary placeholder-gray outline-none focus:border-primary rounded-sm"
            />
            <FiSearch
              size={15}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray"
            />
          </div>
        )}
      </div>

      {/* Product Categories */}
      <div className="border-b border-gray-200 pb-6">
        <SectionHeader
          title="Product Categories"
          open={openSections.categories}
          onToggle={() => toggleSection("categories")}
        />
        {openSections.categories && (
          <ul className="xl:mt-3 xl:space-y-2.5 space-y-1 max-h-64 overflow-y-auto pr-1">
            <li
              className={`flex items-center justify-between cursor-pointer text-[12px] xl:text-[14px] ${
                !options.category ? "text-black font-semibold" : "text-gray"
              }`}
              onClick={() => updateOptions({ category: "" })}
            >
              <span>All Categories</span>
              <span className="text-[11px] text-gray-600">
                ({Products.length})
              </span>
            </li>
            {CATEGORIES.map((cat) => {
              const count = Products.filter((p) => p.category === cat).length;
              return (
                <li key={cat} className="flex items-center justify-between">
                  <button
                    type="button"
                    className={`xl:text-[14px] text-[12px] capitalize cursor-pointer text-left ${
                      options.category === cat
                        ? "text-black font-semibold"
                        : "text-gray"
                    } transition-colors`}
                    onClick={() => updateOptions({ category: cat })}
                  >
                    {cat.replace(/-/g, " ")}
                  </button>
                  <span className="text-[11px] text-gray-600">({count})</span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Customer Rating & Availability */}
      <div className="border-b border-gray-200 py-5">
        <SectionHeader
          title="Rating & Stock"
          open={openSections.rating}
          onToggle={() => toggleSection("rating")}
        />
        {openSections.rating && (
          <div className="mt-3 space-y-2.5">
            {[4.5, 4.0, 3.5, 0].map((ratingVal) => (
              <button
                key={ratingVal}
                type="button"
                onClick={() => updateOptions({ minRating: ratingVal })}
                className={`flex items-center justify-between w-full text-xs xl:text-sm py-1 cursor-pointer ${
                  (options.minRating || 0) === ratingVal
                    ? "font-bold text-black"
                    : "text-gray-600"
                }`}
              >
                <span>
                  {ratingVal > 0 ? `★ ${ratingVal}+ & Up` : "All Ratings"}
                </span>
                {(options.minRating || 0) === ratingVal && (
                  <span className="text-[10px] bg-black text-white px-2 py-0.5 rounded">
                    Active
                  </span>
                )}
              </button>
            ))}

            <label className="flex items-center gap-2.5 pt-2 border-t border-gray-100 text-xs xl:text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(options.inStockOnly)}
                onChange={(e) =>
                  updateOptions({ inStockOnly: e.target.checked })
                }
                className="accent-primary"
              />
              <span>In-Stock Items Only</span>
            </label>
          </div>
        )}
      </div>

      {/* Brands */}
      <div className="border-b border-gray-200 py-6">
        <SectionHeader
          title="Brands"
          open={openSections.brands}
          onToggle={() => toggleSection("brands")}
        />
        {openSections.brands && (
          <div className="mt-4">
            <div className="relative mb-4">
              <input
                type="text"
                value={brandSearch}
                onChange={(e) => setBrandSearch(e.target.value)}
                placeholder="Filter brands..."
                className="w-full border border-gray-300 py-2 pl-3 pr-9 text-xs xl:text-sm text-primary placeholder-gray outline-none focus:border-primary"
              />
              <FiSearch
                size={15}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray"
              />
            </div>
            <ul className="xl:space-y-3 space-y-2 max-h-52 overflow-y-auto pr-1">
              {filteredBrands.map((brand) => (
                <li key={brand} className="flex items-center justify-between">
                  <label className="flex cursor-pointer items-center gap-3 text-[12px] xl:text-[14px] text-primary">
                    <input
                      type="checkbox"
                      checked={options.brands.includes(brand)}
                      onChange={() =>
                        updateOptions({
                          brands: options.brands.includes(brand)
                            ? options.brands.filter(
                                (selectedBrand) => selectedBrand !== brand
                              )
                            : [...options.brands, brand],
                        })
                      }
                      className="lg:h-4 lg:w-4 rounded-none border-gray-300 text-primary accent-primary"
                    />
                    {brand}
                  </label>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Price */}
      <div className="py-6">
        <SectionHeader
          title="Price"
          open={openSections.price}
          onToggle={() => toggleSection("price")}
        />
        {openSections.price && (
          <div className="mt-5 space-y-4">
            <div>
              <div className="flex items-center justify-between text-xs xl:text-sm mb-1">
                <label htmlFor="shop-min-price-range" className="text-primary font-medium">
                  Min Price
                </label>
                <span className="text-primary font-semibold">
                  ${minPrice ?? PRICE_FLOOR}
                </span>
              </div>
              <input
                id="shop-min-price-range"
                type="range"
                aria-label="Minimum price"
                min={PRICE_FLOOR}
                max={PRICE_CEIL}
                value={minPrice}
                onChange={handleMinChange}
                className="w-full h-7 accent-primary cursor-pointer"
              />
            </div>
            <div>
              <div className="flex items-center justify-between text-xs xl:text-sm mb-1">
                <label htmlFor="shop-max-price-range" className="text-primary font-medium">
                  Max Price
                </label>
                <span className="text-primary font-semibold">
                  ${maxPrice ?? PRICE_CEIL}
                </span>
              </div>
              <input
                id="shop-max-price-range"
                type="range"
                aria-label="Maximum price"
                min={PRICE_FLOOR}
                max={PRICE_CEIL}
                value={maxPrice}
                onChange={handleMaxChange}
                className="w-full h-7 accent-primary cursor-pointer"
              />
            </div>
          </div>
        )}
      </div>

      <style>{`
        .range-thumb::-webkit-slider-thumb {
          pointer-events: auto;
          appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid var(--color-primary);
          cursor: pointer;
        }
        .range-thumb::-moz-range-thumb {
          pointer-events: auto;
          width: 18px;
          height: 18px;
          border-radius: 9999px;
          background: #ffffff;
          border: 2px solid var(--color-primary);
          cursor: pointer;
        }
      `}</style>
    </div>
  );
}
