// /modules/notifications.js — COMPLETE REWRITE (v2.0 Clean Slate)
// Objetivo: Simplicidad, Robustez y Auto-Recuperación ante corrupción de BD.
'use strict';

/* ────────────────────────────────────────────────────────────
   CONFIG / HELPERS
   ──────────────────────────────────────────────────────────── */
const VAPID_PUBLIC = (window.APP_CONFIG && window.APP_CONFIG.vapidPublic) || '';
if (!VAPID_PUBLIC) console.warn('[FCM] Falta VAPID Key.');

function $(id) { return document.getElementById(id); }
function show(el, on) { if (el) el.style.display = on ? 'block' : 'none'; }
function toast(msg, type = 'info') { try { window.UI && window.UI.showToast && window.UI.showToast(msg, type); } catch (e) { } }
function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }
function debugLog(ctx, msg, data = '') { console.log(`%c[Notif:${ctx}]`, 'color:#ad005f;font-weight:bold;', msg, data); }

/* ────────────────────────────────────────────────────────────
   CONSTANTS & STATE
   ──────────────────────────────────────────────────────────── */
const LS_NOTIF_STATE = 'notifState'; // 'deferred' | 'accepted' | 'blocked'
const SW_PATH = '/firebase-messaging-sw.js'; // Absolute path for safety

// --- Exported for Debugging ---
export async function hardResetFcmStores() {
  console.warn('[FCM] 🚨 EJECUTANDO HARD RESET (Nuclear Option) 🚨');

  // 1. Limpiar LocalStorage relacionado
  localStorage.removeItem('fcmToken');
  localStorage.removeItem(LS_NOTIF_STATE);

  // 2. Destruir Bases de Datos de Firebase (Source of Truth de la corrupción)
  const dbs = ['firebase-messaging-database', 'firebase-installations-database'];
  for (const name of dbs) {
    try {
      await new Promise(resolve => {
        const req = indexedDB.deleteDatabase(name);
        req.onsuccess = () => { console.log(`[FCM] DB Deleted: ${name}`); resolve(); };
        req.onerror = () => { console.warn(`[FCM] DB Delete Fail: ${name}`); resolve(); };
        req.onblocked = () => { console.warn(`[FCM] DB Delete Blocked: ${name}`); resolve(); };
      });
    } catch (e) { console.error(`[FCM] Exception deleting ${name}`, e); }
  }

  // 3. Desregistrar Service Worker
  try {
    const reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (reg) {
      await reg.unregister();
      console.log('[FCM] SW Unregistered.');
    }
  } catch (e) { console.warn('[FCM] SW Unregister fail', e); }

  console.log('[FCM] Hard Reset Complete.');
}

// Tooling global
window.resetPush = async () => {
  if (!confirm('Esto reiniciará el sistema de notificaciones. ¿Seguir?')) return;
  toast('Reiniciando sistema...', 'warning');
  await hardResetFcmStores();
  toast('Listo. Recargando...', 'success');
  setTimeout(() => location.reload(), 1500);
};

/* ────────────────────────────────────────────────────────────
   CORE: TOKEN MANAGEMENT
   ──────────────────────────────────────────────────────────── */
async function ensureMessagingCompatLoaded() {
  if (typeof firebase !== 'undefined' && firebase.messaging) return;
  // Si no está, asumimos que app.js ya lo cargó o explotará. 
  // Pero por seguridad:
  if (!window.firebase) throw new Error('Firebase no está cargado.');
}

async function getClienteDocIdPorUID(uid) {
  // Simplificado: Usar referencia global si existe, o buscar.
  if (window.clienteRef && window.clienteRef.id) return window.clienteRef.id;

  const snap = await firebase.firestore().collection('clientes').where('authUID', '==', uid).get();
  if (!snap.empty) return snap.docs[0].id;
  return null;
}

// Guarda token en Firestore de forma segura (ArrayUnion)
async function saveTokenToFirestore(token) {
  const user = firebase.auth().currentUser;
  if (!user) throw new Error('No hay usuario logueado.');

  let docId = await getClienteDocIdPorUID(user.uid);
  if (!docId) {
    // Fallback: crear doc con ID = UID
    docId = user.uid;
    await firebase.firestore().collection('clientes').doc(docId).set({
      authUID: user.uid,
      creadoDesde: 'pwa_recover'
    }, { merge: true });
  }

  const ref = firebase.firestore().collection('clientes').doc(docId);
  const bat = firebase.firestore().batch();

  bat.update(ref, {
    fcmTokens: firebase.firestore.FieldValue.arrayUnion(token),
    'config.notifEnabled': true,
    'config.notifUpdatedAt': new Date().toISOString()
  });

  await bat.commit();
  console.log(`[FCM] Token guardado en Firestore para ${docId}`);
  return docId;
}

