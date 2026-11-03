import crypto from "node:crypto";
import { loadServerEnv } from "./_services/envLoader.js";
import {
  hashAdminPassword,
  timingSafeStringMatch,
  validateOwnerPasswordPolicy,
  verifyAdminPasswordHash,
} from "./_services/adminPasswordCrypto.js";

loadServerEnv();

export {
  hashAdminPassword,
  validateOwnerPasswordPolicy,
  verifyAdminPasswordHash,
};

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
export const MAX_BODY_BYTES = 512 * 1024; // 512 KB

export const MASTER_ADMIN_UID = "admin-ummo-master";

export function getMasterAdminEmail() {
  return String(process.env.ADMIN_EMAIL || "admin@ummo.com")
    .trim()
    .toLowerCase();
}

export const MASTER_ADMIN_EMAIL = getMasterAdminEmail();

// Public demo access is explicitly enabled by server configuration.
export const DEMO_ADMIN_UID = "admin-ummo-demo";
export const DEMO_ADMIN_TOKEN_TTL_MS = 30 * 60 * 1000;
export function getDemoAdminEmail() {
  return String(process.env.DEMO_ADMIN_EMAIL || "demo.admin@ummo.com").trim().toLowerCase();
}
export const DEMO_ADMIN_EMAIL = getDemoAdminEmail();
export function isDemoAdminEnabled(env = process.env) {
  return String(env.DEMO_ADMIN_ENABLED || "").toLowerCase() === "true";
}
export const DEMO_ADMIN_ENABLED = isDemoAdminEnabled();
export function verifyDemoAdminCredentials(email, password) {
  const hash = String(process.env.DEMO_ADMIN_PASSWORD_HASH || "");
  return isDemoAdminEnabled() && Boolean(hash) &&
    timingSafeStringMatch(String(email || "").trim().toLowerCase(), getDemoAdminEmail()) &&
    verifyAdminPasswordHash(String(password || ""), hash);
}
export function isDemoAdminBlockedRequest(method, path) {
  const m = String(method || "GET").toUpperCase();
  if (m === "POST" && ["/admin/login", "/admin/demo-login", "/admin/logout"].includes(path)) return false;
  if (!["GET", "HEAD", "OPTIONS"].includes(m)) return true;
  // Fail closed for new/alternative read endpoints until their projection is reviewed.
  return !["/store-data", "/admin/session", "/admin/demo-config", "/payments/config"].includes(path);
}

export function sendDemoReadOnlyForbidden(
  req,
  res,
  customMessage = "Demo Mode — Read Only: Modifying products, inventory, orders, payments, discounts, banners, settings, media, or customer records is disabled."
) {
  return sendJson(req, res, 403, {
    error: customMessage,
    code: "DEMO_READ_ONLY",
    demoRestricted: true,
  });
}

export function getAdminAccessKey() {
  const raw = String(process.env.UMMO_ADMIN_KEY || "").trim();
  return raw.length >= 24 ? raw : "";
}

export const ADMIN_ACCESS_KEY = getAdminAccessKey();

export function getAdminTokenSecret() {
  const raw = String(
    process.env.AUTH_SECRET ||
      process.env.ADMIN_TOKEN_SECRET ||
      process.env.JWT_SECRET ||
      ""
  ).trim();
  return raw.length >= 16 ? raw : "";
}

export function isAuthSecretConfigured() {
  return Boolean(getAdminTokenSecret());
}

export const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Revoked token registry (JTI -> expiration timestamp)
const revokedAdminTokenJtis = new Map();

// Brute-force login rate limiter (key -> { count, firstAttemptAt, lockedUntil })
const adminLoginAttempts = new Map();
export const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

// Durable owner admin auth metadata synced from MongoDB `store_config` (`_id: "security_guard"`)
let cachedOwnerAuth = null;
let monotonicTokenMs = 0;

function nextMonotonicMs(nowMs = Date.now()) {
  monotonicTokenMs = Math.max(Number(nowMs), monotonicTokenMs + 1);
  return monotonicTokenMs;
}

/**
 * Determines whether interactive sandbox payment confirmation is permitted.
 * Disabled by default (fail-closed).
 */
