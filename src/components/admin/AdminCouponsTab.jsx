import React, { useState } from "react";
import { Plus, Trash2 } from "lucide-react";

export default function AdminCouponsTab({
  coupons,
  onCreateCoupon,
  onDeleteCoupon,
}) {
  const [couponForm, setCouponForm] = useState({
    code: "",
    type: "percentage",
    value: "",
    minOrder: "50",
    description: "",
  });

  function handleSubmit(e) {
    e.preventDefault();
    onCreateCoupon(couponForm);
    setCouponForm({
      code: "",
      type: "percentage",
      value: "",
      minOrder: "50",
      description: "",
    });
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Create Coupon Form */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Create Promo Coupon
        </h3>
        <form onSubmit={handleSubmit} className="space-y-3.5 text-xs">
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Coupon Code *
            </label>
            <input
              type="text"
              required
              placeholder="e.g. SUMMER30"
              value={couponForm.code}
              onChange={(e) =>
                setCouponForm({
                  ...couponForm,
                  code: e.target.value.toUpperCase(),
                })
              }
              className="w-full border border-gray-300 rounded px-3 py-2 uppercase font-mono"
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Discount Type
              </label>
              <select
                value={couponForm.type}
                onChange={(e) =>
                  setCouponForm({ ...couponForm, type: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white"
              >
                <option value="percentage">Percentage (%)</option>
                <option value="fixed">Fixed USD ($)</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Discount Value *
              </label>
              <input
                type="number"
                required
                value={couponForm.value}
                onChange={(e) =>
                  setCouponForm({ ...couponForm, value: e.target.value })
                }
                className="w-full border border-gray-300 rounded px-3 py-2"
              />
            </div>
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Minimum Order Subtotal ($)
            </label>
            <input
              type="number"
              value={couponForm.minOrder}
              onChange={(e) =>
                setCouponForm({ ...couponForm, minOrder: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <div>
            <label className="block font-semibold text-gray-700 mb-1">
              Description
            </label>
            <input
              type="text"
              placeholder="e.g. 30% off summer collection"
              value={couponForm.description}
              onChange={(e) =>
                setCouponForm({ ...couponForm, description: e.target.value })
              }
              className="w-full border border-gray-300 rounded px-3 py-2"
            />
          </div>
          <button
            type="submit"
            className="w-full inline-flex items-center justify-center gap-1.5 bg-gray-900 text-white font-semibold uppercase tracking-wider py-2.5 rounded cursor-pointer hover:bg-gray-800"
          >
            <Plus size={14} /> Add Coupon
          </button>
        </form>
      </div>

      {/* Active Coupons List */}
      <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Active Storefront Coupons ({coupons.length})
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {coupons.map((cp) => (
            <div
              key={cp.code}
              className="border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-start justify-between"
            >
              <div>
                <span className="font-mono text-sm font-bold bg-gray-900 text-white px-2.5 py-1 rounded">
                  {cp.code}
                </span>
                <p className="text-xs font-semibold text-gray-800 mt-2">
                  {cp.type === "percentage"
                    ? `${cp.value}% OFF`
                    : `$${cp.value} FLAT OFF`}{" "}
                  (Min. Order ${cp.minOrder || 0})
                </p>
                <p className="text-xs text-gray-500 mt-0.5">{cp.description}</p>
              </div>
              <button
                type="button"
                onClick={() => onDeleteCoupon(cp.code)}
                className="text-red-500 hover:text-red-700 p-1 cursor-pointer"
                title="Delete Coupon"
              >
                <Trash2 size={15} />
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
