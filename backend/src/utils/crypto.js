import crypto from "node:crypto";
import { promisify } from "node:util";

const scryptAsync = promisify(crypto.scrypt);

/**
 * Enterprise Password Hashing using Node's native cryptographic scrypt KDF
 * with 16-byte random salt and 64-byte derived key.
 */
export async function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString("hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return `${salt}:${derivedKey.toString("hex")}`;
}

/**
 * Constant-time password verification (prevents timing side-channel attacks)
 */
export async function verifyPassword(password, storedHash) {
  if (!storedHash || !storedHash.includes(":")) return false;
  const [salt, keyHex] = storedHash.split(":");
  const keyBuffer = Buffer.from(keyHex, "hex");
  const derivedKey = await scryptAsync(password, salt, 64);
  return crypto.timingSafeEqual(keyBuffer, derivedKey);
}

/**
 * SHA-256 hash for storing Refresh Tokens in DB (never store raw tokens)
 */
export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

/**
 * Generates a unique, human-readable enterprise Order Number
 */
export function generateOrderNumber() {
  const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
  const randPart = crypto.randomBytes(3).toString("hex").toUpperCase();
  return `UMMO-${datePart}-${randPart}`;
}