export function isSandboxPaymentSimulationEnabled(env = process.env) {
  if (!env || typeof env !== "object") return false;
  const nodeEnv = String(env.NODE_ENV || "").trim().toLowerCase();
  const vercelEnv = String(env.VERCEL_ENV || "").trim().toLowerCase();
  const paymentEnv = String(env.PAYMENT_ENV || "").trim().toLowerCase();
  const paymentMode = String(env.PAYMENT_MODE || "").trim().toLowerCase();
  const allowSandbox = String(env.ALLOW_SANDBOX_CONFIRM || "").trim().toLowerCase();

  if (
    nodeEnv === "production" ||
    vercelEnv === "production" ||
    paymentEnv === "production" ||
    paymentMode === "production"
  ) {
    return false;
  }

  return paymentMode === "sandbox" && allowSandbox === "true";
}

export const SECURITY_GUARD_DOC_ID = "security_guard";

function normalizeRateLimitKey(key) {
  return String(key || "anonymous").trim().toLowerCase().slice(0, 160);
}

function hashRateLimitKey(key) {
  return crypto
    .createHash("sha256")
    .update(normalizeRateLimitKey(key))
    .digest("hex")
    .slice(0, 32);
}

/**
 * Synchronizes durable admin token revocations, brute-force login attempt buckets,
 * and salted scrypt owner credentials + session invalidation watermark from MongoDB Atlas.
 */
export async function syncSecurityGuardFromDb(db, nowMs = Date.now()) {
  if (!db) return;
  try {
    const doc = await db
      .collection("store_config")
      .findOne({ _id: SECURITY_GUARD_DOC_ID });
    if (!doc || typeof doc !== "object") {
      cachedOwnerAuth = null;
      return;
    }

    if (doc.ownerAuth && typeof doc.ownerAuth === "object") {
      cachedOwnerAuth = {
        uid: doc.ownerAuth.uid ? String(doc.ownerAuth.uid) : "",
        email: doc.ownerAuth.email
          ? String(doc.ownerAuth.email).trim().toLowerCase()
          : "",
        passwordHash: doc.ownerAuth.passwordHash
          ? String(doc.ownerAuth.passwordHash)
          : "",
        passwordUpdatedAt: doc.ownerAuth.passwordUpdatedAt || null,
        sessionInvalidBeforeMs: Number(doc.ownerAuth.sessionInvalidBeforeMs || 0),
      };
    } else {
      cachedOwnerAuth = null;
    }

    if (doc.revokedJtis && typeof doc.revokedJtis === "object") {
      for (const [jti, exp] of Object.entries(doc.revokedJtis)) {
        const numExp = Number(exp);
        if (Number.isFinite(numExp) && numExp > nowMs) {
          revokedAdminTokenJtis.set(String(jti), numExp);
        }
      }
    }

    if (doc.loginAttempts && typeof doc.loginAttempts === "object") {
      for (const entry of Object.values(doc.loginAttempts)) {
        if (!entry || typeof entry !== "object" || !entry.safeKey) continue;
        const stillLocked = entry.lockedUntil && Number(entry.lockedUntil) > nowMs;
        const withinWindow =
          nowMs - Number(entry.firstAttemptAt || 0) <= ADMIN_LOGIN_WINDOW_MS;
        if (stillLocked || withinWindow) {
          adminLoginAttempts.set(String(entry.safeKey), {
            count: Number(entry.count || 0),
            firstAttemptAt: Number(entry.firstAttemptAt || nowMs),
            lockedUntil: Number(entry.lockedUntil || 0),
          });
        }
      }
    }
  } catch {
    // Fallback to process-local memory if MongoDB query fails transiently
  }
}

export function getOwnerAuthSecuritySummary() {
  const dbHashConfigured = Boolean(cachedOwnerAuth?.passwordHash);
  const envHashConfigured = Boolean(
    String(process.env.ADMIN_PASSWORD_HASH || "").trim()
  );
  const envPlainConfigured = Boolean(String(process.env.ADMIN_PASSWORD || ""));
  return {
    ownerEmail: cachedOwnerAuth?.email || getMasterAdminEmail(),
    ownerUid: cachedOwnerAuth?.uid || MASTER_ADMIN_UID,
    passwordConfiguredInDb: dbHashConfigured,
    passwordConfiguredInEnv: envHashConfigured || envPlainConfigured,
    passwordConfigured: dbHashConfigured || envHashConfigured || envPlainConfigured,
    passwordUpdatedAt: cachedOwnerAuth?.passwordUpdatedAt || null,
    authSecretConfigured: isAuthSecretConfigured(),
    demoAdminEnabled: isDemoAdminEnabled(),
  };
}

