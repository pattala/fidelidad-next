// modules/ui.js (render principal, carrusel + historial + perfil)

import * as Data from './data.js';
import { handlePermissionRequest, handlePermissionSwitch } from './notifications.js';
import { auth, db } from './firebase.js'; // FIX: Imports necesarios

// ... (Resto del estado) ... 


let carouselIntervalId = null;
let isDragging = false, startX, startScrollLeft;
let unsubscribeInbox = null; // Store realtime subscription

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
  document.querySelectorAll('.screen').forEach(s => {
    s.classList.remove('active');
    s.style.display = ''; // 🛑 CLEANUP: Remove inline styles set during onboarding
  });
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
  // Asegurar que el listener de la campana esté hookeado
  const btnNotifs = document.getElementById('btn-notifs');
  if (btnNotifs) {
    // Clone para limpiar listeners viejos
    const newBtn = btnNotifs.cloneNode(true);
    btnNotifs.parentNode.replaceChild(newBtn, btnNotifs);
    newBtn.addEventListener('click', () => {
      openInboxModal();
    });
  }

  if (!clienteData) return;

  // -- LOGICA NOTIFICACIONES (REALTIME) --
  // Si ya tenemos suscripción, no la duplicamos. Si cambió el usuario, podríamos reiniciar,
  // pero por simplicidad asumimos SPA simple.
  if (!unsubscribeInbox) {
    let _firstLoad = true;
    unsubscribeInbox = Data.subscribeToUnreadInbox((count, changes) => {
      const btn = document.getElementById('btn-notifs');
      const badge = document.getElementById('notif-badge');

      if (btn) {
        if (count > 0) {
          btn.classList.add('blink-active');
          if (badge) {
            badge.textContent = count > 9 ? '9+' : String(count);
            badge.style.display = 'inline-block';
          }
        } else {
          btn.classList.remove('blink-active');
          if (badge) badge.style.display = 'none';
        }
      }

      // Detectar nuevos mensajes para mostrar popup
      if (_firstLoad) {
        _firstLoad = false;
        return;
      }

      if (changes && Array.isArray(changes)) {
        changes.forEach(change => {
          if (change.type === 'added') {
            const data = change.doc.data();
            const title = data.title || 'Nuevo Mensaje';
            // Solo notificamos si parece reciente (evitar repetidos si algo raro pasa)
            // Pero como filtramos firstLoad, asumimos que es realtime.
            showToast(`📩 ${title}`, 'info', 5000);

            // Opcional: Vibrar
            if (navigator.vibrate) try { navigator.vibrate(200); } catch { }
          }
        });
      }
    });
  }

  safeSetText('cliente-nombre', (clienteData.nombre || '--').split(' ')[0]);
  safeSetText('cliente-numero-socio', clienteData.numeroSocio ? `#${clienteData.numeroSocio}` : 'N° De Socio Pendiente de Aceptacion');
  safeSetText('cliente-puntos', clienteData.puntos || 0);

  // Tarjeta Misión: Completar Domicilio
  const missionAddress = document.getElementById('mission-address-card');
  if (missionAddress) {
    // Mostrar solo si NO tiene calle Y NO lo ha descartado explícitamente
    const hasAddress = clienteData.domicilio && clienteData.domicilio.calle && clienteData.domicilio.calle.length > 0;
    const isDismissed = clienteData.config && clienteData.config.addressPromptDismissed === true;

    if (!hasAddress && !isDismissed) {
      missionAddress.style.display = 'block';
      // Hookear botón "completar"
      const btn = missionAddress.querySelector('button');
      if (btn) {
        // Clonar para limpiar listeners previos
        const newBtn = btn.cloneNode(true);
        btn.parentNode.replaceChild(newBtn, btn);
        newBtn.addEventListener('click', () => {
          openProfileModal();
        });
      }
    } else {
      missionAddress.style.display = 'none';
    }
  }
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

