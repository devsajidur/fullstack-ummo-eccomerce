import { initializeApp } from "firebase/app";
import {
  browserLocalPersistence,
  getAuth,
  initializeAuth,
} from "firebase/auth";

// Firebase is used strictly for Authentication (Email/Password & Google Sign-In).
// Uses browserLocalPersistence instead of IndexedDB so initial page load never opens
// IndexedDB databases or triggers Lighthouse IndexedDB storage warnings.
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
  });
} catch {
  auth = getAuth(app);
}

const analytics = null;

export { app, auth, analytics };
