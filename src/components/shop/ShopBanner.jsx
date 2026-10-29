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
    <div className="2xl:px-5 relative overflow-hidden">
      <Image
        className="w-full h-[180px] sm:h-[240px] lg:h-[280px] object-cover"
        src={shopHeader.image || shopBg}
        alt={shopHeader.title || "Shop Banner"}
        width={1200}
        height={280}
        loading="eager"
      />

      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-3 sm:px-6">
        <h2 className="font-bold text-2xl sm:text-4xl lg:text-[56px] text-black uppercase tracking-tight leading-tight">
          {activeTab.label === "ALL"
            ? shopHeader.title || "ALL COLLECTIONS"
            : activeTab.label}
        </h2>
        <ul className="flex justify-center flex-wrap gap-x-3 sm:gap-x-5 gap-y-1.5 mt-3 max-w-4xl">
          {SHOP_BANNER_TABS.map((item) => {
            const isSelected = activeCategory === item.category;
            return (
              <li
                key={item.id}
                onClick={() => handleSelectCategory(item)}
                className={`font-medium text-[11px] sm:text-xs lg:text-base whitespace-nowrap cursor-pointer relative pb-0.5 transition-colors after:content-[''] after:absolute after:bottom-0 after:left-0 after:h-0.5 after:bg-black after:transition-all after:duration-300 ${
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
  );
};

export default ShopBanner;
