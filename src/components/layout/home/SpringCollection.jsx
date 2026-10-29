import React, { useEffect, useState } from "react";
import Image from "../common/Image";
import { Link } from "react-router";
import Countdown from "react-countdown";
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

  const renderer = ({ days, hours, minutes, seconds }) => {
    return (
      <div className="flex gap-1.5 xs:gap-2 sm:gap-4 md:gap-6.25 xl:mt-16 mt-5">
        <div>
          <h2 className="md:text-[30px] text-sm xs:text-base sm:text-[20px] font-semibold sm:font-normal text-primary">
            {days}
          </h2>
          <h3 className="md:text-[14px] text-[10px] sm:text-xs font-bold text-gray-700 uppercase">
            DAYS
          </h3>
        </div>

        <h2 className="md:text-[30px] text-sm xs:text-base sm:text-[20px] leading-6 sm:leading-7.5 font-normal text-primary">
          :
        </h2>
        <div>
          <h2 className="md:text-[30px] text-sm xs:text-base sm:text-[20px] font-semibold sm:font-normal text-primary">
            {hours}
          </h2>
          <h3 className="md:text-[14px] text-[10px] sm:text-xs font-bold text-gray-700 uppercase">
            HOURS
          </h3>
        </div>

        <h2 className="md:text-[30px] text-sm xs:text-base sm:text-[20px] leading-6 sm:leading-7.5 font-normal text-primary">
          :
        </h2>
        <div>
          <h2 className="md:text-[30px] text-sm xs:text-base sm:text-[20px] font-semibold sm:font-normal text-primary">
            {minutes}
          </h2>
          <h3 className="md:text-[14px] text-[10px] sm:text-xs font-bold text-gray-700 uppercase">
            MINS
          </h3>
        </div>

        <h2 className="md:text-[30px] text-sm xs:text-base sm:text-[20px] leading-6 sm:leading-7.5 font-normal text-primary">
          :
        </h2>
        <div>
          <h2 className="md:text-[30px] text-sm xs:text-base sm:text-[20px] font-semibold sm:font-normal text-primary">
            {seconds}
          </h2>
          <h3 className="md:text-[14px] text-[10px] sm:text-xs font-bold text-gray-700 uppercase">
            SEC
          </h3>
        </div>
      </div>
    );
  };

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
              {deal.tag || "DEAL OF THE WEEK"}
            </h3>
            <h2 className="uppercase text-lg sm:text-2xl md:text-5xl xl:text-[70px] font-normal text-primary">
              <span className="font-bold">{deal.titleBold || "Spring"}</span>{" "}
              {deal.titleRegular || "Collection"}
            </h2>
            <Link
              to={deal.ctaLink || "/shop"}
              className='uppercase text-primary text-xs sm:text-sm leading-6 after:content-[""] after:w-0 after:duration-300 hover:after:w-12.5 after:h-0.5 after:bg-primary after:absolute after:bottom-0 relative after:left-0'
            >
              {deal.ctaText || "SHOP NOW"}
            </Link>

            <Countdown
              date={deal.countdownDate || "2026-12-31T23:59:59.000Z"}
              renderer={renderer}
            />
          </div>
          <div>
            <Image
              className="w-36 xs:w-48 sm:w-80 object-cover"
              src={deal.image || SpringImage}
              alt="Deal of the week banner"
            />
          </div>
        </div>
      </div>
    </section>
  );
};

export default SpringCollection;
