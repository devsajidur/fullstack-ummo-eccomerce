import React, { useMemo, useState } from "react";

const ORDER_STATUSES = [
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
];

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

export default function AdminOrdersTab({ orders, onUpdateOrderStatus }) {
  const [statusFilter, setStatusFilter] = useState("ALL");

  const filteredOrders = useMemo(() => {
    if (statusFilter === "ALL") return orders;
    return orders.filter((o) => (o.status || "PENDING") === statusFilter);
  }, [orders, statusFilter]);

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-base font-bold text-gray-900">
            Order Fulfillment Manager ({filteredOrders.length})
          </h2>
          <p className="text-xs text-gray-500">
            Updating an order status immediately updates the customer's 4-step live order tracker.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5">
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
      </div>

      {filteredOrders.length === 0 ? (
        <p className="text-sm text-gray-500 py-8 text-center">
          No orders found in this status filter.
        </p>
      ) : (
        <div className="space-y-4">
          {filteredOrders.map((order) => {
            const items = Array.isArray(order.OrderItems)
              ? order.OrderItems
              : Object.values(order.OrderItems || {});
            return (
              <div
                key={`${order.userUid}-${order.orderId}`}
                className="border border-gray-200 rounded-lg p-4 hover:border-gray-300 transition-all"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 border-b border-gray-100 pb-3 mb-3">
                  <div>
                    <span className="font-mono text-xs font-bold text-gray-900">
                      Order #{order.orderId}
                    </span>
                    <span className="text-xs text-gray-500 ml-3">
                      {order.username} ({order.email})
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-sm font-bold text-gray-900">
                      {currency.format(Number(order.total || 0))}
                    </span>
                    <select
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
                <div className="flex flex-wrap gap-2">
                  {items.map((it, idx) => (
                    <span
                      key={idx}
                      className="text-xs bg-gray-50 border border-gray-200 rounded px-2.5 py-1 text-gray-700"
                    >
                      {it.title || it.name} ×{it.quantity || 1}
                      {it.selectedSize ? ` (${it.selectedSize})` : ""}
                    </span>
                  ))}
                  {Array.isArray(order.freeGifts) &&
                    order.freeGifts.map((fg, gIdx) => (
                      <span
                        key={`fg-${gIdx}`}
                        className="text-xs bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1 text-emerald-800 font-semibold"
                      >
                        🎁 FREE GIFT: {fg.earnedGiftQty}× {fg.giftName}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
