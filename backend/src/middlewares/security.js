import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import rateLimit from "express-rate-limit";

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "dev_enterprise_access_secret_change_in_prod";

/**
 * Attach unique X-Request-Id to every request for audit tracing
 */
export function requestTracing(req, res, next) {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  req.requestId = requestId;
  res.setHeader("X-Request-Id", requestId);
  next();
}

/**
 * Global API Rate Limiter (120 requests per minute per IP)
 */
export const apiRateLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many requests from this IP. Please try again in 1 minute.",
  },
});

/**
 * Strict Auth Rate Limiter (10 attempts per 15 minutes per IP)
 * Protects Login, Register, and Password Reset from brute-force attacks.
 */
export const authRateLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    error: "Too many authentication attempts. Please try again after 15 minutes.",
  },
});

/**
 * JWT Authentication Guard
 */
export function requireAuth(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({
      success: false,
      error: "Authentication required. Missing Bearer token.",
    });
  }

  const token = authHeader.split(" ")[1];
  try {
    const payload = jwt.verify(token, JWT_ACCESS_SECRET);
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired access token.",
    });
  }
}

/**
 * Role-Based Access Control (RBAC) Guard
 */
export function requireRole(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user || !allowedRoles.includes(req.user.role)) {
      return res.status(403).json({
        success: false,
        error: "Forbidden: Insufficient permissions for this resource.",
      });
    }
    next();
  };
}

/**
 * Centralized Enterprise Error Handler
 * Masks internal stack traces in production to prevent information disclosure.
 */
export function errorHandler(err, req, res, _next) {
  const statusCode = err.statusCode || 500;
  const isProd = process.env.NODE_ENV === "production";

  console.error(`[Error][Req:${req.requestId}]`, err.message);

  res.status(statusCode).json({
    success: false,
    requestId: req.requestId,
    error:
      statusCode === 500 && isProd
        ? "Internal server error"
        : err.message || "Unexpected error occurred",
  });
}
