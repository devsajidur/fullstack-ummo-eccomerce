import test from "node:test";
import assert from "node:assert/strict";
import { MongoClient } from "mongodb";
import {
  closeMongoConnection,
  createInitialMemoryState,
  DB_NAME,
  getMongoDb,
  getMongoUris,
} from "../api/db.js";
import {
  ADMIN_ACCESS_KEY,
  asSafeEmail,
  asSafeId,
  canAccessUser,
  containsNoSqlOperator,
  createAdminSessionToken,
  evictLocalSecurityCacheForTest,
  isSandboxPaymentSimulationEnabled,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_UID,
  parseJsonBody,
  resetAdminRateLimitsForTest,
  resolveCaller,
  revokeAdminSessionToken,
  sanitizeInput,
  verifyAdminPasswordCredentials,
  verifyAdminSessionToken,
} from "../api/security.js";
import {
  deductOrderInventory,
  restockOrderInventory,
  sanitizeProductMessage,
  validateAndBuildServerOrder,
} from "../api/orderService.js";
import {
  createStripeTestCheckoutSession,
  generateStripeWebhookSignature,
  initiateSslCommerzSandboxPayment,
  processStripeWebhookEvent,
  reconcilePaymentByAdmin,
  refundPaymentByAdmin,
  verifyAndProcessSslCommerzNotification,
} from "../api/paymentService.js";
import {
  PRODUCT_IMAGE_PLACEHOLDER,
  resolveProductImage,
} from "../src/utils/productImage.js";
import { getProductDiscountState } from "../src/utils/discountTimer.js";
import {
  classifyProductTaxonomy,
  getAllDepartments,
  matchesDepartmentFilter,
  summarizeCatalogTaxonomy,
} from "../src/utils/categoryTaxonomy.js";
import { INITIAL_CATALOG_SEED } from "../src/services/catalogSeed.js";
import { TRANSLATIONS } from "../src/i18n/translations.js";
import handler from "../api/index.js";

function createMockReqRes({
  method = "GET",
  url = "/api/v1/health",
  headers = {},
  body = undefined,
} = {}) {
  const req = {
    method,
    url,
    headers,
    body,
    on() {},
  };
  const responseHeaders = {};
  const res = {
    statusCode: 200,
    setHeader(k, v) {
      responseHeaders[k.toLowerCase()] = v;
    },
    end(payload) {
      this.rawBody = payload;
      try {
        this.json = JSON.parse(payload);
      } catch {
        this.json = null;
      }
    },
    headers: responseHeaders,
  };
  return { req, res };
}

// ============================================================================
// 1. LIVE MONGODB ATLAS CONNECTION CERTIFICATION (READ-ONLY)
// ============================================================================
test("Phase 2: Live MongoDB Atlas authenticated connection, ping, read-only query, and connection pooling", async () => {
  const db1 = await getMongoDb({ forceRetry: true, timeoutMs: 8000 });
  assert.ok(db1, "Expected live authenticated MongoDB Atlas connection to succeed");
  assert.equal(db1.databaseName, DB_NAME, "Target database must be ummo_ecommerce");

  const pingResult = await db1.command({ ping: 1 });
  assert.equal(pingResult.ok, 1, "Database ping must return { ok: 1 }");

  // Verify connection pooling reuse (returns identical cached Db instance)
  const db2 = await getMongoDb();
  assert.strictEqual(db1, db2, "Expected getMongoDb() to reuse cached pooled connection");

  // Read-only collection & count verification (zero writes)
  const collections = await db1.listCollections().toArray();
  assert.ok(Array.isArray(collections), "listCollections must return an array");

  const readOnlyCount = await db1.collection("orders").countDocuments();
  assert.ok(
    Number.isInteger(readOnlyCount) && readOnlyCount >= 0,
    "Read-only countDocuments must return non-negative integer"
  );
});

test("Phase 2.3: Database failure handling with unreachable/invalid host does not crash", async () => {
  const badClient = new MongoClient(
    "mongodb://invalid_user:invalid_pass@127.0.0.1:27099/ummo_ecommerce?serverSelectionTimeoutMS=300&connectTimeoutMS=300"
  );
  await assert.rejects(
    async () => {
      await badClient.connect();
    },
    (err) => {
      assert.ok(err instanceof Error);
      return true;
    }
  );
  await badClient.close().catch(() => {});
});

// ============================================================================
// 2. NOSQL INJECTION, PROTOTYPE POLLUTION & INPUT VALIDATION TESTS
// ============================================================================
test("Phase 3.3: NoSQL operators ($ne, $gt, $where) and prototype pollution keys are stripped and detected", () => {
  const malicious = JSON.parse(
    '{"uid":{"$ne":null},"role":"ADMIN","__proto__":{"isAdmin":true},"nested":{"$gt":0,"safe":"ok"}}'
  );
  assert.equal(containsNoSqlOperator(malicious), true);

  const sanitized = sanitizeInput(malicious);
  assert.equal(Object.prototype.hasOwnProperty.call(sanitized, "__proto__"), false);
  assert.deepEqual(sanitized.uid, {});
  assert.equal(sanitized.nested.safe, "ok");
  assert.equal(sanitized.nested.$gt, undefined);

  assert.equal(asSafeId({ $ne: "admin" }), "");
  assert.equal(asSafeId("$where"), "");
  assert.equal(asSafeId("user-123"), "user-123");
  assert.equal(asSafeEmail("Customer@Example.com "), "customer@example.com");
  assert.equal(asSafeEmail("not-an-email"), "");
});

test("Phase 3.4: Request body validation rejects malformed JSON and oversized (>512KB) payloads", async () => {
  await assert.rejects(
    () => parseJsonBody({ body: "{malformed_json" }),
    (err) => err.statusCode === 400
  );

  const hugeString = "x".repeat(520 * 1024);
  await assert.rejects(
    () => parseJsonBody({ body: JSON.stringify({ data: hugeString }) }),
    (err) => err.statusCode === 413
  );
});

