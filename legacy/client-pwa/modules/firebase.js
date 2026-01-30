// pwa/modules/firebase.js
// Inicializa Firebase (compat) y expone auth, db, messaging, etc.
// OJO: acá NO hay toasts, NO hay onMessage, NO hay contador.

const firebase = window.firebase;

let app, db, auth, messaging;
let isMessagingSupported = false;

export function setupFirebase() {
  // Lectura desde config.js (White Label)
  const firebaseConfig = window.APP_CONFIG?.firebaseConfig || {
    apiKey: "MISSING_KEY"
  };

  // Evita re-init
  if (!firebase.apps || !firebase.apps.length) {
    app = firebase.initializeApp(firebaseConfig);
    try { firebase.analytics?.(app); } catch { /* opcional */ }
  } else {
    app = firebase.app();
  }

  db = firebase.firestore();
  auth = firebase.auth();
  // 🛡️ FIX: Forzar persistencia LOCAL para evitar conflictos con SW/IndexedDB
  auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL).catch(e => console.warn('[Auth] Persistence error:', e));
}

export async function checkMessagingSupport() {
  try {
    const supported = await firebase.messaging.isSupported();
    if (supported) {
      messaging = firebase.messaging();
      isMessagingSupported = true;
    } else {
      isMessagingSupported = false;
    }
  } catch (err) {
    console.warn("Messaging no soportado o bloqueado:", err?.message || err);
    isMessagingSupported = false;
  }
  return isMessagingSupported;
}

export { firebase, app, db, auth, messaging, isMessagingSupported };
