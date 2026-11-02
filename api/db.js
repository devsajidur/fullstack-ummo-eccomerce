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

const URI_PREFIX_RE = /^(?:MONGODB_URI(?:_FALLBACK)?|MONGO_URI|MONGODB_URL)\s*=\s*/i;

export function inspectRawMongoUriAnomaly(raw) {
  const str = String(raw || "").trim();
  if (!str) {
    return {
      rawWriteConcernCorrupted: false,
      corruptionReason: null,
      autoNormalized: false,
    };
  }
  const hasEscapedNewline = /(?:\\[rn])+\s*$/.test(str) || /^\s*(?:\\[rn])+/.test(str);
  const strippedPrefix = str.replace(URI_PREFIX_RE, "").trim();
  const hasUnmatchedQuoteOrSemi =
    /[;"'`]\s*$/.test(strippedPrefix) &&
    !(
      (strippedPrefix.startsWith('"') && strippedPrefix.endsWith('"')) ||
      (strippedPrefix.startsWith("'") && strippedPrefix.endsWith("'")) ||
      (strippedPrefix.startsWith("`") && strippedPrefix.endsWith("`"))
    );

  const qIdx = strippedPrefix.indexOf("?");
  let hasPathAfterQuery = false;
  let invalidWriteConcern = false;
  if (qIdx !== -1) {
    const queryPart = strippedPrefix.slice(qIdx + 1);
    if (/\/[^&]*$/.test(queryPart)) {
      hasPathAfterQuery = true;
    }
    const params = queryPart.split("&");
    for (const param of params) {
      const eqIdx = param.indexOf("=");
      if (eqIdx === -1) continue;
      const key = param.slice(0, eqIdx).trim().toLowerCase();
      const val = param.slice(eqIdx + 1);
      if (key === "w") {
        if (val !== "majority" && !/^\d+$/.test(val)) {
          invalidWriteConcern = true;
        }
      }
    }
  }

  let corruptionReason = null;
  if (hasEscapedNewline) corruptionReason = "LITERAL_ESCAPED_NEWLINE";
  else if (hasPathAfterQuery) corruptionReason = "PATH_AFTER_QUERY";
  else if (hasUnmatchedQuoteOrSemi) corruptionReason = "TRAILING_QUOTE_OR_SEMICOLON";
  else if (invalidWriteConcern) corruptionReason = "INVALID_WRITE_CONCERN_VALUE";

  return {
    rawWriteConcernCorrupted: Boolean(invalidWriteConcern || (qIdx !== -1 && corruptionReason)),
    corruptionReason,
    autoNormalized: Boolean(corruptionReason),
  };
}

export function getMongoUriDiagnostic() {
  const candidates = [
    process.env.MONGODB_URI,
    process.env.MONGODB_URI_FALLBACK,
    process.env.MONGO_URI,
    process.env.MONGODB_URL,
  ].filter((v) => String(v || "").trim().length > 0);
  if (!candidates.length) {
    return {
      rawWriteConcernCorrupted: false,
      corruptionReason: null,
      autoNormalized: false,
    };
  }
  return inspectRawMongoUriAnomaly(candidates[0]);
}

export function normalizeMongoUri(raw) {
  let s = String(raw || "").trim();
  if (!s) return "";
  s = s.replace(/^(?:\\[rn])+|(?:\\[rn])+$/g, "").trim();
  s = s.replace(URI_PREFIX_RE, "").trim();
  while (
    s.length >= 2 &&
    ((s.startsWith('"') && s.endsWith('"')) ||
      (s.startsWith("'") && s.endsWith("'")) ||
      (s.startsWith("`") && s.endsWith("`")))
  ) {
    s = s.slice(1, -1).trim();
  }
  s = s.replace(/^(?:\\[rn])+|(?:\\[rn])+$/g, "").trim();
  s = s.replace(/^[`"']+|[`"';]+$/g, "").trim();

  const schemeMatch = s.match(/^(mongodb(?:\+srv)?:\/\/)(.*)$/i);
  if (schemeMatch) {
    const scheme = schemeMatch[1];
    const rest = schemeMatch[2];
    const slashIdx = rest.indexOf("/");
    const authority = slashIdx === -1 ? rest : rest.slice(0, slashIdx);
    let tail = slashIdx === -1 ? "" : rest.slice(slashIdx);
    const lastAt = authority.lastIndexOf("@");
    const firstAt = authority.indexOf("@");
    const normalizedAuthority =
      firstAt !== -1 && firstAt !== lastAt
        ? `${authority.slice(0, lastAt).replace(/@/g, "%40")}@${authority.slice(lastAt + 1)}`
        : authority;

    const qIdx = tail.indexOf("?");
    if (qIdx !== -1) {
      const pathPart = tail.slice(0, qIdx);
      let queryStr = tail.slice(qIdx + 1);
      queryStr = queryStr.replace(/^(?:\\[rn])+|(?:\\[rn])+$/g, "").trim();
      queryStr = queryStr.replace(/[`"';]+$/g, "").trim();
      const cleanedParams = queryStr
        .split("&")
        .map((pair) => {
          const eqIdx = pair.indexOf("=");
          if (eqIdx === -1) return pair.trim();
          const k = pair.slice(0, eqIdx).trim();
          let v = pair
            .slice(eqIdx + 1)
            .replace(/(?:\\[rn])+$/g, "")
            .replace(/[`"';]+$/g, "")
            .trim();
          if (k.toLowerCase() === "w") {
            v = v.replace(/\/.*$/, "").trim();
            if (v !== "majority" && !/^\d+$/.test(v)) {
              v = "majority";
            }
          } else if (
            ["retrywrites", "retryreads", "appname", "authsource"].includes(
              k.toLowerCase()
            )
          ) {
            v = v.replace(/\/.*$/, "").trim();
          }
          return `${k}=${v}`;
        })
        .filter(Boolean);
      tail = `${pathPart}?${cleanedParams.join("&")}`;
    }

    s = `${scheme}${normalizedAuthority}${tail}`;
  }
  return s;
}

export function isMongoConfigured() {
  return getMongoUris().length > 0;
}

export function getMongoUris() {
  const uris = [
    process.env.MONGODB_URI,
    process.env.MONGODB_URI_FALLBACK,
    process.env.MONGO_URI,
    process.env.MONGODB_URL,
  ]
    .map(normalizeMongoUri)
    .filter(Boolean);
  return [...new Set(uris)];
}

export function classifyMongoConnectError(err) {
  const name = String(err?.name || "Error").slice(0, 64);
  const code =
    typeof err?.code === "number" || typeof err?.code === "string"
      ? String(err.code).slice(0, 40)
      : null;
  const msg = String(err?.message || "");
  let category = "CONNECTION_ERROR";
  if (
    name === "MongoParseError" ||
    /invalid scheme|uri malformed|connection string|unescaped/i.test(msg)
  ) {
    category = "INVALID_URI_FORMAT";
  } else if (
    code === "18" ||
    code === "8000" ||
    /bad auth|authentication failed|auth failed|not authorized/i.test(msg)
  ) {
    category = "AUTH_FAILED";
  } else if (
    /ENOTFOUND|EREFUSED|ECONNREFUSED|querySrv|getaddrinfo|ESERVFAIL/i.test(
      `${code || ""} ${msg}`
    )
  ) {
    category = "DNS_LOOKUP_FAILED";
  } else if (/ERR_SSL|tlsv1|ssl|certificate/i.test(`${code || ""} ${msg}`)) {
    category = "TLS_HANDSHAKE_FAILED";
  } else if (
    name === "MongoServerSelectionError" ||
    name === "MongoNetworkTimeoutError" ||
    /Could not connect to any servers|ReplicaSetNoPrimary|timed out|ETIMEDOUT/i.test(
      `${code || ""} ${msg}`
    )
  ) {
    category = "NETWORK_OR_IP_ALLOWLIST_BLOCKED";
  }
  return { category, errorName: name, code };
}

let cachedMongoClient = null;
let cachedDb = null;
let inFlightConnectPromise = null;
let lastFailedAttemptMs = 0;
let lastMongoDiagnostic = null;
let lastWriteDiagnostic = null;
let forceDisconnectedForTest = false;
let mockMongoDbForTest = null;
const RETRY_COOLDOWN_MS = 2000;

export function getLastMongoDiagnostic() {
  return forceDisconnectedForTest
    ? { category: "TEST_DISCONNECTED", errorName: "TestDisconnect", code: null }
    : lastMongoDiagnostic;
}

export function getLastWriteDiagnostic() {
  return lastWriteDiagnostic;
}

export function clearLastWriteDiagnostic() {
  lastWriteDiagnostic = null;
}

export function setMongoDisconnectedForTest(disconnected) {
  forceDisconnectedForTest = Boolean(disconnected);
}

export function setMockMongoDbForTest(mockDb) {
  mockMongoDbForTest = mockDb || null;
  inMemoryState = createInitialMemoryState();
  lastMongoSyncMs = 0;
}

export function stripMongoImmutableId(doc) {
  if (!doc || typeof doc !== "object" || Array.isArray(doc)) {
    return doc;
  }
  const copy = { ...doc };
  delete copy._id;
  return copy;
}

export function classifyMongoWriteError(err, meta = {}) {
  const wcErr =
    err?.writeConcernError && typeof err.writeConcernError === "object"
      ? err.writeConcernError
      : null;
  const errorName = String(
    err?.name || (wcErr ? "MongoWriteConcernError" : "Error")
  ).slice(0, 64);
  const rawCode = wcErr?.code ?? err?.code;
  const parsedNum = Number(rawCode);
  const code =
    typeof rawCode === "number"
      ? rawCode
      : rawCode !== null && rawCode !== undefined && rawCode !== "" && Number.isFinite(parsedNum)
        ? parsedNum
        : null;
  const codeName =
    String(wcErr?.codeName || err?.codeName || "")
      .trim()
      .slice(0, 64) || null;
  const collection = String(
    err?.__ummoCollection || meta?.collection || "unknown"
  ).slice(0, 64);
  const operation = String(
    err?.__ummoOperation || meta?.operation || "write"
  ).slice(0, 64);
  const hint = `${errorName} ${codeName || ""} ${String(wcErr?.errmsg || err?.message || "")}`;

  let category = "WRITE_ERROR";
  if (
    code === 13 ||
    code === 18 ||
    code === 8000 ||
    /Unauthorized|not authorized|auth failed/i.test(hint)
  ) {
    category = "AUTHORIZATION";
  } else if (
    code === 121 ||
    /DocumentValidationFailure|Document failed validation/i.test(hint)
  ) {
    category = "VALIDATION";
  } else if (
    code === 11000 ||
    code === 11001 ||
    /DuplicateKey|E11000/i.test(hint)
  ) {
    category = "DUPLICATE_KEY";
  } else if (
    code === 66 ||
    /ImmutableField|immutable field '_id'/i.test(hint)
  ) {
    category = "IMMUTABLE_FIELD";
  } else if (
    errorName === "MongoWriteConcernError" ||
    Boolean(wcErr) ||
    code === 79 ||
    code === 100 ||
    /UnknownReplWriteConcern|UnsatisfiableWriteConcern|write concern/i.test(hint)
  ) {
    category = "WRITE_CONCERN";
  } else if (
    code === 112 ||
    code === 251 ||
    /WriteConflict|NoSuchTransaction|TransientTransactionError/i.test(hint)
  ) {
    category = "TRANSACTION_CONFLICT";
  }

  return {
    errorName,
    code,
    codeName,
    collection,
    operation,
    category,
  };
}

export async function runTrackedMongoOp(collection, operation, fn) {
  try {
    return await fn();
  } catch (err) {
    if (err && typeof err === "object") {
      if (!err.__ummoCollection) err.__ummoCollection = collection;
      if (!err.__ummoOperation) err.__ummoOperation = operation;
    }
    throw err;
  }
}

const FULL_WRITE_ROLES_ADMIN_DB = new Set([
  "atlasAdmin",
  "readWriteAnyDatabase",
  "dbAdminAnyDatabase",
  "atlasDataAccessReadWrite",
  "atlasDataAccessReadWriteWithIndex",
  "atlasDataAccessAdmin",
  "root",
]);

const READ_ROLES_ADMIN_DB = new Set([
  "readAnyDatabase",
  "atlasDataAccessReadOnly",
  "atlasDataAccessReadOnlyWithIndex",
  "clusterMonitor",
]);

export async function inspectMongoWritePermissions(
  db,
  collections = ["orders", "store_config"]
) {
  if (!db || typeof db.command !== "function") {
    return null;
  }
  try {
    const res = await db.command({ connectionStatus: 1, showPrivileges: true });
    const roles = Array.isArray(res?.authInfo?.authenticatedUserRoles)
      ? res.authInfo.authenticatedUserRoles.map((r) => ({
          role: String(r?.role || ""),
          db: String(r?.db || ""),
        }))
      : [];
    const privs = Array.isArray(res?.authInfo?.authenticatedUserPrivileges)
      ? res.authInfo.authenticatedUserPrivileges
      : [];

    const hasGlobalReadWriteRole = roles.some(
      (r) =>
        (r.db === "admin" && FULL_WRITE_ROLES_ADMIN_DB.has(r.role)) ||
        (r.db === DB_NAME && (r.role === "readWrite" || r.role === "dbOwner"))
    );
    const hasGlobalReadRole =
      hasGlobalReadWriteRole ||
      roles.some(
        (r) =>
          (r.db === "admin" && READ_ROLES_ADMIN_DB.has(r.role)) ||
          (r.db === DB_NAME && r.role === "read")
      );

    const permissionsByCollection = {};
    for (const col of collections) {
      let canFind = hasGlobalReadRole;
      let canInsert = hasGlobalReadWriteRole;
      let canUpdate = hasGlobalReadWriteRole;

      for (const p of privs) {
        const resObj = p?.resource || {};
        const dbMatch = resObj.db === "" || resObj.db === DB_NAME;
        const colMatch = resObj.collection === "" || resObj.collection === col;
        if (!dbMatch || !colMatch) continue;
        const actions = Array.isArray(p?.actions) ? p.actions : [];
        if (actions.includes("find")) canFind = true;
        if (actions.includes("insert")) canInsert = true;
        if (actions.includes("update")) canUpdate = true;
      }

      permissionsByCollection[col] = {
        find: Boolean(canFind),
        insert: Boolean(canInsert),
        update: Boolean(canUpdate),
        upsert: Boolean(canInsert && canUpdate),
      };
    }

    const allWritable = collections.every(
      (c) => permissionsByCollection[c]?.upsert
    );

    return {
      roles,
      collections: permissionsByCollection,
      allOrderCollectionsWritable: allWritable,
      requiredRoleCorrection: allWritable
        ? null
        : `Grant Atlas Built-in Role 'readWrite' on database '${DB_NAME}' (readWrite@${DB_NAME})`,
    };
  } catch {
    return null;
  }
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
  if (mockMongoDbForTest) {
    return mockMongoDbForTest;
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
  const timeoutMs = options.timeoutMs || 8000;

  inFlightConnectPromise = (async () => {
    if (!uris.length) {
      lastMongoDiagnostic = {
        category: "URI_NOT_CONFIGURED",
        errorName: "MissingEnv",
        code: null,
      };
      lastFailedAttemptMs = Date.now();
      return null;
    }
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
        lastMongoDiagnostic = null;
        return cachedDb;
      } catch (err) {
        lastMongoDiagnostic = classifyMongoConnectError(err);
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
  const db = await getMongoDb({ forceRetry: true });
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
export async function commitDurableMongoWrite(writeFn, meta = {}) {
  const db = await requireDurableMongoDb();
  try {
    const out = await writeFn(db);
    lastWriteDiagnostic = null;
    return out;
  } catch (err) {
    inMemoryState.hydrated = false;
    lastMongoSyncMs = 0;
    if (err?.statusCode) {
      throw err;
    }
    const diagnostic = classifyMongoWriteError(err, meta);
    lastWriteDiagnostic = {
      ...diagnostic,
      occurredAt: new Date().toISOString(),
    };
    console.error("[UMMO_DB_WRITE_FAILED]", JSON.stringify(diagnostic));
    const writeErr = new Error(
      "Durable database write failed on MongoDB Atlas. Changes were not saved."
    );
    writeErr.statusCode = 503;
    writeErr.exposeMessage = true;
    writeErr.code = "DB_WRITE_FAILED";
    writeErr.diagnostic = diagnostic;
    throw writeErr;
  }
}

/**
 * Executes multi-collection MongoDB writes inside a causal ACID replica-set transaction
 * when sessions are supported, preventing partial writes across collections.
 */
export async function commitAtomicMongoTransaction(txFn, meta = {}) {
  return commitDurableMongoWrite(async (db) => {
    if (typeof db?.client?.startSession !== "function") {
      return await txFn(db, null);
    }
    const session = db.client.startSession();
    try {
      let result;
      await session.withTransaction(async () => {
        result = await txFn(db, session);
      });
      return result;
    } catch (txErr) {
      const msg = String(txErr?.message || "");
      if (
        txErr?.code === 20 ||
        /Transaction numbers are only allowed on a replica set member or mongos/i.test(
          msg
        )
      ) {
        return await txFn(db, null);
      }
      throw txErr;
    } finally {
      await session.endSession().catch(() => {});
    }
  }, meta);
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
