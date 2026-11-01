import React from "react";
import { Check, Ruler } from "lucide-react";

function isLightHex(hex) {
  const clean = String(hex || "").replace("#", "");
  if (clean.length !== 6) return false;
  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);
  return (r * 299 + g * 587 + b * 114) / 1000 > 205;
}

export default function ProductVariantPicker({
  variantInfo,
  selectedSize,
  setSelectedSize,
  selectedColor,
  setSelectedColor,
  onOpenSizeGuide,
}) {
  return (
    <>
      {variantInfo.sizes.length > 0 && (
        <div className="mt-5" data-testid="product-size-selector">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-gray">
              {variantInfo.sizeLabel}:{" "}
              <strong className="text-primary">{selectedSize}</strong>
            </span>
            {variantInfo.showSizeGuide && (
              <button
                type="button"
                onClick={onOpenSizeGuide}
                className="inline-flex items-center gap-1 text-xs font-semibold text-primary underline hover:text-gray cursor-pointer"
              >
                <Ruler size={13} />
                Size Guide
              </button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {variantInfo.sizes.map((sz) => {
              const active = selectedSize === sz;
              return (
                <button
                  key={sz}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedSize(sz)}
                  className={`min-w-11 h-10 px-3 text-xs font-semibold border rounded-sm cursor-pointer transition-all ${
                    active
                      ? "border-primary bg-primary text-white shadow-xs"
                      : "border-gray-300 bg-white text-primary hover:border-primary"
                  }`}
                >
                  {sz}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {variantInfo.colors.length > 0 && (
        <div className="mt-4" data-testid="product-color-selector">
          <span className="text-xs font-semibold uppercase tracking-wider text-gray block mb-2">
            {variantInfo.colorLabel}:{" "}
            <strong className="text-primary">{selectedColor}</strong>
          </span>
          <div className="flex flex-wrap items-center gap-2.5">
            {variantInfo.colors.map((col) => {
              const active = selectedColor === col.name;
              const light = isLightHex(col.hex);
              return (
                <button
                  key={col.name}
                  type="button"
                  aria-pressed={active}
                  aria-label={`Select ${variantInfo.colorLabel.toLowerCase()} ${col.name}`}
                  onClick={() => setSelectedColor(col.name)}
                  className={`inline-flex items-center gap-2 pl-1.5 pr-3 py-1.5 rounded-full border text-xs font-medium cursor-pointer transition-all ${
                    active
                      ? "border-primary bg-gray-900 text-white shadow-xs"
                      : "border-gray-200 bg-gray-50 text-gray-800 hover:border-gray-400"
                  }`}
                >
                  <span
                    style={{ backgroundColor: col.hex }}
                    className={`w-5 h-5 rounded-full flex items-center justify-center shrink-0 ${
                      light
                        ? "border border-gray-300"
                        : "border border-black/15"
                    }`}
                  >
                    {active && (
                      <Check
                        size={11}
                        className={light ? "text-gray-900" : "text-white"}
                      />
                    )}
                  </span>
                  <span>{col.name}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </>
  );
}
