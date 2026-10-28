import { Router } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import {
  hashPassword,
  verifyPassword,
  hashToken,
} from "../utils/crypto.js";
import { authRateLimiter, requireAuth } from "../middlewares/security.js";

const router = Router();

const JWT_ACCESS_SECRET =
  process.env.JWT_ACCESS_SECRET || "dev_enterprise_access_secret_change_in_prod";
const JWT_REFRESH_SECRET =
  process.env.JWT_REFRESH_SECRET ||
  "dev_enterprise_refresh_secret_change_in_prod";

// In-memory store fallback when PostgreSQL is not yet connected locally
const memoryUsers = new Map();
const memoryRefreshTokens = new Map();

const registerSchema = z.object({
  fullName: z.string().min(2).max(120),
  email: z.string().email().max(255),
  password: z
    .string()
    .min(8, "Password must be at least 8 characters")
    .max(100),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function issueTokens(user, res) {
  const accessToken = jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    JWT_ACCESS_SECRET,
    { expiresIn: process.env.JWT_ACCESS_EXPIRES_IN || "15m" }
  );

  const refreshToken = jwt.sign(
    { sub: user.id, tokenFamily: Date.now() },
    JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || "7d" }
  );

  memoryRefreshTokens.set(hashToken(refreshToken), {
    userId: user.id,
    revoked: false,
    createdAt: new Date().toISOString(),
  });

  // Set HttpOnly, Secure, SameSite=Strict cookie
  res.cookie("ummo_refresh_token", refreshToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/api/v1/auth",
  });

  return accessToken;
}

router.post("/register", authRateLimiter, async (req, res, next) => {
  try {
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: parsed.error.issues[0].message,
      });
    }

    const email = parsed.data.email.toLowerCase().trim();
    if (memoryUsers.has(email)) {
      return res.status(409).json({
        success: false,
        error: "An account with this email already exists.",
      });
    }

    const passwordHash = await hashPassword(parsed.data.password);
    const newUser = {
      id: `usr_${Date.now()}`,
      fullName: parsed.data.fullName.trim(),
      email,
      passwordHash,
      role: "CUSTOMER",
      createdAt: new Date().toISOString(),
    };

    memoryUsers.set(email, newUser);
    const accessToken = issueTokens(newUser, res);

    res.status(201).json({
      success: true,
      data: {
        accessToken,
        user: {
          id: newUser.id,
          fullName: newUser.fullName,
          email: newUser.email,
          role: newUser.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/login", authRateLimiter, async (req, res, next) => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        success: false,
        error: "Valid email and password are required.",
      });
    }

    const email = parsed.data.email.toLowerCase().trim();
    const user = memoryUsers.get(email);

    if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
      return res.status(401).json({
        success: false,
        error: "Invalid email or password.",
      });
    }

    const accessToken = issueTokens(user, res);

    res.json({
      success: true,
      data: {
        accessToken,
        user: {
          id: user.id,
          fullName: user.fullName,
          email: user.email,
          role: user.role,
        },
      },
    });
  } catch (err) {
    next(err);
  }
});

router.post("/refresh", async (req, res) => {
  const rawRefresh = req.cookies?.ummo_refresh_token;
  if (!rawRefresh) {
    return res.status(401).json({
      success: false,
      error: "Missing refresh token cookie.",
    });
  }

  try {
    const payload = jwt.verify(rawRefresh, JWT_REFRESH_SECRET);
    const tokenKey = hashToken(rawRefresh);
    const record = memoryRefreshTokens.get(tokenKey);

    if (!record || record.revoked) {
      return res.status(401).json({
        success: false,
        error: "Refresh token has been revoked or rotated.",
      });
    }

    // Rotate refresh token (invalidate old one)
    record.revoked = true;
    const user = [...memoryUsers.values()].find((u) => u.id === payload.sub);
    if (!user) {
      return res.status(401).json({ success: false, error: "User not found." });
    }

    const accessToken = issueTokens(user, res);
    res.json({ success: true, data: { accessToken } });
  } catch {
    return res.status(401).json({
      success: false,
      error: "Invalid or expired refresh token.",
    });
  }
});

router.post("/logout", (req, res) => {
  const rawRefresh = req.cookies?.ummo_refresh_token;
  if (rawRefresh) {
    const record = memoryRefreshTokens.get(hashToken(rawRefresh));
    if (record) record.revoked = true;
  }
  res.clearCookie("ummo_refresh_token", { path: "/api/v1/auth" });
  res.json({ success: true, message: "Logged out successfully." });
});

router.get("/me", requireAuth, (req, res) => {
  res.json({
    success: true,
    data: { user: req.user },
  });
});

export default router;
