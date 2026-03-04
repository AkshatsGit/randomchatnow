import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously, onAuthStateChanged, connectAuthEmulator, GoogleAuthProvider, signInWithPopup, signOut } from "firebase/auth";
import { getDatabase, ref, set, get, update, onValue, onDisconnect, remove, push, connectDatabaseEmulator, serverTimestamp } from "firebase/database";
import { getAnalytics, logEvent } from "firebase/analytics";

// Use environment variables for Firebase, fallback to mock data for emulators
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-project.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-randomchatnow",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-project.appspot.com",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1234567890",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1234567890:web:abcdef123456",
    databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://demo-randomchatnow-default-rtdb.firebaseio.com"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const rtdb = getDatabase(app);
const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
const googleProvider = new GoogleAuthProvider();

// Connect to Emulators only if explicitly requested, otherwise use live backend
if (import.meta.env.VITE_USE_FIREBASE_EMULATOR === "true") {
    connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
    connectDatabaseEmulator(rtdb, "127.0.0.1", 9000);
    console.log("🔥 Firebase Emulators Connected (OFFLINE MODE)");
} else {
    console.log("🟢 Connected to live Firebase Production Database!");
}

export {
    app, auth, rtdb, analytics, googleProvider,
    signInAnonymously, signInWithPopup, signOut, onAuthStateChanged,
    ref, set, get, update, onValue, onDisconnect, remove, push, serverTimestamp,
    logEvent
};