// ============================================================================
// 3. AUTHENTICATION, AUTHORIZATION & PRIVILEGE ESCALATION TESTS
// ============================================================================
test("Phase 3.2 & 3.5: Unauthenticated and regular Customer callers cannot access Admin endpoints", async () => {
  // 1. Customer attempting to modify store-config
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/store-config",
      headers: { "x-user-uid": "cust-101" },
      body: { deletedIds: ["1"] },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 403);
  }

  // 2. Customer attempting to promote role via /users/role
  {
    const { req, res } = createMockReqRes({
      method: "PATCH",
      url: "/api/v1/users/role",
      headers: { "x-user-uid": "cust-101" },
      body: { uid: "cust-101", role: "ADMIN" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 403);
  }

  // 3. Customer attempting to delete contact messages or newsletter subscribers
  {
    const { req, res } = createMockReqRes({
      method: "DELETE",
      url: "/api/v1/messages?id=MSG-1",
      headers: { "x-user-uid": "cust-101" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 403);
  }
  {
    const { req, res } = createMockReqRes({
      method: "DELETE",
      url: "/api/v1/subscribers?id=SUB-1",
      headers: { "x-user-uid": "cust-101" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 403);
  }
});

test("Phase 3.2: Horizontal Privilege Escalation (IDOR) blocked on addresses and orders", async () => {
  const mockState = createInitialMemoryState();
  mockState.orders = [
    { orderId: "ORD-B-1", id: "ORD-B-1", userUid: "customer-B", status: "PENDING" },
  ];
  const callerA = resolveCaller(
    { headers: { "x-user-uid": "customer-A", "x-user-email": "a@example.com" } },
    mockState
  );

  assert.equal(callerA.isAdmin, false);
  assert.equal(canAccessUser(callerA, "customer-A"), true);
  assert.equal(canAccessUser(callerA, "customer-B"), false);

  // Customer A cannot fetch Customer B's addresses via API
  const { req, res } = createMockReqRes({
    method: "GET",
    url: "/api/v1/addresses?userUid=customer-B",
    headers: { "x-user-uid": "customer-A" },
  });
  await handler(req, res);
  assert.equal(res.statusCode, 403);
});

test("Phase 3.6: File upload signature endpoint enforces Admin auth, MIME whitelist (blocks SVG), and 5MB size limit", async () => {
  // 1. Non-admin rejected
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/cloudinary-sign",
      headers: { "x-user-uid": "customer-A" },
      body: { folder: "ummo_products", mimeType: "image/webp", fileSize: 10240 },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 403);
  }

  const adminHeaders = {
    "x-user-uid": MASTER_ADMIN_UID,
    "x-user-email": MASTER_ADMIN_EMAIL,
    "x-admin-key": ADMIN_ACCESS_KEY,
  };

  // 2. Admin blocked from uploading SVG (XSS risk)
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/cloudinary-sign",
      headers: adminHeaders,
      body: { folder: "ummo_products", mimeType: "image/svg+xml", fileSize: 2048 },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  }

  // 3. Admin blocked from uploading >5MB file
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/cloudinary-sign",
      headers: adminHeaders,
      body: {
        folder: "ummo_products",
        mimeType: "image/webp",
        fileSize: 8 * 1024 * 1024,
      },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  }

  // 4. Admin blocked from path-traversal folder
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/cloudinary-sign",
      headers: adminHeaders,
      body: { folder: "../arbitrary", mimeType: "image/webp", fileSize: 2048 },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  }

  // 5. Valid Admin image upload request succeeds with SHA-1 signature (and never leaks secret)
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/cloudinary-sign",
      headers: adminHeaders,
      body: { folder: "ummo_products", mimeType: "image/webp", fileSize: 102400 },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.status, "ok");
    assert.match(res.json.signature, /^[a-f0-9]{40}$/);
    assert.equal(res.rawBody.includes("s6TJSmCr"), false);
  }
});

// ============================================================================
// 4. ECOMMERCE BUSINESS LOGIC SECURITY TESTS (PRICE, STOCK, COUPON, PAYMENT)
// ============================================================================
test("Phase 4: Server-side order engine prevents price tampering, negative quantities, stock overselling, and payment status spoofing", () => {
  const state = createInitialMemoryState();
  state.storeConfig.deletedIds = ["999"];
  state.storeConfig.customProducts = [
    {
      id: "10",
      title: "Luxury Silk Gown",
      price: 100,
      discountPercentage: 10,
      discountEndTime: new Date(Date.now() + 3600 * 1000).toISOString(), // Active 10% -> $90
      stock: 5,
      freeGift: {
        enabled: true,
        minBuyQty: 2,
        giftName: "Executive Pen",
        giftQty: 1,
      },
    },
    {
      id: "11",
      title: "Expired Flash Jacket",
      price: 80,
      discountPercentage: 50,
      discountEndTime: new Date(Date.now() - 3600 * 1000).toISOString(), // Expired -> must charge $80
      stock: 3,
    },
  ];

  const caller = { uid: "cust-500", email: "buyer@example.com", isAdmin: false };

  // 1. Empty cart rejected
  assert.throws(
    () => validateAndBuildServerOrder({ OrderItems: [] }, state, caller),
    (err) => err.statusCode === 400 && /empty/i.test(err.message)
  );

  // 2. Negative quantity rejected
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        { OrderItems: [{ id: "10", quantity: -1, price: 90 }] },
        state,
        caller
      ),
    (err) => err.statusCode === 400 && /quantity/i.test(err.message)
  );

  // 3. Deleted product rejected
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        { OrderItems: [{ id: "999", quantity: 1, price: 50 }] },
        state,
        caller
      ),
    (err) => err.statusCode === 400 && /no longer available/i.test(err.message)
  );

  // 4. Out-of-stock / excessive quantity rejected
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        { OrderItems: [{ id: "10", quantity: 6, price: 90 }] },
        state,
        caller
      ),
    (err) => err.statusCode === 400 && /Insufficient stock/i.test(err.message)
  );

  // 5. Client price tampering rejected ($1 submitted for $90 item)
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        { OrderItems: [{ id: "10", quantity: 1, price: 1.0 }] },
        state,
        caller
      ),
    (err) => err.statusCode === 400 && /Price tampering/i.test(err.message)
  );

  // 6. Invalid coupon rejected
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        {
          OrderItems: [{ id: "10", quantity: 1, price: 90 }],
          couponCode: "HACK99",
        },
        state,
        caller
      ),
    (err) => err.statusCode === 400 && /coupon/i.test(err.message)
  );

  // 7. Authoritative calculation ignores tampered client total/shipping/status & honors expired timer
  const validOrder = validateAndBuildServerOrder(
    {
      OrderItems: [
        { id: "10", quantity: 2, price: 90 }, // 2 * $90 = $180 (also unlocks 1x Executive Pen free gift!)
        { id: "11", quantity: 1, price: 80 }, // Expired timer -> full $80
      ],
      couponCode: "UMMO20", // -$20 fixed
      shippingMethod: "express",
      // Client attempts to spoof total=$1 and status="PAID":
      total: 1.0,
      subtotal: 1.0,
      status: "PAID",
      paymentStatus: "PAID",
    },
    state,
    caller,
    "idem-key-123"
  );

  // Subtotal = 180 + 80 = 260
  // Tiered VIP discount (10% above $200) = 26
  // Coupon UMMO20 = 20
  // Free shipping unlocked (260 >= 150) = 0
  // VAT = 19
  // Authoritative Total = 260 - 26 - 20 + 0 + 19 = 233
  assert.equal(validOrder.subtotal, 260);
  assert.equal(validOrder.tieredDiscount, 26);
  assert.equal(validOrder.discount, 20);
  assert.equal(validOrder.shipping, 0);
  assert.equal(validOrder.vat, 19);
  assert.equal(validOrder.total, 233);
  assert.equal(validOrder.status, "PENDING");
  assert.equal(validOrder.paymentStatus, "PENDING_VERIFICATION");
  assert.equal(validOrder.freeGifts.length, 1);
  assert.equal(validOrder.freeGifts[0].giftName, "Executive Pen");

  // Verify inventory deduction
  deductOrderInventory(state, validOrder.OrderItems);
  const updatedProd10 = state.storeConfig.customProducts.find((p) => p.id === "10");
  assert.equal(updatedProd10.stock, 3);
});

test("Phase 6: Unsupported HTTP methods return 405 and Security Headers are present", async () => {
  const { req, res } = createMockReqRes({
    method: "DELETE",
    url: "/api/v1/health",
    headers: { origin: "https://fullstack-ummo-eccomerce.vercel.app" },
  });
  await handler(req, res);
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers["x-content-type-options"], "nosniff");
  assert.equal(res.headers["x-frame-options"], "DENY");
  assert.equal(res.headers["referrer-policy"], "strict-origin-when-cross-origin");
  assert.match(res.headers["cache-control"], /no-store/);
});

test("Phase 6: API input validation rejects invalid ratings, invalid emails, and NoSQL operator payloads on endpoints", async () => {
  // Invalid rating (>5) on /reviews
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/reviews",
      body: {
        productId: "1",
        review: { reviewerName: "Test", rating: 99, comment: "Bad rating" },
      },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  }

  // Invalid email on /subscribers
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/subscribers",
      body: { email: "invalid-email-format" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  }

  // NoSQL operator payload on /users rejected with 400
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/users",
      body: { uid: { $ne: null }, role: "ADMIN" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  }
});

