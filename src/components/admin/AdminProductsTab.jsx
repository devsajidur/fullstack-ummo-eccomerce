import React, { useState } from "react";
import { Clock, Edit3, Gift, Plus, Search, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import Image from "../layout/common/Image";
import { uploadImageToCloudinary } from "../../services/cloudinary";
import {
  getProductDiscountState,
  pad2,
  useNowTick,
} from "../../utils/discountTimer";
import { classifyProductTaxonomy } from "../../utils/categoryTaxonomy";
import AdminProductModal from "./AdminProductModal";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const EMPTY_PRODUCT_FORM = {
  title: "",
  sku: "",
  department: "women",
  subcategory: "Clothing",
  category: "womens-dresses",
  brand: "UOMO Studio",
  price: "",
  discountPercentage: "0",
  discountEndTime: "",
  stock: "25",
  thumbnail: "",
  images: [],
  sizesInput: "XS, S, M, L, XL",
  colorsInput: "Black, White, Navy",
  isVisible: true,
  isFeatured: false,
  status: "active",
  description: "",
  freeGiftEnabled: false,
  freeGiftMinBuyQty: "1",
  freeGiftQty: "1",
  freeGiftName: "",
  freeGiftImage: "",
  freeGiftProductId: "",
};

export default function AdminProductsTab({
  products,
  onSaveProduct,
  onDeleteProduct,
}) {
  const [productSearch, setProductSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState(EMPTY_PRODUCT_FORM);
  const [uploadingField, setUploadingField] = useState("");
  const [uploadStatusMsg, setUploadStatusMsg] = useState("");

  const hasAnyActiveTimer = products.some((p) =>
    Boolean(p?.discountEndTime && p.discountEndTime !== "none")
  );
  const now = useNowTick(hasAnyActiveTimer || showModal);

  const filteredProducts = products.filter((p) => {
    const tax = classifyProductTaxonomy(p);
    if (deptFilter !== "all" && tax.department !== deptFilter) {
      return false;
    }
    const q = productSearch.toLowerCase().trim();
    if (!q) return true;
    return (
      p.title?.toLowerCase().includes(q) ||
      p.category?.toLowerCase().includes(q) ||
      p.sku?.toLowerCase().includes(q) ||
      tax.departmentName?.toLowerCase().includes(q) ||
      String(p.id).includes(q)
    );
  });

  function openAddModal() {
    setEditingProduct(null);
    setProductForm(EMPTY_PRODUCT_FORM);
    setUploadStatusMsg("");
    setShowModal(true);
  }

  function openEditModal(product) {
    const fg = product.freeGift || {};
    const tax = classifyProductTaxonomy(product);
    setEditingProduct(product);
    setProductForm({
      title: product.title || "",
      sku: product.sku || `UMMO-${product.id}`,
      department: product.department || tax.department || "women",
      subcategory: product.subcategory || tax.subcategory || "Clothing",
      category: product.category || "fashion",
      brand: product.brand || "UOMO Studio",
      price: String(product.price || ""),
      discountPercentage: String(
        Math.round(Number(product.discountPercentage || 0))
      ),
      discountEndTime:
        product.discountEndTime && product.discountEndTime !== "none"
          ? product.discountEndTime
          : "",
      stock: String(product.stock ?? 25),
      thumbnail: product.thumbnail || "",
      images:
        Array.isArray(product.images) && product.images.length
          ? product.images
          : product.thumbnail
            ? [product.thumbnail]
            : [],
      sizesInput: Array.isArray(product.sizes)
        ? product.sizes.join(", ")
        : "XS, S, M, L, XL",
      colorsInput: Array.isArray(product.colors)
        ? product.colors.join(", ")
        : "Black, White, Navy",
      isVisible: product.isVisible !== false && product.status !== "draft",
      isFeatured: Boolean(product.isFeatured),
      status: product.status || "active",
      description: product.description || "",
      freeGiftEnabled: Boolean(fg.enabled),
      freeGiftMinBuyQty: String(fg.minBuyQty || 1),
      freeGiftQty: String(fg.giftQty || 1),
      freeGiftName: fg.giftName || "",
      freeGiftImage: fg.giftImage || "",
      freeGiftProductId: fg.giftProductId ? String(fg.giftProductId) : "",
    });
    setUploadStatusMsg("");
    setShowModal(true);
  }

  async function handleCloudinaryFileUpload(
    file,
    targetField = "thumbnail",
    folder = "ummo_products"
  ) {
    if (!file) return;
    setUploadingField(targetField);
    setUploadStatusMsg("Uploading image to Cloudinary (`wxjt7d8q`)...");
    try {
      const customId =
        editingProduct?.id && targetField === "thumbnail"
          ? `product_${editingProduct.id}`
          : "";
      const uploaded = await uploadImageToCloudinary(file, folder, customId);
      const uploadedUrl = uploaded?.url || String(uploaded || "");
      setProductForm((prev) => {
        if (targetField === "galleryImage") {
          const nextImages = Array.from(
            new Set([...(prev.images || []), uploadedUrl])
          );
          return {
            ...prev,
            thumbnail: prev.thumbnail || uploadedUrl,
            images: nextImages,
          };
        }
        if (targetField === "thumbnail") {
          const nextImages = Array.from(
            new Set([uploadedUrl, ...(prev.images || [])])
          );
          return {
            ...prev,
            thumbnail: uploadedUrl,
            images: nextImages,
          };
        }
        return {
          ...prev,
          [targetField]: uploadedUrl,
        };
      });
      setUploadStatusMsg("✅ Uploaded to Cloudinary!");
      toast.success("Image uploaded to Cloudinary!");
    } catch (err) {
      setUploadStatusMsg("");
      toast.error(err.message || "Cloudinary upload failed");
    } finally {
      setUploadingField("");
    }
  }

  function applyTimerPresetHours(hours) {
    const targetIso = new Date(Date.now() + hours * 3600 * 1000).toISOString();
    setProductForm((prev) => ({
      ...prev,
      discountPercentage:
        Number(prev.discountPercentage || 0) < 5
          ? "20"
          : prev.discountPercentage,
      discountEndTime: targetIso,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();
    if (!productForm.title.trim() || !productForm.price) {
      toast.error("Product title and price are required");
      return;
    }

    const freeGiftConfig = productForm.freeGiftEnabled
      ? {
          enabled: true,
          minBuyQty: Math.max(1, Number(productForm.freeGiftMinBuyQty) || 1),
          giftQty: Math.max(1, Number(productForm.freeGiftQty) || 1),
          giftName:
            productForm.freeGiftName.trim() ||
            `1x ${productForm.title.trim()} Free Gift`,
          giftImage:
            productForm.freeGiftImage.trim() ||
            productForm.thumbnail.trim() ||
            "",
          giftProductId: productForm.freeGiftProductId || "",
        }
      : { enabled: false };

    const primaryThumb =
      productForm.thumbnail.trim() ||
      productForm.images?.[0] ||
      "https://res.cloudinary.com/wxjt7d8q/image/upload/f_auto,q_auto,w_280,c_limit/ummo_products/product_1";

    const galleryList = Array.from(
      new Set([
        primaryThumb,
        ...(Array.isArray(productForm.images) ? productForm.images : []),
      ])
    ).filter(Boolean);

    const payload = {
      id: editingProduct ? editingProduct.id : Date.now(),
      isCustomNew: editingProduct ? editingProduct.isCustomNew : true,
      title: productForm.title.trim(),
      sku:
        (productForm.sku || "").trim() ||
        `UMMO-${editingProduct ? editingProduct.id : Date.now()}`,
      department: productForm.department || "women",
      subcategory: productForm.subcategory || "Clothing",
      category: productForm.category.trim().toLowerCase() || "fashion",
      brand: productForm.brand.trim() || "UOMO Studio",
      price: Number(productForm.price),
      discountPercentage: Number(productForm.discountPercentage || 0),
      discountEndTime: productForm.discountEndTime || "none",
      stock: Number(productForm.stock || 0),
      rating: editingProduct?.rating || 4.8,
      thumbnail: primaryThumb,
      images: galleryList,
      sizes: String(productForm.sizesInput || "XS, S, M, L, XL")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean),
      colors: String(productForm.colorsInput || "Black, White")
        .split(",")
        .map((c) => c.trim())
        .filter(Boolean),
      isVisible: productForm.isVisible !== false,
      isFeatured: Boolean(productForm.isFeatured),
      status: productForm.isVisible !== false ? "active" : "draft",
      description:
        productForm.description.trim() ||
        "Crafted with premium materials for modern everyday luxury.",
      freeGift: freeGiftConfig,
    };

    onSaveProduct(payload, Boolean(editingProduct));
    setShowModal(false);
  }

  return (
    <>
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs space-y-5">
        {/* Top Controls: Search, Department Filter, Add New Product */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1">
            <div className="relative flex-1 min-w-[180px] max-w-sm">
              <Search
                size={15}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              />
              <input
                type="search"
                placeholder="Search products, SKU, or department..."
                value={productSearch}
                onChange={(e) => setProductSearch(e.target.value)}
                className="w-full h-10 border border-gray-300 rounded-lg pl-9 pr-3 text-xs outline-none focus:border-gray-900"
              />
            </div>

            <select
              aria-label="Filter products by department"
              value={deptFilter}
              onChange={(e) => setDeptFilter(e.target.value)}
              className="h-10 px-3 rounded-lg border border-gray-300 bg-white text-xs font-bold text-gray-800 cursor-pointer"
            >
              <option value="all">All Departments ({products.length})</option>
              <option value="men">Men</option>
              <option value="women">Women</option>
              <option value="kids">Kids</option>
              <option value="beauty">Beauty & Care</option>
              <option value="fragrances">Fragrances</option>
              <option value="electronics">Electronics</option>
              <option value="home-living">Home & Living</option>
              <option value="sports">Sports</option>
              <option value="groceries">Groceries</option>
            </select>
          </div>

          <button
            type="button"
            onClick={openAddModal}
            className="inline-flex items-center justify-center gap-1.5 bg-gray-900 hover:bg-black text-white text-xs font-bold uppercase tracking-wider px-4 min-h-[42px] rounded-lg cursor-pointer shrink-0"
          >
            <Plus size={15} /> Add New Product
          </button>
        </div>

        {/* Mobile Product Cards (< 768px) */}
        <div className="md:hidden space-y-3">
          {filteredProducts.slice(0, 40).map((product) => {
            const dState = getProductDiscountState(product, now);
            const tax = classifyProductTaxonomy(product);
            const isVisible =
              product.isVisible !== false && product.status !== "draft";

            return (
              <div
                key={`mob-prod-${product.id}`}
                className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/50 space-y-3"
              >
                <div className="flex items-start gap-3">
                  <Image
                    product={product}
                    alt={product.title}
                    width={56}
                    height={56}
                    className="w-14 h-14 rounded-lg object-contain border border-gray-200 bg-white shrink-0"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase bg-gray-900 text-white px-2 py-0.5 rounded">
                        {tax.departmentName}
                      </span>
                      <span className="text-[10px] font-semibold bg-gray-200 text-gray-700 px-2 py-0.5 rounded">
                        {tax.subcategory}
                      </span>
                      {!isVisible && (
                        <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded">
                          DRAFT
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-bold text-gray-900 mt-1 truncate">
                      {product.title}
                    </h4>
                    <p className="text-[11px] text-gray-500 font-mono">
                      SKU: {product.sku || `UMMO-${product.id}`}
                    </p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2 border-t border-gray-200 text-xs">
                  <div className="flex items-baseline gap-2">
                    <span className="font-extrabold text-gray-900 text-sm">
                      {currency.format(dState.effectivePrice)}
                    </span>
                    {dState.isDiscountActive && (
                      <>
                        <span className="text-gray-400 line-through">
                          {currency.format(dState.regularPrice)}
                        </span>
                        <span className="text-[10px] font-bold bg-red-50 text-[#C32929] px-1.5 py-0.5 rounded">
                          -{dState.discountPercentage}%
                        </span>
                      </>
                    )}
                  </div>
                  <span
                    className={`text-[11px] font-bold px-2 py-0.5 rounded ${
                      Number(product.stock ?? 20) < 10
                        ? "bg-red-50 text-red-600"
                        : "bg-emerald-50 text-emerald-700"
                    }`}
                  >
                    Stock: {product.stock ?? 20}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(product)}
                    className="min-h-[38px] rounded-lg bg-white border border-gray-300 text-gray-900 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Edit3 size={13} />
                    Edit Product
                  </button>
                  <button
                    type="button"
                    onClick={() => onDeleteProduct(product)}
                    className="min-h-[38px] rounded-lg bg-white border border-red-200 text-red-600 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Trash2 size={13} />
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Desktop Table (>= 768px) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse text-sm">
            <thead>
              <tr className="border-b border-gray-200 text-[11px] font-bold uppercase text-gray-500">
                <th className="py-3 pr-4">Product</th>
                <th className="py-3 pr-4">Department / Sub</th>
                <th className="py-3 pr-4">Price & Discount</th>
                <th className="py-3 pr-4">Single-Page Timer</th>
                <th className="py-3 pr-4">Free Gift</th>
                <th className="py-3 pr-4">Stock</th>
                <th className="py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filteredProducts.slice(0, 60).map((product) => {
                const dState = getProductDiscountState(product, now);
                const tax = classifyProductTaxonomy(product);
                const hasFreeGift =
                  Boolean(product.freeGift?.enabled) &&
                  Boolean(product.freeGift?.giftName);
                return (
                  <tr key={product.id} className="hover:bg-gray-50/70">
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-3">
                        <Image
                          product={product}
                          alt={product.title}
                          width={44}
                          height={44}
                          className="w-11 h-11 rounded object-contain border border-gray-200 bg-white shrink-0"
                        />
                        <div>
                          <p className="font-semibold text-gray-900 text-xs sm:text-sm">
                            {product.title}
                          </p>
                          <p className="text-[11px] text-gray-400 font-mono">
                            SKU: {product.sku || `UMMO-${product.id}`}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3 pr-4 text-xs">
                      <span className="font-bold text-gray-900">
                        {tax.departmentName}
                      </span>
                      <span className="block text-[11px] text-gray-500">
                        {tax.subcategory}
                      </span>
                    </td>
                    <td className="py-3 pr-4">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900">
                          {currency.format(dState.effectivePrice)}
                        </span>
                        {dState.isDiscountActive && (
                          <>
                            <span className="text-xs text-gray-400 line-through">
                              {currency.format(dState.regularPrice)}
                            </span>
                            <span className="text-[10px] font-bold bg-red-50 text-[#D6001C] px-1.5 py-0.5 rounded">
                              -{dState.discountPercentage}%
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
                          Standard
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
                          + Set Gift
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
                        className="inline-flex items-center gap-1 text-xs font-bold text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-lg cursor-pointer"
                      >
                        <Edit3 size={12} /> Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteProduct(product)}
                        className="inline-flex items-center gap-1 text-xs font-medium text-red-600 hover:text-red-700 border border-red-200 px-2.5 py-1.5 rounded-lg cursor-pointer"
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
    </>
  );
}
