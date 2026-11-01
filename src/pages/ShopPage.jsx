import React, { useEffect, useState } from "react";
import ShopBanner from "../components/shop/ShopBanner";
import ShopFilter from "../components/shop/ShopFilter";
import ShopAllProducts from "../components/shop/ShopAllProducts";
import ShopResponsive from "../components/shop/ShopResponsive";
import { usePageSeo } from "../utils/seo";

const ShopPage = () => {
  const [currentPage, setCurrentPage] = useState(1);
  const [isDesktop, setIsDesktop] = useState(() => {
    if (typeof window === "undefined" || !window.matchMedia) return true;
    return window.matchMedia("(min-width: 1024px)").matches;
  });

  usePageSeo({
    title: "Shop All Collections & Departments",
    description:
      "Browse all 194+ authentic UOMO products across Fashion, Footwear, Fragrances, Beauty, Electronics, Home & Living, and Daily Essentials.",
    canonicalPath: "/shop",
  });

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return undefined;
    const mq = window.matchMedia("(min-width: 1024px)");
    const handler = (e) => setIsDesktop(e.matches);
    if (mq.addEventListener) {
      mq.addEventListener("change", handler);
      return () => mq.removeEventListener("change", handler);
    }
    mq.addListener(handler);
    return () => mq.removeListener(handler);
  }, []);

  return (
    <div className="mb-25.25 overflow-x-hidden px-2">
      <ShopBanner />
      {isDesktop ? (
        <div className="container flex justify-between gap-2 mt-9 xl:gap-15">
          <ShopFilter
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
          <ShopAllProducts
            currentPage={currentPage}
            setCurrentPage={setCurrentPage}
          />
        </div>
      ) : (
        <div>
          <ShopResponsive />
        </div>
      )}
    </div>
  );
};

export default ShopPage;
