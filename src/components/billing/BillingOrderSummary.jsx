import React from "react";
import { useDispatch } from "react-redux";
import Image from "../layout/common/Image";
import { updateItemMessage } from "../../slices/cartSlice";

const PAYMENT_METHODS = [
  {
    id: "sslcommerz",
    label: "SSLCommerz Gateway (Sandbox / Test Mode)",
    badge: "SANDBOX",
    description:
      "Pay via SSLCommerz Sandbox (Cards, bKash, Nagad, Rocket & Mobile Banking in test mode). Server-side Transaction Validation API & IPN verification enabled.",
  },
  {
    id: "stripe",
    label: "Stripe Checkout (Test Mode)",
    badge: "TEST MODE",
    description:
      "Pay via Stripe Test Mode Checkout (Test Card 4242 •••• 4242). Verified asynchronously via signed HMAC-SHA256 Stripe webhook events.",
  },
  {
    id: "bank-transfer",
    label: "Direct bank transfer",
    description:
      "Make your payment directly into our bank account. Please use your Order ID as the payment reference. Your order will not be shipped until the funds have cleared in our account.",
  },
  { id: "cod", label: "Cash on delivery" },
  { id: "check", label: "Check payments" },
];

function SummaryRow({ label, value, border }) {
  return (
    <div
      className={`flex justify-between items-center py-3 ${
        border ? "border-b border-gray-200" : ""
      }`}
    >
      <span className="font-medium text-sm text-primary">{label}</span>
      <span className="text-base font-medium text-primary">{value}</span>
    </div>
  );
}

