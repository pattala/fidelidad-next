// Version: 3.0.0 (Fuerza actualización en Windows)
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    apiKey: "AIzaSyCiWY4sS9VaJUcfD0o5c_ZRFT0NxFdfOX8",
    authDomain: "fidelidad-v2-f2ff4.firebaseapp.com",
    projectId: "fidelidad-v2-f2ff4",
    storageBucket: "fidelidad-v2-f2ff4.firebasestorage.app",
    messagingSenderId: "770588553750",
    appId: "1:770588553750:web:1cf6afeeac65541274fb37",
    measurementId: "G-MMLYXW7ZQC"
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// Forzar actualización inmediata
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(clients.claim()));

messaging.onBackgroundMessage((payload) => {
    console.log('[SW V3] Background Message:', payload);
});

self.addEventListener('push', (event) => {
    console.log('[SW V3] Push event received');

    let title = 'Club de Fidelidad';
    let options = {
        body: 'Tienes una novedad en tu cuenta',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        vibrate: [100, 50, 100],
        requireInteraction: true,
        data: { url: '/inbox' }
    };

    if (event.data) {
        try {
            const payload = event.data.json();
            console.log('[SW V3] Payload Recibido:', payload);

            const notification = payload.notification || {};
            const data = payload.data || {};

            title = notification.title || data.title || title;
            options.body = notification.body || data.body || options.body;
            options.data.url = data.url || data.click_action || options.data.url;

            if (data.icon) options.icon = data.icon;
            if (payload.fcmMessageId) options.tag = payload.fcmMessageId;

        } catch (e) {
            console.warn('[SW V3] Error parseando JSON:', e);
            options.body = event.data.text() || options.body;
        }
    }

    console.log('[SW V3] Mostrando notificación:', title);
    event.waitUntil(self.registration.showNotification(title, options));
});

// Handler para clicks
self.addEventListener('notificationclick', function (event) {
    event.notification.close();
    let urlToOpen = event.notification.data?.url || '/inbox';
    if (!urlToOpen.startsWith('http')) {
        urlToOpen = self.location.origin + urlToOpen;
    }

    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus().then(ac => { if (ac) ac.navigate(urlToOpen); });
                }
            }
            if (clients.openWindow) return clients.openWindow(urlToOpen);
        })
    );
});
