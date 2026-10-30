import React, { useMemo } from "react";
import Image from "../layout/common/Image";
import { getStoredDiscountCampaigns } from "../../services/api";

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
  products = [],
  coupons = [],
  onNavigateTab,
  onUpdateOrderStatus,
}) {
  const campaigns = useMemo(() => getStoredDiscountCampaigns(), []);
  const activeCampaignsCount = campaigns.filter((c) => c.active !== false).length;

  const todayStats = useMemo(() => {
    const todayStr = new Date().toISOString().slice(0, 10);
    let todaysOrders = 0;
    let todaysRevenue = 0;
    let awaitingFulfillment = 0;
    let unpaidOrders = 0;

    orders.forEach((o) => {
      const dateStr = o.date ? new Date(o.date).toISOString().slice(0, 10) : "";
      const isCancelled = o.status === "CANCELLED";
      const amt = Number(o.total ?? o.totalAmount ?? 0);
      if (dateStr === todayStr) {
        todaysOrders += 1;
        if (!isCancelled) todaysRevenue += amt;
      }
      if (o.status === "PENDING" || o.status === "PROCESSING") {
        awaitingFulfillment += 1;
      }
      if (!isCancelled && o.paymentStatus !== "PAID") {
        unpaidOrders += 1;
      }
    });

    return {
      todaysOrders,
      todaysRevenue,
      awaitingFulfillment,
      unpaidOrders,
    };
  }, [orders]);

  const topSellingProducts = useMemo(() => {
    const tally = new Map();
    orders.forEach((o) => {
      if (o.status === "CANCELLED") return;
      const items = Array.isArray(o.OrderItems)
        ? o.OrderItems
        : Object.values(o.OrderItems || {});
      items.forEach((it) => {
        const key = String(it.id || it.productId || it.title || "");
        if (!key) return;
        const prev = tally.get(key) || {
          id: it.id || it.productId,
          title: it.productNameSnapshot || it.title || "Product",
          thumbnail: it.productImageSnapshot || it.thumbnail || it.image,
          unitsSold: 0,
          revenue: 0,
        };
        const qty = Math.max(1, Number(it.quantity || it.qun || 1));
        const price = Number(it.price || it.unitPriceSnapshot || 0);
        prev.unitsSold += qty;
        prev.revenue += qty * price;
        tally.set(key, prev);
      });
    });

    const sorted = Array.from(tally.values()).sort(
      (a, b) => b.unitsSold - a.unitsSold || b.revenue - a.revenue
    );
    if (sorted.length > 0) return sorted.slice(0, 5);

    // Fallback to top-rated catalog products when order volume is new
    return products
      .slice()
      .sort((a, b) => Number(b.rating || 0) - Number(a.rating || 0))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        title: p.title,
        thumbnail: p.thumbnail,
        unitsSold: 0,
        revenue: Number(p.price || 0),
        stock: p.stock,
      }));
  }, [orders, products]);

  return (
    <div className="space-y-6">
      {/* Primary Executive KPI Grid (Mobile-First 2-col on mobile, 4-col on desktop) */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
        <KpiCard
          title="Total Revenue"
          value={currency.format(metrics.totalRevenue || 0)}
          sub={`Today: ${currency.format(todayStats.todaysRevenue)} • Paid: ${currency.format(metrics.paidRevenue || 0)}`}
          accent="border-emerald-500"
          onClick={() => onNavigateTab("orders")}
        />
        <KpiCard
          title="Orders & Fulfillment"
          value={`${metrics.totalOrders} Total`}
          sub={`Today: ${todayStats.todaysOrders} • Pending: ${metrics.pendingOrders} • Awaiting: ${todayStats.awaitingFulfillment}`}
          accent="border-blue-500"
          onClick={() => onNavigateTab("orders")}
        />
        <KpiCard
          title="Stock & Inventory"
          value={`${metrics.totalProducts} SKUs`}
          sub={`${metrics.lowStockProducts} Low Stock • ${metrics.outOfStockProducts || 0} Out of Stock`}
          accent="border-amber-500"
          onClick={() => onNavigateTab("inventory")}
        />
        <KpiCard
          title="Payments & Campaigns"
          value={`${metrics.paidOrdersCount || 0} Paid / ${todayStats.unpaidOrders} Unpaid`}
          sub={`${activeCampaignsCount} Active Campaigns • ${coupons.length} Coupons`}
          accent="border-purple-500"
          onClick={() => onNavigateTab("discounts")}
        />
      </div>

      {/* Order Fulfillment Pipeline + Top Selling Products */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="lg:col-span-2 bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-900">
              Order Fulfillment Pipeline
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab("orders")}
              className="text-xs font-bold text-gray-900 underline cursor-pointer"
            >
              Manage Orders →
            </button>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5 sm:gap-3">
            {ORDER_STATUSES.map((st) => {
              const count = orders.filter(
                (o) => (o.status || "PENDING") === st
              ).length;
              return (
                <button
                  key={st}
                  type="button"
                  onClick={() => onNavigateTab("orders")}
                  className="border border-gray-200 hover:border-gray-900 rounded-xl p-3 sm:p-4 text-center bg-gray-50 transition-colors cursor-pointer"
                >
                  <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-500">
                    {st}
                  </p>
                  <p className="text-xl sm:text-2xl font-extrabold text-gray-900 mt-1">
                    {count}
                  </p>
                </button>
              );
            })}
          </div>
        </div>

        {/* Top Selling / High Demand Products */}
        <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-900">
              Top Products
            </h2>
            <button
              type="button"
              onClick={() => onNavigateTab("products")}
              className="text-xs font-bold text-gray-900 underline cursor-pointer"
            >
              Catalog →
            </button>
          </div>
          <div className="divide-y divide-gray-100">
            {topSellingProducts.map((item, idx) => (
              <div
                key={item.id || idx}
                className="py-2.5 flex items-center justify-between gap-2.5 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Image
                    item={item}
                    src={item.thumbnail}
                    alt={item.title}
                    width={36}
                    height={36}
                    className="w-9 h-9 rounded object-contain bg-gray-50 border border-gray-200 shrink-0"
                  />
                  <div className="min-w-0">
                    <p className="font-semibold text-gray-900 truncate">
                      {item.title}
                    </p>
                    <p className="text-[11px] text-gray-500">
                      {item.unitsSold > 0
                        ? `${item.unitsSold} sold`
                        : `Stock: ${item.stock ?? 99}`}
                    </p>
                  </div>
                </div>
                <span className="font-bold text-gray-900 shrink-0">
                  {currency.format(item.revenue || 0)}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Recent Customer Orders — Responsive Mobile Cards (<768px) & Table (>=768px) */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xs sm:text-sm font-bold uppercase tracking-wider text-gray-900">
            Recent Customer Orders
          </h2>
          <button
            type="button"
            onClick={() => onNavigateTab("orders")}
            className="text-xs font-bold text-gray-900 underline cursor-pointer"
          >
            View All ({orders.length})
          </button>
        </div>

        {orders.length === 0 ? (
          <p className="text-xs sm:text-sm text-gray-500 py-6 text-center">
            No orders placed yet. Place an order from the storefront to see live
            fulfillment here.
          </p>
        ) : (
          <>
            {/* Mobile Order Cards (< 768px) */}
            <div className="md:hidden space-y-3">
              {orders.slice(0, 6).map((order) => {
                const items = Array.isArray(order.OrderItems)
                  ? order.OrderItems
                  : Object.values(order.OrderItems || {});
                const hasNotes = items.some((it) =>
                  Boolean(
                    String(
                      it.optionalMessage ||
                        it.specialNote ||
                        it.productMessage ||
                        ""
                    ).trim()
                  )
                );
                const paymentStatus =
                  order.paymentStatus ||
                  (order.paymentMethod === "sslcommerz" ||
                  order.paymentMethod === "stripe"
                    ? "INITIATED"
                    : "PENDING");

                return (
                  <div
                    key={`mob-${order.userUid || "guest"}-${order.orderId || order.id}`}
                    className="border border-gray-200 rounded-xl p-3.5 bg-gray-50/60 space-y-2.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-mono text-xs font-bold text-gray-900">
                        #{String(order.orderId || order.id).slice(-8)}
                      </span>
                      <span
                        className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded-full ${
                          paymentStatus === "PAID"
                            ? "bg-emerald-100 text-emerald-800"
                            : paymentStatus === "REFUNDED" ||
                                paymentStatus === "PARTIALLY_REFUNDED"
                              ? "bg-purple-100 text-purple-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {paymentStatus}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <p className="font-semibold text-gray-900 truncate">
                          {order.username || order.customerName || "Customer"}
                        </p>
                        <p className="text-[11px] text-gray-500 truncate">
                          {order.email}
                        </p>
                      </div>
                      <span className="text-sm font-extrabold text-gray-900 shrink-0">
                        {currency.format(
                          Number(order.total ?? order.totalAmount ?? 0)
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-gray-200">
                      <div className="flex items-center gap-1.5">
                        {items.slice(0, 3).map((it, idx) => (
                          <Image
                            key={idx}
                            item={it}
                            alt={it.productNameSnapshot || it.title || "Item"}
                            width={32}
                            height={32}
                            className="w-8 h-8 object-contain rounded border border-gray-200 bg-white shrink-0"
                          />
                        ))}
                        {hasNotes && (
                          <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">
                            📝 Note
                          </span>
                        )}
                      </div>
                      <select
                        aria-label={`Order status for ${order.orderId || order.id}`}
                        value={order.status || "PENDING"}
                        onChange={(e) =>
                          onUpdateOrderStatus(order, e.target.value)
                        }
                        className="h-9 border border-gray-300 rounded-lg px-2.5 text-xs font-bold bg-white cursor-pointer"
                      >
                        {ORDER_STATUSES.map((st) => (
                          <option key={st} value={st}>
                            {st}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Table (>= 768px) */}
            <div className="hidden md:block overflow-x-auto">
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
                      Boolean(
                        String(
                          it.optionalMessage ||
                            it.specialNote ||
                            it.productMessage ||
                            ""
                        ).trim()
                      )
                    );
                    const paymentStatus =
                      order.paymentStatus ||
                      (order.paymentMethod === "sslcommerz" ||
                      order.paymentMethod === "stripe"
                        ? "INITIATED"
                        : "PENDING");

                    return (
                      <tr
                        key={`${order.userUid || "guest"}-${
                          order.orderId || order.id
                        }`}
                      >
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
                                alt={
                                  it.productNameSnapshot || it.title || "Item"
                                }
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
                            aria-label={`Order status for ${
                              order.orderId || order.id
                            }`}
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
          </>
        )}
      </div>
    </div>
  );
}

function KpiCard({ title, value, sub, accent, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`bg-white border border-gray-200 border-l-4 ${accent} rounded-xl p-3.5 sm:p-4 shadow-xs ${
        onClick ? "cursor-pointer hover:shadow-md transition-shadow" : ""
      }`}
    >
      <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-gray-400">
        {title}
      </p>
      <p className="text-lg sm:text-xl font-extrabold text-gray-900 mt-1 truncate">
        {value}
      </p>
      <p className="text-[10px] sm:text-[11px] text-gray-500 mt-1 line-clamp-2">
        {sub}
      </p>
    </div>
  );
}
