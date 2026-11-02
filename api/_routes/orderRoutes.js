import {
  commitDurableMongoWrite,
  getFullState,
  requireDurableMongoDb,
  saveCloudMirrorState,
} from "../db.js";
import {
  asSafeId,
  parseJsonBody,
  resolveCaller,
  sendJson,
} from "../security.js";
import {
  deductOrderInventory,
  restockOrderInventory,
  validateAndBuildServerOrder,
} from "../orderService.js";

const ALLOWED_ORDER_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

export async function handleOrderRoutes({ req, res, method, path }) {
  if (path === "/orders" || path === "/orders/checkout") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, {
        error: "Disallowed query operators in order payload.",
      });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    const idempotencyKey = asSafeId(
      req.headers?.["idempotency-key"] || req.headers?.["Idempotency-Key"] || "",
      128
    );

    if (idempotencyKey || body.orderId) {
      const existingOrder = state.orders.find(
        (o) =>
          (idempotencyKey && o.idempotencyKey === idempotencyKey) ||
          (body.orderId && String(o.orderId) === String(body.orderId))
      );
      if (existingOrder) {
        sendJson(req, res, 200, {
          status: "ok",
          idempotentReplay: true,
          order: existingOrder,
        });
        return true;
      }
    }

    await requireDurableMongoDb();

    const newOrder = validateAndBuildServerOrder(
      body,
      state,
      caller,
      idempotencyKey
    );

    deductOrderInventory(state, newOrder.OrderItems, newOrder);
    const nextOrders = [
      newOrder,
      ...state.orders.filter(
        (o) => String(o.orderId) !== String(newOrder.orderId)
      ),
    ];

    await commitDurableMongoWrite(async (db) => {
      await Promise.all([
        db
          .collection("orders")
          .updateOne(
            { orderId: newOrder.orderId },
            { $set: newOrder },
            { upsert: true }
          ),
        db
          .collection("store_config")
          .updateOne(
            { _id: "global" },
            { $set: state.storeConfig },
            { upsert: true }
          ),
      ]);
    });

    state.orders = nextOrders;
    await saveCloudMirrorState(state);

    sendJson(req, res, 201, {
      status: "ok",
      order: newOrder,
    });
    return true;
  }

  if (path === "/orders/status") {
    if (method !== "PATCH" && method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const orderId = asSafeId(body.orderId, 64);
    const nextStatus = asSafeId(body.status, 32).toUpperCase();
    if (!orderId || !ALLOWED_ORDER_STATUSES.has(nextStatus)) {
      sendJson(req, res, 400, {
        error: "Valid orderId and allowed status are required.",
      });
      return true;
    }

    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    const targetOrder = state.orders.find(
      (o) => String(o.orderId || o.id) === orderId
    );

    if (!targetOrder) {
      if (!caller.isAuthenticated) {
        sendJson(req, res, 403, {
          error: "Forbidden: Authentication required to modify order status.",
        });
        return true;
      }
      await requireDurableMongoDb();
      sendJson(req, res, 404, { error: "Order not found." });
      return true;
    }

    if (!caller.isAdmin) {
      if (!caller.uid || String(targetOrder.userUid) !== caller.uid) {
        sendJson(req, res, 403, {
          error: "Forbidden: You cannot modify another customer's order.",
        });
        return true;
      }
      if (nextStatus !== "CANCELLED") {
        sendJson(req, res, 403, {
          error:
            "Forbidden: Only administrators can advance order fulfillment status.",
        });
        return true;
      }
      if (
        targetOrder.status &&
        targetOrder.status !== "PENDING" &&
        targetOrder.status !== "CANCELLED"
      ) {
        sendJson(req, res, 400, {
          error: "Order can no longer be cancelled once processing has started.",
        });
        return true;
      }
    }

    await requireDurableMongoDb();

    const updatedAt = new Date().toISOString();
    if (nextStatus === "CANCELLED" && targetOrder.status !== "CANCELLED") {
      restockOrderInventory(state, targetOrder);
    }

    const nextOrders = state.orders.map((o) =>
      String(o.orderId || o.id) === orderId
        ? {
            ...o,
            status: nextStatus,
            inventoryRestocked: targetOrder.inventoryRestocked || false,
            updatedAt,
          }
        : o
    );

    await commitDurableMongoWrite(async (db) => {
      await Promise.all([
        db
          .collection("orders")
          .updateOne(
            { $or: [{ orderId }, { id: orderId }] },
            {
              $set: {
                status: nextStatus,
                inventoryRestocked: targetOrder.inventoryRestocked || false,
                updatedAt,
              },
            }
          ),
        nextStatus === "CANCELLED"
          ? db
              .collection("store_config")
              .updateOne(
                { _id: "global" },
                { $set: state.storeConfig },
                { upsert: true }
              )
          : Promise.resolve(),
      ]);
    });

    state.orders = nextOrders;
    await saveCloudMirrorState(state);

    sendJson(req, res, 200, {
      status: "ok",
      orderId,
      newStatus: nextStatus,
    });
    return true;
  }

  return false;
}
