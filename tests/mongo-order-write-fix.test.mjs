import test from "node:test";
import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { MongoClient } from "mongodb";
import handler from "../api/index.js";
import {
  classifyMongoWriteError,
  clearLastWriteDiagnostic,
  inspectMongoWritePermissions,
  inspectRawMongoUriAnomaly,
  invalidateStateCache,
  normalizeMongoUri,
  setMockMongoDbForTest,
} from "../api/db.js";

function createMockReqRes({ method = "GET", url = "/", headers = {}, body = null } = {}) {
  const payload = body ? Buffer.from(JSON.stringify(body), "utf8") : Buffer.alloc(0);
  const req = Readable.from(payload.length ? [payload] : []);
  req.method = method;
  req.url = url;
  req.headers = {
    "content-type": "application/json",
    ...headers,
  };

  const resHeaders = {};
  const res = {
    statusCode: 200,
    headers: resHeaders,
    bodyText: "",
    json: null,
    setHeader(k, v) {
      resHeaders[String(k).toLowerCase()] = v;
    },
    end(chunk = "") {
      this.bodyText = String(chunk || "");
      try {
        this.json = this.bodyText ? JSON.parse(this.bodyText) : null;
      } catch {
        this.json = null;
      }
    },
  };
  return { req, res };
}

function createTransactionalMemoryMongo({ failStoreConfigError = null } = {}) {
  const store = {
    orders: new Map(),
    store_config: new Map([
      [
        "global",
        {
          _id: "global",
          customProducts: [
            { id: 1, title: "Essence Mascara Lash Princess", price: 10, stock: 30 },
          ],
          coupons: [],
          deletedIds: [],
        },
      ],
    ]),
    payments: new Map(),
    users: new Map(),
    addresses: new Map(),
    reviews: new Map(),
    messages: new Map(),
    subscribers: new Map(),
  };

  let activeTxStaged = null;
  const observedSetPayloads = [];

  function getTargetMap(name, session) {
    if (session && activeTxStaged) {
      return activeTxStaged[name];
    }
    return store[name];
  }

  const db = {
    client: {
      options: { writeConcern: { w: "majority" } },
      startSession() {
        return {
          async withTransaction(fn) {
            activeTxStaged = Object.fromEntries(
              Object.entries(store).map(([k, map]) => [
                k,
                new Map(
                  [...map.entries()].map(([id, doc]) => [id, structuredClone(doc)])
                ),
              ])
            );
            try {
              await fn();
              for (const [k, stagedMap] of Object.entries(activeTxStaged)) {
                store[k] = stagedMap;
              }
            } finally {
              activeTxStaged = null;
            }
          },
          async endSession() {},
        };
      },
    },
    async command(cmd) {
      if (cmd.connectionStatus) {
        return {
          authInfo: {
            authenticatedUserRoles: [{ role: "readWrite", db: "ummo_ecommerce" }],
            authenticatedUserPrivileges: [],
          },
          ok: 1,
        };
      }
      return { ok: 1 };
    },
    collection(name) {
      return {
        async findOne(filter = {}) {
          const map = getTargetMap(name, null);
          for (const doc of map.values()) {
            if (filter._id && doc._id === filter._id) return structuredClone(doc);
            if (filter.orderId && doc.orderId === filter.orderId) return structuredClone(doc);
            if (filter.idempotencyKey && doc.idempotencyKey === filter.idempotencyKey) {
              return structuredClone(doc);
            }
            if (Array.isArray(filter.$or)) {
              for (const clause of filter.$or) {
                if (clause.orderId && doc.orderId === clause.orderId) return structuredClone(doc);
                if (clause.idempotencyKey && doc.idempotencyKey === clause.idempotencyKey) {
                  return structuredClone(doc);
                }
              }
            }
          }
          return null;
        },
        find() {
          const map = getTargetMap(name, null);
          const list = [...map.values()].map((d) => structuredClone(d));
          const cursor = {
            sort() {
              return cursor;
            },
            limit() {
              return cursor;
            },
            async toArray() {
              return list;
            },
          };
          return cursor;
        },
        async updateOne(filter, update, options = {}) {
          if (name === "store_config" && failStoreConfigError) {
            throw failStoreConfigError;
          }
          observedSetPayloads.push({
            collection: name,
            setPayloadKeys: Object.keys(update?.$set || {}),
            hasImmutableIdInSet: "_id" in (update?.$set || {}),
          });
          if ("_id" in (update?.$set || {})) {
            const immErr = new Error(
              "Performing an update on the path '_id' would modify the immutable field '_id'"
            );
            immErr.name = "MongoServerError";
            immErr.code = 66;
            immErr.codeName = "ImmutableField";
            throw immErr;
          }
          const map = getTargetMap(name, options.session);
          const key =
            filter._id ||
            filter.orderId ||
            update?.$set?.orderId ||
            `doc-${map.size + 1}`;
          const prev = map.get(key) || (filter._id ? { _id: filter._id } : {});
          map.set(key, { ...prev, ...(update?.$set || {}) });
          return { acknowledged: true, matchedCount: 1, modifiedCount: 1 };
        },
      };
    },
  };

  return { db, store, observedSetPayloads };
}

