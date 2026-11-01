import React, { useState } from "react";
import { Palette, Plus, Ruler, X } from "lucide-react";
import {
  COLOR_PALETTE_PRESETS,
  SIZE_PRESET_GROUPS,
  getCategoryDefaultVariants,
  normalizeColorList,
  normalizeColorOption,
  normalizeSizeList,
} from "../../../utils/productVariants";

const QUICK_PALETTE = COLOR_PALETTE_PRESETS.slice(0, 16);

export default function ProductVariantSection({ productForm, setProductForm }) {
  const [customSizeDraft, setCustomSizeDraft] = useState("");
  const [customColorName, setCustomColorName] = useState("");
  const [customColorHex, setCustomColorHex] = useState("#1F2937");

  const activeSizes = normalizeSizeList(
    Array.isArray(productForm.sizes) ? productForm.sizes : []
  );
  const activeColors = normalizeColorList(
    Array.isArray(productForm.colors) ? productForm.colors : []
  );

  const handleAddCustomSizes = () => {
    const tokens = customSizeDraft
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    if (!tokens.length) return;
    setProductForm({
      ...productForm,
      sizes: normalizeSizeList([...activeSizes, ...tokens]),
      variantsTouched: true,
    });
    setCustomSizeDraft("");
  };

  const handleRemoveSize = (targetSize) => {
    setProductForm({
      ...productForm,
      sizes: activeSizes.filter((s) => s !== targetSize),
      variantsTouched: true,
    });
  };

  const handleApplySizePreset = (presetSizes) => {
    setProductForm({
      ...productForm,
      sizes: [...presetSizes],
      variantsTouched: true,
    });
  };

  const handleTogglePaletteColor = (preset) => {
    const exists = activeColors.some(
      (c) => c.name.toLowerCase() === preset.name.toLowerCase()
    );
    const next = exists
      ? activeColors.filter(
          (c) => c.name.toLowerCase() !== preset.name.toLowerCase()
        )
      : [...activeColors, { name: preset.name, hex: preset.hex }];
    setProductForm({
      ...productForm,
      colors: next,
      variantsTouched: true,
    });
  };

  const handleAddCustomColor = () => {
    const cleanName = customColorName.trim();
    if (!cleanName) return;
    const norm = normalizeColorOption({ name: cleanName, hex: customColorHex });
    if (!norm) return;
    const withoutDup = activeColors.filter(
      (c) => c.name.toLowerCase() !== norm.name.toLowerCase()
    );
    setProductForm({
      ...productForm,
      colors: [...withoutDup, norm],
      variantsTouched: true,
    });
    setCustomColorName("");
  };

  const handleRemoveColor = (colorName) => {
    setProductForm({
      ...productForm,
      colors: activeColors.filter((c) => c.name !== colorName),
      variantsTouched: true,
    });
  };

  return (
    <div className="p-3.5 rounded-xl bg-gray-50 border border-gray-200 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-gray-200">
        <span className="font-extrabold uppercase tracking-wider text-gray-900 flex items-center gap-1.5">
          <Ruler size={14} /> Product Sizes &amp; Color Variants
        </span>
        <button
          type="button"
          onClick={() => {
            const smart = getCategoryDefaultVariants({
              department: productForm.department,
              subcategory: productForm.subcategory,
              category: productForm.category,
              title: productForm.title,
            });
            setProductForm({
              ...productForm,
              sizes: smart.sizes,
              colors: smart.colors,
              variantsTouched: true,
            });
          }}
          className="px-2.5 py-1 rounded-md bg-white border border-gray-300 text-[11px] font-bold text-gray-700 hover:bg-gray-100 cursor-pointer"
        >
          Auto-Match Category Defaults
        </button>
      </div>

      {/* 1. Size Chips & Presets */}
      <div className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <label className="font-bold uppercase tracking-wider text-gray-700">
            Available Sizes ({activeSizes.length})
          </label>
          <div className="flex flex-wrap gap-1">
            {SIZE_PRESET_GROUPS.map((grp) => (
              <button
                key={grp.id}
                type="button"
                onClick={() => handleApplySizePreset(grp.sizes)}
                className={`px-2 py-1 rounded text-[10px] font-bold border cursor-pointer transition-colors ${
                  grp.id === "none"
                    ? "border-red-200 bg-red-50 text-red-700 hover:bg-red-100"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-900"
                }`}
              >
                {grp.label}
              </button>
            ))}
          </div>
        </div>

        {activeSizes.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {activeSizes.map((sz) => (
              <span
                key={sz}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-gray-900 text-white text-[11px] font-bold"
              >
                {sz}
                <button
                  type="button"
                  aria-label={`Remove size ${sz}`}
                  onClick={() => handleRemoveSize(sz)}
                  className="text-gray-300 hover:text-white cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 italic">
            No size options enabled — single-product page will hide the Size
            selector (ideal for groceries, bags, accessories, etc.).
          </p>
        )}

        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Add size (e.g. XXL, EU 42, 100ml, 256GB)..."
            value={customSizeDraft}
            onChange={(e) => setCustomSizeDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomSizes();
              }
            }}
            className="flex-1 h-9 border border-gray-300 rounded-lg px-2.5 bg-white"
          />
          <button
            type="button"
            onClick={handleAddCustomSizes}
            className="h-9 px-3 rounded-lg bg-gray-900 text-white font-bold inline-flex items-center gap-1 cursor-pointer"
          >
            <Plus size={13} /> Add Size
          </button>
        </div>
      </div>

      {/* 2. Color Swatches & Custom Color Picker */}
      <div className="space-y-2 pt-2 border-t border-gray-200">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <label className="font-bold uppercase tracking-wider text-gray-700 flex items-center gap-1">
            <Palette size={13} /> Available Colors / Shades (
            {activeColors.length})
          </label>
          <button
            type="button"
            onClick={() =>
              setProductForm({
                ...productForm,
                colors: [],
                variantsTouched: true,
              })
            }
            className="px-2 py-1 rounded text-[10px] font-bold border border-red-200 bg-red-50 text-red-700 hover:bg-red-100 cursor-pointer"
          >
            No Colors
          </button>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {QUICK_PALETTE.map((preset) => {
            const selected = activeColors.some(
              (c) => c.name.toLowerCase() === preset.name.toLowerCase()
            );
            return (
              <button
                key={preset.name}
                type="button"
                onClick={() => handleTogglePaletteColor(preset)}
                title={`Toggle ${preset.name}`}
                className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full border text-[10px] font-semibold cursor-pointer transition-all ${
                  selected
                    ? "border-gray-900 bg-gray-900 text-white"
                    : "border-gray-300 bg-white text-gray-700 hover:border-gray-500"
                }`}
              >
                <span
                  style={{ backgroundColor: preset.hex }}
                  className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                />
                <span>{preset.name}</span>
              </button>
            );
          })}
        </div>

        {activeColors.length > 0 ? (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {activeColors.map((col) => (
              <span
                key={col.name}
                className="inline-flex items-center gap-1.5 pl-1.5 pr-2 py-1 rounded-full bg-white border border-gray-900 text-gray-900 text-[11px] font-bold shadow-2xs"
              >
                <span
                  style={{ backgroundColor: col.hex }}
                  className="w-4 h-4 rounded-full border border-black/20 shrink-0"
                />
                <span>{col.name}</span>
                <button
                  type="button"
                  aria-label={`Remove color ${col.name}`}
                  onClick={() => handleRemoveColor(col.name)}
                  className="text-gray-400 hover:text-red-600 cursor-pointer"
                >
                  <X size={12} />
                </button>
              </span>
            ))}
          </div>
        ) : (
          <p className="text-[11px] text-gray-500 italic">
            No color swatches enabled — single-product page will hide the Color
            selector.
          </p>
        )}

        <div className="flex items-center gap-2 pt-1">
          <input
            type="color"
            aria-label="Pick custom color hex"
            value={customColorHex}
            onChange={(e) => setCustomColorHex(e.target.value)}
            className="w-10 h-9 p-0.5 border border-gray-300 rounded-lg bg-white cursor-pointer shrink-0"
          />
          <input
            type="text"
            placeholder="Custom color name (e.g. Champagne, Midnight Blue)..."
            value={customColorName}
            onChange={(e) => setCustomColorName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                handleAddCustomColor();
              }
            }}
            className="flex-1 h-9 border border-gray-300 rounded-lg px-2.5 bg-white"
          />
          <button
            type="button"
            onClick={handleAddCustomColor}
            className="h-9 px-3 rounded-lg bg-gray-900 text-white font-bold inline-flex items-center gap-1 cursor-pointer shrink-0"
          >
            <Plus size={13} /> Add Color
          </button>
        </div>
      </div>

      {/* Storefront Visibility & Featured Flags */}
      <div className="flex flex-wrap items-center gap-5 pt-2 border-t border-gray-200">
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
  );
}
