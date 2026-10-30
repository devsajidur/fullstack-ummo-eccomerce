import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import { ArrowRight, Flame } from "lucide-react";
import Container from "../common/Container";
import Product from "../common/Product";
import {
  getInitialCatalogSnapshot,
  initStoreConfigSync,
} from "../../../services/api";
import { getProductDiscountState } from "../../../utils/discountTimer";
import { matchesDepartmentFilter } from "../../../utils/categoryTaxonomy";
import { useLocalization } from "../../../i18n/LocalizationContext";

const BestDealsSection = () => {
  const { t } = useLocalization();
  const [products, setProducts] = useState(() => getInitialCatalogSnapshot());
  const [activeDept, setActiveDept] = useState("all");

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

  const topDeals = useMemo(() => {
    return products
      .filter((p) => p && p.isVisible !== false && p.status !== "draft")
      .map((p) => ({
        product: p,
        ds: getProductDiscountState(p),
      }))
      .filter(({ product, ds }) => {
        if (!ds.isDiscountActive) return false;
        if (activeDept !== "all") {
          return matchesDepartmentFilter(product, activeDept);
        }
        return true;
      })
      .sort(
        (a, b) =>
          b.ds.discountPercentage - a.ds.discountPercentage ||
          b.ds.savingsAmount - a.ds.savingsAmount
      )
      .slice(0, 8);
  }, [products, activeDept]);

  if (topDeals.length === 0 && activeDept === "all") {
    return null;
  }

  const filterTabs = [
    { slug: "all", label: t("discounts.allDepartments", "All Deals") },
    { slug: "women", label: t("dept.women", "Women") },
    { slug: "men", label: t("dept.men", "Men") },
    { slug: "kids", label: t("dept.kids", "Kids") },
    { slug: "beauty", label: t("dept.beauty", "Beauty") },
  ];

  return (
    <section
      className="py-10 sm:py-14 px-3 sm:px-4 bg-gradient-to-b from-[#fffafa] to-white border-y border-red-100/60 mt-8"
      data-testid="best-deals-section"
    >
      <Container>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-6">
          <div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-50 border border-red-200 text-[#C32929] text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <Flame size={13} />
              Limited-Time Savings
            </span>
            <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-gray-900 uppercase tracking-tight">
              {t("discounts.bestDealsTitle", "Best Deals for You")}
            </h2>
            <p className="text-xs sm:text-sm text-gray-600 mt-1">
              {t(
                "discounts.bestDealsSubtitle",
                "Handpicked limited-time savings — real prices, verified stock"
              )}
            </p>
          </div>

          <Link
            to="/discounts"
            className="inline-flex items-center justify-center gap-2 px-4 min-h-[42px] rounded-lg bg-gray-900 hover:bg-[#C32929] text-white text-xs font-bold uppercase tracking-wider transition-colors self-start md:self-auto"
          >
            <span>{t("discounts.viewAll", "View All Discounts")}</span>
            <ArrowRight size={15} />
          </Link>
        </div>

        {/* Department Filter Pills */}
        <div className="flex items-center gap-2 overflow-x-auto pb-3 mb-5 no-scrollbar">
          {filterTabs.map((tab) => (
            <button
              key={tab.slug}
              type="button"
              onClick={() => setActiveDept(tab.slug)}
              className={`px-4 py-2 rounded-full text-xs font-bold whitespace-nowrap transition-colors cursor-pointer ${
                activeDept === tab.slug
                  ? "bg-[#C32929] text-white shadow-sm"
                  : "bg-white border border-gray-200 text-gray-700 hover:bg-gray-100"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Deals Product Grid (Clean cards, no countdown timers per Gate 6) */}
        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-4 gap-3 sm:gap-5">
          {topDeals.map(({ product }) => (
            <Product
              key={product.id}
              item={product}
              id={product.id}
              productImage={product.thumbnail}
              productCatagory={product.category}
              productTitle={product.title}
              productPrice={product.price}
              discountBadge={product.discountPercentage}
            />
          ))}
        </div>
      </Container>
    </section>
  );
};

export default BestDealsSection;
