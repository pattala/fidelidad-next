// modules/ui.js (Panel Admin - CON NUEVA TABLA DE REGISTROS)

import { appData } from './data.js';
import { calcularPuntosEnProximoVencimiento, obtenerFechaProximoVencimiento, obtenerCumpleanerosDeHoy } from './clientes.js';
import * as Clientes from './clientes.js';
// --- FUNCIONES DE UTILIDAD GENERAL ---
export function showToast(message, type = 'info', duration = 5000) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => { toast.remove(); }, duration);
}

export function formatearFecha(isoDateString) {
  if (!isoDateString) return 'N/A';
  const parts = isoDateString.split('T')[0].split('-');
  if (parts.length !== 3) return isoDateString;
  const fecha = new Date(Date.UTC(parts[0], parts[1] - 1, parts[2]));
  if (isNaN(fecha.getTime())) return isoDateString;
  const dia = String(fecha.getUTCDate()).padStart(2, '0');
  const mes = String(fecha.getUTCMonth() + 1).padStart(2, '0');
  const anio = fecha.getUTCFullYear();
  return `${dia}/${mes}/${anio}`;
}

export function formatearFechaYHora(isoDateString) {
  if (!isoDateString) return 'N/A';
  const fecha = new Date(isoDateString);
  if (isNaN(fecha.getTime())) return 'Fecha inválida';
  const dia = String(fecha.getDate()).padStart(2, '0');
  const mes = String(fecha.getMonth() + 1).padStart(2, '0');
  const anio = fecha.getFullYear();
  const horas = String(fecha.getHours()).padStart(2, '0');
  const minutos = String(fecha.getMinutes()).padStart(2, '0');
  return `${dia}/${mes}/${anio} ${horas}:${minutos}`;
}

export function openTab(tabName, event = null) {
  if (event) event.preventDefault();
  document.querySelectorAll(".tabcontent").forEach(tab => tab.style.display = "none");
  document.querySelectorAll(".tablinks").forEach(link => link.classList.remove("active"));
  const tabToShow = document.getElementById(tabName);
  if (tabToShow) tabToShow.style.display = "block";
  const botonActivo = document.querySelector(`.tablinks[data-tab="${tabName}"]`);
  if (botonActivo) botonActivo.classList.add("active");
}

// --- FUNCIONES DE LA PESTAÑA CLIENTES Y FICHA ---
export function renderizarTablaClientes() {
  const criterio = document.getElementById('busqueda')?.value.toLowerCase() || '';
  const clientesActivos = appData.clientes.filter(c => c.numeroSocio);
  const resultados = criterio
    ? clientesActivos.filter(c =>
      (c.dni?.toLowerCase().includes(criterio)) ||
      (c.nombre?.toLowerCase().includes(criterio)) ||
      (c.numeroSocio?.toString().includes(criterio)))
    : clientesActivos;

  const tbody = document.querySelector('#tabla-clientes tbody');
  if (!tbody) return;
  tbody.innerHTML = resultados.map(c => `
    <tr>
      <td>${c.numeroSocio}</td>
      <td>${c.dni || '-'}</td>
      <td>${c.nombre || '-'}</td>
      <td>${c.terminosAceptados ? '✔️' : '❌'}</td>
      <td>${(c.fcmTokens && c.fcmTokens.length > 0) ? '✔️' : '❌'}</td>
      <td>${c.puntos || 0}</td>
      <td>${formatearFecha(c.ultimaCompra) || '-'}</td>
      <td class="acciones"><button class="ver-ficha-btn primary-btn" data-numero-socio="${c.numeroSocio}">Ver Ficha</button></td>
    </tr>
  `).join('');
}

