// Import the functions you need from the SDKs you need
import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import { getAuth, Auth, connectAuthEmulator } from "firebase/auth";
import { getFirestore, Firestore, connectFirestoreEmulator, enableIndexedDbPersistence } from "firebase/firestore";
import { getAnalytics, Analytics } from "firebase/analytics";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyBdvIEr7adqfx1X-Pp2Hw2s3q2flu0pMrc",
  authDomain: "epr-pos.firebaseapp.com",
  projectId: "epr-pos",
  storageBucket: "epr-pos.firebasestorage.app",
  messagingSenderId: "1060244145838",
  appId: "1:1060244145838:web:8e2b8f3788add8e69ecf3f",
  measurementId: "G-47FZSWJRTL"
};

// Initialize Firebase (singleton pattern)
let app: FirebaseApp;
let auth: Auth;
let db: Firestore;
let analytics: Analytics | null = null;

if (typeof window !== "undefined") {
  // Only initialize on client side
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }

  auth = getAuth(app);
  db = getFirestore(app);

  // Enable offline persistence for Firestore
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === "failed-precondition") {
      console.warn("Multiple tabs open, persistence can only be enabled in one tab at a time.");
    } else if (err.code === "unimplemented") {
      console.warn("The current browser does not support all of the features required to enable persistence");
    }
  });

  // Initialize Analytics only on client
  analytics = getAnalytics(app);
} else {
  // Server-side initialization (minimal)
  if (getApps().length === 0) {
    app = initializeApp(firebaseConfig);
  } else {
    app = getApps()[0];
  }
  auth = getAuth(app);
  db = getFirestore(app);
}

export { app, auth, db, analytics };