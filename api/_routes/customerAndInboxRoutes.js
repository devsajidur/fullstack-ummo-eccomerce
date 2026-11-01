import {
  getFullState,
  getMongoDb,
  saveCloudMirrorState,
} from "../db.js";
import {
  asSafeEmail,
  asSafeId,
  canAccessUser,
  MASTER_ADMIN_EMAIL,
  MASTER_ADMIN_UID,
  parseJsonBody,
  resolveCaller,
  sendJson,
} from "../security.js";

export async function handleCustomerAndInboxRoutes({
  req,
  res,
  method,
  path,
  urlObj,
}) {
  if (path === "/users") {
    if (method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid user parameters" });
      return true;
    }
    const uid = asSafeId(body.uid, 128);
    if (!uid) {
      sendJson(req, res, 400, { error: "Valid string uid is required" });
      return true;
    }

    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    const existing = state.users.find((u) => String(u.uid) === uid);

    if (existing && caller.uid && caller.uid !== uid && !caller.isAdmin) {
      sendJson(req, res, 403, {
        error: "Forbidden: Cannot overwrite another user's profile.",
      });
      return true;
    }

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
      username: asSafeId(
        body.username || body.displayName || existing?.username || "Customer",
        100
      ),
      displayName: asSafeId(
        body.displayName ||
          body.username ||
          existing?.displayName ||
          "Customer",
        100
      ),
      phone: asSafeId(body.phone ?? existing?.phone ?? "", 40),
      bio: asSafeId(body.bio ?? existing?.bio ?? "", 400),
      profile_picture: asSafeId(
        body.profile_picture ?? existing?.profile_picture ?? "",
        300
      ),
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

    sendJson(req, res, 200, { status: "ok", user: userDoc });
    return true;
  }

  if (path === "/users/role") {
    if (method !== "PATCH" && method !== "POST") {
      sendJson(req, res, 405, { error: "Method not allowed" });
      return true;
    }
    const { sanitized: body, hadOperator } = await parseJsonBody(req);
    if (hadOperator) {
      sendJson(req, res, 400, { error: "Invalid request parameters" });
      return true;
    }
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);
    if (!caller.isAdmin) {
      sendJson(req, res, 403, {
        error: "Forbidden: Admin privileges required to change user roles.",
      });
      return true;
    }

    const uid = asSafeId(body.uid, 128);
    const role = asSafeId(body.role, 32).toUpperCase();
    if (!uid || !["ADMIN", "CUSTOMER"].includes(role)) {
      sendJson(req, res, 400, {
        error: "Valid uid and role (ADMIN or CUSTOMER) are required.",
      });
      return true;
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

    sendJson(req, res, 200, { status: "ok", uid, role });
    return true;
  }

  if (path === "/addresses") {
    const { state } = await getFullState();
    const caller = resolveCaller(req, state);

    if (method === "GET") {
      const userUid = asSafeId(urlObj.searchParams.get("userUid"), 128);
      if (!userUid) {
        sendJson(req, res, 400, { error: "userUid parameter is required." });
        return true;
      }
      if (!canAccessUser(caller, userUid)) {
        sendJson(req, res, 403, {
          error: "Forbidden: Cannot access another customer's address book.",
        });
        return true;
      }
      sendJson(req, res, 200, {
        status: "ok",
        addresses: state.addresses[userUid] || [],
      });
      return true;
    }

    if (method === "POST") {
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        sendJson(req, res, 400, { error: "Invalid address payload." });
        return true;
      }
      const userUid = asSafeId(body.userUid, 128);
      if (!userUid) {
        sendJson(req, res, 400, { error: "Valid userUid is required." });
        return true;
      }
      if (!canAccessUser(caller, userUid)) {
        sendJson(req, res, 403, {
          error: "Forbidden: Cannot modify another customer's address book.",
        });
        return true;
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
      sendJson(req, res, 200, {
        status: "ok",
        addresses: safeList,
      });
      return true;
    }

    sendJson(req, res, 405, { error: "Method not allowed" });
    return true;
  }

  if (path === "/reviews") {
    const { state } = await getFullState();
    if (method === "GET") {
      const productId = asSafeId(urlObj.searchParams.get("productId"), 64);
      sendJson(req, res, 200, {
        status: "ok",
        reviews: productId ? state.reviews[productId] || [] : state.reviews,
      });
      return true;
    }
    if (method === "POST") {
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        sendJson(req, res, 400, { error: "Invalid review payload." });
        return true;
      }
      const productId = asSafeId(body.productId, 64);
      const rev = body.review;
      if (!productId || !rev || typeof rev !== "object") {
        sendJson(req, res, 400, {
          error: "Valid productId and review object are required.",
        });
        return true;
      }
      const rating = Number(rev.rating);
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        sendJson(req, res, 400, {
          error: "Rating must be between 1 and 5.",
        });
        return true;
      }
      const cleanReview = {
        id: asSafeId(rev.id || `REV-${Date.now()}`, 64),
        reviewerName: asSafeId(rev.reviewerName || "Customer", 80),
        rating: Math.round(rating),
        comment: asSafeId(rev.comment, 1000),
        date: new Date().toISOString(),
      };
      if (!cleanReview.comment) {
        sendJson(req, res, 400, { error: "Review comment is required." });
        return true;
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
      sendJson(req, res, 201, { status: "ok", reviews: updated });
      return true;
    }
    sendJson(req, res, 405, { error: "Method not allowed" });
    return true;
  }

  if (path === "/messages") {
    const { state } = await getFullState();
    if (method === "POST") {
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        sendJson(req, res, 400, { error: "Invalid message payload." });
        return true;
      }
      const name = asSafeId(body.name, 100);
      const email = asSafeEmail(body.email);
      const message = asSafeId(body.message, 2000);
      if (!name || !email || !message) {
        sendJson(req, res, 400, {
          error: "Valid name, email, and message are required.",
        });
        return true;
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
      sendJson(req, res, 201, { status: "ok", message: msg });
      return true;
    }
    if (method === "DELETE") {
      const caller = resolveCaller(req, state);
      if (!caller.isAdmin) {
        sendJson(req, res, 403, {
          error: "Forbidden: Admin privileges required to delete messages.",
        });
        return true;
      }
      const id = asSafeId(urlObj.searchParams.get("id"), 64);
      if (!id) {
        sendJson(req, res, 400, { error: "Valid message id is required." });
        return true;
      }
      state.messages = state.messages.filter((m) => String(m.id) !== id);
      const db = await getMongoDb();
      if (db) {
        await db.collection("messages").deleteOne({ id }).catch(() => {});
      }
      await saveCloudMirrorState(state);
      sendJson(req, res, 200, { status: "ok" });
      return true;
    }
    sendJson(req, res, 405, { error: "Method not allowed" });
    return true;
  }

  if (path === "/subscribers") {
    const { state } = await getFullState();
    if (method === "POST") {
      const { sanitized: body, hadOperator } = await parseJsonBody(req);
      if (hadOperator) {
        sendJson(req, res, 400, { error: "Invalid subscriber payload." });
        return true;
      }
      const email = asSafeEmail(body.email);
      if (!email) {
        sendJson(req, res, 400, {
          error: "A valid email address is required.",
        });
        return true;
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
      sendJson(req, res, 201, { status: "ok", subscriber: sub });
      return true;
    }
    if (method === "DELETE") {
      const caller = resolveCaller(req, state);
      if (!caller.isAdmin) {
        sendJson(req, res, 403, {
          error: "Forbidden: Admin privileges required to delete subscribers.",
        });
        return true;
      }
      const id = asSafeId(urlObj.searchParams.get("id"), 64);
      if (!id) {
        sendJson(req, res, 400, {
          error: "Valid subscriber id is required.",
        });
        return true;
      }
      state.subscribers = state.subscribers.filter((s) => String(s.id) !== id);
      const db = await getMongoDb();
      if (db) {
        await db.collection("subscribers").deleteOne({ id }).catch(() => {});
      }
      await saveCloudMirrorState(state);
      sendJson(req, res, 200, { status: "ok" });
      return true;
    }
    sendJson(req, res, 405, { error: "Method not allowed" });
    return true;
  }

  return false;
}
