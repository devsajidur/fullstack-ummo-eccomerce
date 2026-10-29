import React from "react";
import { Link } from "react-router";
import { CheckCircle2, Clock, Gift, Package, Truck, XCircle } from "lucide-react";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const TRACKING_STEPS = [
  { key: "PENDING", label: "Order Placed", icon: Clock },
  { key: "PROCESSING", label: "Processing", icon: Package },
  { key: "SHIPPED", label: "Shipped", icon: Truck },
  { key: "DELIVERED", label: "Delivered", icon: CheckCircle2 },
];

function getStepIndex(status) {
  const idx = TRACKING_STEPS.findIndex((s) => s.key === (status || "PENDING"));
  return idx === -1 ? 0 : idx;
}

export default function ProfileOrdersTab({ orders, onCancelOrder }) {
  if (orders.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-10 text-center">
        <p className="text-sm text-gray-600 mb-4">
          You haven't placed any orders yet.
        </p>
        <Link
          to="/shop"
          className="inline-block bg-gray-900 text-white text-xs font-semibold uppercase tracking-wider px-6 py-3 rounded-lg"
        >
          Browse Storefront
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {orders.map((order, orderIdx) => {
        const resolvedOrderId = order.orderId || order.id || `ORD-${orderIdx}`;
        const status = order.status || "PENDING";
        const isCancelled = status === "CANCELLED";
        const currentStep = getStepIndex(status);
        const items = Array.isArray(order.OrderItems)
          ? order.OrderItems
          : Object.values(order.OrderItems || {});

        return (
          <div
            key={resolvedOrderId}
            className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
              <div>
                <span className="font-mono text-xs font-bold text-gray-900">
                  Order #{resolvedOrderId}
                </span>
                <p className="text-xs text-gray-500 mt-0.5">
                  Placed on{" "}
                  {order.date
                    ? new Date(order.date).toLocaleString()
                    : "Recent"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-3">
                {Number(order.tieredDiscount || 0) > 0 && (
                  <span className="text-[11px] font-semibold bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded">
                    VIP -{currency.format(Number(order.tieredDiscount))}
                  </span>
                )}
                {Number(order.discount || 0) > 0 && (
                  <span className="text-[11px] font-semibold bg-amber-50 text-amber-800 px-2 py-0.5 rounded">
                    {order.couponCode || "Coupon"} -
                    {currency.format(Number(order.discount))}
                  </span>
                )}
                <span className="text-base font-bold text-gray-900">
                  {currency.format(Number(order.total || 0))}
                </span>
                <Link
                  to={`/ordercomplete?orderId=${resolvedOrderId}`}
                  className="text-xs font-semibold underline text-gray-700 hover:text-black"
                >
                  View Invoice
                </Link>
                {status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => onCancelOrder(resolvedOrderId)}
                    className="text-xs font-semibold text-red-600 border border-red-200 px-3 py-1 rounded hover:bg-red-50 cursor-pointer"
                  >
                    Cancel Order
                  </button>
                )}
              </div>
            </div>

            {/* 4-Step Visual Order Progress Bar */}
            {isCancelled ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 mb-4">
                <XCircle size={16} /> This order was cancelled.
              </div>
            ) : (
              <div className="grid grid-cols-4 gap-2 mb-5">
                {TRACKING_STEPS.map((step, idx) => {
                  const Icon = step.icon;
                  const done = idx <= currentStep;
                  return (
                    <div
                      key={step.key}
                      className={`flex flex-col items-center text-center p-2 rounded-lg border ${
                        done
                          ? "border-emerald-500 bg-emerald-50/50 text-emerald-800"
                          : "border-gray-200 bg-gray-50 text-gray-400"
                      }`}
                    >
                      <Icon size={16} />
                      <span className="text-[11px] font-semibold mt-1">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Line Items + Free Gifts */}
            <div className="divide-y divide-gray-100 text-xs">
              {items.map((item, idx) => {
                const sz = item.size || item.selectedSize;
                const col = item.color || item.selectedColor;
                return (
                  <div
                    key={idx}
                    className="py-2 flex items-center justify-between"
                  >
                    <div>
                      <span className="font-semibold text-gray-900">
                        {item.title || item.name}
                      </span>{" "}
                      <span className="text-gray-500">×{item.quantity || 1}</span>
                      {(sz || col) && (
                        <span className="ml-2 text-gray-400">
                          ({[sz, col].filter(Boolean).join(" / ")})
                        </span>
                      )}
                    </div>
                    <span className="font-medium text-gray-900">
                      {currency.format(
                        Number(item.price || 0) * Number(item.quantity || 1)
                      )}
                    </span>
                  </div>
                );
              })}
              {Array.isArray(order.freeGifts) &&
                order.freeGifts.map((fg, gIdx) => (
                  <div
                    key={`fg-${gIdx}`}
                    className="py-2 flex items-center justify-between text-emerald-800 font-semibold"
                  >
                    <span className="flex items-center gap-1.5">
                      <Gift size={13} className="text-emerald-600" />
                      FREE GIFT: {fg.earnedGiftQty || fg.totalFreeGiftQty || 1}×{" "}
                      {fg.giftName}
                    </span>
                    <span className="text-emerald-700 font-bold">
                      FREE ($0.00)
                    </span>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
