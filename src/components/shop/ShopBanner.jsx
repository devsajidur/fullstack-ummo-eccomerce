import React from "react";
import { useDispatch, useSelector } from "react-redux";
import Image from "../layout/common/Image";
import shopBg from "../../assets/images/shopBanner.png";
import { setShopOptions } from "../../slices/productSlice";

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

  const activeTab =
    SHOP_BANNER_TABS.find((t) => t.category === activeCategory) ||
    SHOP_BANNER_TABS[0];

  function handleSelectCategory(tab) {
    dispatch(setShopOptions({ category: tab.category }));
  }

  return (
    <div className="2xl:px-5 relative">
      <Image className="w-full hidden lg:block" src={shopBg} alt="shopbg" />

      <div className="lg:absolute relative lg:top-2/4 lg:left-2/4 lg:-translate-2/4 text-center my-5 lg:mt-0 px-4">
        <h2 className="font-bold text-[28px] lg:text-[52px] text-black uppercase tracking-tight">
          {activeTab.label === "ALL" ? "ALL COLLECTIONS" : activeTab.label}
        </h2>
        <ul className="flex justify-center flex-wrap gap-x-3 gap-y-2 mt-2">
          {SHOP_BANNER_TABS.map((item) => {
            const isSelected = activeCategory === item.category;
            return (
              <li
                key={item.id}
                onClick={() => handleSelectCategory(item)}
                className={`font-bold text-[12px] lg:text-sm whitespace-nowrap cursor-pointer px-2.5 py-1 rounded transition-colors ${
                  isSelected
                    ? "bg-black text-white"
                    : "text-black hover:bg-black/10"
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
