import React, { useEffect, useState } from "react";
import { Swiper, SwiperSlide } from "swiper/react";
import { Pagination, Autoplay } from "swiper/modules";
import { Link } from "react-router";
import Image from "../common/Image";
import { getStoredBanners } from "../../../services/api";
import "swiper/css";
import "swiper/css/pagination";

const resolveSlideImage = (img, idx = 0) => {
  const fallbacks = [
    "/images/SLIDER.png",
    "/images/SLIDER2.png",
    "/images/SLIDER3.png",
    "/images/SLIDER4.png",
  ];
  const fallback = fallbacks[idx % fallbacks.length];
  if (!img || String(img).includes("banner.png")) return fallback;
  return img;
};

const Banner = () => {
  const [slides, setSlides] = useState(
    () => getStoredBanners().heroSlides || []
  );

  useEffect(() => {
    const handleUpdate = (e) => {
      if (e.detail?.heroSlides) {
        setSlides(e.detail.heroSlides);
      } else {
        setSlides(getStoredBanners().heroSlides || []);
      }
    };
    window.addEventListener("ummo:banners-updated", handleUpdate);
    return () =>
      window.removeEventListener("ummo:banners-updated", handleUpdate);
  }, []);

  return (
    <section className="flex relative overflow-hidden">
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
        {slides.map((item, idx) => {
          const hasCustomOverlay = Boolean(item.title || item.tag);
          const resolvedSrc = resolveSlideImage(item.image, idx);

          return (
            <SwiperSlide key={item.id || idx}>
              <div
                style={{ backgroundColor: item.bgColor || "#f5e6e0" }}
                className="relative w-full"
              >
                {hasCustomOverlay ? (
                  <>
                    <Image
                      className="w-full min-h-[240px] sm:min-h-[360px] md:min-h-[460px] max-h-[650px] object-cover"
                      src={resolvedSrc}
                      alt={item.title || "UOMO Hero Banner"}
                      onError={(e) => {
                        e.currentTarget.src = "/images/SLIDER.png";
                      }}
                    />
                    <div className="flex absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent items-center">
                      <div className="container mx-auto px-4 sm:px-6 md:px-12 pb-6 sm:pb-0">
                        <div className="max-w-xs sm:max-w-xl text-white space-y-1.5 sm:space-y-2 md:space-y-3">
                          {item.tag && (
                            <span className="inline-block text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-widest bg-[#B9A16B] text-white px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-sm">
                              {item.tag}
                            </span>
                          )}
                          {item.title && (
                            <h2 className="text-lg xs:text-xl sm:text-3xl md:text-4xl lg:text-5xl font-bold leading-tight drop-shadow">
                              {item.title}
                            </h2>
                          )}
                          {item.subtitle && (
                            <p className="text-[11px] sm:text-xs md:text-sm text-gray-100 max-w-md drop-shadow line-clamp-2">
                              {item.subtitle}
                            </p>
                          )}
                          {item.ctaText && (
                            <div className="pt-1 sm:pt-2">
                              <Link
                                to={item.ctaLink || "/shop"}
                                className="inline-block bg-white text-gray-900 hover:bg-gray-900 hover:text-white transition-colors text-[10px] sm:text-xs font-bold uppercase tracking-wider px-4 py-2 sm:px-6 sm:py-3 rounded-sm"
                              >
                                {item.ctaText}
                              </Link>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <Link to={item.ctaLink || "/shop"} className="block w-full">
                    <Image
                      className="w-full h-auto block object-cover"
                      src={resolvedSrc}
                      alt="UOMO Collection Banner"
                      onError={(e) => {
                        e.currentTarget.src = "/images/SLIDER.png";
                      }}
                    />
                  </Link>
                )}
              </div>
            </SwiperSlide>
          );
        })}
      </Swiper>
    </section>
  );
};

export default Banner;
