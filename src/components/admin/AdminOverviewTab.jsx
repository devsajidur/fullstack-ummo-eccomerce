import React from "react";
import Image from "../layout/common/Image";

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

export default function AdminOverviewTab({
  metrics,
  orders,
  coupons,
  onNavigateTab,
  onUpdateOrderStatus,
}) {
  return (
    <div className="space-y-8">
      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          title="Gross Revenue"
          value={currency.format(metrics.totalRevenue || 0)}
          sub={`Paid Revenue: ${currency.format(metrics.paidRevenue || 0)}`}
          accent="border-emerald-500"
        />
        <KpiCard
          title="Total Orders"
          value={metrics.totalOrders}
          sub={`${metrics.pendingOrders} pending • ${metrics.avgOrderValue ? currency.format(metrics.avgOrderValue) : "$0.00"} avg`}
          accent="border-blue-500"
        />
        <KpiCard
          title="Catalog & Stock Health"
          value={metrics.totalProducts}
          sub={`${metrics.lowStockProducts} low stock (<10) • ${metrics.outOfStockProducts || 0} sold out`}
          accent="border-amber-500"
        />
        <KpiCard
          title="Payments & Promo Activity"
          value={`${metrics.paidOrdersCount || 0} Paid`}
          sub={`${metrics.failedOrRefundedCount || 0} failed/refunded • ${coupons.length} coupons`}
          accent="border-purple-500"
        />
      </div>

      {/* Order Fulfillment Pipeline */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900">
            Order Fulfillment Pipeline
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab("orders")}
            className="text-xs font-semibold text-gray-900 underline cursor-pointer"
          >
            Manage All Orders →
          </button>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {ORDER_STATUSES.map((st) => {
            const count = orders.filter(
              (o) => (o.status || "PENDING") === st
            ).length;
            return (
              <div
                key={st}
                className="border border-gray-200 rounded-lg p-4 text-center bg-gray-50"
              >
                <p className="text-[11px] font-bold uppercase tracking-wider text-gray-500">
                  {st}
                </p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{count}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent Orders Table with Product Thumbnails & Payment Status */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Recent Customer Orders
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No orders placed yet. Place an order from the storefront to see live
            fulfillment here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-[11px] font-bold uppercase text-gray-500">
                  <th className="py-3 pr-4">Order ID</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Products</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Payment</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.slice(0, 8).map((order) => {
                  const items = Array.isArray(order.OrderItems)
                    ? order.OrderItems
                    : Object.values(order.OrderItems || {});
                  const hasNotes = items.some((it) =>
                    Boolean(String(it.optionalMessage || "").trim())
                  );
                  const paymentStatus =
                    order.paymentStatus ||
                    (order.paymentMethod === "sslcommerz" ||
                    order.paymentMethod === "stripe"
                      ? "INITIATED"
                      : "PENDING");

                  return (
                    <tr key={`${order.userUid || "guest"}-${order.orderId || order.id}`}>
                      <td className="py-3 pr-4 font-mono text-xs font-semibold">
                        #{String(order.orderId || order.id).slice(-8)}
                      </td>
                      <td className="py-3 pr-4">
                        <p className="font-medium text-gray-900">
                          {order.username || "Customer"}
                        </p>
                        <p className="text-xs text-gray-500">{order.email}</p>
                      </td>
                      <td className="py-3 pr-4">
                        <div className="flex items-center gap-1.5">
                          {items.slice(0, 3).map((it, idx) => (
                            <Image
                              key={idx}
                              item={it}
                              alt={it.productNameSnapshot || it.title || "Item"}
                              width={36}
                              height={36}
                              className="w-9 h-9 object-contain rounded border border-gray-200 bg-gray-50 shrink-0"
                            />
                          ))}
                          {items.length > 3 && (
                            <span className="text-[11px] font-semibold text-gray-500">
                              +{items.length - 3}
                            </span>
                          )}
                          {hasNotes && (
                            <span
                              title="Contains customer product message"
                              className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded"
                            >
                              📝 Note
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 pr-4 text-xs text-gray-500">
                        {order.date
                          ? new Date(order.date).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="py-3 pr-4 font-semibold">
                        {currency.format(
                          Number(order.total ?? order.totalAmount ?? 0)
                        )}
                      </td>
                      <td className="py-3 pr-4">
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
                          {paymentStatus}
                        </span>
                      </td>
                      <td className="py-3 pr-4">
                        <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-gray-100 text-gray-800">
                          {order.status || "PENDING"}
                        </span>
                      </td>
                      <td className="py-3 text-right">
                        <select
                          aria-label={`Order status for ${order.orderId || order.id}`}
                          value={order.status || "PENDING"}
                          onChange={(e) =>
                            onUpdateOrderStatus(order, e.target.value)
                          }
                          className="border border-gray-300 rounded px-2 py-1 text-xs bg-white cursor-pointer"
                        >
                          {ORDER_STATUSES.map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, sub, accent }) {
  return (
    <div
      className={`bg-white border border-gray-200 border-l-4 ${accent} rounded-xl p-4 shadow-xs`}
    >
      <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </p>
      <p className="text-xl font-bold text-gray-900 mt-1">{value}</p>
      <p className="text-[11px] text-gray-500 mt-1">{sub}</p>
    </div>
  );
}
