import React, { useMemo, useState } from "react";
import { Edit3, Plus, Search, Trash2 } from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function AdminProductsTab({
  products,
  onSaveProduct,
  onDeleteProduct,
}) {
  const [searchQuery, setSearchQuery] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [productForm, setProductForm] = useState({
    title: "",
    category: "womens-dresses",
    brand: "UOMO",
    price: "",
    discountPercentage: "0",
    stock: "25",
    sku: "",
    thumbnail:
      "https://cdn.dummyjson.com/products/images/womens-dresses/Black%20Women's%20Gown/thumbnail.png",
    description: "",
  });

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

  function openAddModal() {
    setEditingProduct(null);
    setProductForm({
      title: "",
      category: "womens-dresses",
      brand: "UOMO",
      price: "",
      discountPercentage: "10",
      stock: "30",
      sku: `UMMO-${Math.floor(1000 + Math.random() * 9000)}`,
      thumbnail:
        "https://cdn.dummyjson.com/products/images/womens-dresses/Black%20Women's%20Gown/thumbnail.png",
      description: "",
    });
    setShowModal(true);
  }

  function openEditModal(product) {
    setEditingProduct(product);
    setProductForm({
      title: product.title || "",
      category: product.category || "womens-dresses",
      brand: product.brand || "UOMO",
      price: String(product.price ?? ""),
      discountPercentage: String(product.discountPercentage ?? "0"),
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
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Storefront Product Catalog ({filteredProducts.length})
          </h2>
          <p className="text-xs text-gray-500">
            Add, edit, or remove products. Changes sync immediately across the entire storefront.
          </p>
        </div>
        <div className="flex items-center gap-3">
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
              <th className="py-3 pr-4">Brand</th>
              <th className="py-3 pr-4">Price</th>
              <th className="py-3 pr-4">Stock</th>
              <th className="py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredProducts.slice(0, 60).map((product) => (
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
                <td className="py-3 pr-4 text-xs text-gray-600">
                  {product.brand || "UOMO"}
                </td>
                <td className="py-3 pr-4 font-semibold">
                  {currency.format(Number(product.price || 0))}
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
                <td className="py-3 text-right space-x-2">
                  <button
                    type="button"
                    onClick={() => openEditModal(product)}
                    className="inline-flex items-center gap-1 text-xs font-medium text-gray-700 hover:text-black border border-gray-200 px-2.5 py-1 rounded cursor-pointer"
                  >
                    <Edit3 size={13} /> Edit
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
            ))}
          </tbody>
        </table>
      </div>

      {/* Add/Edit Product Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-6 shadow-2xl max-h-[90vh] overflow-y-auto">
            <h3 className="text-base font-bold text-gray-900 mb-4">
              {editingProduct ? "Edit Product" : "Add New Storefront Product"}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
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
                    Price (USD) *
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
                    Discount %
                  </label>
                  <input
                    type="number"
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
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Thumbnail Image URL *
                </label>
                <input
                  type="url"
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
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 border border-gray-300 rounded text-gray-700 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 bg-gray-900 text-white font-semibold rounded cursor-pointer"
                >
                  Save Product
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
