import React, { useState } from "react";
import { Link, useNavigate } from "react-router";
import { useDispatch } from "react-redux";
import {
  CheckCircle2,
  Clock,
  CreditCard,
  Eye,
  Gift,
  MapPin,
  MessageSquare,
  Package,
  RotateCcw,
  Truck,
  X,
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
  const [selectedOrder, setSelectedOrder] = useState(null);

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
          optionalMessage:
            it.optionalMessage || it.specialNote || it.productMessage || "",
        })
      );
    });
    toast.success("Order items added to your cart!");
    navigate("/cart");
  }

  if (orders.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-xl p-8 sm:p-10 text-center">
        <Package size={36} className="mx-auto text-gray-300 mb-3" />
        <p className="text-sm font-semibold text-gray-700 mb-1">
          You haven&apos;t placed any orders yet.
        </p>
        <p className="text-xs text-gray-500 mb-5">
          Explore our Men, Women, Kids, and Discount collections to start shopping.
        </p>
        <Link
          to="/shop"
          className="inline-flex items-center justify-center min-h-[44px] bg-gray-900 text-white text-xs font-bold uppercase tracking-wider px-6 py-3 rounded-lg"
        >
          Browse Storefront
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      {orders.map((order, orderIdx) => {
        const resolvedOrderId = order.orderId || order.id || `ORD-${orderIdx}`;
        const status = order.status || "PENDING";
        const paymentStatus =
          order.paymentStatus ||
          (order.paymentMethod === "sslcommerz" ||
          order.paymentMethod === "stripe"
            ? "INITIATED"
            : "PENDING");
        const refundedAmount = Number(order.refundedAmount || 0);
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
            className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-gray-100 pb-4 mb-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono text-xs sm:text-sm font-bold text-gray-900">
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
                  {refundedAmount > 0 && (
                    <span className="text-[10px] font-bold bg-purple-50 text-purple-700 border border-purple-200 px-2 py-0.5 rounded-full">
                      Refunded: {currency.format(refundedAmount)}
                    </span>
                  )}
                  <span className="inline-flex items-center gap-1 text-[10px] font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
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

              <div className="flex flex-wrap items-center gap-2">
                <span className="text-base font-extrabold text-gray-900 mr-1">
                  {currency.format(
                    Number(order.total ?? order.totalAmount ?? 0)
                  )}
                </span>
                <button
                  type="button"
                  onClick={() => setSelectedOrder(order)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-gray-900 bg-gray-100 hover:bg-gray-200 min-h-[36px] px-3 py-1.5 rounded-lg cursor-pointer"
                >
                  <Eye size={13} />
                  Details
                </button>
                <button
                  type="button"
                  onClick={() => handleBuyAgain(items)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-gray-700 border border-gray-200 min-h-[36px] px-3 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  <RotateCcw size={12} />
                  Buy Again
                </button>
                <Link
                  to={`/ordercomplete?orderId=${resolvedOrderId}`}
                  className="inline-flex items-center text-xs font-semibold underline text-gray-700 hover:text-black min-h-[36px] px-2"
                >
                  Invoice
                </Link>
                {status === "PENDING" && (
                  <button
                    type="button"
                    onClick={() => onCancelOrder(resolvedOrderId)}
                    className="text-xs font-semibold text-red-600 border border-red-200 min-h-[36px] px-3 py-1.5 rounded-lg hover:bg-red-50 cursor-pointer"
                  >
                    Cancel
                  </button>
                )}
              </div>
            </div>

            {/* 4-Step Visual Order Progress Bar (2x2 on narrow mobile, 4-col on tablet/desktop) */}
            {isCancelled ? (
              <div className="flex items-center gap-2 text-xs font-semibold text-red-600 bg-red-50 border border-red-100 rounded-lg px-4 py-2.5 mb-4">
                <XCircle size={16} /> This order was cancelled.
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
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
                      <Icon size={15} />
                      <span className="text-[11px] font-semibold mt-1">
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Line Items with Product Thumbnails + Optional Customer Messages */}
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
                const itemMsg = String(
                  item.optionalMessage ||
                    item.specialNote ||
                    item.productMessage ||
                    ""
                ).trim();
                const unitPrice = Number(
                  item.price || item.unitPriceSnapshot || 0
                );
                const qty = Math.max(1, Number(item.quantity || 1));

                return (
                  <div
                    key={item.cartLineId || `${itemId}-${idx}`}
                    className="py-3 flex items-start justify-between gap-3"
                  >
                    <div className="flex items-start gap-3 min-w-0 flex-1">
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
                      <div className="min-w-0 flex-1">
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
                              • {[sz, col].filter(Boolean).join(" / ")}
                            </span>
                          )}
                        </div>
                        {itemMsg && (
                          <div className="mt-1.5 flex items-start gap-1.5 text-[11px] text-amber-900 bg-amber-50 border border-amber-200 px-2 py-1 rounded break-words">
                            <MessageSquare
                              size={12}
                              className="text-amber-700 shrink-0 mt-0.5"
                            />
                            <span className="break-words">
                              <strong>Product Note:</strong> &ldquo;{itemMsg}&rdquo;
                            </span>
                          </div>
                        )}
                      </div>
                    </div>
                    <span className="font-bold text-gray-900 shrink-0">
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

      {/* Mobile-Responsive Order Details Modal / Bottom Sheet */}
      {selectedOrder && (
        <div
          className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-[1px]"
          role="dialog"
          aria-modal="true"
          aria-label="Order Details"
        >
          <div className="bg-white w-full sm:max-w-lg max-h-[90dvh] rounded-t-2xl sm:rounded-2xl shadow-2xl flex flex-col overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200 bg-gray-50">
              <div>
                <h3 className="text-sm font-extrabold uppercase tracking-wider text-gray-900">
                  Order #{selectedOrder.orderId || selectedOrder.id}
                </h3>
                <p className="text-[11px] text-gray-500">
                  {selectedOrder.date
                    ? new Date(selectedOrder.date).toLocaleString()
                    : ""}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg text-gray-600 hover:bg-gray-200 cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3 p-3.5 rounded-xl bg-gray-50 border border-gray-200">
                <div>
                  <span className="text-gray-500 block">Fulfillment Status</span>
                  <strong className="text-gray-900 uppercase">
                    {selectedOrder.status || "PENDING"}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Payment Status</span>
                  <strong className="text-gray-900 uppercase">
                    {selectedOrder.paymentStatus || "PENDING"}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Payment Method</span>
                  <strong className="text-gray-900">
                    {PAYMENT_LABELS[selectedOrder.paymentMethod] ||
                      selectedOrder.paymentMethod ||
                      "Standard"}
                  </strong>
                </div>
                <div>
                  <span className="text-gray-500 block">Total Amount</span>
                  <strong className="text-gray-900 text-sm">
                    {currency.format(
                      Number(
                        selectedOrder.total ?? selectedOrder.totalAmount ?? 0
                      )
                    )}
                  </strong>
                </div>
              </div>

              {/* Delivery Address */}
              <div className="p-3.5 rounded-xl border border-gray-200">
                <h4 className="font-bold uppercase tracking-wider text-gray-700 mb-1.5 flex items-center gap-1.5">
                  <MapPin size={13} />
                  Delivery Details
                </h4>
                <p className="font-semibold text-gray-900">
                  {selectedOrder.customerName ||
                    `${selectedOrder.firstName || ""} ${
                      selectedOrder.lastName || ""
                    }`.trim() ||
                    "Customer"}
                </p>
                <p className="text-gray-600 mt-0.5 break-words">
                  {[
                    selectedOrder.streetAddress || selectedOrder.address,
                    selectedOrder.city,
                    selectedOrder.postcode,
                    selectedOrder.country,
                  ]
                    .filter(Boolean)
                    .join(", ") || "Standard Delivery"}
                </p>
                {selectedOrder.phone && (
                  <p className="text-gray-500 mt-0.5">
                    Phone: {selectedOrder.phone}
                  </p>
                )}
                {selectedOrder.orderNotes && (
                  <p className="mt-2 p-2 rounded bg-amber-50 border border-amber-200 text-amber-900 break-words">
                    <strong>Delivery Note:</strong> {selectedOrder.orderNotes}
                  </p>
                )}
              </div>
            </div>

            <div className="p-4 border-t border-gray-200 bg-gray-50 flex items-center justify-end gap-2.5 safe-area-bottom">
              <Link
                to={`/ordercomplete?orderId=${
                  selectedOrder.orderId || selectedOrder.id
                }`}
                className="min-h-[42px] px-4 rounded-lg border border-gray-900 text-gray-900 text-xs font-bold uppercase tracking-wider flex items-center justify-center"
              >
                Full Invoice
              </Link>
              <button
                type="button"
                onClick={() => setSelectedOrder(null)}
                className="min-h-[42px] px-5 rounded-lg bg-gray-900 text-white text-xs font-bold uppercase tracking-wider cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
