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
            const payload = event.data.json();
            const notification = payload.notification || {};
            const data = payload.data || payload || {};

            title = notification.title || data.title || title;
            options.body = notification.body || data.body || options.body;
            options.data.url = data.url || data.click_action || options.data.url;

            if (data.icon && data.icon.startsWith('http')) options.icon = data.icon;
            if (payload.fcmMessageId) options.tag = payload.fcmMessageId;

        } catch (e) {
            console.error('[SW] Error parsing push data:', e);
            options.body = event.data.text() || options.body;
        }
    }

    console.log('[SW] Showing notification:', title, options.body);
    event.waitUntil(
        self.registration.showNotification(title, options)
            .then(() => console.log('[SW] Notification shown OK'))
            .catch((err: any) => console.error('[SW] showNotification FAILED:', err))
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
