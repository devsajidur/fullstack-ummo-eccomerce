import React, { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router";
import {
  Flame,
  SlidersHorizontal,
  Search,
  RotateCcw,
  X,
  Tag,
  Check,
} from "lucide-react";
import { Toaster } from "react-hot-toast";
import Container from "../components/layout/common/Container";
import Product from "../components/layout/common/Product";
import {
  getInitialCatalogSnapshot,
  initStoreConfigSync,
} from "../services/api";
import { getProductDiscountState } from "../utils/discountTimer";
import {
  getAllDepartments,
  matchesDepartmentFilter,
} from "../utils/categoryTaxonomy";
import { useLocalization } from "../i18n/LocalizationContext";

const DiscountsPage = () => {
  const { lang, t } = useLocalization();
  const [searchParams, setSearchParams] = useSearchParams();

  const initialDept = searchParams.get("dept") || "all";
  const [products, setProducts] = useState(() => getInitialCatalogSnapshot());
  const [selectedDept, setSelectedDept] = useState(initialDept);
  const [minDiscount, setMinDiscount] = useState(0);
  const [maxPrice, setMaxPrice] = useState(3000);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("biggest-discount");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(16);

  useEffect(() => {
    const deptParam = searchParams.get("dept") || "all";
    setSelectedDept(deptParam);
  }, [searchParams]);

  useEffect(() => {
    let active = true;
    const unsub = initStoreConfigSync((updated) => {
      if (active && Array.isArray(updated)) {
        setProducts(updated);
      }
    });
    return () => {
      active = false;
      unsub();
    };
  }, []);

  const departments = useMemo(() => getAllDepartments(false), []);

  // Only include visible products that have an active, non-expired discount
  const allDiscountedProducts = useMemo(() => {
    return products
      .filter((p) => p && p.isVisible !== false && p.status !== "draft")
      .map((p) => {
        const ds = getProductDiscountState(p);
        return { product: p, discountState: ds };
      })
      .filter(({ discountState }) => discountState.isDiscountActive);
  }, [products]);

  const filteredDeals = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = allDiscountedProducts.filter(({ product, discountState }) => {
      if (
        selectedDept !== "all" &&
        !matchesDepartmentFilter(product, selectedDept)
      ) {
        return false;
      }
      if (discountState.discountPercentage < minDiscount) {
        return false;
      }
      if (discountState.effectivePrice > maxPrice) {
        return false;
      }
      if (inStockOnly && Number(product.stock ?? 99) <= 0) {
        return false;
      }
      if (q) {
        const matchText = `${product.title || ""} ${product.brand || ""} ${
          product.category || ""
        }`.toLowerCase();
        if (!matchText.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      if (sortBy === "biggest-discount") {
        return (
          b.discountState.discountPercentage -
            a.discountState.discountPercentage ||
          b.discountState.savingsAmount - a.discountState.savingsAmount
        );
      }
      if (sortBy === "biggest-savings") {
        return b.discountState.savingsAmount - a.discountState.savingsAmount;
      }
      if (sortBy === "price-asc") {
        return a.discountState.effectivePrice - b.discountState.effectivePrice;
      }
      if (sortBy === "price-desc") {
        return b.discountState.effectivePrice - a.discountState.effectivePrice;
      }
      if (sortBy === "rating") {
        return Number(b.product.rating || 0) - Number(a.product.rating || 0);
      }
      return Number(b.product.id || 0) - Number(a.product.id || 0);
    });
  }, [
    allDiscountedProducts,
    selectedDept,
    minDiscount,
    maxPrice,
    inStockOnly,
    searchQuery,
    sortBy,
  ]);

  const maxDiscountPct = useMemo(() => {
    if (!allDiscountedProducts.length) return 0;
    return Math.max(
      ...allDiscountedProducts.map((d) => d.discountState.discountPercentage)
    );
  }, [allDiscountedProducts]);

  const handleSelectDepartment = (slug) => {
    setSelectedDept(slug);
    if (slug === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ dept: slug });
    }
  };

  const handleResetFilters = () => {
    setSelectedDept("all");
    setMinDiscount(0);
    setMaxPrice(3000);
    setInStockOnly(false);
    setSearchQuery("");
    setSortBy("biggest-discount");
    setSearchParams({});
  };

  return (
    <section className="py-6 sm:py-10 px-3 sm:px-4 min-h-[75vh]">
      <Toaster />
      <Container>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4 flex items-center gap-1.5"
        >
          <Link to="/" className="hover:text-gray-900">
            {t("nav.home", "Home")}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-bold">
            {t("nav.allDiscounts", "Discounts")}
          </span>
        </nav>

        {/* Hero Banner */}
        <div className="rounded-2xl bg-gradient-to-r from-[#111827] via-[#1f2937] to-[#7f1d1d] text-white p-5 sm:p-8 md:p-10 mb-6 shadow-md">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-[#C32929] text-white text-[11px] font-extrabold uppercase tracking-wider mb-3">
                <Flame size={13} />
                Verified Markdowns • Up to {maxDiscountPct}% OFF
              </span>
              <h1 className="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight">
                {t("discounts.heroTitle", "Today's Best Deals & Discounts")}
              </h1>
              <p className="text-xs sm:text-sm text-gray-100 mt-2 leading-relaxed">
                {t(
                  "discounts.heroSubtitle",
                  "Verified markdowns across Men, Women, Kids, Beauty, Electronics & Lifestyle collections."
                )}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3 shrink-0">
              <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-center">
                <span className="block text-xl sm:text-2xl font-extrabold text-white">
                  {allDiscountedProducts.length}
                </span>
                <span className="text-[11px] text-white uppercase tracking-wider">
                  Active Deals
                </span>
              </div>
              <div className="bg-black/40 backdrop-blur-sm border border-white/20 rounded-xl px-4 py-3 text-center">
                <span className="block text-xl sm:text-2xl font-extrabold text-amber-300">
                  -{maxDiscountPct}%
                </span>
                <span className="text-[11px] text-white uppercase tracking-wider">
                  Top Discount
                </span>
              </div>
            </div>
          </div>

          {/* Horizontal Department Filter Pills */}
          <div className="mt-6 pt-4 border-t border-white/15 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
            <button
              type="button"
              onClick={() => handleSelectDepartment("all")}
              className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                selectedDept === "all"
                  ? "bg-white text-gray-900 shadow"
                  : "bg-black/40 text-white hover:bg-black/60"
              }`}
            >
              {t("discounts.allDepartments", "All Departments")} (
              {allDiscountedProducts.length})
            </button>
            {departments.map((dept) => {
              const count = allDiscountedProducts.filter(({ product }) =>
                matchesDepartmentFilter(product, dept.slug)
              ).length;
              if (count === 0) return null;
              return (
                <button
                  key={dept.slug}
                  type="button"
                  onClick={() => handleSelectDepartment(dept.slug)}
                  className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedDept === dept.slug
                      ? "bg-[#C32929] text-white shadow"
                      : "bg-black/40 text-white hover:bg-black/60"
                  }`}
                >
                  {lang === "bn" ? dept.nameBn : dept.name} ({count})
                </button>
              );
            })}
          </div>
        </div>

        {/* Controls Bar: Search, Mobile Filter Trigger, Sort */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0"
            >
              <SlidersHorizontal size={15} />
              <span>Filters</span>
            </button>
            <div className="relative flex-1 max-w-md">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search discounted items..."
                className="w-full h-[42px] pl-9 pr-3 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs font-semibold text-gray-600">
              Showing <strong className="text-gray-900">{filteredDeals.length}</strong> deals
            </span>
            <select
              aria-label="Sort discounted products"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-[42px] px-3 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:border-gray-900 cursor-pointer"
            >
              <option value="biggest-discount">
                {t("discounts.sort.biggestDiscount", "Biggest Discount (%)")}
              </option>
              <option value="biggest-savings">Biggest Savings ($)</option>
              <option value="price-asc">
                {t("discounts.sort.lowestPrice", "Price: Low to High")}
              </option>
              <option value="price-desc">
                {t("discounts.sort.highestPrice", "Price: High to Low")}
              </option>
              <option value="rating">Top Rated</option>
            </select>
          </div>
        </div>

        {/* Main Content Grid: Desktop Sidebar + Product Grid */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Desktop Filter Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-5 sticky top-24">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-gray-100">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
                <Tag size={14} className="text-[#C32929]" />
                Refine Deals
              </h2>
              <button
                type="button"
                onClick={handleResetFilters}
                className="text-[11px] font-bold text-[#C32929] hover:underline flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw size={12} />
                Reset
              </button>
            </div>

            {/* Minimum Discount % */}
            <div className="mb-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2.5">
                {t("discounts.minDiscount", "Minimum Discount")}
              </h3>
              <div className="space-y-1.5">
                {[
                  { label: "All Active Discounts", value: 0 },
                  { label: "10% OFF or more", value: 10 },
                  { label: "15% OFF or more", value: 15 },
                  { label: "18% OFF or more", value: 18 },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setMinDiscount(opt.value)}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                      minDiscount === opt.value
                        ? "bg-gray-900 text-white"
                        : "bg-gray-50 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    <span>{opt.label}</span>
                    {minDiscount === opt.value && <Check size={13} />}
                  </button>
                ))}
              </div>
            </div>

            {/* Max Price Filter */}
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  {t("discounts.priceRange", "Max Price")}
                </h3>
                <span className="text-xs font-extrabold text-gray-900">
                  ${maxPrice}
                </span>
              </div>
              <input
                type="range"
                aria-label="Maximum price filter"
                min="15"
                max="3000"
                step="15"
                value={maxPrice}
                onChange={(e) => setMaxPrice(Number(e.target.value))}
                className="w-full accent-gray-900 cursor-pointer"
              />
              <div className="flex justify-between text-[11px] text-gray-600 mt-1">
                <span>$15</span>
                <span>$3,000</span>
              </div>
            </div>

            {/* Availability */}
            <div>
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-800 p-2.5 rounded-lg bg-gray-50 hover:bg-gray-100">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 accent-gray-900 rounded"
                />
                <span>{t("discounts.inStockOnly", "In-Stock Only")}</span>
              </label>
            </div>
          </aside>

          {/* Product Listing Grid */}
          <div className="flex-1 w-full">
            {filteredDeals.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                  {filteredDeals.slice(0, visibleCount).map(({ product }, idx) => (
                    <Product
                      key={product.id}
                      item={product}
                      id={product.id}
                      productImage={product.thumbnail}
                      productCatagory={product.category}
                      productTitle={product.title}
                      productPrice={product.price}
                      discountBadge={product.discountPercentage}
                      priority={idx < 2}
                    />
                  ))}
                </div>
                {filteredDeals.length > visibleCount && (
                  <div className="mt-8 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 24)}
                      className="inline-flex items-center justify-center px-6 min-h-[44px] rounded-xl bg-gray-900 hover:bg-[#C32929] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Load More Deals ({filteredDeals.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center my-4">
                <Flame size={40} className="mx-auto text-gray-300 mb-3" />
                <h3 className="text-base sm:text-lg font-bold text-gray-900">
                  {t(
                    "discounts.emptyTitle",
                    "No Active Discounts Match Your Filters"
                  )}
                </h3>
                <p className="text-xs sm:text-sm text-gray-500 mt-1 max-w-md mx-auto">
                  {t(
                    "discounts.emptyDesc",
                    "Try clearing your department or discount percentage filters to view all active offers."
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-5 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider hover:bg-gray-800 cursor-pointer"
                >
                  <RotateCcw size={14} />
                  {t("discounts.clearFilters", "Reset Filters")}
                </button>
              </div>
            )}
          </div>
        </div>
      </Container>

      {/* Mobile Slide-Out Filter Drawer */}
      {mobileFilterOpen && (
        <div
          className="fixed inset-0 z-50 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Filter deals"
        >
          <div
            onClick={() => setMobileFilterOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
          />
          <aside className="fixed top-0 left-0 bottom-0 z-50 w-[86vw] max-w-[320px] h-[100dvh] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Filter Discounts
              </h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-gray-700 hover:bg-gray-100"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-6">
              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Department
                </h4>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => handleSelectDepartment("all")}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                      selectedDept === "all"
                        ? "bg-gray-900 text-white"
                        : "bg-gray-100 text-gray-700"
                    }`}
                  >
                    All
                  </button>
                  {departments.map((dept) => (
                    <button
                      key={dept.slug}
                      type="button"
                      onClick={() => handleSelectDepartment(dept.slug)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                        selectedDept === dept.slug
                          ? "bg-[#C32929] text-white"
                          : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {lang === "bn" ? dept.nameBn : dept.name}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Minimum Discount
                </h4>
                <div className="grid grid-cols-2 gap-2">
                  {[0, 10, 15, 18].map((val) => (
                    <button
                      key={val}
                      type="button"
                      onClick={() => setMinDiscount(val)}
                      className={`py-2.5 px-3 rounded-lg text-xs font-bold border ${
                        minDiscount === val
                          ? "border-gray-900 bg-gray-900 text-white"
                          : "border-gray-200 text-gray-700"
                      }`}
                    >
                      {val === 0 ? "All Deals" : `${val}%+ OFF`}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                    Max Price
                  </h4>
                  <span className="text-xs font-extrabold text-gray-900">
                    ${maxPrice}
                  </span>
                </div>
                <input
                  type="range"
                  min="15"
                  max="3000"
                  step="15"
                  value={maxPrice}
                  onChange={(e) => setMaxPrice(Number(e.target.value))}
                  className="w-full accent-gray-900"
                />
              </div>

              <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-800 p-3 rounded-lg bg-gray-50">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 accent-gray-900 rounded"
                />
                <span>In-Stock Items Only</span>
              </label>
            </div>

            <div className="p-4 border-t border-gray-200 grid grid-cols-2 gap-2.5 bg-gray-50 safe-area-bottom">
              <button
                type="button"
                onClick={handleResetFilters}
                className="min-h-[44px] rounded-lg border border-gray-300 bg-white text-xs font-bold uppercase tracking-wider text-gray-800"
              >
                Reset
              </button>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="min-h-[44px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider"
              >
                Apply ({filteredDeals.length})
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};

export default DiscountsPage;