// ============================================================================
// 5. END-TO-END ADMIN DASHBOARD & CUSTOMER DASHBOARD LIVE FEATURE SUITE
// ============================================================================
test("Phase 7: End-to-End Admin Dashboard (Products, Banners, Coupons, Cart Rules, Orders, Roles, Inbox) & Customer Dashboard (Profile, Addresses, Order Cancel) persist in MongoDB Atlas", async () => {
  const db = await getMongoDb();
  assert.ok(db, "MongoDB connection must be active");

  // Snapshot existing store_config so we restore production state cleanly in finally
  const originalConfig = await db.collection("store_config").findOne({ _id: "global" });

  // Simulate an Admin who signed in with Google/Email and unlocked Admin Panel (1-Click Demo Admin)
  const googleAdminHeaders = {
    "x-user-uid": "qa-google-admin-uid",
    "x-user-email": "qa-admin-user@gmail.com",
    "x-admin-key": ADMIN_ACCESS_KEY,
  };

  const testCustomerUid = "qa-test-customer-999";
  const customerHeaders = {
    "x-user-uid": testCustomerUid,
    "x-user-email": "qa-customer@example.com",
  };
  const testOrderId = "ORD-QA-E2E-999";
  const testMsgId = "MSG-QA-E2E-999";
  const testSubId = "SUB-QA-E2E-999";
  const testSubEmail = "qa-newsletter-e2e@example.com";

  try {
    // 1. Admin Dashboard: Add/Edit Custom Product + Free Gift + Timer + Banners + Coupons + Cart Rules
    {
      const customProduct = {
        id: "999001",
        title: "QA Luxury Chronograph",
        category: "mens-watches",
        brand: "UOMO",
        price: 150,
        discountPercentage: 20,
        discountEndTime: new Date(Date.now() + 86400000).toISOString(),
        freeGift: {
          enabled: true,
          minBuyQty: 1,
          giftName: "Leather Strap",
          giftQty: 1,
        },
        stock: 15,
        isCustomNew: true,
      };
      const testCoupons = [
        ...(originalConfig?.coupons || []),
        { code: "QATEST50", type: "fixed", value: 50, minOrder: 100, active: true },
      ];
      const testCartRules = {
        freeShippingEnabled: true,
        freeShippingThreshold: 75,
        tieredDiscountEnabled: true,
        tieredMinSpend: 150,
        tieredDiscountPercent: 12,
        giftWrapFee: 5,
      };

      const { req, res } = createMockReqRes({
        method: "POST",
        url: "/api/v1/store-config",
        headers: googleAdminHeaders,
        body: {
          customProducts: [customProduct, ...(originalConfig?.customProducts || [])],
          coupons: testCoupons,
          cartRules: testCartRules,
        },
      });
      await handler(req, res);
      assert.equal(res.statusCode, 200, "Google-authenticated Admin with X-Admin-Key must save store-config");
      assert.equal(res.json.storeConfig.cartRules.freeShippingThreshold, 75);
      assert.ok(
        res.json.storeConfig.coupons.some((c) => c.code === "QATEST50"),
        "New coupon QATEST50 must be saved"
      );
    }

    // 2. Customer Dashboard: Save Profile (/users) & Address Book (/addresses)
    {
      const { req, res } = createMockReqRes({
        method: "POST",
        url: "/api/v1/users",
        headers: customerHeaders,
        body: {
          uid: testCustomerUid,
          email: "qa-customer@example.com",
          username: "QA Verified Buyer",
          phone: "+15550199",
          bio: "QA Test Bio",
        },
      });
      await handler(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.json.user.username, "QA Verified Buyer");
      assert.equal(res.json.user.role, "CUSTOMER");
    }
    {
      const { req, res } = createMockReqRes({
        method: "POST",
        url: "/api/v1/addresses",
        headers: customerHeaders,
        body: {
          userUid: testCustomerUid,
          addresses: [
            {
              id: "addr-qa-1",
              label: "Home",
              fullName: "QA Verified Buyer",
              street: "742 Evergreen Terrace",
              city: "Springfield",
              country: "United States",
              isDefault: true,
            },
          ],
        },
      });
      await handler(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.json.addresses.length, 1);
    }

    // 3. Admin Dashboard: Toggle Customer Role (CUSTOMER -> ADMIN -> CUSTOMER)
    {
      const { req, res } = createMockReqRes({
        method: "PATCH",
        url: "/api/v1/users/role",
        headers: googleAdminHeaders,
        body: {
          uid: testCustomerUid,
          role: "ADMIN",
          email: "qa-customer@example.com",
          username: "QA Verified Buyer",
        },
      });
      await handler(req, res);
      assert.equal(res.statusCode, 200);
      assert.equal(res.json.role, "ADMIN");

      // Revert back to CUSTOMER
      const revert = createMockReqRes({
        method: "PATCH",
        url: "/api/v1/users/role",
        headers: googleAdminHeaders,
        body: { uid: testCustomerUid, role: "CUSTOMER" },
      });
      await handler(revert.req, revert.res);
      assert.equal(revert.res.statusCode, 200);
      assert.equal(revert.res.json.role, "CUSTOMER");
    }

    // 4. Customer Checkout -> Admin Order Status Update -> Customer Order View
    {
      // Customer places order for the newly added custom product (price 150 with 20% active discount = $120)
      const { req, res } = createMockReqRes({
        method: "POST",
        url: "/api/v1/orders",
        headers: {
          ...customerHeaders,
          "idempotency-key": "qa-idem-999",
        },
        body: {
          orderId: testOrderId,
          userUid: testCustomerUid,
          email: "qa-customer@example.com",
          username: "QA Verified Buyer",
          OrderItems: [{ id: "999001", quantity: 1, price: 120 }],
          shippingMethod: "free",
        },
      });
      await handler(req, res);
      assert.equal(res.statusCode, 201);
      assert.equal(res.json.order.orderId, testOrderId);
      assert.equal(res.json.order.freeGifts[0].giftName, "Leather Strap");

      // Admin advances order status to PROCESSING
      const adminStatusUpdate = createMockReqRes({
        method: "PATCH",
        url: "/api/v1/orders/status",
        headers: googleAdminHeaders,
        body: { orderId: testOrderId, status: "PROCESSING" },
      });
      await handler(adminStatusUpdate.req, adminStatusUpdate.res);
      assert.equal(adminStatusUpdate.res.statusCode, 200);
      assert.equal(adminStatusUpdate.res.json.newStatus, "PROCESSING");
    }

    // 5. Contact Message & Newsletter Subscriber Submit + Admin Delete Verification
    {
      const msgSubmit = createMockReqRes({
        method: "POST",
        url: "/api/v1/messages",
        body: {
          id: testMsgId,
          name: "QA Sender",
          email: "qa-sender@example.com",
          message: "Testing contact inbox persistence and deletion.",
        },
      });
      await handler(msgSubmit.req, msgSubmit.res);
      assert.equal(msgSubmit.res.statusCode, 201);

      const msgDelete = createMockReqRes({
        method: "DELETE",
        url: `/api/v1/messages?id=${testMsgId}`,
        headers: googleAdminHeaders,
      });
      await handler(msgDelete.req, msgDelete.res);
      assert.equal(msgDelete.res.statusCode, 200);

      const subSubmit = createMockReqRes({
        method: "POST",
        url: "/api/v1/subscribers",
        body: { id: testSubId, email: testSubEmail },
      });
      await handler(subSubmit.req, subSubmit.res);
      assert.equal(subSubmit.res.statusCode, 201);
      assert.ok(subSubmit.res.json.subscriber.subscribedAt);

      const subDelete = createMockReqRes({
        method: "DELETE",
        url: `/api/v1/subscribers?id=${testSubId}`,
        headers: googleAdminHeaders,
      });
      await handler(subDelete.req, subDelete.res);
      assert.equal(subDelete.res.statusCode, 200);
    }
  } finally {
    // Restore original store_config and remove temporary QA test documents
    if (originalConfig) {
      const { _id, ...restConfig } = originalConfig;
      await db
        .collection("store_config")
        .replaceOne({ _id: "global" }, { _id: "global", ...restConfig }, { upsert: true })
        .catch(() => {});
    }
    await Promise.all([
      db.collection("orders").deleteOne({ orderId: testOrderId }).catch(() => {}),
      db.collection("users").deleteOne({ uid: testCustomerUid }).catch(() => {}),
      db.collection("addresses").deleteOne({ userUid: testCustomerUid }).catch(() => {}),
      db.collection("messages").deleteOne({ id: testMsgId }).catch(() => {}),
      db.collection("subscribers").deleteOne({ id: testSubId }).catch(() => {}),
    ]);
  }
});

