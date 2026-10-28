import React from "react";

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
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        <KpiCard
          title="Total Revenue"
          value={currency.format(metrics.totalRevenue)}
          sub="Excluding cancelled"
          accent="border-emerald-500"
        />
        <KpiCard
          title="Total Orders"
          value={metrics.totalOrders}
          sub={`${metrics.pendingOrders} pending action`}
          accent="border-blue-500"
        />
        <KpiCard
          title="Avg. Order Value"
          value={currency.format(metrics.avgOrderValue)}
          sub="Per completed order"
          accent="border-indigo-500"
        />
        <KpiCard
          title="Catalog Products"
          value={metrics.totalProducts}
          sub={`${metrics.lowStockProducts} low stock (<10)`}
          accent="border-amber-500"
        />
        <KpiCard
          title="Active Coupons"
          value={coupons.length}
          sub="Live promo codes"
          accent="border-purple-500"
        />
        <KpiCard
          title="Customers"
          value={metrics.totalCustomers}
          sub="Registered accounts"
          accent="border-rose-500"
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

      {/* Recent Orders Table */}
      <div className="bg-white border border-gray-200 rounded-xl p-6 shadow-xs">
        <h2 className="text-sm font-bold uppercase tracking-wider text-gray-900 mb-4">
          Recent Customer Orders
        </h2>
        {orders.length === 0 ? (
          <p className="text-sm text-gray-500 py-6 text-center">
            No orders placed yet. Place an order from the storefront to see live fulfillment here.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-gray-200 text-[11px] font-bold uppercase text-gray-500">
                  <th className="py-3 pr-4">Order ID</th>
                  <th className="py-3 pr-4">Customer</th>
                  <th className="py-3 pr-4">Date</th>
                  <th className="py-3 pr-4">Total</th>
                  <th className="py-3 pr-4">Status</th>
                  <th className="py-3 text-right">Quick Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {orders.slice(0, 8).map((order) => (
                  <tr key={`${order.userUid}-${order.orderId}`}>
                    <td className="py-3 pr-4 font-mono text-xs font-semibold">
                      #{String(order.orderId).slice(-8)}
                    </td>
                    <td className="py-3 pr-4">
                      <p className="font-medium text-gray-900">
                        {order.username || "Customer"}
                      </p>
                      <p className="text-xs text-gray-500">{order.email}</p>
                    </td>
                    <td className="py-3 pr-4 text-xs text-gray-500">
                      {order.date
                        ? new Date(order.date).toLocaleDateString()
                        : "N/A"}
                    </td>
                    <td className="py-3 pr-4 font-semibold">
                      {currency.format(Number(order.total || 0))}
                    </td>
                    <td className="py-3 pr-4">
                      <span className="text-[11px] font-bold uppercase px-2.5 py-1 rounded-full bg-gray-100 text-gray-800">
                        {order.status || "PENDING"}
                      </span>
                    </td>
                    <td className="py-3 text-right">
                      <select
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
                ))}
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
