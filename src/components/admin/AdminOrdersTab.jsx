import React, { useMemo, useState } from "react";
import {
  CheckCircle2,
  CreditCard,
  Gift,
  MessageSquare,
  RotateCcw,
  Search,
  ShieldAlert,
} from "lucide-react";
import Image from "../layout/common/Image";

const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const PAYMENT_STATUS_FILTERS = [
  "ALL",
  "PAID",
  "INITIATED",
  "PENDING",
  "FAILED",
  "CANCELED",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
  "REQUIRES_REVIEW",
];

const GATEWAY_FILTERS = [
  { id: "ALL", label: "All Gateways" },
  { id: "sslcommerz", label: "SSLCommerz Sandbox" },
  { id: "stripe", label: "Stripe Test Mode" },
  { id: "bank-transfer", label: "Bank Transfer" },
  { id: "cod", label: "Cash on Delivery" },
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function AdminOrdersTab({
  orders,
  onUpdateOrderStatus,
  onReconcilePayment,
  onRefundPayment,
}) {
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [paymentFilter, setPaymentFilter] = useState("ALL");
  const [gatewayFilter, setGatewayFilter] = useState("ALL");
  const [searchQuery, setSearchQuery] = useState("");
  const [refundDraftOrderId, setRefundDraftOrderId] = useState(null);
  const [refundAmountInput, setRefundAmountInput] = useState("");
  const [refundReasonInput, setRefundReasonInput] = useState("");
  const [restockOnRefund, setRestockOnRefund] = useState(true);

  const filteredOrders = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return (orders || []).filter((o) => {
      const st = o.status || "PENDING";
      const pSt =
        o.paymentStatus ||
        (o.paymentMethod === "sslcommerz" || o.paymentMethod === "stripe"
          ? "INITIATED"
          : "PENDING");
      const gw = o.paymentMethod || o.paymentGateway || "";

      if (statusFilter !== "ALL" && st !== statusFilter) return false;
      if (paymentFilter !== "ALL" && pSt !== paymentFilter) return false;
      if (gatewayFilter !== "ALL" && gw !== gatewayFilter) return false;

      if (q) {
        const idStr = String(o.orderId || o.id || "").toLowerCase();
        const nameStr = String(o.username || "").toLowerCase();
        const emailStr = String(o.email || "").toLowerCase();
        const phoneStr = String(o.billing?.phone || "").toLowerCase();
        const tranStr = String(o.gatewayTransactionId || "").toLowerCase();
        if (
          !idStr.includes(q) &&
          !nameStr.includes(q) &&
          !emailStr.includes(q) &&
          !phoneStr.includes(q) &&
          !tranStr.includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [orders, statusFilter, paymentFilter, gatewayFilter, searchQuery]);

  function openRefundBox(order) {
    const orderId = order.orderId || order.id;
    const total = Number(order.total ?? order.totalAmount ?? 0);
    const alreadyRefunded = Number(order.refundedAmount || 0);
    const remaining = Math.max(0, Number((total - alreadyRefunded).toFixed(2)));
    setRefundDraftOrderId(orderId);
    setRefundAmountInput(String(remaining || total));
    setRefundReasonInput("Customer requested sandbox refund");
    setRestockOnRefund(true);
  }

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Order Fulfillment & Payment Reconciliation ({filteredOrders.length})
          </h2>
          <p className="text-xs text-gray-500">
            Inspect item thumbnails, customer product messages, SSLCommerz/Stripe
            sandbox transactions, and issue reconciliations or refunds.
          </p>
        </div>

        {/* Search Input */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search Order ID, customer, email, phone, txn..."
              className="border border-gray-300 rounded-lg pl-8 pr-3 py-1.5 text-xs outline-none focus:border-gray-900 w-64"
            />
          </div>

          <select
            aria-label="Filter by payment status"
            value={paymentFilter}
            onChange={(e) => setPaymentFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white cursor-pointer"
          >
            {PAYMENT_STATUS_FILTERS.map((pst) => (
              <option key={pst} value={pst}>
                Payment: {pst}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by payment gateway"
            value={gatewayFilter}
            onChange={(e) => setGatewayFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-2.5 py-1.5 text-xs font-semibold bg-white cursor-pointer"
          >
            {GATEWAY_FILTERS.map((gw) => (
              <option key={gw.id} value={gw.id}>
                {gw.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Order Status Pills */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {["ALL", ...ORDER_STATUSES].map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setStatusFilter(st)}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border cursor-pointer ${
              statusFilter === st
                ? "bg-gray-900 text-white border-gray-900"
                : "bg-white text-gray-600 border-gray-200 hover:border-gray-400"
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      {filteredOrders.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No orders matched your current search or filter criteria.
        </p>
      ) : (
        <div className="space-y-5">
          {filteredOrders.map((order, orderIdx) => {
            const resolvedOrderId =
              order.orderId || order.id || `ORD-${orderIdx}`;
            const items = Array.isArray(order.OrderItems)
              ? order.OrderItems
              : Object.values(order.OrderItems || {});
            const paymentStatus =
              order.paymentStatus ||
              (order.paymentMethod === "sslcommerz" ||
              order.paymentMethod === "stripe"
                ? "INITIATED"
                : "PENDING");
            const totalVal = Number(order.total ?? order.totalAmount ?? 0);
            const billing = order.billing || {};

            return (
              <div
                key={`${order.userUid || "guest"}-${resolvedOrderId}`}
                className="border border-gray-200 rounded-xl p-5 hover:border-gray-300 transition-all"
              >
                {/* Order Header */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3.5 mb-4">
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
                      <span className="inline-flex items-center gap-1 text-[10px] font-semibold bg-gray-100 text-gray-700 px-2 py-0.5 rounded uppercase">
                        <CreditCard size={11} />
                        {order.paymentMethod || "Standard"}
                      </span>
                      {order.gatewayTransactionId && (
                        <span className="font-mono text-[10px] text-gray-500 bg-gray-50 border border-gray-200 px-1.5 py-0.5 rounded">
                          Txn: {order.gatewayTransactionId}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">
                      <strong className="text-gray-800">
                        {order.username || "Customer"}
                      </strong>{" "}
                      ({order.email || "No email"})
                      {billing.phone ? ` • 📞 ${billing.phone}` : ""}
                      {billing.city || billing.country
                        ? ` • 📍 ${[
                            billing.streetAddress,
                            billing.city,
                            billing.country,
                          ]
                            .filter(Boolean)
                            .join(", ")}`
                        : ""}
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
                    {Number(order.refundedAmount || 0) > 0 && (
                      <span className="text-[11px] font-semibold bg-purple-50 text-purple-800 px-2 py-0.5 rounded">
                        Refunded: {currency.format(Number(order.refundedAmount))}
                      </span>
                    )}
                    <span className="text-sm font-bold text-gray-900">
                      {currency.format(totalVal)}
                    </span>

                    <select
                      aria-label={`Fulfillment status for ${resolvedOrderId}`}
                      value={order.status || "PENDING"}
                      onChange={(e) =>
                        onUpdateOrderStatus(order, e.target.value)
                      }
                      className="border border-gray-300 rounded px-2.5 py-1 text-xs font-semibold bg-white cursor-pointer"
                    >
                      {ORDER_STATUSES.map((st) => (
                        <option key={st} value={st}>
                          {st}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Purchased Items List with Product Thumbnails + Variations + Dedicated Customer Message Box */}
                <div className="space-y-2.5 mb-4">
                  {items.map((it, idx) => {
                    const sz = it.size || it.selectedSize;
                    const col = it.color || it.selectedColor;
                    const itemName =
                      it.productNameSnapshot ||
                      it.title ||
                      it.name ||
                      "Product";
                    const unitPrice = Number(
                      it.price || it.unitPriceSnapshot || 0
                    );
                    const qty = Math.max(1, Number(it.quantity || 1));
                    const itemMessage = String(it.optionalMessage || "").trim();

                    return (
                      <div
                        key={it.cartLineId || `${it.id || it.productId}-${idx}`}
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-gray-50/70 border border-gray-200 rounded-lg p-3"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <Image
                            item={it}
                            alt={itemName}
                            width={52}
                            height={52}
                            className="w-13 h-13 object-contain rounded border border-gray-200 bg-white shrink-0"
                          />
                          <div className="min-w-0">
                            <p className="text-xs sm:text-sm font-semibold text-gray-900">
                              {itemName}
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">
                              Qty: <strong>{qty}</strong> ×{" "}
                              {currency.format(unitPrice)} ={" "}
                              <strong className="text-gray-900">
                                {currency.format(unitPrice * qty)}
                              </strong>
                              {(sz || col) && (
                                <span className="ml-2 text-gray-500">
                                  • Variation:{" "}
                                  {[sz, col].filter(Boolean).join(" / ")}
                                </span>
                              )}
                            </p>
                          </div>
                        </div>

                        {/* Dedicated Item Customer Message Box (Section C4) */}
                        <div
                          className={`sm:max-w-xs w-full rounded-md px-3 py-2 text-xs border ${
                            itemMessage
                              ? "bg-amber-50 border-amber-300 text-amber-950"
                              : "bg-white border-gray-200 text-gray-400"
                          }`}
                        >
                          <div className="flex items-center gap-1.5 font-semibold text-[10px] uppercase tracking-wider mb-0.5">
                            <MessageSquare size={11} />
                            <span>Customer Item Message</span>
                          </div>
                          {itemMessage ? (
                            <p className="font-medium break-words">
                              &ldquo;{itemMessage}&rdquo;
                            </p>
                          ) : (
                            <p className="italic">No special instructions.</p>
                          )}
                        </div>
                      </div>
                    );
                  })}

                  {Array.isArray(order.freeGifts) &&
                    order.freeGifts.map((fg, gIdx) => (
                      <div
                        key={`fg-${gIdx}`}
                        className="flex items-center justify-between text-xs bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2 text-emerald-800 font-semibold"
                      >
                        <span className="flex items-center gap-1.5">
                          <Gift size={13} />
                          FREE GIFT:{" "}
                          {fg.earnedGiftQty || fg.totalFreeGiftQty || 1}×{" "}
                          {fg.giftName}
                        </span>
                        <span>FREE ($0.00)</span>
                      </div>
                    ))}
                </div>

                {/* Admin Payment Reconciliation & Refund Controls */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-3 border-t border-gray-100 text-xs">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-gray-500">
                      Payment Controls:
                    </span>
                    {onReconcilePayment && paymentStatus !== "PAID" && (
                      <button
                        type="button"
                        onClick={() =>
                          onReconcilePayment(
                            resolvedOrderId,
                            "PAID",
                            "Admin verified sandbox payment"
                          )
                        }
                        className="inline-flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 font-semibold px-2.5 py-1 rounded cursor-pointer"
                      >
                        <CheckCircle2 size={12} /> Reconcile as PAID
                      </button>
                    )}
                    {onReconcilePayment &&
                      paymentStatus !== "REQUIRES_REVIEW" && (
                        <button
                          type="button"
                          onClick={() =>
                            onReconcilePayment(
                              resolvedOrderId,
                              "REQUIRES_REVIEW",
                              "Flagged for manual payment review"
                            )
                          }
                          className="inline-flex items-center gap-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-semibold px-2.5 py-1 rounded cursor-pointer"
                        >
                          <ShieldAlert size={12} /> Flag Review
                        </button>
                      )}
                    {onRefundPayment &&
                      (paymentStatus === "PAID" ||
                        paymentStatus === "PARTIALLY_REFUNDED") && (
                        <button
                          type="button"
                          onClick={() => openRefundBox(order)}
                          className="inline-flex items-center gap-1 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 font-semibold px-2.5 py-1 rounded cursor-pointer"
                        >
                          <RotateCcw size={12} /> Issue Refund
                        </button>
                      )}
                  </div>

                  {order.giftWrap && (
                    <span className="text-[11px] text-gray-600">
                      🎁 Luxury Gift Wrap{" "}
                      {order.giftNote ? `("${order.giftNote}")` : ""}
                    </span>
                  )}
                </div>

                {/* Inline Refund Drawer */}
                {refundDraftOrderId === resolvedOrderId && onRefundPayment && (
                  <div className="mt-3 p-3.5 rounded-lg bg-purple-50/70 border border-purple-200 flex flex-wrap items-end gap-3 text-xs">
                    <div>
                      <label className="block text-[10px] font-bold uppercase text-purple-900 mb-1">
                        Refund Amount (USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        max={totalVal}
                        value={refundAmountInput}
                        onChange={(e) => setRefundAmountInput(e.target.value)}
                        className="border border-purple-300 rounded px-2.5 py-1.5 bg-white w-28 font-semibold"
                      />
                    </div>
                    <div className="flex-1 min-w-44">
                      <label className="block text-[10px] font-bold uppercase text-purple-900 mb-1">
                        Refund Reason
                      </label>
                      <input
                        type="text"
                        value={refundReasonInput}
                        onChange={(e) => setRefundReasonInput(e.target.value)}
                        className="border border-purple-300 rounded px-2.5 py-1.5 bg-white w-full"
                      />
                    </div>
                    <label className="flex items-center gap-1.5 text-purple-900 font-medium py-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={restockOnRefund}
                        onChange={(e) => setRestockOnRefund(e.target.checked)}
                      />
                      Restock inventory on full refund
                    </label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          onRefundPayment({
                            orderId: resolvedOrderId,
                            refundAmount: Number(refundAmountInput),
                            reason: refundReasonInput,
                            restockItems: restockOnRefund,
                          });
                          setRefundDraftOrderId(null);
                        }}
                        className="bg-purple-700 hover:bg-purple-800 text-white font-semibold px-3 py-1.5 rounded cursor-pointer"
                      >
                        Confirm Refund
                      </button>
                      <button
                        type="button"
                        onClick={() => setRefundDraftOrderId(null)}
                        className="border border-gray-300 bg-white text-gray-700 px-2.5 py-1.5 rounded cursor-pointer"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
