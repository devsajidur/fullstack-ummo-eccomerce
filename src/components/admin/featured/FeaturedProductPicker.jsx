import React, { useMemo, useState } from "react";
import { Check, Search, Trash2 } from "lucide-react";
import { getAllDepartments } from "../../../utils/categoryTaxonomy";

export default function FeaturedProductPicker({
  products,
  selectedProducts,
  selectedIdSet,
  ctaText,
  campaignDiscount,
  onToggleProduct,
  onClearSelection,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const departments = useMemo(() => getAllDepartments(), []);

  const filteredCatalog = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      if (p.isVisible === false) return false;
      if (
        deptFilter !== "all" &&
        String(p.department || "").toLowerCase() !== deptFilter
      ) {
        return false;
      }
      if (!q) return true;
      return (
        String(p.title || "").toLowerCase().includes(q) ||
        String(p.brand || "").toLowerCase().includes(q) ||
        String(p.sku || "").toLowerCase().includes(q) ||
        String(p.id || "").toLowerCase() === q
      );
    });
  }, [products, deptFilter, searchQuery]);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-4 sm:p-6 shadow-xs space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3">
        <div>
          <h3 className="text-sm font-bold text-gray-900 uppercase tracking-wider">
            3. Curated Featured Products ({selectedProducts.length} Selected)
          </h3>
          <p className="text-xs text-gray-500 mt-0.5">
            Select the exact products customers will see when they click &ldquo;
            {ctaText || "SHOP NOW"}&rdquo; on the Featured Collection banner.
          </p>
        </div>
        {selectedProducts.length > 0 && (
          <button
            type="button"
            onClick={onClearSelection}
            className="inline-flex items-center gap-1 text-xs font-semibold text-red-600 hover:underline cursor-pointer"
          >
            <Trash2 size={13} /> Clear Selection
          </button>
        )}
      </div>

      {selectedProducts.length > 0 && (
        <div className="flex flex-wrap gap-2 bg-gray-50 p-3 rounded-xl border border-gray-200">
          {selectedProducts.map((item) => (
            <span
              key={item.id}
              className="inline-flex items-center gap-2 bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 text-xs font-medium text-gray-800 shadow-2xs"
            >
              <img
                src={item.thumbnail}
                alt={item.title}
                className="w-5 h-5 rounded object-cover"
              />
              <span className="max-w-[160px] truncate">{item.title}</span>
              <button
                type="button"
                aria-label={`Remove ${item.title}`}
                onClick={() => onToggleProduct(item.id)}
                className="text-gray-400 hover:text-red-600 font-bold cursor-pointer"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
          />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search products by title, brand, SKU, or ID..."
            className="w-full border border-gray-300 rounded-xl pl-9 pr-3.5 py-2.5 text-xs sm:text-sm"
          />
        </div>
        <select
          value={deptFilter}
          onChange={(e) => setDeptFilter(e.target.value)}
          className="border border-gray-300 rounded-xl px-3.5 py-2.5 text-xs sm:text-sm bg-white"
        >
          <option value="all">All Departments</option>
          {departments.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.label}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 max-h-[460px] overflow-y-auto pr-1">
        {filteredCatalog.slice(0, 60).map((item) => {
          const isSelected = selectedIdSet.has(String(item.id));
          const regPrice = Number(item.price || 0);
          const effectivePct = Math.max(
            Number(item.discountPercentage || 0),
            isSelected ? campaignDiscount : 0
          );
          const salePrice =
            effectivePct > 0
              ? (regPrice * (1 - effectivePct / 100)).toFixed(2)
              : regPrice.toFixed(2);

          return (
            <button
              key={item.id}
              type="button"
              data-testid={`featured-pick-${item.id}`}
              onClick={() => onToggleProduct(item.id)}
              className={`flex items-center gap-3 p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                isSelected
                  ? "border-gray-900 bg-gray-900/5 ring-1 ring-gray-900"
                  : "border-gray-200 hover:border-gray-300 bg-white"
              }`}
            >
              <img
                src={item.thumbnail}
                alt={item.title}
                loading="lazy"
                className="w-12 h-12 rounded-lg object-cover bg-gray-100 shrink-0"
              />
              <div className="min-w-0 flex-1">
                <p className="text-xs font-bold text-gray-900 truncate">
                  {item.title}
                </p>
                <p className="text-[11px] text-gray-500 capitalize truncate">
                  {item.department} • #{item.id}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span className="text-xs font-bold text-gray-900">
                    ${salePrice}
                  </span>
                  {effectivePct > 0 && (
                    <span className="text-[10px] line-through text-gray-400">
                      ${regPrice.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
              <div
                className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 border ${
                  isSelected
                    ? "bg-gray-900 border-gray-900 text-white"
                    : "border-gray-300 bg-white"
                }`}
              >
                {isSelected && <Check size={12} />}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