test("Phase 5.4: Discount Timer Engine, Multi-Quantity Cart Addition & Per-Product Free Gift Calculation", async () => {
  const futureIso = new Date(Date.now() + 12 * 3600 * 1000).toISOString();
  const pastIso = new Date(Date.now() - 3600 * 1000).toISOString();

  // 1. Active countdown discount calculation
  const activeState = getProductDiscountState({
    price: 100,
    discountPercentage: 25,
    discountEndTime: futureIso,
  });
  assert.equal(activeState.originalPrice, 100);
  assert.equal(activeState.effectivePrice, 75);
  assert.equal(activeState.savingsAmount, 25);
  assert.equal(activeState.discountPercent, 25);
  assert.equal(activeState.isDiscountActive, true);
  assert.equal(activeState.hasActiveTimer, true);
  assert.equal(activeState.timerExpired, false);

  // 2. Expired countdown timer automatically reverts to original price
  const expiredState = getProductDiscountState({
    price: 100,
    discountPercentage: 25,
    discountEndTime: pastIso,
  });
  assert.equal(expiredState.originalPrice, 100);
  assert.equal(expiredState.effectivePrice, 100);
  assert.equal(expiredState.savingsAmount, 0);
  assert.equal(expiredState.discountPercent, 0);
  assert.equal(expiredState.isDiscountActive, false);
  assert.equal(expiredState.hasActiveTimer, false);
  assert.equal(expiredState.timerExpired, true);

  // 3. Multi-quantity order (qty=4) with 25% discount + per-product free gift (minBuyQty=2 -> 2x gift) + VIP + coupon
  const mockState = createInitialMemoryState();
  mockState.storeConfig.customProducts = [
    {
      id: "PROD-MULTI-QTY",
      title: "Premium Olive Oil 1L",
      price: 100,
      discountPercentage: 25,
      discountEndTime: futureIso,
      stock: 20,
      freeGift: {
        enabled: true,
        minBuyQty: 2,
        giftQty: 1,
        giftName: "Executive Pen",
      },
    },
  ];

  const order = validateAndBuildServerOrder(
    {
      userUid: "cust-multi",
      email: "multi@ummo.test",
      couponCode: "WELCOME10",
      shippingMethod: "flat",
      OrderItems: [
        {
          id: "PROD-MULTI-QTY",
          title: "Premium Olive Oil 1L",
          price: 75,
          quantity: 4,
          size: "L",
          color: "Olive",
        },
      ],
    },
    mockState,
    { uid: "cust-multi", email: "multi@ummo.test", isAdmin: false }
  );

  // 4 * $75 = $300 subtotal
  assert.equal(order.subtotal, 300);
  assert.equal(order.OrderItems[0].quantity, 4);
  assert.equal(order.OrderItems[0].price, 75);
  assert.equal(order.OrderItems[0].size, "L");
  assert.equal(order.OrderItems[0].color, "Olive");
  // Free gift unlocked: floor(4 / 2) * 1 = 2
  assert.equal(order.freeGifts.length, 1);
  assert.equal(order.freeGifts[0].earnedGiftQty, 2);
  assert.equal(order.freeGifts[0].totalFreeGiftQty, 2);
  // VIP 10% off $300 = $30, Coupon WELCOME10 10% off ($300 - $30) = $27
  assert.equal(order.tieredDiscount, 30);
  assert.equal(order.discount, 27);
  assert.equal(order.freeShippingUnlocked, true);
  assert.equal(order.shipping, 0);
});

