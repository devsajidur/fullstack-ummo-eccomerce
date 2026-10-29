import { Check, CreditCard, Gift, Printer, ShieldCheck } from "lucide-react";
import { Link, useSearchParams } from "react-router";
import {
  getLocalOrders,
  onUserChanged,
  saveLocalOrder,
} from "../../services/authSession";
import {
  confirmSandboxPayment,
  fetchStoreDataFromMongo,
} from "../../services/api";
import { useEffect, useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import Image from "../layout/common/Image";

const currency = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
});

const PAYMENT_METHOD_LABELS = {
  sslcommerz: "SSLCommerz Gateway (Sandbox)",
  stripe: "Stripe Checkout (Test Mode)",
  "bank-transfer": "Direct bank transfer",
  check: "Check payments",
  cod: "Cash on delivery",
  paypal: "PayPal",
};

export default function OrderComplete() {
  const [searchParams] = useSearchParams();
  const orderId = searchParams.get("orderId");
  const gatewayParam = searchParams.get("gateway");
  const isSandboxFlow = searchParams.get("sandbox") === "1";

  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [verifyingPayment, setVerifyingPayment] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const unsubscribeAuth = onUserChanged((user) => {
      if (!user) {
        setError("Please log in to view your order.");
        setLoading(false);
        return;
      }
      if (!orderId) {
        setError("No order was selected.");
        setLoading(false);
        return;
      }

      const localMatched = getLocalOrders().find(
        (o) => String(o.orderId || o.id) === String(orderId)
      );
      if (localMatched) {
        setOrder(localMatched);
        setError("");
        setLoading(false);
      }

      fetchStoreDataFromMongo()
        .then((store) => {
          const allOrders = Array.isArray(store?.orders) ? store.orders : [];
          const found = allOrders.find(
            (o) => String(o.orderId || o.id) === String(orderId)
          );
          if (found) {
            setOrder(found);
            setError("");
          } else if (!localMatched) {
            setError("We could not find this order.");
          }
          setLoading(false);
        })
        .catch(() => {
          if (!localMatched) {
            setError("We could not load your order. Please try again.");
          }
          setLoading(false);
        });
    });

    return () => {
      unsubscribeAuth();
    };
  }, [orderId]);

  async function handleSandboxConfirm(outcome) {
    if (!order) return;
    setVerifyingPayment(true);
    const activeGateway =
      gatewayParam ||
      order.paymentGateway ||
      (order.paymentMethod === "stripe" ? "stripe" : "sslcommerz");

    try {
      const res = await confirmSandboxPayment({
        orderId: order.orderId || order.id,
        gateway: activeGateway,
        outcome,
      });
      if (res?.order) {
        setOrder(res.order);
        saveLocalOrder(res.order);
      } else {
        const nextPaymentStatus =
          outcome === "PAID"
            ? "PAID"
            : outcome === "CANCELED"
              ? "CANCELED"
              : "FAILED";
        const nextStatus =
          outcome === "PAID"
            ? "PROCESSING"
            : outcome === "CANCELED"
              ? "CANCELLED"
              : order.status;
        const patched = {
          ...order,
          paymentStatus: nextPaymentStatus,
          status: nextStatus,
        };
        setOrder(patched);
        saveLocalOrder(patched);
      }

      if (outcome === "PAID") {
        toast.success(
          `Verified ${
            activeGateway === "stripe" ? "Stripe Webhook" : "SSLCommerz IPN"
          } payment in Sandbox mode!`
        );
      } else if (outcome === "CANCELED") {
        toast("Sandbox payment marked as Canceled.", { icon: "⚠️" });
      } else {
        toast.error("Sandbox payment marked as Failed.");
      }
    } catch (err) {
      toast.error(
        err?.response?.data?.error || "Could not verify sandbox payment."
      );
    } finally {
      setVerifyingPayment(false);
    }
  }

  if (loading || error || !order) {
    return (
      <div className="min-h-64 flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-gray-600">
          {loading ? "Loading your order..." : error || "Order unavailable."}
        </p>
        {!loading && (
          <Link to="/shop" className="text-sm font-semibold underline">
            Continue shopping
          </Link>
        )}
      </div>
    );
  }

  const items = Array.isArray(order.OrderItems)
    ? order.OrderItems
    : Object.values(order.OrderItems || {});
  const subtotal = Number(
    order.subtotal ??
      items.reduce(
        (sum, item) =>
          sum + Number(item.price || 0) * Number(item.quantity || 1),
        0
      )
  );
  const tieredDiscount = Number(order.tieredDiscount || 0);
  const discount = Number(order.discount || 0);
  const couponCode = order.couponCode || null;
  const shipping = Number(order.shipping || 0);
  const giftWrapCost = Number(order.giftWrapCost || 0);
  const vat = Number(order.vat || 0);
  const total = Number(
    order.total ??
      order.totalAmount ??
      Math.max(0, subtotal - tieredDiscount - discount) +
        shipping +
        giftWrapCost +
        vat
  );
  const billing = order.billing || {};
  const status = order.status || "PENDING";
  const paymentStatus =
    order.paymentStatus ||
    (order.paymentMethod === "sslcommerz" || order.paymentMethod === "stripe"
      ? "INITIATED"
      : "PENDING");
  const formattedDate = order.date
    ? new Date(order.date).toLocaleString()
    : "Not available";
  const paymentMethod =
    PAYMENT_METHOD_LABELS[order.paymentMethod] ||
    order.paymentMethod ||
    "Not available";

  const showSandboxGatewayPanel =
    (isSandboxFlow ||
      order.paymentMethod === "sslcommerz" ||
      order.paymentMethod === "stripe") &&
    paymentStatus !== "PAID" &&
    paymentStatus !== "REFUNDED";

  return (
    <div className="min-h-screen bg-white px-4 sm:px-6 py-12 sm:py-16">
      <Toaster position="top-center" reverseOrder={false} />
      <div className="max-w-2xl mx-auto">
        {/* Check icon */}
        <div className="flex justify-center mb-6">
          <div className="w-14 h-14 rounded-full bg-[#B9A16B] flex items-center justify-center">
            <Check size={26} strokeWidth={3} className="text-white" />
          </div>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <div className="flex flex-wrap items-center justify-center gap-2 mb-3">
            <span className="inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-gray-100 text-gray-800">
              Order Status: {status}
            </span>
            <span
              className={`inline-block text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-full ${
                paymentStatus === "PAID"
                  ? "bg-emerald-100 text-emerald-800"
                  : paymentStatus === "FAILED" || paymentStatus === "CANCELED"
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-800"
              }`}
            >
              Payment: {paymentStatus}
            </span>
          </div>
          <h1 className="text-xl sm:text-2xl font-semibold text-gray-900 mb-1.5">
            Your order is completed!
          </h1>
          <p className="text-sm text-gray-500">
            Thank you. Your order has been received and can be tracked live in
            your dashboard.
          </p>
        </div>

        {/* Interactive Sandbox Payment Gateway Verification Panel */}
        {showSandboxGatewayPanel && (
          <div className="border-2 border-amber-300 bg-amber-50/70 rounded-lg p-5 mb-8">
            <div className="flex items-start justify-between gap-3 mb-2">
              <div className="flex items-center gap-2">
                <CreditCard size={18} className="text-amber-800 shrink-0" />
                <h2 className="text-sm font-bold uppercase tracking-wider text-amber-900">
                  {order.paymentMethod === "stripe"
                    ? "Stripe Test Mode Checkout Verification"
                    : "SSLCommerz Sandbox Gateway Verification"}
                </h2>
              </div>
              <span className="text-[10px] font-bold uppercase px-2 py-0.5 rounded bg-amber-200 text-amber-900 shrink-0">
                SANDBOX / TEST MODE
              </span>
            </div>
            <p className="text-xs text-amber-900/80 leading-relaxed mb-4">
              {order.paymentMethod === "stripe"
                ? "This order was created with a Stripe Test Mode Checkout session. Click below to dispatch a signed HMAC-SHA256 Stripe webhook event (`checkout.session.completed`) to verify payment on the server."
                : "This order was created with an SSLCommerz Sandbox session. Click below to execute server-side SSLCommerz Transaction Validation API & IPN verification."}
            </p>
            <div className="flex flex-wrap gap-2.5">
              <button
                type="button"
                disabled={verifyingPayment}
                onClick={() => handleSandboxConfirm("PAID")}
                className="inline-flex items-center gap-1.5 bg-emerald-700 hover:bg-emerald-800 text-white text-xs font-semibold px-4 py-2.5 rounded cursor-pointer transition-colors disabled:opacity-60"
              >
                <ShieldCheck size={14} />
                {verifyingPayment
                  ? "Verifying..."
                  : "Complete Verified Sandbox Payment (PAID)"}
              </button>
              <button
                type="button"
                disabled={verifyingPayment}
                onClick={() => handleSandboxConfirm("FAILED")}
                className="bg-white border border-red-300 text-red-700 hover:bg-red-50 text-xs font-semibold px-3.5 py-2.5 rounded cursor-pointer transition-colors disabled:opacity-60"
              >
                Simulate Failed Payment
              </button>
              <button
                type="button"
                disabled={verifyingPayment}
                onClick={() => handleSandboxConfirm("CANCELED")}
                className="bg-white border border-gray-300 text-gray-700 hover:bg-gray-100 text-xs font-semibold px-3.5 py-2.5 rounded cursor-pointer transition-colors disabled:opacity-60"
              >
                Simulate Canceled Payment
              </button>
            </div>
          </div>
        )}

        {/* Dashed order info box */}
        <div className="border-2 border-dashed border-gray-300 rounded-md px-6 py-5 mb-8">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-y-5 gap-x-4">
            <OrderMeta label="Order Number" value={orderId} />
            <OrderMeta label="Date" value={formattedDate} />
            <OrderMeta label="Total" value={currency.format(total)} />
            <OrderMeta label="Payment Method" value={paymentMethod} />
          </div>
        </div>

        {/* Order details card */}
        <div className="border border-gray-200 rounded-md px-6 py-6">
          <div className="flex items-center justify-between mb-5">
            <h2 className="text-xs font-semibold text-primary">
              ORDER DETAILS
            </h2>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-600 hover:text-gray-900 cursor-pointer"
            >
              <Printer size={14} />
              Print Invoice
            </button>
          </div>

          {/* Product header */}
          <div className="flex justify-between text-xs font-semibold text-primary border-b border-gray-200 pb-3 mb-3">
            <span>PRODUCT</span>
            <span>SUBTOTAL</span>
          </div>

          {/* Line items with Product Image Thumbnail + Optional Customer Message */}
          <div className="space-y-3 pb-3 mb-1 border-b border-gray-200">
            {items.map((item, index) => {
              const itemMsg = String(item.optionalMessage || "").trim();
              return (
                <div
                  key={
                    item.cartLineId ||
                    `${item.id || item.productId}-${index}`
                  }
                  className="flex justify-between items-start gap-3 text-sm text-gray border-b border-gray-100 pb-3 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start gap-3 min-w-0">
                    <Image
                      item={item}
                      alt={
                        item.productNameSnapshot ||
                        item.title ||
                        item.name ||
                        "Product"
                      }
                      width={52}
                      height={52}
                      className="w-13 h-13 object-contain bg-gray-50 border border-gray-200 rounded shrink-0"
                    />
                    <div className="min-w-0">
                      <span className="font-medium text-gray-900 block">
                        {item.productNameSnapshot || item.title || item.name} ×
                        {item.quantity || 1}
                      </span>
                      {(item.size ||
                        item.selectedSize ||
                        item.color ||
                        item.selectedColor) && (
                        <span className="text-xs text-gray-500 block">
                          Variant:{" "}
                          {[
                            item.size || item.selectedSize,
                            item.color || item.selectedColor,
                          ]
                            .filter(Boolean)
                            .join(" / ")}
                        </span>
                      )}
                      <span className="text-[11px] text-gray-500 block mt-0.5">
                        {itemMsg ? (
                          <span className="text-amber-900 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded inline-block">
                            Note: &ldquo;{itemMsg}&rdquo;
                          </span>
                        ) : (
                          <span className="italic text-gray-400">
                            No special instructions.
                          </span>
                        )}
                      </span>
                    </div>
                  </div>
                  <span className="font-semibold text-gray-900 shrink-0">
                    {currency.format(
                      Number(item.price || item.unitPriceSnapshot || 0) *
                        Number(item.quantity || 1)
                    )}
                  </span>
                </div>
              );
            })}
            {Array.isArray(order.freeGifts) &&
              order.freeGifts.map((gift, gIdx) => (
                <div
                  key={`gift-${gIdx}`}
                  className="flex justify-between items-center text-xs font-semibold text-emerald-800 bg-emerald-50 border border-emerald-200 rounded px-2.5 py-1.5"
                >
                  <span className="flex items-center gap-1.5">
                    <Gift size={13} className="text-emerald-600" />
                    FREE GIFT:{" "}
                    {gift.earnedGiftQty || gift.totalFreeGiftQty || 1}x{" "}
                    {gift.giftName}
                  </span>
                  <span className="font-bold text-emerald-700">
                    FREE ($0.00)
                  </span>
                </div>
              ))}
          </div>

          <SummaryRow label="SUBTOTAL" value={currency.format(subtotal)} />
          {tieredDiscount > 0 && (
            <SummaryRow
              label="VIP SPEND DISCOUNT"
              value={`-${currency.format(tieredDiscount)}`}
            />
          )}
          {discount > 0 && (
            <SummaryRow
              label={`COUPON DISCOUNT${couponCode ? ` (${couponCode})` : ""}`}
              value={`-${currency.format(discount)}`}
            />
          )}
          {giftWrapCost > 0 && (
            <SummaryRow
              label="LUXURY GIFT PACKAGING"
              value={`+${currency.format(giftWrapCost)}`}
            />
          )}
          <SummaryRow
            label="SHIPPING"
            value={shipping ? currency.format(shipping) : "Free shipping"}
          />
          <SummaryRow label="VAT" value={currency.format(vat)} />
          <SummaryRow label="PAYMENT METHOD" value={paymentMethod} />
          <SummaryRow label="PAYMENT STATUS" value={paymentStatus} />
          <SummaryRow
            label="TOTAL"
            value={currency.format(total)}
            bold
            noBorder
          />
        </div>

        <div className="mt-6 border border-gray-200 rounded-md px-6 py-6">
          <h2 className="text-xs font-semibold text-primary mb-5">
            BILLING DETAILS
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm text-gray-600">
            <OrderMeta label="Name" value={order.username || "Not provided"} />
            <OrderMeta label="Email" value={order.email || "Not provided"} />
            <OrderMeta
              label="Company"
              value={billing.company || "Not provided"}
            />
            <OrderMeta label="Phone" value={billing.phone || "Not provided"} />
            <OrderMeta
              label="Address"
              value={
                [billing.streetAddress, billing.apartment]
                  .filter(Boolean)
                  .join(", ") || "Not provided"
              }
            />
            <OrderMeta
              label="City / Province"
              value={
                [billing.city, billing.province].filter(Boolean).join(", ") ||
                "Not provided"
              }
            />
            <OrderMeta
              label="Country"
              value={billing.country || "Not provided"}
            />
            <OrderMeta
              label="Postcode"
              value={billing.postcode || "Not provided"}
            />
            {billing.orderNotes && (
              <OrderMeta label="Order Notes" value={billing.orderNotes} />
            )}
          </div>
        </div>

        {/* Action buttons */}
        <div className="flex flex-wrap justify-center gap-4 mt-10">
          <Link
            to="/profile"
            className="inline-block border border-gray-900 text-gray-900 text-sm font-semibold px-7 py-3.5 rounded-md hover:bg-gray-50 transition-colors"
          >
            TRACK IN DASHBOARD
          </Link>
          <Link
            to="/shop"
            className="inline-block bg-gray-900 text-white text-sm font-semibold px-7 py-3.5 rounded-md hover:bg-gray-800 transition-colors"
          >
            CONTINUE SHOPPING
          </Link>
        </div>
      </div>
    </div>
  );
}

function OrderMeta({ label, value }) {
  return (
    <div>
      <p className="text-xs text-gray mb-0.5">{label}</p>
      <p className="text-sm font-semibold text-primary break-words">{value}</p>
    </div>
  );
}

function SummaryRow({ label, value, bold = false, noBorder = false }) {
  return (
    <div
      className={`flex justify-between items-center py-2.5 text-xs ${
        noBorder ? "" : "border-b border-gray-200"
      } ${bold ? "font-semibold text-gray-900" : "font-semibold text-primary"}`}
    >
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}
