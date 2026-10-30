import React, { useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  Edit3,
  Gift,
  ImagePlus,
  Star,
  Trash2,
  UploadCloud,
  X,
} from "lucide-react";
import { getAllDepartments } from "../../utils/categoryTaxonomy";

function toLocalDatetimeInputValue(isoString) {
  if (!isoString || isoString === "none") return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function AdminProductModal({
  editingProduct,
  productForm,
  setProductForm,
  products,
  uploadingField,
  uploadStatusMsg,
  onCloudinaryFileUpload,
  onApplyTimerPresetHours,
  onSubmit,
  onClose,
}) {
  const [extraImageUrl, setExtraImageUrl] = useState("");
  const departments = getAllDepartments(false);
  const currentDeptObj =
    departments.find((d) => d.slug === (productForm.department || "women")) ||
    departments[0];
  const subcategories = currentDeptObj?.subcategories || ["General"];

  const galleryImages = Array.isArray(productForm.images)
    ? productForm.images.filter(Boolean)
    : productForm.thumbnail
      ? [productForm.thumbnail]
      : [];

  const handleAddGalleryUrl = () => {
    const clean = extraImageUrl.trim();
    if (!clean) return;
    const nextImages = Array.from(new Set([...galleryImages, clean]));
    setProductForm({
      ...productForm,
      thumbnail: productForm.thumbnail || clean,
      images: nextImages,
    });
    setExtraImageUrl("");
  };

  const handleSetPrimaryImage = (url) => {
    const rest = galleryImages.filter((u) => u !== url);
    setProductForm({
      ...productForm,
      thumbnail: url,
      images: [url, ...rest],
    });
  };

  const handleMoveGalleryImage = (index, direction) => {
    const targetIdx = index + direction;
    if (targetIdx < 0 || targetIdx >= galleryImages.length) return;
    const copy = [...galleryImages];
    const [moved] = copy.splice(index, 1);
    copy.splice(targetIdx, 0, moved);
    setProductForm({
      ...productForm,
      thumbnail: copy[0] || productForm.thumbnail,
      images: copy,
    });
  };

  const handleRemoveGalleryImage = (url) => {
    const next = galleryImages.filter((u) => u !== url);
    setProductForm({
      ...productForm,
      thumbnail: next[0] || "",
      images: next,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingProduct ? "Edit Product" : "Add Product"}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full shadow-2xl max-h-[94dvh] flex flex-col overflow-hidden">
        {/* Sticky Modal Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <h3 className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
            <Edit3 size={16} />
            {editingProduct
              ? "Edit Product, Gallery & Discount"
              : "Add New Storefront Product"}
          </h3>
          <button
            type="button"
            aria-label="Close product editor"
            onClick={onClose}
            className="min-w-[40px] min-h-[40px] -mr-2 flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200 cursor-pointer"
          >
            <X size={19} />
          </button>
        </div>

        {/* Scrollable Form Body */}
        <form
          onSubmit={onSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs"
        >
          {/* Title & SKU */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Product Title *
              </label>
              <input
                type="text"
                required
                placeholder="e.g., Tailored Linen Blazer"
                value={productForm.title}
                onChange={(e) =>
                  setProductForm({ ...productForm, title: e.target.value })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-3 text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                SKU Code
              </label>
              <input
                type="text"
                placeholder="UMMO-SKU-001"
                value={productForm.sku || ""}
                onChange={(e) =>
                  setProductForm({ ...productForm, sku: e.target.value })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-3 font-mono text-gray-900 outline-none focus:border-gray-900"
              />
            </div>
          </div>

          {/* Department, Subcategory, Category Tag & Brand */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Department *
              </label>
              <select
                value={productForm.department || "women"}
                onChange={(e) => {
                  const nextDeptSlug = e.target.value;
                  const deptObj = departments.find(
                    (d) => d.slug === nextDeptSlug
                  );
                  const firstSub = deptObj?.subcategories?.[0] || "General";
                  const defaultCat =
                    deptObj?.legacyCategories?.[0] || nextDeptSlug;
                  setProductForm({
                    ...productForm,
                    department: nextDeptSlug,
                    subcategory: firstSub,
                    category: productForm.category || defaultCat,
                  });
                }}
                className="w-full h-10 border border-gray-300 rounded-lg px-2.5 bg-white font-bold text-gray-900"
              >
                {departments.map((d) => (
                  <option key={d.slug} value={d.slug}>
                    {d.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Subcategory *
              </label>
              <select
                value={productForm.subcategory || subcategories[0]}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    subcategory: e.target.value,
                  })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-2.5 bg-white font-semibold text-gray-800"
              >
                {subcategories.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Category Slug *
              </label>
              <input
                type="text"
                required
                value={productForm.category}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    category: e.target.value,
                  })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-3"
              />
            </div>

            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Brand
              </label>
              <input
                type="text"
                placeholder="UOMO Studio"
                value={productForm.brand}
                onChange={(e) =>
                  setProductForm({ ...productForm, brand: e.target.value })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-3"
              />
            </div>
          </div>

          {/* Pricing, Discount & Stock */}
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Regular Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                min="0.01"
                required
                value={productForm.price}
                onChange={(e) =>
                  setProductForm({ ...productForm, price: e.target.value })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-3 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Discount % (0–90)
              </label>
              <input
                type="number"
                min="0"
                max="90"
                value={productForm.discountPercentage}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    discountPercentage: e.target.value,
                  })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-3 font-bold text-[#C32929]"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Stock Quantity *
              </label>
              <input
                type="number"
                min="0"
                required
                value={productForm.stock}
                onChange={(e) =>
                  setProductForm({ ...productForm, stock: e.target.value })
                }
                className="w-full h-10 border border-gray-300 rounded-lg px-3 font-bold"
              />
            </div>
          </div>

          {/* Variants (Sizes & Colors) + Visibility Status */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Sizes (comma-separated)
              </label>
              <input
                type="text"
                placeholder="XS, S, M, L, XL"
                value={productForm.sizesInput ?? "XS, S, M, L, XL"}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    sizesInput: e.target.value,
                  })
                }
                className="w-full h-9 border border-gray-300 rounded-lg px-2.5 bg-white"
              />
            </div>
            <div>
              <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
                Colors (comma-separated)
              </label>
              <input
                type="text"
                placeholder="Black, Ivory, Navy"
                value={productForm.colorsInput ?? "Black, White, Navy"}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    colorsInput: e.target.value,
                  })
                }
                className="w-full h-9 border border-gray-300 rounded-lg px-2.5 bg-white"
              />
            </div>
            <div className="flex flex-col justify-center gap-1.5 pt-2 sm:pt-0">
              <label className="inline-flex items-center gap-2 cursor-pointer font-bold text-gray-800">
                <input
                  type="checkbox"
                  checked={productForm.isVisible !== false}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      isVisible: e.target.checked,
                      status: e.target.checked ? "active" : "draft",
                    })
                  }
                  className="w-4 h-4 accent-gray-900 rounded"
                />
                <span>Active / Visible in Store</span>
              </label>
              <label className="inline-flex items-center gap-2 cursor-pointer font-semibold text-gray-700">
                <input
                  type="checkbox"
                  checked={Boolean(productForm.isFeatured)}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      isFeatured: e.target.checked,
                    })
                  }
                  className="w-4 h-4 accent-amber-600 rounded"
                />
                <span>Featured Product</span>
              </label>
            </div>
          </div>

          {/* Multi-Image Gallery & Primary Thumbnail Manager */}
          <div className="p-3.5 rounded-xl border border-gray-200 bg-white space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <label className="font-extrabold uppercase tracking-wider text-gray-800 flex items-center gap-1.5">
                <ImagePlus size={15} />
                Product Image Gallery ({galleryImages.length} Images)
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <label className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">
                  <UploadCloud size={13} />
                  {uploadingField === "thumbnail"
                    ? "Uploading..."
                    : "Upload Primary Photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    disabled={Boolean(uploadingField)}
                    onChange={(e) =>
                      onCloudinaryFileUpload(
                        e.target.files?.[0],
                        "thumbnail",
                        "ummo_products"
                      )
                    }
                  />
                </label>

                <label className="inline-flex items-center gap-1.5 border border-gray-900 text-gray-900 hover:bg-gray-100 px-3 py-1.5 rounded-lg text-[11px] font-bold cursor-pointer">
                  <ImagePlus size={13} />
                  {uploadingField === "galleryImage"
                    ? "Uploading..."
                    : "+ Add Gallery Photo"}
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                    className="hidden"
                    disabled={Boolean(uploadingField)}
                    onChange={(e) =>
                      onCloudinaryFileUpload(
                        e.target.files?.[0],
                        "galleryImage",
                        "ummo_products"
                      )
                    }
                  />
                </label>
              </div>
            </div>

            {/* Primary Thumbnail URL Input */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                required
                placeholder="Primary Thumbnail URL (https://res.cloudinary.com/...)"
                value={productForm.thumbnail}
                onChange={(e) => {
                  const val = e.target.value;
                  setProductForm({
                    ...productForm,
                    thumbnail: val,
                    images: val
                      ? Array.from(new Set([val, ...galleryImages]))
                      : galleryImages,
                  });
                }}
                className="flex-1 h-9 border border-gray-300 rounded-lg px-3"
              />
            </div>

            {/* Add Additional Image URL */}
            <div className="flex items-center gap-2">
              <input
                type="text"
                placeholder="Paste additional gallery image URL..."
                value={extraImageUrl}
                onChange={(e) => setExtraImageUrl(e.target.value)}
                className="flex-1 h-9 border border-gray-300 rounded-lg px-3"
              />
              <button
                type="button"
                onClick={handleAddGalleryUrl}
                className="h-9 px-3 rounded-lg bg-gray-100 hover:bg-gray-200 font-bold text-gray-800 cursor-pointer"
              >
                Add URL
              </button>
            </div>

            {uploadStatusMsg && (
              <p className="text-[11px] font-semibold text-emerald-700">
                {uploadStatusMsg}
              </p>
            )}

            {/* Gallery Thumbnails Preview, Reorder & Primary Selector */}
            {galleryImages.length > 0 && (
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-2.5 pt-1">
                {galleryImages.map((imgUrl, idx) => {
                  const isPrimary = imgUrl === productForm.thumbnail || idx === 0;
                  return (
                    <div
                      key={`${imgUrl}-${idx}`}
                      className={`relative border rounded-lg p-1.5 bg-gray-50 flex flex-col items-center ${
                        isPrimary
                          ? "border-gray-900 ring-1 ring-gray-900"
                          : "border-gray-200"
                      }`}
                    >
                      <img
                        src={imgUrl}
                        alt={`Gallery ${idx + 1}`}
                        className="w-full h-16 object-contain rounded bg-white"
                      />
                      <div className="flex items-center justify-between w-full mt-1.5 gap-1">
                        <button
                          type="button"
                          onClick={() => handleSetPrimaryImage(imgUrl)}
                          title="Set as primary thumbnail"
                          className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase cursor-pointer ${
                            isPrimary
                              ? "bg-gray-900 text-white"
                              : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                          }`}
                        >
                          {isPrimary ? (
                            <span className="inline-flex items-center gap-0.5">
                              <Star size={9} /> Main
                            </span>
                          ) : (
                            "Set Main"
                          )}
                        </button>
                        <div className="flex items-center gap-0.5">
                          <button
                            type="button"
                            onClick={() => handleMoveGalleryImage(idx, -1)}
                            disabled={idx === 0}
                            className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowLeft size={11} />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveGalleryImage(idx, 1)}
                            disabled={idx === galleryImages.length - 1}
                            className="p-0.5 text-gray-500 hover:text-gray-900 disabled:opacity-30 cursor-pointer"
                          >
                            <ArrowRight size={11} />
                          </button>
                          {galleryImages.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveGalleryImage(imgUrl)}
                              className="p-0.5 text-red-500 hover:text-red-700 cursor-pointer"
                            >
                              <Trash2 size={11} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Timer-Based Discount Configuration Box */}
          <div className="p-3.5 rounded-xl bg-amber-50/70 border border-amber-200 space-y-2.5">
            <label className="block font-bold text-gray-800 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-700" />
              Single-Product Countdown Timer Expiry (Gate 7)
            </label>
            <input
              type="datetime-local"
              value={toLocalDatetimeInputValue(productForm.discountEndTime)}
              onChange={(e) => {
                const val = e.target.value;
                setProductForm({
                  ...productForm,
                  discountEndTime: val ? new Date(val).toISOString() : "none",
                });
              }}
              className="w-full h-10 border border-gray-300 rounded-lg px-3 bg-white"
            />
            <div className="flex flex-wrap gap-1.5 pt-1">
              {[
                { label: "+6 Hours", hours: 6 },
                { label: "+24 Hours", hours: 24 },
                { label: "+3 Days", hours: 72 },
                { label: "+7 Days", hours: 168 },
              ].map((preset) => (
                <button
                  key={preset.hours}
                  type="button"
                  onClick={() => onApplyTimerPresetHours(preset.hours)}
                  className="px-2.5 py-1.5 rounded-lg bg-gray-900 text-white text-[11px] font-semibold hover:bg-black cursor-pointer"
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() =>
                  setProductForm({
                    ...productForm,
                    discountEndTime: "none",
                  })
                }
                className="px-2.5 py-1.5 rounded-lg border border-gray-300 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-100 cursor-pointer"
              >
                Clear Timer
              </button>
              <button
                type="button"
                onClick={() =>
                  setProductForm({
                    ...productForm,
                    discountPercentage: "0",
                    discountEndTime: "none",
                  })
                }
                className="px-2.5 py-1.5 rounded-lg border border-red-200 bg-red-50 text-red-700 text-[11px] font-semibold hover:bg-red-100 cursor-pointer"
              >
                Remove Discount
              </button>
            </div>
          </div>

          {/* Per-Product Free Gift Configuration Box */}
          <div className="p-3.5 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Gift size={14} className="text-emerald-700" />
                Product Free Gift Offer
              </label>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(productForm.freeGiftEnabled)}
                  onChange={(e) =>
                    setProductForm({
                      ...productForm,
                      freeGiftEnabled: e.target.checked,
                    })
                  }
                  className="accent-emerald-700 w-4 h-4"
                />
                <span className="font-bold text-emerald-800">
                  Enable Free Gift
                </span>
              </label>
            </div>

            {productForm.freeGiftEnabled && (
              <div className="space-y-2.5 pt-1">
                <div>
                  <label className="block font-semibold text-gray-700 mb-1">
                    Pick Existing Catalog Product as Free Gift (Optional)
                  </label>
                  <select
                    value={productForm.freeGiftProductId}
                    onChange={(e) => {
                      const selectedId = e.target.value;
                      const matched = products.find(
                        (p) => String(p.id) === String(selectedId)
                      );
                      if (matched) {
                        setProductForm({
                          ...productForm,
                          freeGiftProductId: String(matched.id),
                          freeGiftName: matched.title,
                          freeGiftImage: matched.thumbnail || "",
                        });
                      } else {
                        setProductForm({
                          ...productForm,
                          freeGiftProductId: "",
                        });
                      }
                    }}
                    className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white text-xs"
                  >
                    <option value="">-- Custom Gift Item --</option>
                    {products.slice(0, 40).map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.title} (${Number(p.price || 0).toFixed(2)})
                      </option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Buy Qty *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="20"
                      required={productForm.freeGiftEnabled}
                      value={productForm.freeGiftMinBuyQty}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          freeGiftMinBuyQty: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">
                      Free Gift Item Name *
                    </label>
                    <input
                      type="text"
                      required={productForm.freeGiftEnabled}
                      placeholder="e.g. Signature Pen / Mini Perfume"
                      value={productForm.freeGiftName}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          freeGiftName: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 bg-white font-semibold"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Description */}
          <div>
            <label className="block font-bold uppercase tracking-wider text-gray-700 mb-1">
              Product Description
            </label>
            <textarea
              rows={3}
              value={productForm.description}
              onChange={(e) =>
                setProductForm({
                  ...productForm,
                  description: e.target.value,
                })
              }
              className="w-full border border-gray-300 rounded-lg px-3 py-2 outline-none focus:border-gray-900"
            />
          </div>

          {/* Sticky Action Footer */}
          <div className="flex justify-end gap-2.5 pt-3 border-t border-gray-200 safe-area-bottom">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[42px] px-4 border border-gray-300 rounded-lg font-bold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="min-h-[42px] px-5 bg-gray-900 hover:bg-gray-800 text-white font-bold uppercase tracking-wider rounded-lg cursor-pointer"
            >
              Save Product
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
