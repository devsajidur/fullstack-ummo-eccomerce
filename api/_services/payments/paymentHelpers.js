import { asSafeId } from "../../security.js";

export const PAYMENT_STATES = new Set([
  "PENDING",
  "INITIATED",
  "PROCESSING",
  "PAID",
  "FAILED",
  "CANCELED",
  "REFUND_PENDING",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
  "REQUIRES_REVIEW",
]);

const TERMINAL_PROTECTED_STATES = new Set([
  "PAID",
  "REFUNDED",
  "PARTIALLY_REFUNDED",
]);

/**
 * Returns gateway availability and environment configuration without ever exposing secrets.
 */
export function getConfiguredGatewaysStatus() {
  const sslStoreId =
    process.env.STORE_ID || process.env.SSLCOMMERZ_STORE_ID || "";
  const sslStorePass =
    process.env.STORE_PASSWORD || process.env.SSLCOMMERZ_STORE_PASSWORD || "";
  const sslMode = (process.env.SSLCOMMERZ_MODE || "sandbox").toLowerCase();

  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "";
  const stripePublishable =
    process.env.VITE_STRIPE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY ||
    "";
  const stripeMode = (process.env.STRIPE_MODE || "test").toLowerCase();

  return {
    sslcommerz: {
      id: "sslcommerz",
      label: "SSLCommerz Sandbox",
      environment: "sandbox",
      mode: sslMode === "sandbox" ? "sandbox" : "sandbox",
      liveCredentialsConfigured: Boolean(sslStoreId && sslStorePass),
      sandboxReady: true,
      supportedCurrencies: ["USD", "BDT"],
    },
    stripe: {
      id: "stripe",
      label: "Stripe Test Mode",
      environment: "test",
      mode: stripeMode === "test" ? "test" : "test",
      liveCredentialsConfigured: Boolean(
        stripeSecret.startsWith("sk_test_") && stripeWebhookSecret
      ),
      publishableKeyConfigured: Boolean(stripePublishable.startsWith("pk_test_")),
      sandboxReady: true,
      supportedCurrencies: ["USD"],
    },
    cod: {
      id: "cod",
      label: "Cash on Delivery",
      environment: "standard",
      sandboxReady: true,
      supportedCurrencies: ["USD"],
    },
    "bank-transfer": {
      id: "bank-transfer",
      label: "Direct Bank Transfer",
      environment: "standard",
      sandboxReady: true,
      supportedCurrencies: ["USD"],
    },
  };
}

export function findOrder(state, orderId) {
  const cleanId = asSafeId(orderId, 64);
  if (!cleanId) return null;
  return (state.orders || []).find(
    (o) => String(o.orderId || o.id) === cleanId
  );
}

export function upsertPaymentRecord(state, record) {
  if (!Array.isArray(state.payments)) {
    state.payments = [];
  }
  const idx = state.payments.findIndex(
    (p) =>
      p.paymentId === record.paymentId ||
      (record.tranId && p.tranId === record.tranId)
  );
  if (idx >= 0) {
    state.payments[idx] = record;
  } else {
    state.payments.unshift(record);
  }
  return record;
}

/**
 * Enforces safe payment state transitions.
 * Once a payment is PAID, a late/out-of-order FAILED or CANCELED webhook cannot downgrade it.
 */
export function canTransitionPaymentState(currentStatus, nextStatus) {
  if (!PAYMENT_STATES.has(nextStatus)) return false;
  if (!currentStatus || currentStatus === nextStatus) return true;

  if (
    TERMINAL_PROTECTED_STATES.has(currentStatus) &&
    (nextStatus === "FAILED" ||
      nextStatus === "CANCELED" ||
      nextStatus === "INITIATED" ||
      nextStatus === "PENDING")
  ) {
    return false;
  }

  if (currentStatus === "REFUNDED" && nextStatus !== "REFUNDED") {
    return false;
  }

  return true;
}
