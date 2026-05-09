/* public/firebase-messaging-sw.js — COMPAT + SPA Fallback */
'use strict';

importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.2/firebase-messaging-compat.js');

self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

firebase.initializeApp({
  apiKey: "AIzaSyAvBw_Cc-t8lfip_FtQ1w_w3DrPDYpxINs",
  authDomain: "sistema-fidelizacion.firebaseapp.com",
  projectId: "sistema-fidelizacion",
  storageBucket: "sistema-fidelizacion.appspot.com",
  messagingSenderId: "357176214962",
  appId: "1:357176214962:web:6c1df9b74ff0f3779490ab"
});

const messaging = firebase.messaging();

/* ──────────────────────────────────────────────────────────────
   Hybrid Backup: Raw Push Listener
   Colocado AL INICIO para asegurar registro aunque Firebase falle init.
   ────────────────────────────────────────────────────────────── */
/* ──────────────────────────────────────────────────────────────
   Hybrid Backup: Raw Push Listener
   Colocado AL INICIO para asegurar registro aunque Firebase falle init.
   ────────────────────────────────────────────────────────────── */
// Fix: Wrap ENTIRE async operation in waitUntil to prevent "InvalidStateError"
event.waitUntil((async () => {
  let payload;
  try { payload = event.data.json(); } catch (e) { return; }

  // FIX: Mostramos SIEMPRE si hay data (backup agresivo)
  if (payload && payload.data) {
    // Ya NO viene "notification" desde el backend, así que esto siempre es data-only

    // ESTRATEGIA v2.2: DATA-ONLY AGRESIVO
    // El SW es la única fuente de verdad.

    // 0. SIEMPRE MOSTRAR POPUP (Incluso en Foreground) - Pedido explícito
    // Aunque la app esté abierta, forzamos la notificación de sistema.
    const clientList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    const d = normPayload({ data: payload.data });

    // Avisamos a la UI para actualizaciones en tiempo real (badges, etc)
    clientList.forEach(c => c.postMessage({ type: 'PUSH_FOREGROUND', data: d }));

    // NO HACEMOS return, dejamos que siga para ejecutar showNotification abajo 👇

    console.log('[SW-Raw] Push received (Data-Only):', d);

    const title = d.title || 'Club de Beneficios';
    const options = {
      body: d.body || 'Tienes un nuevo mensaje',
      icon: d.icon,
      tag: d.tag, // Importante para agrupar
      data: { id: d.id, url: d.url, via: 'raw-push-data-only' },

      // -- OPCIONES AGRESIVAS DE PERSISTENCIA --
      renotify: true,           // Fuerza vibración/sonido aunque sea el mismo tag
      requireInteraction: false, // Se va solo (default SO)
      actions: [
        { action: 'open', title: 'Ver Mensaje' }
      ]
    };
    if (d.badge) options.badge = d.badge;

    await self.registration.showNotification(title, options);
    // Opcional: Avisar a clientes que llegó
    broadcastLog('🔔 Notification shown via Raw Push (Background)', d);
  }
})());

self.addEventListener('fetch', (event) => {
  const req = event.request;

  // Sólo interceptar navegaciones (click en links / location.assign)
  if (req.mode !== 'navigate') return;

  // Origen distinto → no tocamos
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Requests de archivos estáticos (js, css, imgs, etc.) → dejarlos pasar
  if (/\.(?:js|mjs|css|map|png|jpg|jpeg|gif|svg|ico|webp|json|txt|pdf|woff2?)$/i.test(url.pathname)) {
    return;
  }

  // Fallback a / (index.html) para todas las rutas internas "de app"
  event.respondWith((async () => {
    try {
      const res = await fetch(req);
      // Si el host nos devuelve 404 (p.e. Vercel), forzar index.html
      if (res && res.status === 404) {
        return fetch('/');
      }
      return res;
    } catch (_e) {
      // Sin conexión u otro error → intentar index.html
      return fetch('/');
    }
  })());
});

/* ──────────────────────────────────────────────────────────────
   Normalización payload data-only
   ────────────────────────────────────────────────────────────── */
function normPayload(payload = {}) {
  const d = payload?.data || {};
  const url = d.url || d.click_action || '/notificaciones';
  const id = d.id ? String(d.id) : undefined;
  const tag = (d.tag && String(d.tag)) || (id ? `push-${id}` : 'rampet');
  return {
    id,
    title: d.title || d.titulo || 'Club de Beneficios',
    body: d.body || d.cuerpo || '',
    icon: d.icon || 'https://rampet.vercel.app/images/mi_logo_192.png',
    badge: d.badge || undefined,
    url,
    tag
  };
}

/* ──────────────────────────────────────────────────────────────
   Background: mostrar notificación y avisar a pestañas
   ────────────────────────────────────────────────────────────── */
function broadcastLog(msg, data) {
  self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(clients => {
    clients.forEach(c => c.postMessage({ type: 'LOG', ctx: 'SW', msg, data }));
  });
}

messaging.onBackgroundMessage(async (payload) => {
  console.log('[SW] onBackgroundMessage (Silent - handled by Raw Push):', payload);
  broadcastLog('📩 Background Message received (Silent)', payload);

  // ESTRATEGIA v2.2:
  // DESACTIVAMOS showNotification AQUÍ para evitar duplicados.
  // El listener 'push' raw de arriba ya hizo el trabajo sucio.

  const d = normPayload(payload);
  try {
    const list = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
    list.forEach(c => c.postMessage({ type: 'PUSH_DELIVERED', data: d }));
  } catch { }

  // No llamamos showNotification aquí.
});

/* ──────────────────────────────────────────────────────────────
   Click: enfocar/abrir y avisar “read”
   ────────────────────────────────────────────────────────────── */
self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const data = event.notification?.data || {};
  const targetUrl = data.url || '/notificaciones';

  event.waitUntil((async () => {
    const clientsList = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });

    // avisar a todas las pestañas que se “leyó”
    clientsList.forEach(c => c.postMessage({ type: 'PUSH_READ', data: { id: data.id } }));

    // enfocar si ya existe, o abrir
    const absolute = new URL(targetUrl, self.location.origin).href;
    const existing = clientsList.find(c => c.url === absolute);
    if (existing) return existing.focus();
    return self.clients.openWindow(absolute);
  })());
});
// ... (existing code)
