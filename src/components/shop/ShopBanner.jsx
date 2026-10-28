import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Image from "../layout/common/Image";
import shopBg from "../../assets/images/shopBanner.png";
import { setShopOptions } from "../../slices/productSlice";
import { getStoredBanners } from "../../services/api";

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
  const activeCategory = useSelector(
    (state) => state.Products.options.category
  );
  const [shopHeader, setShopHeader] = useState(
    () => getStoredBanners().shopHeader || {}
  );

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

  return (
    <div className="2xl:px-5 relative overflow-hidden rounded-sm">
      <Image
        className="w-full min-h-[190px] sm:min-h-[240px] lg:min-h-[280px] max-h-[360px] object-cover"
        src={shopHeader.image || shopBg}
        alt={shopHeader.title || "Shop Banner"}
      />

      <div className="absolute inset-0 bg-white/60 lg:bg-white/35 flex flex-col items-center justify-center text-center px-3 sm:px-6">
        <h2 className="font-bold text-2xl sm:text-4xl lg:text-[48px] text-black uppercase tracking-tight leading-tight">
          {activeTab.label === "ALL"
            ? shopHeader.title || "ALL COLLECTIONS"
            : activeTab.label}
        </h2>
        {shopHeader.subtitle && (
          <p className="text-xs sm:text-sm text-gray-700 max-w-xl mt-1 hidden xs:block">
            {shopHeader.subtitle}
          </p>
        )}
        <ul className="flex justify-center flex-wrap gap-1.5 sm:gap-x-3 sm:gap-y-2 mt-3 max-w-4xl">
          {SHOP_BANNER_TABS.map((item) => {
            const isSelected = activeCategory === item.category;
            return (
              <li
                key={item.id}
                onClick={() => handleSelectCategory(item)}
                className={`font-bold text-[10px] sm:text-xs lg:text-sm whitespace-nowrap cursor-pointer px-2 sm:px-2.5 py-1 rounded transition-colors ${
                  isSelected
                    ? "bg-black text-white"
                    : "text-black bg-white/70 sm:bg-transparent hover:bg-black/10"
                }`}
              >
                {item.label}
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
};

export default ShopBanner;