// NUEVO: Modal de Bienvenida Forzado
function showWelcomeModal(title, body) {
  // Usamos el confirm modal genérico pero con un solo botón "Entendido"
  // O creamos uno ad-hoc si showConfirmModal tiene 2. 
  // Por rapidez, inyectamos un modal simple o reusamos confirm con 1 solo boton.

  // Hack: Reusar confirm modal escondiendo el boton Cancelar
  const m = document.getElementById('confirm-modal');
  if (!m) return alert(`${title}\n\n${body}`);

  const t = document.getElementById('confirm-title');
  const b = document.getElementById('confirm-message');
  const btnYs = document.getElementById('confirm-btn-ok');
  const btnNo = document.getElementById('confirm-btn-cancel');

  if (t) t.textContent = title || '¡Bienvenido!';
  if (b) b.textContent = body || '';

  if (btnYs) {
    btnYs.textContent = '¡Gracias!';
    const newYs = btnYs.cloneNode(true);
    btnYs.parentNode.replaceChild(newYs, btnYs);
    newYs.onclick = () => {
      m.style.display = 'none';
      if (btnNo) btnNo.style.display = 'initial'; // Restore
    };
  }
  if (btnNo) btnNo.style.display = 'none'; // Hide Cancel

  m.style.display = 'flex';
}

// ... existing code ...

// -- LOGICA NOTIFICACIONES (REALTIME) --
if (!unsubscribeInbox && clienteData?.id) {
  let _firstLoad = true;
  unsubscribeInbox = Data.subscribeToUnreadInbox(clienteData.id, (snap) => {
    const count = snap.size;
    const changes = snap.docChanges();

    // 1. SIEMPRE Actualizar Badge (Corrección clave)
    const btn = document.getElementById('btn-notifs');
    const badge = document.getElementById('notif-badge');
    if (btn) {
      if (count > 0) {
        btn.classList.add('blink-active');
        if (badge) {
          badge.textContent = count > 9 ? '9+' : String(count);
          badge.style.display = 'inline-block';
        }
      } else {
        btn.classList.remove('blink-active');
        if (badge) badge.style.display = 'none';
      }
    }

    // 2. Manejo de Popups / Bienvenida
    if (_firstLoad) {
      // Buscar mensaje de bienvenida NO visto en localstorage
      const welcomeKey = 'welcome_modal_seen_' + (auth.currentUser?.uid || '');
      const hasSeen = localStorage.getItem(welcomeKey);

      if (!hasSeen) {
        const welcomeMsg = snap.docs.find(d => {
          const t = (d.data().title || '').toLowerCase();
          return t.includes('bienvenida') || t.includes('bienvenido');
        });

        if (welcomeMsg) {
          const d = welcomeMsg.data();
          showWelcomeModal(d.title, d.body);
          localStorage.setItem(welcomeKey, 'true');
        }
      }

      _firstLoad = false;
      return;
    }

    // 3. Realtime Toasts (para mensajes nuevos MIENTRAS usas la app)
    if (changes && Array.isArray(changes)) {
      changes.forEach(change => {
        if (change.type === 'added') {
          const data = change.doc.data();
          const title = data.title || 'Nuevo Mensaje';
          showToast(`📩 ${title}`, 'info', 5000);
          if (navigator.vibrate) try { navigator.vibrate(200); } catch { }
        }
      });
    }
  });
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

  // Listener GLOBAL para ocultar banner de domicilio cuando se completa
  document.addEventListener('rampet:address:dismissed', () => {
    console.log('[UI] Address Dismissed Event Recibido');

    // Fuerza bruta visual con !important
    const missionCard = document.getElementById('mission-address-card');
    if (missionCard) {
      missionCard.setAttribute('style', 'display: none !important');
    }

    const addressCard = document.getElementById('address-card');
    if (addressCard) {
      addressCard.style.display = 'none';
      const container = document.querySelector('.container') || document.body;
      container.appendChild(addressCard);
    }

    // Limpiar slot de geo si hubiera
    const slot = document.getElementById('geo-context-slot');
    if (slot) slot.innerHTML = '';

    // Update State for logic checks
    if (window.clienteData) {
      window.clienteData.domicilio = window.clienteData.domicilio || {};
      window.clienteData.domicilio.status = 'COMPLETE';
    }
  });
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


  // --- Botón de Pánico: Reparar Notificaciones (PC Debug) ---
  const parent = notifEl?.closest('.form-group') || notifEl?.parentElement;
  if (parent && !document.getElementById('btn-fix-push-ui')) {
    const fixBtn = document.createElement('button');
    fixBtn.id = 'btn-fix-push-ui';
    fixBtn.type = 'button';
    fixBtn.className = 'btn-text-danger';
    fixBtn.style.cssText = 'font-size: 0.8rem; margin-top: 5px; text-decoration: underline; background:none; border:none; cursor:pointer; color: #ff4444;';
    fixBtn.textContent = '¿No llegan? Reparar Notificaciones';
    fixBtn.onclick = async (e) => {
      e.preventDefault();
      if (!confirm('Esto reiniciará la conexión de notificaciones. ¿Continuar?')) return;

      const { hardResetFcmStores } = await import('./notifications.js');
      showToast('Reparando...', 'info');
      await hardResetFcmStores();
      showToast('Listo. Recargando...', 'success');
      setTimeout(() => location.reload(), 1000);
    };
    parent.appendChild(fixBtn);
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

  // -- POPULATE ADDRESS FORM (Fix) --
  const comps = c?.domicilio?.components || {};
  setVal('dom-calle', comps.calle);
  setVal('dom-numero', comps.numero);
  setVal('dom-piso', comps.piso);
  setVal('dom-depto', comps.depto);
  setVal('dom-cp', comps.codigoPostal || comps.cp);
  setVal('dom-referencia', comps.referencia);
  // Selects/Inputs simples (sin logica de carga dinamica compleja por ahora)
  setVal('dom-provincia', comps.provincia);
  setVal('dom-partido', comps.partido);
  setVal('dom-localidad', comps.localidad);
  setVal('dom-pais', comps.pais || 'Argentina');

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

    // (4) Refresco REAL
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

// === Guardar Domicilio ===
document.getElementById('address-save')?.addEventListener('click', async () => {
  const btn = document.getElementById('address-save');
  if (btn) btn.disabled = true;

  try {
    const dom = {
      calle: document.getElementById('dom-calle')?.value?.trim() || '',
      numero: document.getElementById('dom-numero')?.value?.trim() || '',
      piso: document.getElementById('dom-piso')?.value?.trim() || '',
      depto: document.getElementById('dom-depto')?.value?.trim() || '',
      localidad: document.getElementById('dom-localidad')?.value?.trim() || '',
      partido: document.getElementById('dom-partido')?.value?.trim() || '',
      provincia: document.getElementById('dom-provincia')?.value || '',
      cp: document.getElementById('dom-cp')?.value?.trim() || '',
      pais: document.getElementById('dom-pais')?.value?.trim() || '',
      referencia: document.getElementById('dom-referencia')?.value?.trim() || ''
    };

    await Data.updateAddress(dom);

    // UI Feedback
    const card = document.getElementById('address-card');
    if (card) card.style.display = 'none'; // Ocultar form tras guardar

    showToast('Domicilio guardado. ¡Gracias!', 'success');

    // Disparar evento de dismissed para que no vuelva a molestar
    document.dispatchEvent(new CustomEvent('rampet:address:dismissed'));

    // ─────────────────────────────────────────────
    // GAMIFICATION: Validar si completó todo y premiar
    // ─────────────────────────────────────────────
    if (dom.calle && dom.numero && dom.provincia && (dom.localidad || dom.partido || dom.provincia === 'CABA')) {
      try {
        const token = await auth.currentUser.getIdToken();
        fetch('/api/assign-points', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'profile_address' })
        }).then(r => r.json()).then(d => {
          if (d.ok && d.pointsAdded > 0) {
            showToast(`¡Genial! Ganaste +${d.pointsAdded} Puntos por completar tus datos 🎁`, 'success');
          }
        }).catch(err => console.warn('[PWA] Error asignando puntos domicilio:', err));
      } catch (eToken) { console.warn('[PWA] No token for points:', eToken); }
    }
  } catch (e) {
    console.error(e);
    showToast('Error al guardar domicilio', 'error');
  } finally {
    if (btn) btn.disabled = false;
  }
});

