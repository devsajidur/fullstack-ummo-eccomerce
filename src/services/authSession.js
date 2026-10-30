import {
  loginAdminWithServer,
  logoutAdminWithServer,
  syncUserToMongo,
} from "./api";

let cachedFirebaseModule = null;
async function loadFirebaseAuth() {
  if (cachedFirebaseModule) return cachedFirebaseModule;
  const [fbAuth, fbConfig] = await Promise.all([
    import("firebase/auth"),
    import("../../firebase.config"),
  ]);
  cachedFirebaseModule = {
    auth: fbConfig.auth,
    onAuthStateChanged: fbAuth.onAuthStateChanged,
    signInWithEmailAndPassword: fbAuth.signInWithEmailAndPassword,
    signOut: fbAuth.signOut,
  };
  return cachedFirebaseModule;
}

function hasStoredFirebaseUser() {
  try {
    if (typeof localStorage === "undefined") return false;
    for (let i = 0; i < localStorage.length; i += 1) {
      const key = localStorage.key(i);
      if (key && key.startsWith("firebase:authUser:")) {
        return true;
      }
    }
  } catch {
    // ignore
  }
  return false;
}

const ACTIVE_USER_KEY = "ummo_active_user";
const LOCAL_ORDERS_KEY = "ummo_local_orders";
const ADMIN_SESSION_TOKEN_KEY = "ummo_admin_session_token";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg";

export const MASTER_ADMIN_UID = "admin-ummo-master";
export const DEFAULT_ADMIN_EMAIL =
  import.meta.env.VITE_ADMIN_EMAIL || "admin@ummo.com";

export const DEFAULT_ADMIN_ACCOUNT = {
  uid: MASTER_ADMIN_UID,
  email: DEFAULT_ADMIN_EMAIL,
  displayName: "Uomo Store Admin",
  username: "Uomo Store Admin",
  photoURL: DEFAULT_AVATAR,
  role: "ADMIN",
};

export function parseAdminTokenPayload(token) {
  if (!token || typeof token !== "string" || !token.includes(".")) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  if (!encoded || !sig || sig.length < 32) return null;
  try {
    const base64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const jsonStr = globalThis.atob(padded);
    const decoded = JSON.parse(jsonStr);
    if (!decoded || typeof decoded !== "object") return null;
    if (decoded.role !== "ADMIN") return null;
    if (!decoded.exp || Number(decoded.exp) <= Date.now()) return null;
    return decoded;
  } catch {
    return null;
  }
}

export function getAdminSessionToken() {
  try {
    const rawToken =
      (typeof sessionStorage !== "undefined" &&
        sessionStorage.getItem(ADMIN_SESSION_TOKEN_KEY)) ||
      (typeof localStorage !== "undefined" &&
        localStorage.getItem(ADMIN_SESSION_TOKEN_KEY)) ||
      "";
    if (!rawToken) return "";
    const payload = parseAdminTokenPayload(rawToken);
    if (!payload) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      }
      return "";
    }
    return rawToken;
  } catch {
    // ignore
  }
  return "";
}

export function saveAdminSessionToken(token) {
  try {
    if (token && parseAdminTokenPayload(token)) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem(ADMIN_SESSION_TOKEN_KEY, String(token));
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(ADMIN_SESSION_TOKEN_KEY, String(token));
      }
    } else {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      }
      if (typeof localStorage !== "undefined") {
        localStorage.removeItem(ADMIN_SESSION_TOKEN_KEY);
      }
    }
  } catch {
    // ignore
  }
}

export function getSessionUser() {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return cachedFirebaseModule?.auth?.currentUser || null;
}

export function isUserAdmin(user = getSessionUser()) {
  if (!user || typeof user !== "object") return false;
  if (String(user.role || "").toUpperCase() !== "ADMIN") return false;
  return Boolean(getAdminSessionToken());
}