export default function BillingOrderSummary({
  orderItems,
  subtotal,
  promotions,
  tieredDiscount = 0,
  discount,
  appliedCoupon,
  shippingCost,
  giftWrapCost = 0,
  giftNote = "",
  vat,
  total,
  paymentMethod,
  setPaymentMethod,
  submitting,
}) {
  const dispatch = useDispatch();

  return (
    <div>
      <div className="border border-primary p-6">
        <h2 className="text-xs sm:text-base font-medium font-jost text-gray-900 mb-5">
          YOUR ORDER
        </h2>

        <div className="flex justify-between text-xs sm:text-sm font-medium text-gray-900 border-b border-gray-200 pb-3 mb-3">
          <span>PRODUCT</span>
          <span>SUBTOTAL</span>
        </div>

        <div className="space-y-4 mb-4">
          {orderItems.map((item, idx) => {
            const msgLen = Array.from(String(item.optionalMessage || "")).length;
            return (
              <div
                key={item.cartLineId || `${item.id}-${idx}`}
                className="border-b border-gray-100 pb-3 last:border-b-0"
              >
                <div className="flex justify-between text-sm text-gray-600 items-start gap-3">
                  <div className="flex items-start gap-3 min-w-0">
                    <Image
                      item={item}
                      src={item.image}
                      alt={item.title}
                      width={64}
                      height={64}
                      className="w-16 h-16 object-contain bg-gray-50 border border-gray-200 rounded-md shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="block font-medium text-gray-900 truncate">
                        {item.title}
                      </span>
                      <span className="text-xs text-gray">
                        Qty: {item.quantity}
                        {item.size ? ` • Size: ${item.size}` : ""}
                        {item.color ? ` • Color: ${item.color}` : ""}
                      </span>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900 shrink-0">
                    ${(item.price * item.quantity).toFixed(2)}
                  </span>
                </div>

                {/* Product-specific optional customer message on Checkout review row */}
                <div className="mt-2 pl-0 sm:pl-19">
                  <div className="flex items-center justify-between text-[10px] text-gray-500 mb-1">
                    <label
                      htmlFor={`checkout-item-msg-${item.cartLineId || idx}`}
                      className="font-medium text-gray-600"
                    >
                      Message for this product (optional)
                    </label>
                    <span>{msgLen}/500</span>
                  </div>
                  <input
                    id={`checkout-item-msg-${item.cartLineId || idx}`}
                    type="text"
                    maxLength={500}
                    value={item.optionalMessage || ""}
                    onChange={(e) =>
                      dispatch(
                        updateItemMessage({
                          cartLineId: item.cartLineId,
                          id: item.id,
                          size: item.size,
                          color: item.color,
                          optionalMessage: e.target.value,
                        })
                      )
                    }
                    placeholder="Add custom engraving, gift note, or packaging instructions..."
                    className="w-full text-xs border border-gray-200 rounded px-2.5 py-1.5 text-gray-800 placeholder-gray-400 focus:outline-none focus:border-gray-900 bg-gray-50/60"
                  />
                </div>
              </div>
            );
          })}
        </div>

        <SummaryRow
          label="SUBTOTAL"
          value={`$${subtotal.toFixed(2)}`}
          border
        />
        {(promotions?.unlockedFreeGifts || []).map((fg, idx) => (
          <SummaryRow
            key={`checkout-fg-${fg.parentProductId}-${idx}`}
            label={`🎁 FREE GIFT: ${fg.earnedGiftQty}× ${fg.giftName}`}
            value="FREE ($0.00)"
            border
          />
        ))}
        {tieredDiscount > 0 && (
          <SummaryRow
            label={`VIP SPEND DISCOUNT (${
              promotions?.tieredDiscountPercent || 10
            }% OFF)`}
            value={`-$${tieredDiscount.toFixed(2)}`}
            border
          />
        )}
        {discount > 0 && (
          <SummaryRow
            label={`COUPON (${appliedCoupon?.code})`}
            value={`-$${discount.toFixed(2)}`}
            border
          />
        )}
        {giftWrapCost > 0 && (
          <SummaryRow
            label={`LUXURY GIFT WRAP${giftNote ? ` ("${giftNote.slice(0, 20)}")` : ""}`}
            value={`+$${giftWrapCost.toFixed(2)}`}
            border
          />
        )}
        <SummaryRow
          label="SHIPPING"
          value={
            promotions?.freeShippingUnlocked
              ? "FREE (Unlocked)"
              : shippingCost > 0
              ? `$${shippingCost.toFixed(2)}`
              : "Free shipping"
          }
          border
        />
        <SummaryRow label="VAT" value={`$${vat}`} border />
        <SummaryRow label="TOTAL" value={`$${total.toFixed(2)}`} />
      </div>

      {/* Payment methods */}
      <div className="border border-gray-200 p-6 mt-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Select Payment Gateway
          </h3>
          <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-amber-100 text-amber-800">
            Sandbox / Test Safe
          </span>
        </div>

        <div className="mt-2 space-y-4">
          {PAYMENT_METHODS.map((method) => (
            <div
              key={method.id}
              className={`p-3 rounded-md border transition-colors ${
                paymentMethod === method.id
                  ? "border-gray-900 bg-gray-50/70"
                  : "border-gray-200"
              }`}
            >
              <label className="flex items-center justify-between gap-3 cursor-pointer">
                <span className="flex items-center gap-3">
                  <input
                    type="radio"
                    name="paymentMethod"
                    checked={paymentMethod === method.id}
                    onChange={() => setPaymentMethod(method.id)}
                    className="w-4 h-4 accent-gray-900 shrink-0"
                  />
                  <span className="text-sm font-medium text-gray-900">
                    {method.label}
                  </span>
                </span>
                {method.badge && (
                  <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 shrink-0">
                    {method.badge}
                  </span>
                )}
              </label>
              {method.description && paymentMethod === method.id && (
                <p className="text-xs text-gray-600 leading-relaxed mt-2 ml-7">
                  {method.description}
                </p>
              )}
            </div>
          ))}
        </div>

        <p className="text-xs text-gray-500 leading-relaxed mt-6">
          Your personal data will be used to process your order, support your
          experience throughout this website, and for other purposes described
          in our{" "}
          <a href="/terms" className="text-gray-900 underline">
            privacy policy
          </a>
          .
        </p>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="w-full bg-gray-900 text-white text-sm font-medium cursor-pointer py-4 mt-6 rounded-md hover:bg-gray-800 transition-colors disabled:opacity-60"
      >
        {submitting
          ? "PROCESSING..."
          : paymentMethod === "sslcommerz"
          ? "PROCEED TO SSLCOMMERZ SANDBOX"
          : paymentMethod === "stripe"
          ? "PROCEED TO STRIPE TEST CHECKOUT"
          : "PLACE ORDER"}
      </button>
    </div>
  );
}
