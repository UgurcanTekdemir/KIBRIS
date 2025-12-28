// Firebase configuration and initialization
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Get environment variables from process.env (env-cmd loads .env file)
// Note: Webpack DefinePlugin replaces process.env.X with the actual value at build time
// If the value is undefined, it becomes the string "undefined"
const getEnvVar = (key) => {
  let value;
  
  // Use process.env directly (env-cmd loads .env file at build time)
  // In webpack, process.env is replaced at build time by DefinePlugin
  if (typeof process !== 'undefined' && process.env && process.env[key]) {
    value = process.env[key];
    // Check if webpack injected "undefined" as a string
    if (value === 'undefined' || value === 'null' || value === '') {
      value = undefined;
    }
  }
  
  // Fallback to window.__ENV__ (runtime loaded from env.js) if available
  if (!value && typeof window !== 'undefined' && window.__ENV__ && window.__ENV__[key]) {
    value = window.__ENV__[key];
  }
  
  // Debug log in development (only once, not on every call)
  if (process.env.NODE_ENV !== 'production' && key === 'REACT_APP_FIREBASE_API_KEY' && !window.__FIREBASE_DEBUG_LOGGED__) {
    window.__FIREBASE_DEBUG_LOGGED__ = true;
    // Only log if API key is missing (to reduce noise)
    if (!value) {
      console.log(`🔑 Firebase API Key: Not found (development mode - using mock services)`);
    }
  }
  
  return value;
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

// Debug: Log what we got (only in development, and only if missing)
if (process.env.NODE_ENV !== 'production' && missingVars.length > 0) {
  // Only log once
  if (!window.__FIREBASE_MISSING_LOGGED__) {
    window.__FIREBASE_MISSING_LOGGED__ = true;
    console.log('🔍 Firebase Config: Missing variables (development mode - using mock services)');
  }
}

if (missingVars.length > 0) {
  // Only log once in development
  if (process.env.NODE_ENV !== 'production') {
    if (!window.__FIREBASE_MISSING_LOGGED__) {
      window.__FIREBASE_MISSING_LOGGED__ = true;
      console.warn('⚠️ Firebase environment variables missing (development mode - using mock services)');
      console.warn('To enable Firebase, add these to frontend/.env:');
      console.warn('  REACT_APP_FIREBASE_API_KEY, REACT_APP_FIREBASE_AUTH_DOMAIN, etc.');
    }
  } else {
    // Production: show full error
    console.error('❌ Missing Firebase environment variables:', missingVars);
    throw new Error(
      `Missing required Firebase environment variables: ${missingVars.join(', ')}\n` +
      `Please ensure .env file exists in the frontend directory.`
    );
  }
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

// Validate API key format before initialization
if (!firebaseConfig.apiKey || firebaseConfig.apiKey.length < 20) {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Firebase API Key is invalid. Please check your .env file.');
  }
  // In development, silently use mock services (already logged above)
}

// Debug: Log config only if Firebase is properly configured
if (process.env.NODE_ENV !== 'production' && firebaseConfig.apiKey && firebaseConfig.apiKey.length >= 20) {
  if (!window.__FIREBASE_CONFIG_LOGGED__) {
    window.__FIREBASE_CONFIG_LOGGED__ = true;
    console.log('✅ Firebase configured successfully');
  }
}

// Initialize Firebase
let app;
try {
  // Only initialize if we have valid config
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length >= 20) {
    app = initializeApp(firebaseConfig);
    if (process.env.NODE_ENV !== 'production' && !window.__FIREBASE_INIT_LOGGED__) {
      window.__FIREBASE_INIT_LOGGED__ = true;
      console.log('✅ Firebase initialized successfully');
    }
  } else {
    // Create a dummy app object for development
    app = { name: '[DEFAULT]', options: {} };
  }
} catch (error) {
  if (process.env.NODE_ENV === 'production') {
    console.error('❌ Firebase initialization error:', error);
    throw error;
  }
  // In development, create dummy app
  app = { name: '[DEFAULT]', options: {} };
}

// Initialize Firebase services with error handling
let auth, db;

try {
  // Only initialize services if we have a valid app
  if (firebaseConfig.apiKey && firebaseConfig.apiKey.length >= 20 && app && app.name !== '[DEFAULT]') {
    auth = getAuth(app);
    db = getFirestore(app);
    if (process.env.NODE_ENV !== 'production' && !window.__FIREBASE_SERVICES_LOGGED__) {
      window.__FIREBASE_SERVICES_LOGGED__ = true;
      console.log('✅ Firebase Auth and Firestore initialized');
    }
  } else {
    // Create mock objects for development
    throw new Error('Firebase not configured');
  }
} catch (error) {
  // In development, create mock objects to prevent app crash
  if (process.env.NODE_ENV !== 'production') {
    // Only log once
    if (!window.__FIREBASE_MOCK_LOGGED__) {
      window.__FIREBASE_MOCK_LOGGED__ = true;
      // Silent - no console log needed, mock services are expected in development
    }
    // Create minimal mock objects
    auth = {
      currentUser: null,
      onAuthStateChanged: () => () => {},
      signInWithEmailAndPassword: () => Promise.reject(new Error('Firebase not initialized')),
      signOut: () => Promise.resolve(),
    };
    db = {
      collection: () => ({
        doc: () => ({
          get: () => Promise.reject(new Error('Firebase not initialized')),
          set: () => Promise.reject(new Error('Firebase not initialized')),
        }),
      }),
    };
  } else {
    console.error('❌ Firebase services initialization error:', error);
    throw error;
  }
}

export { auth, db };
export default app;