test("URI writeConcern corruption detection and normalization clean malformed w= parameters", () => {
  const malformedSamples = [
    "mongodb://u:secretPass@localhost:27017/?retryWrites=true&w=majority\\n",
    'mongodb://u:secretPass@localhost:27017/?retryWrites=true&w=majority"',
    "mongodb://u:secretPass@localhost:27017/?retryWrites=true&w=majority;",
    "mongodb://u:secretPass@localhost:27017/?retryWrites=true&w=majority/ummo_ecommerce",
    'mongodb://u:secretPass@localhost:27017?retryWrites=true&w=majority"',
    "mongodb://u:secretPass@localhost:27017?retryWrites=true&w=majority%0A",
    "mongodb://u:secretPass@localhost:27017?retryWrites=true&w=majority/ummo_ecommerce",
  ];

  for (const raw of malformedSamples) {
    const anomaly = inspectRawMongoUriAnomaly(raw);
    assert.equal(anomaly.rawWriteConcernCorrupted, true);
    assert.equal(anomaly.autoNormalized, true);
    assert.equal(JSON.stringify(anomaly).includes("secretPass"), false);

    const cleaned = normalizeMongoUri(raw);
    const client = new MongoClient(cleaned);
    assert.equal(client.options.writeConcern?.w, "majority");
  }
});

test("classifyMongoWriteError accurately categorizes MongoDB numeric codes without leaking secrets", () => {
  const authDiag = classifyMongoWriteError(
    Object.assign(
      new Error("not authorized on ummo_ecommerce to execute update with secret mongodb+srv://u:p@h"),
      { name: "MongoServerError", code: 13, codeName: "Unauthorized" }
    ),
    { collection: "store_config", operation: "updateOne" }
  );
  assert.deepEqual(authDiag, {
    errorName: "MongoServerError",
    code: 13,
    codeName: "Unauthorized",
    collection: "store_config",
    operation: "updateOne",
    category: "AUTHORIZATION",
  });
  assert.equal(JSON.stringify(authDiag).includes("mongodb+srv"), false);

  const wcDiag = classifyMongoWriteError(
    Object.assign(new Error("No write concern mode named 'majority\\n' found"), {
      name: "MongoWriteConcernError",
      writeConcernError: { code: 79, codeName: "UnknownReplWriteConcern" },
    }),
    { collection: "orders", operation: "updateOne" }
  );
  assert.equal(wcDiag.code, 79);
  assert.equal(wcDiag.codeName, "UnknownReplWriteConcern");
  assert.equal(wcDiag.category, "WRITE_CONCERN");

  const immDiag = classifyMongoWriteError(
    Object.assign(new Error("immutable field '_id'"), {
      name: "MongoServerError",
      code: 66,
      codeName: "ImmutableField",
    }),
    { collection: "orders", operation: "updateOne" }
  );
  assert.equal(immDiag.code, 66);
  assert.equal(immDiag.category, "IMMUTABLE_FIELD");
});

test("inspectMongoWritePermissions detects read-only vs readWrite Atlas roles safely", async () => {
  const readOnlyDb = {
    async command() {
      return {
        authInfo: {
          authenticatedUserRoles: [{ role: "read", db: "ummo_ecommerce" }],
          authenticatedUserPrivileges: [],
        },
      };
    },
  };
  const roSummary = await inspectMongoWritePermissions(readOnlyDb, [
    "orders",
    "store_config",
  ]);
  assert.equal(roSummary.allOrderCollectionsWritable, false);
  assert.equal(roSummary.collections.orders.upsert, false);
  assert.equal(roSummary.collections.store_config.upsert, false);
  assert.match(roSummary.requiredRoleCorrection, /readWrite@ummo_ecommerce/);

  const rwDb = {
    async command() {
      return {
        authInfo: {
          authenticatedUserRoles: [{ role: "readWrite", db: "ummo_ecommerce" }],
          authenticatedUserPrivileges: [],
        },
      };
    },
  };
  const rwSummary = await inspectMongoWritePermissions(rwDb, [
    "orders",
    "store_config",
  ]);
  assert.equal(rwSummary.allOrderCollectionsWritable, true);
  assert.equal(rwSummary.collections.orders.upsert, true);
  assert.equal(rwSummary.collections.store_config.upsert, true);
  assert.equal(rwSummary.requiredRoleCorrection, null);
});