// ====================================================================
// == INICIO: NUEVA FUNCIÓN PARA RENDERIZAR LA TABLA DE REGISTROS PWA ==
// ====================================================================
export function renderizarTablaNuevosRegistros() {
  const registrosPWA = appData.clientes
    .filter(c => c.authUID)
    .sort((a, b) => new Date(b.fechaInscripcion) - new Date(a.fechaInscripcion));

  const tbody = document.querySelector('#tabla-nuevos-registros tbody');
  if (!tbody) return;

  if (registrosPWA.length === 0) {
    tbody.innerHTML = '<tr><td colspan="6">Aún no hay registros desde la PWA.</td></tr>';
    return;
  }

  tbody.innerHTML = registrosPWA.map(c => `
    <tr data-id="${c.id}">
      <td><input type="checkbox" class="checkbox-eliminar-registro" data-id="${c.id}"></td>
      <td>${c.numeroSocio || 'Asignando...'}</td>
      <td>${c.nombre}</td>
      <td>${c.email}</td>
      <td>${formatearFecha(c.fechaInscripcion)}</td>
      <td class="acciones">
        <button class="ver-ficha-registro-btn primary-btn" data-numero-socio="${c.numeroSocio}" ${!c.numeroSocio ? 'disabled' : ''}>Ver Ficha</button>
        <button class="eliminar-registro-btn danger-btn" data-id="${c.id}">Eliminar</button>
      </td>
    </tr>
  `).join('');
}
// ====================================================================
// == FIN: NUEVA FUNCIÓN                                             ==
// ====================================================================
// ─────────────────────────────────────────────────────────────
// FICHA: DOMICILIO (read-only) — usa mismo schema que la PWA
// ─────────────────────────────────────────────────────────────
export function renderFichaDomicilio(cliente) {
  const root = document.getElementById('ficha-contenido');
  if (!root) return;

  const d = (cliente && cliente.domicilio) || {};
  const c = d.components || {};
  const address = d.addressLine || '—';
  const status = (d.status || 'none').toUpperCase();

  // colores del badge
  const color =
    status === 'COMPLETE' ? '#16a34a' : (status === 'PARTIAL' ? '#f59e0b' : '#6b7280');

  // armar subdetalle (chips)
  const chips = [];
  if (c.provincia === 'CABA') {
    if (c.barrio) chips.push(`Barrio: ${c.barrio}`);
    chips.push('Provincia: CABA');
  } else if (c.provincia === 'Buenos Aires') {
    if (c.localidad) chips.push(`Localidad: ${c.localidad}`);
    if (c.partido) chips.push(`Partido: ${c.partido}`);
    chips.push('Provincia: Buenos Aires');
  } else {
    if (c.localidad) chips.push(`Localidad: ${c.localidad}`);
    if (c.provincia) chips.push(`Provincia: ${c.provincia}`);
  }
  if (c.codigoPostal) chips.push(`CP: ${c.codigoPostal}`);
  if (c.pais) chips.push(`País: ${c.pais}`);

  // contenedor fijo si existe; si no, lo creo al final
  let wrap = document.getElementById('ficha-domicilio');
  if (!wrap) {
    wrap = document.createElement('div');
    wrap.id = 'ficha-domicilio';
    root.appendChild(wrap);
  }

  wrap.innerHTML = `
    <div style="margin-top:12px;padding:12px;border:1px solid #e5e7eb;border-radius:12px;background:#fff">
      <div style="display:flex;align-items:center;justify-content:space-between;gap:8px;margin-bottom:8px">
        <div style="font-weight:600">📍 Domicilio</div>
        <span style="font-size:12px;padding:2px 8px;border-radius:999px;background:${color}20;color:${color};border:1px solid ${color}40">
          ${status}
        </span>
      </div>

      <div style="font-size:14px;line-height:1.55">
        <div><strong>Address:</strong> ${address}</div>
        ${chips.length ? `<div style="margin-top:6px;color:#374151">${chips.join(' · ')}</div>` : ''}
        ${address === '—' ? `<div style="margin-top:8px;font-size:12px;color:#6b7280">Aún no cargaste un domicilio.</div>` : ''}
      </div>
    </div>
  `;
}