/* ────────────────────────────────────────────────────────────
   MAIN ACTION: OBTENER Y GUARDAR TOKEN
   ──────────────────────────────────────────────────────────── */
export async function obtenerYGuardarToken() {
  console.log('[FCM] Solicitando Token (Flow lineal)...');

  try {
    await ensureMessagingCompatLoaded();

    // 1. Service Worker Ready?
    if (!('serviceWorker' in navigator)) throw new Error('No support SW');

    // Retry simple para SW Registration
    let reg = await navigator.serviceWorker.getRegistration(SW_PATH);
    if (!reg) {
      console.log('[FCM] Registrando SW...');
      try {
        reg = await navigator.serviceWorker.register(SW_PATH);

        // Timeout para .ready (Edge Strict mode puede colgarse aquí)
        const readyPromise = navigator.serviceWorker.ready;
        const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout_sw_ready')), 3000));

        await Promise.race([readyPromise, timeoutPromise]);
      } catch (e) {
        if (e.message === 'timeout_sw_ready') {
          console.warn('[FCM] SW Ready Timeout (Privacy Block?)');
          throw new Error('storage_blocked'); // Tratamos como bloqueo de privacidad
        }
        throw e;
      }
    }

    // 2. Get Token (CRITICAL STEP)
    let token = null;
    try {
      const messaging = firebase.messaging();
      token = await messaging.getToken({ vapidKey: VAPID_PUBLIC, serviceWorkerRegistration: reg });
    } catch (e) {
      // 🚨 ANALISIS DE ERRORES 🚨
      const msg = e.message || '';
      const name = e.name || '';

      // A) Corrupción de IDB (El problema de la PC)
      if (
        msg.includes('database connection is closing') ||
        msg.includes('InvalidStateError') ||
        name === 'InvalidStateError' ||
        msg.includes('createObjectStore') // Corrupción interna
      ) {
        console.error('[FCM] 🔥 ERROR CRITICO DE DB DETECTADO 🔥');
        await hardResetFcmStores();
        alert('Hubo un error interno en el navegador. La aplicación se reiniciará para corregirlo.');
        location.reload();
        return; // Stop execution
      }

      // B) Bloqueo de Privacidad (Edge/Incognito)
      if (name === 'SecurityError' || msg.includes('blocked') || msg.includes('storage')) {
        console.warn('[FCM] Bloqueo de privacidad detectado.');
        toast('Tu navegador bloquea notificaciones. Revisa la configuración de privacidad.', 'error');
        localStorage.setItem(LS_NOTIF_STATE, 'blocked');
        throw new Error('storage_blocked');
      }

      // C) Otro error (Red, etc)
      throw e;
    }

    if (!token) {
      throw new Error('Token recibido fue null (permiso denegado?)');
    }

    // 3. Success -> Guardar Token
    localStorage.setItem('fcmToken', token);
    localStorage.setItem(LS_NOTIF_STATE, 'accepted');

    // UI Update
    // UI Update
    show($('notif-card'), false);
    show($('notif-prompt-card'), false);

    // Esconder advertencia roja del perfil si existe
    const warmEl = document.getElementById('notif-warning');
    if (warmEl) warmEl.style.display = 'none';

    // Actualizar checkbox del perfil si existe
    const checkEl = document.getElementById('notif-switch');
    if (checkEl) checkEl.checked = true;

    // Firestore Sync
    await saveTokenToFirestore(token);

    // 4. Foreground Listener (Hybrid Mode support)
    // Re-get messaging instance safely
    const msgInstance = firebase.messaging();
    msgInstance.onMessage((payload) => {
      console.log('[FCM] Foreground Message (Main):', payload);
      // USER REQUEST: SIEMPRE Popup, NUNCA Toast.
      const title = payload.notification?.title || payload.data?.title || 'Notificación';
      const body = payload.notification?.body || payload.data?.body || '';
      const icon = payload.notification?.icon || payload.data?.icon || 'https://rampet.vercel.app/images/mi_logo_192.png';

      // Force Native Notification
      new Notification(title, {
        body: body,
        icon: icon,
        tag: 'rampet-foreground'
      });
    });

    toast('Notificaciones Activas ✅', 'success');
    return token;

  } catch (error) {
    if (error.message === 'storage_blocked') return; // Handled
    console.error('[FCM] Fallo en obtenerYGuardarToken:', error);
    toast('No se pudieron activar las notificaciones via navegador.', 'warning');
    throw error;
  }
}

