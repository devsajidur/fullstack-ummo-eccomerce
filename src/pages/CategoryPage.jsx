import React, { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router";
import {
  SlidersHorizontal,
  Search,
  RotateCcw,
  X,
  Sparkles,
  Flame,
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
  getDepartmentBySlug,
  matchesDepartmentFilter,
} from "../utils/categoryTaxonomy";
import { useLocalization } from "../i18n/LocalizationContext";

const CategoryPage = () => {
  const { slug } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { lang, t } = useLocalization();

  const activeSubParam = searchParams.get("sub") || "all";
  const [products, setProducts] = useState(() => getInitialCatalogSnapshot());
  const [selectedSub, setSelectedSub] = useState(activeSubParam);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("all");
  const [maxPrice, setMaxPrice] = useState(3000);
  const [onlyDiscounted, setOnlyDiscounted] = useState(false);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [sortBy, setSortBy] = useState("featured");
  const [mobileFilterOpen, setMobileFilterOpen] = useState(false);
  const [visibleCount, setVisibleCount] = useState(16);

  useEffect(() => {
    setSelectedSub(searchParams.get("sub") || "all");
  }, [slug, searchParams]);

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

  const allDepartments = useMemo(() => getAllDepartments(false), []);
  const currentDept = useMemo(
    () =>
      getDepartmentBySlug(slug) || {
        slug: String(slug || "all").toLowerCase(),
        name: String(slug || "Collection").replace(/-/g, " "),
        nameBn: String(slug || "কালেকশন"),
        title: `${String(slug || "Collection").replace(/-/g, " ")} Collection`,
        titleBn: `${String(slug || "কালেকশন")} কালেকশন`,
        description: "Explore curated products verified for quality and value.",
        descriptionBn: "যাচাইকৃত মান ও আকর্ষণীয় মূল্যের পণ্যের সমাহার।",
        subcategories: [],
      },
    [slug]
  );

  // All visible products belonging to this department
  const departmentProducts = useMemo(() => {
    return products.filter(
      (p) =>
        p &&
        p.isVisible !== false &&
        p.status !== "draft" &&
        matchesDepartmentFilter(p, currentDept.slug, "all")
    );
  }, [products, currentDept.slug]);

  const availableBrands = useMemo(() => {
    const set = new Set();
    departmentProducts.forEach((p) => {
      if (p.brand) set.add(p.brand);
    });
    return Array.from(set).sort();
  }, [departmentProducts]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    const list = departmentProducts.filter((p) => {
      if (
        selectedSub !== "all" &&
        !matchesDepartmentFilter(p, currentDept.slug, selectedSub)
      ) {
        return false;
      }
      if (selectedBrand !== "all" && p.brand !== selectedBrand) {
        return false;
      }
      const ds = getProductDiscountState(p);
      if (ds.effectivePrice > maxPrice) {
        return false;
      }
      if (onlyDiscounted && !ds.isDiscountActive) {
        return false;
      }
      if (inStockOnly && Number(p.stock ?? 99) <= 0) {
        return false;
      }
      if (q) {
        const text = `${p.title || ""} ${p.brand || ""} ${p.category || ""} ${
          p.subcategory || ""
        }`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });

    return list.sort((a, b) => {
      const dsA = getProductDiscountState(a);
      const dsB = getProductDiscountState(b);
      if (sortBy === "price-asc") {
        return dsA.effectivePrice - dsB.effectivePrice;
      }
      if (sortBy === "price-desc") {
        return dsB.effectivePrice - dsA.effectivePrice;
      }
      if (sortBy === "discount") {
        return dsB.discountPercentage - dsA.discountPercentage;
      }
      if (sortBy === "rating") {
        return Number(b.rating || 0) - Number(a.rating || 0);
      }
      return Number(a.id || 0) - Number(b.id || 0);
    });
  }, [
    departmentProducts,
    currentDept.slug,
    selectedSub,
    selectedBrand,
    maxPrice,
    onlyDiscounted,
    inStockOnly,
    searchQuery,
    sortBy,
  ]);

  const handleSubcategoryChange = (sub) => {
    setSelectedSub(sub);
    if (sub === "all") {
      setSearchParams({});
    } else {
      setSearchParams({ sub });
    }
  };

  const handleResetFilters = () => {
    setSelectedSub("all");
    setSelectedBrand("all");
    setMaxPrice(3000);
    setOnlyDiscounted(false);
    setInStockOnly(false);
    setSearchQuery("");
    setSortBy("featured");
    setSearchParams({});
  };

  return (
    <section className="py-6 sm:py-10 px-3 sm:px-4 min-h-[75vh]">
      <Toaster />
      <Container>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="text-xs font-semibold uppercase tracking-wider text-gray-600 mb-4 flex flex-wrap items-center gap-1.5"
        >
          <Link to="/" className="hover:text-gray-900">
            {t("nav.home", "Home")}
          </Link>
          <span>/</span>
          <Link to="/shop" className="hover:text-gray-900">
            {t("nav.shop", "Shop")}
          </Link>
          <span>/</span>
          <span className="text-gray-900 font-bold">
            {lang === "bn" ? currentDept.nameBn : currentDept.name}
          </span>
          {selectedSub !== "all" && (
            <>
              <span>/</span>
              <span className="text-[#C32929] font-bold">{selectedSub}</span>
            </>
          )}
        </nav>

        {/* Department Switcher Tabs */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-4 no-scrollbar">
          {allDepartments.map((dept) => {
            const isCurrent = dept.slug === currentDept.slug;
            return (
              <Link
                key={dept.slug}
                to={`/category/${dept.slug}`}
                className={`px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors ${
                  isCurrent
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {lang === "bn" ? dept.nameBn : dept.name}
              </Link>
            );
          })}
          <Link
            to="/discounts"
            className="px-3.5 py-2 rounded-full text-xs font-bold whitespace-nowrap bg-red-50 text-[#C32929] hover:bg-red-100 inline-flex items-center gap-1"
          >
            <Flame size={13} />
            {t("nav.allDiscounts", "All Discounts")}
          </Link>
        </div>

        {/* Department Hero Header */}
        <div className="rounded-2xl bg-gradient-to-r from-gray-900 via-gray-800 to-gray-900 text-white p-5 sm:p-8 mb-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="max-w-2xl">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-white/15 text-white text-[11px] font-bold uppercase tracking-wider mb-2.5">
                <Sparkles size={12} />
                {lang === "bn" ? currentDept.nameBn : currentDept.name} Department
              </span>
              <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight capitalize">
                {lang === "bn" ? currentDept.titleBn : currentDept.title}
              </h1>
              <p className="text-xs sm:text-sm text-gray-300 mt-1.5 leading-relaxed">
                {lang === "bn"
                  ? currentDept.descriptionBn
                  : currentDept.description}
              </p>
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <div className="bg-white/10 border border-white/15 rounded-xl px-4 py-2.5 text-center">
                <span className="block text-xl font-extrabold text-white">
                  {departmentProducts.length}
                </span>
                <span className="text-[10px] uppercase tracking-wider text-gray-300">
                  Products
                </span>
              </div>
            </div>
          </div>

          {/* Subcategory Pills */}
          {Array.isArray(currentDept.subcategories) &&
            currentDept.subcategories.length > 0 && (
              <div className="mt-5 pt-4 border-t border-white/15 flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
                <button
                  type="button"
                  onClick={() => handleSubcategoryChange("all")}
                  className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                    selectedSub === "all"
                      ? "bg-white text-gray-900"
                      : "bg-white/10 text-gray-200 hover:bg-white/20"
                  }`}
                >
                  All {lang === "bn" ? currentDept.nameBn : currentDept.name} (
                  {departmentProducts.length})
                </button>
                {currentDept.subcategories.map((sub) => {
                  const subCount = departmentProducts.filter((p) =>
                    matchesDepartmentFilter(p, currentDept.slug, sub)
                  ).length;
                  return (
                    <button
                      key={sub}
                      type="button"
                      onClick={() => handleSubcategoryChange(sub)}
                      className={`px-3.5 py-1.5 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                        selectedSub.toLowerCase() === sub.toLowerCase()
                          ? "bg-[#C32929] text-white"
                          : "bg-white/10 text-gray-200 hover:bg-white/20"
                      }`}
                    >
                      {sub} ({subCount})
                    </button>
                  );
                })}
              </div>
            )}
        </div>

        {/* Search + Filter + Sort Bar */}
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6 bg-gray-50 border border-gray-200 rounded-xl p-3">
          <div className="flex items-center gap-2 flex-1 min-w-[200px]">
            <button
              type="button"
              onClick={() => setMobileFilterOpen(true)}
              className="lg:hidden inline-flex items-center gap-1.5 px-3.5 min-h-[42px] rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider cursor-pointer shrink-0"
            >
              <SlidersHorizontal size={15} />
              <span>Filter</span>
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
                placeholder={`Search in ${currentDept.name}...`}
                className="w-full h-[42px] pl-9 pr-3 bg-white border border-gray-300 rounded-lg text-xs text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
          </div>

          <div className="flex items-center gap-2.5 w-full sm:w-auto justify-between sm:justify-end">
            <span className="text-xs font-semibold text-gray-600">
              Showing{" "}
              <strong className="text-gray-900">
                {filteredProducts.length}
              </strong>{" "}
              items
            </span>
            <select
              aria-label="Sort category products"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="h-[42px] px-3 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-800 outline-none focus:border-gray-900 cursor-pointer"
            >
              <option value="featured">Sort: Featured</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
              <option value="discount">Biggest Discount (%)</option>
              <option value="rating">Highest Rated</option>
            </select>
          </div>
        </div>

        {/* Content Layout: Desktop Filter Sidebar + Product Grid */}
        <div className="flex flex-col lg:flex-row gap-6 items-start">
          {/* Desktop Sidebar */}
          <aside className="hidden lg:block w-64 shrink-0 bg-white border border-gray-200 rounded-xl p-5 sticky top-24 space-y-5">
            <div className="flex items-center justify-between pb-3 border-b border-gray-100">
              <h2 className="text-xs font-extrabold uppercase tracking-wider text-gray-900">
                Filter Collection
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

            {Array.isArray(currentDept.subcategories) &&
              currentDept.subcategories.length > 0 && (
                <div>
                  <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Subcategory
                  </h3>
                  <div className="space-y-1">
                    <button
                      type="button"
                      onClick={() => handleSubcategoryChange("all")}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                        selectedSub === "all"
                          ? "bg-gray-900 text-white"
                          : "text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      All Subcategories ({departmentProducts.length})
                    </button>
                    {currentDept.subcategories.map((sub) => {
                      const count = departmentProducts.filter((p) =>
                        matchesDepartmentFilter(p, currentDept.slug, sub)
                      ).length;
                      return (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleSubcategoryChange(sub)}
                          className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-xs font-semibold cursor-pointer ${
                            selectedSub.toLowerCase() === sub.toLowerCase()
                              ? "bg-gray-900 text-white"
                              : "text-gray-700 hover:bg-gray-100"
                          }`}
                        >
                          <span>{sub}</span>
                          <span className="text-[11px] opacity-75">
                            {count}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

            {availableBrands.length > 0 && (
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                  Brand
                </h3>
                <select
                  aria-label="Filter by brand"
                  value={selectedBrand}
                  onChange={(e) => setSelectedBrand(e.target.value)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-300 text-xs font-semibold text-gray-800 outline-none"
                >
                  <option value="all">All Brands ({availableBrands.length})</option>
                  {availableBrands.map((b) => (
                    <option key={b} value={b}>
                      {b}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div>
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Max Price
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
            </div>

            <div className="space-y-2 pt-2 border-t border-gray-100">
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={onlyDiscounted}
                  onChange={(e) => setOnlyDiscounted(e.target.checked)}
                  className="w-4 h-4 accent-gray-900 rounded"
                />
                <span>On Sale / Discounted Only</span>
              </label>
              <label className="flex items-center gap-2.5 cursor-pointer text-xs font-semibold text-gray-800">
                <input
                  type="checkbox"
                  checked={inStockOnly}
                  onChange={(e) => setInStockOnly(e.target.checked)}
                  className="w-4 h-4 accent-gray-900 rounded"
                />
                <span>In-Stock Only</span>
              </label>
            </div>
          </aside>

          {/* Product Grid */}
          <div className="flex-1 w-full">
            {filteredProducts.length > 0 ? (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-5">
                  {filteredProducts.slice(0, visibleCount).map((product, idx) => (
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
                {filteredProducts.length > visibleCount && (
                  <div className="mt-8 text-center">
                    <button
                      type="button"
                      onClick={() => setVisibleCount((prev) => prev + 24)}
                      className="inline-flex items-center justify-center px-6 min-h-[44px] rounded-xl bg-gray-900 hover:bg-[#C32929] text-white text-xs font-bold uppercase tracking-wider transition-colors cursor-pointer"
                    >
                      Load More Products ({filteredProducts.length - visibleCount} remaining)
                    </button>
                  </div>
                )}
              </>
            ) : (
              <div className="bg-white border border-gray-200 rounded-2xl p-10 text-center">
                <p className="text-base font-bold text-gray-900">
                  No products match the selected filters
                </p>
                <p className="text-xs text-gray-500 mt-1">
                  Reset your subcategory or price filters to view all items in{" "}
                  {currentDept.name}.
                </p>
                <button
                  type="button"
                  onClick={handleResetFilters}
                  className="mt-4 inline-flex items-center gap-1.5 px-5 py-2.5 rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
                >
                  <RotateCcw size={14} />
                  Reset Filters
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
          aria-label="Filter category products"
        >
          <div
            onClick={() => setMobileFilterOpen(false)}
            className="fixed inset-0 bg-black/50 backdrop-blur-[1px]"
          />
          <aside className="fixed top-0 left-0 bottom-0 z-50 w-[86vw] max-w-[320px] h-[100dvh] bg-white shadow-2xl flex flex-col">
            <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-200">
              <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
                Filter {currentDept.name}
              </h3>
              <button
                type="button"
                onClick={() => setMobileFilterOpen(false)}
                className="min-w-[44px] min-h-[44px] -mr-2 flex items-center justify-center rounded-lg text-gray-700"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-5">
              {Array.isArray(currentDept.subcategories) &&
                currentDept.subcategories.length > 0 && (
                  <div>
                    <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                      Subcategory
                    </h4>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSubcategoryChange("all")}
                        className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                          selectedSub === "all"
                            ? "bg-gray-900 text-white"
                            : "bg-gray-100 text-gray-700"
                        }`}
                      >
                        All
                      </button>
                      {currentDept.subcategories.map((sub) => (
                        <button
                          key={sub}
                          type="button"
                          onClick={() => handleSubcategoryChange(sub)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-bold ${
                            selectedSub.toLowerCase() === sub.toLowerCase()
                              ? "bg-[#C32929] text-white"
                              : "bg-gray-100 text-gray-700"
                          }`}
                        >
                          {sub}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

              {availableBrands.length > 0 && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-gray-700 mb-2">
                    Brand
                  </h4>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full h-10 px-3 rounded-lg border border-gray-300 text-xs font-semibold text-gray-800"
                  >
                    <option value="all">All Brands</option>
                    {availableBrands.map((b) => (
                      <option key={b} value={b}>
                        {b}
                      </option>
                    ))}
                  </select>
                </div>
              )}

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

              <div className="space-y-2.5">
                <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-800 p-2.5 rounded-lg bg-gray-50">
                  <input
                    type="checkbox"
                    checked={onlyDiscounted}
                    onChange={(e) => setOnlyDiscounted(e.target.checked)}
                    className="w-4 h-4 accent-gray-900 rounded"
                  />
                  <span>On Sale Only</span>
                </label>
                <label className="flex items-center gap-2.5 text-xs font-semibold text-gray-800 p-2.5 rounded-lg bg-gray-50">
                  <input
                    type="checkbox"
                    checked={inStockOnly}
                    onChange={(e) => setInStockOnly(e.target.checked)}
                    className="w-4 h-4 accent-gray-900 rounded"
                  />
                  <span>In-Stock Only</span>
                </label>
              </div>
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
                Show ({filteredProducts.length})
              </button>
            </div>
          </aside>
        </div>
      )}
    </section>
  );
};

export default CategoryPage;