export function setSessionUser(user, { adminToken = "" } = {}) {
  if (!user) return null;
  const isVerifiedAdmin = String(user.role || "").toUpperCase() === "ADMIN";
  const normalized = {
    uid: user.uid || `user-${Date.now()}`,
    email: user.email || "",
    displayName: user.displayName || user.username || user.name || "Customer",
    username: user.username || user.displayName || user.name || "Customer",
    photoURL: user.photoURL || user.profile_picture || DEFAULT_AVATAR,
    role: isVerifiedAdmin ? "ADMIN" : "CUSTOMER",
  };
  try {
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(normalized));
    localStorage.removeItem("ummo_admin_unlocked");
    if (adminToken) {
      saveAdminSessionToken(adminToken);
    } else if (!isVerifiedAdmin) {
      saveAdminSessionToken("");
    }
    window.dispatchEvent(
      new CustomEvent("ummo:auth-changed", { detail: normalized })
    );
  } catch {
    // ignore
  }
  syncUserToMongo({
    uid: normalized.uid,
    email: normalized.email,
    username: normalized.username,
    displayName: normalized.displayName,
    profile_picture: normalized.photoURL,
    role: normalized.role,
    lastLoginAt: new Date().toISOString(),
  }).catch(() => {});
  return normalized;
}

/**
 * Authenticates an Administrator using server-side credential verification (`/api/v1/admin/login`)
 * and Firebase Authentication, issuing a signed admin session token.
 * Does NOT allow 1-click unauthenticated demo bypasses.
 */
export async function authenticateAdminLogin(email, password) {
  const cleanEmail = String(email || "").trim().toLowerCase();
  const cleanPassword = String(password || "");
  if (!cleanEmail || !cleanPassword) {
    throw new Error("Please enter both your administrator email and password.");
  }

  // 1. Verify against authoritative backend `/api/v1/admin/login`
  let serverResult = null;
  try {
    serverResult = await loginAdminWithServer(cleanEmail, cleanPassword);
  } catch (err) {
    const status = err?.response?.status;
    const message = err?.response?.data?.error;
    if (status === 401 || status === 403 || status === 400 || status === 429) {
      const authErr = new Error(
        message ||
          (status === 429
            ? "Too many failed login attempts. Please wait before trying again."
            : status === 403
              ? "Access Denied: This account does not have Administrator privileges."
              : "Invalid administrator email or password."),
        { cause: err }
      );
      authErr.statusCode = status;
      throw authErr;
    }
    // If local dev server API is not reachable, fall through to Firebase Auth verification
  }

  let firebaseUser = null;
  if (!serverResult?.adminToken) {
    try {
      const fb = await loadFirebaseAuth();
      const cred = await fb.signInWithEmailAndPassword(
        fb.auth,
        cleanEmail,
        cleanPassword
      );
      firebaseUser = cred?.user || null;
    } catch (fbErr) {
      throw new Error(
        fbErr?.code === "auth/invalid-credential" ||
          fbErr?.code === "auth/wrong-password" ||
          fbErr?.code === "auth/user-not-found"
          ? "Invalid administrator email or password."
          : fbErr?.message || "Failed to authenticate administrator session.",
        { cause: fbErr }
      );
    }
  }

  const isAuthorizedAdmin =
    serverResult?.user?.role === "ADMIN" ||
    cleanEmail === DEFAULT_ADMIN_EMAIL.toLowerCase();

  if (!isAuthorizedAdmin) {
    const deniedErr = new Error(
      "Access Denied: Your account does not hold Administrator permissions."
    );
    deniedErr.statusCode = 403;
    throw deniedErr;
  }

  const adminUser = {
    uid:
      serverResult?.user?.uid ||
      firebaseUser?.uid ||
      DEFAULT_ADMIN_ACCOUNT.uid,
    email: cleanEmail,
    displayName:
      serverResult?.user?.name ||
      firebaseUser?.displayName ||
      DEFAULT_ADMIN_ACCOUNT.displayName,
    username:
      serverResult?.user?.name ||
      firebaseUser?.displayName ||
      DEFAULT_ADMIN_ACCOUNT.username,
    photoURL: firebaseUser?.photoURL || DEFAULT_AVATAR,
    role: "ADMIN",
  };

  return setSessionUser(adminUser, {
    adminToken: serverResult?.adminToken || "",
  });
}

