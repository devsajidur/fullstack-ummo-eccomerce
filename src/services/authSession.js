import {
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import { ref, update } from "firebase/database";
import { auth, db } from "../../firebase.config";

const ACTIVE_USER_KEY = "ummo_active_user";
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

/**
 * Signs in the Demo Admin account (`admin@ummo.com` / `Admin@12345`).
 * Also authenticates against Firebase Auth (creating the admin account in Firebase
 * on first run if needed) and elevates `users/{uid}/role = "ADMIN"` in Firebase RTDB
 * so all Admin Panel operations persist in the real database.
 */
export async function signInAsDemoAdmin() {
  localStorage.setItem("ummo_admin_unlocked", "true");
  let adminUser = { ...DEFAULT_ADMIN_ACCOUNT };

  try {
    let cred;
    try {
      cred = await signInWithEmailAndPassword(
        auth,
        DEFAULT_ADMIN_EMAIL,
        DEFAULT_ADMIN_PASSWORD
      );
    } catch (signInErr) {
      if (
        signInErr.code === "auth/user-not-found" ||
        signInErr.code === "auth/invalid-credential"
      ) {
        cred = await createUserWithEmailAndPassword(
          auth,
          DEFAULT_ADMIN_EMAIL,
          DEFAULT_ADMIN_PASSWORD
        );
      }
    }

    if (cred?.user) {
      adminUser = {
        uid: cred.user.uid,
        email: cred.user.email || DEFAULT_ADMIN_EMAIL,
        displayName: "Uomo Store Admin",
        username: "Uomo Store Admin",
        photoURL: DEFAULT_AVATAR,
        role: "ADMIN",
      };
      await update(ref(db, `users/${cred.user.uid}`), {
        uid: cred.user.uid,
        email: adminUser.email,
        username: "Uomo Store Admin",
        name: "Uomo Store Admin",
        role: "ADMIN",
        profile_picture: DEFAULT_AVATAR,
        lastLoginAt: new Date().toISOString(),
      }).catch(() => {});
    }
  } catch {
    // Continues with Demo Admin session if Firebase Auth is unreachable
  }

  return setSessionUser(adminUser);
}

export async function clearSessionUser() {
  try {
    localStorage.removeItem(ACTIVE_USER_KEY);
    localStorage.removeItem("ummo_admin_unlocked");
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
    String(o.orderId) === String(orderId)
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
