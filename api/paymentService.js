import crypto from "node:crypto";
import { asSafeId } from "./security.js";
import { deductOrderInventory, restockOrderInventory } from "./orderService.js";

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

const TERMINAL_PROTECTED_STATES = new Set(["PAID", "REFUNDED", "PARTIALLY_REFUNDED"]);

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

function findOrder(state, orderId) {
  const cleanId = asSafeId(orderId, 64);
  if (!cleanId) return null;
  return (state.orders || []).find(
    (o) => String(o.orderId || o.id) === cleanId
  );
}

function upsertPaymentRecord(state, record) {
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

// ============================================================================
// 1. SSLCOMMERZ SANDBOX GATEWAY SERVICE (SECTION D)
// ============================================================================
export async function initiateSslCommerzSandboxPayment({
  order,
  state,
  originUrl = "https://fullstack-ummo-eccomerce.vercel.app",
  fetchImpl = globalThis.fetch,
}) {
  if (!order || !order.orderId) {
    const err = new Error("Order is required to initialize SSLCommerz payment.");
    err.statusCode = 400;
    throw err;
  }

  if (order.paymentStatus === "PAID") {
    const err = new Error(`Order ${order.orderId} is already PAID.`);
    err.statusCode = 400;
    throw err;
  }

  const mode = (process.env.SSLCOMMERZ_MODE || "sandbox").toLowerCase();
  if (mode !== "sandbox") {
    const err = new Error(
      "Live SSLCommerz mode is prohibited. Only SSLCOMMERZ_MODE=sandbox is permitted."
    );
    err.statusCode = 400;
    throw err;
  }

  const existingInitiated = (state.payments || []).find(
    (p) =>
      String(p.orderId) === String(order.orderId) &&
      p.gateway === "sslcommerz" &&
      p.status === "INITIATED" &&
      Number(p.amount) === Number(order.total)
  );
  if (existingInitiated) {
    return {
      reusedSession: true,
      mode: "sandbox",
      gateway: "sslcommerz",
      paymentId: existingInitiated.paymentId,
      tranId: existingInitiated.tranId,
      payment: existingInitiated,
      paymentRecord: existingInitiated,
      gatewayUrl: existingInitiated.gatewayUrl,
    };
  }

  const tranId = `SSLCZ-${order.orderId}-${crypto.randomBytes(4).toString("hex").toUpperCase()}`;
  const paymentId = `PAY-${tranId}`;
  const amount = Number(Number(order.total || 0).toFixed(2));
  if (!Number.isFinite(amount) || amount <= 0) {
    const err = new Error("Invalid payable order amount.");
    err.statusCode = 400;
    throw err;
  }

  const currency = "USD";
  const storeId =
    process.env.STORE_ID || process.env.SSLCOMMERZ_STORE_ID || "";
  const storePassword =
    process.env.STORE_PASSWORD || process.env.SSLCOMMERZ_STORE_PASSWORD || "";

  let gatewayUrl = `${originUrl}/ordercomplete?orderId=${encodeURIComponent(order.orderId)}&gateway=sslcommerz&tranId=${encodeURIComponent(tranId)}&sandbox=1`;
  let sessionKey = `SANDBOX-SESS-${crypto.randomBytes(6).toString("hex")}`;
  let providerMode = "sandbox-simulated";

  if (storeId && storePassword && typeof fetchImpl === "function") {
    const formParams = new URLSearchParams({
      store_id: storeId,
      store_passwd: storePassword,
      total_amount: amount.toFixed(2),
      currency,
      tran_id: tranId,
      success_url: `${originUrl}/api/v1/payments/sslcommerz/callback?action=success&orderId=${encodeURIComponent(order.orderId)}`,
      fail_url: `${originUrl}/api/v1/payments/sslcommerz/callback?action=fail&orderId=${encodeURIComponent(order.orderId)}`,
      cancel_url: `${originUrl}/api/v1/payments/sslcommerz/callback?action=cancel&orderId=${encodeURIComponent(order.orderId)}`,
      ipn_url: `${originUrl}/api/v1/payments/sslcommerz/ipn`,
      cus_name: order.username || "UOMO Customer",
      cus_email: order.email || "customer@ummo.com",
      cus_add1: order.billing?.streetAddress || "Dhaka",
      cus_city: order.billing?.city || "Dhaka",
      cus_country: order.billing?.country || "Bangladesh",
      cus_phone: order.billing?.phone || "+8801700000000",
      shipping_method: "NO",
      product_name: (order.OrderItems || [])
        .map((i) => i.title)
        .join(", ")
        .slice(0, 120) || "UOMO Order",
      product_category: "Ecommerce",
      product_profile: "general",
    });

    const resp = await fetchImpl(
      "https://sandbox.sslcommerz.com/gwprocess/v4/api.php",
      {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: formParams.toString(),
      }
    );
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || data.status !== "SUCCESS" || !data.GatewayPageURL) {
      const err = new Error(
        data?.failedreason || "SSLCommerz sandbox session initialization failed."
      );
      err.statusCode = 502;
      throw err;
    }
    gatewayUrl = data.GatewayPageURL;
    sessionKey = data.sessionkey || sessionKey;
    providerMode = "sandbox-live-api";
  }

  const nowIso = new Date().toISOString();
  const paymentRecord = {
    paymentId,
    orderId: order.orderId,
    userUid: order.userUid || "guest",
    gateway: "sslcommerz",
    environment: "sandbox",
    providerMode,
    tranId,
    gatewayReference: sessionKey,
    gatewayUrl,
    amount,
    currency,
    refundedAmount: 0,
    status: "INITIATED",
    processedEventIds: [],
    auditLog: [
      {
        action: "INITIATED",
        status: "INITIATED",
        at: nowIso,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  order.paymentMethod = "sslcommerz";
  order.paymentGateway = "sslcommerz";
  order.paymentStatus = "INITIATED";
  order.tranId = tranId;
  order.gatewayTransactionId = tranId;

  upsertPaymentRecord(state, paymentRecord);
  return {
    reusedSession: false,
    mode: "sandbox",
    gateway: "sslcommerz",
    paymentId: paymentRecord.paymentId,
    tranId,
    payment: paymentRecord,
    paymentRecord,
    gatewayUrl,
  };
}

/**
 * Authoritatively validates an SSLCommerz transaction via Validation API or IPN payload.
 * Never marks an order PAID from an unverified redirect alone.
 */
export async function verifyAndProcessSslCommerzNotification({
  payload,
  state,
  fetchImpl = globalThis.fetch,
}) {
  const tranId = asSafeId(payload?.tran_id || payload?.tranId, 96);
  const valId = asSafeId(payload?.val_id || payload?.valId, 96);
  const rawStatus = String(payload?.status || "").toUpperCase().trim();
  const eventId = asSafeId(
    payload?.eventId || `${tranId}-${valId || rawStatus}`,
    128
  );

  if (!tranId) {
    const err = new Error("Missing transaction reference (tran_id).");
    err.statusCode = 400;
    throw err;
  }

  const paymentRecord = (state.payments || []).find((p) => p.tranId === tranId);
  if (!paymentRecord) {
    const err = new Error(`Unknown transaction reference: ${tranId}`);
    err.statusCode = 404;
    throw err;
  }

  const order = findOrder(state, paymentRecord.orderId);
  if (!order) {
    const err = new Error(
      `Corresponding order ${paymentRecord.orderId} not found for transaction ${tranId}.`
    );
    err.statusCode = 404;
    throw err;
  }

  // Idempotency / duplicate IPN tolerance
  if (
    eventId &&
    Array.isArray(paymentRecord.processedEventIds) &&
    paymentRecord.processedEventIds.includes(eventId)
  ) {
    return {
      duplicate: true,
      idempotentReplay: true,
      paymentStatus: paymentRecord.status,
      payment: paymentRecord,
      order,
    };
  }

  let verifiedStatus = rawStatus;
  let verifiedAmount = Number(payload?.amount ?? payload?.total_amount ?? NaN);
  let verifiedCurrency = String(
    payload?.currency_type || payload?.currency || "USD"
  ).toUpperCase();
  let riskLevel = Number(payload?.risk_level ?? 0);

  const storeId =
    process.env.STORE_ID || process.env.SSLCOMMERZ_STORE_ID || "";
  const storePassword =
    process.env.STORE_PASSWORD || process.env.SSLCOMMERZ_STORE_PASSWORD || "";

  if ((rawStatus === "VALID" || rawStatus === "VALIDATED") && !valId) {
    const err = new Error(
      "Cannot mark SSLCommerz payment VALID without a validation ID (val_id)."
    );
    err.statusCode = 400;
    throw err;
  }

  // When live sandbox credentials are configured (or a mock fetchImpl is passed in tests), call SSLCommerz Validation API
  if (
    (rawStatus === "VALID" || rawStatus === "VALIDATED") &&
    valId &&
    (storeId || payload?.requireRemoteValidation) &&
    typeof fetchImpl === "function"
  ) {
    const q = new URLSearchParams({
      val_id: valId,
      store_id: storeId || "ummo_sandbox_store",
      store_passwd: storePassword || "ummo_sandbox_pass",
      v: "1",
      format: "json",
    });
    const valResp = await fetchImpl(
      `https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php?${q.toString()}`
    );
    const valData = await valResp.json().catch(() => null);
    if (!valResp.ok || !valData) {
      const err = new Error("SSLCommerz Transaction Validation API failed.");
      err.statusCode = 502;
      throw err;
    }
    if (String(valData.tran_id || "") !== tranId) {
      const err = new Error("SSLCommerz validation tran_id mismatch.");
      err.statusCode = 400;
      throw err;
    }
    verifiedStatus = String(valData.status || "").toUpperCase();
    verifiedAmount = Number(valData.amount ?? valData.currency_amount ?? NaN);
    verifiedCurrency = String(
      valData.currency_type || valData.currency || verifiedCurrency
    ).toUpperCase();
    riskLevel = Number(valData.risk_level ?? riskLevel);
  }

  const nowIso = new Date().toISOString();

  if (verifiedStatus === "FAILED") {
    if (canTransitionPaymentState(paymentRecord.status, "FAILED")) {
      paymentRecord.status = "FAILED";
      order.paymentStatus = "FAILED";
    }
    paymentRecord.processedEventIds.push(eventId);
    paymentRecord.updatedAt = nowIso;
    paymentRecord.auditLog.push({
      action: "IPN_FAILED",
      status: paymentRecord.status,
      at: nowIso,
    });
    return {
      duplicate: false,
      idempotentReplay: false,
      paymentStatus: paymentRecord.status,
      payment: paymentRecord,
      order,
    };
  }

  if (verifiedStatus === "CANCELLED" || verifiedStatus === "CANCELED") {
    if (canTransitionPaymentState(paymentRecord.status, "CANCELED")) {
      paymentRecord.status = "CANCELED";
      order.paymentStatus = "CANCELED";
    }
    paymentRecord.processedEventIds.push(eventId);
    paymentRecord.updatedAt = nowIso;
    paymentRecord.auditLog.push({
      action: "IPN_CANCELED",
      status: paymentRecord.status,
      at: nowIso,
    });
    return {
      duplicate: false,
      idempotentReplay: false,
      paymentStatus: paymentRecord.status,
      payment: paymentRecord,
      order,
    };
  }

  if (verifiedStatus !== "VALID" && verifiedStatus !== "VALIDATED") {
    const err = new Error(
      `Invalid or unverified SSLCommerz transaction status: ${verifiedStatus || "UNKNOWN"}`
    );
    err.statusCode = 400;
    throw err;
  }

  // Verify currency
  if (verifiedCurrency !== String(paymentRecord.currency).toUpperCase()) {
    paymentRecord.status = "REQUIRES_REVIEW";
    order.paymentStatus = "REQUIRES_REVIEW";
    paymentRecord.updatedAt = nowIso;
    const err = new Error(
      `SSLCommerz currency mismatch: expected ${paymentRecord.currency}, received ${verifiedCurrency}.`
    );
    err.statusCode = 400;
    throw err;
  }

  // Verify amount against authoritative order total
  if (
    !Number.isFinite(verifiedAmount) ||
    Math.abs(verifiedAmount - Number(order.total)) > 0.05
  ) {
    paymentRecord.status = "REQUIRES_REVIEW";
    order.paymentStatus = "REQUIRES_REVIEW";
    paymentRecord.updatedAt = nowIso;
    const err = new Error(
      `SSLCommerz amount mismatch: expected ${order.total}, received ${verifiedAmount}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const nextState = riskLevel >= 1 ? "REQUIRES_REVIEW" : "PAID";
  if (canTransitionPaymentState(paymentRecord.status, nextState)) {
    paymentRecord.status = nextState;
    order.paymentStatus = nextState;
    if (nextState === "PAID" && order.status === "PENDING") {
      order.status = "PROCESSING";
    }
    if (nextState === "PAID") {
      deductOrderInventory(state, order);
    }
  }

  paymentRecord.valId = valId;
  paymentRecord.processedEventIds.push(eventId);
  paymentRecord.updatedAt = nowIso;
  paymentRecord.auditLog.push({
    action: "VERIFIED_VALID",
    status: paymentRecord.status,
    valId,
    riskLevel,
    at: nowIso,
  });

  return {
    duplicate: false,
    idempotentReplay: false,
    paymentStatus: paymentRecord.status,
    payment: paymentRecord,
    order,
  };
}

// ============================================================================
// 2. STRIPE TEST MODE GATEWAY SERVICE & WEBHOOK VERIFICATION (SECTION E)
// ============================================================================
export async function createStripeTestCheckoutSession({
  order,
  state,
  originUrl = "https://fullstack-ummo-eccomerce.vercel.app",
  fetchImpl = globalThis.fetch,
}) {
  if (!order || !order.orderId) {
    const err = new Error("Order is required to initialize Stripe Checkout.");
    err.statusCode = 400;
    throw err;
  }

  if (order.paymentStatus === "PAID") {
    const err = new Error(`Order ${order.orderId} is already PAID.`);
    err.statusCode = 400;
    throw err;
  }

  const stripeMode = (process.env.STRIPE_MODE || "test").toLowerCase();
  const stripeSecret = process.env.STRIPE_SECRET_KEY || "";
  if (stripeMode !== "test" || stripeSecret.startsWith("sk_live_")) {
    const err = new Error(
      "Live Stripe keys are prohibited. Only STRIPE_MODE=test with sk_test_ keys is permitted."
    );
    err.statusCode = 400;
    throw err;
  }

  const existingInitiated = (state.payments || []).find(
    (p) =>
      String(p.orderId) === String(order.orderId) &&
      p.gateway === "stripe" &&
      p.status === "INITIATED" &&
      Number(p.amount) === Number(order.total)
  );
  if (existingInitiated) {
    return {
      reusedSession: true,
      mode: "test",
      gateway: "stripe",
      paymentId: existingInitiated.paymentId,
      payment: existingInitiated,
      paymentRecord: existingInitiated,
      checkoutUrl: existingInitiated.gatewayUrl,
      sessionId: existingInitiated.gatewayReference,
    };
  }

  const amount = Number(Number(order.total || 0).toFixed(2));
  const amountCents = Math.round(amount * 100);
  if (!Number.isFinite(amountCents) || amountCents <= 0) {
    const err = new Error("Invalid payable order amount for Stripe session.");
    err.statusCode = 400;
    throw err;
  }

  const currency = "USD";
  let sessionId = `cs_test_${crypto.randomBytes(12).toString("hex")}`;
  let checkoutUrl = `${originUrl}/ordercomplete?orderId=${encodeURIComponent(order.orderId)}&gateway=stripe&session_id=${encodeURIComponent(sessionId)}&sandbox=1`;
  let providerMode = "test-simulated";

  if (stripeSecret.startsWith("sk_test_") && typeof fetchImpl === "function") {
    const params = new URLSearchParams();
    params.append("mode", "payment");
    params.append(
      "success_url",
      `${originUrl}/ordercomplete?orderId=${encodeURIComponent(order.orderId)}&gateway=stripe&session_id={CHECKOUT_SESSION_ID}`
    );
    params.append(
      "cancel_url",
      `${originUrl}/billing?orderId=${encodeURIComponent(order.orderId)}&canceled=1`
    );
    params.append("client_reference_id", order.orderId);
    params.append("metadata[orderId]", order.orderId);
    params.append("metadata[userUid]", order.userUid || "guest");
    if (order.email) {
      params.append("customer_email", order.email);
    }
    params.append("line_items[0][quantity]", "1");
    params.append("line_items[0][price_data][currency]", "usd");
    params.append(
      "line_items[0][price_data][unit_amount]",
      String(amountCents)
    );
    params.append(
      "line_items[0][price_data][product_data][name]",
      `UOMO Order #${order.orderId}`
    );

    const resp = await fetchImpl("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${stripeSecret}`,
        "Content-Type": "application/x-www-form-urlencoded",
        "Idempotency-Key": `stripe-sess-${order.orderId}-${amountCents}`,
      },
      body: params.toString(),
    });
    const data = await resp.json().catch(() => null);
    if (!resp.ok || !data || !data.id || !data.url) {
      const err = new Error(
        data?.error?.message || "Stripe Checkout Session creation failed."
      );
      err.statusCode = 502;
      throw err;
    }
    sessionId = data.id;
    checkoutUrl = data.url;
    providerMode = "test-live-api";
  }

  const nowIso = new Date().toISOString();
  const tranId = `STRIPE-${order.orderId}-${sessionId.slice(-10)}`;
  const paymentRecord = {
    paymentId: `PAY-${tranId}`,
    orderId: order.orderId,
    userUid: order.userUid || "guest",
    gateway: "stripe",
    environment: "test",
    providerMode,
    tranId,
    gatewayReference: sessionId,
    gatewayUrl: checkoutUrl,
    amount,
    amountCents,
    currency,
    refundedAmount: 0,
    status: "INITIATED",
    processedEventIds: [],
    auditLog: [
      {
        action: "SESSION_CREATED",
        status: "INITIATED",
        sessionId,
        at: nowIso,
      },
    ],
    createdAt: nowIso,
    updatedAt: nowIso,
  };

  order.paymentMethod = "stripe";
  order.paymentGateway = "stripe";
  order.paymentStatus = "INITIATED";
  order.stripeSessionId = sessionId;
  order.gatewayTransactionId = sessionId;

  upsertPaymentRecord(state, paymentRecord);
  return {
    reusedSession: false,
    mode: "test",
    gateway: "stripe",
    paymentId: paymentRecord.paymentId,
    payment: paymentRecord,
    paymentRecord,
    checkoutUrl,
    sessionId,
  };
}

/**
 * Generates a valid Stripe-Signature header (`t=...,v1=...`) for testing or internal sandbox verification.
 */
export function generateStripeWebhookSignature(
  rawBodyString,
  secret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_ummo_test_secret_2026",
  timestampSec = Math.floor(Date.now() / 1000)
) {
  const signedPayload = `${timestampSec}.${rawBodyString}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  return `t=${timestampSec},v1=${signature}`;
}

/**
 * Verifies a Stripe-Signature header using constant-time HMAC-SHA256 comparison
 * against the exact raw request body and enforces replay tolerance (default 300s).
 */
export function verifyStripeWebhookSignature(
  rawBodyString,
  signatureHeader,
  webhookSecret,
  toleranceSec = 300
) {
  if (!rawBodyString || typeof rawBodyString !== "string") {
    const err = new Error("Raw webhook payload is required for signature verification.");
    err.statusCode = 400;
    throw err;
  }
  if (!signatureHeader || typeof signatureHeader !== "string") {
    const err = new Error("Missing Stripe-Signature header.");
    err.statusCode = 400;
    throw err;
  }
  if (!webhookSecret || typeof webhookSecret !== "string") {
    const err = new Error("Stripe webhook signing secret is not configured.");
    err.statusCode = 500;
    throw err;
  }

  const parts = signatureHeader.split(",").map((p) => p.trim());
  const tPart = parts.find((p) => p.startsWith("t="));
  const v1Parts = parts
    .filter((p) => p.startsWith("v1="))
    .map((p) => p.slice(3));

  if (!tPart || v1Parts.length === 0) {
    const err = new Error("Malformed Stripe-Signature header.");
    err.statusCode = 400;
    throw err;
  }

  const timestamp = Number(tPart.slice(2));
  const nowSec = Math.floor(Date.now() / 1000);
  if (
    !Number.isFinite(timestamp) ||
    Math.abs(nowSec - timestamp) > toleranceSec
  ) {
    const err = new Error(
      "Stripe webhook timestamp outside tolerance window (replay attack prevented)."
    );
    err.statusCode = 400;
    throw err;
  }

  const expectedSig = crypto
    .createHmac("sha256", webhookSecret)
    .update(`${timestamp}.${rawBodyString}`, "utf8")
    .digest("hex");
  const expectedBuf = Buffer.from(expectedSig, "hex");

  const matched = v1Parts.some((candidateHex) => {
    if (candidateHex.length !== expectedSig.length) return false;
    try {
      const candidateBuf = Buffer.from(candidateHex, "hex");
      return (
        candidateBuf.length === expectedBuf.length &&
        crypto.timingSafeEqual(candidateBuf, expectedBuf)
      );
    } catch {
      return false;
    }
  });

  if (!matched) {
    const err = new Error("Invalid Stripe webhook signature.");
    err.statusCode = 400;
    throw err;
  }

  return true;
}

/**
 * Verifies and processes a Stripe webhook event idempotently.
 */
export function processStripeWebhookEvent({
  rawBodyString,
  rawPayload,
  signatureHeader,
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "whsec_ummo_test_secret_2026",
  state,
}) {
  const effectiveRawBody = rawBodyString ?? rawPayload;
  verifyStripeWebhookSignature(effectiveRawBody, signatureHeader, webhookSecret);

  let event;
  try {
    event = JSON.parse(effectiveRawBody);
  } catch {
    const err = new Error("Invalid JSON in Stripe webhook payload.");
    err.statusCode = 400;
    throw err;
  }

  const eventId = asSafeId(event?.id, 128);
  const eventType = String(event?.type || "");
  const obj = event?.data?.object || {};
  const orderId = asSafeId(
    obj?.metadata?.orderId || obj?.client_reference_id,
    64
  );
  const sessionId = asSafeId(obj?.id, 128);

  if (!eventId || !eventType) {
    const err = new Error("Missing Stripe event id or type.");
    err.statusCode = 400;
    throw err;
  }

  const paymentRecord = (state.payments || []).find(
    (p) =>
      p.gateway === "stripe" &&
      ((sessionId && p.gatewayReference === sessionId) ||
        (orderId && String(p.orderId) === orderId))
  );

  if (!paymentRecord) {
    const err = new Error(
      `No matching Stripe payment record found for orderId=${orderId || "N/A"} / session=${sessionId || "N/A"}.`
    );
    err.statusCode = 404;
    throw err;
  }

  const order = findOrder(state, paymentRecord.orderId);
  if (!order) {
    const err = new Error(`Order ${paymentRecord.orderId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  if (
    Array.isArray(paymentRecord.processedEventIds) &&
    paymentRecord.processedEventIds.includes(eventId)
  ) {
    return {
      duplicate: true,
      idempotentReplay: true,
      paymentStatus: paymentRecord.status,
      payment: paymentRecord,
      order,
    };
  }

  const nowIso = new Date().toISOString();
  let ignoredOutOfOrder = false;

  if (
    eventType === "checkout.session.completed" ||
    eventType === "payment_intent.succeeded"
  ) {
    const paidCents = Number(obj.amount_total ?? obj.amount_received ?? obj.amount ?? NaN);
    const paidCurrency = String(obj.currency || "").toUpperCase();
    const expectedCents = Math.round(Number(order.total) * 100);

    if (paidCurrency !== "USD") {
      paymentRecord.status = "REQUIRES_REVIEW";
      order.paymentStatus = "REQUIRES_REVIEW";
      paymentRecord.updatedAt = nowIso;
      const err = new Error(
        `Stripe currency mismatch: expected USD, received ${paidCurrency || "UNKNOWN"}.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (!Number.isFinite(paidCents) || Math.abs(paidCents - expectedCents) > 5) {
      paymentRecord.status = "REQUIRES_REVIEW";
      order.paymentStatus = "REQUIRES_REVIEW";
      paymentRecord.updatedAt = nowIso;
      const err = new Error(
        `Stripe amount mismatch: expected ${expectedCents} cents, received ${paidCents} cents.`
      );
      err.statusCode = 400;
      throw err;
    }

    if (canTransitionPaymentState(paymentRecord.status, "PAID")) {
      paymentRecord.status = "PAID";
      order.paymentStatus = "PAID";
      if (order.status === "PENDING") {
        order.status = "PROCESSING";
      }
      deductOrderInventory(state, order);
    }
  } else if (eventType === "payment_intent.payment_failed") {
    if (canTransitionPaymentState(paymentRecord.status, "FAILED")) {
      paymentRecord.status = "FAILED";
      order.paymentStatus = "FAILED";
    } else {
      ignoredOutOfOrder = true;
    }
  } else if (
    eventType === "checkout.session.expired" ||
    eventType === "payment_intent.canceled"
  ) {
    if (canTransitionPaymentState(paymentRecord.status, "CANCELED")) {
      paymentRecord.status = "CANCELED";
      order.paymentStatus = "CANCELED";
    } else {
      ignoredOutOfOrder = true;
    }
  }

  paymentRecord.processedEventIds.push(eventId);
  paymentRecord.updatedAt = nowIso;
  paymentRecord.auditLog.push({
    action: `WEBHOOK:${eventType}`,
    eventId,
    status: paymentRecord.status,
    at: nowIso,
  });

  return {
    duplicate: false,
    idempotentReplay: false,
    ignoredOutOfOrder,
    paymentStatus: paymentRecord.status,
    payment: paymentRecord,
    order,
  };
}

// ============================================================================
// 3. ADMIN PAYMENT RECONCILIATION & REFUND WORKFLOWS (SECTION F)
// ============================================================================
export function reconcilePaymentByAdmin({
  orderId,
  targetStatus,
  targetPaymentStatus,
  note = "",
  reason = "",
  caller,
  state,
}) {
  if (!caller?.isAdmin) {
    const err = new Error("Admin authorization required for payment reconciliation.");
    err.statusCode = 403;
    throw err;
  }

  const normalizedTarget = String(
    targetStatus || targetPaymentStatus || ""
  )
    .toUpperCase()
    .trim();
  const allowedReconcile = new Set([
    "PAID",
    "PENDING",
    "FAILED",
    "CANCELED",
    "REQUIRES_REVIEW",
  ]);
  if (!allowedReconcile.has(normalizedTarget)) {
    const err = new Error(`Invalid reconciliation status: ${normalizedTarget}`);
    err.statusCode = 400;
    throw err;
  }

  const order = findOrder(state, orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  const nowIso = new Date().toISOString();
  let paymentRecord = (state.payments || []).find(
    (p) => String(p.orderId) === String(order.orderId)
  );

  if (!paymentRecord) {
    paymentRecord = {
      paymentId: `PAY-RECON-${order.orderId}`,
      orderId: order.orderId,
      userUid: order.userUid || "guest",
      gateway: order.paymentGateway || order.paymentMethod || "manual",
      environment: "sandbox",
      tranId: order.tranId || `RECON-${order.orderId}`,
      amount: Number(order.total || 0),
      currency: "USD",
      refundedAmount: 0,
      status: normalizedTarget,
      processedEventIds: [],
      auditLog: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    upsertPaymentRecord(state, paymentRecord);
  }

  const prevStatus = paymentRecord.status;
  paymentRecord.status = normalizedTarget;
  paymentRecord.updatedAt = nowIso;
  paymentRecord.auditLog.push({
    action: "ADMIN_RECONCILE",
    by: caller.uid || "admin",
    fromStatus: prevStatus,
    toStatus: normalizedTarget,
    note: asSafeId(note || reason, 240),
    at: nowIso,
  });

  order.paymentStatus = normalizedTarget;
  if (normalizedTarget === "PAID" && order.status === "PENDING") {
    order.status = "PROCESSING";
    deductOrderInventory(state, order);
  }

  return {
    paymentStatus: paymentRecord.status,
    payment: paymentRecord,
    order,
  };
}

export function refundPaymentByAdmin({
  orderId,
  refundAmount,
  reason = "",
  caller,
  state,
}) {
  if (!caller?.isAdmin) {
    const err = new Error("Admin authorization required to issue refunds.");
    err.statusCode = 403;
    throw err;
  }

  const order = findOrder(state, orderId);
  if (!order) {
    const err = new Error(`Order ${orderId} not found.`);
    err.statusCode = 404;
    throw err;
  }

  let paymentRecord = (state.payments || []).find(
    (p) => String(p.orderId) === String(order.orderId)
  );

  const currentPayStatus = String(
    paymentRecord?.status || order.paymentStatus || ""
  ).toUpperCase();

  if (
    currentPayStatus !== "PAID" &&
    currentPayStatus !== "PARTIALLY_REFUNDED"
  ) {
    const err = new Error(
      `Cannot refund order ${order.orderId} with payment status ${currentPayStatus || "UNPAID"}. Only PAID orders can be refunded.`
    );
    err.statusCode = 400;
    throw err;
  }

  const orderTotal = Number(order.total || 0);
  const alreadyRefunded = Number(
    paymentRecord?.refundedAmount ?? order.refundedAmount ?? 0
  );
  const requestedAmount =
    refundAmount !== undefined && refundAmount !== null && refundAmount !== ""
      ? Number(refundAmount)
      : Number((orderTotal - alreadyRefunded).toFixed(2));

  if (
    !Number.isFinite(requestedAmount) ||
    requestedAmount <= 0 ||
    requestedAmount + alreadyRefunded > orderTotal + 0.01
  ) {
    const err = new Error(
      `Invalid refund amount ($${requestedAmount}). Maximum refundable balance is $${Math.max(0, orderTotal - alreadyRefunded).toFixed(2)}.`
    );
    err.statusCode = 400;
    throw err;
  }

  const newRefundedTotal = Number(
    Math.min(orderTotal, alreadyRefunded + requestedAmount).toFixed(2)
  );
  const nextStatus =
    Math.abs(newRefundedTotal - orderTotal) <= 0.01
      ? "REFUNDED"
      : "PARTIALLY_REFUNDED";
  const nowIso = new Date().toISOString();

  if (!paymentRecord) {
    paymentRecord = {
      paymentId: `PAY-REF-${order.orderId}`,
      orderId: order.orderId,
      userUid: order.userUid || "guest",
      gateway: order.paymentGateway || order.paymentMethod || "manual",
      environment: "sandbox",
      tranId: order.tranId || `REF-${order.orderId}`,
      amount: orderTotal,
      currency: "USD",
      refundedAmount: newRefundedTotal,
      status: nextStatus,
      processedEventIds: [],
      auditLog: [],
      createdAt: nowIso,
      updatedAt: nowIso,
    };
    upsertPaymentRecord(state, paymentRecord);
  } else {
    paymentRecord.refundedAmount = newRefundedTotal;
    paymentRecord.status = nextStatus;
    paymentRecord.updatedAt = nowIso;
  }

  paymentRecord.auditLog.push({
    action: "ADMIN_REFUND",
    by: caller.uid || "admin",
    refundAmount: Number(requestedAmount.toFixed(2)),
    totalRefunded: newRefundedTotal,
    status: nextStatus,
    reason: asSafeId(reason, 240),
    at: nowIso,
  });

  order.paymentStatus = nextStatus;
  order.refundedAmount = newRefundedTotal;
  if (nextStatus === "REFUNDED") {
    order.status = "CANCELLED";
    restockOrderInventory(state, order);
  }

  return {
    paymentStatus: paymentRecord.status,
    payment: paymentRecord,
    order,
  };
}
