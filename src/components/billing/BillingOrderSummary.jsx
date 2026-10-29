import React from "react";
import Image from "../layout/common/Image";

const PAYMENT_METHODS = [
  {
    id: "bank-transfer",
    label: "Direct bank transfer",
    description:
      "Make your payment directly into our bank account. Please use your Order ID as the payment reference. Your order will not be shipped until the funds have cleared in our account.",
  },
  { id: "check", label: "Check payments" },
  { id: "cod", label: "Cash on delivery" },
  { id: "paypal", label: "PayPal" },
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

        <div className="space-y-2.5 mb-3">
          {orderItems.map((item, idx) => (
            <div
              key={`${item.id}-${idx}`}
              className="flex justify-between text-sm text-gray-600 items-center"
            >
              <div className="flex items-center gap-3">
                <Image
                  src={item.image}
                  alt={item.title}
                  className="w-16 h-16 object-cover rounded-md"
                />
                <div>
                  <span className="block">{item.title}</span>
                  <span className="text-xs text-gray">
                    Qty: {item.quantity}
                    {item.size ? ` • Size: ${item.size}` : ""}
                    {item.color ? ` • Color: ${item.color}` : ""}
                  </span>
                </div>
              </div>
              <span>${(item.price * item.quantity).toFixed(2)}</span>
            </div>
          ))}
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
        <div className="mt-2 space-y-4">
          {PAYMENT_METHODS.map((method) => (
            <div key={method.id}>
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="paymentMethod"
                  checked={paymentMethod === method.id}
                  onChange={() => setPaymentMethod(method.id)}
                  className="w-4 h-4 accent-gray-900 shrink-0"
                />
                <span className="text-sm text-gray-800">{method.label}</span>
              </label>
              {method.description && paymentMethod === method.id && (
                <p className="text-xs text-gray-500 leading-relaxed mt-2 ml-7">
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
        {submitting ? "PLACING ORDER..." : "PLACE ORDER"}
      </button>
    </div>
  );
}