export async function clearSessionUser() {
  const existingAdminToken = getAdminSessionToken();
  if (existingAdminToken) {
    try {
      await logoutAdminWithServer();
    } catch {
      // ignore network error during logout
    }
  }
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
    localStorage.removeItem("ummo_admin_unlocked");
    saveAdminSessionToken("");
    window.dispatchEvent(new CustomEvent("ummo:auth-changed", { detail: null }));
  } catch {
    // ignore
  }
  if (cachedFirebaseModule?.auth || hasStoredFirebaseUser()) {
    try {
      const fb = await loadFirebaseAuth();
      await fb.signOut(fb.auth);
    } catch {
      // ignore
    }
  }
}

export function onUserChanged(callback) {
  let firebaseUser = null;
  let unsubFirebase = null;
  let disposed = false;

  const emitEffectiveUser = () => {
    try {
      const storedRaw = localStorage.getItem(ACTIVE_USER_KEY);
      if (storedRaw) {
        callback(JSON.parse(storedRaw));
        return;
      }
    } catch {
      // ignore
    }
    callback(firebaseUser || null);
  };

  if (hasStoredFirebaseUser()) {
    loadFirebaseAuth()
      .then((fb) => {
        if (disposed) return;
        unsubFirebase = fb.onAuthStateChanged(fb.auth, (u) => {
          firebaseUser = u;
          if (u) {
            const isMasterEmail =
              u.email?.toLowerCase() === DEFAULT_ADMIN_EMAIL.toLowerCase();
            const normalized = {
              uid: u.uid,
              email: u.email || "",
              username: u.displayName || u.email?.split("@")[0] || "Customer",
              displayName: u.displayName || u.email?.split("@")[0] || "Customer",
              photoURL: u.photoURL || DEFAULT_AVATAR,
              role: isMasterEmail ? "ADMIN" : "CUSTOMER",
            };
            try {
              if (!localStorage.getItem(ACTIVE_USER_KEY)) {
                localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(normalized));
              }
            } catch {
              // ignore
            }
            syncUserToMongo({
              uid: normalized.uid,
              email: normalized.email,
              username: normalized.username,
              displayName: normalized.displayName,
              profile_picture: normalized.photoURL,
              lastLoginAt: new Date().toISOString(),
            }).catch(() => {});
          }
          emitEffectiveUser();
        });
      })
      .catch(() => {});
  }

  const handleCustomEvent = () => {
    emitEffectiveUser();
  };

  window.addEventListener("ummo:auth-changed", handleCustomEvent);
  emitEffectiveUser();

  return () => {
    disposed = true;
    if (typeof unsubFirebase === "function") {
      unsubFirebase();
    }
    window.removeEventListener("ummo:auth-changed", handleCustomEvent);
  };
}

export function getLocalOrders(userUid = null) {
  try {
    const raw = localStorage.getItem(LOCAL_ORDERS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        if (!userUid) return parsed;
        return parsed.filter(
          (o) => String(o.userUid || o.id) === String(userUid)
        );
      }
    }
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalOrder(order) {
  const targetId = String(order.orderId || order.id);
  const existing = getLocalOrders().filter(
    (o) => String(o.orderId || o.id) !== targetId
  );
  const next = [order, ...existing];
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent("ummo:orders-changed", { detail: next })
    );
  } catch {
    // ignore
  }
  return next;
}

export function updateLocalOrderStatus(orderId, newStatus) {
  const next = getLocalOrders().map((o) =>
    String(o.orderId || o.id) === String(orderId)
      ? { ...o, status: newStatus, updatedAt: new Date().toISOString() }
      : o
  );
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
    window.dispatchEvent(
      new CustomEvent("ummo:orders-changed", { detail: next })
    );
  } catch {
    // ignore
  }
  return next;
}
