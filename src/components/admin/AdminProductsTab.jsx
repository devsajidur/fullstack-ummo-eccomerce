import React, { useMemo, useState } from "react";
import { Clock, Gift, Plus, RotateCcw, Search, Trash2, Zap } from "lucide-react";
import {
  getProductDiscountState,
  pad2,
  useNowTick,
} from "../../utils/discountTimer";
import { uploadImageToCloudinary } from "../../services/cloudinary";
import AdminProductModal from "./AdminProductModal";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function AdminProductsTab({
  products,
  onSaveProduct,
  onDeleteProduct,
  onResetCatalog,
  onApplyBulkFlashSale,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [bulkDiscount, setBulkDiscount] = useState("25");
  const [bulkHours, setBulkHours] = useState("24");
  const [uploadingField, setUploadingField] = useState("");
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");

  const now = useNowTick(true);

  const [productForm, setProductForm] = useState({
    title: "",
    category: "womens-dresses",
    brand: "UOMO",
    price: "",
    discountPercentage: "15",
    discountEndTime: "",
    freeGiftEnabled: false,
    freeGiftMinBuyQty: "1",
    freeGiftName: "",
    freeGiftQty: "1",
    freeGiftImage: "",
    freeGiftProductId: "",
    stock: "25",
    sku: "",
    thumbnail:
      "https://res.cloudinary.com/wxjt7d8q/image/upload/v1/ummo_products/product_1.webp",
    description: "",
  });

  async function handleCloudinaryFileUpload(
    file,
    fieldName,
    folder = "ummo_products"
  ) {
    if (!file) return;
    setUploadingField(fieldName);
    setUploadStatusMsg("Uploading to Cloudinary...");
    try {
      const uploaded = await uploadImageToCloudinary(file, folder);
      const finalUrl =
        typeof uploaded === "string"
          ? uploaded
          : uploaded?.url || uploaded?.secure_url || "";
      if (finalUrl) {
        setProductForm((prev) => ({
          ...prev,
          [fieldName]: finalUrl,
        }));
        setUploadStatusMsg("Uploaded to Cloudinary ✓");
      }
    } catch (err) {
      setUploadStatusMsg(err?.message || "Cloudinary upload failed.");
    } finally {
      setUploadingField("");
    }
  }

  const filteredProducts = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return products;
    return products.filter(
      (p) =>
        p.title?.toLowerCase().includes(q) ||
        p.category?.toLowerCase().includes(q) ||
        p.brand?.toLowerCase().includes(q) ||
        String(p.sku || "").toLowerCase().includes(q)
    );
  }, [products, searchQuery]);

  function applyTimerPresetHours(hours) {
    const targetIso = new Date(
      now + Number(hours) * 3600 * 1000
    ).toISOString();
    setProductForm((prev) => ({
      ...prev,
      discountPercentage:
        Number(prev.discountPercentage) > 0 ? prev.discountPercentage : "20",
      discountEndTime: targetIso,
    }));
  }

  function openAddModal() {
    setEditingProduct(null);
    setUploadStatusMsg("");
    const defaultEnd = new Date(now + 24 * 3600 * 1000).toISOString();
    setProductForm({
      title: "",
      category: "womens-dresses",
      brand: "UOMO",
      price: "",
      discountPercentage: "20",
      discountEndTime: defaultEnd,
      freeGiftEnabled: false,
      freeGiftMinBuyQty: "1",
      freeGiftName: "",
      freeGiftQty: "1",
      freeGiftImage: "",
      freeGiftProductId: "",
      stock: "30",
      sku: `UMMO-${Math.floor(1000 + Math.random() * 9000)}`,
      thumbnail:
        "https://res.cloudinary.com/wxjt7d8q/image/upload/v1/ummo_products/product_1.webp",
      description: "",
    });
    setShowModal(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setUploadStatusMsg("");
    const fg = product.freeGift || {};
    setProductForm({
      title: product.title || "",
      category: product.category || "womens-dresses",
      brand: product.brand || "UOMO",
      price: String(product.price ?? ""),
      discountPercentage: String(product.discountPercentage ?? "0"),
      discountEndTime: product.discountEndTime || "",
      freeGiftEnabled: Boolean(fg.enabled && fg.giftName),
      freeGiftMinBuyQty: String(fg.minBuyQty ?? "1"),
      freeGiftName: fg.giftName || "",
      freeGiftQty: String(fg.giftQty ?? "1"),
      freeGiftImage: fg.giftImage || "",
      freeGiftProductId: fg.giftProductId || "",
      stock: String(product.stock ?? 20),
      sku: product.sku || `UMMO-${product.id}`,
      thumbnail: product.thumbnail || "",
      description: product.description || "",
    });
    setShowModal(true);
  }

  function handleSubmit(e) {
    e.preventDefault();
    onSaveProduct(editingProduct, productForm);
    setShowModal(false);
  }

  return (
    <div className="space-y-6">
      {/* Bulk Flash Sale Timer Campaign Bar */}
      {onApplyBulkFlashSale && (
        <div className="bg-gradient-to-r from-gray-900 to-gray-800 text-white rounded-xl p-5 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <span className="inline-flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-widest text-amber-400">
              <Zap size={13} /> Storewide Flash Sale Campaign Launcher
            </span>
            <h3 className="text-sm sm:text-base font-bold mt-0.5">
              Apply a Live Countdown Discount Timer to Featured Storefront Products
            </h3>
            <p className="text-xs text-gray-300 mt-0.5">
              Instantly activates a ticking countdown timer on Home Page cards, Shop Page, and Single Product details.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2.5 text-xs">
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
              <span className="text-gray-300">Discount:</span>
              <select
                value={bulkDiscount}
                onChange={(e) => setBulkDiscount(e.target.value)}
                className="bg-transparent font-bold text-white outline-none cursor-pointer"
              >
                <option value="15" className="text-black">15% OFF</option>
                <option value="20" className="text-black">20% OFF</option>
                <option value="25" className="text-black">25% OFF</option>
                <option value="35" className="text-black">35% OFF</option>
                <option value="50" className="text-black">50% OFF</option>
              </select>
            </div>
            <div className="flex items-center gap-1.5 bg-white/10 rounded-lg px-3 py-1.5">
              <span className="text-gray-300">Timer:</span>
              <select
                value={bulkHours}
                onChange={(e) => setBulkHours(e.target.value)}
                className="bg-transparent font-bold text-white outline-none cursor-pointer"
              >
                <option value="6" className="text-black">6 Hours</option>
                <option value="12" className="text-black">12 Hours</option>
                <option value="24" className="text-black">24 Hours</option>
                <option value="48" className="text-black">48 Hours (2 Days)</option>
                <option value="72" className="text-black">72 Hours (3 Days)</option>
              </select>
            </div>
            <button
              type="button"
              onClick={() =>
                onApplyBulkFlashSale(Number(bulkDiscount), Number(bulkHours))
              }
              className="inline-flex items-center gap-1.5 bg-amber-400 hover:bg-amber-300 text-gray-900 font-bold uppercase tracking-wider px-4 py-2 rounded-lg cursor-pointer transition-colors"
            >
              <Zap size={14} /> Launch Flash Timer
            </button>
          </div>
        </div>
      )}

      {/* Main Catalog Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h2 className="text-base font-bold text-gray-900">
              Storefront Product Catalog ({filteredProducts.length})
            </h2>
            <p className="text-xs text-gray-500">
              Add, edit, or set a live countdown discount timer on any product.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, category, SKU..."
                className="border border-gray-300 rounded-lg pl-9 pr-3 py-2 text-xs outline-none focus:border-gray-900 w-56"
              />
            </div>
            {onResetCatalog && (
              <button
                type="button"
                onClick={onResetCatalog}
                className="inline-flex items-center gap-1.5 border border-gray-300 text-gray-700 text-xs font-semibold px-3.5 py-2.5 rounded-lg hover:bg-gray-50 cursor-pointer"
              >
                <RotateCcw size={14} />
                Restore Catalog
              </button>
            )}
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2.5 rounded-lg hover:bg-gray-800 cursor-pointer"
            >
              <Plus size={15} />
              Add Product
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] font-bold uppercase text-gray-500">
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Category</th>
                <th className="py-3 pr-4">Price & Discount</th>
                <th className="py-3 pr-4">Countdown Timer</th>
                <th className="py-3 pr-4">Free Gift Offer</th>
                <th className="py-3 pr-4">Stock</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.slice(0, 60).map((product) => {
                const dState = getProductDiscountState(product, now);
                const hasFreeGift =
                  Boolean(product.freeGift?.enabled) &&
                  Boolean(product.freeGift?.giftName);
                return (
                  <tr key={product.id} className="hover:bg-gray-50/70">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={product.thumbnail}
                          alt={product.title}
                          loading="lazy"
                          className="w-11 h-11 rounded object-contain border border-gray-200 bg-white"
                        />
                        <div>
                          <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                            {product.title}
                          </p>
                          <p className="text-[11px] text-gray-400">
                            SKU: {product.sku || `UMMO-${product.id}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 capitalize text-xs text-gray-600">
                      {product.category}
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {currency.format(dState.effectivePrice)}
                        </span>
                        {dState.isDiscountActive && (
                          <>
                            <span className="text-xs text-gray-400 line-through">
                              {currency.format(dState.originalPrice)}
                            </span>
                            <span className="text-[10px] font-bold bg-red-50 text-[#D6001C] px-1.5 py-0.5 rounded">
                              -{dState.discountPercent}%
                            </span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="py-3 pr-4">
                      {dState.hasActiveTimer ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-semibold bg-amber-50 text-amber-800 border border-amber-200 px-2 py-0.5 rounded">
                          <Clock size={12} />
                          {dState.days > 0 ? `${dState.days}d ` : ""}
                          {pad2(dState.hours)}h:{pad2(dState.minutes)}m:
                          {pad2(dState.seconds)}s
                        </span>
                      ) : dState.timerExpired ? (
                        <span className="text-[11px] text-gray-400">
                          Timer Expired
                        </span>
                      ) : (
                        <span className="text-[11px] text-gray-400">
                          No Timer
                        </span>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      {hasFreeGift ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-semibold bg-emerald-50 text-emerald-800 border border-emerald-200 px-2 py-0.5 rounded">
                          <Gift size={12} className="text-emerald-600" />
                          Buy {product.freeGift.minBuyQty || 1} →{" "}
                          {product.freeGift.giftQty || 1}x{" "}
                          {product.freeGift.giftName} FREE
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openEditModal(product)}
                          className="text-[11px] text-gray-500 hover:text-emerald-700 underline cursor-pointer"
                        >
                          + Set Free Gift
                        </button>
                      )}
                    </td>
                    <td className="py-3 pr-4">
                      <span
                        className={`text-xs font-semibold px-2 py-0.5 rounded ${
                          Number(product.stock ?? 20) < 10
                            ? "bg-red-50 text-red-600"
                            : "bg-emerald-50 text-emerald-700"
                        }`}
                      >
                        {product.stock ?? 20} in stock
                      </span>
                    </td>
                    <td className="py-3 text-right space-x-1.5 whitespace-nowrap">
                      <button
                        type="button"
                        onClick={() => openEditModal(product)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-amber-800 bg-amber-50 hover:bg-amber-100 border border-amber-200 px-2.5 py-1 rounded cursor-pointer"
                        title="Set Discount Timer or Free Gift"
                      >
                        <Gift size={12} /> Gift / Timer / Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProduct(product)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 px-2.5 py-1 rounded cursor-pointer"
                      >
                        <Trash2 size={13} /> Delete
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && (
        <AdminProductModal
          editingProduct={editingProduct}
          productForm={productForm}
          setProductForm={setProductForm}
          products={products}
          uploadingField={uploadingField}
          uploadStatusMsg={uploadStatusMsg}
          onCloudinaryFileUpload={handleCloudinaryFileUpload}
          onApplyTimerPresetHours={applyTimerPresetHours}
          onSubmit={handleSubmit}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
