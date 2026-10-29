import React, { useEffect, useState } from "react";
import { Plus, Save, Sparkles, Trash2, Truck } from "lucide-react";
import toast from "react-hot-toast";
import {
  DEFAULT_CART_RULES,
  getStoredCartRules,
  initCartRulesSync,
  saveStoredCartRules,
} from "../../utils/cartPromotions";

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

  const [cartRules, setCartRules] = useState(() => getStoredCartRules());
  const [savingRules, setSavingRules] = useState(false);

  useEffect(() => {
    const unsub = initCartRulesSync((rules) => setCartRules(rules));
    return () => {
      if (typeof unsub === "function") unsub();
    };
  }, []);

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

  async function handleSaveCartRules(e) {
    if (e) e.preventDefault();
    setSavingRules(true);
    try {
      const normalized = await saveStoredCartRules(cartRules);
      setCartRules(normalized);
      toast.success(
        `Cart Rules saved! Free Delivery at $${normalized.freeShippingThreshold}.`
      );
    } catch {
      toast.error("Failed to save cart promotion rules.");
    } finally {
      setSavingRules(false);
    }
  }

  async function handleResetDefaultRules() {
    setSavingRules(true);
    try {
      const normalized = await saveStoredCartRules(DEFAULT_CART_RULES);
      setCartRules(normalized);
      toast.success("Reset Cart Rules to Default ($100 Free Shipping).");
    } finally {
      setSavingRules(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Automated Cart Promotions & Rules Manager */}
      <form
        onSubmit={handleSaveCartRules}
        className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs"
      >
        <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-5 border-b border-gray-100">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider text-gray-900 flex items-center gap-2">
              <Sparkles size={16} className="text-red-600" />
              Cart Free Delivery & VIP Spend Rules
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Configure Free Delivery Threshold and VIP Spend Rewards across Cart & Checkout. (To set a Free Gift on a specific product, go to the{" "}
              <strong>Products</strong> tab and click{" "}
              <strong>+ Set Free Gift</strong> on any product.)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleResetDefaultRules}
              className="text-xs font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 px-3 py-2 rounded-lg cursor-pointer"
            >
              Reset Defaults
            </button>
            <button
              type="submit"
              disabled={savingRules}
              className="inline-flex items-center gap-1.5 bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-4 py-2 rounded-lg hover:bg-gray-800 cursor-pointer disabled:opacity-60"
            >
              <Save size={14} />
              {savingRules ? "Saving..." : "Save Cart Rules"}
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 text-xs">
          {/* Rule 1: Free Delivery Threshold */}
          <div className="border border-emerald-200 bg-emerald-50/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-emerald-900">
                <Truck size={15} className="text-emerald-600" />
                Free Delivery Threshold Bar
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(cartRules.freeShippingEnabled)}
                  onChange={(e) =>
                    setCartRules({
                      ...cartRules,
                      freeShippingEnabled: e.target.checked,
                    })
                  }
                  className="accent-emerald-600 w-4 h-4"
                />
                <span className="font-semibold text-emerald-800">Active</span>
              </label>
            </div>
            <div>
              <label className="block font-semibold text-gray-700 mb-1">
                Minimum Order for FREE Delivery ($)
              </label>
              <input
                type="number"
                min="1"
                step="1"
                value={cartRules.freeShippingThreshold}
                onChange={(e) =>
                  setCartRules({
                    ...cartRules,
                    freeShippingThreshold: Number(e.target.value),
                  })
                }
                className="w-full border border-gray-300 rounded px-3 py-2 bg-white font-semibold text-gray-900"
              />
            </div>
            <div className="flex flex-wrap gap-1.5">
              {[50, 75, 100, 150, 200].map((amt) => (
                <button
                  key={amt}
                  type="button"
                  onClick={() =>
                    setCartRules({
                      ...cartRules,
                      freeShippingEnabled: true,
                      freeShippingThreshold: amt,
                    })
                  }
                  className={`px-2 py-1 rounded text-[11px] font-semibold border cursor-pointer ${
                    Number(cartRules.freeShippingThreshold) === amt
                      ? "bg-emerald-700 text-white border-emerald-700"
                      : "bg-white text-gray-700 border-gray-300 hover:border-gray-900"
                  }`}
                >
                  ${amt}+ Free
                </button>
              ))}
            </div>
          </div>

          {/* Rule 2: VIP Spend Tier + Luxury Gift Wrap */}
          <div className="border border-purple-200 bg-purple-50/40 rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 font-bold uppercase tracking-wider text-purple-900">
                <Sparkles size={15} className="text-purple-600" />
                VIP Spend Reward & Gift Wrap
              </span>
              <label className="inline-flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={Boolean(cartRules.tieredDiscountEnabled)}
                  onChange={(e) =>
                    setCartRules({
                      ...cartRules,
                      tieredDiscountEnabled: e.target.checked,
                    })
                  }
                  className="accent-purple-600 w-4 h-4"
                />
                <span className="font-semibold text-purple-800">Active</span>
              </label>
            </div>
            <div className="grid grid-cols-3 gap-2">
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Spend ($)
                </label>
                <input
                  type="number"
                  min="50"
                  value={cartRules.tieredMinSpend}
                  onChange={(e) =>
                    setCartRules({
                      ...cartRules,
                      tieredMinSpend: Number(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white font-semibold text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Extra Off (%)
                </label>
                <input
                  type="number"
                  min="1"
                  max="50"
                  value={cartRules.tieredDiscountPercent}
                  onChange={(e) =>
                    setCartRules({
                      ...cartRules,
                      tieredDiscountPercent: Number(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white font-semibold text-gray-900"
                />
              </div>
              <div>
                <label className="block font-semibold text-gray-700 mb-1">
                  Gift Wrap ($)
                </label>
                <input
                  type="number"
                  min="0"
                  max="50"
                  value={cartRules.giftWrapFee}
                  onChange={(e) =>
                    setCartRules({
                      ...cartRules,
                      giftWrapFee: Number(e.target.value),
                    })
                  }
                  className="w-full border border-gray-300 rounded px-2.5 py-2 bg-white font-semibold text-gray-900"
                />
              </div>
            </div>
            <p className="text-[11px] text-purple-800">
              Customers spending ${cartRules.tieredMinSpend}+ automatically get an extra {cartRules.tieredDiscountPercent}% VIP discount in Cart.
            </p>
          </div>
        </div>
      </form>

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
                  <p className="text-xs text-gray-500 mt-0.5">
                    {cp.description}
                  </p>
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
    </div>
  );
}
