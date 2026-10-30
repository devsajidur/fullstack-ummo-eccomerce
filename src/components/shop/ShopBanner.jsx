import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link } from "react-router";
import { Flame } from "lucide-react";
import Image from "../layout/common/Image";
import { setShopOptions } from "../../slices/productSlice";
import { getStoredBanners } from "../../services/api";
import { getAllDepartments } from "../../utils/categoryTaxonomy";
import { useLocalization } from "../../i18n/LocalizationContext";

const SHOP_BANNER_TABS = [
  { id: "all", label: "ALL", category: "" },
  { id: "dresses", label: "WOMEN'S DRESSES", category: "womens-dresses" },
  { id: "bags", label: "HANDBAGS", category: "womens-bags" },
  { id: "mens-shirts", label: "MEN'S SHIRTS", category: "mens-shirts" },
  { id: "mens-shoes", label: "FOOTWEAR", category: "mens-shoes" },
  { id: "watches", label: "WATCHES", category: "mens-watches" },
  { id: "fragrances", label: "FRAGRANCES", category: "fragrances" },
  { id: "sunglasses", label: "ACCESSORIES", category: "sunglasses" },
];

const ShopBanner = () => {
  const dispatch = useDispatch();
  const { lang } = useLocalization();
  const activeCategory = useSelector(
    (state) => state.Products.options.category
  );
  const [shopHeader, setShopHeader] = useState(
    () => getStoredBanners().shopHeader || {}
  );
  const departments = getAllDepartments(false);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail?.shopHeader) {
        setShopHeader(e.detail.shopHeader);
      } else {
        setShopHeader(getStoredBanners().shopHeader || {});
      }
    };
    window.addEventListener("ummo:banners-updated", handleUpdate);
    return () =>
      window.removeEventListener("ummo:banners-updated", handleUpdate);
  }, []);

  const activeTab =
    SHOP_BANNER_TABS.find((t) => t.category === activeCategory) ||
    SHOP_BANNER_TABS[0];

  function handleSelectCategory(tab) {
    dispatch(setShopOptions({ category: tab.category }));
  }

  const isMobileViewport =
    typeof window !== "undefined" && window.innerWidth < 768;
  const bannerWidth = isMobileViewport ? 480 : 960;

  return (
    <div>
      <div className="2xl:px-5 relative overflow-hidden">
        <Image
          className="w-full h-[180px] sm:h-[240px] lg:h-[280px] object-cover"
          src={shopHeader.image || "/images/shop-banner.webp"}
          alt={shopHeader.title || "Shop Banner"}
          width={bannerWidth}
          height={280}
          loading="eager"
          fetchPriority="high"
        />

        <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 sm:px-6">
          <h1 className="font-bold text-2xl sm:text-4xl lg:text-[52px] text-black uppercase tracking-tight leading-tight">
            {activeTab.label === "ALL"
              ? shopHeader.title || "ALL COLLECTIONS"
              : activeTab.label}
          </h1>
          <ul className="flex justify-center flex-wrap gap-x-3 sm:gap-x-5 gap-y-1.5 mt-3 max-w-4xl">
            {SHOP_BANNER_TABS.map((item) => {
              const isSelected = activeCategory === item.category;
              return (
                <li
                  key={item.id}
                  onClick={() => handleSelectCategory(item)}
                  className={`font-medium text-[11px] sm:text-xs lg:text-sm whitespace-nowrap cursor-pointer relative pb-0.5 transition-colors after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-black after:transition-all after:duration-300 ${
                    isSelected
                      ? "text-black font-bold after:w-full"
                      : "text-black/80 hover:text-black after:w-0 hover:after:w-2/3"
                  }`}
                >
                  {item.label}
                </li>
              );
            })}
          </ul>
        </div>
      </div>

      {/* Canonical Department Quick Navigation Bar */}
      <div className="container mt-4 px-2">
        <div className="flex items-center gap-2 overflow-x-auto pb-2 no-scrollbar">
          <Link
            to="/discounts"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-[#C32929] text-white text-xs font-bold whitespace-nowrap shadow-sm hover:bg-red-700 transition-colors"
          >
            <Flame size={13} />
            <span>{lang === "bn" ? "আজকের ডিসকাউন্ট" : "Today's Deals"}</span>
          </Link>
          {departments.map((dept) => (
            <Link
              key={dept.slug}
              to={`/category/${dept.slug}`}
              className="px-3.5 py-2 rounded-full bg-gray-100 hover:bg-gray-900 hover:text-white text-gray-800 text-xs font-bold whitespace-nowrap transition-colors"
            >
              {lang === "bn" ? dept.nameBn : dept.name}
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
};

export default ShopBanner;
