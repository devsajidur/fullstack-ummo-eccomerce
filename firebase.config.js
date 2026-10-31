import { initializeApp } from "firebase/app";
import {
  GoogleAuthProvider,
  browserLocalPersistence,
  browserPopupRedirectResolver,
  getAuth,
  initializeAuth,
} from "firebase/auth";

// Firebase is used strictly for Authentication (Email/Password & Google Sign-In).
// Uses browserLocalPersistence instead of IndexedDB so initial page load never opens
// IndexedDB databases, while attaching browserPopupRedirectResolver so Google
// signInWithPopup / signInWithRedirect work across desktop and mobile browsers.
const firebaseConfig = {
  apiKey:
    import.meta.env.VITE_FIREBASE_API_KEY ||
    "AIzaSyBlQ_YYYxW_y8K1iOB6bhx75uhfNFIBsJE",
  authDomain:
    import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ||
    "ummo-eccomerce.firebaseapp.com",
  projectId:
    import.meta.env.VITE_FIREBASE_PROJECT_ID || "ummo-eccomerce",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET ||
    "ummo-eccomerce.firebasestorage.app",
  messagingSenderId:
    import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "341222350745",
  appId:
    import.meta.env.VITE_FIREBASE_APP_ID ||
    "1:341222350745:web:3a0cda00e8c8ebb048bd08",
  measurementId:
    import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-LC73P9DKC6",
};

const app = initializeApp(firebaseConfig);

let auth;
try {
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence,
    popupRedirectResolver: browserPopupRedirectResolver,
  });
} catch {
  auth = getAuth(app);
}

const googleProvider = new GoogleAuthProvider();
googleProvider.setCustomParameters({ prompt: "select_account" });

function isSameOriginAuthDomain() {
  if (typeof window === "undefined") return false;
  const configured = String(
    auth?.config?.authDomain || firebaseConfig.authDomain || ""
  )
    .trim()
    .toLowerCase();
  return Boolean(
    configured && window.location.hostname.toLowerCase() === configured
  );
}

function warmGoogleAuthPopup() {
  if (typeof window === "undefined") return;
  try {
    const resolver = auth?._popupRedirectResolver;
    if (resolver && typeof resolver._initialize === "function") {
      resolver._initialize(auth).catch(() => {});
    }
    if (resolver && typeof resolver._originValidation === "function") {
      resolver._originValidation(auth).catch(() => {});
    }
  } catch {
    // Ignore pre-warm errors; signInWithPopup initializes on demand.
  }
}

const analytics = null;

export {
  app,
  auth,
  googleProvider,
  browserPopupRedirectResolver,
  isSameOriginAuthDomain,
  warmGoogleAuthPopup,
  analytics,
};