test("Phase 8: Coupon Anti-Abuse Engine blocks repeated single-user redemptions (by UID, Email, or Phone), enforces global limits, expiry dates, paused state, and max discount cap", async () => {
  const mockState = createInitialMemoryState();
  const futureIso = new Date(Date.now() + 24 * 3600 * 1000).toISOString();
  const pastIso = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

  mockState.storeConfig.customProducts = [
    {
      id: "PROD-COUPON-1",
      title: "Cashmere Coat",
      price: 120,
      discountPercentage: 0,
      stock: 50,
    },
  ];
  mockState.storeConfig.coupons = [
    {
      code: "ONCEONLY20",
      type: "fixed",
      value: 20,
      minOrder: 50,
      maxUsesPerUser: 1,
      active: true,
    },
    {
      code: "GLOBALCAP2",
      type: "fixed",
      value: 15,
      minOrder: 50,
      maxUsesPerUser: 1,
      maxTotalUses: 2,
      active: true,
    },
    {
      code: "EXPIREDCODE",
      type: "percentage",
      value: 20,
      minOrder: 30,
      expiresAt: pastIso,
      active: true,
    },
    {
      code: "PAUSEDCODE",
      type: "percentage",
      value: 20,
      minOrder: 30,
      active: false,
    },
    {
      code: "CAPPED50",
      type: "percentage",
      value: 50,
      minOrder: 50,
      maxDiscountAmount: 25,
      expiresAt: futureIso,
      active: true,
    },
  ];

  // 1. First order by Customer 1 with ONCEONLY20 succeeds
  const order1 = validateAndBuildServerOrder(
    {
      userUid: "cust-repeat-1",
      email: "repeat@ummo.test",
      billing: { phone: "+8801711223344" },
      couponCode: "ONCEONLY20",
      OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
    },
    mockState,
    { uid: "cust-repeat-1", email: "repeat@ummo.test", isAdmin: false }
  );
  assert.equal(order1.discount, 20);
  assert.equal(order1.couponCode, "ONCEONLY20");
  mockState.orders.push(order1);

  // 2. Second attempt by same userUid is blocked!
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        {
          userUid: "cust-repeat-1",
          email: "different@ummo.test",
          billing: { phone: "+8801999888777" },
          couponCode: "ONCEONLY20",
          OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
        },
        mockState,
        { uid: "cust-repeat-1", email: "different@ummo.test", isAdmin: false }
      ),
    (err) => err.statusCode === 400 && /already used coupon ONCEONLY20/i.test(err.message)
  );

  // 3. Second attempt with different UID but same Email is blocked!
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        {
          userUid: "cust-spoof-uid",
          email: "REPEAT@ummo.test",
          billing: { phone: "+8801999000111" },
          couponCode: "ONCEONLY20",
          OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
        },
        mockState,
        { uid: "cust-spoof-uid", email: "repeat@ummo.test", isAdmin: false }
      ),
    (err) => err.statusCode === 400 && /already used coupon ONCEONLY20/i.test(err.message)
  );

  // 4. Second attempt with different UID and different Email but same Phone is blocked!
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        {
          userUid: "cust-spoof-uid-2",
          email: "brandnew@ummo.test",
          billing: { phone: "880-1711-223344" },
          couponCode: "ONCEONLY20",
          OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
        },
        mockState,
        { uid: "cust-spoof-uid-2", email: "brandnew@ummo.test", isAdmin: false }
      ),
    (err) => err.statusCode === 400 && /already used coupon ONCEONLY20/i.test(err.message)
  );

  // 5. If the previous order is CANCELLED, the customer can redeem ONCEONLY20 again!
  order1.status = "CANCELLED";
  const orderAfterCancel = validateAndBuildServerOrder(
    {
      userUid: "cust-repeat-1",
      email: "repeat@ummo.test",
      billing: { phone: "+8801711223344" },
      couponCode: "ONCEONLY20",
      OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
    },
    mockState,
    { uid: "cust-repeat-1", email: "repeat@ummo.test", isAdmin: false }
  );
  assert.equal(orderAfterCancel.discount, 20);

  // 6. Global usage limit (maxTotalUses: 2) blocks the 3rd customer across the store
  const g1 = validateAndBuildServerOrder(
    {
      userUid: "u-global-1",
      email: "g1@ummo.test",
      couponCode: "GLOBALCAP2",
      OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
    },
    mockState,
    { uid: "u-global-1", email: "g1@ummo.test", isAdmin: false }
  );
  mockState.orders.push(g1);

  const g2 = validateAndBuildServerOrder(
    {
      userUid: "u-global-2",
      email: "g2@ummo.test",
      couponCode: "GLOBALCAP2",
      OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
    },
    mockState,
    { uid: "u-global-2", email: "g2@ummo.test", isAdmin: false }
  );
  mockState.orders.push(g2);

  assert.throws(
    () =>
      validateAndBuildServerOrder(
        {
          userUid: "u-global-3",
          email: "g3@ummo.test",
          couponCode: "GLOBALCAP2",
          OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
        },
        mockState,
        { uid: "u-global-3", email: "g3@ummo.test", isAdmin: false }
      ),
    (err) => err.statusCode === 400 && /maximum redemption limit/i.test(err.message)
  );

  // 7. Expired coupon & Paused coupon are rejected
  assert.throws(
    () =>
      validateAndBuildServerOrder(
        {
          userUid: "u-exp",
          email: "exp@ummo.test",
          couponCode: "EXPIREDCODE",
          OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
        },
        mockState,
        { uid: "u-exp", email: "exp@ummo.test", isAdmin: false }
      ),
    (err) => err.statusCode === 400 && /expired/i.test(err.message)
  );

  assert.throws(
    () =>
      validateAndBuildServerOrder(
        {
          userUid: "u-pause",
          email: "pause@ummo.test",
          couponCode: "PAUSEDCODE",
          OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
        },
        mockState,
        { uid: "u-pause", email: "pause@ummo.test", isAdmin: false }
      ),
    (err) => err.statusCode === 400 && /inactive/i.test(err.message)
  );

  // 8. Max discount cap ($25 cap on 50% off $120 item -> $25 instead of $60)
  const cappedOrder = validateAndBuildServerOrder(
    {
      userUid: "u-cap",
      email: "cap@ummo.test",
      couponCode: "CAPPED50",
      OrderItems: [{ id: "PROD-COUPON-1", quantity: 1, price: 120 }],
    },
    mockState,
    { uid: "u-cap", email: "cap@ummo.test", isAdmin: false }
  );
  assert.equal(cappedOrder.discount, 25);

  // 9. Verify POST /api/v1/coupons/validate endpoint
  const { req, res } = createMockReqRes({
    method: "POST",
    url: "/api/v1/coupons/validate",
    headers: { "x-user-uid": "u-validate-test", "x-user-email": "val@ummo.test" },
    body: {
      couponCode: "WELCOME10",
      subtotal: 100,
      eligibleAmount: 100,
    },
  });
  await handler(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.json.valid, true);
  assert.equal(res.json.couponDiscount, 10);
});

test("Phase 9: Shared Product Image Resolver & Order Item Image Snapshots resolve missing images, Cloudinary transforms, and fallbacks", () => {
  // 1. Direct string or object with image
  const direct = resolveProductImage({
    image: "https://res.cloudinary.com/wxjt7d8q/image/upload/v1/ummo_products/product_5.webp",
  });
  assert.match(direct, /res\.cloudinary\.com\/wxjt7d8q/);
  assert.match(direct, /f_auto,q_auto/);

  // 2. Missing image resolved from images[0] array
  const fromArray = resolveProductImage({
    images: [{ url: "https://example.com/item-photo.jpg" }],
  });
  assert.equal(fromArray, "https://example.com/item-photo.jpg");

  // 3. Missing image resolved via numeric catalog productId (1..194)
  const fromCatalogId = resolveProductImage({ productId: "12", title: "Perfume" });
  assert.match(fromCatalogId, /ummo_products\/product_12/);

  // 4. Empty / invalid object falls back cleanly to SVG data URI placeholder
  const fallback = resolveProductImage({ id: "custom-unknown-9999", image: "undefined" });
  assert.equal(fallback, PRODUCT_IMAGE_PLACEHOLDER);

  // 5. Server order creation snapshots productImageSnapshot, productNameSnapshot, variantId
  const state = createInitialMemoryState();
  const order = validateAndBuildServerOrder(
    {
      userUid: "u-img-snap",
      email: "snap@ummo.test",
      OrderItems: [
        {
          id: "7",
          title: "Chanel Coco Noir",
          price: 129.99,
          quantity: 1,
          size: "L",
          color: "Navy",
        },
      ],
    },
    state,
    { uid: "u-img-snap", email: "snap@ummo.test", isAdmin: false }
  );
  assert.equal(order.OrderItems[0].productId, "7");
  assert.equal(order.OrderItems[0].variantId, "7-L-Navy");
  assert.match(order.OrderItems[0].productImageSnapshot, /ummo_products\/product_7/);
  assert.ok(order.OrderItems[0].productNameSnapshot.length > 0);
});

test("Phase 10: Product-Specific Optional Customer Messages support Unicode/Bengali, enforce 500-char limit, strip XSS, and preserve separate lines for different messages", () => {
  const state = createInitialMemoryState();

  // 1. Empty message
  assert.equal(sanitizeProductMessage(""), "");
  assert.equal(sanitizeProductMessage(null), "");

  // 2. Bengali & Unicode message
  const bengali = "এটি জন্মদিনের উপহার হিসেবে সুন্দর করে প্যাক করবেন, ধন্যবাদ! 🎁";
  assert.equal(sanitizeProductMessage(bengali), bengali);

  // 3. Exact 500-char message succeeds
  const exact500 = "A".repeat(500);
  assert.equal(sanitizeProductMessage(exact500).length, 500);

  // 4. 501-char message throws 400 Bad Request
  assert.throws(
    () => sanitizeProductMessage("B".repeat(501)),
    (err) => err.statusCode === 400 && /exceeds maximum length of 500 characters/i.test(err.message)
  );

  // 5. Malicious script/HTML payload is stripped safely
  const xssAttempt = 'Please engrave <script>alert("xss")</script> <b>"Alex & Sam"</b> javascript:evil()';
  const cleaned = sanitizeProductMessage(xssAttempt);
  assert.ok(!cleaned.includes("<script"), "Must strip <script> tags");
  assert.ok(!cleaned.includes("<"), "Must strip angle brackets");
  assert.ok(!cleaned.includes("javascript:"), "Must strip javascript: URI");
  assert.match(cleaned, /Alex & Sam/);

  // 6. Two units of the SAME product with DIFFERENT messages remain distinct order lines
  const orderWithTwoNotes = validateAndBuildServerOrder(
    {
      userUid: "u-notes-1",
      email: "notes@ummo.test",
      OrderItems: [
        {
          id: "1",
          title: "Essence Mascara",
          price: 9.99,
          quantity: 1,
          size: "M",
          color: "Black",
          optionalMessage: "Wrap in red ribbon for Mom",
        },
        {
          id: "1",
          title: "Essence Mascara",
          price: 9.99,
          quantity: 1,
          size: "M",
          color: "Black",
          optionalMessage: "এটি বোনের জন্য নীল কাগজে প্যাক করবেন",
        },
      ],
    },
    state,
    { uid: "u-notes-1", email: "notes@ummo.test", isAdmin: false }
  );

  assert.equal(orderWithTwoNotes.OrderItems.length, 2);
  assert.equal(
    orderWithTwoNotes.OrderItems[0].optionalMessage,
    "Wrap in red ribbon for Mom"
  );
  assert.equal(
    orderWithTwoNotes.OrderItems[1].optionalMessage,
    "এটি বোনের জন্য নীল কাগজে প্যাক করবেন"
  );
});

