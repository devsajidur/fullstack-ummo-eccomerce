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
    return () => window.removeEventListener("ummo:banners-updated", handleUpdate);
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
    <section className="md:mt-25 mt-3.75">
      <div className="container">
        <div className="flex justify-between gap-y-3.75 flex-col md:flex-row md:gap-2">
          <div
            style={{ backgroundColor: leftCard.bgColor || "#D6001C" }}
            className="md:w-172.5 h-50 sm:h-77.5 md:h-99.5 flex justify-between lg:pl-12.5 pl-3 md:pr-2.5 items-end"
          >
            <div className="mb-12.75">
              <h3 className="lg:text-[18px] whitespace-nowrap font-medium text-[12px] sm:text-base text-white uppercase">
                {leftCard.subtitle}
              </h3>
              <h2 className="lg:text-[26px] whitespace-nowrap text-[18px] sm:text-[22px] font-medium shrink-0 text-white lg:mb-3.75 lg:mt-2">
                {leftCard.title}
              </h2>
              <Link
                onClick={() => handlePromoClick(leftCard.categoryFilter)}
                to={`/shop?category=${encodeURIComponent(
                  leftCard.categoryFilter || "womens-dresses"
                )}`}
                className='uppercase text-white text-[10px] lg:text-sm leading-6 after:content-[""] after:w-0 after:duration-300 hover:after:w-12.5 after:h-0.5 after:bg-white after:absolute after:bottom-0 relative after:left-0 font-medium'
              >
                {leftCard.ctaText || "SHOP NOW"}
              </Link>
            </div>

            <div className="h-full flex items-center">
              <Image
                className="xl:h-full w-full h-30 sm:h-60 md:h-50 lg:h-70 object-cover"
                src={leftCard.image || "../images/startingImage1.png"}
                alt={leftCard.title}
              />
            </div>
          </div>

          <div className="md:w-172.5 h-77.5 md:h-99.5 relative">
            <Image
              className="w-full h-full object-cover"
              src={rightCard.image || "./images/startingImage2.png"}
              alt={rightCard.title}
            />
            <div className="absolute bottom-12.75 lg:left-12.5 left-3">
              <h3 className="lg:text-lg font-medium text-black uppercase">
                {rightCard.subtitle}
              </h3>
              <h2 className="text-[22px] lg:text-[26px] font-medium text-black lg:mb-3.75 lg:mt-2">
                {rightCard.title}
              </h2>
              <Link
                onClick={() => handlePromoClick(rightCard.categoryFilter)}
                to={`/shop?category=${encodeURIComponent(
                  rightCard.categoryFilter || "mens-shoes"
                )}`}
                className='uppercase text-black text-[12px] lg:text-sm leading-6 after:content-[""] after:w-0 after:duration-300 hover:after:w-12.5 after:h-0.5 after:bg-black after:absolute after:bottom-0 relative after:left-0 font-medium'
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