/**
 * Sets or rotates the Owner Administrator password using salted scrypt hashing,
 * persists it to `store_config` (`_id: "security_guard"`), and invalidates all
 * previously issued owner administrator session tokens.
 */
export async function setOwnerAdminPasswordDurable({
  email = getMasterAdminEmail(),
  uid = MASTER_ADMIN_UID,
  newPassword,
  db = null,
}) {
  const policy = validateOwnerPasswordPolicy(newPassword);
  if (!policy.valid) {
    const err = new Error(policy.error);
    err.statusCode = 400;
    throw err;
  }

  const cleanEmail = String(email || getMasterAdminEmail())
    .trim()
    .toLowerCase();
  const cleanUid = String(uid || MASTER_ADMIN_UID).trim();
  const passwordHash = hashAdminPassword(newPassword);
  const invalidationWatermark = nextMonotonicMs(Date.now());
  const nowIso = new Date(invalidationWatermark).toISOString();

  const nextOwnerAuth = {
    uid: cleanUid,
    email: cleanEmail,
    passwordHash,
    passwordUpdatedAt: nowIso,
    sessionInvalidBeforeMs: invalidationWatermark,
  };

  cachedOwnerAuth = nextOwnerAuth;

  if (db) {
    await db.collection("store_config").updateOne(
      { _id: SECURITY_GUARD_DOC_ID },
      {
        $set: {
          ownerAuth: nextOwnerAuth,
          updatedAt: nowIso,
        },
      },
      { upsert: true }
    );
  }

  return {
    uid: cleanUid,
    email: cleanEmail,
    passwordUpdatedAt: nowIso,
    sessionInvalidBeforeMs: invalidationWatermark,
  };
}

