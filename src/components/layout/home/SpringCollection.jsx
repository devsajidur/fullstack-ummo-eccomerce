import React, { useEffect, useState } from "react";
import Image from "../common/Image";
import { Link } from "react-router";
import { getStoredBanners } from "../../../services/api";
import { getCloudinaryBannerUrl } from "../../../services/cloudinary";

const SpringImage = getCloudinaryBannerUrl("springImage", 700);

const SpringCollection = () => {
  const [deal, setDeal] = useState(() => getStoredBanners().dealBanner || {});

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail?.dealBanner) {
        setDeal(e.detail.dealBanner);
      } else {
        setDeal(getStoredBanners().dealBanner || {});
      }
    };
    window.addEventListener("ummo:banners-updated", handleUpdate);
    return () =>
      window.removeEventListener("ummo:banners-updated", handleUpdate);
  }, []);

  return (
    <section
      style={{ backgroundColor: deal.bgColor || "#ebebeb" }}
      className="pt-3 md:pt-18.5 mt-10 md:mt-0 px-2 overflow-x-hidden"
    >
      <div className="container mx-auto">
        <div className="flex pl-3 sm:pl-7 md:pl-auto pt-3 md:pt-18.5 pb-6 md:p-11.5 justify-between items-center md:items-end gap-3">
          <div>
            <h3 className="md:text-sm text-xs font-semibold leading-6 text-[#c32929] flex items-center gap-2.5 uppercase">
              <div className="w-6 sm:w-10 h-0.5 bg-[#c32929]"></div>
              {deal.tag || "SEASONAL HIGHLIGHT"}
            </h3>
            <h2 className="uppercase text-lg sm:text-2xl md:text-5xl xl:text-[70px] font-normal text-primary">
              <span className="font-bold">{deal.titleBold || "Spring"}</span>{" "}
              {deal.titleRegular || "Collection"}
            </h2>
            <p className="text-xs sm:text-sm text-gray-700 mt-2 max-w-md">
              Explore curated seasonal essentials with verified markdowns across Women, Men, and Lifestyle collections.
            </p>
            <Link
              to={deal.ctaLink || "/shop"}
              className='inline-block mt-4 uppercase text-primary font-semibold text-xs sm:text-sm leading-6 after:content-[""] after:w-0 after:duration-300 hover:after:w-12.5 after:h-0.5 after:bg-primary after:absolute after:bottom-0 relative after:left-0'
            >
              {deal.ctaText || "SHOP NOW"}
            </Link>
          </div>
          <div>
            <Image
              className="w-36 xs:w-48 sm:w-80 object-cover"
              src={deal.image || SpringImage}
              alt="Seasonal collection banner"
              width={320}
              height={320}
              loading="lazy"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpringCollection;
