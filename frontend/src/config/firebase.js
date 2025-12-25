// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Get environment variables from window.__ENV__ (loaded from public/env.js) or process.env
const getEnvVar = (key) => {
  // First try window.__ENV__ (runtime loaded from env.js)
  if (typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    return window.__ENV__[key];
  }
  // Fallback to process.env (webpack DefinePlugin) - only if process is defined
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    return process.env[key];
  }
  // Return undefined if not found
  return undefined;
};

// Validate required environment variables
const requiredEnvVars = {
  apiKey: getEnvVar('REACT_APP_FIREBASE_API_KEY'),
  authDomain: getEnvVar('REACT_APP_FIREBASE_AUTH_DOMAIN'),
  projectId: getEnvVar('REACT_APP_FIREBASE_PROJECT_ID'),
  storageBucket: getEnvVar('REACT_APP_FIREBASE_STORAGE_BUCKET'),
  messagingSenderId: getEnvVar('REACT_APP_FIREBASE_MESSAGING_SENDER_ID'),
  appId: getEnvVar('REACT_APP_FIREBASE_APP_ID'),
};

// Check for missing environment variables
const envVarNames = {
  apiKey: 'REACT_APP_FIREBASE_API_KEY',
  authDomain: 'REACT_APP_FIREBASE_AUTH_DOMAIN',
  projectId: 'REACT_APP_FIREBASE_PROJECT_ID',
  storageBucket: 'REACT_APP_FIREBASE_STORAGE_BUCKET',
  messagingSenderId: 'REACT_APP_FIREBASE_MESSAGING_SENDER_ID',
  appId: 'REACT_APP_FIREBASE_APP_ID',
};

const missingVars = Object.entries(requiredEnvVars)
  .filter(([_, value]) => !value)
  .map(([key]) => envVarNames[key]);

if (missingVars.length > 0) {
  console.error('❌ Missing Firebase environment variables:', missingVars);
  console.error('window.__ENV__:', typeof window !== 'undefined' ? window.__ENV__ : 'window not available');
  if (typeof process !== 'undefined' && process.env) {
    console.error('process.env sample:', {
      NODE_ENV: process.env.NODE_ENV,
      hasREACT_APP: Object.keys(process.env).filter(k => k.startsWith('REACT_APP_')).length
    });
  }
  throw new Error(
    `Missing required Firebase environment variables: ${missingVars.join(', ')}\n` +
    `Please ensure .env file exists in the frontend directory and env.js is loaded.`
  );
}

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: requiredEnvVars.apiKey,
  authDomain: requiredEnvVars.authDomain,
  projectId: requiredEnvVars.projectId,
  storageBucket: requiredEnvVars.storageBucket,
  messagingSenderId: requiredEnvVars.messagingSenderId,
  appId: requiredEnvVars.appId,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

export default app;

