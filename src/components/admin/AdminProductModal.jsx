import React from "react";
import { Edit3, X } from "lucide-react";
import { getAllDepartments } from "../../utils/categoryTaxonomy";
import { getCategoryDefaultVariants } from "../../utils/productVariants";
import ProductVariantSection from "./product-modal/ProductVariantSection";
import ProductMediaGallerySection from "./product-modal/ProductMediaGallerySection";
import ProductPromoGiftSection from "./product-modal/ProductPromoGiftSection";

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
  const departments = getAllDepartments(false);
  const currentDeptObj =
    departments.find((d) => d.slug === (productForm.department || "women")) ||
    departments[0];
  const subcategories = currentDeptObj?.subcategories || ["General"];

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-[1px] flex items-end sm:items-center justify-center p-0 sm:p-4"
      role="dialog"
      aria-modal="true"
      aria-label={editingProduct ? "Edit Product" : "Add Product"}
    >
      <div className="bg-white rounded-t-2xl sm:rounded-2xl max-w-2xl w-full shadow-2xl max-h-[94dvh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50 shrink-0">
          <h3 className="text-sm sm:text-base font-extrabold text-gray-900 flex items-center gap-2 uppercase tracking-wider">
            <Edit3 size={16} />
            {editingProduct
              ? "Edit Product, Variants & Discount"
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

        <form
          onSubmit={onSubmit}
          className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 text-xs"
        >
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
                  const autoVariants =
                    !editingProduct && !productForm.variantsTouched
                      ? getCategoryDefaultVariants({
                          department: nextDeptSlug,
                          subcategory: firstSub,
                          category: defaultCat,
                          title: productForm.title,
                        })
                      : null;
                  setProductForm({
                    ...productForm,
                    department: nextDeptSlug,
                    subcategory: firstSub,
                    category: defaultCat,
                    ...(autoVariants
                      ? {
                          sizes: autoVariants.sizes,
                          colors: autoVariants.colors,
                        }
                      : {}),
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
                onChange={(e) => {
                  const nextSub = e.target.value;
                  const autoVariants =
                    !editingProduct && !productForm.variantsTouched
                      ? getCategoryDefaultVariants({
                          department: productForm.department,
                          subcategory: nextSub,
                          category: productForm.category,
                          title: productForm.title,
                        })
                      : null;
                  setProductForm({
                    ...productForm,
                    subcategory: nextSub,
                    ...(autoVariants
                      ? {
                          sizes: autoVariants.sizes,
                          colors: autoVariants.colors,
                        }
                      : {}),
                  });
                }}
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

          <ProductVariantSection
            productForm={productForm}
            setProductForm={setProductForm}
          />

          <ProductMediaGallerySection
            productForm={productForm}
            setProductForm={setProductForm}
            uploadingField={uploadingField}
            uploadStatusMsg={uploadStatusMsg}
            onCloudinaryFileUpload={onCloudinaryFileUpload}
          />

          <ProductPromoGiftSection
            productForm={productForm}
            setProductForm={setProductForm}
            products={products}
            onApplyTimerPresetHours={onApplyTimerPresetHours}
          />

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
