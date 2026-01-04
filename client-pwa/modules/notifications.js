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
        console.warn('[FCM] ⚠️ Error de DB detectado. Se intentará continuar sin reiniciar agresivamente.', msg);
        // await hardResetFcmStores(); // ⛔ DISABLE AGGRESSIVE RESET
        // location.reload();
        return;
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
      try { console.log('[FCM Payload] JSON:', JSON.stringify(payload, null, 2)); } catch { }

      // 🛡️ POPUP TITLE FIX (Generic -> Specific)
      const d = payload.data || {};
      const MAPPER = {
        'welcome_signup': { t: '👋 ¡Bienvenido!', b: 'Gracias por sumarte. ¡Tus puntos ya están!' },
        'profile_address': { t: '🎁 ¡Puntos Acreditados!', b: 'Gracias por completar tu perfil.' },
        'premio': { t: '🎉 ¡Sumaste Puntos!', b: 'Tenés nuevos puntos disponibles.' }
      };

      if (d.type && MAPPER[d.type]) {
        console.log('[FCM] Mapping Generic Title to Specific:', d.type);
        const mapped = MAPPER[d.type];
        if (window.toast) window.toast(`${mapped.t} - ${mapped.b}`, 'info');
      }
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
  if (window.__NOTIF_INIT_DONE) return;
  window.__NOTIF_INIT_DONE = true;

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
    show($('notif-prompt-card'), false); // ⚡ FIX: Hide banner if already granted (Logic Fix)
    debugLog('Init', 'Permiso ya concedido. Sincronizando token silenciosamente...');
    try {
      // Auto-healing: Si dice granted pero no tenemos token local, intentamos recuperar
      const localToken = localStorage.getItem('fcmToken');
      if (!localToken) {
        console.warn('[FCM] ♻️ Permiso OK pero falta Token Local (Reset detectable). Resincronizando...');
        await obtenerYGuardarToken();
      }
    } catch (e) {
      console.warn('[FCM] Falló sync silenciosa:', e);
    }
    // FIX: Prompt Geo even if Notifs are already granted
    checkAndPromptGeo();
  } else if (Notification.permission === 'denied') {
    debugLog('Init', 'Permiso denegado.');
    localStorage.setItem(LS_NOTIF_STATE, 'blocked');
    return;
  } else {
    // Default
    const localState = localStorage.getItem(LS_NOTIF_STATE);
    if (!localState) {
      // Primer uso: mostrar prompt
      // checkAndPromptGeo(); // MOVED TO EVENT LISTENER
      // show($('notif-prompt-card'), true);
      // show($('notif-card'), false);
    } else {
      // Si ya decidieron notif (o está deferred), probamos Geo
      // checkAndPromptGeo(); // MOVED TO EVENT LISTENER
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

// 🆕 Geo Logic (Modal)
export async function wireGeoButtonsOnce() {
  // Hook up profile/switches if passed. For now, strict modal.
}

async function _requestGeo() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error('no_geo_support'));
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      (err) => reject(err),
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  });
}

// Called from init (or UI)
export async function checkAndPromptGeo() {
  // 1. Feature Flag
  if (window.APP_CONFIG?.features?.geoEnabled === false) return;

  // 2. Browser Check
  if (!navigator.geolocation) return;

  // 🛡️ NO MOSTRAR si el onboarding ya lo pidió hace poco (evita doble banner)
  if (sessionStorage.getItem('geoPromptedRecent') === 'true') {
    console.log('[Geo] Silenciado por Onboarding reciente');
    return;
  }

  // 3. DB Check (Source of Truth) - STRICT
  // If config.geoEnabled is true, WE NEVER PROMPT (Assume active or handled by OS)
  const dbConfig = window.clienteData?.config || {};
  if (dbConfig.geoEnabled === true) {
    console.log('[Geo] DB says enabled. Silent check local state.');
    localStorage.setItem('geoState', 'active');
    return;
  }

  // 4. Permission State
  let state = 'prompt';
  try {
    const p = await navigator.permissions.query({ name: 'geolocation' });
    state = p.state;
  } catch (e) {
    // Fallback?
  }

  // 4. Persistence Check
  if (localStorage.getItem('geoState') === 'active') return;
  if (state === 'granted') {
    localStorage.setItem('geoState', 'active');
    return;
  }
  if (state === 'denied') {
    localStorage.setItem('geoState', 'blocked');
    return;
  }

  // 5. Cooldown/Silence Logic (Simple: If not blocked, ASK)
  // User asked for "Dialog" (Modal)

  if (window.UI && window.UI.showConfirmModal) {
    window.UI.showConfirmModal(
      '📍 Beneficios Cerca',
      'Para mostrarte promociones exclusivas cuando estés cerca de nuestras sucursales, necesitamos conocer tu ubicación. ¿Activar ahora?',
      async () => {
        // User clicked SI
        toast('Solicitando permiso...', 'info');
        try {
          await _requestGeo(); // Browser Prompt
          localStorage.setItem('geoState', 'active');
          toast('¡Gracias! Geolocalización activa.', 'success');

          // Sync to Firestore
          const uid = firebase.auth().currentUser?.uid;
          if (uid) {
            const docId = await getClienteDocIdPorUID(uid);
            if (docId) {
              await firebase.firestore().collection('clientes').doc(docId).update({
                'config.geoEnabled': true,
                'config.geoUpdatedAt': new Date().toISOString()
              });
            }
          }
        } catch (err) {
          console.warn('Geo Denied/Error:', err);
          if (err.code === 1) { // PERMISSION_DENIED
            localStorage.setItem('geoState', 'blocked');
            toast('Permiso denegado. Puedes activarlo en config.', 'warning');
          } else {
            toast('Error al obtener ubicación.', 'error');
          }
        }
      },
      () => {
        // User clicked NO
        console.log('User dismissed Geo Modal');
        // Optional: Silence for X days?
      }
    );

    // Change button text override (Hack for reusable modal)
    setTimeout(() => {
      const btnY = document.getElementById('confirm-btn-ok');
      if (btnY) btnY.textContent = '¡Activar!';
    }, 50);
  }
}

