import { getMongoDb } from "./db.js";
import {
  isDemoAdminBlockedRequest,
  sendJson,
  syncSecurityGuardFromDb,
  verifyAdminSessionToken,
} from "./security.js";
import { handleSeoAndHealthRoutes } from "./_routes/seoAndHealthRoutes.js";
import { handleAdminAndMediaRoutes } from "./_routes/adminAndMediaRoutes.js";
import { handleStoreAndCouponRoutes } from "./_routes/storeAndCouponRoutes.js";
import { handleOrderRoutes } from "./_routes/orderRoutes.js";
import { handlePaymentRoutes } from "./_routes/paymentRoutes.js";
import { handleCustomerAndInboxRoutes } from "./_routes/customerAndInboxRoutes.js";

const ROUTE_DISPATCHERS = [
  handleAdminAndMediaRoutes,
  handleStoreAndCouponRoutes,
  handleOrderRoutes,
  handlePaymentRoutes,
  handleCustomerAndInboxRoutes,
];

export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return sendJson(req, res, 200, { ok: true });
  }

  const urlObj = new URL(req.url || "/", "http://localhost");
  const path =
    urlObj.pathname.replace(/^\/api\/v1/, "").replace(/^\/api/, "") || "/";

  try {
    if (
      await handleSeoAndHealthRoutes({ req, res, method, path, urlObj })
    ) {
      return;
    }

    const hasAdminAuthHeader = Boolean(
      req.headers?.["x-admin-token"] ||
        req.headers?.["X-Admin-Token"] ||
        req.headers?.authorization ||
        path.startsWith("/admin")
    );
    const securityDb = hasAdminAuthHeader ? await getMongoDb() : null;
    if (securityDb) {
      await syncSecurityGuardFromDb(securityDb);
    }

    if (hasAdminAuthHeader && isDemoAdminBlockedRequest(method, path)) {
      const rawTok =
        req.headers?.["x-admin-token"] ||
        req.headers?.["X-Admin-Token"] ||
        (String(req.headers?.authorization || "").startsWith("Bearer ")
          ? String(req.headers.authorization).slice(7).trim()
          : "");
      const sess = verifyAdminSessionToken(String(rawTok || ""));
      if (sess?.demo) {
        return sendJson(req, res, 403, {
          error:
            "Demo administrator accounts cannot perform this action (payments, refunds, user roles, customer messages/subscribers are protected).",
          demoRestricted: true,
        });
      }
    }

    const ctx = { req, res, method, path, urlObj, securityDb };
    for (const dispatch of ROUTE_DISPATCHERS) {
      if (await dispatch(ctx)) {
        return;
      }
    }

    return sendJson(req, res, 404, { error: `API endpoint not found: ${path}` });
  } catch (err) {
    const statusCode =
      err?.statusCode && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;
    const safeMessage =
      statusCode < 500 || err?.exposeMessage
        ? err.message
        : "An internal server error occurred. Please try again.";
    return sendJson(req, res, statusCode, {
      error: safeMessage,
      ...(err?.code ? { code: err.code } : {}),
    });
  }
}