export function closeProfileModal() {
  const m = document.getElementById('profile-modal');
  if (m) m.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
// Confirmación Custom (para que parezca nativo de App)
// ─────────────────────────────────────────────────────────────
export function showConfirmModal(title, msg) {
  return new Promise((resolve) => {
    const m = document.getElementById('confirm-modal');
    const t = document.getElementById('confirm-title');
    const b = document.getElementById('confirm-message');
    const btnYs = document.getElementById('confirm-btn-ok');
    const btnNo = document.getElementById('confirm-btn-cancel');

    if (!m) return resolve(window.confirm(`${title}\n${msg}`)); // Fallback seguro

    t.textContent = title;
    b.textContent = msg;
    m.style.display = 'flex';

    // Cleanup listeners anteriores (clonando)
    const newYs = btnYs.cloneNode(true);
    const newNo = btnNo.cloneNode(true);
    btnYs.parentNode.replaceChild(newYs, btnYs);
    btnNo.parentNode.replaceChild(newNo, btnNo);

    const close = (val) => {
      m.style.display = 'none';
      resolve(val);
    };

    newYs.addEventListener('click', () => close(true));
    newNo.addEventListener('click', () => close(false));
  });
}

// ─────────────────────────────────────────────────────────────
// Badge de Notificaciones
// ─────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────
// Badge de Notificaciones
// ─────────────────────────────────────────────────────────────
export async function checkUnreadMessages() {
  try {
    const btn = document.getElementById('btn-notifs');
    if (!btn) return;

    const uid = auth.currentUser?.uid;
    if (!uid) return;

    let clienteId = uid;
    try { if (Data?.getClienteDocIdPorUID) clienteId = await Data.getClienteDocIdPorUID(uid) || uid; } catch { }

    const snap = await db.collection('clientes')
      .doc(clienteId)
      .collection('inbox')
      .where('read', '==', false)
      .limit(50)
      .get();

    const count = snap.size;
    const badge = document.getElementById('notif-badge');

    btn.classList.remove('has-unread', 'blink-active');

    if (count > 0) {
      btn.classList.add('blink-active');
      if (badge) {
        badge.textContent = count > 9 ? '9+' : String(count);
        badge.style.display = 'inline-block';
      }
    } else {
      if (badge) badge.style.display = 'none';
    }
  } catch (e) { console.warn('[UI] checkUnreadMessages error', e); }
}

// Wire up global events
document.addEventListener('rampet:notification-received', () => {
  checkUnreadMessages();
});
document.addEventListener('DOMContentLoaded', () => {
  setTimeout(checkUnreadMessages, 3000);
});

// ─────────────────────────────────────────────────────────────
// Inbox de Notificaciones (Modal)
// ─────────────────────────────────────────────────────────────
export async function openInboxModal() {
  const modal = document.getElementById('inbox-modal');
  const container = document.getElementById('inbox-items-container');
  if (!modal || !container) return;

  modal.style.display = 'flex';
  container.innerHTML = '<p style="text-align:center; color:#999; margin-top:20px;">Cargando mensajes...</p>';

  const btnNotifs = document.getElementById('btn-notifs');
  const badge = document.getElementById('notif-badge');

  if (btnNotifs) btnNotifs.classList.remove('blink-active', 'has-unread');
  if (badge) badge.style.display = 'none';

  // -- AUTO-CLEANUP: Límite de 20 mensajes --
  try {
    await Data.enforceInboxLimit(20);
  } catch (e) { console.warn('Inbox limit check fail', e); }

  // -- Toolbar de Selección Múltiple --
  let toolbar = document.getElementById('inbox-toolbar-custom');
  if (!toolbar) {
    toolbar = document.createElement('div');
    toolbar.id = 'inbox-toolbar-custom';
    toolbar.className = 'inbox-toolbar';
    toolbar.style.display = 'none';

    toolbar.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <input type="checkbox" id="inbox-select-all" style="width:18px; height:18px;">
          <label for="inbox-select-all" style="font-size:0.9rem; cursor:pointer;">Todos</label>
        </div>
        <button id="inbox-delete-selected" class="btn-text-danger" style="color:red; font-size:0.9rem; background:none; border:none; cursor:pointer; opacity:0.5; pointer-events:none;">
          Borrar Seleccionados
        </button>
      `;
    container.parentElement.insertBefore(toolbar, container);
  }

  const checkAll = document.getElementById('inbox-select-all');
  const btnDelete = document.getElementById('inbox-delete-selected');
  if (checkAll) checkAll.checked = false;

  const updateDeleteBtn = () => {
    const selected = container.querySelectorAll('.inbox-select-check:checked');
    const count = selected.length;
    btnDelete.style.opacity = count > 0 ? '1' : '0.5';
    btnDelete.style.pointerEvents = count > 0 ? 'auto' : 'none';
    btnDelete.textContent = count > 0 ? `Borrar (${count})` : 'Borrar Seleccionados';

    const allChecks = container.querySelectorAll('.inbox-select-check');
    if (allChecks.length > 0 && selected.length === allChecks.length) checkAll.checked = true;
    else checkAll.checked = false;
  };

  if (checkAll) {
    checkAll.onclick = () => {
      const checks = container.querySelectorAll('.inbox-select-check');
      checks.forEach(c => c.checked = checkAll.checked);
      updateDeleteBtn();
    };
  }

  btnDelete.onclick = async () => {
    const selected = Array.from(container.querySelectorAll('.inbox-select-check:checked'));
    if (!selected.length) return;

    const ok = await showConfirmModal('Borrar Mensajes', `¿Eliminar ${selected.length} mensajes seleccionados?`);
    if (ok) {
      const ids = selected.map(el => el.value);
      try {
        container.innerHTML = '<p style="text-align:center; color:#999;">Borrando...</p>';
        await Data.deleteInboxMessages(ids);
        showToast('Mensajes eliminados', 'success');
        openInboxModal();
      } catch (e) {
        console.error(e);
        showToast('Error al borrar', 'error');
        openInboxModal();
      }
    }
  };

  try {
    const user = auth.currentUser;
    if (!user) {
      container.innerHTML = '<p style="text-align:center; margin-top:20px;">Debes iniciar sesión.</p>';
      return;
    }

    const msgs = await Data.getInboxMessages(50);

    if (!msgs || msgs.length === 0) {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:#888;">
          <div style="font-size:40px; margin-bottom:10px;">📭</div>
          <p>No tienes mensajes nuevos.</p>
        </div>`;
      if (toolbar) toolbar.style.display = 'none';
      return;
    }

    if (toolbar) toolbar.style.display = 'flex';
    container.innerHTML = '';

    // Render Items
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    msgs.forEach(d => {
      const date = d.ts ? new Date(d.ts) : new Date();
      const isToday = date >= startOfToday;
      const dateStr = isToday
        ? date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : date.toLocaleDateString([], { day: '2-digit', month: '2-digit' });

      let icon = '📢';
      let iconBg = '#f0f0f0';
      const titleLower = (d.titulo || '').toLowerCase();

      if (d.tipo === 'premio' || titleLower.includes('premio') || titleLower.includes('ganaste')) {
        icon = '🎁'; iconBg = '#f3e5f5';
      } else if (titleLower.includes('puntos')) {
        icon = '🛍️'; iconBg = '#e8f5e9';
      }

      const item = document.createElement('div');
      item.className = 'inbox-item';
      if (!d.read) item.classList.add('destacado');

      item.innerHTML = `
        <input type="checkbox" class="inbox-select-check" value="${d.id}" onclick="event.stopPropagation()">
        
        <div style="width:40px; height:40px; border-radius:50%; background:${iconBg}; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
          ${icon}
        </div>
        <div class="inbox-content-wrapper">
          <div class="inbox-title">
            ${d.titulo || 'Mensaje'}
            ${!d.read ? '<span class="chip-destacado">Nuevo</span>' : ''}
          </div>
          <div class="inbox-body">${d.cuerpo || ''}</div>
          <small class="inbox-date">${dateStr}</small>
        </div>
      `;

      item.onclick = async (e) => {
        console.log('[UI] Inbox Item Clicked:', d.id);

        // Evitar conflictos con el checkbox
        if (e.target.classList && e.target.classList.contains('inbox-select-check')) return;
        if (e.target.closest('.inbox-select-check')) return;

        // Evitar navegación default si es un enlace envuelto incorrectamente
        e.preventDefault();

        // 1. Marcar como leído visualmente + BD
        try {
          // Feedback inmediato en UI: quitar destacado y etiqueta "Nuevo"
          if (item.classList.contains('destacado')) {
            item.classList.remove('destacado');
            const chip = item.querySelector('.chip-destacado');
            if (chip) chip.remove();
            // Call Async but don't wait for UI update
            Data.markInboxAsRead(d.id).catch(err => console.warn('Read mark fail', err));
          }
        } catch (err) { console.warn(err); }

        // 2. Navegación inteligente
        const targetUrl = d.url || d.click_action;

        // Si hay una URL válida y NO es un hash vacío o la misma página
        if (targetUrl && targetUrl !== '#' && !targetUrl.endsWith(location.pathname)) {
          console.log('[UI] Navigating to:', targetUrl);
          if (targetUrl.startsWith('http')) {
            window.open(targetUrl, '_blank');
          } else {
            window.location.href = targetUrl;
          }
        }
        // Si NO hay URL, Expandir (Toggle Class)
        else {
          console.log('[UI] Toggling expansion. Current:', item.classList.contains('expanded'));
          item.classList.toggle('expanded');
          console.log('[UI] New State:', item.classList.contains('expanded'));
        }
      };

      item.querySelector('.inbox-select-check').addEventListener('change', updateDeleteBtn);

      container.appendChild(item);
    });

  } catch (err) {
    console.error('[UI] Inbox load error:', err);
    container.innerHTML = '<p style="text-align:center; color:#999;">Error al cargar mensajes.</p>';
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

