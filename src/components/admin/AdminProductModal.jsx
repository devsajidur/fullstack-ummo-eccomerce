import React from "react";
import { Clock, Edit3, Gift, UploadCloud } from "lucide-react";

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
  return (
    <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[92vh] overflow-y-auto">
        <h3 className="text-base font-bold text-gray-900 mb-4 flex items-center gap-2">
          <Edit3 size={16} />
          {editingProduct
            ? "Edit Product & Timer-Based Discount"
            : "Add New Storefront Product"}
        </h3>
        <form onSubmit={onSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Product Title *
            </label>
            <input
              type="text"
              required
              value={productForm.title}
              onChange={(e) =>
                setProductForm({ ...productForm, title: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Category *
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
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Brand
              </label>
              <input
                type="text"
                value={productForm.brand}
                onChange={(e) =>
                  setProductForm({ ...productForm, brand: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Regular Price ($) *
              </label>
              <input
                type="number"
                step="0.01"
                required
                value={productForm.price}
                onChange={(e) =>
                  setProductForm({ ...productForm, price: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
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
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Stock *
              </label>
              <input
                type="number"
                required
                value={productForm.stock}
                onChange={(e) =>
                  setProductForm({ ...productForm, stock: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>

          {/* Timer-Based Discount Configuration Box */}
          <div className="p-3.5 rounded-lg bg-amber-50/70 border border-amber-200 space-y-2.5">
            <label className="block font-bold text-gray-800 flex items-center gap-1.5">
              <Clock size={14} className="text-amber-700" />
              Timer-Based Discount Expiry (Flash Deal Countdown)
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
              className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
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
                  className="px-2.5 py-1 rounded bg-gray-900 text-white text-[11px] font-semibold hover:bg-black cursor-pointer"
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
                className="px-2.5 py-1 rounded border border-gray-300 bg-white text-gray-700 text-[11px] font-semibold hover:bg-gray-100 cursor-pointer"
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
                className="px-2.5 py-1 rounded border border-red-200 bg-red-50 text-red-700 text-[11px] font-semibold hover:bg-red-100 cursor-pointer"
              >
                Remove Discount
              </button>
            </div>
          </div>

          {/* Per-Product Free Gift Configuration Box */}
          <div className="p-3.5 rounded-lg bg-emerald-50/70 border border-emerald-200 space-y-3">
            <div className="flex items-center justify-between">
              <label className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Gift size={14} className="text-emerald-700" />
                Product Free Gift Offer (এই প্রোডাক্ট কিনলে ফ্রি গিফট)
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
                    Or Pick an Existing Catalog Product as Free Gift (Optional)
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
                    className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white text-xs"
                  >
                    <option value="">
                      -- Custom Gift Item (Type name below, e.g. 1x Pen / কলম) --
                    </option>
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
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                    />
                  </div>
                  <div className="col-span-2">
                    <label className="block font-semibold text-gray-700 mb-1">
                      Free Gift Item Name * (e.g. Luxury Pen / কলম)
                    </label>
                    <input
                      type="text"
                      required={productForm.freeGiftEnabled}
                      placeholder="e.g. Signature Pen (কলম) / Mini Perfume"
                      value={productForm.freeGiftName}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          freeGiftName: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block font-semibold text-gray-700 mb-1">
                      Free Gift Qty *
                    </label>
                    <input
                      type="number"
                      min="1"
                      max="10"
                      required={productForm.freeGiftEnabled}
                      value={productForm.freeGiftQty}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          freeGiftQty: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white font-semibold"
                    />
                  </div>
                  <div className="col-span-2">
                    <div className="flex items-center justify-between mb-1">
                      <label className="block font-semibold text-gray-700">
                        Free Gift Image URL (Optional)
                      </label>
                      <label className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-800 hover:text-emerald-950 cursor-pointer">
                        <UploadCloud size={12} />
                        {uploadingField === "freeGiftImage"
                          ? "Uploading..."
                          : "Upload to Cloudinary"}
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/webp,image/gif,image/avif"
                          className="hidden"
                          disabled={Boolean(uploadingField)}
                          onChange={(e) =>
                            onCloudinaryFileUpload(
                              e.target.files?.[0],
                              "freeGiftImage",
                              "ummo_gifts"
                            )
                          }
                        />
                      </label>
                    </div>
                    <input
                      type="text"
                      placeholder="https://res.cloudinary.com/wxjt7d8q/..."
                      value={productForm.freeGiftImage}
                      onChange={(e) =>
                        setProductForm({
                          ...productForm,
                          freeGiftImage: e.target.value,
                        })
                      }
                      className="w-full border border-gray-300 rounded px-2.5 py-1.5 bg-white"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      setProductForm({
                        ...productForm,
                        freeGiftEnabled: true,
                        freeGiftMinBuyQty: "1",
                        freeGiftQty: "1",
                        freeGiftName: "Signature Executive Pen (কলম)",
                      })
                    }
                    className="px-2 py-1 rounded bg-emerald-700 text-white text-[11px] font-semibold cursor-pointer hover:bg-emerald-800"
                  >
                    Preset: Buy 1 → Get 1 Pen Free
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setProductForm({
                        ...productForm,
                        freeGiftEnabled: true,
                        freeGiftMinBuyQty: "2",
                        freeGiftQty: "1",
                        freeGiftName: productForm.title || "1 Extra Unit",
                        freeGiftImage: productForm.thumbnail || "",
                      })
                    }
                    className="px-2 py-1 rounded bg-white border border-emerald-300 text-emerald-900 text-[11px] font-semibold cursor-pointer hover:bg-emerald-100"
                  >
                    Preset: Buy 2 → Get 1 Same Item Free
                  </button>
                </div>
              </div>
            )}
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block font-semibold text-gray-700">
                Thumbnail Image URL (Hosted on Cloudinary `wxjt7d8q`) *
              </label>
              <label className="inline-flex items-center gap-1.5 bg-gray-900 hover:bg-black text-white px-2.5 py-1 rounded text-[11px] font-bold cursor-pointer">
                <UploadCloud size={12} />
                {uploadingField === "thumbnail"
                  ? "Uploading to Cloudinary..."
                  : "☁️ Upload Image to Cloudinary"}
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
            </div>
            <div className="flex items-center gap-2.5">
              {productForm.thumbnail && (
                <img
                  src={productForm.thumbnail}
                  alt="Preview"
                  className="w-11 h-11 rounded object-contain border border-gray-200 bg-gray-50 shrink-0"
                />
              )}
              <input
                type="text"
                required
                value={productForm.thumbnail}
                onChange={(e) =>
                  setProductForm({
                    ...productForm,
                    thumbnail: e.target.value,
                  })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
            {uploadStatusMsg && (
              <p className="text-[11px] font-semibold text-emerald-700 mt-1">
                {uploadStatusMsg}
              </p>
            )}
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Description
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
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div className="flex justify-end gap-2 pt-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 border border-gray-300 rounded text-gray-700 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-5 py-2 bg-gray-900 text-white font-semibold rounded cursor-pointer"
            >
              Save Product & Timer
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