export function checkAdminLoginRateLimit(key, nowMs = Date.now()) {
  const safeKey = normalizeRateLimitKey(key);
  const record = adminLoginAttempts.get(safeKey);
  if (!record) {
    return { allowed: true, remainingAttempts: ADMIN_LOGIN_MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }
  if (record.lockedUntil && record.lockedUntil > nowMs) {
    const retryAfterSeconds = Math.max(1, Math.ceil((record.lockedUntil - nowMs) / 1000));
    return { allowed: false, remainingAttempts: 0, retryAfterSeconds };
  }
  if (nowMs - record.firstAttemptAt > ADMIN_LOGIN_WINDOW_MS) {
    adminLoginAttempts.delete(safeKey);
    return { allowed: true, remainingAttempts: ADMIN_LOGIN_MAX_ATTEMPTS, retryAfterSeconds: 0 };
  }
  const remaining = Math.max(0, ADMIN_LOGIN_MAX_ATTEMPTS - record.count);
  return { allowed: remaining > 0, remainingAttempts: remaining, retryAfterSeconds: 0 };
}

export async function checkAdminLoginRateLimitDurable(
  key,
  db = null,
  nowMs = Date.now()
) {
  if (db) {
    await syncSecurityGuardFromDb(db, nowMs);
  }
  return checkAdminLoginRateLimit(key, nowMs);
}

export function recordAdminLoginFailure(key, nowMs = Date.now()) {
  const safeKey = normalizeRateLimitKey(key);
  const existing = adminLoginAttempts.get(safeKey);
  if (!existing || nowMs - existing.firstAttemptAt > ADMIN_LOGIN_WINDOW_MS) {
    const next = { count: 1, firstAttemptAt: nowMs, lockedUntil: 0 };
    adminLoginAttempts.set(safeKey, next);
    return next;
  }
  existing.count += 1;
  if (existing.count >= ADMIN_LOGIN_MAX_ATTEMPTS) {
    existing.lockedUntil = nowMs + ADMIN_LOGIN_WINDOW_MS;
  }
  adminLoginAttempts.set(safeKey, existing);
  return existing;
}

export async function recordAdminLoginFailureDurable(
  key,
  db = null,
  nowMs = Date.now()
) {
  if (db) {
    await syncSecurityGuardFromDb(db, nowMs);
  }
  const safeKey = normalizeRateLimitKey(key);
  const updated = recordAdminLoginFailure(safeKey, nowMs);
  if (db) {
    const keyHash = hashRateLimitKey(safeKey);
    try {
      await db.collection("store_config").updateOne(
        { _id: SECURITY_GUARD_DOC_ID },
        {
          $set: {
            [`loginAttempts.${keyHash}`]: {
              safeKey,
              count: updated.count,
              firstAttemptAt: updated.firstAttemptAt,
              lockedUntil: updated.lockedUntil,
            },
            updatedAt: new Date(nowMs).toISOString(),
          },
        },
        { upsert: true }
      );
    } catch {
      // ignore transient write failure
    }
  }
  return updated;
}

export function clearAdminLoginFailures(key) {
  const safeKey = normalizeRateLimitKey(key);
  adminLoginAttempts.delete(safeKey);
}

export async function clearAdminLoginFailuresDurable(key, db = null) {
  const safeKey = normalizeRateLimitKey(key);
  clearAdminLoginFailures(safeKey);
  if (db) {
    const keyHash = hashRateLimitKey(safeKey);
    try {
      await db.collection("store_config").updateOne(
        { _id: SECURITY_GUARD_DOC_ID },
        {
          $unset: { [`loginAttempts.${keyHash}`]: "" },
          $set: { updatedAt: new Date().toISOString() },
        }
      );
    } catch {
      // ignore
    }
  }
}

export function evictLocalSecurityCacheForTest() {
  adminLoginAttempts.clear();
  revokedAdminTokenJtis.clear();
  cachedOwnerAuth = null;
}

export async function resetAdminRateLimitsForTest(db = null) {
  adminLoginAttempts.clear();
  if (db) {
    try {
      await db.collection("store_config").updateOne(
        { _id: SECURITY_GUARD_DOC_ID },
        { $set: { loginAttempts: {}, updatedAt: new Date().toISOString() } },
        { upsert: true }
      );
    } catch {
      // ignore
    }
  }
}

export function verifyAdminPasswordCredentials(email, password) {
  const safeEmail = String(email || "").trim().toLowerCase();
  const safePass = String(password || "");
  if (!safeEmail || !safePass) return false;

  const expectedEmail = cachedOwnerAuth?.email || getMasterAdminEmail();
  if (!timingSafeStringMatch(safeEmail, expectedEmail)) {
    return false;
  }

  // 1. Authoritative salted scrypt hash persisted in MongoDB `security_guard.ownerAuth`
  if (cachedOwnerAuth?.passwordHash) {
    return verifyAdminPasswordHash(safePass, cachedOwnerAuth.passwordHash);
  }

  // 2. Explicit salted scrypt hash in environment (`ADMIN_PASSWORD_HASH`)
  const envHash = String(process.env.ADMIN_PASSWORD_HASH || "").trim();
  if (envHash) {
    return verifyAdminPasswordHash(safePass, envHash);
  }

  // 3. Explicit environment password (`ADMIN_PASSWORD`) — NO hardcoded default fallback
  const envPass = String(process.env.ADMIN_PASSWORD || "");
  if (envPass) {
    return timingSafeStringMatch(safePass, envPass);
  }

  return false;
}

export function createAdminSessionToken({
  uid = MASTER_ADMIN_UID,
  email = getMasterAdminEmail(),
  role = "ADMIN",
  demo = false,
  ttlMs = ADMIN_TOKEN_TTL_MS,
  jti = crypto.randomUUID(),
} = {}) {
  const secret = getAdminTokenSecret();
  if (!secret) {
    const err = new Error(
      "Server authentication secret (AUTH_SECRET) is not configured."
    );
    err.statusCode = 503;
    throw err;
  }

  const now = nextMonotonicMs(Date.now());
  const payload = {
    jti: String(jti),
    uid: String(uid || MASTER_ADMIN_UID),
    email: String(email || getMasterAdminEmail()).toLowerCase(),
    role: String(role || "ADMIN").toUpperCase(),
    ...(demo ? { demo: true } : {}),
    iat: now,
    exp: now + (demo ? Math.min(Number(ttlMs), DEMO_ADMIN_TOKEN_TTL_MS) : Number(ttlMs)),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", secret)
    .update(encoded)
    .digest("base64url");
  return `${encoded}.${sig}`;
}

export function isAdminTokenRevoked(jti) {
  if (!jti) return false;
  const exp = revokedAdminTokenJtis.get(String(jti));
  if (!exp) return false;
  if (exp <= Date.now()) {
    revokedAdminTokenJtis.delete(String(jti));
    return false;
  }
  return true;
}

export function verifyAdminSessionToken(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const secret = getAdminTokenSecret();
  if (!secret) return null;

  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;
  try {
    const expectedSig = crypto
      .createHmac("sha256", secret)
      .update(encoded)
      .digest("base64url");
    const bufA = Buffer.from(providedSig, "utf8");
    const bufB = Buffer.from(expectedSig, "utf8");
    if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
      return null;
    }
    const decoded = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8")
    );
    if (!decoded || typeof decoded !== "object") return null;
    if (decoded.role !== "ADMIN") return null;
    if (decoded.demo && !isDemoAdminEnabled()) return null;
    if (!decoded.exp || Number(decoded.exp) <= Date.now()) return null;
    if (decoded.jti && isAdminTokenRevoked(decoded.jti)) return null;
    if (
      !decoded.demo &&
      cachedOwnerAuth?.sessionInvalidBeforeMs &&
      Number(decoded.iat || 0) < Number(cachedOwnerAuth.sessionInvalidBeforeMs)
    ) {
      return null;
    }
    return decoded;
  } catch {
    return null;
  }
}

