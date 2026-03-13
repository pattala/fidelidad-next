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

// 3. Custom Push Handler removed in favor of public/firebase-messaging-sw.js
// This ensures that the official Firebase Messaging SDK handles background messages
// without conflicts with the PWA caching service worker.

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
