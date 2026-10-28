import React, { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import { Link } from "react-router";
import Image from "../common/Image";
import { getStoredBanners } from "../../../services/api";
import "swiper/css";
import "swiper/css/pagination";

const Banner = () => {
  const [slides, setSlides] = useState(() => getStoredBanners().heroSlides || []);

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail?.heroSlides) {
        setSlides(e.detail.heroSlides);
      } else {
        setSlides(getStoredBanners().heroSlides || []);
      }
    };
    window.addEventListener("ummo:banners-updated", handleUpdate);
    return () => window.removeEventListener("ummo:banners-updated", handleUpdate);
  }, []);

  return (
    <section className="flex relative">
      <Swiper
        spaceBetween={0}
        pagination={{
          clickable: true,
        }}
        modules={[Autoplay, Pagination]}
        autoplay={{
          delay: 3500,
          disableOnInteraction: false,
          pauseOnMouseEnter: true,
        }}
        loop={slides.length > 1}
        className="mySwiper w-full"
      >
        {slides.map((item, idx) => (
          <SwiperSlide key={item.id || idx}>
            <div className="relative w-full">
              <Image
                className="w-full max-h-[650px] object-cover"
                src={item.image || "../images/banner.png"}
                alt={item.title || "banner"}
              />
              {(item.title || item.tag) && (
                <div className=" hidden sm:flex absolute inset-0 bg-gradient-to-r from-black/45 via-black/15 to-transparent items-center">
                  <div className="container mx-auto px-6 md:px-12">
                    <div className="max-w-xl text-white space-y-2 md:space-y-3">
                      {item.tag && (
                        <span className="inline-block text-[11px] md:text-xs font-bold uppercase tracking-widest bg-[#B9A16B] text-white px-3 py-1 rounded-sm">
                          {item.tag}
                        </span>
                      )}
                      {item.title && (
                        <h2 className="text-2xl md:text-4xl lg:text-5xl font-bold leading-tight drop-shadow">
                          {item.title}
                        </h2>
                      )}
                      {item.subtitle && (
                        <p className="text-xs md:text-sm text-gray-100 max-w-md drop-shadow">
                          {item.subtitle}
                        </p>
                      )}
                      {item.ctaText && (
                        <div className="pt-2">
                          <Link
                            to={item.ctaLink || "/shop"}
                            className="inline-block bg-white text-gray-900 hover:bg-gray-900 hover:text-white transition-colors text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-sm"
                          >
                            {item.ctaText}
                          </Link>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </SwiperSlide>
        ))}
      </Swiper>
    </section>
  );
};

export default Banner;