export function renderizarFichaCliente(cliente) {
  const fichaContenido = document.getElementById('ficha-contenido');
  const fichaSinResultados = document.getElementById('ficha-sin-resultados');
  if (!cliente) {
    fichaContenido.style.display = 'none';
    fichaSinResultados.style.display = 'block';
    return;
  }
  document.getElementById('btn-eliminar-ficha').dataset.id = cliente.id;

  document.getElementById('ficha-numero-socio').textContent = cliente.numeroSocio || 'Pendiente';
  document.getElementById('ficha-id').textContent = cliente.id;
  document.getElementById('ficha-nombre').textContent = cliente.nombre;
  document.getElementById('ficha-dni').textContent = cliente.dni || '-';
  document.getElementById('ficha-email').textContent = cliente.email || '-';
  document.getElementById('ficha-telefono').textContent = cliente.telefono || '-';
  document.getElementById('ficha-terminos-status').textContent = cliente.terminosAceptados ? 'Sí' : 'No';
  document.getElementById('ficha-notif-status').textContent = (cliente.fcmTokens && cliente.fcmTokens.length > 0) ? `Activadas ✔️` : 'Desactivadas ❌';
  // Geolocalización (solo lectura)
  (function setGeoConsentInFicha() {
    const elStatus = document.getElementById('ficha-geo-status');
    const elUpdated = document.getElementById('ficha-geo-updated');
    if (!elStatus) return; // si no existe en el DOM, salimos

    const geoEnabled = cliente?.config?.geoEnabled;
    const geoUpdatedAt = cliente?.config?.geoUpdatedAt || '';
    const geoMethod = cliente?.config?.geoMethod || '';

    // Estado principal
    if (geoEnabled === true) elStatus.textContent = 'Activada ✔️';
    else if (geoEnabled === false) elStatus.textContent = 'Desactivada ❌';
    else elStatus.textContent = 'Sin interacción —';

    // Fecha/hora (opcional)
    if (elUpdated) {
      const fmt = (iso) => {
        try {
          if (!iso) return '—';
          const d = new Date(iso);
          if (isNaN(d)) return '—';
          const dd = String(d.getDate()).padStart(2, '0');
          const mm = String(d.getMonth() + 1).padStart(2, '0');
          const yy = d.getFullYear();
          const hh = String(d.getHours()).padStart(2, '0');
          const mi = String(d.getMinutes()).padStart(2, '0');
          return `${dd}/${mm}/${yy} ${hh}:${mi}`;
        } catch { return '—'; }
      };
      const when = fmt(geoUpdatedAt);
      const how = geoMethod ? ` · origen: ${geoMethod}` : '';
      elUpdated.textContent = when !== '—' ? `(${when}${how})` : '';
    }
  })();

  document.getElementById('ficha-tester-status').textContent = cliente.esTester ? 'Usuario de Prueba 🛡️' : 'Estándar';
  document.getElementById('ficha-inscripcion').textContent = formatearFecha(cliente.fechaInscripcion);
  document.getElementById('ficha-nacimiento').textContent = formatearFecha(cliente.fechaNacimiento);

  const fechaVencimiento = obtenerFechaProximoVencimiento(cliente);
  document.getElementById('ficha-puntos').textContent = cliente.puntos || 0;
  document.getElementById('ficha-puntos-proximos').textContent = calcularPuntosEnProximoVencimiento(cliente) || 0;
  document.getElementById('ficha-fecha-vencimiento').textContent = fechaVencimiento ? formatearFecha(fechaVencimiento.toISOString()) : 'Sin vencimientos';
  document.getElementById('ficha-saldo').textContent = (cliente.saldoAcumulado || 0).toFixed(2);
  document.getElementById('ficha-total-gastado').textContent = (cliente.totalGastado || 0).toFixed(2);
  document.getElementById('ficha-ultima-compra').textContent = formatearFecha(cliente.ultimaCompra);

  // Tarjeta de Domicilio (read-only)
  renderFichaDomicilio(cliente);
  // ——— Domicilio EDIT ———
  const btnEdit = document.getElementById('btn-edit-domicilio');
  const editWrap = document.getElementById('ficha-domicilio-edit');
  const cardRead = document.getElementById('ficha-domicilio');

  if (btnEdit && editWrap) {
    btnEdit.onclick = () => {
      // Pre-cargar valores desde cliente.domicilio.components
      const d = (cliente.domicilio || {});
      const c = d.components || {};
      const set = (id, v) => { const el = document.getElementById(id); if (el) el.value = (v || ''); };

      set('edit-calle', c.calle);
      set('edit-numero', c.numero);
      set('edit-piso', c.piso);
      set('edit-depto', c.depto);
      set('edit-provincia', c.provincia || '');
      set('edit-partido', c.partido || '');
      set('edit-cp', c.codigoPostal);
      set('edit-pais', c.pais || 'AR');
      set('edit-referencia', c.referencia);

      // Inicializar lógica dependiente (provincia/partido/localidad)
      Clientes.initDomicilioFormWithPrefix('edit-');

      // Forzar estado según los datos actuales:
      const selProv = document.getElementById('edit-provincia');
      const selPart = document.getElementById('edit-partido');
      const selLoc = document.getElementById('edit-localidad-select');
      const inpLoc = document.getElementById('edit-localidad-input');

      if (c.provincia === 'CABA') {
        // set barrio como selección si existe
        if (c.barrio && selLoc) { selLoc.value = c.barrio; }
      } else if (c.provincia === 'Buenos Aires') {
        // completar partido y luego localidades
        if (selPart) {
          selPart.value = c.partido || '';
          selPart.dispatchEvent(new Event('change'));
        }
        // set localidad si aplica
        if (c.localidad && selLoc && selLoc.style.display !== 'none') {
          selLoc.value = c.localidad;
        } else if (inpLoc && inpLoc.style.display !== 'none') {
          inpLoc.value = c.localidad || '';
        }
      } else {
        // Otro: input libre
        if (inpLoc) inpLoc.value = c.localidad || '';
      }

      // Preview
      const prev = document.getElementById('preview-addressLine-edit');
      if (prev) {
        const dom = (typeof Clientes._computeDomicilioFromFormWithPrefix === 'function')
          ? Clientes['_computeDomicilioFromFormWithPrefix']('edit-') // por si no exportás; solo recalcula preview
          : { addressLine: d.addressLine || '—' };
        prev.textContent = dom.addressLine || d.addressLine || '—';
      }

      // Mostrar editor, ocultar read-only
      if (cardRead) cardRead.style.display = 'none';
      editWrap.style.display = 'block';
    };
  }

  document.getElementById('btn-edit-domicilio-cancelar')?.addEventListener('click', () => {
    // Ocultar editor y volver a read-only
    const editWrap2 = document.getElementById('ficha-domicilio-edit');
    if (editWrap2) editWrap2.style.display = 'none';
    const cardRead2 = document.getElementById('ficha-domicilio');
    if (cardRead2) cardRead2.style.display = '';
  });

  document.getElementById('btn-edit-domicilio-guardar')?.addEventListener('click', async () => {
    await Clientes.guardarCambiosDomicilioHandler(document.getElementById('ficha-id').textContent);
    // el re-render de la ficha se hace en guardarCambiosDomicilioHandler
  });

  renderizarTablaHistorial(cliente, 'puntos');
  renderizarTablaHistorial(cliente, 'canjes');
  renderizarTablaHistorial(cliente, 'compras');

  cancelarEdicionDatos();
  cancelarEdicionPuntos();

  fichaSinResultados.style.display = 'none';
  fichaContenido.style.display = 'block';
  openTab('ficha');
  document.getElementById('ficha-buscar-cliente').value = cliente.numeroSocio;
}



