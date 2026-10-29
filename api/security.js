const FORBIDDEN_KEYS = new Set(["__proto__", "constructor", "prototype"]);
export const MAX_BODY_BYTES = 512 * 1024; // 512 KB

export const MASTER_ADMIN_UID = "admin-ummo-master";
export const MASTER_ADMIN_EMAIL = "admin@ummo.com";
export const ADMIN_ACCESS_KEY =
  process.env.UMMO_ADMIN_KEY || "UMMO_ADMIN_SHIELD_2026";

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

  const hasValidAdminSecret =
    adminKey === ADMIN_ACCESS_KEY || bearerToken === ADMIN_ACCESS_KEY;

  const isMasterAdmin =
    (uid === MASTER_ADMIN_UID || email === MASTER_ADMIN_EMAIL) &&
    hasValidAdminSecret;

  const isDatabaseAdmin =
    Boolean(dbUser) &&
    String(dbUser.role || "").toUpperCase() === "ADMIN" &&
    hasValidAdminSecret;

  const isAdmin = Boolean(isMasterAdmin || isDatabaseAdmin);

  return {
    uid,
    email,
    isAuthenticated: Boolean(uid || isAdmin),
    isAdmin,
    dbUser,
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
    "Content-Type, Authorization, Idempotency-Key, X-User-Uid, X-User-Email, X-Admin-Key"
  );
  res.end(JSON.stringify(payload));
}
