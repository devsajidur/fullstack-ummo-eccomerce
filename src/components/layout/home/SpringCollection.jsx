import React, { useEffect, useState } from "react";
import Image from "../common/Image";
import { Link } from "react-router";
import Countdown from "react-countdown";
import SpringImage from "../../../assets/images/springImage.jpg";
import { getStoredBanners } from "../../../services/api";

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
    return () => window.removeEventListener("ummo:banners-updated", handleUpdate);
  }, []);

  const renderer = ({ days, hours, minutes, seconds }) => {
    return (
      <div className="flex gap-1 sm:gap-3 md:gap-6.25 xl:mt-29.75 mt-[25.69px]">
        <div>
          <h2 className="md:text-[30px] text-sm sm:text-[18px] font-normal text-primary">
            {days}
          </h2>
          <h3 className="md:text-[16px] text-[12px] sm:text-sm font-bold text-gray uppercase">
            DAYS
          </h3>
        </div>

        <h2 className="md:text-[30px] text-sm sm:text-[18px] leading-7.5 font-normal text-primary">
          :
        </h2>
        <div>
          <h2 className="md:text-[30px] text-sm sm:text-[18px] font-normal text-primary">
            {hours}
          </h2>
          <h3 className="md:text-[16px] text-[12px] sm:text-sm font-bold text-gray uppercase">
            HOURS
          </h3>
        </div>

        <h2 className="md:text-[30px] text-sm sm:text-[18px] leading-7.5 font-normal text-primary">
          :
        </h2>
        <div>
          <h2 className="md:text-[30px] text-sm sm:text-[18px] font-normal text-primary">
            {minutes}
          </h2>
          <h3 className="md:text-[16px] text-[12px] sm:text-sm font-bold text-gray uppercase">
            MINS
          </h3>
        </div>

        <h2 className="md:text-[30px] text-sm sm:text-[18px] leading-7.5 font-normal text-primary">
          :
        </h2>
        <div>
          <h2 className="md:text-[30px] text-sm sm:text-[18px] font-normal text-primary">
            {seconds}
          </h2>
          <h3 className="md:text-[16px] text-[12px] sm:text-sm font-bold text-gray uppercase">
            SEC
          </h3>
        </div>
      </div>
    );
  };

  return (
    <section
      style={{ backgroundColor: deal.bgColor || "#ebebeb" }}
      className="md:py-7 mt-12.5 md:mt-0 pr-2.5 overflow-x-hidden"
    >
      <div className="container">
        <div className="flex pl-3 sm:pl-7 md:pl-auto pt-5 md:pt-18.5 pb-6 md:pb-auto md:p-11.5 justify-between items-center md:items-end">
          <div>
            <h3 className='md:text-sm text-[12px] font-medium leading-6 text-[#c32929] after:content-[""] after:duration-300 after:w-5 sm:after:w-10 after:h-0.5 after:bg-[#c32929] after:absolute after:top-2 relative after:-left-12 md:after:-left-15 sm:ml-12 md:ml-15 uppercase'>
              {deal.tag || "DEAL OF THE WEEK"}
            </h3>
            <h2 className="uppercase text-[20px] sm:text-[30px] w-43 md:w-auto md:text-[40px] lg:text-[70px] font-normal text-primary">
              <span className="font-bold">{deal.titleBold || "Spring"}</span>{" "}
              {deal.titleRegular || "Collection"}
            </h2>
            <Link
              to={deal.ctaLink || "/shop"}
              className='uppercase text-primary text-[12px] sm:text-sm leading-6 after:content-[""] after:w-0 after:duration-300 hover:after:w-12.5 after:h-0.75 after:bg-primary after:absolute after:bottom-0 relative after:left-0 font-medium'
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
              className="w-50 sm:w-80 object-cover"
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
