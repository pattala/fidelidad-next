// panel-administrador/modules/clientes.js (LIMPIO + GEO CHIP LISTA)
// ─────────────────────────────────────────────────────────────
// Importes
// ─────────────────────────────────────────────────────────────
import { db, /* auth, */ firebase } from './firebase.js';
import { appData } from './data.js';
import * as UI from './ui.js';
import { CABA_BARRIOS, BA_LOCALIDADES_BY_PARTIDO } from './geo-catalogs.js';

// ─────────────────────────────────────────────────────────────
// Helpers mínimos
// ─────────────────────────────────────────────────────────────
function _qs(id) { return document.getElementById(id); }
function _safeStr(v) {
  return (v ?? '').toString().normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase().trim();
}
function _debounce(fn, ms = 250) {
  let t; return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
function _regCounterEl() {
  // evita el problema de ID duplicado en index.html
  return document.getElementById('contador-nuevos-registros')
    || document.getElementById('reg-total');
}
function _safeDateStr(rawFecha) {
  if (!rawFecha) return '—';
  if (typeof rawFecha === 'string') return rawFecha.split('T')[0];
  if (rawFecha.toDate) return rawFecha.toDate().toISOString().split('T')[0];
  return '—';
}
// ─────────────────────────────────────────────────────────────
// ====== REGISTROS (Listado, filtros, búsqueda, contador) ======
// ─────────────────────────────────────────────────────────────
let __registrosUnsub = null;
let __registrosAll = []; // cache local

function __matchSearch(c, term) {
  if (!term) return true;
  const s = _safeStr(term);
  return [
    _safeStr(c.nombre),
    _safeStr(c.dni),
    _safeStr(c.email),
    _safeStr(c.numeroSocio),
  ].some(x => x.includes(s));
}

function __origenLabel(origenKey) {
  const v = (origenKey || 'unknown').toLowerCase();
  if (v.includes('pwa')) return '<span class="badge" style="background:#0ea5e9">PWA</span>';
  if (v.includes('panel') || v.includes('admin')) return '<span class="badge" style="background:#22c55e">Panel</span>';
  return '<span class="badge" style="background:#9ca3af">—</span>';
}

// Chip visual Geo ON/OFF
function __geoBadge(isOn, updatedStr) {
  const baseStyle = 'display:inline-flex;align-items:center;gap:6px;padding:2px 8px;border-radius:999px;font-size:12px;margin-left:6px;';
  const onStyle = 'background:#dcfce7;color:#166534;';
  const offStyle = 'background:#e5e7eb;color:#374151;';
  const title = isOn
    ? `Geo: ACTIVA${updatedStr ? ' • act. ' + updatedStr : ''}`
    : 'Geo: desactivada';
  return `
    <span class="flag-geo${isOn ? ' on' : ''}" style="${baseStyle}${isOn ? onStyle : offStyle}" title="${title}">
      <svg viewBox="0 0 24 24" width="14" height="14" style="fill:currentColor;opacity:.9;">
        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5a2.5 2.5 0 110-5 2.5 2.5 0 010 5z"/>
      </svg>
      <span>${isOn ? 'Geo ON' : 'Geo OFF'}</span>
    </span>
  `;
}

function __renderRegistros(rows) {
  try {
    const tbody = document.getElementById('tabla-registros-body');
    if (!tbody) {
      console.warn('[registros] Falta #tabla-registros-body. Reintento…');
      setTimeout(() => __renderRegistros(rows), 80);
      return;
    }

    tbody.innerHTML = '';
    rows.forEach(c => {
      const tr = document.createElement('tr');
      const originHtml = `${__origenLabel(c.__origenKey)}${__geoBadge(!!c.__geoOn, c.__geoUpdatedStr || '')}`;
      tr.innerHTML = `
        <td><input type="checkbox" class="checkbox-eliminar-registro" data-id="${c.id}"></td>
        <td>${c.numeroSocio ?? '—'}</td>
        <td>${c.nombre ?? '—'}</td>
        <td>${c.email ?? '—'}</td>
        <td>${originHtml}</td>
        <td>${c.__fechaStr ?? '—'}</td>
        <td>
          <div style="display:flex; gap:6px; align-items:center;">
            <button class="primary-btn btn-ver-ficha" data-id="${c.id}" style="min-width:90px;padding:6px 10px;">Ver Ficha</button>
            <button class="danger-btn btn-eliminar-reg" data-id="${c.id}" style="min-width:90px;padding:6px 10px;">Eliminar</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });

    // Contadores
    const local = document.getElementById('reg-total');
    if (local) local.textContent = rows.length.toString();
    const badgeTab = document.getElementById('contador-nuevos-registros');
    if (badgeTab) {
      badgeTab.style.display = rows.length > 0 ? 'inline-block' : 'none';
      badgeTab.textContent = rows.length.toString();
    }

    // Botón eliminar seleccionados + maestro
    const btn = document.getElementById('btn-eliminar-seleccionados');
    const master = document.getElementById('seleccionar-todos-nuevos-registros');
    if (btn) {
      const anyChecked = tbody.querySelectorAll('.checkbox-eliminar-registro:checked').length > 0;
      btn.style.display = anyChecked ? 'inline-block' : 'none';
    }
    if (master) master.checked = false;

    // Acciones por fila
    tbody.querySelectorAll('.btn-ver-ficha').forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.dataset.id;
        // fallback a cache local si appData aún no está poblado
        const cli = (appData.clientes && appData.clientes.find(c => c.id === id))
          || (__registrosAll.find(c => c.id === id));
        if (!cli) return UI.showToast('No se encontró el cliente.', 'warning');
        UI.openTab?.('ficha');
        const ident = (cli.numeroSocio ?? cli.dni ?? '').toString();
        if (ident) mostrarFichaCliente(ident);
      });
    });
    tbody.querySelectorAll('.btn-eliminar-reg').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        await eliminarClienteHandler(id);
      });
    });

    console.log('[registros] render filas =', rows.length);
  } catch (e) {
    console.error('[registros] error en __renderRegistros:', e);
  }
}

// Sugerencias predictivas (datalist)
function __buildSuggestTokens(c) {
  const tokens = [];
  if (c.numeroSocio) tokens.push(String(c.numeroSocio));
  if (c.dni) tokens.push(String(c.dni));
  if (c.nombre) tokens.push(String(c.nombre));
  if (c.email) tokens.push(String(c.email));
  return tokens;
}
function __updateRegSuggestions() {
  const dl = document.getElementById('reg-suggestions');
  const input = document.getElementById('reg-search');
  if (!dl || !input) return;

  const term = (input.value || '').toLowerCase().trim();
  const set = new Set();
  __registrosAll.forEach(c => {
    __buildSuggestTokens(c).forEach(t => {
      const v = String(t).trim();
      if (!v) return;
      if (!term || v.toLowerCase().includes(term)) set.add(v);
    });
  });

  const items = Array.from(set).slice(0, 50);
  dl.innerHTML = '';
  items.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    dl.appendChild(opt);
  });
}

function __applyRegistrosFilters() {
  const sel = document.getElementById('reg-origin'); // 'all' | 'pwa' | 'panel'
  const q = document.getElementById('reg-search');

  const origen = (sel?.value || 'all').toLowerCase();
  const term = q?.value || '';

  const filtered = __registrosAll.filter(c => {
    const okOrigen = (origen === 'all') ? true : (c.__origenKey === origen);
    const okSearch = __matchSearch(c, term);
    return okOrigen && okSearch;
  });

  __renderRegistros(filtered);
}
const __applyRegistrosFiltersDebounced = _debounce(__applyRegistrosFilters, 200);

// Normalizador de documentos (alias y flags)
async function __mapDoc(d) {
  const data = d.data() || {};

  // origen: contempla alias históricos
  const rawSource = [
    data.origenAlta,
    data.source,
    data.creadoDesde,
    data?.metadata?.createdFrom,
    data?.tyc?.source
  ].map(v => (v || '').toString().toLowerCase()).find(Boolean) || '';

  let origenKey = 'unknown';
  if (rawSource.includes('pwa')) origenKey = 'pwa';
  else if (rawSource.includes('panel') || rawSource.includes('admin')) origenKey = 'panel';

  // fecha: acepta múltiples alias
  const rawFecha =
    data.fechaInscripcion ||
    data.fechaRegistro ||
    data.createdAt ||
    data.created_at || null;

  // geo flags
  const geoEnabled = !!(data?.config?.geoEnabled);
  const geoUpdatedAt = data?.config?.geoUpdatedAt || null;

  return {
    id: d.id,
    ...data,
    __origenKey: origenKey,
    __fechaStr: _safeDateStr(rawFecha),
    __sortMs: (typeof rawFecha === 'string')
      ? (Date.parse(rawFecha) || 0)
      : (rawFecha && rawFecha.toDate ? rawFecha.toDate().getTime() : 0),
    __geoOn: geoEnabled,
    __geoUpdatedStr: _safeDateStr(geoUpdatedAt)
  };
}

async function __subscribeRegistros() {
  if (__registrosUnsub) { try { __registrosUnsub(); } catch { } __registrosUnsub = null; }

  // sanity check de DOM (esperar tabla + tbody)
  const hasTable = document.getElementById('tabla-registros');
  const hasBody = document.getElementById('tabla-registros-body');
  if (!hasTable || !hasBody) {
    console.warn('[registros] Falta tabla o tbody. Reintento de suscripción…');
    setTimeout(__subscribeRegistros, 120);
    return;
  }

  console.log('[registros] suscribiendo a clientes…');
  const q = db.collection('clientes'); // sin orderBy para evitar índice

  // Fallback: primer get() inmediato para no depender de cache del listener
  try {
    const first = await q.limit(50).get();
    const preRows = await Promise.all(first.docs.map(__mapDoc));
    preRows.sort((a, b) => (b.__sortMs || 0) - (a.__sortMs || 0));
    __registrosAll = preRows;
    __applyRegistrosFilters();
  } catch (e) {
    console.warn('[registros] primer get() falló:', e?.message || e);
  }

  // Listener tiempo real
  __registrosUnsub = q.onSnapshot({
    includeMetadataChanges: true
  }, async (snap) => {
    console.log('[registros] snapshot size =', snap.size, ' fromCache=', snap.metadata?.fromCache);
    const rows = await Promise.all(snap.docs.map(__mapDoc));
    rows.sort((a, b) => (b.__sortMs || 0) - (a.__sortMs || 0));
    __registrosAll = rows;
    __applyRegistrosFilters();
    try { __updateRegSuggestions(); } catch { }
  }, (err) => {
    console.warn('[registros] onSnapshot error:', err);
  });
}

export function initRegistrosTab() {
  console.log('[registros] initRegistrosTab() - Bindings UI');

  // Filtros
  document.getElementById('reg-origin')?.addEventListener('change', __applyRegistrosFilters);
  document.getElementById('reg-search')?.addEventListener('input', __applyRegistrosFiltersDebounced);

  // Seleccionar todos
  document.getElementById('seleccionar-todos-nuevos-registros')?.addEventListener('change', (e) => {
    const isChecked = e.target.checked;
    document.querySelectorAll('.checkbox-eliminar-registro').forEach(cb => cb.checked = isChecked);
    const btn = document.getElementById('btn-eliminar-seleccionados');
    if (btn) btn.style.display = isChecked || document.querySelectorAll('.checkbox-eliminar-registro:checked').length > 0
      ? 'inline-block'
      : 'none';
  });

  // Mostrar/ocultar botón cuando marcan individuales
  document.addEventListener('change', (e) => {
    if (!(e.target instanceof HTMLInputElement)) return;
    if (!e.target.classList.contains('checkbox-eliminar-registro')) return;
    const anyChecked = document.querySelectorAll('.checkbox-eliminar-registro:checked').length > 0;
    const btn = document.getElementById('btn-eliminar-seleccionados');
    if (btn) btn.style.display = anyChecked ? 'inline-block' : 'none';
  });

  // Autocomplete predictivo (si existe)
  document.getElementById('reg-search')?.addEventListener('input', () => {
    try { __updateRegSuggestions(); } catch { }
    __applyRegistrosFiltersDebounced();
  });
  document.getElementById('reg-search')?.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') __applyRegistrosFilters();
  });
}

export function startRegistrosListener() {
  console.log('[registros] startRegistrosListener() - Iniciando espera de tabla...');
  // Esperar a que exista la tabla y el tbody antes de suscribir
  (function ensureTableThenSubscribe() {
    if (document.getElementById('tabla-registros') && document.getElementById('tabla-registros-body')) {
      console.log('[registros] tabla encontrada, suscribiendo…');
      __subscribeRegistros();
    } else {
      setTimeout(ensureTableThenSubscribe, 100);
    }
  })();
}


// ─────────────────────────────────────────────────────────────
// Nro de socio (API Vercel) + flag de bienvenida
// ─────────────────────────────────────────────────────────────
function generarNuevoNumeroSocio() {
  if (!appData.clientes || appData.clientes.length === 0) return 1;
  const numeros = appData.clientes
    .map(c => c.numeroSocio)
    .filter(num => !isNaN(num) && num !== null);
  return numeros.length > 0 ? Math.max(...numeros) + 1 : 1;
}

async function _assignNumeroSocio(docId, sendWelcome = false) {
  try {
    const NOTIF_BASE = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.apiUrl) || '';
    const API_KEY = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.apiKey) || '';

    const body = { docId, sendWelcome };
    const targetUrl = `${NOTIF_BASE}/api/assign-socio-number`;
    console.warn('[assign-socio] 🚀 FETCH TARGET:', targetUrl);
    console.log('[assign-socio] payload:', body);

    const r = await fetch(targetUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
      body: JSON.stringify(body)
    });

    const j = await r.json().catch(() => ({}));
    console.log('[assign-socio-number] response:', r.status, j);
    return { ok: r.ok, status: r.status, data: j };
  } catch (err) {
    console.warn('[assign-socio-number] error', err);
    return { ok: false, status: 0, data: { error: String(err) } };
  }
}

function _readSendWelcomeFlag() {
  const cfgDefault = appData?.config?.principal?.sendWelcomeByDefault === true;
  const el = document.getElementById('nuevo-enviar-bienvenida');
  if (!el) {
    console.warn('[panel] Checkbox #nuevo-enviar-bienvenida NO existe. Usando default de config:', cfgDefault);
    return cfgDefault;
  }
  return el.checked || cfgDefault;
}

// ─────────────────────────────────────────────────────────────
// DOMICILIO: composición de addressLine + UI dependiente
// ─────────────────────────────────────────────────────────────
function _composeAddressLine(components) {
  const c = components || {};
  const parts = [];

  // Calle y número + piso/depto opcionales
  if (c.calle && c.numero) {
    let street = `${c.calle} ${c.numero}`;
    if (c.piso) street += `, Piso ${c.piso}`;
    if (c.depto) street += `, Depto ${c.depto}`;
    parts.push(street);
  } else if (c.calle) {
    parts.push(c.calle);
  }

  // CP + localidad/barrio
  const cp = (c.codigoPostal || '').trim();
  const loc = (c.localidad || c.barrio || '').trim();
  if (cp || loc) {
    const cpLoc = [cp, loc].filter(Boolean).join(' ');
    if (cpLoc) parts.push(cpLoc);
  }

  // Partido/Provincia
  if (c.provincia === 'Buenos Aires') {
    if (c.partido) parts.push(c.partido);
    parts.push('Buenos Aires');
  } else if (c.provincia === 'CABA') {
    parts.push('CABA');
  } else {
    if (c.provincia) parts.push(c.provincia);
  }

  // País
  if (c.pais) parts.push(c.pais);

  // Referencia al final
  if (c.referencia) parts.push(`(Ref: ${c.referencia})`);

  return parts.filter(Boolean).join(', ');
}

// Lee el form de alta y devuelve {status,addressLine,components}
function _computeDomicilioFromForm() {
  const $ = (id) => document.getElementById(id);

  const provincia = ($('nuevo-provincia')?.value || '').trim();
  const partido = ($('nuevo-partido')?.value || '').trim();

  // Localidad/Barrio depende de qué control está visible
  const locSelect = $('nuevo-localidad-select');
  const locInput = $('nuevo-localidad-input');
  const localidadBarrio = (
    (locSelect && locSelect.style.display !== 'none' && locSelect.value) ||
    (locInput && locInput.style.display !== 'none' && locInput.value) ||
    ''
  ).trim();

  const components = {
    calle: ($('nuevo-calle')?.value || '').trim(),
    numero: ($('nuevo-numero')?.value || '').trim(),
    piso: ($('nuevo-piso')?.value || '').trim(),
    depto: ($('nuevo-depto')?.value || '').trim(),
    provincia,
    partido,
    localidad: '',
    barrio: '',
    codigoPostal: ($('nuevo-cp')?.value || '').trim(),
    pais: ($('nuevo-pais')?.value || '').trim(),
    referencia: ($('nuevo-referencia')?.value || '').trim(),
  };

  // Reglas por provincia
  if (provincia === 'CABA') {
    components.barrio = localidadBarrio || '';
    components.localidad = components.barrio;
    components.partido = '';
  } else if (provincia === 'Buenos Aires') {
    components.localidad = localidadBarrio || '';
    components.barrio = '';
  } else {
    components.localidad = localidadBarrio || '';
    components.barrio = '';
    components.partido = '';
  }

  // ¿Hay algo cargado?
  const anyFilled = Object.values(components).some(v => !!v && String(v).trim() !== '');
  if (!anyFilled) return { status: 'none', addressLine: '', components };

  // Completitud mínima
  const hasStreet = !!(components.calle && components.numero);
  const hasGeoKey =
    (provincia === 'CABA' && !!components.barrio) ||
    (provincia === 'Buenos Aires' && !!components.partido && !!components.localidad) ||
    (provincia && !!components.localidad);

  const status = (hasStreet || hasGeoKey) ? 'complete' : 'partial';
  const addressLine = (status === 'complete') ? _composeAddressLine(components) : '';

  return { status, addressLine, components };
}

// Inicializa el UI del bloque de domicilio del alta
export function initDomicilioForm() {
  const selProv = _qs('nuevo-provincia');
  const selPart = _qs('nuevo-partido');
  const selLoc = _qs('nuevo-localidad-select');
  const inpLoc = _qs('nuevo-localidad-input');
  const wrapPart = _qs('wrap-partido');

  function setPreview() {
    const domicilio = _computeDomicilioFromForm();
    const prev = _qs('preview-addressLine');
    if (prev) prev.textContent = domicilio.addressLine || '—';
  }

  function fillPartidos() {
    selPart.innerHTML = '<option value="">—</option>';
    Object.keys(BA_LOCALIDADES_BY_PARTIDO || {}).sort().forEach(p => {
      const opt = document.createElement('option');
      opt.value = p; opt.textContent = p;
      selPart.appendChild(opt);
    });
  }

  function fillLocalidadesForPartido(partido) {
    const locs = (BA_LOCALIDADES_BY_PARTIDO && BA_LOCALIDADES_BY_PARTIDO[partido]) || [];
    selLoc.innerHTML = '<option value="">—</option>';
    locs.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l; opt.textContent = l;
      selLoc.appendChild(opt);
    });
  }

  function setLocMode(mode) {
    if (mode === 'select') {
      selLoc.style.display = '';
      inpLoc.style.display = 'none';
      inpLoc.value = '';
    } else {
      selLoc.style.display = 'none';
      inpLoc.style.display = '';
      selLoc.value = '';
    }
  }

  function onProvinciaChange() {
    const pv = selProv.value;

    if (pv === 'CABA') {
      if (wrapPart) wrapPart.style.display = 'none';
      selPart.disabled = true;
      selPart.value = '';

      selLoc.innerHTML = '<option value="">—</option>';
      (CABA_BARRIOS || []).forEach(b => {
        const opt = document.createElement('option');
        opt.value = b; opt.textContent = b;
        selLoc.appendChild(opt);
      });
      setLocMode('select');
      selLoc.disabled = false;
    } else if (pv === 'Buenos Aires') {
      if (wrapPart) wrapPart.style.display = '';
      selPart.disabled = false;
      fillPartidos();
      selPart.selectedIndex = 0;

      selLoc.innerHTML = '<option value="">—</option>';
      setLocMode('select');
      selLoc.disabled = true;
    } else {
      if (wrapPart) wrapPart.style.display = 'none';
      selPart.disabled = true;
      selPart.value = '';

      setLocMode('input');
      inpLoc.value = '';
      selLoc.disabled = true;
    }

    setPreview();
  }

  function onPartidoChange() {
    const p = selPart.value;

    if (p) {
      fillLocalidadesForPartido(p);
      setLocMode('select');
      selLoc.disabled = false;
      selLoc.selectedIndex = 0;
    } else {
      selLoc.innerHTML = '<option value="">—</option>';
      setLocMode('input');
      selLoc.disabled = true;
    }

    setPreview();
  }

  selProv?.addEventListener('change', onProvinciaChange);
  selPart?.addEventListener('change', onPartidoChange);

  ['nuevo-calle', 'nuevo-numero', 'nuevo-piso', 'nuevo-depto', 'nuevo-cp', 'nuevo-pais', 'nuevo-referencia']
    .forEach(id => _qs(id)?.addEventListener('input', setPreview));
  selLoc?.addEventListener('change', setPreview);
  inpLoc?.addEventListener('input', setPreview);

  onProvinciaChange();
}

// ─────────────────────────────────────────────────────────────
// Registro de cliente (Admin → API Vercel) con toggle de flujo
// ─────────────────────────────────────────────────────────────
export async function registrarCliente() {
  const get = (id) => document.getElementById(id)?.value?.trim() || '';

  const nombre = get('nuevo-nombre');
  const dni = get('nuevo-dni');
  const email = get('nuevo-email');
  const telefono = get('nuevo-telefono');
  const fechaNacimiento = get('nuevo-fecha-nacimiento') || '';
  const fechaInscripcion = get('nuevo-fecha-inscripcion') || new Date().toISOString().split('T')[0];

  if (!nombre) return UI.showToast('Falta el nombre.', 'error');
  if (!dni) return UI.showToast('Falta el DNI.', 'error');
  if (!email) return UI.showToast('Falta el email.', 'error');

  // Domicilio del Alta
  const dom = _computeDomicilioFromForm();
  console.log('[domicilio] _computeDomicilioFromForm →', dom);

  const domicilio = (dom && dom.status && dom.status !== 'none') ? {
    status: dom.status,
    addressLine: dom.addressLine || '',
    components: dom.components,
    geocoded: {
      lat: null, lng: null, geohash7: null, provider: null,
      confidence: null, geocodedAt: null, verified: false
    }
  } : null;

  const addressLine = dom?.addressLine || '';
  console.log('[domicilio] payload a enviar →', { domicilio, addressLine });

  const NOTIF_BASE = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.apiUrl) || (window.__RAMPET__ && window.__RAMPET__.NOTIF_BASE) || '';
  const API_KEY = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.apiKey) || (window.__RAMPET__ && window.__RAMPET__.API_KEY) || '';
  console.log('[DEBUG-CONFIG] window.ADMIN_CONFIG:', window.ADMIN_CONFIG);
  const useCreateUserAPI = appData?.config?.featureFlags?.useCreateUserAPI !== false; // default: true

  const btn = document.getElementById('registrar-cliente-btn');
  const prevTxt = btn ? btn.textContent : null;
  if (btn) { btn.disabled = true; btn.textContent = 'Guardando…'; }

  const tycVersion = appData?.config?.principal?.tycVersion || null;
  const tycUrl = appData?.config?.principal?.tycUrl || null;

  try {
    if (useCreateUserAPI) {
      // Crea Auth + Firestore en server
      const createRes = await fetch(`${NOTIF_BASE}/api/create-user`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-api-key': API_KEY },
        body: JSON.stringify({
          email,
          dni,
          nombre,
          telefono,
          ...(domicilio ? { domicilio, addressLine } : {}),
          metadata: {
            createdFrom: 'panel',
            sourceVersion: 'panel@1.0.0'
          }
        })
      });

      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        console.error('[create-user] fail', createRes.status, err);
        return UI.showToast(`Error API (${createRes.status}): ${err.error || err.message || 'Fallo desconocido'}`, 'error', 8000);
      }

      const createJson = await createRes.json().catch(() => ({}));
      const docId = createJson?.firestore?.docId || null;
      const authUID = createJson?.auth?.uid || null;

      if (!docId || !authUID) {
        console.warn('[create-user] respuesta sin docId/authUID', createJson);
        return UI.showToast('Alta incompleta: falta docId/authUID.', 'error');
      }

      // Merge post-create
      try {
        const tycPayload = (tycVersion || tycUrl) ? {
          terminosAceptados: true,
          tycAccepted: true,
          tyc: {
            version: tycVersion,
            url: tycUrl,
            acceptedAt: new Date().toISOString(),
            source: 'panel'
          }
        } : {
          terminosAceptados: true,
          tycAccepted: true,
          tyc: { version: null, url: null, acceptedAt: new Date().toISOString(), source: 'panel' }
        };

        await db.collection('clientes').doc(docId).set({
          dni,
          fechaNacimiento: fechaNacimiento || null,
          fechaInscripcion: fechaInscripcion || null,
          ...(domicilio ? {
            domicilio: {
              status: domicilio.status,
              addressLine: domicilio.addressLine,
              components: domicilio.components,
              geocoded: domicilio.geocoded
            },
            addressLine
          } : {}),

          ...tycPayload,

          source: 'panel',
          metadata: {
            ...((typeof createJson?.firestore?.metadata === 'object') ? createJson.firestore.metadata : {}),
            createdFrom: 'panel',
            sourceVersion: 'panel@1.0.0'
          },

        }, { merge: true });

        await db.collection('clientes').doc(docId).set({
          creadoDesde: 'panel',
          metadata: { ...(appData?.metadata || {}), createdFrom: 'panel' }
        }, { merge: true });

        console.log('[domicilio] primer merge OK');
      } catch (mergeErr) {
        console.warn('[merge post-create-user] no crítico:', mergeErr);
      }

      const sendWelcome = _readSendWelcomeFlag();
      console.log('[panel] assign-socio-number payload →', { docId, sendWelcome });

      if (sendWelcome) UI.showToast('Enviando email de bienvenida…', 'info', 4000);
      UI.showToast('Asignando número de socio…', 'info', 3000);

      const asign = await _assignNumeroSocio(docId, sendWelcome);

      // Re-grabar domicilio por si el endpoint pisó el doc
      if (domicilio) {
        try {
          await db.collection('clientes').doc(docId).set(
            { domicilio, addressLine },
            { merge: true }
          );
          console.log('[post-assign] domicilio re-mergeado');
        } catch (e) {
          console.warn('[post-assign] fallo re-merge domicilio:', e);
        }
      }

      try {
        await db.collection('clientes').doc(docId).set({
          source: 'panel',
          creadoDesde: 'panel',
          metadata: {
            ...((typeof appData?.metadata === 'object') ? appData.metadata : {}),
            createdFrom: 'panel',
            sourceVersion: 'panel@1.0.0'
          }
        }, { merge: true });
        console.log('[origen] reforzado en raíz: source/panel');
      } catch (e) {
        console.warn('[origen] no se pudo reforzar source en raíz:', e);
      }

      if (asign?.ok) {
        UI.showToast(`Número de socio asignado: ${asign.data?.numeroSocio ?? 'OK'}`, 'success', 4000);
      } else {
        UI.showToast('No se pudo asignar el número de socio.', 'error', 6000);
      }

      if (sendWelcome) {
        if (asign?.data?.emailEnviado === true) {
          UI.showToast('Email de bienvenida enviado.', 'success', 4000);
        } else if (asign?.data?.emailEnviado === false) {
          UI.showToast('No se envió el email de bienvenida (desactivado o falló el envío).', 'warning', 6000);
        } else {
          UI.showToast('Estado de email de bienvenida no disponible.', 'warning', 4000);
        }
      }

    } else {
      // Ruta legado: solo Firestore (NO crea Auth)
      const baseDoc = {
        authUID: null,
        numeroSocio: null,
        nombre,
        dni,
        email,
        telefono,
        fechaNacimiento,
        fechaInscripcion,
        puntos: 0,
        saldoAcumulado: 0,
        totalGastado: 0,
        historialPuntos: [],
        historialCanjes: [],
        fcmTokens: [],
        terminosAceptados: true,
        tycAccepted: true,
        tyc: {
          version: tycVersion || null,
          url: tycUrl || null,
          acceptedAt: new Date().toISOString(),
          source: 'panel'
        },

        creadoDesde: 'admin',
        ...(domicilio ? { domicilio, addressLine } : {})
      };

      const docRef = await db.collection('clientes').add(baseDoc);

      const sendWelcome = _readSendWelcomeFlag();
      console.log('[panel][legacy] assign-socio-number payload →', { docId: docRef.id, sendWelcome });

      if (sendWelcome) UI.showToast('Enviando email de bienvenida…', 'info', 4000);
      UI.showToast('Asignando número de socio…', 'info', 3000);

      const asign = await _assignNumeroSocio(docRef.id, sendWelcome);

      if (domicilio) {
        try {
          await db.collection('clientes').doc(docRef.id).set(
            { domicilio, addressLine },
            { merge: true }
          );
          console.log('[post-assign][legacy] domicilio re-mergeado');
        } catch (e) {
          console.warn('[post-assign][legacy] fallo re-merge domicilio:', e);
        }
      }

      if (asign?.ok) {
        UI.showToast(`Número de socio asignado: ${asign.data?.numeroSocio ?? 'OK'}`, 'success', 4000);
      } else {
        UI.showToast('No se pudo asignar el número de socio.', 'error', 6000);
      }

      if (sendWelcome) {
        if (asign?.data?.emailEnviado === true) {
          UI.showToast('Email de bienvenida enviado.', 'success', 4000);
        } else if (asign?.data?.emailEnviado === false) {
          UI.showToast('No se envió el email de bienvenida (desactivado o falló el envío).', 'warning', 6000);
        } else {
          UI.showToast('Estado de email de bienvenida no disponible.', 'warning', 4000);
        }
      }
    }

    UI.showToast('Cliente registrado.', 'success');

    // Limpieza de formulario
    [
      'nuevo-nombre', 'nuevo-dni', 'nuevo-email', 'nuevo-telefono', 'nuevo-fecha-nacimiento',
      'nuevo-calle', 'nuevo-numero', 'nuevo-piso', 'nuevo-depto',
      'nuevo-cp', 'nuevo-pais', 'nuevo-referencia'
    ].forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });

    const prov = document.getElementById('nuevo-provincia');
    if (prov) prov.value = '';
    const part = document.getElementById('nuevo-partido');
    if (part) part.value = '';
    const locSel = document.getElementById('nuevo-localidad-select');
    const locInp = document.getElementById('nuevo-localidad-input');
    if (locSel) { locSel.value = ''; locSel.innerHTML = '<option value="">—</option>'; }
    if (locInp) locInp.value = '';

    const f = document.getElementById('nuevo-fecha-inscripcion');
    if (f) try { f.valueAsDate = new Date(); } catch { }

    const prev = document.getElementById('preview-addressLine');
    if (prev) prev.textContent = '—';

  } catch (e) {
    console.error('registrarCliente error:', e);
    UI.showToast('No se pudo guardar el cliente.', 'error');
  } finally {
    if (btn) { btn.textContent = prevTxt || 'Registrar'; btn.disabled = false; }
  }
}

// ─────────────────────────────────────────────────────────────
// Utilidades para vencimientos/cumpleaños (usadas por ui.js)
// ─────────────────────────────────────────────────────────────
function _safeParseDate(val) {
  if (!val) return null;
  if (val.toDate) return val.toDate(); // Firestore Timestamp
  if (val instanceof Date) return val;
  if (typeof val === 'string') {
    // Intenta ISO standard
    // Si viene solo fecha YYYY-MM-DD
    if (val.length === 10) return new Date(val + 'T00:00:00Z');
    return new Date(val);
  }
  return null;
}

export function obtenerDiasCaducidadParaPuntos(puntosObtenidos) {
  const reglas = appData?.config?.reglasCaducidad;
  if (!reglas || reglas.length === 0) return 90;
  const reglaAplicable = [...reglas]
    .sort((a, b) => b.minPuntos - a.minPuntos)
    .find(regla => puntosObtenidos >= regla.minPuntos);
  if (!reglaAplicable && reglas.length > 0) {
    return [...reglas].sort((a, b) => a.minPuntos - b.minPuntos)[0].cadaDias;
  }
  return reglaAplicable ? reglaAplicable.cadaDias : 90;
}

export function obtenerFechaProximoVencimiento(cliente) {
  if (!cliente?.historialPuntos || cliente.historialPuntos.length === 0) return null;

  let fechaMasProxima = null;
  const hoy = new Date(); hoy.setUTCHours(0, 0, 0, 0);

  cliente.historialPuntos.forEach(grupo => {
    if (grupo.puntosDisponibles > 0 && grupo.estado !== 'Caducado') {
      const fechaObtencion = _safeParseDate(grupo.fechaObtencion);
      if (!fechaObtencion || isNaN(fechaObtencion)) return;

      const dias = grupo.diasCaducidad || obtenerDiasCaducidadParaPuntos(grupo.puntosObtenidos || 0);
      const fechaCaducidad = new Date(fechaObtencion);
      fechaCaducidad.setUTCDate(fechaCaducidad.getUTCDate() + dias);

      if (fechaCaducidad >= hoy) {
        if (!fechaMasProxima || fechaCaducidad < fechaMasProxima) {
          fechaMasProxima = fechaCaducidad;
        }
      }
    }
  });

  return fechaMasProxima;
}

export function calcularPuntosEnProximoVencimiento(cliente) {
  const fechaProx = obtenerFechaProximoVencimiento(cliente);
  if (!fechaProx) return 0;

  let puntos = 0;
  cliente.historialPuntos.forEach(grupo => {
    if (grupo.puntosDisponibles > 0 && grupo.estado !== 'Caducado') {
      const fechaObtencion = _safeParseDate(grupo.fechaObtencion);
      if (!fechaObtencion || isNaN(fechaObtencion)) return;

      const dias = grupo.diasCaducidad || obtenerDiasCaducidadParaPuntos(grupo.puntosObtenidos || 0);
      const fechaCaducidad = new Date(fechaObtencion);
      fechaCaducidad.setUTCDate(fechaCaducidad.getUTCDate() + dias);

      if (fechaCaducidad.getTime() === fechaProx.getTime()) {
        puntos += (grupo.puntosDisponibles || 0);
      }
    }
  });
  return puntos;
}

export function obtenerCumpleanerosDeHoy() {
  const hoy = new Date();
  const d = hoy.getDate();
  const m = hoy.getMonth() + 1;
  return (appData?.clientes || []).filter(cliente => {
    if (!cliente.fechaNacimiento) return false;
    const f = new Date(String(cliente.fechaNacimiento).replace(/-/g, '/'));
    return f.getDate() === d && (f.getMonth() + 1) === m;
  });
}

// ─────────────────────────────────────────────────────────────
// Borrado (Admin → API Vercel) + selección múltiple
// ─────────────────────────────────────────────────────────────
export async function eliminarClienteHandler(clienteId) {
  if (!clienteId) return;
  const cliente = appData.clientes?.find?.(c => c.id === clienteId) || __registrosAll.find(c => c.id === clienteId); // [IMPROVE]
  if (!cliente) return UI.showToast("Error: No se encontró al cliente.", "error");

  const confirmacion = confirm(
    `ATENCIÓN: Se eliminará permanentemente al cliente "${cliente.nombre}" (N° Socio: ${cliente.numeroSocio || 'N/A'}).\n\n` +
    `Esta acción también intentará eliminar su cuenta de acceso a la PWA.\n\n¿Está seguro de que quiere continuar?`
  );
  if (!confirmacion) return;

  try {
    const NOTIF_BASE = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.apiUrl) || '';
    const API_KEY = (window.ADMIN_CONFIG && window.ADMIN_CONFIG.apiKey) || '';

    // Obtener "Carnet de Identidad" (Token) del usuario logueado
    const currentUser = firebase.auth().currentUser;
    if (!currentUser) throw new Error("No hay sesión de usuario activa.");
    const idToken = await currentUser.getIdToken();

    const response = await fetch(`${NOTIF_BASE}/api/delete-user`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': API_KEY,
        'Authorization': `Bearer ${idToken}` // <--- La clave del éxito 🔑
      },
      body: JSON.stringify({
        docId: cliente.id,      // server acepta docId | email | authUID | numeroSocio
        authUID: cliente.authUID
      })
    });

    const result = await response.json();
    if (!response.ok || result.ok === false) {
      throw new Error(result.error || 'Error desconocido del servidor.');
    }

    const ficha = _qs('ficha-contenido');
    if (ficha && ficha.style.display !== 'none') {
      ficha.style.display = 'none';
      UI.openTab('clientes');
    }
    UI.showToast("Cliente eliminado con éxito.", "success");
  } catch (error) {
    console.error("Error al eliminar cliente:", error);
    UI.showToast(`Error al eliminar: ${error.message}`, "error");
  }
}

export async function eliminarSeleccionadosHandler() {
  const checkboxes = document.querySelectorAll('.checkbox-eliminar-registro:checked');
  if (checkboxes.length === 0) return UI.showToast("No hay registros seleccionados para eliminar.", "warning");

  const confirmacion = confirm(`¿Está seguro de eliminar los ${checkboxes.length} registros seleccionados? Esta acción es irreversible.`);
  if (!confirmacion) return;

  const idsParaEliminar = Array.from(checkboxes).map(cb => cb.dataset.id);
  const boton = _qs('btn-eliminar-seleccionados');
  boton.disabled = true;
  boton.textContent = 'Eliminando...';

  let eliminadosCount = 0;
  for (const id of idsParaEliminar) {
    await eliminarClienteHandler(id);
    eliminadosCount++;
  }

  UI.showToast(`${eliminadosCount} de ${checkboxes.length} registros han sido procesados para eliminación.`, "success");
  boton.disabled = false;
  boton.textContent = '🗑️ Eliminar Seleccionados';
  const master = _qs('seleccionar-todos-nuevos-registros');
  if (master) master.checked = false;
}

export function seleccionarTodosNuevosRegistros(e) {
  const isChecked = e.target.checked;
  const checkboxes = document.querySelectorAll('.checkbox-eliminar-registro');
  checkboxes.forEach(cb => cb.checked = isChecked);

  const btnEliminar = _qs('btn-eliminar-seleccionados');
  btnEliminar.style.display = isChecked || document.querySelectorAll('.checkbox-eliminar-registro:checked').length > 0
    ? 'inline-block'
    : 'none';
}

// ─────────────────────────────────────────────────────────────
// Ficha + edición (datos básicos y puntos)
// ─────────────────────────────────────────────────────────────
export function mostrarFichaCliente(identificador) {
  if (!identificador) return;
  const cliente = (appData.clientes && appData.clientes.find(c =>
    (c.numeroSocio && c.numeroSocio.toString() === identificador) ||
    (c.dni && c.dni === identificador)
  )) || (__registrosAll.find(c =>
    (c.numeroSocio && c.numeroSocio.toString() === identificador) ||
    (c.dni && c.dni === identificador)
  )); // [IMPROVE]
  UI.renderizarFichaCliente(cliente);
}

export async function guardarCambiosFichaHandler() {
  const clienteId = _qs('ficha-id').textContent;
  if (!clienteId) return UI.showToast("No se ha seleccionado ningún cliente.", "error");

  const botonGuardar = _qs('btn-guardar-edicion-datos');
  botonGuardar.disabled = true;

  try {
    const updatedData = {
      nombre: _qs('edit-ficha-nombre').value.trim(),
      dni: _qs('edit-ficha-dni').value.trim(),
      email: _qs('edit-ficha-email').value.trim(),
      telefono: _qs('edit-ficha-telefono').value.trim(),
      fechaNacimiento: _qs('edit-ficha-nacimiento').value,
      esTester: _qs('edit-ficha-esTester').checked
    };
    if (!updatedData.nombre || !updatedData.dni) throw new Error("Nombre y DNI son obligatorios.");

    const clienteRef = db.collection('clientes').doc(clienteId);
    await clienteRef.update(updatedData);

    UI.showToast("Datos del cliente actualizados.", "success");
  } catch (error) {
    console.error("Error al guardar cambios de la ficha:", error);
    UI.showToast(`No se pudo guardar: ${error.message}`, "error");
  } finally {
    botonGuardar.disabled = false;
  }
}

export async function guardarPuntosHandler() {
  const clienteId = _qs('ficha-id').textContent;
  const cliente = appData.clientes?.find?.(c => c.id === clienteId) || __registrosAll.find(c => c.id === clienteId); // [IMPROVE]
  if (!cliente) return;

  const nuevosPuntos = parseInt(_qs('edit-ficha-puntos').value);
  const nuevoSaldo = parseFloat(_qs('edit-ficha-saldo').value);
  if (isNaN(nuevosPuntos) || isNaN(nuevoSaldo) || nuevosPuntos < 0 || nuevoSaldo < 0) {
    return UI.showToast("Puntos y saldo deben ser números positivos.", "error");
  }

  const razon = prompt("Razón para este ajuste manual:");
  if (!razon) return UI.showToast("Ajuste cancelado. Se requiere una razón.", "warning");

  const diferenciaPuntos = nuevosPuntos - (cliente.puntos ?? 0);
  const updateData = { puntos: nuevosPuntos, saldoAcumulado: nuevoSaldo };

  if (diferenciaPuntos !== 0) {
    updateData.historialPuntos = firebase.firestore.FieldValue.arrayUnion({
      fechaObtencion: new Date().toISOString(),
      puntosObtenidos: diferenciaPuntos,
      puntosDisponibles: diferenciaPuntos,
      origen: `Ajuste manual: ${razon}`,
      diasCaducidad: 9999
    });
  }

  const clienteRef = db.collection('clientes').doc(clienteId);
  await clienteRef.update(updateData);

  UI.showToast("Puntos y saldo actualizados.", "success");
  UI.cancelarEdicionPuntos();
}

// ─────────────────────────────────────────────────────────────
// Domicilio (editor de ficha)
// ─────────────────────────────────────────────────────────────
export function _computeDomicilioFromFormWithPrefix(prefix = '') {
  const p = prefix || '';
  const get = (id) => document.getElementById(p + id);
  const provincia = (get('provincia')?.value || '').trim();
  const partido = (get('partido')?.value || '').trim();

  const locSel = get('localidad-select');
  const locInp = get('localidad-input');
  const localidadBarrio = (
    (locSel && locSel.style.display !== 'none' && locSel.value) ||
    (locInp && locInp.style.display !== 'none' && locInp.value) ||
    ''
  ).trim();

  const components = {
    calle: (get('calle')?.value || '').trim(),
    numero: (get('numero')?.value || '').trim(),
    piso: (get('piso')?.value || '').trim(),
    depto: (get('depto')?.value || '').trim(),
    provincia,
    partido,
    localidad: '',
    barrio: '',
    codigoPostal: (get('cp')?.value || '').trim(),
    pais: (get('pais')?.value || '').trim(),
    referencia: (get('referencia')?.value || '').trim(),
  };

  // [FIX] reglas por provincia (llaves balanceadas)
  if (provincia === 'CABA') {
    components.barrio = localidadBarrio || '';
    components.localidad = components.barrio; // espejo
    components.partido = '';
  } else if (provincia === 'Buenos Aires') {
    components.localidad = localidadBarrio || '';
    components.barrio = '';
  } else {
    components.localidad = localidadBarrio || '';
    components.barrio = '';
    components.partido = '';
  }

  const any = Object.values(components).some(Boolean);
  if (!any) return { status: 'none', addressLine: '', components };

  const hasStreet = components.calle && components.numero;
  const hasGeoKey =
    (provincia === 'CABA' && components.barrio) ||
    (provincia === 'Buenos Aires' && components.partido && components.localidad) ||
    (provincia && components.localidad);

  const status = (hasStreet || hasGeoKey) ? 'complete' : 'partial';
  const addressLine = (status === 'complete') ? _composeAddressLine(components) : '';

  return { status, addressLine, components };
}

export function initDomicilioFormWithPrefix(prefix = '') {
  const p = prefix || '';
  const pNoDash = p.endsWith('-') ? p.slice(0, -1) : p;
  const get = (id) => document.getElementById(p + id);

  const selProv = get('provincia');
  const selPart = get('partido');
  const wrapPart = document.getElementById(`wrap-${pNoDash}-partido`);
  const selLoc = get('localidad-select');
  const inpLoc = get('localidad-input');

  const previewEl = document.getElementById(p ? 'preview-addressLine-edit' : 'preview-addressLine');

  function setPreview() {
    const dom = _computeDomicilioFromFormWithPrefix(p);
    if (previewEl) previewEl.textContent = dom.addressLine || '—';
  }

  function fillPartidos() {
    if (!selPart) return;
    selPart.innerHTML = '<option value="">—</option>';
    Object.keys(BA_LOCALIDADES_BY_PARTIDO || {}).sort().forEach(pn => {
      const opt = document.createElement('option');
      opt.value = pn; opt.textContent = pn;
      selPart.appendChild(opt);
    });
  }

  function fillLocalidadesForPartido(partido) {
    if (!selLoc) return;
    const locs = (BA_LOCALIDADES_BY_PARTIDO && BA_LOCALIDADES_BY_PARTIDO[partido]) || [];
    selLoc.innerHTML = '<option value="">—</option>';
    locs.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l; opt.textContent = l;
      selLoc.appendChild(opt);
    });
  }

  function setLocMode(mode) {
    if (!selLoc || !inpLoc) return;
    if (mode === 'select') {
      selLoc.style.display = '';
      inpLoc.style.display = 'none';
      inpLoc.value = '';
    } else {
      selLoc.style.display = 'none';
      inpLoc.style.display = '';
      selLoc.value = '';
    }
  }

  function onProvinciaChange() {
    const pv = selProv?.value;
    if (!wrapPart || !selPart || !selLoc || !inpLoc) return;
    if (pv === 'CABA') {
      wrapPart.style.display = 'none';
      selPart.disabled = true; selPart.value = '';
      selLoc.innerHTML = '<option value="">—</option>';
      (CABA_BARRIOS || []).forEach(b => {
        const opt = document.createElement('option');
        opt.value = b; opt.textContent = b;
        selLoc.appendChild(opt);
      });
      setLocMode('select');
    } else if (pv === 'Buenos Aires') {
      wrapPart.style.display = '';
      selPart.disabled = false;
      fillPartidos();
      selLoc.innerHTML = '<option value="">—</option>';
      setLocMode('select');
    } else {
      wrapPart.style.display = 'none';
      selPart.disabled = true; selPart.value = '';
      setLocMode('input');
      if (inpLoc) inpLoc.value = '';
    }
    setPreview();
  }

  function onPartidoChange() {
    const pval = selPart?.value;
    if (!selLoc || !inpLoc) return;
    if (pval) {
      fillLocalidadesForPartido(pval);
      setLocMode('select');
    } else {
      selLoc.innerHTML = '<option value="">—</option>';
      setLocMode('input');
    }
    setPreview();
  }

  selProv?.addEventListener('change', onProvinciaChange);
  selPart?.addEventListener('change', onPartidoChange);
  ['calle', 'numero', 'piso', 'depto', 'cp', 'pais', 'referencia'].forEach(id => {
    get(id)?.addEventListener('input', setPreview);
  });
  selLoc?.addEventListener('change', setPreview);
  inpLoc?.addEventListener('input', setPreview);

  onProvinciaChange();
  setPreview();
}

export async function guardarCambiosDomicilioHandler(clienteId) {
  try {
    if (!clienteId) throw new Error('Cliente no identificado');

    const dom = _computeDomicilioFromFormWithPrefix('edit-');
    const domicilio = {
      status: dom.status,
      addressLine: dom.addressLine || '',
      components: dom.components || {}
    };

    const ref = db.collection('clientes').doc(clienteId);

    await ref.update({
      domicilio,
      addressLine: domicilio.addressLine || ''
    });

    const idx = appData.clientes?.findIndex?.(c => c.id === clienteId);
    if (idx >= 0) {
      appData.clientes[idx].domicilio = domicilio;
      appData.clientes[idx].addressLine = domicilio.addressLine || '';
    }

    const clienteActualizado = idx >= 0 ? appData.clientes[idx] : { id: clienteId, domicilio };
    UI.renderFichaDomicilio(clienteActualizado);

    const editWrap = document.getElementById('ficha-domicilio-edit');
    if (editWrap) editWrap.style.display = 'none';
    const cardRead = document.getElementById('ficha-domicilio');
    if (cardRead) cardRead.style.display = '';

    UI.showToast('Domicilio actualizado.', 'success');
  } catch (e) {
    console.error('Error guardando domicilio:', e);
    UI.showToast(`No se pudo guardar el domicilio: ${e.message}`, 'error');
    throw e;
  }
}

// ─────────────────────────────────────────────────────────────
// Búsqueda rápida de ficha
// ─────────────────────────────────────────────────────────────
export function buscarFichaClienteHandler() {
  const identificador = _qs('ficha-buscar-cliente')?.value;
  if (identificador) mostrarFichaCliente(identificador);
}

// ─────────────────────────────────────────────────────────────
// Init general al cargar el DOM
// ─────────────────────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  // Form de domicilio del alta
  const prov = document.getElementById('nuevo-provincia');
  if (prov && typeof initDomicilioForm === 'function') {
    initDomicilioForm();
  }

  // Solapa “Registros”
  if (document.getElementById('nuevos-registros') && typeof initRegistrosTab === 'function') {
    initRegistrosTab();
  }
});
