import { projectStoreDataForDemoAdmin } from "../_services/demoProjection.js";
import {
  commitDurableMongoWrite,
  getFullState,
  requireDurableMongoDb,
  saveCloudMirrorState,
} from "../db.js";
import {
  asSafeEmail,
  asSafeId,
  canAccessUser,
  parseJsonBody,
  resolveCaller,
  sendJson,
} from "../security.js";
import { validateCouponEligibility } from "../orderService.js";
import { getConfiguredGatewaysStatus } from "../paymentService.js";

export async function handleStoreAndCouponRoutes({
  req,
  res,
  method,
  path,
  urlObj,
}) {
  if (path === "/store-data") {
    if (method !== "GET") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { state, source } = await getFullState();
    const caller = resolveCaller(req, state);
    const requestedUid = asSafeId(urlObj.searchParams.get("userUid"), 128);
    const productId = asSafeId(urlObj.searchParams.get("productId"), 64);

    if (caller.isDemoAdmin) {
      if (source !== "mongodb-atlas") {
        sendJson(req, res, 503, { error: "Live business data is unavailable.", code: "DB_UNAVAILABLE" });
      } else {
        sendJson(req, res, 200, { ...projectStoreDataForDemoAdmin(state, getConfiguredGatewaysStatus()), source });
      }
      return true;
    }

    if (caller.isAdmin) {
      sendJson(req, res, 200, {
        status: "ok",
        source,
        storeConfig: state.storeConfig,
        orders: requestedUid
          ? state.orders.filter(
              (o) => String(o.userUid || o.id) === requestedUid
            )
          : state.orders,
        payments: state.payments || [],
        paymentGateways: getConfiguredGatewaysStatus(),
        users: state.users,
        addresses: requestedUid
          ? state.addresses[requestedUid] || []
          : state.addresses,
        reviews: productId ? state.reviews[productId] || [] : state.reviews,
        messages: state.messages,
        subscribers: state.subscribers,
      });
      return true;
    }

    const effectiveUid =
      requestedUid && canAccessUser(caller, requestedUid)
        ? requestedUid
        : caller.uid || "";

    const scopedOrders = effectiveUid
      ? state.orders.filter(
          (o) =>
            String(o.userUid || o.id) === effectiveUid ||
            (caller.email &&
              String(o.email || "").toLowerCase() === caller.email)
        )
      : [];

    const scopedOrderIds = new Set(
      scopedOrders.map((o) => String(o.orderId || o.id))
    );
    const scopedPayments = (state.payments || []).filter((p) =>
      scopedOrderIds.has(String(p.orderId))
    );

    const scopedUsers = effectiveUid
      ? state.users.filter((u) => String(u.uid) === effectiveUid)
      : [];

    const scopedAddresses = effectiveUid
      ? state.addresses[effectiveUid] || []
      : [];

    sendJson(req, res, 200, {
      status: "ok",
      source,
      storeConfig: state.storeConfig,
      orders: scopedOrders,
      payments: scopedPayments,
      paymentGateways: getConfiguredGatewaysStatus(),
      users: scopedUsers,
      addresses: scopedAddresses,
      reviews: productId ? state.reviews[productId] || [] : state.reviews,
      messages: [],
      subscribers: [],
    });
    return true;
  }

  if (path === "/store-config") {
    if (method !== "POST" && method !== "PUT") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, {
        error: "Disallowed query operators in payload.",
      });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    if (!caller.isAdmin) {
      sendJson(req, res, 403, {
        error: "Admin authorization required to modify store configuration.",
      });
      return true;
    }

    const updatedConfig = {
      ...state.storeConfig,
      ...(Array.isArray(body.coupons) ? { coupons: body.coupons } : {}),
      ...(body.banners && typeof body.banners === "object"
        ? { banners: body.banners }
        : {}),
      ...(body.featuredCollection && typeof body.featuredCollection === "object"
        ? { featuredCollection: body.featuredCollection }
        : {}),
      ...(Array.isArray(body.customProducts)
        ? { customProducts: body.customProducts }
        : {}),
      ...(Array.isArray(body.deletedIds)
        ? {
            deletedIds: body.deletedIds
              .map((id) => asSafeId(id, 64))
              .filter(Boolean),
          }
        : {}),
      ...(body.cartRules && typeof body.cartRules === "object"
        ? { cartRules: body.cartRules }
        : {}),
      ...(Array.isArray(body.discountCampaigns)
        ? { discountCampaigns: body.discountCampaigns }
        : {}),
      ...(body.customTaxonomy && typeof body.customTaxonomy === "object"
        ? { customTaxonomy: body.customTaxonomy }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    await commitDurableMongoWrite(async (db) => {
      await db
        .collection("store_config")
        .updateOne(
          { _id: "global" },
          { $set: updatedConfig },
          { upsert: true }
        );
    });

    state.storeConfig = updatedConfig;
    await saveCloudMirrorState(state);

    sendJson(req, res, 200, {
      status: "ok",
      storeConfig: updatedConfig,
    });
    return true;
  }

  if (path === "/coupons/validate") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, {
        error: "Disallowed query operators in payload.",
      });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    const subtotal = Math.max(0, Number(body.subtotal || 0));
    const eligibleAmount = Math.max(
      0,
      Number(body.eligibleAmount ?? subtotal)
    );
    const userUid = caller.uid || asSafeId(body.userUid, 128);
    const userEmail = asSafeEmail(body.email) || caller.email || "";
    const userPhone = asSafeId(body.phone, 40);

    const result = validateCouponEligibility({
      couponCode: body.couponCode || body.code,
      subtotal,
      eligibleAmount,
      state,
      userUid,
      userEmail,
      userPhone,
    });

    sendJson(req, res, 200, {
      status: "ok",
      valid: result.valid,
      couponDiscount: result.couponDiscount,
      couponCode: result.validatedCouponCode,
      coupon: result.coupon,
    });
    return true;
  }

  return false;
}
