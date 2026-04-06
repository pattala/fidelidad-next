import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

// Configuración de Fidelidad V2
// Nota: En producción, estos valores deberían ir en variables de entorno (VITE_API_KEY, etc.)
const firebaseConfig = {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCiWY4sS9VaJUcfD0o5c_ZRFT0NxFdfOX8",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "fidelidad-v2-f2ff4.firebaseapp.com",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "fidelidad-v2-f2ff4",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "fidelidad-v2-f2ff4.firebasestorage.app",
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "770588553750",
    appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:770588553750:web:1cf6afeeac65541274fb37",
    measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-MMLYXW7ZQC"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);

// Explicitly set persistence to Local Storage to avoid session drops
setPersistence(auth, browserLocalPersistence)
    .then(() => console.log("Firebase Persistence set to LOCAL"))
    .catch((error) => {
        console.error("Error setting persistence:", error);
    });

export const db = getFirestore(app);
export const messaging = typeof window !== "undefined" ? getMessaging(app) : null;

export default app;
