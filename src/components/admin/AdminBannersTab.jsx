import React, { useState } from "react";
import { Plus, RotateCcw, Save, Trash2 } from "lucide-react";
import {
  DEFAULT_BANNERS,
  getStoredBanners,
  saveStoredBanners,
} from "../../services/api";
import toast from "react-hot-toast";

export default function AdminBannersTab() {
  const [banners, setBanners] = useState(() => getStoredBanners());

  function handleSaveAll() {
    saveStoredBanners(banners);
    toast.success("Storefront banners updated and synced live!");
  }

  function handleResetDefault() {
    setBanners(DEFAULT_BANNERS);
    saveStoredBanners(DEFAULT_BANNERS);
    toast.success("Banners reset to default configuration.");
  }

  function handleSlideChange(idx, field, value) {
    const nextSlides = banners.heroSlides.map((s, i) =>
      i === idx ? { ...s, [field]: value } : s
    );
    setBanners({ ...banners, heroSlides: nextSlides });
  }

  function handleAddSlide() {
    const nextSlides = [
      ...(banners.heroSlides || []),
      {
        id: Date.now(),
        tag: "SPECIAL CAMPAIGN",
        title: "New Seasonal Collection",
        subtitle: "Discover limited-time luxury arrivals in our store.",
        ctaText: "SHOP NOW",
        ctaLink: "/shop",
        image: "../images/banner.png",
      },
    ];
    setBanners({ ...banners, heroSlides: nextSlides });
  }

  function handleRemoveSlide(idx) {
    if (banners.heroSlides.length <= 1) {
      toast.error("At least one hero slide is required.");
      return;
    }
    const nextSlides = banners.heroSlides.filter((_, i) => i !== idx);
    setBanners({ ...banners, heroSlides: nextSlides });
  }

  function handleDealChange(field, value) {
    setBanners({
      ...banners,
      dealBanner: { ...banners.dealBanner, [field]: value },
    });
  }

  function handlePromoCardChange(idx, field, value) {
    const nextCards = (banners.promoCards || []).map((c, i) =>
      i === idx ? { ...c, [field]: value } : c
    );
    setBanners({ ...banners, promoCards: nextCards });
  }

  return (
    <div className="space-y-8">
      {/* Header Bar */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Storefront Banners & CMS Manager
          </h2>
          <p className="text-xs text-gray-500">
            Customize Home Hero Slider, Deal of the Week Countdown Banner, and Category Promo Cards in real time.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleResetDefault}
            className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 text-xs font-semibold px-4 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
          >
            <RotateCcw size={14} /> Reset Defaults
          </button>
          <button
            type="button"
            onClick={handleSaveAll}
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-lg hover:bg-gray-800 cursor-pointer"
          >
            <Save size={14} /> Publish Banner Changes
          </button>
        </div>
      </div>

      {/* 1. Home Hero Slider Slides */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900">
            1. Home Hero Carousel Slides ({banners.heroSlides?.length || 0})
          </h3>
          <button
            type="button"
            onClick={handleAddSlide}
            className="inline-flex items-center gap-1 text-xs font-semibold bg-gray-100 hover:bg-gray-200 text-gray-900 px-3 py-1.5 rounded cursor-pointer"
          >
            <Plus size={14} /> Add Slide
          </button>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {(banners.heroSlides || []).map((slide, idx) => (
            <div
              key={slide.id || idx}
              className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-gray-700">
                  Slide #{idx + 1}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveSlide(idx)}
                  className="text-xs text-red-600 hover:underline inline-flex items-center gap-1 cursor-pointer"
                >
                  <Trash2 size={12} /> Remove
                </button>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Badge Tag
                </label>
                <input
                  type="text"
                  value={slide.tag || ""}
                  onChange={(e) =>
                    handleSlideChange(idx, "tag", e.target.value)
                  }
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Headline Title
                </label>
                <input
                  type="text"
                  value={slide.title || ""}
                  onChange={(e) =>
                    handleSlideChange(idx, "title", e.target.value)
                  }
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Subtitle
                </label>
                <input
                  type="text"
                  value={slide.subtitle || ""}
                  onChange={(e) =>
                    handleSlideChange(idx, "subtitle", e.target.value)
                  }
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    CTA Button Text
                  </label>
                  <input
                    type="text"
                    value={slide.ctaText || ""}
                    onChange={(e) =>
                      handleSlideChange(idx, "ctaText", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                    CTA Link
                  </label>
                  <input
                    type="text"
                    value={slide.ctaLink || ""}
                    onChange={(e) =>
                      handleSlideChange(idx, "ctaLink", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                  />
                </div>
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-gray-500 mb-1">
                  Banner Image URL
                </label>
                <input
                  type="text"
                  value={slide.image || ""}
                  onChange={(e) =>
                    handleSlideChange(idx, "image", e.target.value)
                  }
                  className="w-full border border-gray-300 rounded px-2.5 py-1.5 text-xs bg-white"
                />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2. Deal of the Week / Countdown Banner */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          2. Deal of the Week & Countdown Banner
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 text-xs">
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Top Tagline
            </label>
            <input
              type="text"
              value={banners.dealBanner?.tag || ""}
              onChange={(e) => handleDealChange("tag", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Bold Title Word
            </label>
            <input
              type="text"
              value={banners.dealBanner?.titleBold || ""}
              onChange={(e) => handleDealChange("titleBold", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Regular Title Word
            </label>
            <input
              type="text"
              value={banners.dealBanner?.titleRegular || ""}
              onChange={(e) => handleDealChange("titleRegular", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Countdown Target Date (ISO)
            </label>
            <input
              type="text"
              value={banners.dealBanner?.countdownDate || ""}
              onChange={(e) =>
                handleDealChange("countdownDate", e.target.value)
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              CTA Link URL
            </label>
            <input
              type="text"
              value={banners.dealBanner?.ctaLink || "/shop"}
              onChange={(e) => handleDealChange("ctaLink", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-600 mb-1">
              Background Color (Hex)
            </label>
            <input
              type="text"
              value={banners.dealBanner?.bgColor || "#ebebeb"}
              onChange={(e) => handleDealChange("bgColor", e.target.value)}
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
        </div>
      </div>

      {/* 3. Promotional Dual Cards */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          3. Dual Promotional Category Cards
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {(banners.promoCards || []).map((card, idx) => (
            <div
              key={card.id || idx}
              className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50/50"
            >
              <span className="font-bold text-gray-800 block">
                Promo Card #{idx + 1}
              </span>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">
                    Price / Subtitle Tag
                  </label>
                  <input
                    type="text"
                    value={card.subtitle || ""}
                    onChange={(e) =>
                      handlePromoCardChange(idx, "subtitle", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">
                    Card Title
                  </label>
                  <input
                    type="text"
                    value={card.title || ""}
                    onChange={(e) =>
                      handlePromoCardChange(idx, "title", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">
                    Target Category Filter
                  </label>
                  <input
                    type="text"
                    value={card.categoryFilter || ""}
                    onChange={(e) =>
                      handlePromoCardChange(
                        idx,
                        "categoryFilter",
                        e.target.value
                      )
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-gray-600 mb-1">
                    Background Color
                  </label>
                  <input
                    type="text"
                    value={card.bgColor || ""}
                    onChange={(e) =>
                      handlePromoCardChange(idx, "bgColor", e.target.value)
                    }
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