function renderizarTablaHistorial(cliente, tipo) {
  let tbody, historial, htmlGenerator;
  switch (tipo) {
    case 'puntos':
      tbody = document.querySelector('#ficha-tabla-historial-puntos tbody');
      // Helper para sort
      const _getDate = d => (d && d.toDate ? d.toDate() : new Date(d));
      historial = (cliente.historialPuntos || []).sort((a, b) => _getDate(b.fechaObtencion) - _getDate(a.fechaObtencion));
      htmlGenerator = (item) => {
        const _safe = (d) => {
          if (!d) return null;
          if (d.toDate) return d.toDate();
          if (typeof d === 'string') return new Date(d);
          return d; // Date o number
        };

        const fechaObtencion = _safe(item.fechaObtencion);
        if (!fechaObtencion || isNaN(fechaObtencion)) return '<tr><td colspan=4>Error Fecha</td></tr>';

        const fechaCaducidad = new Date(fechaObtencion);
        fechaCaducidad.setUTCDate(fechaCaducidad.getUTCDate() + (item.diasCaducidad || 90));

        const puntosObtenidos = item.puntosObtenidos || 0;
        const puntosDisponibles = item.puntosDisponibles !== undefined ? item.puntosDisponibles : puntosObtenidos;

        const isCaducado = item.estado === 'Caducado';
        const isAgotado = puntosDisponibles <= 0;
        const isParcial = puntosDisponibles < puntosObtenidos;

        let displayPuntos = '';
        let rowStyle = '';
        if (isCaducado) {
          displayPuntos = `<span style="text-decoration: line-through; color: #6c757d;">${puntosObtenidos}</span>`;
          rowStyle = `color: #6c757d;`;
        } else if (isAgotado) {
          displayPuntos = `<span style="text-decoration: line-through; color: #dc3545;">${puntosObtenidos}</span>`;
          rowStyle = `background-color: #f8d7da55;`;
        } else if (isParcial) {
          const puntosUsados = puntosObtenidos - puntosDisponibles;
          displayPuntos = `<span style="text-decoration: line-through; color: #ffc107;">${puntosUsados}</span> ${puntosDisponibles} de ${puntosObtenidos}`;
          rowStyle = `background-color: #fff3cd55;`;
        } else {
          displayPuntos = `${puntosObtenidos}`;
        }
        return `<tr style="${rowStyle}"><td><b>${displayPuntos}</b></td><td>${item.origen}</td><td>${formatearFechaYHora(item.fechaObtencion)}</td><td><b>${formatearFecha(fechaCaducidad.toISOString())}</b></td></tr>`;
      };
      break;

    case 'canjes':
      tbody = document.querySelector('#ficha-tabla-historial-canjes tbody');
      historial = (cliente.historialCanjes || []).sort((a, b) => new Date(b.fechaCanje) - new Date(a.fechaCanje));
      htmlGenerator = (item) => `<tr><td>${formatearFechaYHora(item.fechaCanje)}</td><td>${item.nombrePremio}</td><td>${item.puntosCoste}</td></tr>`;
      break;

    case 'compras':
      tbody = document.querySelector('#ficha-tabla-historial-compras tbody');
      historial = (cliente.historialPuntos || [])
        .filter(h => h.origen && h.origen.toLowerCase().startsWith('compra'))
        .sort((a, b) => new Date(b.fechaObtencion) - new Date(a.fechaObtencion));
      htmlGenerator = (item) => `<tr><td>${formatearFechaYHora(item.fechaObtencion)}</td><td>${item.origen}</td><td>${item.puntosObtenidos}</td></tr>`;
      break;

    default:
      return;
  }
  if (!tbody) return;
  tbody.innerHTML = historial.length > 0
    ? historial.map(htmlGenerator).join('')
    : `<tr><td colspan="4">No hay historial disponible.</td></tr>`;
}

export function activarEdicionDatos() {
  const numeroSocio = document.getElementById('ficha-numero-socio').textContent;
  const cliente = appData.clientes.find(c => c.numeroSocio && c.numeroSocio.toString() === numeroSocio);
  if (!cliente) return;
  document.getElementById('edit-ficha-nombre').value = cliente.nombre;
  document.getElementById('edit-ficha-dni').value = cliente.dni || '';
  document.getElementById('edit-ficha-email').value = cliente.email || '';
  document.getElementById('edit-ficha-telefono').value = cliente.telefono || '';
  document.getElementById('edit-ficha-nacimiento').value = cliente.fechaNacimiento || '';
  document.getElementById('edit-ficha-esTester').checked = cliente.esTester === true;
  document.getElementById('ficha-vista').style.display = 'none';
  document.getElementById('ficha-edicion-datos').style.display = 'block';
}

