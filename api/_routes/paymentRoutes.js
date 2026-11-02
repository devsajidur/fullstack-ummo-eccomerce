import crypto from "node:crypto";
import {
  commitDurableMongoWrite,
  getFullState,
  requireDurableMongoDb,
  saveCloudMirrorState,
} from "../db.js";
import {
  asSafeId,
  isSandboxPaymentSimulationEnabled,
  parseJsonBody,
  resolveCaller,
  sendJson,
} from "../security.js";
import {
  createStripeTestCheckoutSession,
  generateStripeWebhookSignature,
  getConfiguredGatewaysStatus,
  initiateSslCommerzSandboxPayment,
  processStripeWebhookEvent,
  reconcilePaymentByAdmin,
  refundPaymentByAdmin,
  verifyAndProcessSslCommerzNotification,
} from "../paymentService.js";

async function persistPaymentAndOrderMutation(state, result) {
  await commitDurableMongoWrite(async (db) => {
    await Promise.all([
      db
        .collection("payments")
        .updateOne(
          { paymentId: result.payment.paymentId },
          { $set: result.payment },
          { upsert: true }
        ),
      result.order
        ? db
            .collection("orders")
            .updateOne(
              {
                $or: [
                  { orderId: result.order.orderId },
                  { id: result.order.orderId },
                ],
              },
              { $set: result.order }
            )
        : Promise.resolve(),
      db
        .collection("store_config")
        .updateOne(
          { _id: "global" },
          { $set: state.storeConfig },
          { upsert: true }
        ),
    ]);
  });
  await saveCloudMirrorState(state);
}