export function revokeAdminSessionToken(token) {
  const verified = verifyAdminSessionToken(token);
  if (!verified || !verified.jti) return false;
  revokedAdminTokenJtis.set(
    String(verified.jti),
    Number(verified.exp) || Date.now() + ADMIN_TOKEN_TTL_MS
  );
  return true;
}

export async function revokeAdminSessionTokenDurable(token, db = null) {
  const verified = verifyAdminSessionToken(token);
  if (!verified || !verified.jti) return false;
  const exp = Number(verified.exp) || Date.now() + ADMIN_TOKEN_TTL_MS;
  const safeJti = String(verified.jti).replace(/[.$]/g, "_");
  revokedAdminTokenJtis.set(String(verified.jti), exp);
  if (db) {
    try {
      await db.collection("store_config").updateOne(
        { _id: SECURITY_GUARD_DOC_ID },
        {
          $set: {
            [`revokedJtis.${safeJti}`]: exp,
            updatedAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    } catch {
      // ignore transient DB failure
    }
  }
  return true;
}

export function sanitizeInput(value, depth = 0) {
  if (depth > 12) return null;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    return value.replace(/\0/g, "");
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return value;
  }
  if (Array.isArray(value)) {
    return value.slice(0, 500).map((item) => sanitizeInput(item, depth + 1));
  }
  if (typeof value === "object") {
    const clean = Object.create(null);
    for (const [rawKey, rawVal] of Object.entries(value)) {
      if (
        !rawKey ||
        FORBIDDEN_KEYS.has(rawKey) ||
        rawKey.startsWith("$") ||
        rawKey.includes(".") ||
        rawKey.includes("\0")
      ) {
        continue;
      }
      clean[rawKey] = sanitizeInput(rawVal, depth + 1);
    }
    return { ...clean };
  }
  return undefined;
}

export function containsNoSqlOperator(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (Array.isArray(raw)) return raw.some(containsNoSqlOperator);
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("$") || FORBIDDEN_KEYS.has(k)) return true;
    if (v && typeof v === "object" && containsNoSqlOperator(v)) return true;
  }
  return false;
}

export function asSafeId(val, maxLen = 128) {
  if (val === null || val === undefined) return "";
  if (typeof val !== "string" && typeof val !== "number") return "";
  const str = String(val).replace(/\0/g, "").trim();
  if (!str || str.startsWith("$") || str.length > maxLen) return "";
  return str;
}

export function asSafeEmail(val) {
  const str = asSafeId(val, 160).toLowerCase();
  if (!str) return "";
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(str) ? str : "";
}