test("POST /api/v1/orders prevents partial writes on failure, strips _id on $set, and preserves idempotency + stock", async () => {
  try {
    // 1. Simulate store_config failure AFTER orders.updateOne inside transaction -> must roll back orders & keep stock = 30
    const unauthErr = Object.assign(
      new Error("not authorized on ummo_ecommerce.store_config"),
      { name: "MongoServerError", code: 13, codeName: "Unauthorized" }
    );
    const failingMock = createTransactionalMemoryMongo({
      failStoreConfigError: unauthErr,
    });
    setMockMongoDbForTest(failingMock.db);
    clearLastWriteDiagnostic();

    const failCall = createMockReqRes({
      method: "POST",
      url: "/api/v1/orders",
      headers: {
        "x-user-uid": "cust-isolated-1",
        "idempotency-key": "idem-atomic-fail-1",
      },
      body: {
        orderId: "ORD-MOCK-FAIL-1",
        userUid: "cust-isolated-1",
        email: "private-customer@example.com",
        firstName: "Private",
        lastName: "Buyer",
        OrderItems: [{ id: 1, quantity: 2, price: 10 }],
        billing: {
          streetAddress: "123 Secret Road",
          city: "Dhaka",
          postcode: "1200",
          country: "Bangladesh",
          phone: "01711111111",
        },
      },
    });
    await handler(failCall.req, failCall.res);

    assert.equal(failCall.res.statusCode, 503);
    assert.equal(failCall.res.json.code, "DB_WRITE_FAILED");
    assert.deepEqual(failCall.res.json.diagnostic, {
      errorName: "MongoServerError",
      code: 13,
      codeName: "Unauthorized",
      collection: "store_config",
      operation: "updateOne",
      category: "AUTHORIZATION",
    });
    // Zero customer PII leaked in error payload
    assert.equal(failCall.res.bodyText.includes("private-customer@example.com"), false);
    assert.equal(failCall.res.bodyText.includes("01711111111"), false);
    // Zero partial write in orders & stock untouched
    assert.equal(failingMock.store.orders.size, 0);
    assert.equal(
      failingMock.store.store_config.get("global").customProducts[0].stock,
      30
    );

    // 2. Healthy transactional write -> commits atomically, strips _id, and replays idempotently without double-deducting stock
    const healthyMock = createTransactionalMemoryMongo();
    setMockMongoDbForTest(healthyMock.db);

    const okCall = createMockReqRes({
      method: "POST",
      url: "/api/v1/orders",
      headers: {
        "x-user-uid": "cust-isolated-2",
        "idempotency-key": "idem-atomic-ok-1",
      },
      body: {
        orderId: "ORD-MOCK-OK-1",
        userUid: "cust-isolated-2",
        email: "buyer2@example.com",
        firstName: "Test",
        lastName: "Buyer",
        OrderItems: [{ id: 1, quantity: 2, price: 10 }],
        billing: {
          streetAddress: "100 Main St",
          city: "Dhaka",
          postcode: "1200",
          country: "Bangladesh",
          phone: "01722222222",
        },
      },
    });
    await handler(okCall.req, okCall.res);
    assert.equal(okCall.res.statusCode, 201);
    assert.equal(healthyMock.store.orders.size, 1);
    assert.equal(
      healthyMock.store.store_config.get("global").customProducts[0].stock,
      28
    );
    assert.equal(
      healthyMock.observedSetPayloads.every((p) => !p.hasImmutableIdInSet),
      true
    );

    // Simulate cold start / cache eviction and replay same idempotency-key
    invalidateStateCache();
    const replayCall = createMockReqRes({
      method: "POST",
      url: "/api/v1/orders",
      headers: {
        "x-user-uid": "cust-isolated-2",
        "idempotency-key": "idem-atomic-ok-1",
      },
      body: {
        orderId: "ORD-MOCK-OK-1",
        userUid: "cust-isolated-2",
        email: "buyer2@example.com",
        firstName: "Test",
        lastName: "Buyer",
        OrderItems: [{ id: 1, quantity: 2, price: 10 }],
        billing: {
          streetAddress: "100 Main St",
          city: "Dhaka",
          postcode: "1200",
          country: "Bangladesh",
          phone: "01722222222",
        },
      },
    });
    await handler(replayCall.req, replayCall.res);
    assert.equal(replayCall.res.statusCode, 200);
    assert.equal(replayCall.res.json.idempotentReplay, true);
    assert.equal(healthyMock.store.orders.size, 1);
    assert.equal(
      healthyMock.store.store_config.get("global").customProducts[0].stock,
      28
    );
  } finally {
    setMockMongoDbForTest(null);
    clearLastWriteDiagnostic();
  }
});
