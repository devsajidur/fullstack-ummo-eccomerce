import React, { useEffect, useMemo, useState } from "react";
import { Link } from "react-router";
import {
  Clock,
  ExternalLink,
  Percent,
  RotateCcw,
  Save,
  Sparkles,
  UploadCloud,
} from "lucide-react";
import toast from "react-hot-toast";
import {
  DEFAULT_FEATURED_COLLECTION,
  getStoredFeaturedCollection,
  saveStoredFeaturedCollection,
} from "../../services/api";
import {
  getCloudinaryBannerUrl,
  uploadImageToCloudinary,
} from "../../services/cloudinary";
import FeaturedProductPicker from "./featured/FeaturedProductPicker";

const DEFAULT_SPRING_IMAGE = getCloudinaryBannerUrl("springImage", 600);

const BG_PRESETS = [
  { label: "Classic Stone", value: "#ebebeb" },
  { label: "Soft Pearl", value: "#f8fafc" },
  { label: "Warm Sand", value: "#f5efe6" },
  { label: "Blush Mist", value: "#fdf2f4" },
  { label: "Sage Tint", value: "#eff6f2" },
];

function toDatetimeLocalValue(isoStr) {
  if (!isoStr) return "";
  const ms = Date.parse(isoStr);
  if (!Number.isFinite(ms)) return "";
  const d = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(
    d.getHours()
  )}:${pad(d.getMinutes())}`;
}

function buildFutureIsoFromHours(hours) {
  return new Date(Date.now() + Number(hours || 24) * 3600 * 1000).toISOString();
}

export default function AdminFeaturedCollectionTab({ products = [] }) {
  const [form, setForm] = useState(() => getStoredFeaturedCollection());
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const handleRemote = (e) => {
      if (e?.detail && typeof e.detail === "object") {
        setForm(e.detail);
      } else {
        setForm(getStoredFeaturedCollection());
      }
    };
    window.addEventListener("ummo:featured-collection-updated", handleRemote);
    return () =>
      window.removeEventListener(
        "ummo:featured-collection-updated",
        handleRemote
      );
  }, []);

  const selectedIdSet = useMemo(
    () =>
      new Set(
        Array.isArray(form.productIds) ? form.productIds.map(String) : []
      ),
    [form.productIds]
  );

  const selectedProducts = useMemo(() => {
    const byId = new Map(products.map((p) => [String(p.id), p]));
    return (form.productIds || [])
      .map((id) => byId.get(String(id)))
      .filter(Boolean);
  }, [products, form.productIds]);

  function updateField(field, value) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  function toggleProductSelection(productId) {
    const idStr = String(productId);
    setForm((prev) => {
      const current = Array.isArray(prev.productIds) ? prev.productIds : [];
      const exists = current.some((x) => String(x) === idStr);
      const nextIds = exists
        ? current.filter((x) => String(x) !== idStr)
        : [...current, productId];
      return { ...prev, productIds: nextIds };
    });
  }

  function applyTimerPresetHours(hours) {
    const iso = buildFutureIsoFromHours(hours);
    setForm((prev) => ({
      ...prev,
      timerEnabled: true,
      countdownDate: iso,
    }));
  }

  async function handleUploadBannerImage(file) {
    if (!file) return;
    setUploading(true);
    try {
      const uploaded = await uploadImageToCloudinary(file, "ummo_banners");
      if (uploaded?.url) {
        updateField("image", uploaded.url);
        toast.success("Featured collection image uploaded to Cloudinary!");
      }
    } catch (err) {
      toast.error(err?.message || "Image upload failed.");
    } finally {
      setUploading(false);
    }
  }

  async function handleSave(e) {
    if (e?.preventDefault) e.preventDefault();
    setSaving(true);
    try {
      await saveStoredFeaturedCollection(form);
      toast.success("Featured Collection published and synced live!");
    } finally {
      setSaving(false);
    }
  }

  async function handleReset() {
    setForm(DEFAULT_FEATURED_COLLECTION);
    await saveStoredFeaturedCollection(DEFAULT_FEATURED_COLLECTION);
    toast.success("Featured Collection restored to defaults.");
  }

  const campaignDiscount = Math.min(
    90,
    Math.max(0, Number(form.discountPercentage || 0))
  );

  return (
    <form onSubmit={handleSave} className="space-y-6">
      <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-xs flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-gray-900 text-white">
              <Sparkles size={12} /> Featured Products Campaign
            </span>
            <span
              className={`text-[11px] font-bold uppercase px-2.5 py-0.5 rounded-full ${
                form.enabled !== false
                  ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                  : "bg-gray-100 text-gray-600 border border-gray-200"
              }`}
            >
              {form.enabled !== false ? "Active on Homepage" : "Hidden"}
            </span>
          </div>
          <h2 className="text-base sm:text-lg font-bold text-gray-900 mt-2">
            Spring / Featured Collection Spotlight Manager
          </h2>
          <p className="text-xs text-gray-500 mt-0.5">
            Control the homepage Featured Collection banner, title, image,
            countdown timer, campaign discount, and the curated products shown
            when shoppers click &ldquo;{form.ctaText || "SHOP NOW"}&rdquo;.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <Link
            to="/featured"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1.5 border border-gray-200 text-gray-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-gray-50"
          >
            Preview Page <ExternalLink size={13} />
          </Link>
          <button
            type="button"
            onClick={handleReset}
            className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 text-xs font-semibold px-3.5 py-2.5 rounded-xl hover:bg-gray-50 cursor-pointer"
          >
            <RotateCcw size={13} /> Reset
          </button>
          <button
            type="submit"
            disabled={saving}
            data-testid="save-featured-collection-btn"
            className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-5 py-2.5 rounded-xl hover:bg-gray-800 disabled:opacity-60 cursor-pointer"
          >
            <Save size={14} />
            {saving ? "Publishing..." : "Publish Campaign"}
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-7 bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
          <div className="flex items-center justify-between border-b border-gray-100 pb-3">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
              1. Headline, Image &amp; Appearance
            </h3>
            <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
              <input
                type="checkbox"
                checked={form.enabled !== false}
                onChange={(e) => updateField("enabled", e.target.checked)}
                className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
              />
              Show Section on Homepage
            </label>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Top Badge / Tagline
              </label>
              <input
                type="text"
                data-testid="featured-tag-input"
                value={form.tag || ""}
                onChange={(e) => updateField("tag", e.target.value)}
                placeholder="DEAL OF THE WEEK"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                CTA Button Text
              </label>
              <input
                type="text"
                data-testid="featured-cta-input"
                value={form.ctaText || ""}
                onChange={(e) => updateField("ctaText", e.target.value)}
                placeholder="SHOP NOW"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Bold Title Word
              </label>
              <input
                type="text"
                data-testid="featured-title-bold-input"
                value={form.titleBold || ""}
                onChange={(e) => updateField("titleBold", e.target.value)}
                placeholder="Spring"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>

            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Regular Title Word
              </label>
              <input
                type="text"
                data-testid="featured-title-regular-input"
                value={form.titleRegular || ""}
                onChange={(e) => updateField("titleRegular", e.target.value)}
                placeholder="Collection"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">
              Campaign Subtitle / Description
            </label>
            <textarea
              rows={2}
              data-testid="featured-description-input"
              value={form.description || ""}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Explore curated seasonal essentials with verified markdowns..."
              className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-start">
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-gray-700">
                  Banner Image (Cloudinary or URL)
                </label>
                <label className="inline-flex items-center gap-1 text-xs font-bold text-gray-900 hover:underline cursor-pointer">
                  <UploadCloud size={13} />
                  {uploading ? "Uploading..." : "Upload Image"}
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    disabled={uploading}
                    onChange={(e) =>
                      handleUploadBannerImage(e.target.files?.[0])
                    }
                  />
                </label>
              </div>
              <input
                type="text"
                data-testid="featured-image-input"
                value={form.image || ""}
                onChange={(e) => updateField("image", e.target.value)}
                placeholder="Leave blank for default Spring banner or paste URL"
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">
                Background Color
              </label>
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={form.bgColor || "#ebebeb"}
                  onChange={(e) => updateField("bgColor", e.target.value)}
                  className="h-10 w-12 rounded-lg border border-gray-300 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={form.bgColor || "#ebebeb"}
                  onChange={(e) => updateField("bgColor", e.target.value)}
                  className="flex-1 border border-gray-300 rounded-xl px-3 py-2 text-xs font-mono"
                />
              </div>
              <div className="flex flex-wrap gap-1.5 mt-2">
                {BG_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => updateField("bgColor", preset.value)}
                    className="inline-flex items-center gap-1.5 px-2 py-1 rounded-lg border border-gray-200 text-[11px] text-gray-700 hover:bg-gray-50 cursor-pointer"
                  >
                    <span
                      className="w-3 h-3 rounded-full border border-gray-300"
                      style={{ backgroundColor: preset.value }}
                    />
                    {preset.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="xl:col-span-5 space-y-6">
          <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
            <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider border-b border-gray-100 pb-3">
              2. Discount &amp; Countdown Timer
            </h3>

            <div>
              <label className="flex items-center justify-between text-xs font-semibold text-gray-700 mb-1">
                <span className="inline-flex items-center gap-1">
                  <Percent size={13} /> Campaign Discount Percentage (0–90%)
                </span>
                <span className="font-bold text-[#c32929]">
                  {campaignDiscount > 0
                    ? `-${campaignDiscount}% OFF`
                    : "No extra discount"}
                </span>
              </label>
              <input
                type="number"
                min={0}
                max={90}
                data-testid="featured-discount-input"
                value={form.discountPercentage ?? 0}
                onChange={(e) =>
                  updateField(
                    "discountPercentage",
                    Math.min(90, Math.max(0, Number(e.target.value) || 0))
                  )
                }
                className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm"
              />
              <p className="text-[11px] text-gray-500 mt-1">
                Automatically applies at least {campaignDiscount}% off to every
                selected product below while the campaign is active.
              </p>
            </div>

            <div className="pt-2 border-t border-gray-100 space-y-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700">
                  <Clock size={13} /> Live Countdown Timer
                </span>
                <label className="inline-flex items-center gap-2 text-xs font-semibold text-gray-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.timerEnabled !== false}
                    onChange={(e) =>
                      updateField("timerEnabled", e.target.checked)
                    }
                    className="rounded border-gray-300 text-gray-900 focus:ring-gray-900"
                  />
                  Enable Timer
                </label>
              </div>

              {form.timerEnabled !== false && (
                <>
                  <input
                    type="datetime-local"
                    data-testid="featured-timer-input"
                    value={toDatetimeLocalValue(form.countdownDate)}
                    onChange={(e) => {
                      const val = e.target.value;
                      updateField(
                        "countdownDate",
                        val ? new Date(val).toISOString() : ""
                      );
                    }}
                    className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-xs"
                  />
                  <div className="flex flex-wrap gap-1.5">
                    {[
                      { label: "+24 Hours", hrs: 24 },
                      { label: "+3 Days", hrs: 72 },
                      { label: "+7 Days", hrs: 168 },
                      { label: "+30 Days", hrs: 720 },
                    ].map((p) => (
                      <button
                        key={p.label}
                        type="button"
                        onClick={() => applyTimerPresetHours(p.hrs)}
                        className="px-2.5 py-1 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-[11px] font-semibold text-gray-700 cursor-pointer"
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          <div
            style={{ backgroundColor: form.bgColor || "#ebebeb" }}
            className="rounded-2xl border border-gray-200 p-4 sm:p-5 flex items-center justify-between gap-4 overflow-hidden"
          >
            <div className="min-w-0">
              <p className="text-[10px] font-bold uppercase tracking-widest text-[#c32929]">
                {form.tag || "DEAL OF THE WEEK"}
              </p>
              <h4 className="text-lg sm:text-xl uppercase text-gray-900 mt-0.5 truncate">
                <span className="font-bold">{form.titleBold || "Spring"}</span>{" "}
                {form.titleRegular || "Collection"}
              </h4>
              {campaignDiscount > 0 && (
                <span className="inline-block mt-1.5 text-[10px] font-bold uppercase bg-[#c32929] text-white px-2 py-0.5 rounded">
                  Up to {campaignDiscount}% Off • {selectedProducts.length}{" "}
                  Items
                </span>
              )}
              <div className="mt-3">
                <span className="inline-block bg-gray-900 text-white text-[10px] font-bold uppercase tracking-wider px-3 py-1.5 rounded">
                  {form.ctaText || "SHOP NOW"}
                </span>
              </div>
            </div>
            <img
              src={form.image || DEFAULT_SPRING_IMAGE}
              alt="Featured preview"
              className="w-20 h-24 sm:w-24 sm:h-28 object-cover rounded-xl border border-black/10 shrink-0 bg-white"
            />
          </div>
        </div>
      </div>

      <FeaturedProductPicker
        products={products}
        selectedProducts={selectedProducts}
        selectedIdSet={selectedIdSet}
        ctaText={form.ctaText}
        campaignDiscount={campaignDiscount}
        onToggleProduct={toggleProductSelection}
        onClearSelection={() => updateField("productIds", [])}
      />
    </form>
  );
}