export async function parseJsonBody(req) {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === "object") {
      const serializedLen = JSON.stringify(req.body).length;
      if (serializedLen > MAX_BODY_BYTES) {
        const err = new Error("Request payload exceeds maximum allowed size (512KB).");
        err.statusCode = 413;
        throw err;
      }
      return {
        sanitized: sanitizeInput(req.body),
        hadOperator: containsNoSqlOperator(req.body),
      };
    }
    if (typeof req.body === "string") {
      if (Buffer.byteLength(req.body, "utf8") > MAX_BODY_BYTES) {
        const err = new Error("Request payload exceeds maximum allowed size (512KB).");
        err.statusCode = 413;
        throw err;
      }
      if (!req.body.trim()) return { sanitized: {}, hadOperator: false };
      try {
        const parsed = JSON.parse(req.body);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          const err = new Error("JSON body must be an object.");
          err.statusCode = 400;
          throw err;
        }
        return {
          sanitized: sanitizeInput(parsed),
          hadOperator: containsNoSqlOperator(parsed),
        };
      } catch (e) {
        if (e.statusCode) throw e;
        const err = new Error("Malformed JSON request body.");
        err.statusCode = 400;
        throw err;
      }
    }
  }

  return new Promise((resolve, reject) => {
    let raw = "";
    let totalBytes = 0;
    let aborted = false;

    req.on("data", (chunk) => {
      if (aborted) return;
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk));
      totalBytes += buf.length;
      if (totalBytes > MAX_BODY_BYTES) {
        aborted = true;
        const err = new Error("Request payload exceeds maximum allowed size (512KB).");
        err.statusCode = 413;
        reject(err);
        return;
      }
      raw += buf.toString("utf8");
    });

    req.on("end", () => {
      if (aborted) return;
      if (!raw || !raw.trim()) {
        return resolve({ sanitized: {}, hadOperator: false });
      }
      try {
        const parsed = JSON.parse(raw);
        if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
          const err = new Error("JSON body must be an object.");
          err.statusCode = 400;
          return reject(err);
        }
        resolve({
          sanitized: sanitizeInput(parsed),
          hadOperator: containsNoSqlOperator(parsed),
        });
      } catch {
        const err = new Error("Malformed JSON request body.");
        err.statusCode = 400;
        reject(err);
      }
    });

    req.on("error", () => {
      if (!aborted) {
        const err = new Error("Failed to read request stream.");
        err.statusCode = 400;
        reject(err);
      }
    });
  });
}

function getHeader(req, name) {
  const headers = req?.headers || {};
  const val = headers[name.toLowerCase()] ?? headers[name];
  return typeof val === "string" ? val.trim() : "";
}

/**
 * Resolves caller identity and checks authoritative admin status.
 * Prevents horizontal & vertical privilege escalation.
 */
export function resolveCaller(req, state) {
  const uid = asSafeId(getHeader(req, "x-user-uid"), 128);
  const email = asSafeEmail(getHeader(req, "x-user-email"));
  const adminKey = getHeader(req, "x-admin-key");
  const adminTokenHeader = getHeader(req, "x-admin-token");
  const authHeader = getHeader(req, "authorization");
  const bearerToken = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : "";

  const dbUsers = Array.isArray(state?.users) ? state.users : [];
  const dbUser = uid
    ? dbUsers.find((u) => String(u.uid) === uid)
    : email
      ? dbUsers.find((u) => String(u.email || "").toLowerCase() === email)
      : null;

  const verifiedAdminSession =
    verifyAdminSessionToken(adminTokenHeader) ||
    verifyAdminSessionToken(bearerToken);

  const configuredAdminKey = getAdminAccessKey();
  const hasExplicitEnvAdminKey =
    Boolean(configuredAdminKey) &&
    (timingSafeStringMatch(adminKey, configuredAdminKey) ||
      timingSafeStringMatch(bearerToken, configuredAdminKey));

  const isAdmin = Boolean(verifiedAdminSession) || hasExplicitEnvAdminKey;
  const resolvedUid = verifiedAdminSession?.uid || uid;
  const resolvedEmail = verifiedAdminSession?.email || email;

  return {
    uid: resolvedUid,
    email: resolvedEmail,
    isAuthenticated: Boolean(resolvedUid || isAdmin),
    isAdmin,
    isDemoAdmin: Boolean(verifiedAdminSession?.demo),
    dbUser,
    adminSession: verifiedAdminSession || null,
  };
}

export function canAccessUser(caller, targetUid) {
  const safeTarget = asSafeId(targetUid, 128);
  if (!safeTarget) return false;
  if (caller.isAdmin) return true;
  if (!caller.uid) return false;
  return caller.uid === safeTarget;
}

const ALLOWED_ORIGINS = new Set([
  "https://fullstack-ummo-eccomerce.vercel.app",
  "http://localhost:5173",
  "http://localhost:4173",
  "http://127.0.0.1:5173",
]);

export function sendJson(req, res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");

  const origin = getHeader(req, "origin");
  if (origin && (ALLOWED_ORIGINS.has(origin) || origin.endsWith(".vercel.app"))) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  } else {
    res.setHeader("Access-Control-Allow-Origin", "https://fullstack-ummo-eccomerce.vercel.app");
  }

  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key, X-User-Uid, X-User-Email, X-Admin-Key, X-Admin-Token"
  );
  res.end(JSON.stringify(payload));
}
