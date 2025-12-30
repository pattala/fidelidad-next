// modules/data.js (PWA - datos del cliente, vencimientos, saldo, consentimientos persistentes)

import { db } from './firebase.js';
import * as UI from './ui.js';
import * as Auth from './auth.js';

let clienteData = null;
let clienteRef = null;
let premiosData = [];
let campanasData = [];

let unsubscribeCliente = null;
let unsubscribeCampanas = null;

let _isDestructionPending = false;

export function cleanupListener() {
  _isDestructionPending = true; // 🛑 Flag para detener reintentos
  if (unsubscribeCliente) unsubscribeCliente();
  if (unsubscribeCampanas) unsubscribeCampanas();
  unsubscribeCliente = null;
  unsubscribeCampanas = null;
  clienteData = null;
  clienteRef = null;
  premiosData = [];
  campanasData = [];
}

// ... (existing code)

// -------------------- Helpers locales --------------------
function parseDateLike(d) {
  if (!d) return null;
  if (typeof d?.toDate === 'function') return d.toDate(); // Firestore Timestamp
  if (typeof d === 'string') {
    const t = new Date(d);
    return isNaN(t) ? null : t;
  }
  if (d instanceof Date) return d;
  return null;
}
function startOfTodayMs() {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

// Agrupa próximas caducidades por día (asc)
function computeUpcomingExpirations(cliente = {}, windowDays = null) {
  const todayStart = startOfTodayMs();
  const untilMs = windowDays ? (todayStart + windowDays * 24 * 60 * 60 * 1000) : null;

  const parseTs = (ts) => {
    if (!ts) return 0;
    if (typeof ts?.toDate === 'function') return ts.toDate().getTime();
    const t = new Date(ts).getTime();
    return isNaN(t) ? 0 : t;
  };
  const dayKey = (ms) => {
    const d = new Date(ms);
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  };
  const inWindow = (ms) => ms >= todayStart && (untilMs ? ms <= untilMs : true);

  // (1) Vencimientos[] (Legacy)
  const byDay = {};

  const arrV = Array.isArray(cliente?.vencimientos) ? cliente.vencimientos : [];
  for (const x of arrV) {
    const pts = Number(x?.puntos || 0);
    const ts = parseTs(x?.venceAt);
    if (pts > 0 && ts && inWindow(ts)) {
      const dk = dayKey(ts);
      byDay[dk] = (byDay[dk] || 0) + pts;
    }
  }

  // (2) historialPuntos[] (New)
  const hist = Array.isArray(cliente?.historialPuntos) ? cliente.historialPuntos : [];
  for (const h of hist) {
    const obt = (typeof h?.fechaObtencion?.toDate === 'function') ? h.fechaObtencion.toDate() : new Date(h?.fechaObtencion);
    const dias = Number(h?.diasCaducidad || 0);
    const disp = Number(h?.puntosDisponibles ?? h?.puntosObtenidos ?? 0);
    if (!obt || isNaN(obt.getTime()) || dias <= 0 || disp <= 0) continue;

    const vence = new Date(obt);
    vence.setHours(23, 59, 59, 999);
    vence.setDate(vence.getDate() + dias);
    const ms = vence.getTime();

    // Solo si aún está disponible y no caducó "hace mucho" (aunque inWindow lo filtra)
    if (h.estado === 'Caducado') continue;

    if (!inWindow(ms)) continue;

    const dk = dayKey(ms);
    byDay[dk] = (byDay[dk] || 0) + disp;
  }

  const listAll = Object.keys(byDay).map(k => ({ ts: Number(k), puntos: byDay[k] })).sort((a, b) => a.ts - b.ts);
  if (listAll.length) return listAll;

  // (3) directos (fallback legacy)
  const directPts = Number(cliente?.puntosProximosAVencer ?? 0);
  const directTs = parseTs(cliente?.fechaProximoVencimiento);
  if (directPts > 0 && directTs && inWindow(directTs)) {
    return [{ ts: dayKey(directTs), puntos: directPts }];
  }

  return [];
}

// === Saldo a favor ===
function updateSaldoCard(cliente = {}) {
  try {
    const card = document.getElementById('saldo-card');
    const saldoEl = document.getElementById('cliente-saldo');
    if (!card || !saldoEl) return;

    const raw = cliente.saldoAcumulado;
    const saldo = Number(isNaN(raw) ? 0 : raw);

    if (saldo > 0) {
      const texto = `$ ${saldo.toFixed(2)}`;
      saldoEl.textContent = texto;
      card.style.display = 'block';
    } else {
      saldoEl.textContent = '$ 0.00';
      card.style.display = 'none';
    }
  } catch (e) {
    console.warn('updateSaldoCard error:', e);
  }
}

// === Fallbacks exportados ===
export function getFechaProximoVencimiento(cliente = {}) {
  if (cliente?.fechaProximoVencimiento) {
    const dt = parseDateLike(cliente.fechaProximoVencimiento);
    if (dt) return dt;
  }

  const hist = Array.isArray(cliente?.historialPuntos) ? cliente.historialPuntos : [];
  const ahora = new Date();

  const candidatos = hist
    .filter(i => (i?.puntosDisponibles ?? 0) > 0 && (i?.diasCaducidad ?? 0) > 0)
    .map(i => {
      const base = parseDateLike(i.fechaObtencion);
      if (!base) return null;
      const vence = new Date(base.getTime());
      vence.setDate(vence.getDate() + Number(i.diasCaducidad || 0));
      return vence;
    })
    .filter(Boolean)
    .filter(vence => vence >= new Date(ahora.getFullYear(), ahora.getMonth(), ahora.getDate()))
    .sort((a, b) => a - b);

  return candidatos.length ? candidatos[0] : null;
}

export function getPuntosEnProximoVencimiento(cliente = {}) {
  if (typeof cliente?.puntosProximosAVencer === 'number' && cliente.puntosProximosAVencer > 0) {
    return cliente.puntosProximosAVencer;
  }

  const hist = Array.isArray(cliente?.historialPuntos) ? cliente.historialPuntos : [];
  const hoy0 = new Date();
  hoy0.setHours(0, 0, 0, 0);

  let minFecha = null;
  const bloques = [];

  for (const i of hist) {
    const disp = Number(i?.puntosDisponibles || 0);
    const dias = Number(i?.diasCaducidad || 0);
    if (disp <= 0 || dias <= 0) continue;

    const base = parseDateLike(i.fechaObtencion);
    if (!base) continue;

    const vence = new Date(base.getTime());
    vence.setDate(vence.getDate() + dias);
    if (vence < hoy0) continue;

    bloques.push({ vence, puntos: disp });
    if (!minFecha || +vence < +minFecha) minFecha = vence;
  }

  if (!minFecha) return 0;

  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  return bloques
    .filter(b => sameDay(b.vence, minFecha))
    .reduce((acc, b) => acc + b.puntos, 0);
}

// === Puntos por vencer (tarjeta Home) ===
export function updateVencimientoCard(cliente = {}) {
  try {
    const card = document.getElementById('vencimiento-card');
    const ptsEl = document.getElementById('cliente-puntos-vencimiento');
    const fechaEl = document.getElementById('cliente-fecha-vencimiento');
    if (!card || !ptsEl || !fechaEl) {
      console.warn('[PWA] Tarjeta de vencimiento no encontrada (IDs requeridos).');
      return;
    }

    let listEl = card.querySelector('#vencimiento-list');
    if (!listEl) {
      listEl = document.createElement('ul');
      listEl.id = 'vencimiento-list';
      listEl.className = 'venc-list';
      listEl.style.margin = '6px 0 0';
      listEl.style.paddingLeft = '18px';
      card.appendChild(listEl);
    }

    const data = computeUpcomingExpirations(cliente); // [{ts, puntos}] ordenado
    const fmt = (ms) => new Date(ms).toLocaleDateString('es-AR');

    if (data.length === 0) {
      ptsEl.textContent = '0';
      fechaEl.textContent = '—';
      listEl.innerHTML = '';
      card.style.display = 'block';
      return;
    }

    ptsEl.textContent = String(data[0].puntos);
    fechaEl.textContent = fmt(data[0].ts);

    const siguientes = data.slice(1, 3);
    if (siguientes.length) {
      listEl.innerHTML = siguientes
        .map(v => `<li><span style="font-weight:600;">${v.puntos}</span> el ${fmt(v.ts)}</li>`)
        .join('');
    } else {
      listEl.innerHTML = '<li class="venc-empty">No hay más vencimientos programados</li>';
    }

    card.style.display = 'block';
  } catch (e) {
    console.warn('updateVencimientoCard error:', e);
  }
}

// === Render principal ===
function renderizarPantallaPrincipal(opts = {}) {
  if (!clienteData) return;

  const hoy = new Date().toISOString().split('T')[0];

  const campanasVisibles = campanasData.filter(campana => {
    const esPublica = campana.visibilidad !== 'prueba';
    const esTesterYVePrueba = clienteData.esTester === true && campana.visibilidad === 'prueba';
    if (!(esPublica || esTesterYVePrueba)) return false;

    const fechaInicio = campana.fechaInicio;
    const fechaFin = campana.fechaFin;

    if (!fechaInicio || hoy < fechaInicio) return false;
    if (fechaFin && fechaFin !== '2100-01-01' && hoy > fechaFin) return false;

    return true;
  });

  UI.renderMainScreen(clienteData, premiosData, campanasVisibles, opts);

  // Extras visibles en home
  updateVencimientoCard(clienteData);
  updateSaldoCard(clienteData);

  // Disparar evento para que otras capas ajusten banners/prompts
  try {
    document.dispatchEvent(new CustomEvent('rampet:config-updated', {
      detail: {
        cliente: clienteData,
        config: clienteData?.config || {}
      }
    }));
  } catch { }
}

// ====== CONSENTIMIENTOS / CONFIG ======

// ✅ NUEVO: parchar el cliente localmente y emitir eventos de actualización
export function patchLocalConfig(partial = {}) {
  try {
    clienteData = clienteData || {};
    clienteData.config = { ...(clienteData.config || {}), ...partial };

    // avisar a quien escuche
    document.dispatchEvent(new CustomEvent('rampet:cliente-updated', {
      detail: { cliente: clienteData }
    }));
    document.dispatchEvent(new CustomEvent('rampet:config-updated', {
      detail: { cliente: clienteData, config: clienteData.config }
    }));
  } catch (e) {
    console.warn('[patchLocalConfig]', e);
  }
}

async function mergeCliente(data) {
  if (!clienteRef) return;
  await clienteRef.set(data, { merge: true });
}
export async function updateProfile(partial = {}) {
  if (!clienteRef) return;
  const allowed = {};
  ['nombre', 'telefono', 'fechaNacimiento'].forEach(k => {
    if (partial[k] != null) allowed[k] = partial[k];
  });
  await clienteRef.set(allowed, { merge: true });
}

export async function updateAddress(addressData) {
  if (!clienteRef) throw new Error("No hay sesión activa para guardar domicilio");
  // Guardamos bajo el campo 'domicilio'
  await clienteRef.set({ domicilio: addressData }, { merge: true });
  // Opcional: Si hay lógica de "puntos por domicilio", se manejaría en backend triggers
}

export async function updateConfig(partial = {}) {
  if (!clienteRef) return;
  const patch = {};
  Object.keys(partial).forEach(k => {
    patch[`config.${k}`] = partial[k];
  });
  await clienteRef.set(patch, { merge: true });
}

export async function saveNotifConsent(allowed, extra = {}) {
  const now = new Date().toISOString();
  await updateConfig({
    notifEnabled: !!allowed,
    notifUpdatedAt: now,
    ...extra
  });
}

export async function saveNotifDismiss() {
  await updateConfig({ notifPromptDismissedAt: new Date().toISOString() });
}

export async function saveGeoConsent(allowed, extra = {}) {
  const now = new Date().toISOString();
  await updateConfig({
    geoEnabled: !!allowed,
    geoUpdatedAt: now,
    ...extra
  });
}

// Escucha eventos globales (emitidos por notifications.js)
let __bridgesWired = false;
function wireConsentEventBridges() {
  if (__bridgesWired) return;
  __bridgesWired = true;

  document.addEventListener('rampet:consent:notif-opt-in', async (e) => {
    await saveNotifConsent(true, { notifOptInSource: e?.detail?.source || 'prompt' });
  });
  document.addEventListener('rampet:consent:notif-opt-out', async (e) => {
    await saveNotifConsent(false, { notifOptOutSource: e?.detail?.source || 'user' });
  });
  document.addEventListener('rampet:consent:notif-dismissed', async () => {
    await saveNotifDismiss();
  });

  document.addEventListener('rampet:geo:enabled', async (e) => {
    await saveGeoConsent(true, { geoMethod: e?.detail?.method || 'prompt' });
  });
  document.addEventListener('rampet:geo:disabled', async (e) => {
    await saveGeoConsent(false, { geoMethod: e?.detail?.method || 'toggle' });
  });
  // 🔹 Nuevo: el usuario dijo "No gracias" al banner de domicilio
  document.addEventListener('rampet:address:dismissed', async () => {
    const now = new Date().toISOString();
    await updateConfig({
      addressPromptDismissed: true,
      addressPromptDismissedAt: now,
    });
  });

}

// === Listeners / flujo principal ===
export async function listenToClientData(user, opts = {}) {
  _isDestructionPending = false; // ✅ Reset flag al iniciar

  // Solo mostramos loading si NO está suprimida la navegación
  if (!opts.suppressNavigation) {
    UI.showScreen('loading-screen');
  }

  if (unsubscribeCliente) unsubscribeCliente();
  if (unsubscribeCampanas) unsubscribeCampanas();

  try { wireConsentEventBridges(); } catch { }

  // ... (Premios loading logic unchanged) ...
  if (premiosData.length === 0) {
    try {
      const premiosSnapshot = await db.collection('premios').orderBy('puntos', 'asc').get();
      premiosData = premiosSnapshot.docs.map(p => ({ id: p.id, ...p.data() }));
    } catch (e) {
      console.error("[PWA] Error cargando premios:", e);
    }
  }

  // Campañas (tiempo real)
  try {
    const campanasQuery = db.collection('campanas').where('estaActiva', '==', true);
    unsubscribeCampanas = campanasQuery.onSnapshot(snapshot => {
      if (_isDestructionPending) return; // 🛑
      campanasData = snapshot.docs.map(doc => doc.data());
      renderizarPantallaPrincipal(opts);
    }, error => {
      console.error("[PWA] Error escuchando campañas:", error);
    });
  } catch (e) {
    console.error("[PWA] Error seteando listener de campañas:", e);
  }

  // Cliente (tiempo real)
  try {
    const docRef = db.collection('clientes').doc(user.uid);

    unsubscribeCliente = docRef.onSnapshot(doc => {
      if (_isDestructionPending) return; // 🛑
      if (!doc.exists) {
        console.log('[PWA] El documento de cliente aún no existe (creando...).');
        return;
      }

      clienteRef = doc.ref;
      const raw = doc.data() || {};
      const safeConfig = (raw.config && typeof raw.config === 'object') ? { ...raw.config } : {};
      clienteData = { ...raw, config: safeConfig };

      try {
        document.dispatchEvent(new CustomEvent('rampet:cliente-updated', { detail: { cliente: clienteData } }));
      } catch { }

      renderizarPantallaPrincipal(opts);

    }, (error) => {
      if (_isDestructionPending) return; // 🛑
      console.warn("[PWA] Error en listener de cliente:", error.code || error);

      if ((error.code === 'permission-denied' || error.message?.includes('permission')) && (!opts.retries || opts.retries < 3)) {
        if (_isDestructionPending) return;
        console.log('[PWA] Reintentando suscripción en 2s...');
        setTimeout(() => {
          if (_isDestructionPending) return;
          listenToClientData(user, { ...opts, retries: (opts.retries || 0) + 1 });
        }, 2000);
      } else {
        console.error("[PWA] Error fatal en datos (Firestore).", error);
        UI.showToast("Error de conexión. Intenta recargar.", "error");
      }
    });
  } catch (e) {
    console.error("[PWA] Error seteando listener de cliente:", e);
    UI.showToast('Error de conexión con datos.', 'error');
  }
}

// ───────── DEBUG CONSOLE HELPERS (opcional QA) ─────────
if (typeof window !== 'undefined') {
  window.computeUpcomingExpirations = computeUpcomingExpirations;
  window.updateVencimientoCard = updateVencimientoCard;
  Object.defineProperty(window, 'clienteData', { get: () => clienteData });
  Object.defineProperty(window, 'clienteRef', { get: () => clienteRef });
}

// ⬇️ Fuera del if, a nivel superior del archivo
export function getClienteRef() {
  return clienteRef;
}

export function getClienteData() {
  return clienteData;
}

// Stubs
export async function acceptTerms() { /* futuro: guardar aceptación */ }

// --- Inbox Management ---
export async function getClienteDocIdPorUID(uid) {
  // Misma lógica que notifications.js, centralizada aquí
  if (!uid) {
    const current = Auth.getCurrentUser();
    uid = current && current.uid;
  }
  if (!uid) return null;

  // 1) Si ya tenemos referencia memoria
  if (clienteRef && clienteRef.id) return clienteRef.id;

  // 2) Consulta directa
  try {
    const snap = await db.collection('clientes').where('authUID', '==', uid).get();
    if (!snap.empty) return snap.docs[0].id;
  } catch (e) {
    console.warn('[Data] Error resolviendo clienteID:', e);
  }
  return null;
}

export async function deleteInboxItem(notifId) {
  const uid = Auth.getCurrentUser()?.uid;
  if (!uid) return;
  const clienteId = await getClienteDocIdPorUID(uid);
  if (!clienteId) throw new Error("Cliente no identificado");

  await db.collection('clientes').doc(clienteId).collection('inbox').doc(notifId).delete();
}

export async function getInboxMessages(limitCnt = 50) {
  const uid = Auth.getCurrentUser()?.uid;
  if (!uid) return [];
  const clienteId = (await getClienteDocIdPorUID(uid)) || uid;
  const snap = await db.collection('clientes').doc(clienteId).collection('inbox').orderBy('ts', 'desc').limit(limitCnt).get();
  return snap.docs.map(d => ({ ...d.data(), id: d.id, ref: d.ref }));
}

// FIX: Hybrid signature (uid, callback) OR (callback) for backward compatibility
export function subscribeToUnreadInbox(uidOrCb, cb) {
  let uid = uidOrCb;
  let callback = cb;

  // Legacy mode check: if first arg is function, user/cache sent (callback)
  if (typeof uidOrCb === 'function') {
    callback = uidOrCb;
    uid = Auth.getCurrentUser()?.uid;
  }

  if (!uid || typeof callback !== 'function') return () => { };

  let internalUnsub = null;
  let isCancelled = false;

  getClienteDocIdPorUID(uid).then(cid => {
    if (isCancelled || !cid) return;
    const q = db.collection('clientes').doc(cid).collection('inbox').where('read', '==', false);
    internalUnsub = q.onSnapshot(snap => {
      // Pass full snap to allow UI to access docs (for Welcome Modal) and changes
      if (typeof callback === 'function') callback(snap);
    }, err => console.warn('[Data] Inbox listen error', err));
  });

  return () => {
    isCancelled = true;
    if (internalUnsub) internalUnsub();
  };
}

export async function deleteInboxMessages(ids) {
  if (!ids || !ids.length) return;
  const uid = Auth.getCurrentUser()?.uid;
  if (!uid) throw new Error('No auth');
  const clienteId = (await getClienteDocIdPorUID(uid)) || uid;
  const col = db.collection('clientes').doc(clienteId).collection('inbox');

  const batch = db.batch();
  ids.forEach(id => {
    batch.delete(col.doc(id));
  });
  await batch.commit();
}

export async function enforceInboxLimit(limit = 20) {
  try {
    const msgs = await getInboxMessages(50); // Traemos un poco más del límite
    if (msgs.length <= limit) return;

    // Identificar excedentes (los más viejos, ya vienen ordenados desc por getInboxMessages)
    const toDelete = msgs.slice(limit);
    const ids = toDelete.map(m => m.id);
    console.log(`[Inbox] Limpiando ${ids.length} mensajes antiguos por límite de ${limit}.`);

    await deleteInboxMessages(ids);
  } catch (e) {
    console.warn('[Inbox] Falló enforceInboxLimit', e);
  }
}

export async function clearInbox() {
  const uid = Auth.getCurrentUser()?.uid;
  if (!uid) return;
  const clienteId = await getClienteDocIdPorUID(uid);
  if (!clienteId) throw new Error("Cliente no identificado");

  const col = db.collection('clientes').doc(clienteId).collection('inbox');
  const snap = await col.get();

  // Borrado en lotes
  const batch = db.batch();
  snap.docs.forEach(doc => batch.delete(doc.ref));
  await batch.commit();
}
