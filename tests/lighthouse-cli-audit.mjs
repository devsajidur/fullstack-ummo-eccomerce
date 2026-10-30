/**
 * ============================================================================
 * UMMO ECOMMERCE — REAL LIGHTHOUSE CLI AUDIT SUITE (MOBILE & DESKTOP)
 * ============================================================================
 * Runs real Lighthouse CLI (v13.6.0) audits against the production Vite preview
 * server (http://localhost:4173) for:
 *   1. Homepage (`/`)
 *   2. Shop (`/shop`)
 *   3. Category (`/category/women`)
 *   4. Discounts (`/discounts`)
 *   5. Single Product (`/shop/1`)
 * across both Mobile and Desktop presets, saving raw JSON reports into
 * `verification-evidence/lighthouse/lh-<page>-<mobile|desktop>.json` and
 * generating a summary JSON report `verification-evidence/lighthouse-summary.json`.
 * ============================================================================
 */

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT_DIR = path.resolve(__dirname, "..");

const LIGHTHOUSE_CLI =
  "C:\\Users\\User\\AppData\\Local\\npm-cache\\_npx\\0f94ee7615faf582\\node_modules\\lighthouse\\cli\\index.js";

const envPath = path.join(ROOT_DIR, ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eqIdx = trimmed.indexOf("=");
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      const val = trimmed.slice(eqIdx + 1).trim().replace(/^['"]|['"]$/g, "");
      if (!process.env[key]) process.env[key] = val;
    }
  }
}

const CHROME_PATH = "C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe";
const BASE_URL = "http://localhost:4173";
const LH_DIR = path.join(ROOT_DIR, "verification-evidence", "lighthouse");
fs.mkdirSync(LH_DIR, { recursive: true });

async function waitForServer(url, timeoutMs = 25000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return true;
    } catch {
      // retry
    }
    await new Promise((r) => setTimeout(r, 400));
  }
  throw new Error(`Timed out waiting for server at ${url}`);
}

const PAGES = [
  { slug: "home", route: "/" },
  { slug: "shop", route: "/shop" },
  { slug: "category-women", route: "/category/women" },
  { slug: "discounts", route: "/discounts" },
  { slug: "product-1", route: "/shop/1" },
];

const MODES = ["mobile", "desktop"];

async function runLighthouseAudits() {
  console.log("1. Starting Vite production preview server on port 4173 for Lighthouse CLI audits...");
  const viteProc = spawn(
    process.execPath,
    [path.join(ROOT_DIR, "node_modules", "vite", "bin", "vite.js"), "preview", "--port", "4173", "--strictPort"],
    {
      cwd: ROOT_DIR,
      stdio: ["ignore", "pipe", "pipe"],
      env: { ...process.env, NODE_ENV: "production" },
    }
  );

  const summary = {
    executedAt: new Date().toISOString(),
    lighthouseVersion: "13.6.0",
    baseUrl: BASE_URL,
    results: [],
  };

  try {
    await waitForServer(BASE_URL);
    // Warm up the API catalog endpoint once so initial MongoDB seed/cache is warm
    try {
      await fetch(`${BASE_URL}/api/v1/products?limit=24`);
    } catch {
      // ignore
    }

    for (const pg of PAGES) {
      for (const mode of MODES) {
        const targetUrl = `${BASE_URL}${pg.route}`;
        const outJsonPath = path.join(LH_DIR, `lh-${pg.slug}-${mode}.json`);
        console.log(`\n-> Auditing [${mode.toUpperCase()}] ${targetUrl} ...`);

        const args = [
          LIGHTHOUSE_CLI,
          targetUrl,
          `--chrome-path=${CHROME_PATH}`,
          "--chrome-flags=--headless=new --no-sandbox --disable-gpu --incognito --disable-extensions",
          "--only-categories=performance,accessibility,best-practices,seo",
          "--output=json",
          `--output-path=${outJsonPath}`,
          "--quiet",
        ];

        if (mode === "desktop") {
          args.push("--preset=desktop");
        }

        await new Promise((resolve, reject) => {
          const lhProc = spawn(process.execPath, args, {
            cwd: ROOT_DIR,
            stdio: "inherit",
            env: { ...process.env, CHROME_PATH },
          });
          lhProc.on("error", reject);
          lhProc.on("close", (code) => {
            if (code === 0 || fs.existsSync(outJsonPath)) {
              resolve();
            } else {
              reject(new Error(`Lighthouse exited with code ${code}`));
            }
          });
        });

        const raw = JSON.parse(fs.readFileSync(outJsonPath, "utf8"));
        const cats = raw.categories || {};
        const audits = raw.audits || {};

        const scoreObj = {
          page: pg.slug,
          route: pg.route,
          mode,
          reportFile: `verification-evidence/lighthouse/lh-${pg.slug}-${mode}.json`,
          scores: {
            performance: Math.round((cats.performance?.score || 0) * 100),
            accessibility: Math.round((cats.accessibility?.score || 0) * 100),
            bestPractices: Math.round((cats["best-practices"]?.score || 0) * 100),
            seo: Math.round((cats.seo?.score || 0) * 100),
          },
          metrics: {
            fcp: audits["first-contentful-paint"]?.displayValue || "",
            lcp: audits["largest-contentful-paint"]?.displayValue || "",
            tbt: audits["total-blocking-time"]?.displayValue || "",
            cls: audits["cumulative-layout-shift"]?.displayValue || "",
            si: audits["speed-index"]?.displayValue || "",
          },
        };

        summary.results.push(scoreObj);
        console.log(
          `   Scores (${pg.slug} - ${mode}): Perf=${scoreObj.scores.performance} | A11y=${scoreObj.scores.accessibility} | BP=${scoreObj.scores.bestPractices} | SEO=${scoreObj.scores.seo} | LCP=${scoreObj.metrics.lcp} | CLS=${scoreObj.metrics.cls}`
        );
      }
    }

    const summaryPath = path.join(ROOT_DIR, "verification-evidence", "lighthouse-summary.json");
    fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));
    console.log(`\nSaved Lighthouse CLI summary to: ${summaryPath}`);
  } finally {
    viteProc.kill();
  }
}

runLighthouseAudits().catch((err) => {
  console.error("Lighthouse Audit Error:", err);
  process.exit(1);
});
