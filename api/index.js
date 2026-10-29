import crypto from "node:crypto";
import { MongoClient } from "mongodb";

// ============================================================================
// 1. MONGODB ATLAS & CLOUDINARY CREDENTIALS
// ============================================================================
const MONGODB_REPLICA_URI =
  process.env.MONGODB_URI ||
  "mongodb://sajidhasan164_db_user:Ekcz6Nt7Mu1PfwgB@ac-xcv7f8m-shard-00-00.qcq1q7v.mongodb.net:27017,ac-xcv7f8m-shard-00-01.qcq1q7v.mongodb.net:27017,ac-xcv7f8m-shard-00-02.qcq1q7v.mongodb.net:27017/ummo_ecommerce?ssl=true&replicaSet=atlas-vsjtwx-shard-0&authSource=admin&retryWrites=true&w=majority";

const MONGODB_SRV_URI =
  "mongodb+srv://sajidhasan164_db_user:Ekcz6Nt7Mu1PfwgB@cluster0.qcq1q7v.mongodb.net/ummo_ecommerce?retryWrites=true&w=majority";

const DB_NAME = "ummo_ecommerce";

const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME || "wxjt7d8q";
const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY || "791685979462932";
const CLOUDINARY_API_SECRET =
  process.env.CLOUDINARY_API_SECRET || "s6TJSmCrjAMjwOkTX_W7N7PkPFo";

// ============================================================================
// 2. CONNECTION POOLING + CLOUDINARY STATE MIRROR (ZERO-DOWNTIME FALLBACK)
// ============================================================================
let cachedMongoClient = null;
let cachedDb = null;
let lastMongoAttempt = 0;

let inMemoryState = {
  storeConfig: {
    coupons: null,
    banners: null,
    customProducts: [],
    deletedIds: [],
    cartRules: null,
  },
  orders: [],
  users: [],
  addresses: {},
  reviews: {},
  messages: [],
  subscribers: [],
  hydrated: false,
};

async function getMongoDb() {
  if (cachedDb) return cachedDb;
  const now = Date.now();
  if (now - lastMongoAttempt < 15000) return null;
  lastMongoAttempt = now;

  for (const uri of [MONGODB_REPLICA_URI, MONGODB_SRV_URI]) {
    try {
      const client = new MongoClient(uri, {
        serverSelectionTimeoutMS: 3500,
        connectTimeoutMS: 3500,
        maxPoolSize: 10,
      });
      await client.connect();
      const db = client.db(DB_NAME);
      await db.command({ ping: 1 });
      cachedMongoClient = client;
      cachedDb = db;
      return cachedDb;
    } catch {
      // Try next URI or fallback mirror
    }
  }
  return null;
}

async function loadCloudMirrorState() {
  if (inMemoryState.hydrated) return inMemoryState;
  try {
    const res = await fetch(
      `https://res.cloudinary.com/${CLOUDINARY_CLOUD_NAME}/raw/upload/ummo_db/database_state_v1.json?t=${Date.now()}`
    );
    if (res.ok) {
      const data = await res.json();
      if (data && typeof data === "object") {
        inMemoryState = {
          ...inMemoryState,
          ...data,
          storeConfig: {
            ...inMemoryState.storeConfig,
            ...(data.storeConfig || {}),
          },
          hydrated: true,
        };
      }
    }
  } catch {
    // Use default state if not yet created
  }
  inMemoryState.hydrated = true;
  return inMemoryState;
}

