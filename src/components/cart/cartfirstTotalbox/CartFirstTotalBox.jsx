import React, { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router";
import toast, { Toaster } from "react-hot-toast";
import { Gift, Sparkles, Truck } from "lucide-react";
import {
  setShippingMethod,
  applyCoupon,
  removeCoupon,
  setGiftWrap,
  setGiftNote,
} from "../../../slices/cartSlice";
import { getStoredCoupons } from "../../../services/api";
import {
  computeCartPromotions,
  getStoredCartRules,
  initCartRulesSync,
} from "../../../utils/cartPromotions";

const EMPTY_LIST = [];

export const SHIPPING_OPTIONS = [
  { id: "flat", label: "Standard Express: $15", price: 15 },
  { id: "pickup", label: "Local store pickup: $8", price: 8 },
  { id: "free", label: "Economy shipping: Free", price: 0 },
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
  const navigate = useNavigate();
  const cartProduct = useSelector((state) => state.cart.products);
  const catalogProducts =
    useSelector((state) => state.AllProduct.Products) || EMPTY_LIST;
  const shipping = useSelector((state) => state.cart.shippingMethod || "flat");
  const appliedCoupon = useSelector((state) => state.cart.appliedCoupon);
  const giftWrap = useSelector((state) => state.cart.giftWrap);
  const giftNote = useSelector((state) => state.cart.giftNote);

  const [couponInput, setCouponInput] = useState("");
  const [cartRules, setCartRules] = useState(() => getStoredCartRules());
  const [availableCoupons, setAvailableCoupons] = useState(() =>
    getStoredCoupons()
  );

  useEffect(() => {
    const unsub = initCartRulesSync((rules) => setCartRules(rules));
    const handleCouponsUpdated = () => {
      setAvailableCoupons(getStoredCoupons());
    };
    window.addEventListener("ummo:coupons-updated", handleCouponsUpdated);
    return () => {
      if (typeof unsub === "function") unsub();
      window.removeEventListener("ummo:coupons-updated", handleCouponsUpdated);
    };
  }, []);

  const promo = computeCartPromotions(cartProduct, cartRules, catalogProducts);
  const subtotal = promo.subtotal;

  const netSubtotalAfterAutoPromos = Math.max(
    0,
    subtotal - promo.tieredDiscount
  );
  const couponDiscount = computeCouponDiscount(
    netSubtotalAfterAutoPromos,
    appliedCoupon
  );

  const rawShippingCost =
    SHIPPING_OPTIONS.find((o) => o.id === shipping)?.price || 0;
  const effectiveShippingCost =
    cartProduct.length === 0 || promo.freeShippingUnlocked
      ? 0
      : rawShippingCost;

  const giftWrapCost =
    cartProduct.length > 0 && giftWrap ? Number(cartRules.giftWrapFee || 5) : 0;
  const vat = cartProduct.length > 0 ? 19 : 0;

  const totalSavings = Number(
    (promo.tieredDiscount + couponDiscount).toFixed(2)
  );
  const totalCustomerSavings = Number(
    (totalSavings + Number(promo.productDiscountSavings || 0)).toFixed(2)
  );
  const total = Math.max(
    0,
    Number(
      (
        subtotal -
        totalSavings +
        effectiveShippingCost +
        giftWrapCost +
        vat
      ).toFixed(2)
    )
  );

  function applyCouponByCode(rawCode) {
    const code = String(rawCode || "").trim().toUpperCase();
    if (!code) return;

    const allCoupons = getStoredCoupons();
    setAvailableCoupons(allCoupons);
    const matched = allCoupons.find(
      (c) => String(c.code || "").toUpperCase() === code && c.active !== false
    );
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

  function handleApplyCoupon(e) {
    e.preventDefault();
    applyCouponByCode(couponInput);
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

      {/* 1. Free Shipping Progress Bar */}
      {promo.freeShippingEnabled && (
        <div className="mb-4 p-4 rounded-lg border border-gray-200 bg-gray-50">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-800 mb-2">
            <span className="flex items-center gap-1.5">
              <Truck size={15} className="text-emerald-600 shrink-0" />
              {promo.freeShippingUnlocked ? (
                <span className="text-emerald-700 font-bold">
                  🎉 Unlocked FREE Express Delivery!
                </span>
              ) : (
                <span>
                  Add{" "}
                  <strong className="text-[#D6001C]">
                    ${promo.amountNeededForFreeShipping.toFixed(2)}
                  </strong>{" "}
                  more for <strong>FREE Delivery</strong>
                </span>
              )}
            </span>
            <span className="text-[11px] font-bold text-gray-500">
              {promo.freeShippingProgress}%
            </span>
          </div>
          <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-500 rounded-full ${
                promo.freeShippingUnlocked ? "bg-emerald-600" : "bg-primary"
              }`}
              style={{ width: `${promo.freeShippingProgress}%` }}
            />
          </div>
        </div>
      )}

      {/* 2. Per-Product Free Gifts Unlocked Banner */}
      {promo.unlockedFreeGifts.length > 0 && (
        <div className="mb-4 p-3.5 rounded-lg border border-emerald-200 bg-emerald-50 text-xs text-emerald-900 space-y-2">
          <div className="flex items-center gap-1.5 font-bold uppercase tracking-wider text-[11px] text-emerald-800">
            <Gift size={14} className="text-emerald-600 shrink-0" />
            <span>
              Your Free Product Gift
              {promo.unlockedFreeGifts.length > 1 ? "s" : ""} Included ($0.00):
            </span>
          </div>
          {promo.unlockedFreeGifts.map((fg, idx) => (
            <div
              key={`${fg.parentProductId}-${idx}`}
              className="flex items-center justify-between bg-white/80 px-2.5 py-1.5 rounded border border-emerald-100"
            >
              <span className="font-semibold">
                🎁 {fg.earnedGiftQty}× {fg.giftName}{" "}
                <span className="text-[10px] text-gray-500 font-normal">
                  (with {fg.parentProductTitle})
                </span>
              </span>
              <span className="font-bold text-emerald-700">FREE</span>
            </div>
          ))}
        </div>
      )}

      {/* 3. Promo Coupon Box */}
      <form
        onSubmit={handleApplyCoupon}
        className="flex border border-primary/30 mb-2"
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

      {availableCoupons.length > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="text-gray-500 font-medium">Available:</span>
          {availableCoupons
            .filter((c) => c.active !== false)
            .slice(0, 6)
            .map((cp) => (
              <button
                key={cp.code}
                type="button"
                onClick={() => applyCouponByCode(cp.code)}
                className={`px-2 py-0.5 rounded border font-mono font-bold cursor-pointer transition-colors ${
                  appliedCoupon?.code === cp.code
                    ? "bg-emerald-700 text-white border-emerald-700"
                    : "bg-gray-50 hover:bg-gray-100 text-gray-800 border-gray-300"
                }`}
                title={cp.description || `Min order $${cp.minOrder || 0}`}
              >
                {cp.code} (
                {cp.type === "percentage" ? `${cp.value}%` : `$${cp.value}`} OFF)
              </button>
            ))}
        </div>
      )}

      {/* 4. Luxury Gift Packaging Option */}
      <div className="mb-4 p-3.5 border border-gray-200 rounded-lg bg-white text-xs">
        <label className="flex items-center justify-between cursor-pointer">
          <span className="flex items-center gap-2 font-semibold text-gray-800">
            <input
              type="checkbox"
              checked={Boolean(giftWrap)}
              onChange={(e) => dispatch(setGiftWrap(e.target.checked))}
              className="w-4 h-4 accent-primary cursor-pointer"
            />
            Add Luxury Gift Packaging & Ribbon
          </span>
          <span className="font-bold text-primary">
            +${Number(cartRules.giftWrapFee || 5).toFixed(2)}
          </span>
        </label>
        {giftWrap && (
          <input
            type="text"
            value={giftNote}
            onChange={(e) => dispatch(setGiftNote(e.target.value))}
            placeholder="Write a complimentary gift message..."
            className="mt-2.5 w-full border border-gray-300 rounded px-3 py-1.5 text-xs outline-none focus:border-primary"
          />
        )}
      </div>

      <div className="border mb-5">
        <div className="pt-7 sm:pt-9.5 px-4 sm:px-8 md:px-10.25">
          <h2 className="text-primary text-sm uppercase md:text-base font-medium pb-6">
            Cart totals
          </h2>

          {/* Original Price & Product Discounts */}
          {promo.productDiscountSavings > 0 && (
            <div className="grid grid-cols-2 gap-4 pb-2 text-xs text-[#D6001C] font-semibold">
              <span className="uppercase">Product Flash/Sale Discounts</span>
              <span className="text-right">
                -${promo.productDiscountSavings.toFixed(2)}
              </span>
            </div>
          )}

          {/* Subtotal */}
          <div className="grid grid-cols-2 gap-4 pb-3">
            <span className="text-primary text-sm font-medium leading-6 uppercase">
              Subtotal ({promo.totalUnits} items)
            </span>
            <span className="text-primary text-sm font-medium leading-6 text-right">
              ${subtotal.toFixed(2)}
            </span>
          </div>

          {/* Unlocked Free Gifts Summary Rows */}
          {promo.unlockedFreeGifts.map((fg, idx) => (
            <div
              key={`summary-fg-${fg.parentProductId}-${idx}`}
              className="grid grid-cols-2 gap-4 py-2.5 border-t border-primary/10 text-emerald-700"
            >
              <span className="text-xs font-semibold uppercase flex items-center gap-1.5">
                <Gift size={13} /> Free Gift: {fg.earnedGiftQty}× {fg.giftName}
              </span>
              <span className="text-sm font-bold text-right">FREE ($0.00)</span>
            </div>
          ))}

          {/* Tiered Spend VIP Discount Row */}
          {promo.tieredDiscount > 0 && (
            <div className="grid grid-cols-2 gap-4 py-2.5 border-t border-primary/10 text-emerald-700">
              <span className="text-xs font-semibold uppercase flex items-center gap-1.5">
                <Sparkles size={13} /> VIP Spend Discount (
                {promo.tieredDiscountPercent}% OFF)
              </span>
              <span className="text-sm font-bold text-right">
                -${promo.tieredDiscount.toFixed(2)}
              </span>
            </div>
          )}

          {/* Coupon Discount Row */}
          {appliedCoupon && (
            <div className="grid grid-cols-2 gap-4 py-2.5 border-t border-primary/10 text-emerald-700">
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
              <span className="text-sm font-bold text-right">
                -${couponDiscount.toFixed(2)}
              </span>
            </div>
          )}

          {/* Shipping */}
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-primary/10">
            <span className="text-primary text-sm font-medium leading-6 uppercase">
              Shipping
            </span>
            <div className="flex flex-col gap-2.5">
              {promo.freeShippingUnlocked ? (
                <div className="text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1.5 rounded">
                  FREE Express Delivery Unlocked ($0.00)
                </div>
              ) : (
                SHIPPING_OPTIONS.map((option) => (
                  <label
                    key={option.id}
                    className="flex items-center gap-2.5 cursor-pointer text-primary font-normal leading-5 text-xs sm:text-sm"
                  >
                    <input
                      type="checkbox"
                      checked={shipping === option.id}
                      onChange={() => dispatch(setShippingMethod(option.id))}
                      className="h-4 w-4 rounded-none border border-primary/40 text-primary accent-primary cursor-pointer"
                    />
                    {option.label}
                  </label>
                ))
              )}
            </div>
          </div>

          {/* Gift Wrap Row */}
          {giftWrapCost > 0 && (
            <div className="grid grid-cols-2 gap-4 py-3 border-t border-primary/10">
              <span className="text-primary text-xs font-medium uppercase">
                Luxury Gift Packaging
              </span>
              <span className="text-primary font-medium text-sm text-right">
                +${giftWrapCost.toFixed(2)}
              </span>
            </div>
          )}

          {/* VAT */}
          <div className="grid grid-cols-2 gap-4 py-3 border-t border-primary/10">
            <span className="text-primary text-sm font-medium uppercase">
              Vat
            </span>
            <span className="text-primary font-medium leading-6 text-sm text-right">
              ${vat.toFixed(2)}
            </span>
          </div>

          {/* Total */}
          <div className="grid grid-cols-2 gap-4 py-4 border-t border-primary/10">
            <span className="text-primary text-sm font-bold leading-6 uppercase">
              Total
            </span>
            <span className="text-primary leading-6 font-bold text-base text-right">
              ${total.toFixed(2)}
            </span>
          </div>

          {totalCustomerSavings > 0 && (
            <div className="mb-4 p-2.5 rounded bg-emerald-50 border border-emerald-200 text-center text-xs font-bold text-emerald-800">
              🎉 You are saving ${totalCustomerSavings.toFixed(2)} on this order!
            </div>
          )}
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
