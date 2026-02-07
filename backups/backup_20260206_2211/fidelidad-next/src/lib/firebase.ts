import { initializeApp } from "firebase/app";
import { getAuth, setPersistence, browserLocalPersistence } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getMessaging } from "firebase/messaging";

// Configuración de Fidelidad V2
// Nota: En producción, estos valores deberían ir en variables de entorno (VITE_API_KEY, etc.)
const firebaseConfig = {
    apiKey: "AIzaSyCiWY4sS9VaJUcfD0o5c_ZRFT0NxFdfOX8",
    authDomain: "fidelidad-v2-f2ff4.firebaseapp.com",
    projectId: "fidelidad-v2-f2ff4",
    storageBucket: "fidelidad-v2-f2ff4.firebasestorage.app",
    messagingSenderId: "770588553750",
    appId: "1:770588553750:web:1cf6afeeac65541274fb37",
    measurementId: "G-MMLYXW7ZQC"
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
