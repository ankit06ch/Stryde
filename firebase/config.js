// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";
import { Platform } from "react-native";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: process.env.EXPO_PUBLIC_FIREBASE_API_KEY || "",
  authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN || "stride-3b661.firebaseapp.com",
  projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID || "stride-3b661",
  storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET || "stride-3b661.firebasestorage.app",
  messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "830910511977",
  appId: process.env.EXPO_PUBLIC_FIREBASE_APP_ID || "1:830910511977:web:7ee65f1385ab4771871bf8"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Only initialize Analytics on web platform
let analytics = null;
if (Platform.OS === 'web') {
  try {
    const { getAnalytics } = require("firebase/analytics");
    analytics = getAnalytics(app);
  } catch (error) {
    console.log('Analytics not available:', error);
  }
}

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);
export { analytics };