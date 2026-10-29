import React from "react";
import { Link, useNavigate } from "react-router";
import { useDispatch } from "react-redux";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Gift,
  MessageSquare,
  Package,
  RotateCcw,
  Truck,
  XCircle,
} from "lucide-react";
import toast from "react-hot-toast";
import Image from "../layout/common/Image";
import { addToCart } from "../../slices/cartSlice";
import { resolveProductImage } from "../../utils/productImage";

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

const PAYMENT_LABELS = {
  sslcommerz: "SSLCommerz Sandbox",
  stripe: "Stripe Test Mode",
  "bank-transfer": "Bank Transfer",
  cod: "Cash on Delivery",
  check: "Check Payment",
  paypal: "PayPal",
};

function getStepIndex(status) {
  const idx = TRACKING_STEPS.findIndex((s) => s.key === (status || "PENDING"));
  return idx === -1 ? 0 : idx;
}

export default function ProfileOrdersTab({ orders, onCancelOrder }) {
  const dispatch = useDispatch();
  const navigate = useNavigate();

  function handleBuyAgain(orderItems) {
    const list = Array.isArray(orderItems)
      ? orderItems
      : Object.values(orderItems || {});
    if (!list.length) return;
    list.forEach((it) => {
      const resolvedImg = resolveProductImage(it);
      dispatch(
        addToCart({
          id: it.id || it.productId,
          title: it.productNameSnapshot || it.title || it.name || "Product",
          price: Number(it.price || it.unitPriceSnapshot || 0),
          originalPrice: Number(
            it.originalPrice || it.price || it.unitPriceSnapshot || 0
          ),
          image: resolvedImg,
          productImageSnapshot: resolvedImg,
          quantity: Math.max(1, Number(it.quantity || 1)),
          size: it.size || it.selectedSize || "M",
          color: it.color || it.selectedColor || "Black",
          optionalMessage: it.optionalMessage || "",
        })
      );
    });
    toast.success("Order items added to your cart!");
    navigate("/cart");
  }

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
        const paymentStatus =
          order.paymentStatus ||
          (order.paymentMethod === "sslcommerz" ||
          order.paymentMethod === "stripe"
            ? "INITIATED"
            : "PENDING");
        const paymentGatewayLabel =
          PAYMENT_LABELS[order.paymentMethod] ||
          order.paymentMethod ||
          "Standard";
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
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs font-bold text-gray-900">
                    Order #{resolvedOrderId}
                  </span>
                  <span
                    className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                      paymentStatus === "PAID"
                        ? "bg-emerald-100 text-emerald-800"
                        : paymentStatus === "REFUNDED" ||
                          paymentStatus === "PARTIALLY_REFUNDED"
                        ? "bg-purple-100 text-purple-800"
                        : paymentStatus === "FAILED" ||
                          paymentStatus === "CANCELED"
                        ? "bg-red-100 text-red-700"
                        : "bg-amber-100 text-amber-800"
                    }`}
                  >
                    Payment: {paymentStatus}
                  </span>
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-500 bg-gray-100 px-2 py-0.5 rounded">
                    <CreditCard size={11} />
                    {paymentGatewayLabel}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Placed on{" "}
                  {order.date
                    ? new Date(order.date).toLocaleString()
                    : "Recent"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5">
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
                  {currency.format(
                    Number(order.total ?? order.totalAmount ?? 0)
                  )}
                </span>
                {paymentStatus === "INITIATED" &&
                  (order.paymentMethod === "sslcommerz" ||
                    order.paymentMethod === "stripe") && (
                    <Link
                      to={`/ordercomplete?orderId=${resolvedOrderId}&gateway=${order.paymentMethod}&sandbox=1`}
                      className="text-xs font-semibold bg-amber-500 hover:bg-amber-600 text-white px-3 py-1 rounded transition-colors"
                    >
                      Verify Payment
                    </Link>
                  )}
                <button
                  type="button"
                  onClick={() => handleBuyAgain(items)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 border border-gray-200 px-2.5 py-1 rounded hover:bg-gray-50 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Buy Again
                </button>
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

            {/* Line Items with Product Thumbnails + Optional Customer Messages + Free Gifts */}
            <div className="divide-y divide-gray-100 text-xs">
              {items.map((item, idx) => {
                const sz = item.size || item.selectedSize;
                const col = item.color || item.selectedColor;
                const itemTitle =
                  item.productNameSnapshot ||
                  item.title ||
                  item.name ||
                  "Product";
                const itemId = item.id || item.productId;
                const itemMsg = String(item.optionalMessage || "").trim();
                const unitPrice = Number(
                  item.price || item.unitPriceSnapshot || 0
                );
                const qty = Math.max(1, Number(item.quantity || 1));

                return (
                  <div
                    key={item.cartLineId || `${itemId}-${idx}`}
                    className="py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <Link
                        to={itemId ? `/shopsingle?id=${itemId}` : "/shop"}
                        className="shrink-0"
                      >
                        <Image
                          item={item}
                          alt={itemTitle}
                          width={56}
                          height={56}
                          className="w-14 h-14 object-contain bg-gray-50 border border-gray-200 rounded-lg hover:border-gray-400 transition-colors"
                        />
                      </Link>
                      <div className="min-w-0">
                        <Link
                          to={itemId ? `/shopsingle?id=${itemId}` : "/shop"}
                          className="font-semibold text-gray-900 hover:underline block truncate"
                        >
                          {itemTitle}
                        </Link>
                        <div className="text-gray-500 mt-0.5 flex flex-wrap items-center gap-2">
                          <span>
                            Qty: <strong>{qty}</strong> ×{" "}
                            {currency.format(unitPrice)}
                          </span>
                          {(sz || col) && (
                            <span className="text-gray-400">
                              • Variant: {[sz, col].filter(Boolean).join(" / ")}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-1 text-[11px]">
                          <MessageSquare
                            size={11}
                            className={
                              itemMsg ? "text-amber-700" : "text-gray-400"
                            }
                          />
                          {itemMsg ? (
                            <span className="text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded font-medium">
                              Message: &ldquo;{itemMsg}&rdquo;
                            </span>
                          ) : (
                            <span className="text-gray-400 italic">
                              No special instructions.
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <span className="font-semibold text-gray-900 shrink-0">
                      {currency.format(unitPrice * qty)}
                    </span>
                  </div>
                );
              })}
              {Array.isArray(order.freeGifts) &&
                order.freeGifts.map((fg, gIdx) => (
                  <div
                    key={`fg-${gIdx}`}
                    className="py-2.5 flex items-center justify-between text-emerald-800 font-semibold"
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
