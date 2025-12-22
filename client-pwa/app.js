// app.js — PWA del Cliente

import { setupFirebase, checkMessagingSupport, auth, db, firebase } from './modules/firebase.js';
import * as UI from './modules/ui.js';
try { window.UI = UI; } catch { }
import * as Data from './modules/data.js';
import * as Auth from './modules/auth.js';

// Notificaciones (único import desde notifications.js)
import {
  initNotificationsOnce,
  handleBellClick,
  handleSignOutCleanup
} from './modules/notifications.js';

// === DEBUG / OBS ===
window.__RAMPET_DEBUG = true;
window.__BUILD_ID = 'pwa-1.11.0-fix-final';
function d(tag, ...args) { if (window.__RAMPET_DEBUG) console.log(`[DBG][${window.__BUILD_ID}] ${tag}`, ...args); }
window.__reportState = async (where = '') => {
  const notifPerm = (window.Notification?.permission) || 'n/a';
  let swReady = false;
  try { swReady = !!(await navigator.serviceWorker?.getRegistration?.('/')); } catch { }
  const fcm = localStorage.getItem('fcmToken') ? 'PRESENT' : 'MISSING';
  const lsState = localStorage.getItem('notifState') || 'null';
  let geo = 'n/a';
  try { if (navigator.permissions?.query) geo = (await navigator.permissions.query({ name: 'geolocation' })).state; } catch { }

  console.group(`🔍 DIAGNÓSTICO ESTADO [${where}]`);
  console.table({
    'Notif Permission': notifPerm,
    'FCM Token': fcm,
    'LS State': lsState,
    'SW Ready': swReady,
    'Geo Permission': geo,
    'Timestamp': new Date().toISOString()
  });
  console.groupEnd();
};

// ──────────────────────────────────────────────────────────────
// Badge campanita (se usa con mensajes del SW)
// ──────────────────────────────────────────────────────────────
function ensureBellBlinkStyle() {
  if (document.getElementById('__bell_blink_css__')) return;
  const css = `
    @keyframes rampet-blink { 0%,100%{opacity:1} 50%{opacity:.3} }
    #btn-notifs.blink { animation: rampet-blink 1s linear infinite; }
  `;
  const style = document.createElement('style');
  style.id = '__bell_blink_css__';
  style.textContent = css;
  document.head.appendChild(style);
}
function getBadgeCount() { const n = Number(localStorage.getItem('notifBadgeCount') || '0'); return Number.isFinite(n) ? n : 0; }
function setBadgeCount(n) {
  ensureBellBlinkStyle();
  try { localStorage.setItem('notifBadgeCount', String(Math.max(0, n | 0))); } catch { }
  const badge = document.getElementById('notif-counter');
  const bell = document.getElementById('btn-notifs');
  if (!badge || !bell) return;
  if (n > 0) {
    badge.textContent = String(n);
    badge.style.display = 'inline-block';
    bell.classList.add('blink');
  } else {
    badge.style.display = 'none';
    bell.classList.remove('blink');
  }
}
function bumpBadge() { setBadgeCount(getBadgeCount() + 1); }
function resetBadge() { setBadgeCount(0); }

// Canal SW → APP: solo para contar/botón (no registramos otro onMessage)
function wireSwMessageChannel() {
  if (!('serviceWorker' in navigator)) return;
  if (window.__wiredSwMsg) return;
  window.__wiredSwMsg = true;
  navigator.serviceWorker.addEventListener('message', async (ev) => {
    const t = ev?.data?.type;
    if (t === 'PUSH_DELIVERED') bumpBadge();
    else if (t === 'OPEN_INBOX') {
      try { await openInboxModal(); } catch { }
    }
  });
}

// ──────────────────────────────────────────────────────────────
// INBOX (igual que antes)
// ──────────────────────────────────────────────────────────────
let inboxFilter = 'all';
let inboxLastSnapshot = [];
let inboxPagination = { clienteRefPath: null };
let inboxUnsub = null;

