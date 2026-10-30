import React, { useMemo, useState } from "react";
import {
  AlertTriangle,
  Archive,
  CheckCircle2,
  Eye,
  EyeOff,
  Package,
  Plus,
  Search,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "../layout/common/Image";
import { classifyProductTaxonomy } from "../../utils/categoryTaxonomy";

export default function AdminInventoryTab({ products = [], onUpdateProduct }) {
  const [filterMode, setFilterMode] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [customStockEdits, setCustomStockEdits] = useState({});

  const stats = useMemo(() => {
    let inStock = 0;
    let lowStock = 0;
    let outOfStock = 0;
    let hiddenOrDraft = 0;
    products.forEach((p) => {
      const st = Number(p.stock ?? 0);
      if (p.isVisible === false || p.status === "draft") {
        hiddenOrDraft += 1;
      }
      if (st <= 0) {
        outOfStock += 1;
      } else if (st < 10) {
        lowStock += 1;
      } else {
        inStock += 1;
      }
    });
    return {
      total: products.length,
      inStock,
      lowStock,
      outOfStock,
      hiddenOrDraft,
    };
  }, [products]);

  const filteredProducts = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return products.filter((p) => {
      const st = Number(p.stock ?? 0);
      if (filterMode === "low" && (st <= 0 || st >= 10)) return false;
      if (filterMode === "out" && st > 0) return false;
      if (filterMode === "in" && st < 10) return false;
      if (
        filterMode === "hidden" &&
        p.isVisible !== false &&
        p.status !== "draft"
      ) {
        return false;
      }
      if (q) {
        const text = `${p.title || ""} ${p.sku || ""} ${
          p.category || ""
        }`.toLowerCase();
        if (!text.includes(q)) return false;
      }
      return true;
    });
  }, [products, filterMode, searchQuery]);

  const handleAdjustStock = (product, nextStock) => {
    const clamped = Math.max(0, Math.round(Number(nextStock) || 0));
    if (typeof onUpdateProduct === "function") {
      onUpdateProduct({
        ...product,
        stock: clamped,
      });
    }
    toast.success(`Updated stock for "${product.title}" to ${clamped} units`);
  };

  const handleToggleVisibility = (product) => {
    const currentlyVisible =
      product.isVisible !== false && product.status !== "draft";
    const nextVisible = !currentlyVisible;
    if (typeof onUpdateProduct === "function") {
      onUpdateProduct({
        ...product,
        isVisible: nextVisible,
        status: nextVisible ? "active" : "draft",
      });
    }
    toast.success(
      nextVisible
        ? `"${product.title}" is now visible on the storefront`
        : `"${product.title}" moved to Draft / Hidden`
    );
  };

  return (
    <div className="space-y-6">
      {/* Stock Summary Filter Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          {
            id: "all",
            label: "Total SKUs",
            count: stats.total,
            color: "border-gray-900 text-gray-900",
          },
          {
            id: "in",
            label: "Healthy Stock (10+)",
            count: stats.inStock,
            color: "border-emerald-500 text-emerald-700",
          },
          {
            id: "low",
            label: "Low Stock (<10)",
            count: stats.lowStock,
            color: "border-amber-500 text-amber-700",
          },
          {
            id: "out",
            label: "Out of Stock (0)",
            count: stats.outOfStock,
            color: "border-red-500 text-red-700",
          },
          {
            id: "hidden",
            label: "Draft / Hidden",
            count: stats.hiddenOrDraft,
            color: "border-purple-500 text-purple-700",
          },
        ].map((card) => (
          <button
            key={card.id}
            type="button"
            onClick={() => setFilterMode(card.id)}
            className={`text-left bg-white border border-l-4 ${
              card.color
            } rounded-xl p-3.5 shadow-xs transition-all cursor-pointer ${
              filterMode === card.id ? "ring-2 ring-gray-900" : "border-gray-200"
            }`}
          >
            <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 block">
              {card.label}
            </span>
            <span className="text-xl font-extrabold mt-1 block">
              {card.count}
            </span>
          </button>
        ))}
      </div>

      {/* Search & Inventory List */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div className="relative flex-1 min-w-[200px] max-w-md">
            <Search
              size={15}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search SKU, product title, or category..."
              className="w-full h-10 pl-9 pr-3 border border-gray-300 rounded-lg text-xs outline-none focus:border-gray-900"
            />
          </div>
          <span className="text-xs font-semibold text-gray-500">
            Showing <strong>{filteredProducts.length}</strong> inventory items
          </span>
        </div>

        <div className="divide-y divide-gray-100 max-h-[580px] overflow-y-auto">
          {filteredProducts.slice(0, 80).map((product) => {
            const stock = Number(product.stock ?? 0);
            const isVisible =
              product.isVisible !== false && product.status !== "draft";
            const tax = classifyProductTaxonomy(product);
            const editVal =
              customStockEdits[product.id] !== undefined
                ? customStockEdits[product.id]
                : stock;

            return (
              <div
                key={product.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Image
                    item={product}
                    src={product.thumbnail}
                    alt={product.title}
                    width={48}
                    height={48}
                    className="w-12 h-12 rounded-lg object-contain bg-gray-50 border border-gray-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-xs sm:text-sm font-bold text-gray-900 truncate">
                        {product.title}
                      </p>
                      <span className="text-[10px] font-mono bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                        {product.sku || `SKU-${product.id}`}
                      </span>
                      {stock <= 0 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                          <Archive size={10} />
                          Out of Stock
                        </span>
                      ) : stock < 10 ? (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                          <AlertTriangle size={10} />
                          Low Stock ({stock})
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
                          <CheckCircle2 size={10} />
                          In Stock ({stock})
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-gray-500 mt-0.5">
                      {tax.departmentName} → {tax.subcategory} • Price: $
                      {Number(product.price || 0).toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Mobile-Friendly Quick Stock Adjustment Controls */}
                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <div className="flex items-center border border-gray-300 rounded-lg overflow-hidden bg-white">
                    <input
                      type="number"
                      min="0"
                      aria-label={`Stock quantity for ${product.title}`}
                      value={editVal}
                      onChange={(e) =>
                        setCustomStockEdits((prev) => ({
                          ...prev,
                          [product.id]: e.target.value,
                        }))
                      }
                      className="w-16 h-9 px-2 text-xs font-bold text-center outline-none"
                    />
                    <button
                      type="button"
                      onClick={() => handleAdjustStock(product, editVal)}
                      className="h-9 px-2.5 bg-gray-900 text-white text-[11px] font-bold uppercase cursor-pointer"
                    >
                      Set
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleAdjustStock(product, stock + 10)}
                    className="h-9 px-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus size={12} />
                    10
                  </button>

                  <button
                    type="button"
                    onClick={() => handleAdjustStock(product, stock + 50)}
                    className="h-9 px-2.5 rounded-lg border border-gray-200 bg-gray-50 hover:bg-gray-100 text-xs font-bold text-gray-700 inline-flex items-center gap-0.5 cursor-pointer"
                  >
                    <Plus size={12} />
                    50
                  </button>

                  <button
                    type="button"
                    onClick={() => handleToggleVisibility(product)}
                    className={`h-9 px-3 rounded-lg text-xs font-bold inline-flex items-center gap-1 cursor-pointer ${
                      isVisible
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
                        : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {isVisible ? <Eye size={13} /> : <EyeOff size={13} />}
                    <span>{isVisible ? "Active" : "Draft"}</span>
                  </button>
                </div>
              </div>
            );
          })}

          {filteredProducts.length === 0 && (
            <div className="py-12 text-center text-gray-500 text-xs">
              <Package size={32} className="mx-auto text-gray-300 mb-2" />
              No inventory items match the selected filter.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
