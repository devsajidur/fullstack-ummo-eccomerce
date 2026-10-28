import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyBu6hyvkNzsAxhcXulVkAxseMBi62epcos",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "ecommerce-user-eb35a.firebaseapp.com",
  databaseURL:
    import.meta.env.VITE_FIREBASE_DATABASE_URL ||
    "https://ecommerce-user-eb35a-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "ecommerce-user-eb35a",
  storageBucket:
    import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "ecommerce-user-eb35a.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "272874151947",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:272874151947:web:a3b32bb33c4e5d114ce70e",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

export { auth, db };