export function cancelarEdicionDatos() {
  document.getElementById('ficha-vista').style.display = 'block';
  document.getElementById('ficha-edicion-datos').style.display = 'none';
}

export function activarEdicionPuntos() {
  const numeroSocio = document.getElementById('ficha-numero-socio').textContent;
  const cliente = appData.clientes.find(c => c.numeroSocio && c.numeroSocio.toString() === numeroSocio);
  if (!cliente) return;
  document.getElementById('edit-ficha-puntos').value = cliente.puntos || 0;
  document.getElementById('edit-ficha-saldo').value = cliente.saldoAcumulado || 0;
  document.getElementById('vista-puntos-saldo').style.display = 'none';
  document.getElementById('edicion-puntos-saldo').style.display = 'block';
}

export function cancelarEdicionPuntos() {
  document.getElementById('vista-puntos-saldo').style.display = 'block';
  document.getElementById('edicion-puntos-saldo').style.display = 'none';
}

export function limpiarFormularioRegistro() {
  // Campos generales
  [
    'nuevo-dni', 'nuevo-nombre', 'nuevo-email', 'nuevo-telefono',
    'nuevo-fecha-nacimiento', 'nuevo-fecha-inscripcion'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });

  // Domicilio (IDs ACTUALES)
  [
    'nuevo-calle', 'nuevo-numero', 'nuevo-piso', 'nuevo-depto',
    'nuevo-provincia', 'nuevo-partido',
    'nuevo-localidad-select', 'nuevo-localidad-input',
    'nuevo-cp', 'nuevo-pais', 'nuevo-referencia'
  ].forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    if (el.tagName === 'SELECT') el.selectedIndex = 0;
    else el.value = '';
  });

  // Defaults
  const pais = document.getElementById('nuevo-pais');
  if (pais) pais.value = 'AR';

  const preview = document.getElementById('preview-addressLine');
  if (preview) preview.textContent = '—';

  const fechaIns = document.getElementById('nuevo-fecha-inscripcion');
  if (fechaIns && 'valueAsDate' in fechaIns) fechaIns.valueAsDate = new Date();

  // Reforzar estado inicial del modo (CABA/BA/Otro)
  const selProv = document.getElementById('nuevo-provincia');
  if (selProv) selProv.dispatchEvent(new Event('change'));
}


export function actualizarContadorSuscritos() {
  const contadorSpan = document.getElementById('notif-suscritos-count');
  if (!contadorSpan) return;
  const suscritos = appData.clientes.filter(c => c.fcmTokens && c.fcmTokens.length > 0).length;
  contadorSpan.textContent = suscritos;
}

export function manejarSeleccionDestinatario() {
  const containerBusqueda = document.getElementById('buscar-cliente-notificacion-container');
  if (document.getElementById('enviar-a-uno').checked) {
    containerBusqueda.style.display = 'block';
  } else {
    containerBusqueda.style.display = 'none';
    document.getElementById('cliente-encontrado-notificacion').textContent = '';
  }
}

export function verificarCumpleanos() {
  const cumpleaneros = obtenerCumpleanerosDeHoy();
  const botonVerCumpleanos = document.getElementById('ver-cumpleanos-btn');
  if (!botonVerCumpleanos) return;
  if (cumpleaneros.length > 0) {
    const nombres = cumpleaneros.map(c => c.nombre).join(', ');
    const mensaje = `🎂 ¡Hoy es el cumpleaños de: ${nombres}!`;
    showToast(mensaje, 'info', 15000);
    botonVerCumpleanos.classList.add('active');
    botonVerCumpleanos.title = `Hoy cumplen años ${nombres}`;
  } else {
    botonVerCumpleanos.classList.remove('active');
    botonVerCumpleanos.title = 'No hay cumpleaños hoy';
  }
}

export function abrirModalCumpleanos() {
  const modal = document.getElementById('cumpleanos-modal');
  const lista = document.getElementById('lista-cumpleaneros');
  const cumpleaneros = obtenerCumpleanerosDeHoy();
  lista.innerHTML = '';
  if (cumpleaneros.length > 0) {
    cumpleaneros.forEach(cliente => {
      const li = document.createElement('li');
      li.textContent = `${cliente.nombre} (N° Socio: ${cliente.numeroSocio})`;
      lista.appendChild(li);
    });
  } else {
    const li = document.createElement('li');
    li.textContent = 'No hay clientes que cumplan años hoy.';
    lista.appendChild(li);
  }
  modal.style.display = 'block';
}

