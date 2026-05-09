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

messaging.onBackgroundMessage((payload) => {
    console.log('[firebase-messaging-sw.js] Background message: ', payload);

    // Customizamos la notificación por si viene sin formato
    const notificationTitle = payload.notification?.title || payload.data?.title || 'Fidelidad';
    const notificationOptions = {
        body: payload.notification?.body || payload.data?.body || 'Tienes un nuevo aviso',
        icon: '/pwa-192x192.png',
        badge: '/pwa-192x192.png',
        data: payload.data || { url: '/inbox' } // Default to inbox
    };

    // Si el payload ya trae 'notification', el navegador la muestra auto.
    // Si es 'data only', forzamos mostrarla aquí.
    if (!payload.notification) {
        self.registration.showNotification(notificationTitle, notificationOptions);
    }
});

// Handler para clicks en la notificación
self.addEventListener('notificationclick', function (event) {
    console.log('[Service Worker] Notification click Received.', event.notification.data);

    event.notification.close();

    // Determinar URL de destino
    let urlToOpen = event.notification.data?.url || '/inbox';
    // Ensure absolute path
    if (!urlToOpen.startsWith('http')) {
        urlToOpen = self.location.origin + urlToOpen;
    }

    // focus or open window logic
    event.waitUntil(
        clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (windowClients) {
            // Check if there is already a window/tab open with the target URL
            for (let i = 0; i < windowClients.length; i++) {
                const client = windowClients[i];
                // Si la app ya está abierta, enfocala y navega
                if (client.url.includes(self.location.origin) && 'focus' in client) {
                    return client.focus().then(activeClient => {
                        // Opcional: Podríamos enviar un mensaje al cliente para navegar sin recargar
                        if (activeClient) activeClient.navigate(urlToOpen);
                    });
                }
            }
            // If not open, open new window
            if (clients.openWindow) {
                return clients.openWindow(urlToOpen);
            }
        })
    );
});
