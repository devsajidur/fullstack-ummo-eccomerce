import crypto from "node:crypto";
import {
  getCloudinaryApiKey,
  getCloudinaryCloudName,
  getCloudinarySecret,
  getFullState,
} from "../db.js";
import {
  ADMIN_TOKEN_TTL_MS,
  asSafeEmail,
  asSafeId,
  checkAdminLoginRateLimitDurable,
  clearAdminLoginFailuresDurable,
  createAdminSessionToken,
  DEMO_ADMIN_UID,
  DEMO_ADMIN_TOKEN_TTL_MS,
  isDemoAdminEnabled,
  getDemoAdminEmail,
  getMasterAdminEmail,
  getOwnerAuthSecuritySummary,
  isAuthSecretConfigured,
  MASTER_ADMIN_UID,
  parseJsonBody,
  recordAdminLoginFailureDurable,
  resolveCaller,
  revokeAdminSessionTokenDurable,
  sendJson,
  setOwnerAdminPasswordDurable,
  syncSecurityGuardFromDb,
  verifyAdminPasswordCredentials,
  verifyDemoAdminCredentials,
} from "../security.js";

const ALLOWED_UPLOAD_FOLDERS = new Set([
  "ummo_products",
  "ummo_banners",
  "ummo_gifts",
]);

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export async function handleAdminAndMediaRoutes({
  req,
  res,
  method,
  path,
  securityDb,
}) {
  if (path === "/admin/demo-config" && method === "GET") {
    const publicPassword = String(process.env.DEMO_ADMIN_PUBLIC_PASSWORD || "");
    const enabled = isDemoAdminEnabled();
    sendJson(req, res, 200, {
      enabled,
      ...(enabled ? { email: getDemoAdminEmail(),
        password: verifyDemoAdminCredentials(getDemoAdminEmail(), publicPassword) ? publicPassword : "" } : {}),
    });
    return true;
  }
  if (path === "/admin/demo-login") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
    } else if (!isDemoAdminEnabled()) {
      sendJson(req, res, 403, { error: "Demo access is disabled." });
    } else if (!securityDb) {
      sendJson(req, res, 503, { error: "Live business data is unavailable.", code: "DB_UNAVAILABLE" });
    } else {
      const user = { uid: DEMO_ADMIN_UID, email: getDemoAdminEmail(), name: "Demo Administrator", role: "ADMIN", isDemo: true };
      sendJson(req, res, 200, { status: "ok", user,
        adminToken: createAdminSessionToken({ ...user, demo: true }),
        expiresAt: new Date(Date.now() + DEMO_ADMIN_TOKEN_TTL_MS).toISOString() });
    }
    return true;
  }

  if (path === "/admin/login") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    if (!isAuthSecretConfigured()) {
      sendJson(req, res, 503, {
        error:
          "Administrator authentication is unavailable because AUTH_SECRET is not configured on the server.",
      });
      return true;
    }

    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const email = asSafeEmail(body.email);
    const password = typeof body.password === "string" ? body.password : "";
    if (!email || !password) {
      sendJson(req, res, 400, {
        error: "Administrator email and password are required.",
      });
      return true;
    }

    if (!securityDb) {
      sendJson(req, res, 503, {
        error:
          "Administrator authentication requires an active MongoDB Atlas connection (`ummo_ecommerce`). Configure MONGODB_URI and database network access on the server.",
        code: "DB_UNAVAILABLE",
      });
      return true;
    }

    const clientIp =
      String(
        req.headers?.["x-forwarded-for"] ||
          req.headers?.["x-real-ip"] ||
          "local"
      )
        .split(",")[0]
        .trim() || "local";
    const rateLimitKey = `${clientIp}::${email}`;
    const rateStatus = await checkAdminLoginRateLimitDurable(
      rateLimitKey,
      securityDb
    );
    if (!rateStatus.allowed) {
      res.setHeader("Retry-After", String(rateStatus.retryAfterSeconds));
      sendJson(req, res, 429, {
        error: `Too many failed administrator login attempts. Please try again in ${rateStatus.retryAfterSeconds} seconds.`,
        retryAfterSeconds: rateStatus.retryAfterSeconds,
      });
      return true;
    }

    const { state } = await getFullState();
    const isMasterValid = verifyAdminPasswordCredentials(email, password);
    const isDemoValid =
      !isMasterValid && verifyDemoAdminCredentials(email, password);
    const matchingDbUser = (state.users || []).find(
      (u) => String(u.email || "").toLowerCase() === email
    );

    if (!isMasterValid && !isDemoValid) {
      await recordAdminLoginFailureDurable(rateLimitKey, securityDb);
      if (matchingDbUser && matchingDbUser.role !== "ADMIN") {
        sendJson(req, res, 403, {
          error:
            "Forbidden: Your account does not have Administrator privileges.",
        });
        return true;
      }
      const ownerSummary = getOwnerAuthSecuritySummary();
      if (
        !ownerSummary.passwordConfigured &&
        email === ownerSummary.ownerEmail
      ) {
        sendJson(req, res, 503, {
          error:
            "Owner administrator password has not been initialized yet. Run the local owner recovery procedure (`npm run admin:recover`) or configure ADMIN_PASSWORD_HASH.",
        });
        return true;
      }
      sendJson(req, res, 401, {
        error: "Invalid administrator email or password.",
      });
      return true;
    }

    await clearAdminLoginFailuresDurable(rateLimitKey, securityDb);

    if (isDemoValid) {
      const demoUser = {
        uid: DEMO_ADMIN_UID,
        email: getDemoAdminEmail(),
        name: "UOMO Demo Administrator",
        role: "ADMIN",
        isDemo: true,
      };
      const demoToken = createAdminSessionToken({ ...demoUser, demo: true });
      sendJson(req, res, 200, {
        status: "ok",
        adminToken: demoToken,
        expiresAt: new Date(Date.now() + DEMO_ADMIN_TOKEN_TTL_MS).toISOString(),
        user: demoUser,
      });
      return true;
    }

    const ownerSummary = getOwnerAuthSecuritySummary();
    const adminUser = {
      uid: matchingDbUser?.uid || ownerSummary.ownerUid || MASTER_ADMIN_UID,
      email: ownerSummary.ownerEmail || getMasterAdminEmail(),
      name:
        matchingDbUser?.displayName ||
        matchingDbUser?.username ||
        "UOMO Store Administrator",
      role: "ADMIN",
    };
    const adminToken = createAdminSessionToken(adminUser);

    sendJson(req, res, 200, {
      status: "ok",
      adminToken,
      expiresAt: new Date(Date.now() + ADMIN_TOKEN_TTL_MS).toISOString(),
      user: adminUser,
    });
    return true;
  }

  if (path === "/admin/password") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    if (!isAuthSecretConfigured()) {
      sendJson(req, res, 503, {
        error:
          "Administrator security service is unavailable because AUTH_SECRET is not configured.",
      });
      return true;
    }

    if (securityDb) {
      await syncSecurityGuardFromDb(securityDb);
    }

    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }

    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    if (!caller.isAdmin) {
      sendJson(req, res, caller.isAuthenticated ? 403 : 401, {
        error: "Owner administrator authentication required.",
      });
      return true;
    }
    if (caller.isDemoAdmin) {
      sendJson(req, res, 403, {
        error: "Demo administrator accounts cannot change the owner password.",
        demoRestricted: true,
      });
      return true;
    }

    const currentPassword =
      typeof body.currentPassword === "string" ? body.currentPassword : "";
    const newPassword =
      typeof body.newPassword === "string" ? body.newPassword : "";

    if (!currentPassword || !newPassword) {
      sendJson(req, res, 400, {
        error: "Both current password and new password are required.",
      });
      return true;
    }

    const ownerSummary = getOwnerAuthSecuritySummary();
    const targetEmail = caller.email || ownerSummary.ownerEmail || getMasterAdminEmail();
    const targetUid = caller.uid || ownerSummary.ownerUid || MASTER_ADMIN_UID;

    if (!verifyAdminPasswordCredentials(targetEmail, currentPassword)) {
      const clientIp =
        String(
          req.headers?.["x-forwarded-for"] ||
            req.headers?.["x-real-ip"] ||
            "local"
        )
          .split(",")[0]
          .trim() || "local";
      await recordAdminLoginFailureDurable(
        `${clientIp}::${targetEmail}`,
        securityDb
      );
      sendJson(req, res, 401, {
        error: "Current administrator password is incorrect.",
      });
      return true;
    }

    if (currentPassword === newPassword) {
      sendJson(req, res, 400, {
        error: "New password must be different from your current password.",
      });
      return true;
    }

    const rotation = await setOwnerAdminPasswordDurable({
      email: targetEmail,
      uid: targetUid,
      newPassword,
      db: securityDb,
    });

    const replacementToken = createAdminSessionToken({
      uid: rotation.uid,
      email: rotation.email,
      role: "ADMIN",
    });

    sendJson(req, res, 200, {
      status: "ok",
      adminToken: replacementToken,
      expiresAt: new Date(Date.now() + ADMIN_TOKEN_TTL_MS).toISOString(),
      passwordUpdatedAt: rotation.passwordUpdatedAt,
      previousSessionsInvalidated: true,
    });
    return true;
  }

  if (path === "/admin/logout") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const tokenHeader =
      req.headers?.["x-admin-token"] ||
      req.headers?.["X-Admin-Token"] ||
      (String(req.headers?.authorization || "").startsWith("Bearer ")
        ? String(req.headers.authorization).slice(7).trim()
        : "");
    const revoked = await revokeAdminSessionTokenDurable(
      String(tokenHeader || ""),
      securityDb
    );
    sendJson(req, res, 200, {
      status: "ok",
      revoked,
    });
    return true;
  }

  if (path === "/admin/session") {
    if (method !== "GET") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    if (caller.isAdmin) {
      const ownerSummary = getOwnerAuthSecuritySummary();
      sendJson(req, res, 200, {
        status: "ok",
        isAdmin: true,
        user: {
          uid: caller.uid || ownerSummary.ownerUid || MASTER_ADMIN_UID,
          email: caller.email || ownerSummary.ownerEmail || getMasterAdminEmail(),
          role: "ADMIN",
          ...(caller.isDemoAdmin ? { isDemo: true } : {}),
        },
        securityStatus: caller.isDemoAdmin ? { demoReadOnly: true } : {
          ...ownerSummary,
          mongoConnected: Boolean(securityDb),
          cloudinarySigningConfigured: Boolean(
            getCloudinarySecret() && getCloudinaryApiKey()
          ),
        },
      });
      return true;
    }
    if (caller.isAuthenticated) {
      sendJson(req, res, 403, {
        status: "forbidden",
        isAdmin: false,
        error: "Forbidden: Administrator role required.",
      });
      return true;
    }
    sendJson(req, res, 401, {
      status: "unauthenticated",
      isAdmin: false,
      error: "Administrator authentication required.",
    });
    return true;
  }

  if (path === "/cloudinary-sign") {
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
        error: "Admin authorization required to upload media assets.",
      });
      return true;
    }

    const apiKey = getCloudinaryApiKey();
    const apiSecret = getCloudinarySecret();
    if (!apiKey || !apiSecret) {
      sendJson(req, res, 503, {
        error:
          "Cloudinary media signing is not configured on the server (missing CLOUDINARY_API_KEY or CLOUDINARY_API_SECRET).",
      });
      return true;
    }

    const folder = asSafeId(body.folder || "ummo_products", 64);
    if (!ALLOWED_UPLOAD_FOLDERS.has(folder)) {
      sendJson(req, res, 400, { error: "Disallowed upload folder." });
      return true;
    }

    if (body.mimeType !== undefined) {
      const mime = String(body.mimeType || "").toLowerCase().trim();
      if (!ALLOWED_IMAGE_MIMES.has(mime)) {
        sendJson(req, res, 400, {
          error:
            "Unsupported or unsafe image MIME type. SVG and executable files are prohibited.",
        });
        return true;
      }
    }

    if (body.fileSize !== undefined) {
      const size = Number(body.fileSize);
      if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
        sendJson(req, res, 400, {
          error: "File size exceeds maximum limit of 5MB.",
        });
        return true;
      }
    }

    const timestamp = Math.floor(Date.now() / 1000);
    const rawPublicId = asSafeId(body.publicId || "", 96).replace(
      /[^a-zA-Z0-9_-]/g,
      ""
    );
    const customPublicId =
      caller.isDemoAdmin && rawPublicId
        ? rawPublicId.startsWith("demo_")
          ? rawPublicId
          : `demo_${rawPublicId}_${timestamp}`
        : rawPublicId;
    const paramsToSign = {
      folder,
      timestamp: String(timestamp),
    };
    if (customPublicId) {
      if (!caller.isDemoAdmin) {
        paramsToSign.overwrite = "true";
      }
      paramsToSign.public_id = customPublicId;
    }

    const sortedKeys = Object.keys(paramsToSign).sort();
    const stringToSign =
      sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join("&") + apiSecret;
    const signature = crypto
      .createHash("sha1")
      .update(stringToSign)
      .digest("hex");

    sendJson(req, res, 200, {
      status: "ok",
      cloudName: getCloudinaryCloudName(),
      apiKey,
      timestamp,
      folder,
      publicId: customPublicId || undefined,
      signature,
    });
    return true;
  }

  return false;
}
