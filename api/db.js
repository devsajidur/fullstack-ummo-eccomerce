import { MongoClient } from "mongodb";
import { loadServerEnv } from "./_services/envLoader.js";

loadServerEnv();

export const DB_NAME = process.env.MONGODB_DB_NAME || "ummo_ecommerce";

export function getCloudinaryCloudName() {
  return String(process.env.CLOUDINARY_CLOUD_NAME || "wxjt7d8q").trim();
}

export const CLOUDINARY_CLOUD_NAME = getCloudinaryCloudName();

export function getCloudinaryApiKey() {
  return String(process.env.CLOUDINARY_API_KEY || "").trim();
}

export const CLOUDINARY_API_KEY = getCloudinaryApiKey();

export function getCloudinarySecret() {
  return String(process.env.CLOUDINARY_API_SECRET || "").trim();
}

export function isMongoConfigured() {
  return getMongoUris().length > 0;
}

export function getMongoUris() {
  const uris = [
    process.env.MONGODB_URI,
    process.env.MONGODB_URI_FALLBACK,
  ]
    .map((u) => String(u || "").trim())
    .filter(Boolean);
  return [...new Set(uris)];
}

let cachedMongoClient = null;
let cachedDb = null;
let inFlightConnectPromise = null;
let lastFailedAttemptMs = 0;
let forceDisconnectedForTest = false;
const RETRY_COOLDOWN_MS = 10000;

export function setMongoDisconnectedForTest(disconnected) {
  forceDisconnectedForTest = Boolean(disconnected);
}

export function createInitialMemoryState() {
  return {
    storeConfig: {
      coupons: null,
      banners: null,
      featuredCollection: null,
      customProducts: [],
      deletedIds: [],
      cartRules: null,
      discountCampaigns: null,
      customTaxonomy: null,
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
  if (forceDisconnectedForTest) {
    return null;
  }
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
 * Requires an active MongoDB Atlas connection for authoritative business writes.
 * Fails closed with HTTP 503 instead of silently acknowledging volatile memory writes.
 */
export async function requireDurableMongoDb() {
  const db = await getMongoDb();
  if (!db) {
    const err = new Error(
      "Database persistence unavailable (MongoDB Atlas disconnected). Write operation aborted to prevent data loss."
    );
    err.statusCode = 503;
    err.exposeMessage = true;
    err.code = "DB_UNAVAILABLE";
    throw err;
  }
  return db;
}

/**
 * Executes a durable MongoDB write without swallowing errors.
 * Evicts the local state cache if a write fails so stale mutations never linger.
 */
export async function commitDurableMongoWrite(writeFn) {
  const db = await requireDurableMongoDb();
  try {
    return await writeFn(db);
  } catch (err) {
    inMemoryState.hydrated = false;
    lastMongoSyncMs = 0;
    if (err?.statusCode) {
      throw err;
    }
    const writeErr = new Error(
      "Durable database write failed on MongoDB Atlas. Changes were not saved."
    );
    writeErr.statusCode = 503;
    writeErr.exposeMessage = true;
    writeErr.code = "DB_WRITE_FAILED";
    throw writeErr;
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
    !forceDisconnectedForTest &&
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
        featuredCollection:
          cfgDoc.featuredCollection ??
          inMemoryState.storeConfig.featuredCollection,
        customProducts:
          cfgDoc.customProducts ?? inMemoryState.storeConfig.customProducts,
        deletedIds: cfgDoc.deletedIds ?? inMemoryState.storeConfig.deletedIds,
        cartRules: cfgDoc.cartRules ?? inMemoryState.storeConfig.cartRules,
        discountCampaigns:
          cfgDoc.discountCampaigns ??
          inMemoryState.storeConfig.discountCampaigns,
        customTaxonomy:
          cfgDoc.customTaxonomy ?? inMemoryState.storeConfig.customTaxonomy,
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