test("Phase 11: SSLCommerz Sandbox Gateway Integration verifies server-side Validation API, prevents amount/currency tampering, and enforces IPN idempotency", async () => {
  const state = createInitialMemoryState();
  state.storeConfig.customProducts = [
    {
      id: "SSL-PROD-1",
      title: "Sandbox Silk Blazer",
      price: 100,
      discountPercentage: 0,
      stock: 10,
    },
  ];

  const order = validateAndBuildServerOrder(
    {
      userUid: "u-ssl-1",
      email: "ssl@ummo.test",
      paymentMethod: "sslcommerz",
      OrderItems: [{ id: "SSL-PROD-1", quantity: 2, price: 100 }],
    },
    state,
    { uid: "u-ssl-1", email: "ssl@ummo.test", isAdmin: false }
  );
  deductOrderInventory(state, order.OrderItems, order);
  state.orders.push(order);
  assert.equal(state.storeConfig.customProducts[0].stock, 8);

  // 1. Initiate SSLCommerz Sandbox Session
  const session = await initiateSslCommerzSandboxPayment({
    order,
    state,
    originUrl: "http://localhost:5173",
  });
  assert.equal(session.mode, "sandbox");
  assert.equal(session.gateway, "sslcommerz");
  assert.ok(session.tranId.startsWith("SSLCZ-"));
  assert.equal(order.paymentStatus, "INITIATED");

  // 2. Reject tampered amount in SSLCommerz IPN
  await assert.rejects(
    () =>
      verifyAndProcessSslCommerzNotification({
        payload: {
          tran_id: session.tranId,
          val_id: "VAL-TAMPER-1",
          status: "VALID",
          amount: "1.00", // Tampered! Expected order.totalAmount
          currency: "USD",
          value_a: order.orderId,
        },
        state,
      }),
    (err) => err.statusCode === 400 && /amount mismatch/i.test(err.message)
  );
  assert.notEqual(order.paymentStatus, "PAID");

  // 3. Valid SSLCommerz IPN transitions order to PAID + PROCESSING
  const validIpn = await verifyAndProcessSslCommerzNotification({
    payload: {
      tran_id: session.tranId,
      val_id: "VAL-SBX-OK-1",
      status: "VALID",
      amount: String(order.totalAmount),
      currency: "USD",
      value_a: order.orderId,
      risk_level: "0",
    },
    state,
  });
  assert.equal(validIpn.paymentStatus, "PAID");
  assert.equal(order.paymentStatus, "PAID");
  assert.equal(order.status, "PROCESSING");

  // 4. Duplicate SSLCommerz IPN is handled idempotently
  const dupIpn = await verifyAndProcessSslCommerzNotification({
    payload: {
      tran_id: session.tranId,
      val_id: "VAL-SBX-OK-1",
      status: "VALID",
      amount: String(order.totalAmount),
      currency: "USD",
      value_a: order.orderId,
    },
    state,
  });
  assert.equal(dupIpn.idempotentReplay, true);
  assert.equal(order.paymentStatus, "PAID");
});

test("Phase 12: Stripe Test Mode Checkout, HMAC-SHA256 Webhook Signature Verification, Replay Protection & Admin Reconciliation/Refunds", async () => {
  const state = createInitialMemoryState();
  state.storeConfig.customProducts = [
    {
      id: "STRIPE-PROD-1",
      title: "Stripe Test Trench Coat",
      price: 150,
      discountPercentage: 0,
      stock: 5,
    },
  ];

  const order = validateAndBuildServerOrder(
    {
      userUid: "u-stripe-1",
      email: "stripe@ummo.test",
      paymentMethod: "stripe",
      OrderItems: [{ id: "STRIPE-PROD-1", quantity: 1, price: 150 }],
    },
    state,
    { uid: "u-stripe-1", email: "stripe@ummo.test", isAdmin: false }
  );
  deductOrderInventory(state, order.OrderItems, order);
  state.orders.push(order);
  assert.equal(state.storeConfig.customProducts[0].stock, 4);

  // 1. Create Stripe Test Mode Checkout Session
  const session = await createStripeTestCheckoutSession({
    order,
    state,
    originUrl: "http://localhost:5173",
  });
  assert.equal(session.mode, "test");
  assert.ok(session.sessionId.startsWith("cs_test_"));
  assert.equal(order.paymentStatus, "INITIATED");

  const validEventPayload = JSON.stringify({
    id: "evt_test_webhook_001",
    type: "checkout.session.completed",
    data: {
      object: {
        id: session.sessionId,
        payment_intent: "pi_test_001",
        amount_total: Math.round(order.totalAmount * 100),
        currency: "usd",
        payment_status: "paid",
        metadata: {
          orderId: order.orderId,
          paymentId: session.paymentId,
        },
      },
    },
  });

  // 2. Reject forged/invalid Stripe-Signature header
  assert.throws(
    () =>
      processStripeWebhookEvent({
        rawPayload: validEventPayload,
        signatureHeader: "t=1700000000,v1=deadbeef0000",
        state,
      }),
    (err) => err.statusCode === 400
  );

  // 3. Reject replayed old timestamp (>5 minutes old)
  const expiredTs = Math.floor(Date.now() / 1000) - 900;
  const expiredSig = generateStripeWebhookSignature(
    validEventPayload,
    undefined,
    expiredTs
  );
  assert.throws(
    () =>
      processStripeWebhookEvent({
        rawPayload: validEventPayload,
        signatureHeader: expiredSig,
        state,
      }),
    (err) => err.statusCode === 400 && /timestamp outside tolerance/i.test(err.message)
  );

  // 4. Valid HMAC-SHA256 Stripe-Signature transitions order to PAID + PROCESSING
  const validSig = generateStripeWebhookSignature(validEventPayload);
  const processed = processStripeWebhookEvent({
    rawPayload: validEventPayload,
    signatureHeader: validSig,
    state,
  });
  assert.equal(processed.paymentStatus, "PAID");
  assert.equal(order.paymentStatus, "PAID");
  assert.equal(order.status, "PROCESSING");

  // 5. Duplicate Stripe webhook event is idempotent
  const duplicateProcessed = processStripeWebhookEvent({
    rawPayload: validEventPayload,
    signatureHeader: validSig,
    state,
  });
  assert.equal(duplicateProcessed.idempotentReplay, true);

  // 6. Out-of-order late failure event does NOT downgrade a PAID order
  const lateFailPayload = JSON.stringify({
    id: "evt_test_webhook_late_fail",
    type: "payment_intent.payment_failed",
    data: {
      object: {
        id: session.sessionId,
        metadata: { orderId: order.orderId, paymentId: session.paymentId },
      },
    },
  });
  const lateFailSig = generateStripeWebhookSignature(lateFailPayload);
  const lateResult = processStripeWebhookEvent({
    rawPayload: lateFailPayload,
    signatureHeader: lateFailSig,
    state,
  });
  assert.equal(lateResult.ignoredOutOfOrder, true);
  assert.equal(order.paymentStatus, "PAID");

  // 7. Non-admin cannot reconcile or refund payments (403 Forbidden)
  assert.throws(
    () =>
      refundPaymentByAdmin({
        orderId: order.orderId,
        refundAmount: 50,
        reason: "Unauthorized attempt",
        state,
        caller: { uid: "u-stripe-1", isAdmin: false },
      }),
    (err) => err.statusCode === 403
  );

  // 8. Admin Partial Refund -> PARTIALLY_REFUNDED
  const partialRefund = refundPaymentByAdmin({
    orderId: order.orderId,
    refundAmount: 50,
    reason: "Partial courtesy discount",
    state,
    caller: { uid: MASTER_ADMIN_UID, email: MASTER_ADMIN_EMAIL, isAdmin: true },
  });
  assert.equal(partialRefund.paymentStatus, "PARTIALLY_REFUNDED");
  assert.equal(order.refundedAmount, 50);
  assert.equal(state.storeConfig.customProducts[0].stock, 4); // Not restocked on partial refund

  // 9. Admin Full Remaining Refund -> REFUNDED + Automatic Inventory Restock
  const remainingAmount = Number((order.totalAmount - 50).toFixed(2));
  const fullRefund = refundPaymentByAdmin({
    orderId: order.orderId,
    refundAmount: remainingAmount,
    reason: "Full return",
    restockItems: true,
    state,
    caller: { uid: MASTER_ADMIN_UID, email: MASTER_ADMIN_EMAIL, isAdmin: true },
  });
  assert.equal(fullRefund.paymentStatus, "REFUNDED");
  assert.equal(order.status, "CANCELLED");
  assert.equal(order.inventoryRestocked, true);
  assert.equal(state.storeConfig.customProducts[0].stock, 5); // Restocked back to 5!
});