export function cerrarModalCumpleanos() {
  document.getElementById('cumpleanos-modal').style.display = 'none';
}

// ===================== FIX DEFENSIVO + NUEVOS CAMPOS =====================
export function renderizarConfiguracion(cfg = {}) {
  const setValue = (id, val) => { const el = document.getElementById(id); if (el) el.value = val ?? ''; };
  const setChecked = (id, val) => { const el = document.getElementById(id); if (el) el.checked = !!val; };
  const setSelect = (id, val) => { const el = document.getElementById(id); if (el) el.value = (val ?? el.value ?? ''); };

  // Campos “clásicos”
  setValue('tasa-conversion', cfg.tasaConversion ?? 100);
  setValue('multiplicador-efectivo', cfg.multiplicadorEfectivo ?? 1);
  setChecked('bono-bienvenida-activo', !!cfg.bono_bienvenida_activo);
  setValue('bono-bienvenida-puntos', cfg.bono_bienvenida_puntos ?? 0);

  // Beneficio por pago en efectivo (nuevo esquema)
  setChecked('cfg-efectivo-activo', !!cfg.pago_efectivo_activo);
  setSelect('cfg-efectivo-modo', cfg.pago_efectivo_modo ?? 'add');     // 'add' | 'mul'
  setValue('cfg-efectivo-valor', cfg.pago_efectivo_valor ?? 10);        // número (puntos o factor)
  setSelect('cfg-efectivo-scope', cfg.pago_efectivo_scope ?? 'post_bono');

  // Reglas de caducidad (si hay contenedor y función)
  if (Array.isArray(cfg.reglasCaducidad) && typeof cargarReglasCaducidadUI === 'function') {
    cargarReglasCaducidadUI(cfg.reglasCaducidad);
  }
}
// ========================================================================

export function cargarReglasCaducidadUI(reglas) {
  const container = document.getElementById('config-caducidad-container');
  if (!container) return;
  container.innerHTML = '<div><label style="width: 120px; display: inline-block; font-weight: bold;">Mín. Puntos</label><label style="font-weight: bold;">Días validez</label></div>';

  const reglasOrdenadas = [...(reglas || [])].sort((a, b) => a.minPuntos - b.minPuntos);
  reglasOrdenadas.forEach(regla => {
    const div = document.createElement('div');
    div.className = 'config-caducidad-item';
    div.innerHTML = `
      <input type="number" class="regla-min" value="${regla.minPuntos}" style="width: 120px;">
      <input type="number" class="regla-dias" value="${regla.cadaDias}" style="width: 120px;">
      <button class="eliminar-regla-btn danger-btn" data-min-puntos="${regla.minPuntos}">X</button>
    `;
    container.appendChild(div);
  });
}

export function actualizarTablaPremiosAdmin() {
  const tbody = document.querySelector('#tabla-premios tbody');
  if (tbody) {
    tbody.innerHTML = appData.premios.map(p => `
      <tr>
        <td>${p.id.substring(0, 6)}...</td>
        <td>${p.nombre}</td>
        <td>${p.puntos}</td>
        <td ${p.stock <= 5 ? 'style="color:red;"' : ''}>${p.stock}</td>
        <td class="acciones">
          <button class="editar-premio-btn secondary-btn" data-id="${p.id}">Editar</button>
          <button class="eliminar-premio-btn danger-btn" data-id="${p.id}">Eliminar</button>
        </td>
      </tr>
    `).join('');
  }
}

export function cancelarEdicionPremio() {
  document.getElementById('nuevo-premio-nombre').value = '';
  document.getElementById('nuevo-premio-puntos').value = '';
  document.getElementById('nuevo-premio-stock').value = '';
  document.getElementById('botones-edicion-premio').style.display = 'none';
  document.getElementById('agregar-premio-btn').style.display = 'block';
}

export function actualizarTablaBonosAdmin() {
  const tbody = document.querySelector('#tabla-bonos tbody');
  if (tbody) {
    tbody.innerHTML = appData.bonos.map(b => {
      const tipoBonoStr = b.tipo === 'manual' ? 'Bono Fijo' : 'Bono por Compra';
      const valorEfectoStr = b.tipo === 'manual' ? `+${b.valor} Puntos` : `Multiplicador x${b.valor}`;
      return `
        <tr>
          <td>${b.id.substring(0, 6)}...</td>
          <td>${b.nombre}</td>
          <td>${tipoBonoStr}</td>
          <td>${valorEfectoStr}</td>
          <td class="acciones">
            <button class="editar-bono-btn secondary-btn" data-id="${b.id}">Editar</button>
            <button class="eliminar-bono-btn danger-btn" data-id="${b.id}">Eliminar</button>
          </td>
        </tr>
      `;
    }).join('');
  }
}

export function cancelarEdicionBono() {
  document.getElementById('nuevo-bono-nombre').value = '';
  document.getElementById('nuevo-bono-valor').value = '';
  document.getElementById('nuevo-bono-tipo').value = 'manual';
  actualizarLabelValorBono();
  document.getElementById('botones-edicion-bono').style.display = 'none';
  document.getElementById('agregar-bono-btn').style.display = 'block';
}

