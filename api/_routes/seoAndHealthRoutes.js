import {
  CLOUDINARY_CLOUD_NAME,
  DB_NAME,
  getCloudinaryApiKey,
  getCloudinarySecret,
  getFullState,
  getMongoDb,
  isMongoConfigured,
} from "../db.js";
import {
  getOwnerAuthSecuritySummary,
  isAuthSecretConfigured,
  sendJson,
  syncSecurityGuardFromDb,
} from "../security.js";
import {
  buildDynamicSitemapXml,
  buildProductBotSeoHtml,
} from "../_services/seoService.js";

export async function handleSeoAndHealthRoutes({
  req,
  res,
  method,
  path,
  urlObj,
}) {
  const seoMode = urlObj.searchParams.get("__seo") || "";

  if (path === "/sitemap.xml" || seoMode === "sitemap") {
    if (method !== "GET" && method !== "HEAD") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { state } = await getFullState();
    const xml = buildDynamicSitemapXml(state);
    res.statusCode = 200;
    res.setHeader("Content-Type", "application/xml; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, s-maxage=300");
    res.end(method === "HEAD" ? "" : xml);
    return true;
  }

  if (path === "/seo-product" || seoMode === "product") {
    if (method !== "GET" && method !== "HEAD") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { state } = await getFullState();
    const productId = urlObj.searchParams.get("id") || "";
    const rendered = buildProductBotSeoHtml(productId, state);
    res.statusCode = rendered.statusCode;
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=180, s-maxage=180");
    res.end(method === "HEAD" ? "" : rendered.html);
    return true;
  }

  if (path === "/health") {
    if (method !== "GET") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const db = await getMongoDb();
    if (db) {
      await syncSecurityGuardFromDb(db);
    }
    const ownerSummary = getOwnerAuthSecuritySummary();
    sendJson(req, res, 200, {
      status: db ? "ok" : "degraded",
      ready: Boolean(db),
      mongodbConnected: Boolean(db),
      mongodbUriConfigured: isMongoConfigured(),
      authSecretConfigured: isAuthSecretConfigured(),
      ownerPasswordConfiguredInDb: Boolean(
        ownerSummary.passwordConfiguredInDb
      ),
      ownerPasswordConfiguredInEnv: Boolean(
        ownerSummary.passwordConfiguredInEnv
      ),
      cloudinarySigningConfigured: Boolean(
        getCloudinaryApiKey() && getCloudinarySecret()
      ),
      database: `${DB_NAME} (MongoDB Atlas)`,
      cloudinaryCloudName: CLOUDINARY_CLOUD_NAME,
      firebaseAuthProject: "ummo-eccomerce",
    });
    return true;
  }

  return false;
}
