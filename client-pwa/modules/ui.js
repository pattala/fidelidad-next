// modules/ui.js (render principal, carrusel + historial + perfil)

import * as Data from './data.js';
import { handlePermissionRequest, handlePermissionSwitch } from './notifications.js';

// --- Estado del carrusel ---
let carouselIntervalId = null;
let isDragging = false, startX, startScrollLeft;

// ─────────────────────────────────────────────────────────────
// Utilidades base
// ─────────────────────────────────────────────────────────────
function safeSetText(id, content) {
  const el = document.getElementById(id);
  if (el) el.textContent = content;
  else console.warn(`[UI SafeSet] No existe #${id}`);
}

export function showToast(message, type = 'info', duration = 6000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => toast.remove(), duration);
}

export function showScreen(screenId) {
  console.log('[UI] showScreen:', screenId);
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  const target = document.getElementById(screenId);
  if (target) target.classList.add('active');
  else console.error(`[UI ShowScreen] No existe #${screenId}`);

  // Manejo de visibilidad de Campanita (Solo en Main App)
  const bell = document.getElementById('btn-notifs');
  if (bell) {
    bell.style.display = (screenId === 'main-app-screen') ? 'inline-block' : 'none';
  }
}

function formatearFecha(iso) {
  if (!iso) return 'N/A';
  const parts = String(iso).split('T')[0].split('-');
  if (parts.length !== 3) return 'Fecha inválida';
  const d = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (isNaN(d)) return 'Fecha inválida';
  const dd = String(d.getUTCDate()).padStart(2, '0');
  const mm = String(d.getUTCMonth() + 1).padStart(2, '0');
  const yy = d.getUTCFullYear();
  return `${dd}/${mm}/${yy}`;
}

// Fallback local para switches si aún no cargó Firestore
function readConsentFallback() {
  let notif = false, geo = false;
  try { notif = localStorage.getItem('notifState') === 'accepted'; } catch { }
  try { geo = localStorage.getItem('geoState') === 'accepted'; } catch { }
  return { notif, geo };
}

// ─────────────────────────────────────────────────────────────
// Pantalla principal
// ─────────────────────────────────────────────────────────────
export function renderMainScreen(clienteData, premiosData, campanasData = [], opts = {}) {
  if (!clienteData) return;

  safeSetText('cliente-nombre', (clienteData.nombre || '--').split(' ')[0]);
  safeSetText('cliente-numero-socio', clienteData.numeroSocio ? `#${clienteData.numeroSocio}` : 'N° De Socio Pendiente de Aceptacion');
  safeSetText('cliente-puntos', clienteData.puntos || 0);

  const termsBanner = document.getElementById('terms-banner');
  if (termsBanner) termsBanner.style.display = !clienteData.terminosAceptados ? 'block' : 'none';

  // Tarjeta de vencimiento
  const vencCard = document.getElementById('vencimiento-card');
  if (vencCard) {
    const pts = Data.getPuntosEnProximoVencimiento(clienteData);
    const fecha = Data.getFechaProximoVencimiento(clienteData);
    safeSetText('cliente-puntos-vencimiento', pts > 0 ? pts : 0);
    safeSetText('cliente-fecha-vencimiento', fecha ? formatearFecha(fecha.toISOString()) : '—');
    vencCard.style.display = 'block';
  }

  // Historial reciente
  renderRecentHistory(clienteData);

  // Lista de premios
  const premiosLista = document.getElementById('lista-premios-cliente');
  if (premiosLista) {
    premiosLista.innerHTML = '';
    if (Array.isArray(premiosData) && premiosData.length) {
      premiosData.forEach(premio => {
        const li = document.createElement('li');
        const puede = Number(clienteData.puntos || 0) >= Number(premio.puntos || 0);
        li.className = puede ? 'canjeable' : 'no-canjeable';
        li.innerHTML = `<strong>${premio.nombre}</strong> <span class="puntos-premio">${premio.puntos} Puntos</span>`;
        premiosLista.appendChild(li);
      });
    } else {
      premiosLista.innerHTML = '<li>No hay premios disponibles en este momento.</li>';
    }
  }

  // Carrusel de campañas
  renderCampanasCarousel(campanasData);

  if (!opts.suppressNavigation) {
    showScreen('main-app-screen');
  }
}

