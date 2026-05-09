importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.0.0/firebase-messaging-compat.js');

// Configuración de Producción (Fidelidad V2)
firebase.initializeApp({
  apiKey: "AIzaSyCiWY4sS9VaJUcfD0o5c_ZRFT0NxFdfOX8",
  authDomain: "fidelidad-v2-f2ff4.firebaseapp.com",
  projectId: "fidelidad-v2-f2ff4",
  storageBucket: "fidelidad-v2-f2ff4.firebasestorage.app",
  messagingSenderId: "770588553750",
  appId: "1:770588553750:web:1cf6afeeac65541274fb37"
});

const messaging = firebase.messaging();

// Receptor de fondo (por si acaso el principal sw.js no está activo)
messaging.onBackgroundMessage((payload) => {
  console.log('[FCM-SW] Mensaje en segundo plano recibido:', payload);
  const notificationTitle = payload.notification?.title || 'Club de Fidelidad';
  const notificationOptions = {
    body: payload.notification?.body || 'Tienes una novedad',
    icon: '/pwa-192x192.png',
    data: { url: payload.data?.url || '/' }
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