function normalizeCategory(v) {
  if (!v) return '';
  const x = String(v).toLowerCase();
  if (['punto', 'puntos', 'movimientos', 'historial'].includes(x)) return 'puntos';
  if (['promo', 'promos', 'promoción', 'promocion', 'campaña', 'campanas', 'campaña', 'campañas'].includes(x)) return 'promos';
  if (['otro', 'otros', 'general', 'aviso', 'avisos'].includes(x)) return 'otros';
  return x;
}
function itemMatchesFilter(it) {
  if (inboxFilter === 'all') return true;
  const cat = normalizeCategory(it.categoria || it.category);
  return cat === inboxFilter;
}
async function resolveClienteRef() {
  if (inboxPagination.clienteRefPath) return db.doc(inboxPagination.clienteRefPath);
  const u = auth.currentUser;
  if (!u) return null;
  const qs = await db.collection('clientes').where('authUID', '==', u.uid).limit(1).get();
  if (qs.empty) return null;
  inboxPagination.clienteRefPath = qs.docs[0].ref.path;
  return qs.docs[0].ref;
}
function renderInboxList(items) {
  const list = document.getElementById('inbox-list');
  const empty = document.getElementById('inbox-empty');
  if (!list || !empty) return;
  const data = items.filter(itemMatchesFilter);
  empty.style.display = data.length ? 'none' : 'block';
  if (!data.length) { list.innerHTML = ''; return; }
  list.innerHTML = data.map(it => {
    const sentAt = it.sentAt ? (it.sentAt.toDate ? it.sentAt.toDate() : new Date(it.sentAt)) : null;
    const dateTxt = sentAt ? sentAt.toLocaleString() : '';
    const destacado = !!it.destacado;
    return `
      <div class="card inbox-item ${destacado ? 'destacado' : ''}" data-id="${it.id}" tabindex="0" role="button" aria-pressed="${destacado}">
        <div class="inbox-item-row" style="display:flex; justify-content:space-between; align-items:start; gap:10px;">
          <div class="inbox-main" style="flex:1 1 auto;">
            <div class="inbox-title" style="font-weight:700;">
              ${it.title || 'Mensaje'} ${destacado ? '<span class="chip-destacado" aria-label="Destacado" style="margin-left:6px; font-size:12px; background:#fff3cd; color:#8a6d3b; padding:2px 6px; border-radius:999px; border:1px solid #f5e3a3;">Destacado</span>' : ''}
            </div>
            <div class="inbox-body" style="color:#555; margin-top:6px;">${it.body || ''}</div>
            <div class="inbox-date" style="color:#999; font-size:12px; margin-top:8px;">${dateTxt}</div>
          </div>
          <div class="inbox-actions" style="display:flex; gap:6px;">
            <button class="secondary-btn inbox-delete" title="Borrar" aria-label="Borrar este mensaje">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  list.querySelectorAll('.inbox-item').forEach(card => {
    const id = card.getAttribute('data-id');
    const toggle = async () => {
      try {
        const clienteRef = await resolveClienteRef();
        const cur = inboxLastSnapshot.find(x => x.id === id);
        const next = !(cur && cur.destacado === true);
        await clienteRef.collection('inbox').doc(id).set(
          next ? { destacado: true, destacadoAt: new Date().toISOString() } : { destacado: false },
          { merge: true }
        );
        await fetchInboxBatchUnified();
      } catch (err) {
        console.warn('[INBOX] toggle destacado error:', err?.message || err);
      }
    };
    card.addEventListener('click', async (e) => { if ((e.target instanceof HTMLElement) && e.target.closest('.inbox-actions')) return; await toggle(); });
    card.addEventListener('keydown', async (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); await toggle(); } });
  });

  list.querySelectorAll('.inbox-delete').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const card = btn.closest('.inbox-item');
      const id = card?.getAttribute('data-id');
      if (!id) return;
      try {
        const clienteRef = await resolveClienteRef();
        await clienteRef.collection('inbox').doc(id).delete();
      } catch (err) {
        console.warn('[INBOX] borrar error:', err?.message || err);
      }
      await fetchInboxBatchUnified();
    });
  });
}
async function fetchInboxBatchUnified() {
  const clienteRef = await resolveClienteRef();
  if (!clienteRef) { renderInboxList([]); return; }
  try {
    const snap = await clienteRef.collection('inbox').orderBy('sentAt', 'desc').limit(50).get();
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    inboxLastSnapshot = items;
    renderInboxList(items);
  } catch (e) {
    console.warn('[INBOX] fetch error:', e?.message || e);
    inboxLastSnapshot = [];
    renderInboxList([]);
  }
}
async function listenInboxRealtime() {
  const clienteRef = await resolveClienteRef();
  if (!clienteRef) return () => { };
  const q = clienteRef.collection('inbox').orderBy('sentAt', 'desc').limit(50);
  return q.onSnapshot((snap) => {
    const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    inboxLastSnapshot = items;
    renderInboxList(items);
  }, (err) => { console.warn('[INBOX] onSnapshot error:', err?.message || err); });
}
function wireInboxModal() {
  const modal = document.getElementById('inbox-modal');
  if (!modal || modal._wired) return;
  modal._wired = true;

  const setActive = (idActive) => {
    ['inbox-tab-todos', 'inbox-tab-promos', 'inbox-tab-puntos', 'inbox-tab-otros'].forEach(id => {
      const btn = document.getElementById(id);
      if (!btn) return;
      const isActive = id === idActive;
      btn.classList.toggle('primary-btn', isActive);
      btn.classList.toggle('secondary-btn', !isActive);
    });
  };

  document.getElementById('inbox-tab-todos')?.addEventListener('click', async () => { inboxFilter = 'all'; setActive('inbox-tab-todos'); renderInboxList(inboxLastSnapshot); });
  document.getElementById('inbox-tab-promos')?.addEventListener('click', async () => { inboxFilter = 'promos'; setActive('inbox-tab-promos'); renderInboxList(inboxLastSnapshot); });
  document.getElementById('inbox-tab-puntos')?.addEventListener('click', async () => { inboxFilter = 'puntos'; setActive('inbox-tab-puntos'); renderInboxList(inboxLastSnapshot); });
  document.getElementById('inbox-tab-otros')?.addEventListener('click', async () => { inboxFilter = 'otros'; setActive('inbox-tab-otros'); renderInboxList(inboxLastSnapshot); });

  document.getElementById('close-inbox-modal')?.addEventListener('click', () => modal.style.display = 'none');
  document.getElementById('inbox-close-btn')?.addEventListener('click', () => modal.style.display = 'none');
  modal.addEventListener('click', (e) => { if (e.target === modal) modal.style.display = 'none'; });
}
async function openInboxModal() {
  wireInboxModal();
  inboxFilter = 'all';
  await fetchInboxBatchUnified();
  resetBadge();
  const modal = document.getElementById('inbox-modal');
  if (modal) modal.style.display = 'flex';
}

// ──────────────────────────────────────────────────────────────
// Términos & Condiciones (Legacy helpers removed)
// La lógica ahora reside en terminos.js (window.openTermsModal)
// ──────────────────────────────────────────────────────────────


// ──────────────────────────────────────────────────────────────
// PERFIL: reordenar tarjetas (Domicilio arriba / Preferencias último)
// ──────────────────────────────────────────────────────────────
function reorderProfileCards() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;
  const domicilioCard = modal.querySelector('#prof-edit-address-btn')?.closest('.prefs-card');
  const preferenciasCard = modal.querySelector('#prof-consent-notif')?.closest('.prefs-card');
  const actions = modal.querySelector('.modal-actions');

  if (!domicilioCard || !preferenciasCard) return;
  const container = preferenciasCard.parentElement;
  if (!container) return;

  // 1) Domicilio antes que Preferencias
  if (domicilioCard.nextSibling !== preferenciasCard) {
    container.insertBefore(domicilioCard, preferenciasCard);
  }
  // 2) Preferencias como última tarjeta, pero antes de los botones
  if (actions) {
    container.insertBefore(preferenciasCard, actions);
  }
}
// ──────────────────────────────────────────────────────────────
// Instalación PWA (helpers + wiring)
// ──────────────────────────────────────────────────────────────
let deferredInstallPrompt = null;

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  deferredInstallPrompt = e;
  console.log('✅ beforeinstallprompt');
  // ⬇️ NUEVO: si el usuario no lo descartó antes, mostramos el card
  try { showInstallPromptIfAvailable(); } catch { }
});

window.addEventListener('appinstalled', async () => {
  console.log('✅ App instalada');
  localStorage.removeItem('installDismissed');
  deferredInstallPrompt = null;

  document.getElementById('install-prompt-card')?.style?.setProperty('display', 'none');
  document.getElementById('install-entrypoint')?.style?.setProperty('display', 'none');
  document.getElementById('install-help-modal')?.style?.setProperty('display', 'none');
  localStorage.setItem('pwaInstalled', 'true');

  const u = auth.currentUser;
  if (!u) return;
  try {
    const snap = await db.collection('clientes').where('authUID', '==', u.uid).limit(1).get();
    if (snap.empty) return;
    const ref = snap.docs[0].ref;
    const ua = navigator.userAgent || '';
    const isIOS = /iPhone|iPad|iPod/i.test(ua);
    const isAndroid = /Android/i.test(ua);
    const platform = isIOS ? 'iOS' : isAndroid ? 'Android' : 'Desktop';
    await ref.set({
      pwaInstalled: true,
      pwaInstalledAt: new Date().toISOString(),
      pwaInstallPlatform: platform
    }, { merge: true });
  } catch (e) {
    console.warn('No se pudo registrar la instalación en Firestore:', e);
  }
});

function isStandalone() {
  const displayModeStandalone = window.matchMedia && window.matchMedia('(display-mode: standalone)').matches;
  const iosStandalone = window.navigator.standalone === true;
  return displayModeStandalone || iosStandalone;
}

function showInstallPromptIfAvailable() {
  if (deferredInstallPrompt && !localStorage.getItem('installDismissed')) {
    const card = document.getElementById('install-prompt-card');
    if (card) card.style.display = 'block';
  }
}

async function handleInstallPrompt() {
  if (!deferredInstallPrompt) return;
  deferredInstallPrompt.prompt();
  const { outcome } = await deferredInstallPrompt.userChoice;
  console.log(`El usuario eligió: ${outcome}`);
  deferredInstallPrompt = null;
  const card = document.getElementById('install-prompt-card');
  if (card) card.style.display = 'none';
}

async function handleDismissInstall() {
  localStorage.setItem('installDismissed', 'true');
  const card = document.getElementById('install-prompt-card');
  if (card) card.style.display = 'none';
  console.log('El usuario descartó la instalación.');
  const u = auth.currentUser;
  if (!u) return;
  try {
    const snap = await db.collection('clientes').where('authUID', '==', u.uid).limit(1).get();
    if (snap.empty) return;
    await snap.docs[0].ref.set({ pwaInstallDismissedAt: new Date().toISOString() }, { merge: true });
  } catch (e) {
    console.warn('No se pudo registrar el dismiss en Firestore:', e);
  }
}

function getInstallInstructions() {
  const ua = navigator.userAgent.toLowerCase();
  const isIOS = /iphone|ipad|ipod/.test(ua);
  const isAndroid = /android/.test(ua);
  if (isIOS) {
    return `<p>En iPhone/iPad:</p><ol><li>Tocá el botón <strong>Compartir</strong>.</li><li><strong>Añadir a pantalla de inicio</strong>.</li><li>Confirmá con <strong>Añadir</strong>.</li></ol>`;
  }
  if (isAndroid) {
    return `<p>En Android (Chrome/Edge):</p><ol><li>Menú <strong>⋮</strong> del navegador.</li><li><strong>Instalar app</strong> o <strong>Añadir a pantalla principal</strong>.</li><li>Confirmá.</li></ol>`;
  }
  return `<p>En escritorio (Chrome/Edge):</p><ol><li>Icono <strong>Instalar</strong> en la barra de direcciones.</li><li><strong>Instalar app</strong>.</li><li>Confirmá.</li></ol>`;
}

// ──────────────────────────────────────────────────────────────
// LISTENERS Auth/Main
// ──────────────────────────────────────────────────────────────
function setupAuthScreenListeners() {
  if (window.__APP_RUNTIME__?.authListenersWired) return;
  (window.__APP_RUNTIME__ ||= {}).authListenersWired = true;

  const on = (id, event, handler) => { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); };

  on('show-register-link', 'click', (e) => {
    e.preventDefault();
    UI.showScreen('register-screen');
    setTimeout(() => {
      wireAddressDatalists('reg-');
      reorderAddressFields('reg-');
    }, 0);
  });
  on('show-login-link', 'click', (e) => { e.preventDefault(); UI.showScreen('login-screen'); });
  on('login-btn', 'click', Auth.login);

  on('register-btn', 'click', async () => {
    try {
      const r = await Auth.registerNewAccount();
      return r;
    } catch (e) {
      try { localStorage.removeItem('justSignedUp'); } catch { }
      throw e;
    }
  });

  // on('show-terms-link') removed (handled by global delegation or inline onclick)
  on('forgot-password-link', 'click', (e) => { e.preventDefault(); Auth.sendPasswordResetFromLogin(); });
  // on('close-terms-modal') removido (ahora local en terminos.js)

  // Preparar datalists del registro aunque aún no esté visible
  wireAddressDatalists('reg-');
  reorderAddressFields('reg-');
}

function setupMainAppScreenListeners() {
  const on = (id, event, handler) => { const el = document.getElementById(id); if (el) el.addEventListener(event, handler); };
  if (window.__APP_RUNTIME__?.mainListenersWired) return;
  (window.__APP_RUNTIME__ ||= {}).mainListenersWired = true;

  // Perfil
  on('edit-profile-btn', 'click', () => { reorderProfileCards(); UI.openProfileModal(); });
  on('prof-edit-address-btn', 'click', () => {
    // 🔽 NEW LOGIC: Move card INTO modal
    const card = document.getElementById('address-card');
    const modalContent = document.querySelector('#profile-modal .modal-content');
    const summaryBox = document.querySelector('.prefs-card');

    if (card && modalContent && summaryBox) {
      const summary = document.getElementById('prof-address-summary');
      const editBtn = document.getElementById('prof-edit-address-btn');
      if (summary) summary.style.display = 'none';
      if (editBtn) editBtn.style.display = 'none';

      // Move card into modal
      summaryBox.appendChild(card);
      card.style.display = 'block';
      card.classList.add('in-modal');
    }
  });

  const restoreAddressCard = () => {
    const card = document.getElementById('address-card');
    const container = document.querySelector('.container') || document.body;
    if (card && card.classList.contains('in-modal')) {
      card.style.display = 'none';
      card.classList.remove('in-modal');
      container.appendChild(card);

      const summary = document.getElementById('prof-address-summary');
      const editBtn = document.getElementById('prof-edit-address-btn');
      if (summary) summary.style.display = 'block';
      if (editBtn) editBtn.style.display = 'inline-block';
    }
  };
  on('profile-close', 'click', restoreAddressCard);
  on('prof-cancel', 'click', restoreAddressCard);
  on('address-cancel', 'click', restoreAddressCard);
  on('address-save', 'click', async () => { setTimeout(restoreAddressCard, 500); });


  // Logout
  on('logout-btn', 'click', async () => {
    try { await handleSignOutCleanup(); } catch { }
    if (inboxUnsub) { try { inboxUnsub(); } catch { } inboxUnsub = null; }
    try { window.cleanupUiObservers?.(); } catch { }
    Auth.logout();
  });

  // Cambio de password
  on('change-password-btn', 'click', UI.openChangePasswordModal);
  on('close-password-modal', 'click', () => { const m = document.getElementById('change-password-modal'); if (m) m.style.display = 'none'; });
  on('cancel-change-password', 'click', () => { const m = document.getElementById('change-password-modal'); if (m) m.style.display = 'none'; });

  on('save-change-password', 'click', async () => {
    const saveBtn = document.getElementById('save-change-password');
    if (!saveBtn || saveBtn.disabled) return;
    const get = id => document.getElementById(id)?.value?.trim() || '';
    const curr = get('current-password');
    const pass1 = get('new-password');
    const pass2 = get('confirm-new-password');
    if (!pass1 || pass1.length < 6) { UI.showToast('La nueva contraseña debe tener al menos 6 caracteres.', 'error'); return; }
    if (pass1 !== pass2) { UI.showToast('Las contraseñas no coinciden.', 'error'); return; }
    const user = firebase?.auth?.()?.currentUser;
    if (!user) { UI.showToast('No hay sesión activa.', 'error'); return; }

    const prevTxt = saveBtn.textContent;
    saveBtn.textContent = 'Guardando…';
    saveBtn.disabled = true;
    saveBtn.setAttribute('aria-busy', 'true');
    ['current-password', 'new-password', 'confirm-new-password'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = true; });

    try {
      if (curr) {
        try {
          const cred = firebase.auth.EmailAuthProvider.credential(user.email, curr);
          await user.reauthenticateWithCredential(cred);
        } catch (e) {
          console.warn('Reauth falló:', e?.code || e);
          UI.showToast('No pudimos validar tu contraseña actual.', 'warning');
        }
      }
      await user.updatePassword(pass1);
      UI.showToast('¡Listo! Contraseña actualizada.', 'success');
      const m = document.getElementById('change-password-modal'); if (m) m.style.display = 'none';
    } catch (e) {
      if (e?.code === 'auth/requires-recent-login') {
        try {
          await firebase.auth().sendPasswordResetEmail(user.email);
          UI.showToast('Por seguridad te enviamos un e-mail para restablecer la contraseña.', 'info');
        } catch (e2) { console.error('Reset email error:', e2?.code || e2); UI.showToast('No pudimos enviar el e-mail de restablecimiento.', 'error'); }
      } else { console.error('updatePassword error:', e?.code || e); UI.showToast('No se pudo actualizar la contraseña.', 'error'); }
    } finally {
      saveBtn.textContent = prevTxt;
      saveBtn.disabled = false;
      saveBtn.removeAttribute('aria-busy');
      ['current-password', 'new-password', 'confirm-new-password'].forEach(id => { const el = document.getElementById(id); if (el) el.disabled = false; });
    }
  });

  // T&C
  on('show-terms-link-banner', 'click', (e) => { e.preventDefault(); if (window.openTermsModal) window.openTermsModal(true); });
  on('footer-terms-link', 'click', (e) => { e.preventDefault(); if (window.openTermsModal) window.openTermsModal(); });

  // Delegación de eventos para el botón dinámico de Aceptar
  document.body.addEventListener('click', async (e) => {
    if (e.target && e.target.id === 'accept-terms-btn-modal') {
      await Data.acceptTerms();
      const m = document.getElementById('terms-modal');
      if (m) m.remove();
    }
  });

  // Instalación
  on('btn-install-pwa', 'click', handleInstallPrompt);
  on('btn-dismiss-install', 'click', handleDismissInstall);

  // Notificaciones UI
  on('btn-notifs', 'click', async () => { try { await openInboxModal(); } catch { } try { await handleBellClick(); } catch { } });

}

function openInboxIfQuery() {
  try {
    const url = new URL(location.href);
    if (url.searchParams.get('inbox') === '1' || url.pathname.replace(/\/+$/, '') === '/notificaciones') {
      openInboxModal();
    }
  } catch { }
}

// ————————————————————————————————————————————————
// Domicilio: BA/CABA inteligente + placeholders
// ————————————————————————————————————————————————
const BA_LOCALIDADES_BY_PARTIDO = {
  "San Isidro": ["Béccar", "Acassuso", "Martínez", "San Isidro", "Villa Adelina", "Boulogne Sur Mer", "La Horqueta"],
  "Vicente López": ["Olivos", "Florida", "Florida Oeste", "La Lucila", "Munro", "Villa Martelli", "Carapachay", "Vicente López"],
  "Tigre": ["Tigre", "Don Torcuato", "General Pacheco", "El Talar", "Benavídez", "Rincón de Milberg", "Dique Luján", "Nordelta"],
  "San Fernando": ["San Fernando", "Victoria", "Virreyes", "Islas"],
  "San Martín": ["San Martín", "Villa Ballester", "José León Suárez", "Villa Lynch", "Villa Maipú", "Billinghurst", "Chilavert", "Loma Hermosa"],
  "Tres de Febrero": ["Caseros", "Ciudad Jardín", "Santos Lugares", "Villa Bosch", "Loma Hermosa", "Ciudadela", "José Ingenieros", "Saénz Peña"],
  "Hurlingham": ["Hurlingham", "William C. Morris", "Villa Tesei"],
  "Ituzaingó": ["Ituzaingó", "Villa Udaondo"],
  "Morón": ["Morón", "Haedo", "El Palomar", "Castelar"],
  "La Matanza": ["San Justo", "Ramos Mejía", "Lomas del Mirador", "La Tablada", "Isidro Casanova", "González Catán", "Ciudad Evita", "Virrey del Pino"],
  "Lanús": ["Lanús Oeste", "Lanús Este", "Remedios de Escalada", "Monte Chingolo"],
  "Lomas de Zamora": ["Lomas de Zamora", "Banfield", "Temperley", "Turdera", "Llavallol"],
  "Avellaneda": ["Avellaneda", "Dock Sud", "Sarandí", "Wilde", "Gerli", "Villa Domínico", "Piñeyro"],
  "Quilmes": ["Quilmes", "Bernal", "Don Bosco", "Ezpeleta", "Villa La Florida", "San Francisco Solano"],
  "Berazategui": ["Berazategui", "Ranelagh", "Sourigues", "Hudson", "Gutiérrez"],
  "Florencio Varela": ["Florencio Varela", "Bosques", "Zeballos", "Villa Vatteone"],
  "Almirante Brown": ["Adrogué", "Burzaco", "Rafael Calzada", "Longchamps", "Glew", "San José", "Claypole", "Malvinas Argentinas (AB)"],
  "Pilar": ["Pilar", "Del Viso", "Manzanares", "Presidente Derqui", "Fátima", "Villa Rosa", "Champagnat"],
  "Escobar": ["Belén de Escobar", "Ingeniero Maschwitz", "Garín", "Maquinista Savio", "Loma Verde"],
  "José C. Paz": ["José C. Paz", "Tortuguitas (comp.)", "Sol y Verde"],
  "Malvinas Argentinas": ["Los Polvorines", "Grand Bourg", "Tortuguitas", "Ing. Pablo Nogués", "Villa de Mayo"],
  "San Miguel": ["San Miguel", "Bella Vista", "Muñiz"],
  "Zárate": ["Zárate", "Lima"],
  "Campana": ["Campana"],
  "Luján": ["Luján", "Open Door", "Torres", "Cortínez"],
  "Mercedes": ["Mercedes", "Gowland", "Altamira"],
  "Bahía Blanca": ["Bahía Blanca", "Ingeniero White", "Cabildo", "Cerri"],
  "Gral. Pueyrredón": ["Mar del Plata", "Batán", "Sierra de los Padres"],
  "Tandil": ["Tandil", "Gardey", "María Ignacia (Vela)"],
  "Necochea": ["Necochea", "Quequén"]
};
const CABA_BARRIOS = [
  "Palermo", "Recoleta", "Belgrano", "Caballito", "Almagro", "San Telmo", "Montserrat", "Retiro", "Puerto Madero", "Flores",
  "Floresta", "Villa Urquiza", "Villa Devoto", "Villa del Parque", "Chacarita", "Colegiales", "Núñez", "Saavedra",
  "Boedo", "Parque Patricios", "Barracas", "La Boca", "Mataderos", "Liniers", "Parque Chacabuco", "Villa Crespo"
];
const ZONAS_AR = {
  'Buenos Aires': { partidos: Object.keys(BA_LOCALIDADES_BY_PARTIDO).sort(), localidades: [] },
  'CABA': { partidos: [], localidades: CABA_BARRIOS },
  'Córdoba': {
    partidos: ['Capital', 'Colón', 'Punilla', 'Santa María', 'Río Segundo', 'General San Martín', 'San Justo', 'Marcos Juárez', 'Tercero Arriba', 'Unión'],
    localidades: ['Córdoba', 'Río Cuarto', 'Villa Carlos Paz', 'Alta Gracia', 'Villa María', 'San Francisco', 'Jesús María', 'Río Tercero', 'Villa Allende', 'La Calera', 'Mendiolaza', 'Unquillo']
  },
  'Santa Fe': {
    partidos: ['Rosario', 'La Capital', 'Castellanos', 'General López', 'San Lorenzo', 'San Martín', 'San Jerónimo', 'San Justo'],
    localidades: ['Rosario', 'Santa Fe', 'Rafaela', 'Venado Tuerto', 'Reconquista', 'Villa Gobernador Gálvez', 'Santo Tomé', 'Esperanza', 'San Lorenzo', 'Cañada de Gómez']
  },
  'Mendoza': {
    partidos: ['Capital', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Luján de Cuyo', 'Maipú', 'San Martín', 'Rivadavia', 'San Rafael', 'General Alvear', 'Malargüe', 'Tunuyán', 'Tupungato', 'San Carlos'],
    localidades: ['Mendoza', 'Godoy Cruz', 'Guaymallén', 'Las Heras', 'Luján de Cuyo', 'Maipú', 'San Rafael', 'General Alvear', 'Malargüe', 'Tunuyán', 'Tupungato', 'San Martín', 'Rivadavia']
  },
  'Tucumán': {
    partidos: ['Capital', 'Tafí Viejo', 'Yerba Buena', 'Lules', 'Cruz Alta', 'Tafí del Valle', 'Monteros', 'Chicligasta'],
    localidades: ['San Miguel de Tucumán', 'Yerba Buena', 'Tafí Viejo', 'Banda del Río Salí', 'Lules', 'Monteros', 'Concepción', 'Tafí del Valle']
  }
};

function setOptionsList(el, values = []) {
  if (!el) return;
  el.innerHTML = values.map(v => `<option value="${v}">`).join('');
}
function reorderAddressFields(prefix = 'dom-') {
  const grid = (prefix === 'dom-')
    ? document.querySelector('#address-card .grid-2')
    : document.querySelector('#register-form .grid-2') || document.querySelector('#register-screen .grid-2');
  if (!grid) return;
  const provincia = document.getElementById(`${prefix}provincia`);
  const depto = document.getElementById(`${prefix}depto`);
  const barrio = document.getElementById(`${prefix}barrio`);
  const loc = document.getElementById(`${prefix}localidad`);
  const part = document.getElementById(`${prefix}partido`);
  if (!provincia || !depto) return;
  const nextRef = barrio || loc || part || depto.nextSibling;
  if (nextRef && provincia !== nextRef.previousSibling) {
    try { grid.insertBefore(provincia, nextRef); } catch { }
  }
}
function wireAddressDatalists(prefix = 'dom-') {
  const provSel = document.getElementById(`${prefix}provincia`);
  const locInput = document.getElementById(`${prefix}localidad`);
  const partInput = document.getElementById(`${prefix}partido`);

  const locListId = (prefix === 'dom-') ? 'localidad-list' : 'reg-localidad-list';
  const partListId = (prefix === 'dom-') ? 'partido-list' : 'reg-partido-list';

  const locList = document.getElementById(locListId);
  const partList = document.getElementById(partListId);

  if (!provSel) return;

  const setPlaceholders = (prov) => {
    if (/^CABA|Capital/i.test(prov)) {
      if (locInput) locInput.placeholder = 'Barrio';
      if (partInput) partInput.placeholder = '—';
      return;
    }
    if (/^Buenos Aires$/i.test(prov)) {
      if (partInput) partInput.placeholder = 'Partido';
      if (locInput) locInput.placeholder = 'Localidad / Barrio';
      return;
    }
    if (partInput) partInput.placeholder = 'Departamento / Partido (opcional)';
    if (locInput) locInput.placeholder = 'Localidad / Barrio';
  };

  const refreshLocalidades = () => {
    const prov = (provSel.value || '').trim();
    setPlaceholders(prov);

    if (/^CABA|Capital/i.test(prov)) {
      setOptionsList(locList, CABA_BARRIOS);
      if (partInput) partInput.value = '';
      return;
    }

    if (/^Buenos Aires$/i.test(prov) && partInput) {
      const partido = (partInput.value || '').trim();
      const arr = BA_LOCALIDADES_BY_PARTIDO[partido] || [];
      setOptionsList(locList, arr);
      return;
    }

    const data = ZONAS_AR[prov] || { localidades: [] };
    setOptionsList(locList, data.localidades || []);
  };

  const refreshPartidos = () => {
    const prov = (provSel.value || '').trim();
    setPlaceholders(prov);

    if (/^Buenos Aires$/i.test(prov)) {
      setOptionsList(partList, Object.keys(BA_LOCALIDADES_BY_PARTIDO).sort());
    } else {
      setOptionsList(partList, []);
      if (partInput) partInput.value = '';
    }
    refreshLocalidades();
  };

  if (!provSel.dataset[`wired_${prefix}`]) {
    provSel.addEventListener('change', () => {
      refreshPartidos();
      refreshLocalidades();
    });
    partInput?.addEventListener('input', refreshLocalidades);
    provSel.dataset[`wired_${prefix}`] = '1';
  }

  refreshPartidos();
  refreshLocalidades();
  reorderAddressFields(prefix);
}

// —— Mission Card Logic
function checkMissionStatus(hasAddress, dismissedOnServer) {
  const card = document.getElementById('mission-address-card');
  const btn = document.getElementById('mission-address-btn');
  const pointsEl = document.getElementById('mission-address-points');
  if (!card || !btn) return;

  // 1. Config Check
  const points = window.GAMIFICATION_CONFIG?.pointsForAddress || 50;
  if (pointsEl) pointsEl.textContent = points;

  // 2. Hide if address exists OR dismissed on server (though missions usually persist until done)
  // Strategy: Missions should persist unless completed. Dismissing logic might apply to "nagging banner", but Mission is "opportunity".
  // Let's hide if hasAddress is true.
  if (hasAddress) {
    card.style.display = 'none';
    return;
  }

  // 3. Show Mission
  card.style.display = 'block';

  // 4. Wire Button (Reuse logic: open address card)
  if (!btn._wired) {
    btn._wired = true;
    btn.addEventListener('click', () => {
      const addressCard = document.getElementById('address-card');
      const banner = document.getElementById('address-banner');
      if (addressCard) {
        addressCard.style.display = 'block';
        try { window.scrollTo({ top: addressCard.offsetTop - 60, behavior: 'smooth' }); } catch { }
      }
      if (banner) banner.style.display = 'none';

      // Init form dependencies if needed
      import('./modules/notifications.js').then(mod => mod.initDomicilioForm?.()).catch(() => { });
    });
  }
}


// —— Address/banner wiring
// —— Address/banner wiring
async function setupAddressSection() {
  const banner = document.getElementById('address-banner');
  const card = document.getElementById('address-card');

  // Banner: solo abrir la card (el resto lo maneja notifications.js)
  if (banner && !banner.dataset.wired) {
    banner.dataset.wired = '1';
    document.getElementById('address-open-btn')?.addEventListener('click', () => {
      if (card) card.style.display = 'block';
      banner.style.display = 'none';
      try { window.scrollTo({ top: card.offsetTop - 20, behavior: 'smooth' }); } catch { }
    });
  }

  // ⚠️ NO añadimos listeners propios para "Luego" ni "Guardar".
  //     Eso ya lo hace notifications.initDomicilioForm().

  // Datalists + orden de campos
  wireAddressDatalists('dom-');

  // Cargar form y cablear botones internos del domicilio (save/skip)
  try {
    const mod = await import('./modules/notifications.js');
    await mod.initDomicilioForm?.();
  } catch { }

  // Mostrar banner/card según estado actual (sin duplicar lógica de notifications.js)
  // Mostrar banner/card según estado actual (sin duplicar lógica de notifications.js)
  // 🔽 REMOVED: Auto-open form on signup. Falling through to standard banner logic.
  try { localStorage.removeItem('addressProvidedAtSignup'); } catch { }


  // Chequeo rápido si ya hay domicilio Y si en servidor se marcó "no mostrar más el banner"
  let hasAddress = false;
  let dismissedOnServer = false;
  try {
    const u = auth.currentUser;
    if (u) {
      const qs = await db.collection('clientes')
        .where('authUID', '==', u.uid)
        .limit(1)
        .get();

      if (!qs.empty) {
        const snap = await qs.docs[0].ref.get();
        const data = snap.data() || {};

        // 👇 LOG 1: ver exactamente qué trae Firestore
        console.log('[ADDR DEBUG] data Firestore cliente:', data);

        const comp = data.domicilio?.components;
        // VALIDACIÓN STRICTA (Anti-Trampa): Igual que en notifications.js
        hasAddress = !!(
          comp &&
          comp.calle &&
          comp.numero &&
          comp.provincia &&
          (comp.localidad || comp.barrio || comp.partido)
        );

        // 🔹 mirar si en config ya se marcó "no mostrar más el banner"
        // soportar tanto forma anidada (data.config.addressPromptDismissed)
        // como forma aplanada (data["config.addressPromptDismissed"])
        const cfg = data.config || {};
        dismissedOnServer = !!(
          cfg.addressPromptDismissed === true ||
          data['config.addressPromptDismissed'] === true
        );

        // 👇 LOG 2: ver qué valores está usando para decidir
        console.log('[ADDR DEBUG] hasAddress, dismissedOnServer:', { hasAddress, dismissedOnServer });

      }
    }
  } catch (e) {
    console.warn('[ADDR] error chequeando domicilio/config:', e);
  }

  // Estado local: "No gracias" guardado en localStorage
  const dismissedLocal = localStorage.getItem('addressBannerDismissed') === '1';

  // Seguimos respetando el "Luego" por sesión
  let deferredSession = false;
  try {
    deferredSession = sessionStorage.getItem('addressBannerDeferred') === '1';
  } catch (e) {
    deferredSession = false;
  }

  // Update Mission Card
  checkMissionStatus(hasAddress, dismissedOnServer);

  // Combinamos: si lo marcó local O servidor, se considera dismiss
  const dismissed = dismissedLocal || dismissedOnServer;

  // Si NO tiene domicilio, NO dijo "No gracias" (ni local ni server) y NO difirió por sesión → mostramos banner
  if (!hasAddress && !dismissed && !deferredSession) {
    if (banner) banner.style.display = 'block';
    if (card) card.style.display = 'none';
  } else {
    if (banner) banner.style.display = 'none';
    if (card) card.style.display = 'none';
  }
}


// ──────────────────────────────────────────────────────────────
async function main() {
  setupFirebase();

  // ─────────────────────────────────────────────
  // ⚙️ FETCH CONFIG (Global)
  // ─────────────────────────────────────────────
  try {
    const db = firebase.firestore();
    const cfgRef = db.collection('configuracion').doc('parametros');
    const snap = await cfgRef.get();
    if (snap.exists) {
      const d = snap.data();
      // Ensure structure exists
      window.APP_CONFIG = window.APP_CONFIG || {};
      window.APP_CONFIG.features = window.APP_CONFIG.features || {};

      // Map Firestore fields to APP_CONFIG
      if (d.notif_silence_days !== undefined) {
        window.APP_CONFIG.features.notifSilenceDays = Number(d.notif_silence_days);
      }
      if (d.geo_silence_days !== undefined) {
        window.APP_CONFIG.features.geoCooldownDays = Number(d.geo_silence_days);
      }
      console.log('[Config] Loaded remote params:', d);
    }
  } catch (eConfig) {
    console.warn('[Config] Error loading remote config, using defaults.', eConfig);
  }

  // 🚫 FIX: No forzar persistencia aquí. Firebase Web usa LOCAL por defecto.
  // Forzarlo causa condiciones de carrera con Admin Panel (SESSION) en el mismo dominio.
  // try { await auth.setPersistence(firebase.auth.Auth.Persistence.LOCAL); console.log('[Auth] Persistent LOCAL set.'); } catch (e) { console.warn('Persistence error', e); }
  const messagingSupported = await checkMessagingSupport();

  // Config Default Inicial (para evitar errores en login/registro temprano)
  window.GAMIFICATION_CONFIG = { pointsForAddress: 50 };

  auth.onAuthStateChanged(async (user) => {
    const bell = document.getElementById('btn-notifs');
    const badge = document.getElementById('notif-counter');

    // Terms + Inbox wiring
    // wireTermsModalBehavior(); // Removed (legacy)
    wireInboxModal();

    if (user) {
      // ─────────────────────────────────────────────
      // App Privada (Usuario Logueado)
      // ─────────────────────────────────────────────

      // 1. Cargar Configuración Gamification (Ahora que tenemos permiso)
      try {
        const configSnap = await db.collection('config').doc('gamification').get();
        if (configSnap.exists) {
          window.GAMIFICATION_CONFIG = configSnap.data();
          // console.log('[GAMIFICATION] Config loaded:', window.GAMIFICATION_CONFIG);
        }
      } catch (e) {
        // console.warn('[GAMIFICATION] Cloud config failed, using defaults.', e);
      }

      const justSignedUp = localStorage.getItem('justSignedUp') === '1';
      console.log('[DEBUG-AUTH] User:', user.uid, 'justSignedUp:', justSignedUp, 'LS:', localStorage.getItem('justSignedUp'));

      if (bell) bell.style.display = 'inline-block';
      setupMainAppScreenListeners();

      // 🚀 ONBOARDING FLOW
      const notifState = localStorage.getItem('notifState');
      const perm = ('Notification' in window) ? Notification.permission : 'denied';

      // Si se acaba de registrar (forzamos onboarding siempre)
      if (justSignedUp) {

        // Wiring exclusivo del onboarding
        const btnEnable = document.getElementById('btn-onboarding-enable');
        const btnSkip = document.getElementById('btn-onboarding-skip');

        const finishOnboarding = async () => {
          // Intentar mostrar prompt domicilio si corresponde
          try { await setupAddressSection(); } catch (e) { }
          localStorage.removeItem('justSignedUp');
          UI.showScreen('main-app-screen');
          // Ahora sí inicializamos cosas del home
          try { initNotificationsOnce(); } catch (e) { }
        };

        if (btnEnable) btnEnable.onclick = async () => {
          try {
            // Import dinámico para asegurar módulo cargado
            const Mod = await import('./modules/notifications.js');
            await Mod.handlePermissionRequest();
          } catch (e) { console.warn(e); }
          finishOnboarding();
        };

        if (btnSkip) btnSkip.onclick = () => {
          try { localStorage.setItem('notifState', 'deferred'); } catch (e) { }
          finishOnboarding();
        };

        UI.showScreen('onboarding-screen');

      } else {
        // Flujo normal directo al home
        UI.showScreen('main-app-screen');
        try { await setupAddressSection(); } catch (e) { }
        try { await initNotificationsOnce(); } catch (e) { console.warn('[PWA] initNotificationsOnce error:', e); }
      }


      // ⚡ escuchar mensajes del SW para badge (sin duplicar onMessage)
      wireSwMessageChannel();

      // Si estamos en onboarding, REPRIMIMOS que data.js cambie la pantalla (para que no pise el onboarding)
      const suppressNav = !!justSignedUp;
      Data.listenToClientData(user, { suppressNavigation: suppressNav });

      document.addEventListener('rampet:cliente-updated', (e) => {
        try { window.clienteData = e.detail?.cliente || window.clienteData || {}; } catch { }
      });

      try { await window.ensureGeoOnStartup?.(); } catch { }
      document.addEventListener('visibilitychange', async () => {
        if (document.visibilityState === 'visible') { try { await window.maybeRefreshIfStale?.(); } catch { } }
      });

      try { window.setupMainLimitsObservers?.(); } catch { }

      if (messagingSupported) {
        console.log('[FCM] token actual:', localStorage.getItem('fcmToken') || '(sin token)');
        window.__reportState?.('post-init-notifs');
      }

      setBadgeCount(getBadgeCount());
      const installBtn = document.getElementById('install-entrypoint');
      if (installBtn) {
        const isStandalone = (window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone);
        installBtn.style.display = isStandalone ? 'none' : 'inline-block';
      }


      openInboxIfQuery();

      try {
        if (inboxUnsub) { try { inboxUnsub(); } catch { } }
        inboxUnsub = await listenInboxRealtime();
      } catch (e) { console.warn('[INBOX] realtime no iniciado:', e?.message || e); }

    } else {
      console.log('[Auth] State Changed: User is NULL. Trace:', new Error().stack);
      // 🔹 Nuevo: al desloguearse, reseteamos el "Luego" del banner de domicilio
      try {
        sessionStorage.removeItem('addressBannerDeferred');
      } catch (e) {
        console.warn('[PWA] no se pudo limpiar addressBannerDeferred:', e);
      }

      if (bell) bell.style.display = 'none';
      if (badge) badge.style.display = 'none';
      setupAuthScreenListeners();
      UI.showScreen('login-screen');

      if (inboxUnsub) { try { inboxUnsub(); } catch { } inboxUnsub = null; }
      inboxPagination.clienteRefPath = null;
      inboxLastSnapshot = [];
      resetBadge();

      wireAddressDatalists('reg-');
      reorderAddressFields('reg-');
    }
  });

}

// (T&C Logic moved to terminos.js to ensure reliability)
document.addEventListener('click', (e) => {
  if (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const trigger = e.target.closest('#show-terms-link, #show-terms-link-banner, #footer-terms-link');
  if (!trigger) return;

  // If no onclick handler handled it (like in the registration form), we handle it here
  if (!trigger.onclick) {
    e.preventDefault();
    // Call the global function from terminos.js
    if (window.openTermsModal) window.openTermsModal(false);
  }
}, true);

// arranque de la app
document.addEventListener('DOMContentLoaded', () => {
  try { reorderProfileCards(); } catch { }
  try { reorderAddressFields('dom-'); } catch { }
  try { reorderAddressFields('reg-'); } catch { }
  main();
});












