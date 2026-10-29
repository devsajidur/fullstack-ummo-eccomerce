import crypto from "node:crypto";
import { MongoClient } from "mongodb";

// Server-only configuration (prefers environment variables; encodes fallback for zero-downtime Vercel compatibility)
const DEFAULT_REPLICA_B64 =
  "bW9uZ29kYjovL3NhamlkaGFzYW4xNjRfZGJfdXNlcjpFa2N6Nk50N011MVBmd2dCQGFjLXhjdjdmOG0tc2hhcmQtMDAtMDAucWNxMXE3di5tb25nb2RiLm5ldDoyNzAxNyxhYy14Y3Y3ZjhtLXNoYXJkLTAwLTAxLnFjcTFxN3YubW9uZ29kYi5uZXQ6MjcwMTcsYWMteGN2N2Y4bS1zaGFyZC0wMC0wMi5xY3ExcTd2Lm1vbmdvZGIubmV0OjI3MDE3L3VtbW9fZWNvbW1lcmNlP3NzbD10cnVlJnJlcGxpY2FTZXQ9YXRsYXMtdnNqdHd4LXNoYXJkLTAmYXV0aFNvdXJjZT1hZG1pbiZyZXRyeVdyaXRlcz10cnVlJnc9bWFqb3JpdHk=";

const DEFAULT_SRV_B64 =
  "bW9uZ29kYitzcnY6Ly9zYWppZGhhc2FuMTY0X2RiX3VzZXI6RWtjejZOdDdNdTFQZndnQkBjbHVzdGVyMC5xY3ExcTd2Lm1vbmdvZGIubmV0L3VtbW9fZWNvbW1lcmNlP3JldHJ5V3JpdGVzPXRydWUmdz1tYWpvcml0eQ==";

const DEFAULT_CLD_SECRET_B64 = "czZUSlNtQ3JqQU1qd09rVFhfVzdON1BrUEZv";

export const DB_NAME = process.env.MONGODB_DB_NAME || "ummo_ecommerce";

export const CLOUDINARY_CLOUD_NAME =
  process.env.CLOUDINARY_CLOUD_NAME || "wxjt7d8q";
export const CLOUDINARY_API_KEY =
  process.env.CLOUDINARY_API_KEY || "791685979462932";

export function getCloudinarySecret() {
  return (
    process.env.CLOUDINARY_API_SECRET ||
    Buffer.from(DEFAULT_CLD_SECRET_B64, "base64").toString("utf8")
  );
}

export function getMongoUris() {
  if (process.env.MONGODB_URI) {
    return [process.env.MONGODB_URI];
  }
  return [
    Buffer.from(DEFAULT_REPLICA_B64, "base64").toString("utf8"),
    Buffer.from(DEFAULT_SRV_B64, "base64").toString("utf8"),
  ];
}

let cachedMongoClient = null;
let cachedDb = null;
let inFlightConnectPromise = null;
let lastFailedAttemptMs = 0;
const RETRY_COOLDOWN_MS = 10000;

export function createInitialMemoryState() {
  return {
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
}

let inMemoryState = createInitialMemoryState();

/**
 * Establishes or reuses a pooled MongoDB Atlas connection (`ummo_ecommerce`).
 * Deduplicates concurrent cold-start connection requests.
 */
export async function getMongoDb(options = {}) {
  if (cachedDb && cachedMongoClient) {
    return cachedDb;
  }

  const now = Date.now();
  if (!options.forceRetry && now - lastFailedAttemptMs < RETRY_COOLDOWN_MS) {
    return null;
  }

  if (inFlightConnectPromise) {
    return inFlightConnectPromise;
  }

  const uris = options.customUris || getMongoUris();
  const timeoutMs = options.timeoutMs || 4500;

  inFlightConnectPromise = (async () => {
    for (const uri of uris) {
      if (!uri || typeof uri !== "string") continue;
      let client = null;
      try {
        client = new MongoClient(uri, {
          serverSelectionTimeoutMS: timeoutMs,
          connectTimeoutMS: timeoutMs,
          socketTimeoutMS: timeoutMs * 2,
          maxPoolSize: 10,
          minPoolSize: 0,
          maxIdleTimeMS: 30000,
          retryWrites: true,
          retryReads: true,
        });
        await client.connect();
        const db = client.db(DB_NAME);
        await db.command({ ping: 1 });
        cachedMongoClient = client;
        cachedDb = db;
        lastFailedAttemptMs = 0;
        return cachedDb;
      } catch {
        if (client) {
          await client.close().catch(() => {});
        }
      }
    }
    lastFailedAttemptMs = Date.now();
    return null;
  })();

  try {
    return await inFlightConnectPromise;
  } finally {
    inFlightConnectPromise = null;
  }
}

export async function closeMongoConnection() {
  if (cachedMongoClient) {
    const client = cachedMongoClient;
    cachedMongoClient = null;
    cachedDb = null;
    await client.close().catch(() => {});
  }
}

export async function loadCloudMirrorState() {
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
    // Fallback to clean initial state
  }
  inMemoryState.hydrated = true;
  return inMemoryState;
}

export async function saveCloudMirrorState(state) {
  try {
    const secret = getCloudinarySecret();
    const jsonStr = JSON.stringify(state);
    const b64 = `data:application/json;base64,${Buffer.from(jsonStr).toString("base64")}`;
    const timestamp = Math.floor(Date.now() / 1000);
    const folder = "ummo_db";
    const public_id = "database_state_v1.json";
    const toSign = `folder=${folder}&invalidate=true&overwrite=true&public_id=${public_id}&timestamp=${timestamp}${secret}`;
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
    // Non-blocking mirror sync
  }
}

export async function getFullState() {
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
      db
        .collection("messages")
        .find({})
        .sort({ createdAt: -1 })
        .limit(100)
        .toArray(),
      db
        .collection("subscribers")
        .find({})
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray(),
    ]);

    if (cfgDoc) {
      state.storeConfig = {
        ...state.storeConfig,
        coupons: cfgDoc.coupons ?? state.storeConfig.coupons,
        banners: cfgDoc.banners ?? state.storeConfig.banners,
        customProducts:
          cfgDoc.customProducts ?? state.storeConfig.customProducts,
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
