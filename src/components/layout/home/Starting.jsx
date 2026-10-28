import React, { useEffect, useState } from "react";
import Image from "../common/Image";
import { Link } from "react-router";
import { useDispatch, useSelector } from "react-redux";
import { Click } from "../../../slices/clickCategorySlice";
import { setShopOptions } from "../../../slices/productSlice";
import { getStoredBanners } from "../../../services/api";

const Starting = () => {
  const dispatch = useDispatch();
  const Alldata = useSelector((state) => state.AllProduct.Products) || [];
  const [cards, setCards] = useState(
    () => getStoredBanners().promoCards || []
  );

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail?.promoCards) {
        setCards(e.detail.promoCards);
      } else {
        setCards(getStoredBanners().promoCards || []);
      }
    };
    window.addEventListener("ummo:banners-updated", handleUpdate);
    return () =>
      window.removeEventListener("ummo:banners-updated", handleUpdate);
  }, []);

  const leftCard = cards[0] || {
    subtitle: "STARTING AT $39",
    title: "Women’s Dresses",
    ctaText: "SHOP NOW",
    categoryFilter: "womens-dresses",
    bgColor: "#D6001C",
    image: "../images/startingImage1.png",
  };

  const rightCard = cards[1] || {
    subtitle: "STARTING AT $39",
    title: "Men’s Sportswear",
    ctaText: "SHOP NOW",
    categoryFilter: "mens-shoes",
    bgColor: "#f5f5f5",
    image: "./images/startingImage2.png",
  };

  function handlePromoClick(categoryName) {
    const matched = Alldata.filter((item) => item.category === categoryName);
    dispatch(Click(matched));
    dispatch(setShopOptions({ category: categoryName }));
  }

  return (
    <section className="md:mt-20 mt-6 px-3 sm:px-4 xl:px-0">
      <div className="container mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 lg:gap-6">
          <div
            style={{ backgroundColor: leftCard.bgColor || "#D6001C" }}
            className="w-full min-h-[210px] sm:h-77.5 md:h-90 lg:h-99.5 flex justify-between lg:pl-10 pl-4 pr-3 items-end overflow-hidden rounded-sm"
          >
            <div className="mb-8 sm:mb-12.75 z-10">
              <h3 className="lg:text-base font-medium text-xs sm:text-sm text-white uppercase">
                {leftCard.subtitle}
              </h3>
              <h2 className="lg:text-[26px] text-lg sm:text-[22px] font-semibold text-white mb-2 mt-1">
                {leftCard.title}
              </h2>
              <Link
                onClick={() => handlePromoClick(leftCard.categoryFilter)}
                to={`/shop?category=${encodeURIComponent(
                  leftCard.categoryFilter || "womens-dresses"
                )}`}
                className='uppercase text-white text-xs lg:text-sm leading-6 after:content-[""] after:w-0 after:duration-300 hover:after:w-12.5 after:h-0.5 after:bg-white after:absolute after:bottom-0 relative after:left-0 font-medium'
              >
                {leftCard.ctaText || "SHOP NOW"}
              </Link>
            </div>

            <div className="h-full flex items-end justify-end">
              <Image
                className="xl:h-full w-auto max-h-44 sm:max-h-64 md:max-h-72 lg:max-h-88 object-contain"
                src={leftCard.image || "../images/startingImage1.png"}
                alt={leftCard.title}
              />
            </div>
          </div>

          <div
            style={{ backgroundColor: rightCard.bgColor || "#f5f5f5" }}
            className="w-full min-h-[210px] sm:h-77.5 md:h-90 lg:h-99.5 relative overflow-hidden rounded-sm"
          >
            <Image
              className="w-full h-full object-cover"
              src={rightCard.image || "./images/startingImage2.png"}
              alt={rightCard.title}
            />
            <div className="absolute bottom-8 sm:bottom-12.75 lg:left-10 left-4 z-10">
              <h3 className="lg:text-base text-xs sm:text-sm font-medium text-black uppercase">
                {rightCard.subtitle}
              </h3>
              <h2 className="text-lg sm:text-[22px] lg:text-[26px] font-semibold text-black mb-2 mt-1">
                {rightCard.title}
              </h2>
              <Link
                onClick={() => handlePromoClick(rightCard.categoryFilter)}
                to={`/shop?category=${encodeURIComponent(
                  rightCard.categoryFilter || "mens-shoes"
                )}`}
                className='uppercase text-black text-xs lg:text-sm leading-6 after:content-[""] after:w-0 after:duration-300 hover:after:w-12.5 after:h-0.5 after:bg-black after:absolute after:bottom-0 relative after:left-0 font-medium'
              >
                {rightCard.ctaText || "SHOP NOW"}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
};

export default Starting;
