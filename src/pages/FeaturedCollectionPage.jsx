import React, { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { ArrowLeft, Search, Sparkles } from "lucide-react";
import Container from "../components/layout/common/Container";
import Image from "../components/layout/common/Image";
import Product from "../components/layout/common/Product";
import {
  fetchCatalogProducts,
  getStoredFeaturedCollection,
} from "../services/api";
import { getCloudinaryBannerUrl } from "../services/cloudinary";
import { Allitem } from "../slices/AllProductSlice";
import { addProduct } from "../slices/productSlice";
import {
  getProductDiscountState,
  pad2,
  useNowTick,
} from "../utils/discountTimer";
import { usePageSeo } from "../utils/seo";

const DEFAULT_SPRING_IMAGE = getCloudinaryBannerUrl("springImage", 700);

function getRemainingCountdown(isoDate, nowMs) {
  if (!isoDate) return null;
  const endMs = Date.parse(isoDate);
  if (!Number.isFinite(endMs) || endMs <= nowMs) return null;
  const totalSec = Math.floor((endMs - nowMs) / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

export default function FeaturedCollectionPage() {
  const dispatch = useDispatch();
  const catalogProducts = useSelector((state) => state.AllProduct.Products);

  const [featured, setFeatured] = useState(() => getStoredFeaturedCollection());
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("curated");

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  useEffect(() => {
    if (!catalogProducts?.length) {
      fetchCatalogProducts(200).then((list) => {
        dispatch(Allitem(list));
        dispatch(addProduct(list));
      });
    }
  }, [catalogProducts, dispatch]);

  useEffect(() => {
    const syncFeatured = () => {
      setFeatured(getStoredFeaturedCollection());
    };
    window.addEventListener("ummo:featured-collection-updated", syncFeatured);
    window.addEventListener("ummo:banners-updated", syncFeatured);
    return () => {
      window.removeEventListener(
        "ummo:featured-collection-updated",
        syncFeatured
      );
      window.removeEventListener("ummo:banners-updated", syncFeatured);
    };
  }, []);

  const hasTimerConfig =
    featured?.timerEnabled !== false && Boolean(featured?.countdownDate);
  const nowMs = useNowTick(hasTimerConfig);
  const countdown = hasTimerConfig
    ? getRemainingCountdown(featured.countdownDate, nowMs)
    : null;

  const fullTitle = `${featured?.titleBold || "Spring"} ${
    featured?.titleRegular || "Collection"
  }`.trim();

  usePageSeo({
    title: `${fullTitle} — Featured Products | UOMO`,
    description:
      featured?.description ||
      "Shop curated featured products with verified seasonal discounts at UOMO.",
    canonicalPath: "/featured",
    image: featured?.image || DEFAULT_SPRING_IMAGE,
  });

  const curatedProducts = useMemo(() => {
    const visibleCatalog = (catalogProducts || []).filter(
      (p) => p.isVisible !== false
    );
    const idList = Array.isArray(featured?.productIds)
      ? featured.productIds.map(String)
      : [];

    let baseList = [];
    if (idList.length > 0) {
      const byId = new Map(visibleCatalog.map((p) => [String(p.id), p]));
      baseList = idList.map((id) => byId.get(id)).filter(Boolean);
    }

    if (baseList.length === 0) {
      baseList = visibleCatalog
        .filter((p) => p.isFeatured || Number(p.discountPercentage || 0) >= 15)
        .slice(0, 12);
    }

    const q = searchQuery.trim().toLowerCase();
    const filtered = q
      ? baseList.filter(
          (p) =>
            String(p.title || "").toLowerCase().includes(q) ||
            String(p.brand || "").toLowerCase().includes(q) ||
            String(p.department || "").toLowerCase().includes(q)
        )
      : baseList;

    if (sortBy === "price-asc") {
      return [...filtered].sort(
        (a, b) =>
          getProductDiscountState(a).effectivePrice -
          getProductDiscountState(b).effectivePrice
      );
    }
    if (sortBy === "price-desc") {
      return [...filtered].sort(
        (a, b) =>
          getProductDiscountState(b).effectivePrice -
          getProductDiscountState(a).effectivePrice
      );
    }
    if (sortBy === "biggest-discount") {
      return [...filtered].sort(
        (a, b) =>
          getProductDiscountState(b).discountPercent -
          getProductDiscountState(a).discountPercent
      );
    }
    return filtered;
  }, [catalogProducts, featured, searchQuery, sortBy]);

  const discountPct = Math.max(0, Number(featured?.discountPercentage || 0));

  return (
    <main className="py-6 sm:py-10 overflow-x-hidden">
      <Container>
        {/* Breadcrumb */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-gray-500 mb-5"
        >
          <Link to="/" className="hover:text-primary">
            Home
          </Link>
          <span>/</span>
          <span className="text-primary font-bold">{fullTitle}</span>
        </nav>

        {/* Featured Campaign Hero */}
        <section
          style={{ backgroundColor: featured?.bgColor || "#ebebeb" }}
          className="rounded-2xl p-5 sm:p-8 md:p-10 mb-8 border border-black/5 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
        >
          <div className="max-w-2xl">
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#c32929]">
                <Sparkles size={14} />
                {featured?.tag || "DEAL OF THE WEEK"}
              </span>
              {discountPct > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase bg-[#c32929] text-white">
                  Up to {discountPct}% Off Selected Products
                </span>
              )}
            </div>

            <h1 className="text-2xl sm:text-4xl md:text-5xl uppercase text-primary mt-2 leading-tight">
              <span className="font-bold">
                {featured?.titleBold || "Spring"}
              </span>{" "}
              {featured?.titleRegular || "Collection"}
            </h1>

            <p className="text-xs sm:text-sm text-gray-700 mt-2.5 max-w-xl leading-relaxed">
              {featured?.description ||
                "Explore curated seasonal essentials with verified markdowns across Women, Men, and Lifestyle collections."}
            </p>

            {countdown && (
              <div
                data-testid="featured-collection-countdown"
                className="flex flex-wrap items-center gap-2.5 mt-5"
              >
                {[
                  { label: "Days", val: pad2(countdown.days) },
                  { label: "Hours", val: pad2(countdown.hours) },
                  { label: "Mins", val: pad2(countdown.minutes) },
                  { label: "Secs", val: pad2(countdown.seconds) },
                ].map((unit) => (
                  <div
                    key={unit.label}
                    className="bg-white/95 border border-black/10 rounded-xl px-3.5 py-2 text-center min-w-[60px] shadow-2xs"
                  >
                    <div className="text-base sm:text-xl font-bold text-gray-900 tabular-nums">
                      {unit.val}
                    </div>
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {unit.label}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="self-center md:self-auto shrink-0">
            <Image
              src={featured?.image || DEFAULT_SPRING_IMAGE}
              alt={fullTitle}
              className="w-44 sm:w-60 md:w-64 object-cover rounded-xl"
              width={260}
              height={260}
            />
          </div>
        </section>

        {/* Filter & Sort Bar */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
          <div className="flex items-center gap-3">
            <Link
              to="/shop"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-primary"
            >
              <ArrowLeft size={14} /> All Products
            </Link>
            <span className="text-xs text-gray-400">•</span>
            <p className="text-xs sm:text-sm font-semibold text-gray-800">
              Showing {curatedProducts.length} Featured{" "}
              {curatedProducts.length === 1 ? "Product" : "Products"}
            </p>
          </div>

          <div className="flex flex-col xs:flex-row items-stretch xs:items-center gap-2.5">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Filter featured items..."
                className="w-full xs:w-52 border border-gray-300 rounded-xl pl-8 pr-3 py-2 text-xs bg-white focus:outline-none focus:border-primary"
              />
            </div>

            <select
              aria-label="Sort featured products"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="border border-gray-300 rounded-xl px-3 py-2 text-xs font-medium bg-white focus:outline-none focus:border-primary"
            >
              <option value="curated">Curated Order</option>
              <option value="biggest-discount">Biggest Discount</option>
              <option value="price-asc">Price: Low to High</option>
              <option value="price-desc">Price: High to Low</option>
            </select>
          </div>
        </div>

        {/* Curated Product Grid */}
        {curatedProducts.length === 0 ? (
          <div className="text-center py-16 bg-gray-50 rounded-2xl border border-gray-200">
            <p className="text-sm font-semibold text-gray-800">
              No featured products matched your filter.
            </p>
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="mt-3 text-xs font-bold uppercase tracking-wider underline text-primary cursor-pointer"
            >
              Clear Search
            </button>
          </div>
        ) : (
          <div
            data-testid="featured-products-grid"
            className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6"
          >
            {curatedProducts.map((item) => (
              <Product key={item.id} item={item} />
            ))}
          </div>
        )}
      </Container>
    </main>
  );
}
