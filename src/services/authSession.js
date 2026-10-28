import { onAuthStateChanged, signOut } from "firebase/auth";
import { auth } from "../../firebase.config";

const ACTIVE_USER_KEY = "ummo_active_user";
const REGISTERED_USERS_KEY = "ummo_registered_users";
const LOCAL_ORDERS_KEY = "ummo_local_orders";

const DEFAULT_AVATAR =
  "https://static.vecteezy.com/system/resources/thumbnails/009/292/244/small/default-avatar-icon-of-social-media-user-vector.jpg";

export const DEFAULT_ADMIN_EMAIL = "admin@ummo.com";
export const DEFAULT_ADMIN_PASSWORD = "Admin@12345";

export const DEFAULT_ADMIN_ACCOUNT = {
  uid: "admin-ummo-master",
  email: DEFAULT_ADMIN_EMAIL,
  displayName: "Uomo Store Admin",
  username: "Uomo Store Admin",
  photoURL: DEFAULT_AVATAR,
  role: "ADMIN",
};

export function getSessionUser() {
  try {
    const raw = localStorage.getItem(ACTIVE_USER_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return auth.currentUser || null;
}

export function setSessionUser(user) {
  if (!user) return;
  const normalized = {
    uid: user.uid || `user-${Date.now()}`,
    email: user.email || "",
    displayName: user.displayName || user.username || user.name || "Customer",
    username: user.username || user.displayName || user.name || "Customer",
    photoURL: user.photoURL || user.profile_picture || DEFAULT_AVATAR,
    role: user.role || "CUSTOMER",
  };
  try {
    localStorage.setItem(ACTIVE_USER_KEY, JSON.stringify(normalized));
    window.dispatchEvent(
      new CustomEvent("ummo:auth-changed", { detail: normalized })
    );
  } catch {
    // ignore
  }
  return normalized;
}

export async function clearSessionUser() {
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
    window.dispatchEvent(new CustomEvent("ummo:auth-changed", { detail: null }));
  } catch {
    // ignore
  }
  try {
    await signOut(auth);
  } catch {
    // ignore
  }
}

export function onUserChanged(callback) {
  let firebaseUser = null;

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

  const unsubFirebase = onAuthStateChanged(auth, (u) => {
    firebaseUser = u;
    emitEffectiveUser();
  });

  const handleCustomEvent = () => {
    emitEffectiveUser();
  };

  window.addEventListener("ummo:auth-changed", handleCustomEvent);
  emitEffectiveUser();

  return () => {
    unsubFirebase();
    window.removeEventListener("ummo:auth-changed", handleCustomEvent);
  };
}

export function getLocalRegisteredUsers() {
  try {
    const raw = localStorage.getItem(REGISTERED_USERS_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // ignore
  }
  return [];
}

export function saveLocalRegisteredUser(userRecord) {
  const existing = getLocalRegisteredUsers().filter(
    (u) => u.email?.toLowerCase() !== userRecord.email?.toLowerCase()
  );
  const next = [userRecord, ...existing];
  try {
    localStorage.setItem(REGISTERED_USERS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
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
  const existing = getLocalOrders().filter(
    (o) => String(o.orderId) !== String(order.orderId)
  );
  const next = [order, ...existing];
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("ummo:orders-changed", { detail: next }));
  } catch {
    // ignore
  }
  return next;
}

export function updateLocalOrderStatus(orderId, newStatus) {
  const next = getLocalOrders().map((o) =>
    String(o.orderId) === String(orderId)
      ? { ...o, status: newStatus, updatedAt: new Date().toISOString() }
      : o
  );
  try {
    localStorage.setItem(LOCAL_ORDERS_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent("ummo:orders-changed", { detail: next }));
  } catch {
    // ignore
  }
  return next;
}