export function openTermsModal(showAcceptButton) {
  const m = document.getElementById('terms-modal');
  const btn = document.getElementById('accept-terms-btn-modal');
  if (m) m.style.display = 'flex';
  if (btn) btn.style.display = showAcceptButton ? 'block' : 'none';
}
export function closeTermsModal() {
  const m = document.getElementById('terms-modal');
  if (m) m.style.display = 'none';
}

export function openChangePasswordModal() {
  const m = document.getElementById('change-password-modal');
  if (!m) return;
  document.getElementById('current-password').value = '';
  document.getElementById('new-password').value = '';
  document.getElementById('confirm-new-password').value = '';
  m.style.display = 'flex';
}
export function closeChangePasswordModal() {
  const m = document.getElementById('change-password-modal');
  if (m) m.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
// Carrusel de campañas
// ─────────────────────────────────────────────────────────────
function renderCampanasCarousel(campanasData) {
  const container = document.getElementById('carrusel-campanas-container');
  const carrusel = document.getElementById('carrusel-campanas');
  const indicadoresContainer = document.getElementById('carrusel-indicadores');
  if (!container || !carrusel || !indicadoresContainer) return;

  if (carouselIntervalId) clearInterval(carouselIntervalId);

  const campanasVisibles = Array.isArray(campanasData) ? campanasData : [];
  if (!campanasVisibles.length) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'block';
  carrusel.innerHTML = '';
  indicadoresContainer.innerHTML = '';

  campanasVisibles.forEach((campana, index) => {
    let item;

    const banner =
      campana.urlBanner ||
      campana.bannerUrl ||
      campana.bannerURL ||
      campana.banner ||
      campana.imagen ||
      campana.imagenUrl ||
      campana.image ||
      campana.imageUrl ||
      campana.imageURL ||
      '';

    const link =
      campana.urlDestino ||
      campana.url ||
      campana.link ||
      campana.href ||
      '';

    const titleText = campana.nombre || '';
    const bodyText = campana.cuerpo || '';

    if (banner) {
      const isMixed = (location.protocol === 'https:' && /^http:\/\//i.test(banner));
      if (isMixed) {
        console.warn('[PWA] Banner con http bajo https (mixed content):', banner);
      }

      item = document.createElement(link ? 'a' : 'div');
      if (link) {
        item.href = link;
        item.target = '_blank';
        item.rel = 'noopener noreferrer';
      }
      item.className = 'banner-item banner-con-imagen';

      const img = document.createElement('img');
      img.src = banner;
      img.alt = titleText || 'Promoción';
      img.loading = 'lazy';

      img.onerror = () => {
        console.warn('[PWA] Banner no cargó, fallback a texto:', banner);
        item.className = 'banner-item banner-item-texto';
        item.innerHTML = '';
        const t = document.createElement('h4');
        t.textContent = titleText || 'Promoción';
        item.appendChild(t);
        if (bodyText) {
          const p = document.createElement('p');
          p.textContent = bodyText;
          item.appendChild(p);
        }
      };

      item.appendChild(img);

      if (bodyText) {
        const textoOverlay = document.createElement('div');
        textoOverlay.className = 'banner-texto-overlay';
        const titulo = document.createElement('h4');
        titulo.textContent = titleText;
        const parrafo = document.createElement('p');
        parrafo.textContent = bodyText;
        textoOverlay.appendChild(titulo);
        textoOverlay.appendChild(parrafo);
        item.appendChild(textoOverlay);
      }

    } else {
      item = document.createElement('div');
      item.className = 'banner-item banner-item-texto';

      const title = document.createElement('h4');
      title.textContent = titleText || 'Promoción';
      item.appendChild(title);
      if (bodyText) {
        const description = document.createElement('p');
        description.textContent = bodyText;
        item.appendChild(description);
      }
    }

    carrusel.appendChild(item);

    const indicador = document.createElement('span');
    indicador.className = 'indicador';
    indicador.dataset.index = index;
    indicador.addEventListener('click', () => {
      const x = carrusel.children[index].offsetLeft;
      carrusel.scrollTo({ left: x, behavior: 'smooth' });
    });
    indicadoresContainer.appendChild(indicador);
  });

  const updateActiveIndicator = () => {
    const scrollLeft = carrusel.scrollLeft;
    const center = scrollLeft + carrusel.offsetWidth / 2;
    let currentIndex = 0;
    for (let i = 0; i < carrusel.children.length; i++) {
      const it = carrusel.children[i];
      const itCenter = it.offsetLeft + it.offsetWidth / 2;
      if (Math.abs(itCenter - center) < it.offsetWidth / 2) {
        currentIndex = i; break;
      }
    }
    indicadoresContainer.querySelectorAll('.indicador').forEach((ind, idx) => {
      ind.classList.toggle('activo', idx === currentIndex);
    });
  };

  const startCarousel = () => {
    if (carouselIntervalId) clearInterval(carouselIntervalId);
    carouselIntervalId = setInterval(() => {
      if (isDragging) return;
      const end = carrusel.scrollWidth - carrusel.clientWidth;
      if (carrusel.scrollLeft >= end - 1) {
        carrusel.scrollTo({ left: 0, behavior: 'smooth' });
      } else {
        const gap = parseFloat(getComputedStyle(carrusel).gap) || 0;
        const step = (carrusel.firstElementChild?.offsetWidth || 200) + gap;
        carrusel.scrollBy({ left: step, behavior: 'smooth' });
      }
    }, 3000);
  };
  const stopCarousel = () => clearInterval(carouselIntervalId);

  const dragStart = (e) => {
    isDragging = true;
    carrusel.classList.add('arrastrando');
    startX = (e.pageX || e.touches[0].pageX) - carrusel.offsetLeft;
    startScrollLeft = carrusel.scrollLeft;
    stopCarousel();
  };
  const dragStop = () => {
    isDragging = false;
    carrusel.classList.remove('arrastrando');
    startCarousel();
  };
  const dragging = (e) => {
    if (!isDragging) return;
    e.preventDefault();
    const x = (e.pageX || e.touches[0].pageX) - carrusel.offsetLeft;
    const walk = (x - startX) * 2;
    carrusel.scrollLeft = startScrollLeft - walk;
    updateActiveIndicator();
  };

  carrusel.addEventListener('mousedown', dragStart);
  carrusel.addEventListener('touchstart', dragStart, { passive: true });
  carrusel.addEventListener('mousemove', dragging);
  carrusel.addEventListener('touchmove', dragging, { passive: true });
  carrusel.addEventListener('mouseup', dragStop);
  carrusel.addEventListener('mouseleave', dragStop);
  carrusel.addEventListener('touchend', dragStop);
  carrusel.addEventListener('scroll', () => { if (!isDragging) updateActiveIndicator(); });

  updateActiveIndicator();
  if (campanasVisibles.length > 1) startCarousel();
}

// ─────────────────────────────────────────────────────────────
// Historial reciente (puntos + canjes)
// ─────────────────────────────────────────────────────────────
function parseDateLike(d) {
  if (!d) return null;
  if (typeof d?.toDate === 'function') return d.toDate();
  const t = new Date(d);
  return isNaN(t) ? null : t;
}

export function renderRecentHistory(cliente = {}) {
  const hp = Array.isArray(cliente.historialPuntos) ? cliente.historialPuntos : [];
  const hc = Array.isArray(cliente.historialCanjes) ? cliente.historialCanjes : [];

  const items = [];

  // Movimientos de puntos
  hp.forEach(i => {
    const fecha = parseDateLike(i.fechaObtencion);
    if (!fecha) return;
    const pts = Number(i?.puntosObtenidos ?? i?.puntosDisponibles ?? 0);
    const origen = i?.origen || (pts >= 0 ? 'Puntos' : 'Ajuste');
    items.push({
      ts: +fecha,
      texto: `${origen} ${pts >= 0 ? `(+${pts})` : `(${pts})`}`,
      fecha
    });
  });

  // Canjes
  hc.forEach(i => {
    const fecha = parseDateLike(i.fechaCanje);
    if (!fecha) return;
    const nombre = i?.nombrePremio || 'Premio';
    const coste = Number(i?.puntosCoste || 0);
    items.push({
      ts: +fecha,
      texto: `Canje: ${nombre} (-${coste} pts)`,
      fecha
    });
  });

  items.sort((a, b) => b.ts - a.ts);
  const top = items.slice(0, 5);

  const ul = document.getElementById('lista-historial');
  if (!ul) return;

  ul.innerHTML = top.length
    ? top.map(x => `<li>${x.texto} · <small>${x.fecha.toLocaleDateString('es-AR')}</small></li>`).join('')
    : `<li class="muted">Sin movimientos recientes</li>`;
}

// Re-render cuando se actualiza el cliente desde data.js
document.addEventListener('rampet:cliente-updated', (e) => {
  try { renderRecentHistory(e.detail?.cliente || {}); } catch { }
});

// ===== Perfil (modal) =====
function setVal(id, v) { const el = document.getElementById(id); if (el) el.value = v ?? ''; }
function setChecked(id, v) { const el = document.getElementById(id); if (el) el.checked = !!v; }
function setText(id, v) { const el = document.getElementById(id); if (el) el.textContent = v ?? '—'; }

// NUEVO: Reordenar secciones (Domicilio arriba, Preferencias al final)
function reorderProfileSections() {
  const modal = document.getElementById('profile-modal');
  if (!modal) return;

  const prefsSection =
    modal.querySelector('#profile-prefs-section, .profile-prefs, [data-section="prefs"], #profile-preferences, #prefs-section');

  let addressSection =
    modal.querySelector('#profile-address-section, .profile-address, [data-section="address"], #address-section');

  if (!addressSection) {
    const addrSummary = modal.querySelector('#prof-address-summary');
    if (addrSummary) {
      addressSection = addrSummary.closest('section, .profile-section, .card, .row, div');
    }
  }

  if (!prefsSection || !addressSection) return;

  const container =
    modal.querySelector('.modal-body, .content, .profile-body') || prefsSection.parentElement || modal;

  // Preferencias al final
  container.appendChild(prefsSection);
  // Domicilio inmediatamente antes de Preferencias
  container.insertBefore(addressSection, prefsSection);
}

async function syncProfileTogglesFromRuntime() {
  const c = (window.clienteData) || {};
  const cfg = c.config || {};
  const notifEl = document.getElementById('prof-consent-notif');
  const geoEl = document.getElementById('prof-consent-geo');

  if (notifEl) {
    if (typeof cfg.notifEnabled === 'boolean') {
      notifEl.checked = !!cfg.notifEnabled;
    }
    try {
      if (typeof Notification !== 'undefined') {
        const perm = Notification.permission; // granted | default | denied
        notifEl.title = (perm === 'denied')
          ? 'Bloqueado en el navegador'
          : 'Recibir avisos de descuentos y novedades';
      }
    } catch { }
  }

  if (geoEl) {
    if (typeof cfg.geoEnabled === 'boolean') {
      geoEl.checked = !!cfg.geoEnabled;
    }
    try {
      if (navigator.permissions?.query) {
        const st = await navigator.permissions.query({ name: 'geolocation' });
        geoEl.title = (st.state === 'denied')
          ? 'Ubicación deshabilitada en el navegador'
          : 'Activar beneficios en mi zona';
      }
    } catch { }
  }
}

export async function openProfileModal() {
  const m = document.getElementById('profile-modal');
  if (!m) return;

  // Reordenar secciones
  try { reorderProfileSections(); } catch { }

  // 1) Pintamos con lo que viene de Firestore
  const c = (window.clienteData) || {};
  setVal('prof-nombre', c.nombre || '');
  setVal('prof-telefono', c.telefono || '');
  setVal('prof-fecha', c.fechaNacimiento || '');
  setVal('prof-dni', c.dni || '');
  setVal('prof-email', c.email || '');
  const fb = readConsentFallback();
  setChecked('prof-consent-notif', c?.config?.notifEnabled ?? fb.notif);
  setChecked('prof-consent-geo', c?.config?.geoEnabled ?? fb.geo);
  const addr = c?.domicilio?.addressLine || '—';
  setText('prof-address-summary', addr);

  // 2) Mostramos ya el modal…
  m.style.display = 'flex';

  // 3) …y reconciliamos con el estado REAL del navegador (permiso actual)
  await syncProfileTogglesFromRuntime();
}

// === Guardar perfil y preferencias ===
document.getElementById('prof-save')?.addEventListener('click', onSaveProfilePrefs);
document.getElementById('prof-cancel')?.addEventListener('click', () => {
  closeProfileModal();
});
document.getElementById('profile-close')?.addEventListener('click', closeProfileModal);

async function onSaveProfilePrefs() {
  const btn = document.getElementById('prof-save');
  if (btn) btn.disabled = true;

  try {
    // 1) Datos básicos
    const nombre = document.getElementById('prof-nombre')?.value?.trim() || '';
    const telefono = document.getElementById('prof-telefono')?.value?.trim() || '';
    const fechaNacimiento = document.getElementById('prof-fecha')?.value || '';

    await Data.updateProfile({ nombre, telefono, fechaNacimiento });

    // 2) Preferencias
    const m = document.getElementById('profile-modal');
    const notifEl = m?.querySelector('#prof-consent-notif');
    const geoEl = m?.querySelector('#prof-consent-geo');

    // Debug inicial
    console.debug('[PROFILE/SAVE] wantNotif=', !!notifEl?.checked, ' wantGeo=', !!geoEl?.checked, ' perm=', window.Notification?.permission);

    // --- NOTIFICACIONES ---
    if (notifEl) {
      const wantNotif = !!notifEl.checked;

      if ('Notification' in window) {
        if (wantNotif) {
          if (Notification.permission !== 'granted') {
            await handlePermissionRequest();                      // pide permiso + token
          } else {
            await handlePermissionSwitch({ target: { checked: true } }); // (re)registra token
          }
          await Data.saveNotifConsent(true);
        } else {
          await handlePermissionSwitch({ target: { checked: false } });  // borra token
          await Data.saveNotifConsent(false);
        }
      } else {
        await Data.saveNotifConsent(false);
        notifEl.checked = false;
      }
    }

    // --- GEOLOCALIZACIÓN ---
    if (geoEl) {
      const wantGeo = !!geoEl.checked;
      if (wantGeo) {
        let granted = false;
        try {
          if (navigator.permissions?.query) {
            const st = await navigator.permissions.query({ name: 'geolocation' });
            granted = (st.state === 'granted');
          }
        } catch { }
        if (!granted && navigator.geolocation) {
          granted = await new Promise(res => {
            let done = false;
            navigator.geolocation.getCurrentPosition(
              () => { if (!done) { done = true; res(true); } },
              () => { if (!done) { done = true; res(false); } },
              { timeout: 7000, maximumAge: 0 }
            );
            setTimeout(() => { if (!done) { done = true; res(false); } }, 7500);
          });
        }
        if (granted) {
          await Data.saveGeoConsent(true);
        } else {
          await Data.saveGeoConsent(false);
          geoEl.checked = false;
          showToast('No pudimos activar ubicación. Revisá los permisos del navegador.', 'warning');
        }
      } else {
        await Data.saveGeoConsent(false);
      }
    }

    // (3) Refresco OPTIMISTA + evento
    try {
      const notifChecked = !!document.getElementById('prof-consent-notif')?.checked;
      const geoChecked = !!document.getElementById('prof-consent-geo')?.checked;
      console.debug('[PROFILE/SAVE] patchLocalConfig →', { notifEnabled: notifChecked, geoEnabled: geoChecked });
      await Data.patchLocalConfig({ notifEnabled: notifChecked, geoEnabled: geoChecked });
    } catch { }

    // (4) Refresco REAL cuando el navegador esté libre
    await (window.requestIdleCallback
      ? new Promise(resolve => requestIdleCallback(async () => {
        await syncProfileTogglesFromRuntime();
        resolve();
      }))
      : syncProfileTogglesFromRuntime());

    closeProfileModal();
    showToast('Cambios guardados', 'success');
  } catch (err) {
    console.error(err);
    showToast('No se pudo guardar', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
}

export function closeProfileModal() {
  const m = document.getElementById('profile-modal');
  if (m) m.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
// Inbox de Notificaciones (Modal)
// ─────────────────────────────────────────────────────────────
// ─────────────────────────────────────────────────────────────
// Inbox de Notificaciones (Modal)
// ─────────────────────────────────────────────────────────────
export async function openInboxModal() {
  const modal = document.getElementById('inbox-modal');
  const container = document.getElementById('inbox-items-container');
  if (!modal || !container) return;

  modal.style.display = 'flex';
  container.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">Cargando mensajes...</p>';

  // Wiring botón "Limpiar todo"
  const clearBtn = document.getElementById('clear-inbox-btn');
  if (clearBtn) {
    // Clonar para limpiar listeners previos
    const newBtn = clearBtn.cloneNode(true);
    clearBtn.parentNode.replaceChild(newBtn, clearBtn);
    newBtn.addEventListener('click', async () => {
      if (confirm('¿Borrar todos los mensajes?')) {
        try {
          await Data.clearInbox();
          openInboxModal(); // recargar
          showToast('Bandeja limpia', 'success');
        } catch (e) {
          console.error(e);
          showToast('Error al limpiar bandeja', 'error');
        }
      }
    });
  }

  try {
    const uid = firebase.auth().currentUser?.uid;
    if (!uid) {
      container.innerHTML = '<p style="text-align:center; margin-top:20px;">Debes iniciar sesión.</p>';
      return;
    }

    let clienteId = uid;
    try {
      if (Data && Data.getClienteDocIdPorUID) {
        clienteId = await Data.getClienteDocIdPorUID(uid) || uid;
      }
    } catch { }

    const snap = await firebase.firestore()
      .collection('clientes')
      .doc(clienteId)
      .collection('inbox')
      .orderBy('ts', 'desc')
      .limit(30)
      .get();

    if (snap.empty) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#888;">
          <div style="font-size:40px; margin-bottom:10px;">📭</div>
          <p>No tienes mensajes nuevos.</p>
        </div>`;
      return;
    }

    container.innerHTML = '';
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    snap.forEach(doc => {
      const d = doc.data();
      const id = doc.id;
      const date = d.ts ? new Date(d.ts) : new Date();
      const isToday = date >= startOfToday;
      const dateStr = isToday
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });

      // Clasificación de Tipo e Ícono
      let icon = '📢';
      let bgColor = '#fff';
      let iconBg = '#f0f0f0';

      const titleLower = (d.titulo || '').toLowerCase();
      const bodyLower = (d.cuerpo || '').toLowerCase();

      if (d.tipo === 'premio' || titleLower.includes('premio') || titleLower.includes('ganaste') || titleLower.includes('regalo')) {
        icon = '🎁'; iconBg = '#f3e5f5'; // Violeta claro
      } else if (titleLower.includes('puntos') || bodyLower.includes('puntos')) {
        icon = '🛍️'; iconBg = '#e8f5e9'; // Verde claro
      } else if (titleLower.includes('promo') || titleLower.includes('descuento')) {
        icon = '🔥'; iconBg = '#fff3e0'; // Naranja claro
      } else if (d.tipo === 'system' || titleLower.includes('sistema') || titleLower.includes('bienvenid')) {
        icon = '⚙️'; iconBg = '#eceff1'; // Gris
      }

      const item = document.createElement('div');
      item.className = 'inbox-item';
      item.style.cssText = `
        padding: 12px; 
        border-bottom: 1px solid #eee; 
        display: flex; 
        gap: 12px; 
        align-items: flex-start; 
        background-color: ${bgColor};
        position: relative;
      `;

      item.innerHTML = `
        <div style="
          width: 40px; height: 40px; 
          background: ${iconBg}; 
          border-radius: 50%; 
          display: flex; align-items: center; justify-content: center; 
          font-size: 20px; flex-shrink: 0;">
          ${icon}
        </div>
        <div style="flex:1; padding-right: 24px;"> <!-- padding para el delete btn -->
          <div style="display:flex; justify-content:space-between; margin-bottom:4px;">
            <strong style="font-size:0.95rem; color:#333;">${d.titulo || 'Mensaje'}</strong>
            <span style="font-size:0.75rem; color:#999; white-space:nowrap; margin-left:8px;">${dateStr}</span>
          </div>
          <p style="margin:0; font-size:0.9rem; color:#555; line-height:1.4;">${d.cuerpo || ''}</p>
        </div>
        <button class="delete-msg-btn" style="
          position: absolute; right: 10px; top: 12px;
          border: none; background: transparent; 
          color: #bbb; cursor: pointer; padding: 4px;">
          ✕
        </button>
      `;

      // Wire delete button
      item.querySelector('.delete-msg-btn').addEventListener('click', async (e) => {
        e.stopPropagation();
        if (confirm('¿Eliminar mensaje?')) {
          try {
            item.style.opacity = '0.5';
            await Data.deleteInboxItem(id);
            item.remove();
            // Si queda vacío
            if (!container.querySelector('.inbox-item')) {
              openInboxModal(); // refrescar empty state
            }
          } catch (err) {
            console.error(err);
            item.style.opacity = '1';
            showToast('Error al eliminar', 'error');
          }
        }
      });

      container.appendChild(item);
    });

  } catch (err) {
    console.warn('[Inbox] Error cargando mensajes:', err);
    container.innerHTML = '<p style="text-align:center; color:#d33; margin-top:20px;">Error al cargar mensajes.</p>';
  }
}

export function closeInboxModal() {
  const modal = document.getElementById('inbox-modal');
  if (modal) modal.style.display = 'none';
}

document.getElementById('close-inbox-modal')?.addEventListener('click', closeInboxModal);
document.getElementById('close-inbox-btn')?.addEventListener('click', closeInboxModal);

// Si cambian config/consentimientos mientras el modal está abierto, refrescamos switches
document.addEventListener('rampet:config-updated', () => {
  const m = document.getElementById('profile-modal');
  if (m && m.style.display === 'flex') { syncProfileTogglesFromRuntime(); }
});

