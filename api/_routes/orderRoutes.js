import {
  commitAtomicMongoTransaction,
  getFullState,
  requireDurableMongoDb,
  runTrackedMongoOp,
  saveCloudMirrorState,
  stripMongoImmutableId,
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

function cloneStoreConfigForStaging(storeConfig) {
  return {
    ...storeConfig,
    customProducts: Array.isArray(storeConfig?.customProducts)
      ? storeConfig.customProducts.map((p) => ({ ...p }))
      : [],
  };
}

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
    const requestedOrderId = body.orderId ? asSafeId(body.orderId, 64) : "";

    if (idempotencyKey || requestedOrderId) {
      const existingInMem = state.orders.find(
        (o) =>
          (idempotencyKey && o.idempotencyKey === idempotencyKey) ||
          (requestedOrderId && String(o.orderId) === requestedOrderId)
      );
      if (existingInMem) {
        sendJson(req, res, 200, {
          status: "ok",
          idempotentReplay: true,
          order: existingInMem,
        });
        return true;
      }
    }

    const db = await requireDurableMongoDb();

    if ((idempotencyKey || requestedOrderId) && typeof db?.collection === "function") {
      const orClauses = [];
      if (idempotencyKey) orClauses.push({ idempotencyKey });
      if (requestedOrderId) orClauses.push({ orderId: requestedOrderId });
      const ordersCol = db.collection("orders");
      if (orClauses.length && typeof ordersCol?.findOne === "function") {
        const existingInDb = await ordersCol.findOne(
          orClauses.length === 1 ? orClauses[0] : { $or: orClauses }
        );
        if (existingInDb) {
          sendJson(req, res, 200, {
            status: "ok",
            idempotentReplay: true,
            order: existingInDb,
          });
          return true;
        }
      }
    }

    const newOrder = validateAndBuildServerOrder(
      body,
      state,
      caller,
      idempotencyKey
    );

    const stagedStoreConfig = cloneStoreConfigForStaging(state.storeConfig);
    deductOrderInventory(
      { storeConfig: stagedStoreConfig },
      newOrder.OrderItems,
      newOrder
    );

    const orderDocToWrite = stripMongoImmutableId(newOrder);
    const configDocToWrite = stripMongoImmutableId(stagedStoreConfig);

    await commitAtomicMongoTransaction(
      async (txDb, session) => {
        const sessionOpt = session ? { session } : {};
        await runTrackedMongoOp("orders", "updateOne", () =>
          txDb
            .collection("orders")
            .updateOne(
              { orderId: newOrder.orderId },
              { $set: orderDocToWrite },
              { upsert: true, ...sessionOpt }
            )
        );
        await runTrackedMongoOp("store_config", "updateOne", () =>
          txDb
            .collection("store_config")
            .updateOne(
              { _id: "global" },
              { $set: configDocToWrite },
              { upsert: true, ...sessionOpt }
            )
        );
      },
      { collection: "orders", operation: "withTransaction" }
    );

    state.storeConfig = stagedStoreConfig;
    state.orders = [
      newOrder,
      ...state.orders.filter(
        (o) => String(o.orderId) !== String(newOrder.orderId)
      ),
    ];
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
    const stagedStoreConfig = cloneStoreConfigForStaging(state.storeConfig);
    const stagedTargetOrder = { ...targetOrder };
    const shouldRestock =
      nextStatus === "CANCELLED" && targetOrder.status !== "CANCELLED";
    if (shouldRestock) {
      restockOrderInventory(
        { storeConfig: stagedStoreConfig },
        stagedTargetOrder
      );
    }

    const configDocToWrite = stripMongoImmutableId(stagedStoreConfig);

    await commitAtomicMongoTransaction(
      async (txDb, session) => {
        const sessionOpt = session ? { session } : {};
        await runTrackedMongoOp("orders", "updateOne", () =>
          txDb
            .collection("orders")
            .updateOne(
              { $or: [{ orderId }, { id: orderId }] },
              {
                $set: {
                  status: nextStatus,
                  inventoryRestocked:
                    stagedTargetOrder.inventoryRestocked || false,
                  updatedAt,
                },
              },
              sessionOpt
            )
        );
        if (nextStatus === "CANCELLED") {
          await runTrackedMongoOp("store_config", "updateOne", () =>
            txDb
              .collection("store_config")
              .updateOne(
                { _id: "global" },
                { $set: configDocToWrite },
                { upsert: true, ...sessionOpt }
              )
          );
        }
      },
      { collection: "orders", operation: "withTransaction" }
    );

    if (shouldRestock) {
      state.storeConfig = stagedStoreConfig;
    }
    state.orders = state.orders.map((o) =>
      String(o.orderId || o.id) === orderId
        ? {
            ...o,
            status: nextStatus,
            inventoryRestocked: stagedTargetOrder.inventoryRestocked || false,
            updatedAt,
          }
        : o
    );
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
