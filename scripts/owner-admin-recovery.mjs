#!/usr/bin/env node
/**
 * Local Owner Administrator Recovery & Password Reset Utility
 *
 * Security guarantees:
 * - Runs strictly as an authenticated local CLI against MongoDB Atlas (zero public HTTP endpoints).
 * - Rejects passwords passed on the command line (prevents shell history / process table leaks).
 * - Mutes terminal echo during interactive TTY password entry.
 * - Preserves existing owner user record, customer records, orders, and store configuration.
 * - Stores a salted `crypto.scrypt` password hash (`16-byte` random salt, `64-byte` key) in
 *   `store_config` (`_id: "security_guard"`) and invalidates all previous admin sessions.
 * - Never prints passwords, hashes, or connection strings to stdout/stderr.
 */

import readline from "node:readline";
import { Writable } from "node:stream";
import { loadServerEnv } from "../api/_services/envLoader.js";
import {
  closeMongoConnection,
  DB_NAME,
  getMongoDb,
  isMongoConfigured,
} from "../api/db.js";
import {
  getMasterAdminEmail,
  MASTER_ADMIN_UID,
  SECURITY_GUARD_DOC_ID,
  setOwnerAdminPasswordDurable,
  validateOwnerPasswordPolicy,
} from "../api/security.js";

loadServerEnv();

function readHiddenPrompt(promptText) {
  return new Promise((resolve, reject) => {
    let muted = false;
    const mutableStdout = new Writable({
      write(chunk, encoding, callback) {
        if (!muted) {
          process.stdout.write(chunk, encoding);
        }
        callback();
      },
    });

    const rl = readline.createInterface({
      input: process.stdin,
      output: mutableStdout,
      terminal: true,
    });

    rl.on("SIGINT", () => {
      rl.close();
      process.stdout.write("\nAborted.\n");
      reject(new Error("Owner recovery cancelled by user."));
    });

    rl.question(promptText, (answer) => {
      muted = false;
      process.stdout.write("\n");
      rl.close();
      resolve(answer);
    });
    muted = true;
  });
}

async function readNonInteractiveStdinLines() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  const lines = Buffer.concat(chunks)
    .toString("utf8")
    .split(/\r?\n/);
  return {
    newPassword: lines[0] || "",
    confirmPassword: lines[1] || "",
  };
}

async function main() {
  const cliArgs = process.argv.slice(2);
  if (cliArgs.length > 0) {
    console.error(
      "[SECURITY BLOCK] Do not pass passwords or arguments on the command line (CLI arguments leak into shell history). Run `npm run admin:recover` and enter the password at the hidden prompt."
    );
    process.exitCode = 1;
    return;
  }

  if (!isMongoConfigured()) {
    console.error(
      "[CONFIG ERROR] MONGODB_URI is not configured. Ensure `.env.local` contains your MongoDB Atlas connection string before running owner recovery."
    );
    process.exitCode = 1;
    return;
  }

  const ownerEmail = getMasterAdminEmail();
  console.log("=== UMMO ECOMMERCE — LOCAL OWNER ADMIN RECOVERY ===");
  console.log(`Target Database : ${DB_NAME} (MongoDB Atlas)`);
  console.log(`Owner Identifier: ${ownerEmail}`);
  console.log(
    "Policy          : Minimum 12 chars with uppercase, lowercase, number, and symbol.\n"
  );

  let newPassword = "";
  let confirmPassword = "";

  if (process.stdin.isTTY) {
    newPassword = await readHiddenPrompt("Enter new Owner Admin password: ");
    confirmPassword = await readHiddenPrompt(
      "Confirm new Owner Admin password: "
    );
  } else {
    const piped = await readNonInteractiveStdinLines();
    newPassword = piped.newPassword;
    confirmPassword = piped.confirmPassword;
  }

  if (!newPassword || newPassword !== confirmPassword) {
    console.error(
      "[VALIDATION ERROR] Passwords did not match or were empty. No database changes were made."
    );
    process.exitCode = 1;
    return;
  }

  const policy = validateOwnerPasswordPolicy(newPassword);
  if (!policy.valid) {
    console.error(`[POLICY ERROR] ${policy.error}`);
    process.exitCode = 1;
    return;
  }

  const db = await getMongoDb({ forceRetry: true, timeoutMs: 8000 });
  if (!db) {
    console.error(
      "[DB ERROR] Unable to connect to MongoDB Atlas (`ummo_ecommerce`). Verify MONGODB_URI in `.env.local` and network access."
    );
    process.exitCode = 1;
    return;
  }

  try {
    const existingOwner = await db.collection("users").findOne({
      email: { $regex: `^${ownerEmail.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, $options: "i" },
    });

    const preservedUid = existingOwner?.uid
      ? String(existingOwner.uid)
      : MASTER_ADMIN_UID;

    if (existingOwner) {
      if (existingOwner.role !== "ADMIN") {
        await db.collection("users").updateOne(
          { _id: existingOwner._id },
          {
            $set: {
              role: "ADMIN",
              roleUpdatedAt: new Date().toISOString(),
            },
          }
        );
      }
    } else {
      await db.collection("users").updateOne(
        { uid: preservedUid },
        {
          $setOnInsert: {
            uid: preservedUid,
            email: ownerEmail,
            displayName: "UOMO Store Administrator",
            role: "ADMIN",
            createdAt: new Date().toISOString(),
          },
        },
        { upsert: true }
      );
    }

    const rotation = await setOwnerAdminPasswordDurable({
      email: ownerEmail,
      uid: preservedUid,
      newPassword,
      db,
    });

    // Clear any prior brute-force lockout buckets so the owner can sign in immediately
    await db.collection("store_config").updateOne(
      { _id: SECURITY_GUARD_DOC_ID },
      {
        $set: {
          loginAttempts: {},
          updatedAt: rotation.passwordUpdatedAt,
        },
      }
    );

    console.log("\n[RECOVERY COMPLETE]");
    console.log(`  Owner Email                  : ${rotation.email}`);
    console.log(`  Preserved Owner UID          : ${rotation.uid}`);
    console.log(
      "  Password Hashing             : crypto.scrypt (16B salt, 64B key)"
    );
    console.log(`  Updated At                   : ${rotation.passwordUpdatedAt}`);
    console.log("  Previous Sessions Invalidated: YES");
    console.log("  Login Lockouts Cleared       : YES");
  } finally {
    newPassword = "";
    confirmPassword = "";
    await closeMongoConnection();
  }
}

main().catch(async (err) => {
  console.error(`[RECOVERY ERROR] ${err?.message || "Unexpected error"}`);
  await closeMongoConnection();
  process.exitCode = 1;
});