export function actualizarLabelValorBono() {
  const tipo = document.getElementById('nuevo-bono-tipo').value;
  const label = document.getElementById('nuevo-bono-valor-label');
  label.textContent = tipo === 'manual' ? 'Puntos a Otorgar' : 'Valor Multiplicador (ej: 2 para doble)';
}

export function actualizarUIPath() {
  const pathElement = document.getElementById('current-path');
  if (pathElement) {
    pathElement.textContent = "Base de datos en Firebase (En tiempo real)";
    pathElement.style.color = "green";
  }
}

export function cargarSelectorPlantillas() {
  const selector = document.getElementById('plantilla-selector');
  if (!selector) return;
  const idSeleccionado = selector.value;
  selector.innerHTML = '<option value="">-- Selecciona una plantilla --</option>';
  for (const id in appData.plantillas) {
    const option = document.createElement('option');
    option.value = id;
    option.textContent = id.charAt(0).toUpperCase() + id.slice(1).replace(/_/g, ' ');
    selector.appendChild(option);
  }
  selector.value = idSeleccionado;
}

export function mostrarPlantillaParaEdicion(plantillaId) {
  const tituloInput = document.getElementById('plantilla-titulo-edit');
  const cuerpoTextarea = document.getElementById('plantilla-cuerpo-edit');
  const plantilla = appData.plantillas[plantillaId];
  if (!plantillaId || !plantilla) { tituloInput.value = ''; cuerpoTextarea.value = ''; return; }
  tituloInput.value = plantilla.titulo || '';
  cuerpoTextarea.value = plantilla.cuerpo || '';
}

// ---------------- Tabla de campañas ----------------
export function renderizarTablaCampanas() {
  const tbody = document.getElementById('tabla-campanas-body');
  if (!tbody) return;

  if (!appData.campanas || appData.campanas.length === 0) {
    tbody.innerHTML = '<tr><td colspan="5">No hay campañas creadas.</td></tr>';
    return;
  }

  const hoy = new Date().toISOString().split('T')[0];

  tbody.innerHTML = appData.campanas.map(campana => {
    let estadoLabel = '';
    let estadoClass = '';
    if (!campana.estaActiva) {
      estadoLabel = 'Deshabilitada';
      estadoClass = 'status-finalizada';
    } else if (campana.fechaFin && campana.fechaFin !== '2100-01-01' && hoy > campana.fechaFin) {
      estadoLabel = 'Finalizada';
      estadoClass = 'status-finalizada';
    } else if (hoy >= campana.fechaInicio) {
      estadoLabel = 'Activa';
      estadoClass = 'status-activa';
    } else {
      estadoLabel = 'Programada';
      estadoClass = 'status-programada';
    }

    let tipoStr = '';
    switch (campana.tipo) {
      case 'informativa': tipoStr = 'Informativa'; break;
      case 'multiplicador_compra': tipoStr = `Promoción (x${campana.valor})`; break;
      case 'bono_fijo_compra': tipoStr = `Promoción (+${campana.valor})`; break;
      default: tipoStr = 'N/A';
    }

    // etiqueta visual si es solo para testers
    if (campana.visibilidad === 'prueba') {
      tipoStr += ` <span class="tester-badge">TESTER</span>`;
    }

    const vigenciaStr = !campana.fechaInicio ? 'Indefinida'
      : (campana.fechaFin === '2100-01-01' || !campana.fechaFin
        ? `${formatearFecha(campana.fechaInicio)} en adelante`
        : `${formatearFecha(campana.fechaInicio)} a ${formatearFecha(campana.fechaFin)}`);

    return `
      <tr data-id="${campana.id}" style="cursor: pointer;">
        <td>${campana.estaActiva ? '✔️' : '❌'}</td>
        <td>
          <strong>${campana.nombre}</strong><br>
          <small>${tipoStr}</small>
        </td>
        <td>${vigenciaStr}</td>
        <td><span class="status-badge ${estadoClass}">${estadoLabel}</span></td>
        <td class="acciones">
          <button class="editar-campana-btn secondary-btn" data-id="${campana.id}">Editar</button>
          <button class="eliminar-campana-btn danger-btn" data-id="${campana.id}">Eliminar</button>
        </td>
      </tr>
    `;
  }).join('');
}

export function habilitarFormularioCampana(habilitar) {
  const form = document.getElementById('form-campana');
  if (form) {
    Array.from(form.elements).forEach(el => {
      if (el.id !== 'guardar-campana-editada-btn' &&
        el.id !== 'cancelar-edicion-campana-btn' &&
        el.id !== 'crear-campana-btn') {
        el.disabled = !habilitar;
      }
    });
  }
}

export function deshabilitarBotonesFormulario(deshabilitar) {
  const botones = [
    document.getElementById('crear-campana-btn'),
    document.getElementById('guardar-campana-editada-btn'),
  ];
  botones.forEach(btn => { if (btn) btn.disabled = deshabilitar; });
}

