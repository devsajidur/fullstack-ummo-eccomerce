import React, { useEffect, useState } from "react";
import { Link } from "react-router";
import Image from "../common/Image";
import { getStoredBanners } from "../../../services/api";

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
  const [activeIdx, setActiveIdx] = useState(0);

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

  const safeSlides = slides.length > 0 ? slides : [{}];
  const currentIdx = activeIdx < safeSlides.length ? activeIdx : 0;
  const item = safeSlides[currentIdx] || {};
  const hasCustomOverlay = Boolean(item.title || item.tag);
  const resolvedSrc = resolveSlideImage(item.image, currentIdx);

  return (
    <section className="flex relative overflow-hidden">
      <div className="mySwiper w-full relative">
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
                loading="eager"
                fetchPriority="high"
                width={720}
                height={360}
                onError={(e) => {
                  e.currentTarget.src = "/images/SLIDER.png";
                }}
              />
              <div className="flex absolute inset-0 bg-gradient-to-r from-black/55 via-black/25 to-transparent items-center">
                <div className="container mx-auto px-4 sm:px-6 md:px-12 pb-6 sm:pb-0">
                  <div className="max-w-xs sm:max-w-xl text-white space-y-1.5 sm:space-y-2 md:space-y-3">
                    {item.tag && (
                      <span className="inline-block text-[10px] sm:text-[11px] md:text-xs font-bold uppercase tracking-widest bg-gray-900 text-white px-2.5 py-0.5 sm:px-3 sm:py-1 rounded-sm">
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
            <Link
              to={item.ctaLink || "/shop"}
              className="block w-full aspect-[1280/533]"
            >
              <Image
                className="w-full h-full block object-cover"
                src={resolvedSrc}
                alt="UOMO Collection Banner"
                loading="eager"
                fetchPriority="high"
                width={720}
                height={300}
                onError={(e) => {
                  e.currentTarget.src = "/images/SLIDER.png";
                }}
              />
            </Link>
          )}
        </div>

        {safeSlides.length > 1 && (
          <div className="absolute bottom-2 sm:bottom-4 left-5 sm:left-10 z-20 flex items-center gap-1">
            {safeSlides.map((s, idx) => (
              <button
                key={s.id || idx}
                type="button"
                aria-label={`Go to slide ${idx + 1}`}
                onClick={() => setActiveIdx(idx)}
                className="min-w-[28px] min-h-[28px] flex items-center justify-center cursor-pointer"
              >
                <span
                  className={`block h-2.5 rounded-full transition-all ${
                    idx === currentIdx
                      ? "w-7 bg-gray-900"
                      : "w-2.5 bg-gray-900/40 hover:bg-gray-900/70"
                  }`}
                />
              </button>
            ))}
          </div>
        )}
      </div>
    </section>
  );
};

export default Banner;
