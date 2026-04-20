/// <reference lib="webworker" />
// SW Version: v3 (Restauración Estado Estable - Marzo 14)
import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching';
import { clientsClaim } from 'workbox-core';
import { registerRoute } from 'workbox-routing';
import { NetworkFirst, CacheFirst, StaleWhileRevalidate } from 'workbox-strategies';
import { ExpirationPlugin } from 'workbox-expiration';

declare let self: ServiceWorkerGlobalScope;

// 1. Workbox Setup
cleanupOutdatedCaches();
// @ts-ignore
precacheAndRoute(self.__WB_MANIFEST);
self.skipWaiting();
clientsClaim();

// 2. Firebase: NO se usa onBackgroundMessage porque intercepta el push event
//    e impide que el handler custom (abajo) muestre la notificación.
//    El token FCM se gestiona desde la app principal, no desde el SW.

// 3. Custom Push Handler (Parity with stable backup behavior)
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
            // Unificamos lectura de JSON para evitar errores de stream consumido
            const payload = event.data.json() || {};
            console.log('[SW] Push Payload:', JSON.stringify(payload).substring(0, 100) + '...');

            const notification = payload.notification || {};
            const data = payload.data || payload || {};

            title = notification.title || data.title || title;
            options.body = notification.body || data.body || options.body;
            options.data.url = data.url || data.click_action || notification.click_action || options.data.url;

            if (data.icon && (data.icon.startsWith('http') || data.icon.startsWith('/'))) {
                options.icon = data.icon;
            } else if (notification.icon) {
                 options.icon = notification.icon;
            }
            
            // Delete badge to let the system use the default (avoiding white blob masking)
            delete options.badge;

            options.requireInteraction = true;
            options.tag = data.tag || data.id || 'fidelidad-notif';
            options.renotify = true;
            options.vibrate = [200, 100, 200, 100, 200]; // Patrón más fuerte para celus

        } catch (e) {
            console.error('[SW] Error parsing push data, showing generic:', e);
            try {
                const text = event.data.text();
                if (text) options.body = text;
            } catch (txtErr) {}
        }
    }

    // 3.5 Broadcast successful receipt to the UI
    try {
        const channel = new BroadcastChannel('fcm_diagnostic');
        channel.postMessage({ type: 'PUSH_RECEIVED', timestamp: new Date().toISOString() });
    } catch (e) {
        // Silently ignore if BroadcastChannel not supported
    }

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
