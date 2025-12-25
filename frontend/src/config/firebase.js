// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "AIzaSyAbt5TMnnoebYDFOLEhWeh6Q_mA1P1QdFk",
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN || "my-kibris.firebaseapp.com",
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID || "my-kibris",
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET || "my-kibris.firebasestorage.app",
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID || "142431125566",
  appId: process.env.REACT_APP_FIREBASE_APP_ID || "1:142431125566:web:89dfc357ffad71f91b516f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