/* ────────────────────────────────────────────────────────────
   INIT LOGIC (Called from app.js)
   ──────────────────────────────────────────────────────────── */
export async function initNotificationsOnce() {
  debugLog('Init', 'Arrancando módulo de notificaciones v2.0');

  // 1. Bind UI Buttons
  const btnSi = $('btn-enable-notifs');
  if (btnSi) btnSi.onclick = () => obtenerYGuardarToken();

  const btnLater = $('btn-later-notifs');
  if (btnLater) btnLater.onclick = () => {
    localStorage.setItem(LS_NOTIF_STATE, 'deferred');
    show($('notif-prompt-card'), false);
    show($('notif-card'), true);
  };

  // 2. Check Permission State
  if (Notification.permission === 'granted') {
    debugLog('Init', 'Permiso ya concedido. Sincronizando token silenciosamente...');
    try {
      // Auto-healing: Si dice granted pero no tenemos token local, intentamos recuperar
      await obtenerYGuardarToken();
    } catch (e) {
      console.warn('[FCM] Falló sync silenciosa:', e);
    }
  } else if (Notification.permission === 'denied') {
    debugLog('Init', 'Permiso denegado.');
    localStorage.setItem(LS_NOTIF_STATE, 'blocked');
    return;
  } else {
    // Default
    const localState = localStorage.getItem(LS_NOTIF_STATE);
    if (!localState) {
      // Primer uso: mostrar prompt
      show($('notif-prompt-card'), true);
      show($('notif-card'), false);
    }
  }
}

// Stubs para compatibilidad si otros módulos las llaman
export async function handleSignOutCleanup() {
  localStorage.removeItem('fcmToken');
}
export async function gestionarPermisoNotificaciones() {
  // Re-check UI
  if (Notification.permission === 'granted') show($('notif-card'), false);
  else show($('notif-card'), true);
}

// 🆕 Export placeholder for 'fetchServerNotifEnabled' if needed by UI
export async function fetchServerNotifEnabled() { return false; }

/* ────────────────────────────────────────────────────────────
   COMPATIBILITY SHIMS (Restore UI.js linkage)
   ──────────────────────────────────────────────────────────── */
export async function handlePermissionRequest() {
  // Wrapper UI para el botón "Activar"
  try {
    await obtenerYGuardarToken();
  } catch (e) {
    console.warn('[FCM] handlePermissionRequest fail', e);
  }
}

export async function handlePermissionSwitch(enabled) {
  // Wrapper para el toggle del perfil
  if (enabled) {
    try { await obtenerYGuardarToken(); } catch {
      // Si falla, revertir visualmente el switch sería ideal, 
      // pero por ahora dejamos que el estado se sincronice solo.
    }
  } else {
    // Disable logic simplificada
    try {
      localStorage.removeItem('fcmToken');
      localStorage.setItem(LS_NOTIF_STATE, 'blocked'); // O deferred?

      const user = firebase.auth().currentUser;
      if (user) {
        // Update Firestore config
        const docId = await getClienteDocIdPorUID(user.uid);
        if (docId) {
          await firebase.firestore().collection('clientes').doc(docId).update({
            'config.notifEnabled': false
          });
        }
      }
      toast('Notificaciones desactivadas.', 'info');
    } catch (e) { console.warn('Disable error', e); }
  }
}

// Stub para Geo (si UI lo llama y no existe, explotará también)
export async function wireGeoButtonsOnce() { }
export async function updateGeoUI() { }
export async function syncProfileConsentUI() { }
export async function syncProfileGeoUI() { }

export async function handleBellClick() {
  if (window.UI && window.UI.openInboxModal) {
    window.UI.openInboxModal();
  }
} 