export async function updateGeoUI() {
  // Placeholder stub
  checkAndPromptGeo();
}
export async function syncProfileConsentUI() { }
export async function syncProfileGeoUI() { }

export async function handleBellClick() {
  if (window.UI && window.UI.openInboxModal) {
    window.UI.openInboxModal();
  }
}

// 🆕 Address Logic (moved from inline)
export async function initDomicilioForm() {
  const saveBtn = $('address-save');
  const cancelBtn = $('address-cancel'); // Handled by UI.js logic mostly
  /* ────────────────────────────────────────────────────────────
     BOTÓN "AHORA NO" (COOLDOWN)
     ──────────────────────────────────────────────────────────── */
  if (skipBtn && !skipBtn._wiredLogic) {
    skipBtn._wiredLogic = true;
    skipBtn.addEventListener('click', (e) => {
      e.preventDefault();
      console.log('[Address] User clicked Skip/Ahora no.');

      // 1. Guardar Timestamp de rechazo (Cooldown)
      localStorage.setItem('addressPromptDismissedAt', Date.now().toString());

      // 2. Cerrar Modal (UI.js handle)
      // Si UI.js tiene un metodo close, lo usamos, sino ocultamos a mano
      const modal = document.getElementById('address-modal'); // Asumiendo ID
      if (modal) modal.style.display = 'none';

      // 3. Ocultar Banner Misión en esta sesión tambien (UX Consistency)
      sessionStorage.setItem('missionAddressDeferred', '1');
      document.dispatchEvent(new CustomEvent('sys:address:dismissed'));

      toast('Recordaremos esto más adelante.', 'info');
    });
  }

  if (saveBtn && !saveBtn._wiredLogic) {
    saveBtn._wiredLogic = true;
    saveBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      // 1. Collect Data
      const get = (id) => document.getElementById(id)?.value?.trim() || '';
      const calle = get('dom-calle');
      const numero = get('dom-numero');
      const piso = get('dom-piso');
      const depto = get('dom-depto');
      const provincia = get('dom-provincia');
      const partido = get('dom-partido');
      const localidad = get('dom-localidad');
      const cp = get('dom-cp');
      const pais = get('dom-pais') || 'Argentina';
      const ref = get('dom-referencia');

      // Validacion Minima
      if (!calle || !numero || !provincia) {
        return toast('Faltan datos obligatorios (Calle, Altura, Provincia)', 'error');
      }

      // 2. Build Objects
      const seg1 = [calle, numero].filter(Boolean).join(' ');
      const seg2 = [piso, depto].filter(Boolean).join(' ');
      const seg3 = provincia === 'CABA'
        ? [localidad, 'CABA'].filter(Boolean).join(', ')
        : [localidad, partido, provincia].filter(Boolean).join(', ');
      const seg4 = [cp, pais].filter(Boolean).join(', ');
      const addressLine = [seg1, seg2, seg3, seg4].filter(Boolean).join(' — ');

      const domData = {
        addressLine,
        status: 'COMPLETE', // Asumimos complete si guardan
        components: {
          calle, numero, piso, depto, provincia, partido, localidad, codigoPostal: cp, pais, referencia: ref,
          barrio: provincia === 'CABA' ? localidad : ''
        }
      };

      // 3. Save to Firestore
      const btnTxt = saveBtn.textContent;
      saveBtn.disabled = true; saveBtn.textContent = 'Guardando...';
      try {
        const uid = firebase.auth().currentUser?.uid;
        if (!uid) throw new Error('No auth');
        const docId = await getClienteDocIdPorUID(uid);
        if (!docId) throw new Error('No doc');

        await firebase.firestore().collection('clientes').doc(docId).update({
          domicilio: domData,
          'config.addressUpdatedAt': new Date().toISOString()
        });

        // ⚡ OPTIMISTIC UPDATE (Critical for UI responsiveness)
        if (window.clienteData) {
          window.clienteData.domicilio = domData;
        }

        // 4. Assign Points (API)
        try {
          const token = await firebase.auth().currentUser.getIdToken();
          const r = await fetch('/api/assign-points', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
            body: JSON.stringify({ reason: 'profile_address' })
          });
          const d = await r.json();
          if (d.pointsAdded > 0) toast(`¡+${d.pointsAdded} Puntos Agregados!`, 'success');
          else toast('Dirección guardada exitosamente.', 'success');

        } catch {
          toast('Dirección guardada.', 'success');
        }

        // 5. Update UI
        // Dispatch event so UI.js updates profile card immediately
        document.dispatchEvent(new CustomEvent('sys:address:dismissed'));
        document.dispatchEvent(new CustomEvent('sys:address-saved')); // ⚡ NEW: Signal for App.js to close card correctly

        // Force reload global data or wait for storage sync?
        // UI.js listens to onSnapshot, so it should update auto.

      } catch (err) {
        console.warn('Address Save Error:', err);
        toast('Error al guardar dirección.', 'error');
      } finally {
        saveBtn.disabled = false; saveBtn.textContent = btnTxt;
      }
    });
  }
} 
