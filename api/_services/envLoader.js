import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

let envLoaded = false;

function parseEnvContent(raw) {
  const entries = [];
  for (const line of raw.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const cleaned = trimmed.startsWith("export ")
      ? trimmed.slice(7).trim()
      : trimmed;
    const eqIdx = cleaned.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = cleaned.slice(0, eqIdx).trim();
    let val = cleaned.slice(eqIdx + 1).trim();
    if (
      (val.startsWith('"') && val.endsWith('"')) ||
      (val.startsWith("'") && val.endsWith("'"))
    ) {
      val = val.slice(1, -1);
    }
    if (key) {
      entries.push([key, val]);
    }
  }
  return entries;
}

/**
 * Loads server-side environment variables from Git-ignored `.env.local` and `.env`
 * during local development, CLI recovery, and test runs without overwriting
 * variables already injected by Vercel or explicit process.env overrides.
 */
export function loadServerEnv() {
  if (envLoaded) return;
  envLoaded = true;

  try {
    const moduleDir = path.dirname(fileURLToPath(import.meta.url));
    const rootDir = path.resolve(moduleDir, "..", "..");
    const candidates = [
      path.join(rootDir, ".env.local"),
      path.join(rootDir, ".env"),
    ];

    for (const filePath of candidates) {
      if (!fs.existsSync(filePath)) continue;
      const raw = fs.readFileSync(filePath, "utf8");
      for (const [key, val] of parseEnvContent(raw)) {
        if (process.env[key] === undefined) {
          process.env[key] = val;
        }
      }
    }
  } catch {
    // Ignore filesystem errors in read-only or serverless runtimes where process.env is pre-populated
  }
}
