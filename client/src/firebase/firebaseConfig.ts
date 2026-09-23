import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Vite environment variables or defaults
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCZwsJ2oJsQaLYYszMgbifvkAmWxZPR5zs",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "off2field.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "off2field",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "off2field.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "128739859951",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:128739859951:web:258b6ba8d5d3cf42222a1a",
};

// Initialize Firebase only once
export const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export default app;