// ============================================================================
// 13. ENTERPRISE TRANSFORMATION GATES 2, 5, 6-8, 10, 11 & 13 CERTIFICATION
// ============================================================================
test("Gate 2: Server-Side Admin Authentication (/api/v1/admin/login & /api/v1/admin/session) & HMAC Session Token Verification", async () => {
  // 1. Missing credentials rejected with 400
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/admin/login",
      body: { email: "", password: "" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 400);
  }

  // 2. Non-admin authenticated customer session rejected with 403 on /admin/session
  {
    const { req, res } = createMockReqRes({
      method: "GET",
      url: "/api/v1/admin/session",
      headers: {
        "x-user-uid": "cust-non-admin-1",
        "x-user-email": "customer@example.com",
      },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 403);
    assert.equal(res.json.isAdmin, false);
  }

  // 3. Invalid admin password rejected with 401
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/admin/login",
      body: { email: MASTER_ADMIN_EMAIL, password: "wrong-password-attempt" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  }

  // 4. Valid administrator credentials return signed HMAC token (200 OK)
  const expectedPass =
    process.env.ADMIN_PASSWORD || "Admin@12345";
  const credCheck = verifyAdminPasswordCredentials(
    MASTER_ADMIN_EMAIL,
    expectedPass
  );
  assert.equal(credCheck, true);

  let issuedToken = "";
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/admin/login",
      body: { email: MASTER_ADMIN_EMAIL, password: expectedPass },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.status, "ok");
    assert.equal(res.json.user.role, "ADMIN");
    assert.ok(res.json.adminToken, "Expected signed adminToken in response");
    issuedToken = res.json.adminToken;
  }

  // 5. Verify issued token via /api/v1/admin/session
  {
    const { req, res } = createMockReqRes({
      method: "GET",
      url: "/api/v1/admin/session",
      headers: { "x-admin-token": issuedToken },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.isAdmin, true);
    assert.equal(res.json.user.role, "ADMIN");
  }

  // 6. Forged, expired, or revoked token rejected
  assert.equal(verifyAdminSessionToken(`${issuedToken}tampered`), null);
  const expiredToken = createAdminSessionToken({
    uid: MASTER_ADMIN_UID,
    email: MASTER_ADMIN_EMAIL,
    role: "ADMIN",
    ttlMs: -5000,
  });
  assert.equal(verifyAdminSessionToken(expiredToken), null);

  // 7. Server-side token revocation via /api/v1/admin/logout
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/admin/logout",
      headers: { "x-admin-token": issuedToken },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 200);
    assert.equal(res.json.revoked, true);
  }
  assert.equal(
    verifyAdminSessionToken(issuedToken),
    null,
    "Revoked token must immediately fail verification"
  );
  {
    const { req, res } = createMockReqRes({
      method: "GET",
      url: "/api/v1/admin/session",
      headers: { "x-admin-token": issuedToken },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  }

  // 8. Brute-force rate limiting locks out after 5 consecutive failed attempts (HTTP 429)
  resetAdminRateLimitsForTest();
  for (let i = 1; i <= 5; i++) {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/admin/login",
      headers: { "x-forwarded-for": "203.0.113.77" },
      body: { email: MASTER_ADMIN_EMAIL, password: `wrong-pass-${i}` },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 401);
  }
  {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/admin/login",
      headers: { "x-forwarded-for": "203.0.113.77" },
      body: { email: MASTER_ADMIN_EMAIL, password: "wrong-pass-6" },
    });
    await handler(req, res);
    assert.equal(res.statusCode, 429);
    assert.ok(Number(res.headers["retry-after"]) > 0);
  }
  resetAdminRateLimitsForTest();

  // 9. Sandbox payment simulation is disabled by default (fail-closed)
  assert.equal(isSandboxPaymentSimulationEnabled({}), false);
  assert.equal(
    isSandboxPaymentSimulationEnabled({ PAYMENT_MODE: "sandbox" }),
    false
  );
  assert.equal(
    isSandboxPaymentSimulationEnabled({ ALLOW_SANDBOX_CONFIRM: "true" }),
    false
  );
  assert.equal(
    isSandboxPaymentSimulationEnabled({
      PAYMENT_MODE: "sandbox",
      ALLOW_SANDBOX_CONFIRM: "true",
      NODE_ENV: "production",
    }),
    false
  );
  assert.equal(
    isSandboxPaymentSimulationEnabled({
      PAYMENT_MODE: "sandbox",
      ALLOW_SANDBOX_CONFIRM: "true",
      VERCEL_ENV: "production",
    }),
    false
  );
  assert.equal(
    isSandboxPaymentSimulationEnabled({
      PAYMENT_MODE: "sandbox",
      ALLOW_SANDBOX_CONFIRM: "true",
      NODE_ENV: "development",
    }),
    true
  );

  // Verify /api/v1/payments/sandbox-confirm returns 403 when env vars are missing/default
  const prevMode = process.env.PAYMENT_MODE;
  const prevAllow = process.env.ALLOW_SANDBOX_CONFIRM;
  delete process.env.PAYMENT_MODE;
  delete process.env.ALLOW_SANDBOX_CONFIRM;
  try {
    const { req, res } = createMockReqRes({
      method: "POST",
      url: "/api/v1/payments/sandbox-confirm",
      headers: { "x-user-uid": "cust-1" },
      body: { orderId: "ORD-1", gateway: "stripe", outcome: "PAID" },
    });
    await handler(req, res);
    assert.equal(
      res.statusCode,
      403,
      "Expected sandbox-confirm to be blocked (403) by default when env vars are missing"
    );
  } finally {
    if (prevMode !== undefined) process.env.PAYMENT_MODE = prevMode;
    if (prevAllow !== undefined)
      process.env.ALLOW_SANDBOX_CONFIRM = prevAllow;
  }
});

