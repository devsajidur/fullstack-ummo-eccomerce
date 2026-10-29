import crypto from "node:crypto";
import {
  CLOUDINARY_API_KEY,
  CLOUDINARY_CLOUD_NAME,
  DB_NAME,
  getCloudinarySecret,
  getFullState,
  getMongoDb,
  saveCloudMirrorState,
} from "./db.js";
import {
  asSafeEmail,
  asSafeId,
  canAccessUser,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_UID,
  parseJsonBody,
  resolveCaller,
  sendJson,
} from "./security.js";
import {
  deductOrderInventory,
  validateAndBuildServerOrder,
  validateCouponEligibility,
} from "./orderService.js";

const ALLOWED_ORDER_STATUSES = new Set([
  "PENDING",
  "PROCESSING",
  "SHIPPED",
  "DELIVERED",
  "CANCELLED",
]);

const ALLOWED_UPLOAD_FOLDERS = new Set([
  "ummo_products",
  "ummo_banners",
  "ummo_gifts",
]);

const ALLOWED_IMAGE_MIMES = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/webp",
  "image/gif",
  "image/avif",
]);

const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export default async function handler(req, res) {
  const method = (req.method || "GET").toUpperCase();
  if (method === "OPTIONS") {
    return sendJson(req, res, 200, { ok: true });
  }

  const urlObj = new URL(req.url || "/", "http://localhost");
  const path =
    urlObj.pathname.replace(/^\/api\/v1/, "").replace(/^\/api/, "") || "/";

  try {
    // 1. Health & Readiness Check (GET /health)
    if (path === "/health") {
      if (method !== "GET") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const db = await getMongoDb();
      return sendJson(req, res, 200, {
        status: "ok",
        ready: true,
        mongodbConnected: Boolean(db),
        database: `${DB_NAME} (MongoDB Atlas)`,
        cloudinaryCloudName: CLOUDINARY_CLOUD_NAME,
        firebaseAuthProject: "ummo-eccomerce",
      });
    }

    // 2. Server-Side Cloudinary Upload Signature (POST /cloudinary-sign)
    if (path === "/cloudinary-sign") {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        return sendJson(req, res, 400, { error: "Invalid request parameters" });
      }
      const { state } = await getFullState();
      const caller = resolveCaller(req, state);
      if (!caller.isAdmin) {
        return sendJson(req, res, 403, {
          error: "Admin authorization required to upload media assets.",
        });
      }

      const folder = asSafeId(body.folder || "ummo_products", 64);
      if (!ALLOWED_UPLOAD_FOLDERS.has(folder)) {
        return sendJson(req, res, 400, { error: "Disallowed upload folder." });
      }

      if (body.mimeType !== undefined) {
        const mime = String(body.mimeType || "").toLowerCase().trim();
        if (!ALLOWED_IMAGE_MIMES.has(mime)) {
          return sendJson(req, res, 400, {
            error: "Unsupported or unsafe image MIME type. SVG and executable files are prohibited.",
          });
        }
      }

      if (body.fileSize !== undefined) {
        const size = Number(body.fileSize);
        if (!Number.isFinite(size) || size <= 0 || size > MAX_UPLOAD_BYTES) {
          return sendJson(req, res, 400, {
            error: "File size exceeds maximum limit of 5MB.",
          });
        }
      }

      const timestamp = Math.floor(Date.now() / 1000);
      const customPublicId = asSafeId(body.publicId || "", 96).replace(
        /[^a-zA-Z0-9_-]/g,
        ""
      );
      const paramsToSign = {
        folder,
        timestamp: String(timestamp),
      };
      if (customPublicId) {
        paramsToSign.overwrite = "true";
        paramsToSign.public_id = customPublicId;
      }

      const sortedKeys = Object.keys(paramsToSign).sort();
      const stringToSign =
        sortedKeys.map((k) => `${k}=${paramsToSign[k]}`).join("&") +
        getCloudinarySecret();
      const signature = crypto
        .createHash("sha1")
        .update(stringToSign)
        .digest("hex");

      return sendJson(req, res, 200, {
        status: "ok",
        cloudName: CLOUDINARY_CLOUD_NAME,
        apiKey: CLOUDINARY_API_KEY,
        timestamp,
        folder,
        publicId: customPublicId || undefined,
        signature,
      });
    }

    // 3. Get Store Data with Strict Object-Level Authorization (GET /store-data)
    if (path === "/store-data") {
      if (method !== "GET") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { state, source } = await getFullState();
      const caller = resolveCaller(req, state);
      const requestedUid = asSafeId(urlObj.searchParams.get("userUid"), 128);
      const productId = asSafeId(urlObj.searchParams.get("productId"), 64);

      if (caller.isAdmin) {
        return sendJson(req, res, 200, {
          status: "ok",
          source,
          storeConfig: state.storeConfig,
          orders: requestedUid
            ? state.orders.filter(
                (o) => String(o.userUid || o.id) === requestedUid
              )
            : state.orders,
          users: state.users,
          addresses: requestedUid
            ? state.addresses[requestedUid] || []
            : state.addresses,
          reviews: productId ? state.reviews[productId] || [] : state.reviews,
          messages: state.messages,
          subscribers: state.subscribers,
        });
      }

      // Customer / Public scoped response (prevents IDOR & PII data leak)
      const effectiveUid =
        requestedUid && canAccessUser(caller, requestedUid)
          ? requestedUid
          : caller.uid || "";

      const scopedOrders = effectiveUid
        ? state.orders.filter(
            (o) =>
              String(o.userUid || o.id) === effectiveUid ||
              (caller.email &&
                String(o.email || "").toLowerCase() === caller.email)
          )
        : [];

      const scopedUsers = effectiveUid
        ? state.users.filter((u) => String(u.uid) === effectiveUid)
        : [];

      const scopedAddresses = effectiveUid
        ? state.addresses[effectiveUid] || []
        : [];

      return sendJson(req, res, 200, {
        status: "ok",
        source,
        storeConfig: state.storeConfig,
        orders: scopedOrders,
        users: scopedUsers,
        addresses: scopedAddresses,
        reviews: productId ? state.reviews[productId] || [] : state.reviews,
        messages: [],
        subscribers: [],
      });
    }

    // 4. Update Store Config — Admin Only (POST/PUT /store-config)
    if (path === "/store-config") {
      if (method !== "POST" && method !== "PUT") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        return sendJson(req, res, 400, {
          error: "Disallowed query operators in payload.",
        });
      }
      const { state } = await getFullState();
      const caller = resolveCaller(req, state);
      if (!caller.isAdmin) {
        return sendJson(req, res, 403, {
          error: "Admin authorization required to modify store configuration.",
        });
      }

      const updatedConfig = {
        ...state.storeConfig,
        ...(Array.isArray(body.coupons) ? { coupons: body.coupons } : {}),
        ...(body.banners && typeof body.banners === "object"
          ? { banners: body.banners }
          : {}),
        ...(Array.isArray(body.customProducts)
          ? { customProducts: body.customProducts }
          : {}),
        ...(Array.isArray(body.deletedIds)
          ? { deletedIds: body.deletedIds.map((id) => asSafeId(id, 64)).filter(Boolean) }
          : {}),
        ...(body.cartRules && typeof body.cartRules === "object"
          ? { cartRules: body.cartRules }
          : {}),
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

      return sendJson(req, res, 200, {
        status: "ok",
        storeConfig: updatedConfig,
      });
    }

    // 4b. Authoritative Coupon Verification (POST /coupons/validate)
    if (path === "/coupons/validate") {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        return sendJson(req, res, 400, {
          error: "Disallowed query operators in payload.",
        });
      }
      const { state } = await getFullState();
      const caller = resolveCaller(req, state);
      const subtotal = Math.max(0, Number(body.subtotal || 0));
      const eligibleAmount = Math.max(
        0,
        Number(body.eligibleAmount ?? subtotal)
      );
      const userUid = caller.uid || asSafeId(body.userUid, 128);
      const userEmail = asSafeEmail(body.email) || caller.email || "";
      const userPhone = asSafeId(body.phone, 40);

      const result = validateCouponEligibility({
        couponCode: body.couponCode || body.code,
        subtotal,
        eligibleAmount,
        state,
        userUid,
        userEmail,
        userPhone,
      });

      return sendJson(req, res, 200, {
        status: "ok",
        valid: result.valid,
        couponDiscount: result.couponDiscount,
        couponCode: result.validatedCouponCode,
        coupon: result.coupon,
      });
    }

    // 5. Create Order with Server-Side Price & Stock Validation (POST /orders)
    if (path === "/orders" || path === "/orders/checkout") {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        return sendJson(req, res, 400, {
          error: "Disallowed query operators in order payload.",
        });
      }
      const { state } = await getFullState();
      const caller = resolveCaller(req, state);
      const idempotencyKey = asSafeId(
        req.headers?.["idempotency-key"] || req.headers?.["Idempotency-Key"] || "",
        128
      );

      // Idempotency check to prevent duplicate checkout / replay
      if (idempotencyKey || body.orderId) {
        const existingOrder = state.orders.find(
          (o) =>
            (idempotencyKey && o.idempotencyKey === idempotencyKey) ||
            (body.orderId && String(o.orderId) === String(body.orderId))
        );
        if (existingOrder) {
          return sendJson(req, res, 200, {
            status: "ok",
            idempotentReplay: true,
            order: existingOrder,
          });
        }
      }

      const newOrder = validateAndBuildServerOrder(
        body,
        state,
        caller,
        idempotencyKey
      );

      deductOrderInventory(state, newOrder.OrderItems);
      state.orders = [
        newOrder,
        ...state.orders.filter(
          (o) => String(o.orderId) !== String(newOrder.orderId)
        ),
      ];

      const db = await getMongoDb();
      if (db) {
        await Promise.all([
          db
            .collection("orders")
            .updateOne(
              { orderId: newOrder.orderId },
              { $set: newOrder },
              { upsert: true }
            )
            .catch(() => {}),
          db
            .collection("store_config")
            .updateOne(
              { _id: "global" },
              { $set: state.storeConfig },
              { upsert: true }
            )
            .catch(() => {}),
        ]);
      }
      await saveCloudMirrorState(state);

      return sendJson(req, res, 201, {
        status: "ok",
        order: newOrder,
      });
    }

    // 6. Update Order Status with Ownership & Role Enforcement (PATCH/POST /orders/status)
    if (path === "/orders/status") {
      if (method !== "PATCH" && method !== "POST") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        return sendJson(req, res, 400, { error: "Invalid request parameters" });
      }
      const orderId = asSafeId(body.orderId, 64);
      const nextStatus = asSafeId(body.status, 32).toUpperCase();
      if (!orderId || !ALLOWED_ORDER_STATUSES.has(nextStatus)) {
        return sendJson(req, res, 400, {
          error: "Valid orderId and allowed status are required.",
        });
      }

      const { state } = await getFullState();
      const caller = resolveCaller(req, state);
      const targetOrder = state.orders.find(
        (o) => String(o.orderId || o.id) === orderId
      );

      if (!targetOrder) {
        return sendJson(req, res, 404, { error: "Order not found." });
      }

      if (!caller.isAdmin) {
        // Non-admin customers can ONLY cancel their own PENDING order
        if (!caller.uid || String(targetOrder.userUid) !== caller.uid) {
          return sendJson(req, res, 403, {
            error: "Forbidden: You cannot modify another customer's order.",
          });
        }
        if (nextStatus !== "CANCELLED") {
          return sendJson(req, res, 403, {
            error: "Forbidden: Only administrators can advance order fulfillment status.",
          });
        }
        if (
          targetOrder.status &&
          targetOrder.status !== "PENDING" &&
          targetOrder.status !== "CANCELLED"
        ) {
          return sendJson(req, res, 400, {
            error: "Order can no longer be cancelled once processing has started.",
          });
        }
      }

      const updatedAt = new Date().toISOString();
      state.orders = state.orders.map((o) =>
        String(o.orderId || o.id) === orderId
          ? { ...o, status: nextStatus, updatedAt }
          : o
      );

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("orders")
          .updateOne(
            { $or: [{ orderId }, { id: orderId }] },
            { $set: { status: nextStatus, updatedAt } }
          )
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(req, res, 200, {
        status: "ok",
        orderId,
        newStatus: nextStatus,
      });
    }

    // 7. Sync User Profile — Prevents Privilege Escalation (POST /users)
    if (path === "/users") {
      if (method !== "POST") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        return sendJson(req, res, 400, { error: "Invalid user parameters" });
      }
      const uid = asSafeId(body.uid, 128);
      if (!uid) {
        return sendJson(req, res, 400, { error: "Valid string uid is required" });
      }

      const { state } = await getFullState();
      const caller = resolveCaller(req, state);
      const existing = state.users.find((u) => String(u.uid) === uid);

      // Prevent horizontal account takeover when an existing user record belongs to someone else
      if (existing && caller.uid && caller.uid !== uid && !caller.isAdmin) {
        return sendJson(req, res, 403, {
          error: "Forbidden: Cannot overwrite another user's profile.",
        });
      }

      // Vertical Privilege Escalation Protection:
      // Only a verified Admin or the Master Admin account can hold role="ADMIN"
      const isMasterAccount =
        uid === MASTER_ADMIN_UID &&
        asSafeEmail(body.email) === MASTER_ADMIN_EMAIL &&
        caller.isAdmin;

      const authoritativeRole =
        caller.isAdmin && (body.role === "ADMIN" || isMasterAccount)
          ? "ADMIN"
          : existing?.role === "ADMIN"
            ? "ADMIN"
            : "CUSTOMER";

      const userDoc = {
        uid,
        email: asSafeEmail(body.email) || existing?.email || "",
        username: asSafeId(body.username || body.displayName || existing?.username || "Customer", 100),
        displayName: asSafeId(body.displayName || body.username || existing?.displayName || "Customer", 100),
        phone: asSafeId(body.phone ?? existing?.phone ?? "", 40),
        bio: asSafeId(body.bio ?? existing?.bio ?? "", 400),
        profile_picture: asSafeId(body.profile_picture ?? existing?.profile_picture ?? "", 300),
        role: authoritativeRole,
        updatedAt: new Date().toISOString(),
      };

      state.users = [
        userDoc,
        ...state.users.filter((u) => String(u.uid) !== uid),
      ];

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("users")
          .updateOne({ uid }, { $set: userDoc }, { upsert: true })
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(req, res, 200, { status: "ok", user: userDoc });
    }

    // 8. Toggle User Role — Admin Only (PATCH/POST /users/role)
    if (path === "/users/role") {
      if (method !== "PATCH" && method !== "POST") {
        return sendJson(req, res, 405, { error: "Method not allowed" });
      }
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        return sendJson(req, res, 400, { error: "Invalid request parameters" });
      }
      const { state } = await getFullState();
      const caller = resolveCaller(req, state);
      if (!caller.isAdmin) {
        return sendJson(req, res, 403, {
          error: "Forbidden: Admin privileges required to change user roles.",
        });
      }

      const uid = asSafeId(body.uid, 128);
      const role = asSafeId(body.role, 32).toUpperCase();
      if (!uid || !["ADMIN", "CUSTOMER"].includes(role)) {
        return sendJson(req, res, 400, {
          error: "Valid uid and role (ADMIN or CUSTOMER) are required.",
        });
      }

      const existingUser = state.users.find((u) => String(u.uid) === uid);
      const updatedUserDoc = {
        uid,
        email: asSafeEmail(body.email) || existingUser?.email || "",
        username: asSafeId(
          body.username || existingUser?.username || "Customer",
          100
        ),
        role,
        updatedAt: new Date().toISOString(),
      };

      state.users = [
        { ...(existingUser || {}), ...updatedUserDoc },
        ...state.users.filter((u) => String(u.uid) !== uid),
      ];

      const db = await getMongoDb();
      if (db) {
        await db
          .collection("users")
          .updateOne({ uid }, { $set: updatedUserDoc }, { upsert: true })
          .catch(() => {});
      }
      await saveCloudMirrorState(state);

      return sendJson(req, res, 200, { status: "ok", uid, role });
    }

    // 9. Customer Addresses — Ownership Enforced (GET/POST /addresses)
    if (path === "/addresses") {
      const { state } = await getFullState();
      const caller = resolveCaller(req, state);

      if (method === "GET") {
        const userUid = asSafeId(urlObj.searchParams.get("userUid"), 128);
        if (!userUid) {
          return sendJson(req, res, 400, { error: "userUid parameter is required." });
        }
        if (!canAccessUser(caller, userUid)) {
          return sendJson(req, res, 403, {
            error: "Forbidden: Cannot access another customer's address book.",
          });
        }
        return sendJson(req, res, 200, {
          status: "ok",
          addresses: state.addresses[userUid] || [],
        });
      }

      if (method === "POST") {
        const { sanitized: body, hadOperator } = await parseJsonBody(req);
        if (hadOperator) {
          return sendJson(req, res, 400, { error: "Invalid address payload." });
        }
        const userUid = asSafeId(body.userUid, 128);
        if (!userUid) {
          return sendJson(req, res, 400, { error: "Valid userUid is required." });
        }
        if (!canAccessUser(caller, userUid)) {
          return sendJson(req, res, 403, {
            error: "Forbidden: Cannot modify another customer's address book.",
          });
        }
        const safeList = Array.isArray(body.addresses)
          ? body.addresses.slice(0, 20)
          : [];
        state.addresses[userUid] = safeList;

        const db = await getMongoDb();
        if (db) {
          await db
            .collection("addresses")
            .updateOne(
              { userUid },
              { $set: { userUid, items: safeList } },
              { upsert: true }
            )
            .catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(req, res, 200, {
          status: "ok",
          addresses: safeList,
        });
      }

      return sendJson(req, res, 405, { error: "Method not allowed" });
    }

    // 10. Product Reviews (GET/POST /reviews)
    if (path === "/reviews") {
      const { state } = await getFullState();
      if (method === "GET") {
        const productId = asSafeId(urlObj.searchParams.get("productId"), 64);
        return sendJson(req, res, 200, {
          status: "ok",
          reviews: productId ? state.reviews[productId] || [] : state.reviews,
        });
      }
      if (method === "POST") {
        const { sanitized: body, hadOperator } = await parseJsonBody(req);
        if (hadOperator) {
          return sendJson(req, res, 400, { error: "Invalid review payload." });
        }
        const productId = asSafeId(body.productId, 64);
        const rev = body.review;
        if (!productId || !rev || typeof rev !== "object") {
          return sendJson(req, res, 400, {
            error: "Valid productId and review object are required.",
          });
        }
        const rating = Number(rev.rating);
        if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
          return sendJson(req, res, 400, {
            error: "Rating must be between 1 and 5.",
          });
        }
        const cleanReview = {
          id: asSafeId(rev.id || `REV-${Date.now()}`, 64),
          reviewerName: asSafeId(rev.reviewerName || "Customer", 80),
          rating: Math.round(rating),
          comment: asSafeId(rev.comment, 1000),
          date: new Date().toISOString(),
        };
        if (!cleanReview.comment) {
          return sendJson(req, res, 400, { error: "Review comment is required." });
        }

        const current = state.reviews[productId] || [];
        const updated = [cleanReview, ...current].slice(0, 100);
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
        return sendJson(req, res, 201, { status: "ok", reviews: updated });
      }
      return sendJson(req, res, 405, { error: "Method not allowed" });
    }

    // 11. Contact Messages (POST / DELETE /messages)
    if (path === "/messages") {
      const { state } = await getFullState();
      if (method === "POST") {
        const { sanitized: body, hadOperator } = await parseJsonBody(req);
        if (hadOperator) {
          return sendJson(req, res, 400, { error: "Invalid message payload." });
        }
        const name = asSafeId(body.name, 100);
        const email = asSafeEmail(body.email);
        const message = asSafeId(body.message, 2000);
        if (!name || !email || !message) {
          return sendJson(req, res, 400, {
            error: "Valid name, email, and message are required.",
          });
        }
        const msg = {
          id: asSafeId(body.id || `MSG-${Date.now()}`, 64),
          name,
          email,
          message,
          createdAt: new Date().toISOString(),
        };
        state.messages = [msg, ...state.messages].slice(0, 200);
        const db = await getMongoDb();
        if (db) {
          await db.collection("messages").insertOne(msg).catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(req, res, 201, { status: "ok", message: msg });
      }
      if (method === "DELETE") {
        const caller = resolveCaller(req, state);
        if (!caller.isAdmin) {
          return sendJson(req, res, 403, {
            error: "Forbidden: Admin privileges required to delete messages.",
          });
        }
        const id = asSafeId(urlObj.searchParams.get("id"), 64);
        if (!id) {
          return sendJson(req, res, 400, { error: "Valid message id is required." });
        }
        state.messages = state.messages.filter((m) => String(m.id) !== id);
        const db = await getMongoDb();
        if (db) {
          await db.collection("messages").deleteOne({ id }).catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(req, res, 200, { status: "ok" });
      }
      return sendJson(req, res, 405, { error: "Method not allowed" });
    }

    // 12. Newsletter Subscribers (POST / DELETE /subscribers)
    if (path === "/subscribers") {
      const { state } = await getFullState();
      if (method === "POST") {
        const { sanitized: body, hadOperator } = await parseJsonBody(req);
        if (hadOperator) {
          return sendJson(req, res, 400, { error: "Invalid subscriber payload." });
        }
        const email = asSafeEmail(body.email);
        if (!email) {
          return sendJson(req, res, 400, {
            error: "A valid email address is required.",
          });
        }
        const nowIso = new Date().toISOString();
        const sub = {
          id: asSafeId(body.id || `SUB-${Date.now()}`, 64),
          email,
          createdAt: nowIso,
          subscribedAt: nowIso,
        };
        state.subscribers = [
          sub,
          ...state.subscribers.filter((s) => s.email !== sub.email),
        ].slice(0, 500);
        const db = await getMongoDb();
        if (db) {
          await db
            .collection("subscribers")
            .updateOne({ email: sub.email }, { $set: sub }, { upsert: true })
            .catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(req, res, 201, { status: "ok", subscriber: sub });
      }
      if (method === "DELETE") {
        const caller = resolveCaller(req, state);
        if (!caller.isAdmin) {
          return sendJson(req, res, 403, {
            error: "Forbidden: Admin privileges required to delete subscribers.",
          });
        }
        const id = asSafeId(urlObj.searchParams.get("id"), 64);
        if (!id) {
          return sendJson(req, res, 400, {
            error: "Valid subscriber id is required.",
          });
        }
        state.subscribers = state.subscribers.filter((s) => String(s.id) !== id);
        const db = await getMongoDb();
        if (db) {
          await db.collection("subscribers").deleteOne({ id }).catch(() => {});
        }
        await saveCloudMirrorState(state);
        return sendJson(req, res, 200, { status: "ok" });
      }
      return sendJson(req, res, 405, { error: "Method not allowed" });
    }

    return sendJson(req, res, 404, { error: `API endpoint not found: ${path}` });
  } catch (err) {
    const statusCode =
      err?.statusCode && err.statusCode >= 400 && err.statusCode < 600
        ? err.statusCode
        : 500;
    const safeMessage =
      statusCode < 500
        ? err.message
        : "An internal server error occurred. Please try again.";
    return sendJson(req, res, statusCode, {
      error: safeMessage,
    });
  }
}
