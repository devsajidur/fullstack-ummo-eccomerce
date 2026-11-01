import crypto from "node:crypto";

const SCRYPT_KEYLEN = 64;
const SCRYPT_SALT_BYTES = 16;

const DISALLOWED_WEAK_PASSWORDS = new Set([
  "admin@12345",
  "admin@123456",
  "demoadmin@2026",
  "password123!",
  "admin123456!",
  "ummo@1234567",
]);

/**
 * Validates that an owner-supplied password meets enterprise complexity rules
 * and is not one of the previously exposed default passwords.
 */
export function validateOwnerPasswordPolicy(password) {
  if (typeof password !== "string") {
    return { valid: false, error: "Password must be a string." };
  }
  if (password.length < 12) {
    return {
      valid: false,
      error: "Owner administrator password must be at least 12 characters long.",
    };
  }
  if (password.length > 128) {
    return {
      valid: false,
      error: "Password must not exceed 128 characters.",
    };
  }
  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      error: "Password must include at least one uppercase letter.",
    };
  }
  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      error: "Password must include at least one lowercase letter.",
    };
  }
  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      error: "Password must include at least one number.",
    };
  }
  if (!/[^A-Za-z0-9\s]/.test(password)) {
    return {
      valid: false,
      error: "Password must include at least one special symbol.",
    };
  }
  if (DISALLOWED_WEAK_PASSWORDS.has(password.trim().toLowerCase())) {
    return {
      valid: false,
      error: "Previously exposed or common default passwords cannot be used.",
    };
  }
  return { valid: true, error: null };
}

/**
 * Hashes a password using Node's cryptographic scrypt KDF with a 16-byte random salt
 * and 64-byte derived key (`scrypt$<saltHex>$<derivedKeyHex>`).
 */
export function hashAdminPassword(password) {
  if (typeof password !== "string" || !password) {
    throw new Error("Non-empty password string is required for hashing.");
  }
  const saltHex = crypto.randomBytes(SCRYPT_SALT_BYTES).toString("hex");
  const derivedKey = crypto.scryptSync(password, saltHex, SCRYPT_KEYLEN);
  return `scrypt$${saltHex}$${derivedKey.toString("hex")}`;
}

/**
 * Constant-time verification of a plaintext password against a stored scrypt hash.
 * Supports both `scrypt$<saltHex>$<keyHex>` and `<saltHex>:<keyHex>` formats.
 */
export function verifyAdminPasswordHash(password, storedHash) {
  if (
    typeof password !== "string" ||
    !password ||
    typeof storedHash !== "string" ||
    !storedHash
  ) {
    return false;
  }

  let saltHex = "";
  let keyHex = "";

  if (storedHash.startsWith("scrypt$")) {
    const parts = storedHash.split("$");
    if (parts.length !== 3) return false;
    saltHex = parts[1];
    keyHex = parts[2];
  } else if (storedHash.includes(":")) {
    const parts = storedHash.split(":");
    if (parts.length !== 2) return false;
    saltHex = parts[0];
    keyHex = parts[1];
  } else {
    return false;
  }

  if (!saltHex || !keyHex || keyHex.length !== SCRYPT_KEYLEN * 2) {
    return false;
  }

  try {
    const expectedBuf = Buffer.from(keyHex, "hex");
    if (expectedBuf.length !== SCRYPT_KEYLEN) return false;
    const derivedBuf = crypto.scryptSync(password, saltHex, SCRYPT_KEYLEN);
    return (
      derivedBuf.length === expectedBuf.length &&
      crypto.timingSafeEqual(derivedBuf, expectedBuf)
    );
  } catch {
    return false;
  }
}

export function timingSafeStringMatch(a, b) {
  const strA = String(a ?? "");
  const strB = String(b ?? "");
  if (!strA || !strB) return false;
  const hashA = crypto.createHash("sha256").update(strA, "utf8").digest();
  const hashB = crypto.createHash("sha256").update(strB, "utf8").digest();
  return crypto.timingSafeEqual(hashA, hashB) && strA.length === strB.length;
}
