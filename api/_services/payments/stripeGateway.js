import crypto from "node:crypto";
import { asSafeId } from "../../security.js";
import { deductOrderInventory } from "../../orderService.js";
import {
  canTransitionPaymentState,
  findOrder,
  upsertPaymentRecord,
} from "./paymentHelpers.js";

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

export function generateStripeWebhookSignature(
  rawBodyString,
  secret = process.env.STRIPE_WEBHOOK_SECRET || "",
  timestampSec = Math.floor(Date.now() / 1000)
) {
  if (!secret || typeof secret !== "string") {
    const err = new Error("Stripe webhook signing secret is not configured.");
    err.statusCode = 500;
    throw err;
  }
  const signedPayload = `${timestampSec}.${rawBodyString}`;
  const signature = crypto
    .createHmac("sha256", secret)
    .update(signedPayload, "utf8")
    .digest("hex");
  return `t=${timestampSec},v1=${signature}`;
}

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

export function processStripeWebhookEvent({
  rawBodyString,
  rawPayload,
  signatureHeader,
  webhookSecret = process.env.STRIPE_WEBHOOK_SECRET || "",
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
    const paidCents = Number(
      obj.amount_total ?? obj.amount_received ?? obj.amount ?? NaN
    );
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