export function seleccionarFilaTabla(idTbody, idFila) {
  const tbody = document.getElementById(idTbody);
  if (!tbody) return;
  tbody.querySelectorAll('tr').forEach(tr => tr.classList.remove('fila-seleccionada'));
  if (idFila) {
    const fila = tbody.querySelector(`tr[data-id="${idFila}"]`);
    if (fila) fila.classList.add('fila-seleccionada');
  }
}
// ====================== AUTOCOMPLETE (core) ======================
let _acIndex = [];

function _norm(s = '') {
  return (s + '')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase().trim();
}
function _digits(s = '') { return (s + '').replace(/\D+/g, ''); }

export function buildSearchIndex(clientes = []) {
  _acIndex = (clientes || []).map(c => ({
    id: c.id,
    numeroSocio: c.numeroSocio || '',
    dni: c.dni || '',
    nombre: c.nombre || '',
    email: c.email || '',
    puntos: c.puntos || 0,
    _k: {
      socio: _digits(c.numeroSocio || ''),
      dni: _digits(c.dni || ''),
      nombre: _norm(c.nombre || ''),
      email: _norm(c.email || '')
    }
  }));
}

function _rankMatches(q) {
  const qn = _norm(q);
  const qd = _digits(q);
  const startsWith = [], contains = [];
  for (const it of _acIndex) {
    const hitStart =
      (qd && (it._k.socio.startsWith(qd) || it._k.dni.startsWith(qd))) ||
      it._k.email.startsWith(qn) || it._k.nombre.startsWith(qn);
    const hitContain =
      (qd && (it._k.socio.includes(qd) || it._k.dni.includes(qd))) ||
      it._k.email.includes(qn) || it._k.nombre.includes(qn);

    if (hitStart) startsWith.push(it);
    else if (hitContain) contains.push(it);
  }
  // ordenar por puntos desc y nombre asc
  const order = (a, b) => (b.puntos - a.puntos) || String(a.nombre).localeCompare(b.nombre);
  return [...startsWith.sort(order), ...contains.sort(order)].slice(0, 10);
}

function _ensureList(id) {
  let el = document.getElementById(id);
  if (!el) {
    el = document.createElement('div');
    el.id = id;
    el.className = 'autocomplete-list';
    document.body.appendChild(el);
  }
  return el;
}

function _placeList(listEl, inputEl) {
  const r = inputEl.getBoundingClientRect();
  listEl.style.minWidth = r.width + 'px';
  listEl.style.left = (window.scrollX + r.left) + 'px';
  listEl.style.top = (window.scrollY + r.bottom + 4) + 'px';
}

export function attachAutocomplete(inputId, { onPick, minChars = 2 } = {}) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const listId = `ac-${inputId}`;
  const listEl = _ensureList(listId);
  let items = [];
  let idx = -1;
  let hideT;

  const hide = () => { listEl.style.display = 'none'; listEl.innerHTML = ''; idx = -1; items = []; };
  const show = (q) => {
    if (!q || q.length < minChars) { hide(); return; }
    items = _rankMatches(q);
    if (!items.length) { hide(); return; }
    listEl.innerHTML = items.map((it, i) => `
      <div class="autocomplete-item" data-i="${i}">
        <div><b>${it.numeroSocio || '—'}</b> · ${it.nombre || 'Sin nombre'}</div>
        <small>DNI: ${it.dni || '—'} · ${it.email || '—'}</small>
      </div>
    `).join('');
    Array.from(listEl.children).forEach(el => {
      el.onclick = () => pick(parseInt(el.dataset.i, 10));
    });
    _placeList(listEl, input);
    listEl.style.display = 'block';
    idx = -1;
  };

  const pick = (i) => {
    if (i < 0 || i >= items.length) return;
    const it = items[i];
    hide();
    onPick && onPick(it);
  };

  const move = (delta) => {
    if (!items.length) return;
    idx = (idx + delta + items.length) % items.length;
    Array.from(listEl.children).forEach((el, j) => {
      if (j === idx) el.classList.add('active'); else el.classList.remove('active');
    });
  };

  const onInput = (e) => {
    clearTimeout(hideT);
    const v = e.target.value.trim();
    show(v);
  };
  const onKeyDown = (e) => {
    if (listEl.style.display !== 'block') return;
    if (e.key === 'ArrowDown') { e.preventDefault(); move(1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); move(-1); }
    else if (e.key === 'Enter') { if (idx >= 0) { e.preventDefault(); pick(idx); } }
    else if (e.key === 'Escape') { hide(); }
  };

  input.addEventListener('input', onInput);
  input.addEventListener('keydown', onKeyDown);
  input.addEventListener('focus', () => { if (input.value.length >= minChars) show(input.value); });
  input.addEventListener('blur', () => { hideT = setTimeout(hide, 150); });
}
// ==================== /AUTOCOMPLETE (core) ====================
