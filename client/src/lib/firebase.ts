import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyCZwsJ2oJsQaLYYszMgbifvkAmWxZPR5zs",
  authDomain: "off2field.firebaseapp.com",
  projectId: "off2field",
  storageBucket: "off2field.firebasestorage.app",
  messagingSenderId: "128739859951",
  appId: "1:128739859951:web:258b6ba8d5d3cf42222a1a",
  measurementId: "G-ZX1HQHYTY2",
};

const app = initializeApp(firebaseConfig);

export const analytics = getAnalytics(app);
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;
