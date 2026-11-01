import React, { useEffect, useState } from "react";
import Image from "../common/Image";
import { Link } from "react-router";
import { getStoredFeaturedCollection } from "../../../services/api";
import { getCloudinaryBannerUrl } from "../../../services/cloudinary";
import { pad2, useNowTick } from "../../../utils/discountTimer";

const SpringImage = getCloudinaryBannerUrl("springImage", 700);

function getRemainingCountdown(isoDate, nowMs) {
  if (!isoDate) return null;
  const endMs = Date.parse(isoDate);
  if (!Number.isFinite(endMs) || endMs <= nowMs) return null;
  const totalSec = Math.floor((endMs - nowMs) / 1000);
  return {
    days: Math.floor(totalSec / 86400),
    hours: Math.floor((totalSec % 86400) / 3600),
    minutes: Math.floor((totalSec % 3600) / 60),
    seconds: totalSec % 60,
  };
}

const SpringCollection = () => {
  const [featured, setFeatured] = useState(() => getStoredFeaturedCollection());

  useEffect(() => {
    const syncFeatured = () => {
      setFeatured(getStoredFeaturedCollection());
    };
    window.addEventListener("ummo:featured-collection-updated", syncFeatured);
    window.addEventListener("ummo:banners-updated", syncFeatured);
    return () => {
      window.removeEventListener(
        "ummo:featured-collection-updated",
        syncFeatured
      );
      window.removeEventListener("ummo:banners-updated", syncFeatured);
    };
  }, []);

  const hasTimerConfig =
    featured?.timerEnabled !== false && Boolean(featured?.countdownDate);
  const nowMs = useNowTick(hasTimerConfig);

  if (featured?.enabled === false) {
    return null;
  }

  const countdown = hasTimerConfig
    ? getRemainingCountdown(featured.countdownDate, nowMs)
    : null;
  const discountPct = Math.max(0, Number(featured?.discountPercentage || 0));
  const rawCta = String(featured?.ctaText || "").trim();
  const ctaLabel =
    !rawCta || rawCta.toUpperCase() === "NOW" ? "SHOP NOW" : rawCta;
  const selectedCount = Array.isArray(featured?.productIds)
    ? featured.productIds.length
    : 0;

  return (
    <section
      data-testid="featured-collection-section"
      style={{ backgroundColor: featured.bgColor || "#ebebeb" }}
      className="pt-6 md:pt-14 mt-10 md:mt-0 px-3 sm:px-4 overflow-x-hidden"
    >
      <div className="container mx-auto">
        <div className="flex flex-col sm:flex-row pl-2 sm:pl-6 md:pl-10 py-6 md:py-10 justify-between items-start sm:items-center gap-6">
          <div className="max-w-xl">
            <div className="flex flex-wrap items-center gap-2.5">
              <h3 className="md:text-sm text-xs font-semibold leading-6 text-[#c32929] flex items-center gap-2.5 uppercase">
                <span className="w-6 sm:w-10 h-0.5 bg-[#c32929] inline-block" />
                {featured.tag || "DEAL OF THE WEEK"}
              </h3>
              {discountPct > 0 && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-bold uppercase tracking-wider bg-[#c32929] text-white">
                  Up to {discountPct}% Off
                </span>
              )}
            </div>

            <h2 className="uppercase text-2xl sm:text-3xl md:text-5xl xl:text-[64px] leading-tight font-normal text-primary mt-1.5">
              <span className="font-bold">
                {featured.titleBold || "Spring"}
              </span>{" "}
              {featured.titleRegular || "Collection"}
            </h2>

            <p className="text-xs sm:text-sm text-gray-700 mt-2 max-w-md leading-relaxed">
              {featured.description ||
                "Explore curated seasonal essentials with verified markdowns across Women, Men, and Lifestyle collections."}
            </p>

            {countdown && (
              <div
                data-testid="featured-collection-countdown"
                className="flex flex-wrap items-center gap-2 sm:gap-3 mt-4"
              >
                {[
                  { label: "Days", val: pad2(countdown.days) },
                  { label: "Hours", val: pad2(countdown.hours) },
                  { label: "Mins", val: pad2(countdown.minutes) },
                  { label: "Secs", val: pad2(countdown.seconds) },
                ].map((unit) => (
                  <div
                    key={unit.label}
                    className="bg-white/90 border border-black/10 rounded-xl px-2.5 sm:px-3.5 py-1.5 text-center min-w-[54px] shadow-2xs"
                  >
                    <div className="text-sm sm:text-lg font-bold text-gray-900 tabular-nums leading-tight">
                      {unit.val}
                    </div>
                    <div className="text-[9px] sm:text-[10px] font-semibold uppercase tracking-wider text-gray-500">
                      {unit.label}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div className="mt-5 flex flex-wrap items-center gap-3">
              <Link
                to="/featured"
                data-testid="featured-shop-now-btn"
                className="inline-flex items-center justify-center bg-primary text-white hover:bg-gray-800 transition-colors uppercase font-semibold text-xs sm:text-sm tracking-wider px-6 py-3 rounded-lg"
              >
                {ctaLabel}
              </Link>
              {selectedCount > 0 && (
                <span className="text-xs font-medium text-gray-600">
                  {selectedCount} Curated Styles
                </span>
              )}
            </div>
          </div>

          <div className="self-center sm:self-end shrink-0">
            <Image
              className="w-44 xs:w-52 sm:w-72 md:w-80 object-cover rounded-xl"
              src={featured.image || SpringImage}
              alt={`${featured.titleBold || "Spring"} ${
                featured.titleRegular || "Collection"
              }`}
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
