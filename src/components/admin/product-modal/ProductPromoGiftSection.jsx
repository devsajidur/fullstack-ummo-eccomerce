import React from "react";
import { Clock, Gift } from "lucide-react";

function toLocalDatetimeInputValue(isoString) {
  if (!isoString || isoString === "none") return "";
  const d = new Date(isoString);
  if (Number.isNaN(d.getTime())) return "";
  const tzOffsetMs = d.getTimezoneOffset() * 60000;
  return new Date(d.getTime() - tzOffsetMs).toISOString().slice(0, 16);
}

export default function ProductPromoGiftSection({
  productForm,
  setProductForm,
  products,
  onApplyTimerPresetHours,
}) {
  return (
    <>
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
            <span className="font-bold text-emerald-800">Enable Free Gift</span>
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
    </>
  );
}
