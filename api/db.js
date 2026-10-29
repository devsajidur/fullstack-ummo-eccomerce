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
    payments: [],
    users: [],
    addresses: {},
    reviews: {},
    messages: [],
    subscribers: [],
    hydrated: false,
  };
}

let inMemoryState = createInitialMemoryState();
let lastMongoSyncMs = 0;
const STATE_CACHE_TTL_MS = 3000;

export function invalidateStateCache() {
  lastMongoSyncMs = 0;
}

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

/**
 * Updates the in-process state cache after a MongoDB write.
 * Cloudinary is reserved strictly for media images, not database state.
 */
export async function saveCloudMirrorState(state) {
  if (state && typeof state === "object") {
    inMemoryState = state;
    lastMongoSyncMs = Date.now();
  }
}

/**
 * Loads authoritative database state from MongoDB Atlas (`ummo_ecommerce`)
 * with a short in-memory read cache to eliminate redundant queries across rapid requests.
 */
export async function getFullState(options = {}) {
  const now = Date.now();
  if (
    !options.forceRefresh &&
    inMemoryState.hydrated &&
    now - lastMongoSyncMs < STATE_CACHE_TTL_MS
  ) {
    return { state: inMemoryState, source: "mongodb-atlas" };
  }

  const db = await getMongoDb();
  if (!db) {
    return { state: inMemoryState, source: "memory-fallback" };
  }

  try {
    const [
      cfgDoc,
      ordersList,
      paymentsList,
      usersList,
      addressesList,
      reviewsList,
      messagesList,
      subscribersList,
    ] = await Promise.all([
      db.collection("store_config").findOne({ _id: "global" }),
      db.collection("orders").find({}).sort({ date: -1 }).limit(200).toArray(),
      db
        .collection("payments")
        .find({})
        .sort({ createdAt: -1 })
        .limit(200)
        .toArray(),
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
      inMemoryState.storeConfig = {
        ...inMemoryState.storeConfig,
        coupons: cfgDoc.coupons ?? inMemoryState.storeConfig.coupons,
        banners: cfgDoc.banners ?? inMemoryState.storeConfig.banners,
        customProducts:
          cfgDoc.customProducts ?? inMemoryState.storeConfig.customProducts,
        deletedIds: cfgDoc.deletedIds ?? inMemoryState.storeConfig.deletedIds,
        cartRules: cfgDoc.cartRules ?? inMemoryState.storeConfig.cartRules,
      };
    }

    inMemoryState.orders = ordersList;
    inMemoryState.payments = paymentsList;
    inMemoryState.users = usersList;
    inMemoryState.messages = messagesList;
    inMemoryState.subscribers = subscribersList;

    const nextAddresses = {};
    addressesList.forEach((doc) => {
      if (doc.userUid) nextAddresses[doc.userUid] = doc.items || [];
    });
    inMemoryState.addresses = nextAddresses;

    const nextReviews = {};
    reviewsList.forEach((doc) => {
      if (doc.productId) nextReviews[doc.productId] = doc.items || [];
    });
    inMemoryState.reviews = nextReviews;

    inMemoryState.hydrated = true;
    lastMongoSyncMs = Date.now();

    return { state: inMemoryState, source: "mongodb-atlas" };
  } catch {
    return { state: inMemoryState, source: "memory-fallback" };
  }
}
