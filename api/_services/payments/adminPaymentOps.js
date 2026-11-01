import { asSafeId } from "../../security.js";
import { deductOrderInventory, restockOrderInventory } from "../../orderService.js";
import { findOrder, upsertPaymentRecord } from "./paymentHelpers.js";

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
  restockItems,
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

  const orderTotal = Number(order.total ?? order.totalAmount ?? 0);
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

  const shouldRestock =
    nextStatus === "REFUNDED"
      ? restockItems !== false
      : restockItems === true;

  paymentRecord.auditLog.push({
    action: "ADMIN_REFUND",
    by: caller.uid || "admin",
    refundAmount: Number(requestedAmount.toFixed(2)),
    totalRefunded: newRefundedTotal,
    status: nextStatus,
    restockedInventory: Boolean(shouldRestock),
    reason: asSafeId(reason, 240),
    at: nowIso,
  });

  order.paymentStatus = nextStatus;
  order.refundedAmount = newRefundedTotal;
  if (nextStatus === "REFUNDED") {
    order.status = "CANCELLED";
  }
  if (shouldRestock) {
    restockOrderInventory(state, order);
  }

  return {
    paymentStatus: paymentRecord.status,
    restockedInventory: Boolean(order.inventoryRestocked),
    payment: paymentRecord,
    order,
  };
}