async function saveCloudMirrorState(state) {
  try {
    const jsonStr = JSON.stringify(state);
    const b64 = `data:application/json;base64,${Buffer.from(jsonStr).toString("base64")}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "ummo_db";
    const public_id = "database_state_v1.json";
    const toSign = `folder=${folder}&invalidate=true&overwrite=true&public_id=${public_id}&timestamp=${timestamp}${CLOUDINARY_API_SECRET}`;
    const signature = crypto.createHash("sha1").update(toSign).digest("hex");

    const body = new URLSearchParams({
      file: b64,
      api_key: CLOUDINARY_API_KEY,
      timestamp: String(timestamp),
      folder,
      public_id,
      overwrite: "true",
      invalidate: "true",
      signature,
    });

    await fetch(
      `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/raw/upload`,
      {
        method: "POST",
        body,
      }
    );
  } catch {
    // Non-blocking
  }
}

async function getFullState() {
  const state = await loadCloudMirrorState();
  const db = await getMongoDb();
  if (!db) return { state, source: "cloud-mirror" };

  try {
    const [
      cfgDoc,
      ordersList,
      usersList,
      addressesList,
      reviewsList,
      messagesList,
      subscribersList,
    ] = await Promise.all([
      db.collection("store_config").findOne({ _id: "global" }),
      db.collection("orders").find({}).sort({ date: -1 }).limit(200).toArray(),
      db.collection("users").find({}).limit(200).toArray(),
      db.collection("addresses").find({}).limit(200).toArray(),
      db.collection("reviews").find({}).limit(200).toArray(),
      db.collection("messages").find({}).sort({ createdAt: -1 }).limit(100).toArray(),
      db.collection("subscribers").find({}).sort({ createdAt: -1 }).limit(200).toArray(),
    ]);

    if (cfgDoc) {
      state.storeConfig = {
        ...state.storeConfig,
        coupons: cfgDoc.coupons ?? state.storeConfig.coupons,
        banners: cfgDoc.banners ?? state.storeConfig.banners,
        customProducts: cfgDoc.customProducts ?? state.storeConfig.customProducts,
        deletedIds: cfgDoc.deletedIds ?? state.storeConfig.deletedIds,
        cartRules: cfgDoc.cartRules ?? state.storeConfig.cartRules,
      };
    }
    if (ordersList.length) state.orders = ordersList;
    if (usersList.length) state.users = usersList;
    if (messagesList.length) state.messages = messagesList;
    if (subscribersList.length) state.subscribers = subscribersList;

    addressesList.forEach((doc) => {
      if (doc.userUid) state.addresses[doc.userUid] = doc.items || [];
    });
    reviewsList.forEach((doc) => {
      if (doc.productId) state.reviews[doc.productId] = doc.items || [];
    });

    return { state, source: "mongodb-atlas" };
  } catch {
    return { state, source: "cloud-mirror" };
  }
}

// ============================================================================
// 3. REQUEST PARSER & CORS HELPER
// ============================================================================
async function parseJsonBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string" && req.body.trim()) {
    try {
      return JSON.parse(req.body);
    } catch {
      return {};
    }
  }
  return new Promise((resolve) => {
    let raw = "";
    req.on("data", (chunk) => {
      raw += chunk;
    });
    req.on("end", () => {
      if (!raw) return resolve({});
      try {
        resolve(JSON.parse(raw));
      } catch {
        resolve({});
      }
    });
    req.on("error", () => resolve({}));
  });
}

function sendJson(res, statusCode, payload) {
  res.statusCode = statusCode;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader(
    "Access-Control-Allow-Methods",
    "GET,POST,PUT,PATCH,DELETE,OPTIONS"
  );
  res.setHeader(
    "Access-Control-Allow-Headers",
    "Content-Type, Authorization, Idempotency-Key"
  );
  res.end(JSON.stringify(payload));
}

// ============================================================================
// 4. MAIN SERVERLESS / VITE API HANDLER
// ============================================================================
export default async function handler(req, res) {
  if (req.method === "OPTIONS") {
    return sendJson(res, 200, { ok: true });
  }

  const urlObj = new URL(req.url || "/", "http://localhost");
  const path = urlObj.pathname.replace(/^\/api\/v1/, "").replace(/^\/api/, "") || "/";
  const method = (req.method || "GET").toUpperCase();

  try {
    // 1. Health & Connectivity Check
    if (path === "/health" && method === "GET") {
      const db = await getMongoDb();
      return sendJson(res, 200, {
        status: "ok",
        mongodbConnected: Boolean(db),
        database: "ummo_ecommerce (MongoDB Atlas)",
        cloudinaryCloudName: CLOUDINARY_CLOUD_NAME,
        firebaseAuthProject: "ummo-eccomerce",
      });
    }

    // 2. Get Full Store Data (Config, Orders, Users, Messages, Subscribers, Reviews, Addresses)
    if (path === "/store-data" && method === "GET") {
      const { state, source } = await getFullState();
      const userUid = urlObj.searchParams.get("userUid");
      const productId = urlObj.searchParams.get("productId");

      return sendJson(res, 200, {
        status: "ok",
        source,
        storeConfig: state.storeConfig,
        orders: userUid
          ? state.orders.filter((o) => String(o.userUid || o.id) === String(userUid))
          : state.orders,
        users: state.users,
        addresses: userUid ? state.addresses[userUid] || [] : state.addresses,
        reviews: productId ? state.reviews[productId] || [] : state.reviews,
        messages: state.messages,
        subscribers: state.subscribers,
      });
    }

    // 3. Update Store Config (Coupons, Banners, Custom Products, Deleted IDs, Cart Rules)
    if (path === "/store-config" && (method === "POST" || method === "PUT")) {
      const body = await parseJsonBody(req);
      const { state } = await getFullState();

      const updatedConfig = {
        ...state.storeConfig,
        ...(body.coupons !== undefined ? { coupons: body.coupons } : {}),
        ...(body.banners !== undefined ? { banners: body.banners } : {}),
        ...(body.customProducts !== undefined
          ? { customProducts: body.customProducts }
          : {}),
        ...(body.deletedIds !== undefined ? { deletedIds: body.deletedIds } : {}),
        ...(body.cartRules !== undefined ? { cartRules: body.cartRules } : {}),
        updatedAt: new Date().toISOString(),
      };

      state.storeConfig = updatedConfig;

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("store_config")
          .updateOne(
            { _id: "global" },
            { $set: updatedConfig },
            { upsert: true }
          )
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(res, 200, {
        status: "ok",
        storeConfig: updatedConfig,
      });
    }

    // 4. Create Order (POST /orders or /orders/checkout)
    if (
      (path === "/orders" || path === "/orders/checkout") &&
      method === "POST"
    ) {
      const body = await parseJsonBody(req);
      const { state } = await getFullState();

      const orderId = body.orderId || body.id || `ORD-${Date.now()}`;
      const newOrder = {
        ...body,
        orderId,
        id: orderId,
        userUid: body.userUid || body.id || "guest",
        status: body.status || "PENDING",
        date: body.date || new Date().toISOString(),
      };

      state.orders = [
        newOrder,
        ...state.orders.filter((o) => String(o.orderId) !== String(orderId)),
      ];

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("orders")
          .updateOne(
            { orderId },
            { $set: newOrder },
            { upsert: true }
          )
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(res, 201, {
        status: "ok",
        order: newOrder,
      });
    }

    // 5. Update Order Status (PATCH /orders/status)
    if (path === "/orders/status" && (method === "PATCH" || method === "POST")) {
      const body = await parseJsonBody(req);
      const { orderId, status } = body;
      const { state } = await getFullState();

      state.orders = state.orders.map((o) =>
        String(o.orderId) === String(orderId)
          ? { ...o, status, updatedAt: new Date().toISOString() }
          : o
      );

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("orders")
          .updateOne(
            { orderId },
            { $set: { status, updatedAt: new Date().toISOString() } }
          )
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(res, 200, { status: "ok", orderId, newStatus: status });
    }

    // 6. Sync User Profile to MongoDB (POST /users)
    if (path === "/users" && method === "POST") {
      const body = await parseJsonBody(req);
      if (!body.uid) {
        return sendJson(res, 400, { error: "Missing uid" });
      }
      const { state } = await getFullState();
      const existing = state.users.find((u) => u.uid === body.uid);
      const userDoc = {
        ...existing,
        ...body,
        role: body.role || existing?.role || "CUSTOMER",
        updatedAt: new Date().toISOString(),
      };

      state.users = [
        userDoc,
        ...state.users.filter((u) => u.uid !== body.uid),
      ];

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("users")
          .updateOne({ uid: body.uid }, { $set: userDoc }, { upsert: true })
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(res, 200, { status: "ok", user: userDoc });
    }

    // 7. Toggle User Role (PATCH /users/role)
    if (path === "/users/role" && (method === "PATCH" || method === "POST")) {
      const body = await parseJsonBody(req);
      const { uid, role } = body;
      const { state } = await getFullState();

      state.users = state.users.map((u) =>
        u.uid === uid ? { ...u, role } : u
      );

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("users")
          .updateOne({ uid }, { $set: { role } })
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(res, 200, { status: "ok", uid, role });
    }

    // 8. Customer Addresses (GET / POST / DELETE /addresses)
    if (path === "/addresses") {
      const { state } = await getFullState();
      if (method === "GET") {
        const userUid = urlObj.searchParams.get("userUid");
        return sendJson(res, 200, {
          status: "ok",
          addresses: userUid ? state.addresses[userUid] || [] : state.addresses,
        });
      }
      if (method === "POST") {
        const body = await parseJsonBody(req);
        const { userUid, addresses } = body;
        if (!userUid) return sendJson(res, 400, { error: "Missing userUid" });
        state.addresses[userUid] = Array.isArray(addresses) ? addresses : [];

        const db = await getMongoDb();
        if (db) {
          await db
            .collection("addresses")
            .updateOne(
              { userUid },
              { $set: { userUid, items: state.addresses[userUid] } },
              { upsert: true }
            )
            .catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(res, 200, {
          status: "ok",
          addresses: state.addresses[userUid],
        });
      }
    }

    // 9. Product Reviews (GET / POST /reviews)
    if (path === "/reviews") {
      const { state } = await getFullState();
      if (method === "GET") {
        const productId = String(urlObj.searchParams.get("productId") || "");
        return sendJson(res, 200, {
          status: "ok",
          reviews: productId ? state.reviews[productId] || [] : state.reviews,
        });
      }
      if (method === "POST") {
        const body = await parseJsonBody(req);
        const productId = String(body.productId || "");
        if (!productId || !body.review) {
          return sendJson(res, 400, { error: "Missing productId or review" });
        }
        const current = state.reviews[productId] || [];
        const updated = [body.review, ...current];
        state.reviews[productId] = updated;

        const db = await getMongoDb();
        if (db) {
          await db
            .collection("reviews")
            .updateOne(
              { productId },
              { $set: { productId, items: updated } },
              { upsert: true }
            )
            .catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(res, 201, { status: "ok", reviews: updated });
      }
    }

    // 10. Contact Messages (POST / DELETE /messages)
    if (path === "/messages") {
      const { state } = await getFullState();
      if (method === "POST") {
        const body = await parseJsonBody(req);
        const msg = {
          id: body.id || `MSG-${Date.now()}`,
          name: body.name || "",
          email: body.email || "",
          message: body.message || "",
          createdAt: body.createdAt || new Date().toISOString(),
        };
        state.messages = [msg, ...state.messages];
        const db = await getMongoDb();
        if (db) {
          await db.collection("messages").insertOne(msg).catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(res, 201, { status: "ok", message: msg });
      }
      if (method === "DELETE") {
        const id = urlObj.searchParams.get("id");
        state.messages = state.messages.filter((m) => String(m.id) !== String(id));
        const db = await getMongoDb();
        if (db) {
          await db.collection("messages").deleteOne({ id }).catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(res, 200, { status: "ok" });
      }
    }

    // 11. Newsletter Subscribers (POST / DELETE /subscribers)
    if (path === "/subscribers") {
      const { state } = await getFullState();
      if (method === "POST") {
        const body = await parseJsonBody(req);
        const sub = {
          id: body.id || `SUB-${Date.now()}`,
          email: body.email || "",
          createdAt: body.createdAt || new Date().toISOString(),
        };
        state.subscribers = [
          sub,
          ...state.subscribers.filter((s) => s.email !== sub.email),
        ];
        const db = await getMongoDb();
        if (db) {
          await db
            .collection("subscribers")
            .updateOne({ email: sub.email }, { $set: sub }, { upsert: true })
            .catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(res, 201, { status: "ok", subscriber: sub });
      }
      if (method === "DELETE") {
        const id = urlObj.searchParams.get("id");
        state.subscribers = state.subscribers.filter(
          (s) => String(s.id) !== String(id)
        );
        const db = await getMongoDb();
        if (db) {
          await db.collection("subscribers").deleteOne({ id }).catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(res, 200, { status: "ok" });
      }
    }

    return sendJson(res, 404, { error: `API endpoint not found: ${path}` });
  } catch (err) {
    return sendJson(res, 500, {
      error: err?.message || "Internal server error",
    });
  }
}
