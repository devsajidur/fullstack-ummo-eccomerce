import crypto from "crypto";

const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
export const MAX_BODY_BYTES = 512 * 1024; // 512 KB

export const MASTER_ADMIN_UID = "admin-ummo-master";
export const MASTER_ADMIN_EMAIL =
  (process.env.ADMIN_EMAIL || "admin@ummo.com").trim().toLowerCase();
export const MASTER_ADMIN_PASSWORD =
  process.env.ADMIN_PASSWORD || "Admin@12345";
export const ADMIN_ACCESS_KEY =
  process.env.UMMO_ADMIN_KEY || "UMMO_ADMIN_SHIELD_2026";
const ADMIN_TOKEN_SECRET =
  process.env.ADMIN_TOKEN_SECRET ||
  `${ADMIN_ACCESS_KEY}::ummo_enterprise_hmac_2026`;
export const ADMIN_TOKEN_TTL_MS = 12 * 60 * 60 * 1000; // 12 hours

// Revoked token registry (JTI -> expiration timestamp)
const revokedAdminTokenJtis = new Map();

// Brute-force login rate limiter (key -> { count, firstAttemptAt, lockedUntil })
const adminLoginAttempts = new Map();
export const ADMIN_LOGIN_MAX_ATTEMPTS = 5;
export const ADMIN_LOGIN_WINDOW_MS = 15 * 60 * 1000; // 15 minutes

/**
 * Determines whether interactive sandbox payment confirmation is permitted.
 * Disabled by default (fail-closed). Requires explicit non-production configuration:
 * - Neither NODE_ENV, VERCEL_ENV, nor PAYMENT_ENV may be "production"
 * - PAYMENT_MODE must be explicitly set to "sandbox"
 * - ALLOW_SANDBOX_CONFIRM must be explicitly set to "true"
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

export function checkAdminLoginRateLimit(key, nowMs = Date.now()) {
  const safeKey = String(key || "anonymous").trim().toLowerCase().slice(0, 160);
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

export function recordAdminLoginFailure(key, nowMs = Date.now()) {
  const safeKey = String(key || "anonymous").trim().toLowerCase().slice(0, 160);
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

export function clearAdminLoginFailures(key) {
  const safeKey = String(key || "anonymous").trim().toLowerCase().slice(0, 160);
  adminLoginAttempts.delete(safeKey);
}

export function resetAdminRateLimitsForTest() {
  adminLoginAttempts.clear();
}

export function verifyAdminPasswordCredentials(email, password) {
  const safeEmail = String(email || "").trim().toLowerCase();
  const safePass = String(password || "");
  if (!safeEmail || !safePass) return false;
  const emailHashA = crypto.createHash("sha256").update(safeEmail).digest();
  const emailHashB = crypto
    .createHash("sha256")
    .update(MASTER_ADMIN_EMAIL)
    .digest();
  const passHashA = crypto.createHash("sha256").update(safePass).digest();
  const passHashB = crypto
    .createHash("sha256")
    .update(MASTER_ADMIN_PASSWORD)
    .digest();
  return (
    crypto.timingSafeEqual(emailHashA, emailHashB) &&
    crypto.timingSafeEqual(passHashA, passHashB)
  );
}

export function createAdminSessionToken({
  uid = MASTER_ADMIN_UID,
  email = MASTER_ADMIN_EMAIL,
  role = "ADMIN",
  ttlMs = ADMIN_TOKEN_TTL_MS,
  jti = crypto.randomUUID(),
} = {}) {
  const now = Date.now();
  const payload = {
    jti: String(jti),
    uid: String(uid || MASTER_ADMIN_UID),
    email: String(email || MASTER_ADMIN_EMAIL).toLowerCase(),
    role: String(role || "ADMIN").toUpperCase(),
    iat: now,
    exp: now + Number(ttlMs),
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url"
  );
  const sig = crypto
    .createHmac("sha256", ADMIN_TOKEN_SECRET)
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
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, providedSig] = parts;
  if (!encoded || !providedSig) return null;
  try {
    const expectedSig = crypto
      .createHmac("sha256", ADMIN_TOKEN_SECRET)
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
    if (!decoded.exp || Number(decoded.exp) <= Date.now()) return null;
    if (decoded.jti && isAdminTokenRevoked(decoded.jti)) return null;
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

/**
 * Recursively strips MongoDB operators ($ne, $gt, $where, etc.), dot-path keys,
 * and prototype pollution keys (__proto__, constructor, prototype).
 */
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

/**
 * Validates that raw input does not contain any top-level or nested MongoDB operator object
 * where a primitive string/number identifier is expected.
 */
export function containsNoSqlOperator(raw) {
  if (!raw || typeof raw !== "object") return false;
  if (Array.isArray(raw)) return raw.some(containsNoSqlOperator);
  for (const [k, v] of Object.entries(raw)) {
    if (k.startsWith("$") || FORBIDDEN_KEYS.has(k)) return true;
    if (v && typeof v === "object" && containsNoSqlOperator(v)) return true;
  }
  return false;
}

/**
 * Coerces a scalar ID safely; returns empty string if an object/array/operator is passed.
 */
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

/**
 * Parses and validates JSON request body with strict byte-size limit and NoSQL operator sanitization.
 */
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

  const hasValidAdminSecret =
    Boolean(verifiedAdminSession) ||
    adminKey === ADMIN_ACCESS_KEY ||
    bearerToken === ADMIN_ACCESS_KEY;

  const isAdmin = Boolean(hasValidAdminSecret);
  const resolvedUid = verifiedAdminSession?.uid || uid;
  const resolvedEmail = verifiedAdminSession?.email || email;

  return {
    uid: resolvedUid,
    email: resolvedEmail,
    isAuthenticated: Boolean(resolvedUid || isAdmin),
    isAdmin,
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
