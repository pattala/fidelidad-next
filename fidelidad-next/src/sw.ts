/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// 1. Workbox Setup
cleanupOutdatedCaches();
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

// 2. Firebase: NO se usa onBackgroundMessage porque intercepta el push event
//    e impide que el handler custom (abajo) muestre la notificación.
//    El token FCM se gestiona desde la app principal, no desde el SW.

// 3. Custom Push Handler (Parity with v5.0.0 behavior)
self.addEventListener('push', (event) => {
    console.log('[SW Unified] Push event received');
    const BASE_URL = self.location.origin;

    let title = 'Club de Fidelidad';
    let options: any = {
        body: 'Tienes una novedad en tu cuenta',
        icon: `${BASE_URL}/pwa-192x192.png`,
        badge: `${BASE_URL}/pwa-192x192.png`,
        vibrate: [200, 100, 200],
        silent: false,
        data: { url: '/inbox' }
    };

    if (event.data) {
        try {
            // Se debe consumir el stream una sola vez.
            const payload = event.data.json();
            console.log('[SW] Payload JSON:', payload);

            const data = payload.data || payload || {};
            const notification = payload.notification || {};

            title = data.title || notification.title || title;
            options.body = data.body || notification.body || options.body;
            options.data.url = data.url || data.click_action || options.data.url;

            const iconFromData = data.icon || data.badge;
            if (iconFromData && (iconFromData.startsWith('http') || iconFromData.startsWith('/'))) {
                options.icon = iconFromData.startsWith('http') ? iconFromData : `${BASE_URL}${iconFromData}`;
                options.badge = options.icon;
            }

            if (data.image) {
                options.image = data.image.startsWith('http') ? data.image : `${BASE_URL}${data.image}`;
            }

            options.requireInteraction = true;
            options.tag = data.tag || data.id || 'fidelidad-notif';
            options.renotify = true;

        } catch (e) {
            console.warn('[SW] Push data is not JSON or already consumed. Using text.');
            try {
                options.body = event.data.text() || options.body;
            } catch (textErr) {
                console.error('[SW] Could not read push text either:', textErr);
            }
        }
    }

    console.log('[SW] Final Notification Object:', { title, options });
    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => console.log('[SW] showNotification SUCCESS'))
            .catch((err: any) => console.error('[SW] showNotification FAIL:', err))
    );
});

// 4. Notification Click Handler
self.addEventListener('notificationclick', (event) => {
    event.notification.close();
    const urlToOpen = new URL(event.notification.data?.url || '/inbox', self.location.origin).href;

    event.waitUntil(
        self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
            for (const client of windowClients) {
                if (client.url === urlToOpen && 'focus' in client) {
                    return client.focus();
                }
            }
            if (self.clients.openWindow) {
                return self.clients.openWindow(urlToOpen);
            }
        })
    );
});

// 5. Caching Strategies for API/Assets
registerRoute(
    ({ request }) => request.destination === 'image',
    new CacheFirst({
        cacheName: 'images',
        plugins: [new ExpirationPlugin({ maxEntries: 50, maxAgeSeconds: 30 * 24 * 60 * 60 })],
    })
);

registerRoute(
    ({ url }) => url.origin === self.location.origin && url.pathname.startsWith('/api/'),
    new NetworkFirst({
        cacheName: 'api-responses',
        plugins: [new ExpirationPlugin({ maxEntries: 10, maxAgeSeconds: 60 * 60 })],
    })
);
