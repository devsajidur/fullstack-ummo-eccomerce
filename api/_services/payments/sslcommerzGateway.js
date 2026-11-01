import crypto from "node:crypto";
import { asSafeId } from "../../security.js";
import { deductOrderInventory } from "../../orderService.js";
import {
  canTransitionPaymentState,
  findOrder,
  upsertPaymentRecord,
} from "./paymentHelpers.js";

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
      product_name:
        (order.OrderItems || [])
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

  if (
    (rawStatus === "VALID" || rawStatus === "VALIDATED") &&
    valId &&
    (storeId || payload?.requireRemoteValidation) &&
    typeof fetchImpl === "function"
  ) {
    const q = new URLSearchParams({
      val_id: valId,
      store_id: storeId || "",
      store_passwd: storePassword || "",
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
