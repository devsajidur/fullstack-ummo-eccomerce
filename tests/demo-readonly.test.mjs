import test, { mock } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
const actualDb = await import("../api/db.js");
const security = await import("../api/security.js");
process.env.AUTH_SECRET = crypto.randomBytes(32).toString("hex");
process.env.DEMO_ADMIN_ENABLED = "true";
const demoPassword = crypto.randomBytes(24).toString("hex");
const ownerPassword = crypto.randomBytes(24).toString("hex");
process.env.DEMO_ADMIN_PASSWORD_HASH = security.hashAdminPassword(demoPassword);
process.env.DEMO_ADMIN_PUBLIC_PASSWORD = demoPassword;
process.env.ADMIN_PASSWORD_HASH = security.hashAdminPassword(ownerPassword);
let businessWrites = 0;
let connected = true;
const state = {
  storeConfig: { customProducts: [{ id: 1, title: "Live product", stock: 7, passwordHash: "PRIVATE_HASH" }], coupons: [], banners: {}, privateKey: "PRIVATE_KEY" },
  orders: [{ orderId: "o1", userUid: "c1", username: "Customer Name", email: "private@example.test", total: 137, status: "PAID", paymentStatus: "PAID", billing: { phone: "01712345678", streetAddress: "PRIVATE_STREET", orderNotes: "PRIVATE_NOTE" }, paymentToken: "PRIVATE_TOKEN", OrderItems: [{ title: "Live product", quantity: 2, price: 50, optionalMessage: "PRIVATE_NOTE" }] }],
  users: [{ uid: "c1", email: "private@example.test", passwordHash: "PRIVATE_HASH" }, { uid: security.MASTER_ADMIN_UID, email: security.MASTER_ADMIN_EMAIL }],
  payments: [{ paymentId: "p1", orderId: "o1", amount: 137, status: "PAID", credentials: "PRIVATE_CREDENTIAL" }],
  addresses: { c1: [{ street: "PRIVATE_STREET" }] }, reviews: { 1: [{ email: "private@example.test" }] },
  messages: [{ id: "m1", email: "private@example.test", message: "PRIVATE_MESSAGE" }], subscribers: [],
};
const db = { collection: () => ({ findOne: async () => null, updateOne: async () => ({ acknowledged: true }) }) };
mock.module("../api/db.js", { namedExports: { ...actualDb,
  getMongoDb: async () => connected ? db : null,
  getFullState: async () => ({ state, source: connected ? "mongodb-atlas" : "memory-fallback" }),
  commitDurableMongoWrite: async () => { businessWrites++; },
  saveCloudMirrorState: async () => {},
} });
const { default: handler } = await import("../api/index.js");
async function request(method, path, token, body, extraHeaders = {}) {
  const req = { method, url: "/api/v1" + path, body, headers: { ...(token ? { "x-admin-token": token } : {}), ...extraHeaders }, on() {} };
  const res = { statusCode: 200, setHeader() {}, end(raw) { this.json = JSON.parse(raw); } };
  await handler(req, res);
  return res;
}
let token;
test("demo login, one-click issuance, public configuration and bounded lifetime", async () => {
  const wrong = await request("POST", "/admin/login", null, { email: security.getDemoAdminEmail(), password: "incorrect" });
  assert.equal(wrong.statusCode, 401);
  const manual = await request("POST", "/admin/login", null, { email: security.getDemoAdminEmail(), password: demoPassword });
  assert.equal(manual.statusCode, 200);
  assert.equal(manual.json.user.isDemo, true);
  const click = await request("POST", "/admin/demo-login", null, { role: "OWNER", uid: security.MASTER_ADMIN_UID, demo: false });
  token = click.json.adminToken;
  const payload = security.verifyAdminSessionToken(token);
  assert.equal(payload.demo, true);
  assert.equal(payload.uid, security.DEMO_ADMIN_UID);
  assert.ok(payload.exp - payload.iat <= security.DEMO_ADMIN_TOKEN_TTL_MS);
  const config = await request("GET", "/admin/demo-config");
  assert.equal(config.json.password, demoPassword);
  assert.equal(JSON.stringify(config.json).includes(process.env.ADMIN_PASSWORD_HASH), false);
});
test("all mutation methods and endpoint aliases are denied before any business writes", async () => {
  for (const method of ["POST", "PUT", "PATCH", "DELETE", "TRACE", "post"]) {
    for (const path of ["/store-config", "/products", "/inventory", "/orders", "/orders/status", "/payments/refund", "/payments/stripe/webhook", "/users/role", "/users", "/admin/password", "/cloudinary-sign", "/messages", "/subscribers", "/addresses", "/unknown", "/store-config/", "/store-config?_method=GET"]) {
      const res = await request(method, path, token, { role: "ADMIN", demo: false });
      assert.equal(res.statusCode, 403, `${method} ${path}`);
      assert.equal(res.json.code, "DEMO_READ_ONLY");
    }
  }
  const bearer = await request("PATCH", "/users/role", "invalid", {}, { authorization: `Bearer ${token}` });
  assert.equal(bearer.statusCode, 403);
  for (const path of ["/addresses?userUid=c1", "/reviews", "/health", "/store-data?__seo=product", "/store-data?_method=POST"]) {
    assert.equal((await request("GET", path, token)).statusCode, 403);
  }
  assert.equal((await request("GET", "/store-data", token, null, { "x-http-method-override": "POST" })).statusCode, 403);
  assert.equal(businessWrites, 0);
});
test("demo reads live values through projections and cannot read owner security", async () => {
  const res = await request("GET", "/store-data", token);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.orders[0].total, 137);
  assert.equal(res.json.storeConfig.customProducts[0].stock, 7);
  assert.equal(res.json.payments[0].amount, 137);
  assert.doesNotMatch(JSON.stringify(res.json), /PRIVATE_|private@example.test|01712345678/);
  const session = await request("GET", "/admin/session", token);
  assert.deepEqual(session.json.securityStatus, { demoReadOnly: true });
  connected = false;
  assert.equal((await request("GET", "/store-data", token)).statusCode, 503);
  assert.equal((await request("POST", "/admin/demo-login")).statusCode, 503);
  connected = true;
});
test("owner retains unmasked reads and business writes", async () => {
  const login = await request("POST", "/admin/login", null, { email: security.MASTER_ADMIN_EMAIL, password: ownerPassword });
  assert.equal(login.statusCode, 200);
  assert.equal(Boolean(login.json.user.isDemo), false);
  const ownerToken = login.json.adminToken;
  const res = await request("GET", "/store-data", ownerToken);
  assert.equal(res.json.orders[0].email, "private@example.test");
  assert.equal((await request("POST", "/store-config", ownerToken, { coupons: [] })).statusCode, 200);
  assert.equal(businessWrites, 1);
});
test("tampering, expired tokens, logout and demo disable cannot escalate", async () => {
  const [encoded, sig] = token.split(".");
  const payload = JSON.parse(Buffer.from(encoded, "base64url"));
  payload.demo = false; payload.uid = security.MASTER_ADMIN_UID;
  const forged = Buffer.from(JSON.stringify(payload)).toString("base64url") + "." + sig;
  assert.equal(security.verifyAdminSessionToken(forged), null);
  assert.equal((await request("POST", "/store-config", forged, {})).statusCode, 403);
  assert.equal(security.verifyAdminSessionToken(security.createAdminSessionToken({ demo: true, ttlMs: -1000 })), null);
  assert.equal((await request("POST", "/admin/logout", token)).statusCode, 200);
  assert.equal(security.verifyAdminSessionToken(token), null);
  process.env.DEMO_ADMIN_ENABLED = "false";
  assert.equal((await request("POST", "/admin/demo-login")).statusCode, 403);
  assert.equal(security.verifyDemoAdminCredentials(security.getDemoAdminEmail(), demoPassword), false);
  assert.deepEqual((await request("GET", "/admin/demo-config")).json, { enabled: false });
});
