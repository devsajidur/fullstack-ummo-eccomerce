import React, { useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import toast, { Toaster } from "react-hot-toast";
import {
  setShippingMethod,
  applyCoupon,
  removeCoupon,
} from "../../../slices/cartSlice";
import { getStoredCoupons } from "../../../services/api";

export const SHIPPING_OPTIONS = [
  { id: "free", label: "Free shipping", price: 0 },
  { id: "flat", label: "Flat rate: $49", price: 49 },
  { id: "pickup", label: "Local pickup: $8", price: 8 },
];

export function computeCouponDiscount(subtotal, coupon) {
  if (!coupon || subtotal < Number(coupon.minOrder || 0)) return 0;
  if (coupon.type === "percentage") {
    return Number(((subtotal * Number(coupon.value)) / 100).toFixed(2));
  }
  return Math.min(subtotal, Number(coupon.value || 0));
}

export default function CartFirstTotalBox() {
  const dispatch = useDispatch();
  const cartProduct = useSelector((state) => state.cart.products);
  const shipping = useSelector((state) => state.cart.shippingMethod || "free");
  const appliedCoupon = useSelector((state) => state.cart.appliedCoupon);
  const [couponInput, setCouponInput] = useState("");

  const subtotal = cartProduct.reduce(
    (pre, curr) => pre + curr.price * curr.quantity,
    0
  );
  const navigate = useNavigate();
  const vat = cartProduct.length > 0 ? 19 : 0;
  const shippingCost =
    SHIPPING_OPTIONS.find((o) => o.id === shipping)?.price || 0;
  const discount = computeCouponDiscount(subtotal, appliedCoupon);
  const total = Math.max(0, subtotal - discount + vat + shippingCost);

  function handleApplyCoupon(e) {
    e.preventDefault();
    const code = couponInput.trim().toUpperCase();
    if (!code) return;

    const allCoupons = getStoredCoupons();
    const matched = allCoupons.find((c) => c.code === code && c.active);
    if (!matched) {
      toast.error("Invalid or expired coupon code.");
      return;
    }
    if (subtotal < Number(matched.minOrder || 0)) {
      toast.error(
        `Minimum order subtotal of $${matched.minOrder} required for ${code}.`
      );
      return;
    }

    dispatch(applyCoupon(matched));
    setCouponInput("");
    toast.success(`Coupon ${code} applied!`);
  }

  function handleCheckout() {
    if (cartProduct.length === 0) {
      toast.error(
        "Your cart is empty. Please add items to proceed to checkout."
      );
    } else {
      navigate("/billing");
    }
  }

  return (
    <div className="font-jost w-full lg:w-105 shrink-0">
      <Toaster position="top-center" reverseOrder={false} />

      {/* Promo Coupon Box */}
      <form
        onSubmit={handleApplyCoupon}
        className="flex border border-primary/30 mb-4"
      >
        <input
          type="text"
          value={couponInput}
          onChange={(e) => setCouponInput(e.target.value)}
          placeholder="Coupon Code (e.g. WELCOME10)"
          className="w-full px-4 py-3 text-xs uppercase outline-none"
        />
        <button
          type="submit"
          className="bg-primary text-white text-xs font-medium uppercase px-5 cursor-pointer hover:opacity-90"
        >
          Apply
        </button>
      </form>

      <div className="border mb-5">
        <div className="pt-7 sm:pt-9.5 px-4 sm:px-8 md:px-10.25">
          {/* Heading */}
          <h2 className="text-primary text-sm uppercase md:text-base font-medium pb-8">
            Cart totals
          </h2>

          {/* Subtotal */}
          <div className="grid grid-cols-2 gap-4 pb-3.25">
            <span className="text-primary text-sm font-medium leading-6 uppercase">
              Subtotal
            </span>
            <span className="text-primary text-sm font-medium leading-6">
              ${subtotal.toFixed(2)}
            </span>
          </div>

          {/* Discount Row */}
          {appliedCoupon && (
            <div className="grid grid-cols-2 gap-4 py-3 border-t border-primary/10 text-emerald-700">
              <span className="text-xs font-semibold uppercase flex items-center gap-2">
                Coupon ({appliedCoupon.code})
                <button
                  type="button"
                  onClick={() => dispatch(removeCoupon())}
                  className="text-[10px] text-red-500 underline cursor-pointer"
                >
                  Remove
                </button>
              </span>
              <span className="text-sm font-semibold">
                -${discount.toFixed(2)}
              </span>
            </div>
          )}

          {/* Shipping */}
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-primary/10">
            <span className="text-primary text-sm font-medium leading-6 uppercase">
              Shipping
            </span>
            <div className="flex flex-col gap-3">
              {SHIPPING_OPTIONS.map((option) => (
                <label
                  key={option.id}
                  className="flex items-center gap-3 cursor-pointer text-primary font-normal leading-6 text-sm"
                >
                  <input
                    type="checkbox"
                    checked={shipping === option.id}
                    onChange={() => dispatch(setShippingMethod(option.id))}
                    className="h-4 w-4 rounded-none border border-primary/40 text-primary accent-primary cursor-pointer"
                  />
                  {option.label}
                </label>
              ))}

              <p className="text-primary font-normal leading-6 text-sm">
                Shipping to AL.
              </p>
            </div>
          </div>

          {/* VAT */}
          <div className="grid grid-cols-2 gap-4 py-3.5 border-t border-primary/10">
            <span className="text-primary text-sm font-medium uppercase">
              Vat
            </span>
            <span className="text-primary font-medium leading-6 text-sm">
              ${vat}
            </span>
          </div>

          {/* Total */}
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-primary/10">
            <span className="text-primary text-sm font-medium leading-6 uppercase">
              Total
            </span>
            <span className="text-primary leading-6 font-medium text-sm">
              ${total.toFixed(2)}
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={handleCheckout}
        className="w-full bg-primary cursor-pointer text-white text-sm font-medium uppercase py-5 hover:bg-primary/90 transition-colors"
      >
        Proceed to checkout
      </button>
    </div>
  );
}