export async function handlePaymentRoutes({ req, res, method, path }) {
  if (path === "/payments/config") {
    if (method !== "GET") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    sendJson(req, res, 200, {
      status: "ok",
      gateways: getConfiguredGatewaysStatus(),
    });
    return true;
  }

  if (path === "/payments/sslcommerz/init") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    const orderId = asSafeId(body.orderId, 64);
    const targetOrder = state.orders.find(
      (o) => String(o.orderId || o.id) === orderId
    );
    if (!targetOrder) {
      sendJson(req, res, 404, { error: "Order not found." });
      return true;
    }
    if (
      !caller.isAdmin &&
      targetOrder.userUid &&
      targetOrder.userUid !== "guest" &&
      caller.uid &&
      String(targetOrder.userUid) !== caller.uid
    ) {
      sendJson(req, res, 403, {
        error: "Forbidden: Cannot initiate payment for another user's order.",
      });
      return true;
    }

    await requireDurableMongoDb();

    const session = await initiateSslCommerzSandboxPayment({
      order: targetOrder,
      state,
      originUrl: asSafeId(body.originUrl || "http://localhost:5173", 200),
    });

    await commitDurableMongoWrite(async (db) => {
      await Promise.all([
        db
          .collection("payments")
          .updateOne(
            { paymentId: session.paymentId },
            { $set: session.paymentRecord },
            { upsert: true }
          ),
        db
          .collection("orders")
          .updateOne(
            { $or: [{ orderId }, { id: orderId }] },
            {
              $set: {
                paymentStatus: targetOrder.paymentStatus,
                paymentGateway: targetOrder.paymentGateway,
                gatewayTransactionId: targetOrder.gatewayTransactionId,
                updatedAt: targetOrder.updatedAt,
              },
            }
          ),
      ]);
    });
    await saveCloudMirrorState(state);

    sendJson(req, res, 200, {
      status: "ok",
      ...session,
    });
    return true;
  }

  if (
    path === "/payments/sslcommerz/ipn" ||
    path === "/payments/sslcommerz/verify"
  ) {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid IPN payload" });
      return true;
    }
    await requireDurableMongoDb();
    const { state } = await getFullState();
    const result = await verifyAndProcessSslCommerzNotification({
      payload: body,
      state,
    });

    await persistPaymentAndOrderMutation(state, result);
    sendJson(req, res, 200, result);
    return true;
  }

  if (path === "/payments/stripe/create-session") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    const orderId = asSafeId(body.orderId, 64);
    const targetOrder = state.orders.find(
      (o) => String(o.orderId || o.id) === orderId
    );
    if (!targetOrder) {
      sendJson(req, res, 404, { error: "Order not found." });
      return true;
    }
    if (
      !caller.isAdmin &&
      targetOrder.userUid &&
      targetOrder.userUid !== "guest" &&
      caller.uid &&
      String(targetOrder.userUid) !== caller.uid
    ) {
      sendJson(req, res, 403, {
        error: "Forbidden: Cannot initiate payment for another user's order.",
      });
      return true;
    }

    await requireDurableMongoDb();

    const session = await createStripeTestCheckoutSession({
      order: targetOrder,
      state,
      originUrl: asSafeId(body.originUrl || "http://localhost:5173", 200),
    });

    await commitDurableMongoWrite(async (db) => {
      await Promise.all([
        db
          .collection("payments")
          .updateOne(
            { paymentId: session.paymentId },
            { $set: session.paymentRecord },
            { upsert: true }
          ),
        db
          .collection("orders")
          .updateOne(
            { $or: [{ orderId }, { id: orderId }] },
            {
              $set: {
                paymentStatus: targetOrder.paymentStatus,
                paymentGateway: targetOrder.paymentGateway,
                gatewayTransactionId: targetOrder.gatewayTransactionId,
                updatedAt: targetOrder.updatedAt,
              },
            }
          ),
      ]);
    });
    await saveCloudMirrorState(state);

    sendJson(req, res, 200, {
      status: "ok",
      ...session,
    });
    return true;
  }

  if (path === "/payments/stripe/webhook") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid webhook payload" });
      return true;
    }
    const rawPayload =
      typeof req.rawBody === "string" ? req.rawBody : JSON.stringify(body);
    const signatureHeader =
      req.headers?.["stripe-signature"] ||
      req.headers?.["Stripe-Signature"] ||
      "";

    await requireDurableMongoDb();
    const { state } = await getFullState();
    const result = processStripeWebhookEvent({
      rawPayload,
      signatureHeader,
      state,
    });

    await persistPaymentAndOrderMutation(state, result);
    sendJson(req, res, 200, result);
    return true;
  }

  if (path === "/payments/sandbox-confirm") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    if (!isSandboxPaymentSimulationEnabled(process.env)) {
      sendJson(req, res, 403, {
        error:
          "Sandbox payment simulation is disabled by default. Explicit non-production sandbox configuration (PAYMENT_MODE=sandbox and ALLOW_SANDBOX_CONFIRM=true) is required.",
      });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    if (!caller.isAuthenticated) {
      sendJson(req, res, 401, {
        error: "Authentication required to confirm sandbox payment.",
      });
      return true;
    }
    const orderId = asSafeId(body.orderId, 64);
    const gateway = asSafeId(body.gateway || "sslcommerz", 32).toLowerCase();
    const outcome = asSafeId(body.outcome || "PAID", 32).toUpperCase();

    const targetOrder = state.orders.find(
      (o) => String(o.orderId || o.id) === orderId
    );
    if (!targetOrder) {
      sendJson(req, res, 404, { error: "Order not found." });
      return true;
    }
    if (
      !caller.isAdmin &&
      targetOrder.userUid &&
      targetOrder.userUid !== "guest" &&
      String(targetOrder.userUid) !== caller.uid
    ) {
      sendJson(req, res, 403, {
        error:
          "Forbidden: Cannot confirm sandbox payment for another user's order.",
      });
      return true;
    }

    await requireDurableMongoDb();

    let result;
    if (gateway === "stripe") {
      const paymentRecord = (state.payments || []).find(
        (p) => String(p.orderId) === orderId && p.gateway === "stripe"
      );
      const sessionId =
        paymentRecord?.gatewayTransactionId ||
        targetOrder.gatewayTransactionId ||
        `cs_test_${orderId}`;
      const eventType =
        outcome === "PAID" || outcome === "VALID"
          ? "checkout.session.completed"
          : outcome === "CANCELED" || outcome === "CANCELLED"
            ? "checkout.session.expired"
            : "payment_intent.payment_failed";
      const eventPayload = JSON.stringify({
        id: `evt_test_${Date.now()}_${orderId}`,
        type: eventType,
        data: {
          object: {
            id: sessionId,
            payment_intent: `pi_test_${orderId}`,
            amount_total: Math.round(Number(targetOrder.totalAmount || 0) * 100),
            currency: "usd",
            payment_status:
              eventType === "checkout.session.completed" ? "paid" : "unpaid",
            metadata: {
              orderId: targetOrder.orderId,
              paymentId: paymentRecord?.paymentId || "",
            },
          },
        },
      });
      const simSecret =
        process.env.STRIPE_WEBHOOK_SECRET ||
        crypto.randomBytes(24).toString("hex");
      const sig = generateStripeWebhookSignature(eventPayload, simSecret);
      result = processStripeWebhookEvent({
        rawPayload: eventPayload,
        signatureHeader: sig,
        webhookSecret: simSecret,
        state,
      });
    } else {
      const paymentRecord = (state.payments || []).find(
        (p) => String(p.orderId) === orderId && p.gateway === "sslcommerz"
      );
      const tranId =
        paymentRecord?.gatewayTransactionId ||
        targetOrder.gatewayTransactionId ||
        `UMMO-SSLCZ-${orderId}`;
      const sslStatus =
        outcome === "PAID" || outcome === "VALID"
          ? "VALID"
          : outcome === "CANCELED" || outcome === "CANCELLED"
            ? "CANCELLED"
            : "FAILED";
      result = await verifyAndProcessSslCommerzNotification({
        payload: {
          tran_id: tranId,
          val_id: `VAL-SBX-${Date.now()}`,
          status: sslStatus,
          amount: String(targetOrder.totalAmount),
          currency: "USD",
          value_a: targetOrder.orderId,
          risk_level: "0",
        },
        state,
      });
    }

    await persistPaymentAndOrderMutation(state, result);
    sendJson(req, res, 200, result);
    return true;
  }

  if (path === "/payments/reconcile") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    if (!caller.isAdmin) {
      sendJson(req, res, 403, {
        error: "Forbidden: Administrator privileges required to reconcile payments.",
      });
      return true;
    }
    await requireDurableMongoDb();
    const result = reconcilePaymentByAdmin({
      orderId: asSafeId(body.orderId, 64),
      targetPaymentStatus: asSafeId(
        body.targetPaymentStatus || body.paymentStatus,
        32
      ),
      reason: asSafeId(body.reason || "", 300),
      state,
      caller,
    });

    await persistPaymentAndOrderMutation(state, result);
    sendJson(req, res, 200, result);
    return true;
  }

  if (path === "/payments/refund") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    if (!caller.isAdmin) {
      sendJson(req, res, 403, {
        error: "Forbidden: Administrator privileges required to issue refunds.",
      });
      return true;
    }
    await requireDurableMongoDb();
    const result = refundPaymentByAdmin({
      orderId: asSafeId(body.orderId, 64),
      refundAmount: body.refundAmount,
      reason: asSafeId(body.reason || "", 300),
      restockItems: body.restockItems,
      state,
      caller,
    });

    await persistPaymentAndOrderMutation(state, result);
    sendJson(req, res, 200, result);
    return true;
  }

  return false;
}
