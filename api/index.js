import { getMongoDb } from "./db.js";
import {
  isDemoAdminBlockedRequest,
  sendJson,
  syncSecurityGuardFromDb,
  resolveCaller,
  sendDemoReadOnlyForbidden,
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
    const hasAdminAuthHeader = Boolean(
      req.headers?.["x-admin-token"] ||
        req.headers?.["X-Admin-Token"] ||
        req.headers?.authorization ||
        path.startsWith("/admin")
    );
    const securityDb = hasAdminAuthHeader
      ? await getMongoDb({ forceRetry: path === "/admin/login" })
      : null;
    if (securityDb) {
      await syncSecurityGuardFromDb(securityDb);
    }

    const caller = resolveCaller(req, null);
    if (caller.isDemoAdmin && (
      isDemoAdminBlockedRequest(method, path) ||
      req.headers?.["x-http-method-override"] || req.headers?.["x-method-override"] ||
      urlObj.searchParams.has("_method") || urlObj.searchParams.has("__seo")
    )) {
      return sendDemoReadOnlyForbidden(req, res);
    }

    if (
      await handleSeoAndHealthRoutes({ req, res, method, path, urlObj })
    ) {
      return;
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
      ...(err?.diagnostic ? { diagnostic: err.diagnostic } : {}),
    });
  }
}
