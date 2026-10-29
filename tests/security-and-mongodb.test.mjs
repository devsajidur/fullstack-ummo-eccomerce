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
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_UID,
  parseJsonBody,
  resolveCaller,
  sanitizeInput,
} from "../api/security.js";
import {
  deductOrderInventory,
  validateAndBuildServerOrder,
} from "../api/orderService.js";
import { getProductDiscountState } from "../src/utils/discountTimer.js";
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

test.after(async () => {
  await closeMongoConnection();
});