test("Gate 5 & Gate 11: Canonical Category Taxonomy & 194-Product Cloudinary Catalog Seed Verification", () => {
  assert.equal(
    INITIAL_CATALOG_SEED.length,
    194,
    "Expected complete 194-product catalog seed"
  );

  for (const prod of INITIAL_CATALOG_SEED) {
    assert.ok(prod.id, "Every seeded product must have an id");
    assert.ok(prod.title, "Every seeded product must have a title");
    assert.ok(Number(prod.price) > 0, "Every seeded product must have a positive price");
    const resolvedUrl = resolveProductImage(prod);
    assert.match(
      resolvedUrl,
      /^https:\/\/res\.cloudinary\.com\/wxjt7d8q\/image\/upload\//,
      `Product ${prod.id} image must resolve to Cloudinary wxjt7d8q CDN`
    );
  }

  const depts = getAllDepartments(false);
  assert.ok(depts.some((d) => d.slug === "men"));
  assert.ok(depts.some((d) => d.slug === "women"));
  assert.ok(depts.some((d) => d.slug === "kids"));

  const summary = summarizeCatalogTaxonomy(INITIAL_CATALOG_SEED);
  const bySlug = Object.fromEntries(
    summary.departments.map((d) => [d.slug, d])
  );
  assert.ok(bySlug.men.totalCount > 0, "Men's department must contain products");
  assert.ok(bySlug.women.totalCount > 0, "Women's department must contain products");
  assert.ok(bySlug.kids.totalCount > 0, "Kids' department must contain products");

  const menProduct = INITIAL_CATALOG_SEED.find((p) => p.category === "mens-shirts");
  const menTax = classifyProductTaxonomy(menProduct);
  assert.equal(menTax.department, "men");
  assert.equal(matchesDepartmentFilter(menProduct, "men"), true);
  assert.equal(matchesDepartmentFilter(menProduct, "women"), false);
});

test("Gates 6, 7, 8 & 10: Discount Engine Scheduled Start/End Windows & Bilingual (en / bn-BD) Dictionary Parity", () => {
  const now = Date.now();

  // Future scheduled discount -> not active yet
  const futureDiscountState = getProductDiscountState(
    {
      id: 901,
      price: 100,
      discountPercentage: 25,
      discountStartTime: new Date(now + 3600 * 1000).toISOString(),
      discountEndTime: new Date(now + 7200 * 1000).toISOString(),
    },
    now
  );
  assert.equal(futureDiscountState.isDiscountActive, false);
  assert.equal(futureDiscountState.isScheduledFuture, true);
  assert.equal(futureDiscountState.effectivePrice, 100);

  // Active scheduled discount -> active with timer
  const activeDiscountState = getProductDiscountState(
    {
      id: 902,
      price: 200,
      discountPercentage: 20,
      discountStartTime: new Date(now - 1800 * 1000).toISOString(),
      discountEndTime: new Date(now + 3600 * 1000).toISOString(),
    },
    now
  );
  assert.equal(activeDiscountState.isDiscountActive, true);
  assert.equal(activeDiscountState.hasActiveTimer, true);
  assert.equal(activeDiscountState.regularPrice, 200);
  assert.equal(activeDiscountState.effectivePrice, 160);
  assert.equal(activeDiscountState.savingsAmount, 40);

  // Bilingual dictionary verification
  assert.ok(TRANSLATIONS.en && TRANSLATIONS.bn, "Expected both en and bn dictionaries");
  const enKeys = Object.keys(TRANSLATIONS.en);
  const bnKeys = Object.keys(TRANSLATIONS.bn);
  assert.deepEqual(
    enKeys.sort(),
    bnKeys.sort(),
    "English and Bangla translation dictionaries must have 100% key parity"
  );
});

test("Pre-Merge Correction Gate #2: Multi-Instance Vercel Serverless Durable Session Revocation & Login Rate Limiting", async () => {
  const db = await getMongoDb();
  await resetAdminRateLimitsForTest(db);

  // 1. Issue an admin session token on Instance A
  const token = createAdminSessionToken({
    uid: MASTER_ADMIN_UID,
    email: MASTER_ADMIN_EMAIL,
    role: "ADMIN",
  });

  // Verify token is valid on Instance A
  const sessionOk = createMockReqRes({
    method: "GET",
    url: "/api/v1/admin/session",
    headers: { "x-admin-token": token },
  });
  await handler(sessionOk.req, sessionOk.res);
  assert.equal(sessionOk.res.statusCode, 200);

  // 2. Revoke token via /api/v1/admin/logout on Instance A (persisted to MongoDB security_guard)
  const logoutCall = createMockReqRes({
    method: "POST",
    url: "/api/v1/admin/logout",
    headers: { "x-admin-token": token },
  });
  await handler(logoutCall.req, logoutCall.res);
  assert.equal(logoutCall.res.statusCode, 200);
  assert.equal(logoutCall.res.json.revoked, true);

  // 3. Simulate a cold start on a separate Vercel serverless Instance B by wiping all process-local Maps
  evictLocalSecurityCacheForTest();

  // 4. Attempt to use the revoked token on Instance B -> must be rejected with HTTP 401 via MongoDB sync
  const sessionAfterColdStart = createMockReqRes({
    method: "GET",
    url: "/api/v1/admin/session",
    headers: { "x-admin-token": token },
  });
  await handler(sessionAfterColdStart.req, sessionAfterColdStart.res);
  assert.equal(
    sessionAfterColdStart.res.statusCode,
    401,
    "Revoked admin token must remain rejected (401) across serverless instance cold starts"
  );

  // 5. Simulate brute-force login attempts distributed across multiple serverless instances
  const testIp = "203.0.113.199";
  for (let i = 1; i <= 5; i += 1) {
    // Wipe process-local memory before each attempt to simulate hitting a different serverless instance
    evictLocalSecurityCacheForTest();
    const failReq = createMockReqRes({
      method: "POST",
      url: "/api/v1/admin/login",
      headers: { "x-forwarded-for": testIp },
      body: { email: MASTER_ADMIN_EMAIL, password: `WrongPass_${i}` },
    });
    await handler(failReq.req, failReq.res);
    assert.equal(failReq.res.statusCode, 401);
  }

  // 6. On the 6th attempt on a fresh cold-start instance, durable rate limit must return HTTP 429
  evictLocalSecurityCacheForTest();
  const lockedReq = createMockReqRes({
    method: "POST",
    url: "/api/v1/admin/login",
    headers: { "x-forwarded-for": testIp },
    body: { email: MASTER_ADMIN_EMAIL, password: "Admin@12345" },
  });
  await handler(lockedReq.req, lockedReq.res);
  assert.equal(
    lockedReq.res.statusCode,
    429,
    "Brute-force lockout (429) must persist across serverless instance cold starts via MongoDB"
  );

  // Clean up test rate-limit state in MongoDB
  await resetAdminRateLimitsForTest(db);
});

test.after(async () => {
  await closeMongoConnection();
});
