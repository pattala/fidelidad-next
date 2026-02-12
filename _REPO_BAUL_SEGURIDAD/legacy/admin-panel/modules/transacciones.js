// --------------------------------------------------------------------
// MÓDULO: TRANSACCIONES (VERSIÓN 3.2 – persistencia vencimientos + CFG unificado)
// --------------------------------------------------------------------
import { db, firebase } from './firebase.js';
import { appData } from './data.js';
import * as UI from './ui.js';
import { obtenerDiasCaducidadParaPuntos } from './clientes.js';
import { enviarNotificacionTransaccional } from './notificaciones.js';

/* ===================== CANJE DE PREMIOS ===================== */

let _canjeClienteId = null;
let _canjeClienteData = null;
let _canjePremioId = null;

// Asegura tener premios en memoria
async function ensurePremiosCargados() {
  try {
    if (Array.isArray(appData?.premios) && appData.premios.length) return appData.premios;
  } catch (_) {}
  const snap = await db.collection('premios').orderBy('puntos', 'asc').get();
  const premios = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  try { appData.premios = premios; } catch (_) {}
  return premios;
}

// Limpia UI del canje
function limpiarUICanje() {
  const info = document.getElementById('info-cliente');
  const tbody = document.querySelector('#lista-premios tbody');
  const btn = document.getElementById('canjear-premio-btn');
  if (info) info.style.display = 'none';
  if (tbody) tbody.innerHTML = '';
  if (btn) btn.style.display = 'none';
  _canjeClienteId = null;
  _canjeClienteData = null;
  _canjePremioId = null;
}

// Calcula puntos que vencen más pronto (para la UI del canje)
function calcularProxCaducarAdmin(cliente = {}) {
  const todayStart = (() => { const d = new Date(); d.setHours(0,0,0,0); return +d; })();
  const arr = [];

  // prioridad 1: vencimientos[]
  if (Array.isArray(cliente.vencimientos) && cliente.vencimientos.length) {
    cliente.vencimientos.forEach(v => {
      const pts = Number(v?.puntos || 0);
      let ms = 0;
      if (v?.venceAt?.toDate) ms = +v.venceAt.toDate();
      else if (v?.venceAt) ms = +new Date(v.venceAt);
      if (pts > 0 && ms && ms >= todayStart) arr.push({ ts: ms, puntos: pts });
    });
  }

  // prioridad 2: historialPuntos
  if (!arr.length && Array.isArray(cliente.historialPuntos)) {
    cliente.historialPuntos.forEach(h => {
      const disp = Number(h?.puntosDisponibles ?? h?.puntosObtenidos ?? 0);
      const dias = Number(h?.diasCaducidad || 0);
      const obt = h?.fechaObtencion?.toDate ? h.fechaObtencion.toDate() :
                  h?.fechaObtencion ? new Date(h.fechaObtencion) : null;
      if (!obt || dias <= 0 || disp <= 0) return;
      const vence = new Date(obt); vence.setHours(23,59,59,999); vence.setDate(vence.getDate()+dias);
      const ms = +vence;
      if (ms >= todayStart) arr.push({ ts: ms, puntos: disp });
    });
  }

  if (!arr.length) return 0;
  arr.sort((a,b)=>a.ts-b.ts);
  const first = arr[0].ts;
  return arr.filter(x => x.ts === first).reduce((acc,x)=>acc+x.puntos, 0);
}

// Pinta cabecera del cliente en la sección Canjear
function pintarInfoClienteCanje(doc) {
  const data = doc.data() || {};
  const info = document.getElementById('info-cliente');
  if (!info) return;
  info.style.display = 'block';

  const nombre = document.getElementById('cliente-nombre');
  const dni = document.getElementById('cliente-dni-premio');
  const pts = document.getElementById('cliente-puntos');
  const prox = document.getElementById('cliente-puntos-proximos');

  if (nombre) nombre.textContent = data?.nombre || '(sin nombre)';
  if (dni)    dni.textContent    = data?.dni ?? '';
  if (pts)    pts.textContent    = Number(data?.puntos || 0);
  if (prox)   prox.textContent   = calcularProxCaducarAdmin(data) || 0;
}

// Render de tabla de premios (habilita click-to-select)
function pintarListaPremios(premios, puntosCliente) {
  const tbody = document.querySelector('#lista-premios tbody');
  const btn   = document.getElementById('canjear-premio-btn');
  if (!tbody) return;

  tbody.innerHTML = premios.map(p => {
    const canjeable = Number(puntosCliente) >= Number(p.puntos) && Number(p.stock || 0) > 0;
    const disabled  = canjeable ? '' : 'disabled';
    return `
      <tr data-id="${p.id}" class="${canjeable ? 'canjeable' : 'no-canjeable'}">
        <td>${p.nombre}</td>
        <td>${p.puntos}</td>
        <td>${Number(p.stock || 0)}</td>
        <td style="text-align:center;">
          <input type="radio" name="premio-canje" value="${p.id}" ${disabled} />
        </td>
      </tr>`;
  }).join('');

  // change: elegir radio habilita el botón
  tbody.onchange = (e) => {
    const radio = e.target.closest('input[type="radio"][name="premio-canje"]');
    if (!radio) return;
    _canjePremioId = radio.value;
    if (btn) btn.style.display = 'inline-block';
  };

  // (opcional) click en la fila tilda el radio si es canjeable
  tbody.onclick = (e) => {
    const tr = e.target.closest('tr[data-id]');
    if (!tr || tr.classList.contains('no-canjeable')) return;
    const radio = tr.querySelector('input[type="radio"]');
    if (radio && !radio.disabled) {
      radio.checked = true;
      radio.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
}


// Busca cliente (por N° Socio o DNI) y lista premios
export async function buscarClienteParaCanjeHandler() {
  const input = document.getElementById('cliente-premio');
  if (!input) return;
  const q = String(input.value || '').trim();
  limpiarUICanje();

  if (!q) return UI.showToast('Ingresá N° Socio o DNI para buscar.', 'warning');

  try {
    // Reutilizamos helper de compras (definido en el módulo): fetchClienteBySocioODNI
    const doc = await (typeof fetchClienteBySocioODNI === 'function'
      ? fetchClienteBySocioODNI(q)
      : (async () => {
          // fallback mínimo si no está el helper
          const col = db.collection('clientes');
          if (/^\d+$/.test(q)) {
            const num = Number(q);
            let s = await col.where('numeroSocio','==',num).limit(1).get();
            if (!s.empty) return s.docs[0];
            s = await col.where('dni','==',q).limit(1).get();
            if (!s.empty) return s.docs[0];
          } else {
            const s = await col.where('dni','==',q).limit(1).get();
            if (!s.empty) return s.docs[0];
          }
          return null;
        })()
    );

    if (!doc) return UI.showToast('No se encontró cliente con ese N° Socio o DNI.', 'error');

    _canjeClienteId   = doc.id;
    _canjeClienteData = doc.data() || {};

    const premios = await ensurePremiosCargados();
    pintarInfoClienteCanje(doc);
    pintarListaPremios(premios, Number(_canjeClienteData.puntos || 0));
    UI.showToast('Cliente cargado para canje.', 'success');
  } catch (e) {
    console.error('[ADMIN] Error buscando cliente para canje:', e);
    UI.showToast('Ocurrió un error al buscar el cliente.', 'error');
  }
}

// Consume puntos FIFO desde historialPuntos
function consumirPuntosFIFO(hist, aConsumir) {
  const orden = [...(hist || [])].sort((a,b) => {
    const da = a?.fechaObtencion?.toDate ? +a.fechaObtencion.toDate() : +new Date(a.fechaObtencion || 0);
    const db = b?.fechaObtencion?.toDate ? +b.fechaObtencion.toDate() : +new Date(b.fechaObtencion || 0);
    return da - db;
  });

  let rest = Number(aConsumir || 0);
  const out = orden.map(it => {
    const disp = Number(it?.puntosDisponibles ?? 0);
    if (rest <= 0 || disp <= 0) return it;
    const usar = Math.min(disp, rest);
    rest -= usar;
    return { ...it, puntosDisponibles: disp - usar };
  });

  return { nuevoHistorial: out, restante: rest };
}

// Canjear premio seleccionado
export async function canjearPremio() {
  if (!_canjeClienteId || !_canjePremioId) {
    return UI.showToast('Seleccioná un cliente y un premio.', 'warning');
  }

  const clienteRef = db.collection('clientes').doc(_canjeClienteId);
  const premioRef  = db.collection('premios').doc(_canjePremioId);

  const premioSeleccionado =
    (Array.isArray(appData?.premios) ? appData.premios : []).find(p => p.id === _canjePremioId) || null;

  try {
    // Transacción: descuenta puntos FIFO y stock
    await db.runTransaction(async (tx) => {
      const [cDoc, pDoc] = await Promise.all([tx.get(clienteRef), tx.get(premioRef)]);
      if (!cDoc.exists) throw new Error('Cliente no existe');
      if (!pDoc.exists) throw new Error('Premio no existe');

      const cliente = cDoc.data() || {};
      const premio  = pDoc.data() || {};
      const costo   = Number(premio.puntos || 0);
      const stock   = Number(premio.stock || 0);
      const ptsAct  = Number(cliente.puntos || 0);

      if (stock <= 0) throw new Error('Sin stock para este premio.');
      if (ptsAct < costo) throw new Error('Puntos insuficientes.');

      const { nuevoHistorial, restante } = consumirPuntosFIFO(cliente.historialPuntos, costo);
      if (restante > 0) throw new Error('No se pudo consumir todos los puntos.');

      tx.update(clienteRef, {
        puntos: firebase.firestore.FieldValue.increment(-costo),
        historialPuntos: nuevoHistorial,
        historialCanjes: firebase.firestore.FieldValue.arrayUnion({
          fechaCanje: new Date().toISOString(),
          nombrePremio: premio.nombre || '(sin nombre)',
          puntosCoste: costo
        })
      });

      tx.update(premioRef, { stock: firebase.firestore.FieldValue.increment(-1) });
    });

    // OK UI
    UI.showToast('✅ Canje registrado.', 'success');

    // Actualizar UI local (y guardar saldo para mail)
    const ptsSpan = document.getElementById('cliente-puntos');
    let puntosTotalesClientePost = null;
    if (ptsSpan) {
      const costo = Number((premioSeleccionado && premioSeleccionado.puntos) || 0);
      const nuevo = Math.max(0, Number(ptsSpan.textContent || 0) - costo);
      ptsSpan.textContent = nuevo;
      puntosTotalesClientePost = nuevo;
    }

    // Calcular próximo vencimiento post-canje (sobre todo el saldo)
    let puntosVencenPost = 0;
    let fechaVencePost = null;
    try {
      const cDocPost = await db.collection('clientes').doc(_canjeClienteId).get();
      if (cDocPost.exists) {
        const cDataPost = cDocPost.data() || {};
        const { puntosProximosAVencer, fechaProximoVencimiento } =
          computeProximoVencimientoDesdeHistorial(cDataPost.historialPuntos || []);
        puntosVencenPost = Number(puntosProximosAVencer || 0);
        fechaVencePost = fechaProximoVencimiento || null;
      }
    } catch (_) {}

    // Un solo envío (email + push)
    try {
      await enviarNotificacionTransaccional(
        { ..._canjeClienteData, id: _canjeClienteId },
        'premio_canjeado',
        {
          nombre: _canjeClienteData?.nombre || '',
          nombre_premio: (premioSeleccionado?.nombre) || '(sin nombre)',
          puntos_coste: Number((premioSeleccionado?.puntos) || 0),
          puntos_totales: (puntosTotalesClientePost != null)
            ? puntosTotalesClientePost
            : Number(document.getElementById('cliente-puntos')?.textContent || 0),
          puntos_vencen: puntosVencenPost,
          vencimiento_text: fechaVencePost ? fechaArg(fechaVencePost) : ''
        }
      );
    } catch (eNotif) {
      console.warn('[ADMIN] Notificación de canje no enviada:', eNotif?.message || eNotif);
    }

    // Limpiar selección y refrescar tabla
    const btn = document.getElementById('canjear-premio-btn');
    if (btn) btn.style.display = 'none';
    _canjePremioId = null;

    const premios = await ensurePremiosCargados();
    const puntosCliente = Number(document.getElementById('cliente-puntos')?.textContent || 0);
    pintarListaPremios(premios, puntosCliente);

  } catch (e) {
    console.error('[ADMIN] Error canjeando premio:', e);
    UI.showToast(e.message || 'No se pudo completar el canje.', 'error');
  }
}


/* ===================== BONOS Y AJUSTES ===================== */

let _bonoClienteId = null;
let _bonoClienteData = null;

// Pinta UI de detalle para bonos
function pintarClienteEnDetalleBono(doc) {
  const data = doc.data() || {};
  const cont = document.getElementById('detalle-bono-cliente');
  if (!cont) return;
  cont.style.display = 'block';
  _bonoClienteId   = doc.id;
  _bonoClienteData = data;

  const nombre = document.getElementById('nombre-cliente-bono');
  const pts    = document.getElementById('puntos-cliente-bono');
  if (nombre) nombre.textContent = data?.nombre || '(sin nombre)';
  if (pts)    pts.textContent    = Number(data?.puntos || 0);
}

// Llena el select con bonos tipo "manual"
function pintarBonosManuales(bonos) {
  const sel = document.getElementById('bono-a-aplicar');
  if (!sel) return;
  const manuales = (bonos || []).filter(b => b?.tipo === 'manual');
  sel.innerHTML = `<option value="">Elegí un bono manual</option>` + manuales
    .map(b => `<option value="${b.id}">${b.nombre} (+${b.valor} pts)</option>`)
    .join('');
}

// Buscar cliente para bonos (por N° Socio o DNI)
export async function buscarClienteParaBonoHandler() {
  const input = document.getElementById('cliente-bono-buscar');
  if (!input) return;
  const q = String(input.value || '').trim();
  const cont = document.getElementById('detalle-bono-cliente');
  if (cont) cont.style.display = 'none';
  _bonoClienteId = null; _bonoClienteData = null;

  if (!q) return UI.showToast('Ingresá N° Socio o DNI para buscar.', 'warning');

  try {
    const doc = await (typeof fetchClienteBySocioODNI === 'function'
      ? fetchClienteBySocioODNI(q)
      : (async () => {
          const col = db.collection('clientes');
          if (/^\d+$/.test(q)) {
            const num = Number(q);
            let s = await col.where('numeroSocio','==',num).limit(1).get();
            if (!s.empty) return s.docs[0];
            s = await col.where('dni','==',q).limit(1).get();
            if (!s.empty) return s.docs[0];
          } else {
            const s = await col.where('dni','==',q).limit(1).get();
            if (!s.empty) return s.docs[0];
          }
          return null;
        })()
    );

    if (!doc) return UI.showToast('No se encontró cliente con ese N° Socio o DNI.', 'error');

    // Cargar bonos si hace falta y pintar select
    const bonos = await ensureBonosCargados();
    pintarBonosManuales(bonos);
    pintarClienteEnDetalleBono(doc);
    UI.showToast('Cliente cargado para bono.', 'success');
  } catch (e) {
    console.error('[ADMIN] Error buscando cliente para bono:', e);
    UI.showToast('Ocurrió un error al buscar el cliente.', 'error');
  }
}

// Aplicar bono manual (suma fija de puntos)
// Aplicar bono manual (suma fija de puntos) + notificación correcta
export async function aplicarBonoManual() {
  if (!_bonoClienteId) return UI.showToast('Primero buscá un cliente.', 'warning');
  const sel   = document.getElementById('bono-a-aplicar');
  const razon = document.getElementById('bono-razon')?.value?.trim() || '';
  if (!sel || !sel.value) return UI.showToast('Elegí un bono manual.', 'warning');

  // Obtener bono desde appData o Firestore
  let bono = null;
  if (Array.isArray(appData?.bonos) && appData.bonos.length) {
    bono = appData.bonos.find(b => b.id === sel.value);
  }
  if (!bono) {
    const snap = await db.collection('bonos').doc(sel.value).get();
    bono = snap.exists ? { id: snap.id, ...snap.data() } : null;
  }
  if (!bono) return UI.showToast('Bono no encontrado.', 'error');
  if (bono.tipo !== 'manual') return UI.showToast('Este bono no es manual.', 'error');

  const puntos = Number(bono.valor || 0);
  if (!(puntos > 0)) return UI.showToast('Valor de bono inválido.', 'error');

  const clienteRef = db.collection('clientes').doc(_bonoClienteId);

  try {
    // 1) Persistir bono en transacción (suma puntos + entrada de historial)
    await db.runTransaction(async (tx) => {
      const cDoc = await tx.get(clienteRef);
      if (!cDoc.exists) throw new Error('Cliente no existe');
      const cliente = cDoc.data() || {};

      const dias = typeof obtenerDiasCaducidadParaPuntos === 'function'
        ? obtenerDiasCaducidadParaPuntos(puntos)
        : 365; // fallback

      const entrada = {
        fechaObtencion: new Date().toISOString(),
        puntosObtenidos: puntos,
        puntosDisponibles: puntos,
        diasCaducidad: dias,
        origen: `Bono manual: ${bono.nombre}${razon ? ' — ' + razon : ''}`
      };

      tx.update(clienteRef, {
        puntos: firebase.firestore.FieldValue.increment(puntos),
        historialPuntos: firebase.firestore.FieldValue.arrayUnion(entrada)
      });
    });

    // 2) Leer cliente actualizado para calcular saldo total y próximo vencimiento (correcto)
    const cDocPost = await clienteRef.get();
    const cDataPost = cDocPost.exists ? (cDocPost.data() || {}) : {};
    const { puntosProximosAVencer, fechaProximoVencimiento } =
      computeProximoVencimientoDesdeHistorial(cDataPost.historialPuntos || []);

    const puntosTotalesPost = Number(cDataPost.puntos || 0);

    // (opcional) persistir campos directos si querés mantenerlos al día
    await clienteRef.update({
      puntosProximosAVencer: Number(puntosProximosAVencer || 0),
      fechaProximoVencimiento: fechaProximoVencimiento || null
    });

    UI.showToast(`✅ Bono aplicado (+${puntos} pts).`, 'success');

    // 3) Refrescar UI visible
    const pts = document.getElementById('puntos-cliente-bono');
    if (pts) pts.textContent = puntosTotalesPost;

    // 4) Notificación (email + push) con la lógica correcta
    try {
      await enviarNotificacionTransaccional(
        { ..._bonoClienteData, id: _bonoClienteId },
        'puntos_ganados',
        {
          nombre: _bonoClienteData?.nombre || '',
          // evento del día 
          puntos_ganados: puntos,
          nombre_bono: bono.nombre || '',
          detalle_extra: razon ? `(${razon})` : '',

          // saldo total y próximo vencimiento (correcto sobre el total)
          puntos_totales: puntosTotalesPost,
          puntos_vencen: Number(puntosProximosAVencer || 0),
          vencimiento_text: fechaProximoVencimiento ? fechaArg(fechaProximoVencimiento) : ''
        }
      );
    } catch (eNotif) {
      console.warn('[ADMIN] Notificación de bono no enviada:', eNotif?.message || eNotif);
    }

  } catch (e) {
    console.error('[ADMIN] Error aplicando bono manual:', e);
    UI.showToast(e.message || 'No se pudo aplicar el bono.', 'error');
  }
}


/* ===================== COMPRAS: Buscar cliente (por N° Socio o DNI) ===================== */

// Limpia el panel de detalle
function limpiarDetalleCompra() {
  const cont = document.getElementById('detalle-compra-cliente');
  if (!cont) return;
  cont.style.display = 'none';
  cont.removeAttribute('data-cliente-id');
  const nombre = document.getElementById('nombre-cliente-compra');
  const dni    = document.getElementById('dni-cliente-compra');
  const pts    = document.getElementById('puntos-cliente-compra');
  if (nombre) nombre.textContent = '';
  if (dni)    dni.textContent    = '';
  if (pts)    pts.textContent    = '';
}

// Asegura tener bonos en memoria; si no, los trae
async function ensureBonosCargados() {
  try {
    if (Array.isArray(appData?.bonos) && appData.bonos.length) return appData.bonos;
  } catch (_) {}
  const snap = await db.collection('bonos').get();
  const bonos = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  try { appData.bonos = bonos; } catch (_) {}
  return bonos;
}

// Pinta los bonos de tipo "compra" en el <select>
function pintarBonosCompra(bonos) {
  const sel = document.getElementById('bono-compra-aplicar');
  if (!sel) return;
  const bonosCompra = (bonos || []).filter(b => (b?.tipo === 'compra'));
  sel.innerHTML = `<option value="">Sin bono</option>` + bonosCompra
    .map(b => `<option value="${b.id}">${b.nombre} (x${b.valor})</option>`)
    .join('');
}

// Setea la fecha de compra en hoy (corrigiendo tz)
function setDefaultFechaHoy() {
  const inp = document.getElementById('fecha-compra');
  if (!inp) return;
  const hoy = new Date();
  const iso = new Date(hoy.getTime() - hoy.getTimezoneOffset() * 60000)
                .toISOString().slice(0, 10);
  inp.value = iso;
}

// Busca un cliente por N° Socio o DNI (string o numérico)
async function fetchClienteBySocioODNI(qRaw) {
  const q = String(qRaw || '').trim();
  if (!q) return null;

  const col = db.collection('clientes');

  // ¿Sólo dígitos?
  if (/^\d+$/.test(q)) {
    const num = Number(q);
    // 1) número de socio exacto
    let snap = await col.where('numeroSocio', '==', num).limit(1).get();
    if (!snap.empty) return snap.docs[0];
    // 2) DNI como string exacto
    snap = await col.where('dni', '==', q).limit(1).get();
    if (!snap.empty) return snap.docs[0];
    // 3) DNI numérico (por si lo guardaste como number)
    try {
      snap = await col.where('dni', '==', num).limit(1).get();
      if (!snap.empty) return snap.docs[0];
    } catch (_) {}
  } else {
    // No sólo dígitos → DNI string
    const snap = await col.where('dni', '==', q).limit(1).get();
    if (!snap.empty) return snap.docs[0];
  }

  return null;
}

// Pinta los datos del cliente en el panel de compra (Paso 2)
function pintarClienteEnDetalle(doc) {
  const data = doc.data() || {};
  const cont = document.getElementById('detalle-compra-cliente');
  if (!cont) return;

  cont.setAttribute('data-cliente-id', doc.id);
  cont.style.display = 'block';

  const nombre = document.getElementById('nombre-cliente-compra');
  const dni    = document.getElementById('dni-cliente-compra');
  const pts    = document.getElementById('puntos-cliente-compra');

  if (nombre) nombre.textContent = data?.nombre || '(sin nombre)';
  if (dni)    dni.textContent    = data?.dni ?? '';
  if (pts)    pts.textContent    = Number(data?.puntos || 0);

  setDefaultFechaHoy();
}

// === Exportado: handler que espera app.js ===
export async function buscarClienteParaCompraHandler() {
  const input = document.getElementById('cliente-compra-buscar');
  if (!input) return;

  const q = input.value;
  limpiarDetalleCompra();

  if (!q || !q.trim()) {
    UI.showToast('Ingresá N° Socio o DNI para buscar.', 'warning');
    return;
  }

  try {
    const doc = await fetchClienteBySocioODNI(q);
    if (!doc) {
      UI.showToast('No se encontró cliente con ese N° Socio o DNI.', 'error');
      return;
    }
    const bonos = await ensureBonosCargados();
    pintarBonosCompra(bonos);
    pintarClienteEnDetalle(doc);
    UI.showToast('Cliente cargado para compra.', 'success');
  } catch (e) {
    console.error('[ADMIN] Error buscando cliente para compra:', e);
    UI.showToast('Ocurrió un error al buscar el cliente.', 'error');
  }
}

// ─────────────────────────────────────────────────────────────
// ANCLA: Helpers base
function sumarDias(fecha, dias) { const f = new Date(fecha); f.setDate(f.getDate() + Number(dias||0)); return f; }
function fechaArg(fecha) { try { return new Intl.DateTimeFormat('es-AR',{day:'2-digit',month:'2-digit',year:'numeric'}).format(fecha);} catch(e){ return fecha.toISOString().slice(0,10);} }
// ─────────────────────────────────────────────────────────────

// RAMPET FIX: helper para calcular próximo vencimiento desde historial
function computeProximoVencimientoDesdeHistorial(historial) {
  const hoy = new Date();
  const arr = Array.isArray(historial) ? historial : [];

  const futuros = arr
    .filter(i => (i?.puntosDisponibles ?? 0) > 0 && (i?.diasCaducidad ?? 0) > 0)
    .map(i => {
      const base = (typeof i?.fechaObtencion?.toDate === 'function')
        ? i.fechaObtencion.toDate()
        : new Date(i?.fechaObtencion);
      if (!base || isNaN(base)) return null;
      const vence = new Date(base.getTime());
      vence.setDate(vence.getDate() + Number(i.diasCaducidad || 0));
      return { vence, puntos: Number(i.puntosDisponibles || 0) };
    })
    .filter(Boolean)
    .filter(x => x.vence > hoy)
    .sort((a, b) => a.vence - b.vence);

  if (!futuros.length) return { puntosProximosAVencer: 0, fechaProximoVencimiento: null };

  const minFecha = futuros[0].vence;
  const sameDay = (a, b) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  const puntos = futuros
    .filter(b => sameDay(b.vence, minFecha))
    .reduce((acc, b) => acc + b.puntos, 0);

  return { puntosProximosAVencer: puntos, fechaProximoVencimiento: minFecha };
}

// ─────────────────────────────────────────────────────────────
// ANCLA: Cache CFG
let CFG = {
  tasaConversion: 100,
  pago_efectivo_activo: false,
  pago_efectivo_modo: 'add',          // 'add' | 'mul'
  pago_efectivo_valor: 0,             // 10 si add | 1.2 si mul
  pago_efectivo_scope: 'post_bono'    // 'post_bono' | 'base'
};

// RAMPET FIX: leer desde 'configuracion/parametros' y usar propiedad unificada 'pago_efectivo_scope'
async function cargarCFG() {
  const snap = await db.collection('configuracion').doc('parametros').get();
  if (snap.exists) {
    const d = snap.data() || {};
    CFG.tasaConversion = Number(d.tasaConversion ?? 100);
    CFG.pago_efectivo_activo = !!d.pago_efectivo_activo;
    CFG.pago_efectivo_modo = d.pago_efectivo_modo || 'add';
    CFG.pago_efectivo_valor = Number(d.pago_efectivo_valor ?? 0);
    CFG.pago_efectivo_scope = d.pago_efectivo_scope || 'post_bono';
  }
}

// =================== Compra ===================
// ─────────────────────────────────────────────────────────────
// ANCLA: función principal de compra
export async function registrarCompraFinal() {
  const clienteId = document.getElementById('detalle-compra-cliente').getAttribute('data-cliente-id');
  const monto = parseFloat(document.getElementById('monto-compra').value);
  const fechaCompra = document.getElementById('fecha-compra').value;
  const pagoEnEfectivo = document.getElementById('pago-efectivo-check').checked;
  const bonoManualId = document.getElementById('bono-compra-aplicar').value;

  if (!clienteId || isNaN(monto) || monto <= 0 || !fechaCompra) {
    return UI.showToast("Datos inválidos. Revise monto y fecha.", "error");
  }

  await cargarCFG();

  const clienteRef = db.collection('clientes').doc(clienteId);

  try {
    const clienteDoc = await clienteRef.get();
    if (!clienteDoc.exists) { return UI.showToast("Error: no se encontró cliente.", "error"); }
    const cliente = clienteDoc.data();

    // Campañas activas
    const campañasActivas = appData.campanas.filter(c =>
      c.estaActiva &&
      (c.tipo === 'multiplicador_compra' || c.tipo === 'bono_fijo_compra') &&
      fechaCompra >= c.fechaInicio && fechaCompra <= c.fechaFin
    );

    let multiplicadorCampana = 1;
    let bonoFijoCampanas = 0;
    const etiquetas = [];

    const campMul = campañasActivas.filter(c => c.tipo === 'multiplicador_compra');
    if (campMul.length > 0) {
      multiplicadorCampana = Math.max(...campMul.map(c => Number(c.valor || 1)));
      const mejor = campMul.find(c => Number(c.valor || 1) === multiplicadorCampana);
      if (mejor) etiquetas.push(`${mejor.nombre} (x${multiplicadorCampana})`);
    }

    const campAdd = campañasActivas.filter(c => c.tipo === 'bono_fijo_compra');
    if (campAdd.length > 0) {
      bonoFijoCampanas = campAdd.reduce((sum, c) => sum + Number(c.valor || 0), 0);
      campAdd.forEach(c => etiquetas.push(`${c.nombre} (+${c.valor})`));
    }

    // Bono manual de compra (multiplicador)
    let multiplicadorBono = 1;
    if (bonoManualId) {
      const bonoManual = appData.bonos.find(b => b.id === bonoManualId && b.tipo === 'compra');
      if (bonoManual) {
        const val = Number(bonoManual.valor || 1);
        multiplicadorBono = isFinite(val) && val > 0 ? val : 1;
        etiquetas.push(`${bonoManual.nombre} (x${multiplicadorBono})`);
      }
    }

    // Base puntos por conversión (monto afectado por multiplicadores)
    const montoEfectivo = monto * multiplicadorCampana * multiplicadorBono;
    const potencial = (cliente.saldoAcumulado || 0) + montoEfectivo;
    const tasa = Math.max(1, Number(CFG.tasaConversion || 100));
    const puntosPorConversion = Math.floor(potencial / tasa);
    const resto = potencial % tasa;

    // Sumar bonos fijos de campañas
    let puntosGanados = puntosPorConversion + bonoFijoCampanas;

    // === Pago en efectivo (según scope)
    let extraEfectivo = 0;
    if (pagoEnEfectivo && CFG.pago_efectivo_activo) {
      if (CFG.pago_efectivo_modo === 'add') {
        extraEfectivo = Math.floor(Number(CFG.pago_efectivo_valor || 0));
        if (extraEfectivo > 0) etiquetas.push(`Pago en efectivo (+${extraEfectivo} pts)`);
      } else if (CFG.pago_efectivo_modo === 'mul') {
        const factor = Number(CFG.pago_efectivo_valor || 1);
        if (factor > 0) {
          const baseMult = CFG.pago_efectivo_scope === 'base' ? puntosPorConversion : puntosGanados;
          extraEfectivo = Math.max(0, Math.floor(baseMult * factor) - baseMult);
          etiquetas.push(`Pago en efectivo (x${factor})`);
        }
      }
    }
    puntosGanados += extraEfectivo;

    const puntosClientePrev = Number(cliente.puntos || 0);
    const puntosTotalesCliente = puntosClientePrev + puntosGanados;

    // Persistencia principal (saldo + historial + puntos)
    const updateData = {
      totalGastado: firebase.firestore.FieldValue.increment(monto),
      ultimaCompra: fechaCompra,
      saldoAcumulado: resto
    };

    // Armar historial local para computar vencimientos sin re-leer
    let historialLocal = Array.isArray(cliente.historialPuntos) ? [...cliente.historialPuntos] : [];

    if (puntosGanados > 0) {
      const dias = obtenerDiasCaducidadParaPuntos(puntosGanados);
      const nuevaEntradaHistorial = {
        fechaObtencion: new Date().toISOString(),
        puntosObtenidos: puntosGanados,
        puntosDisponibles: puntosGanados,
        origen: `Compra de $${monto.toFixed(2)}${etiquetas.length ? ' ('+etiquetas.join(', ')+')' : ''}`,
        diasCaducidad: dias
      };
      updateData.puntos = firebase.firestore.FieldValue.increment(puntosGanados);
      updateData.historialPuntos = firebase.firestore.FieldValue.arrayUnion(nuevaEntradaHistorial);

      // reflejamos localmente para calcular próximos vencimientos
      historialLocal.push(nuevaEntradaHistorial);
    }

    await clienteRef.update(updateData);

    // RAMPET FIX: calcular y persistir próximos vencimientos (campos directos)
    const { puntosProximosAVencer, fechaProximoVencimiento } =
      computeProximoVencimientoDesdeHistorial(historialLocal);

    await clienteRef.update({
      puntosProximosAVencer,
      fechaProximoVencimiento: fechaProximoVencimiento || null
    });

    UI.showToast(`Compra registrada. Puntos ganados: ${puntosGanados}.`, "success");

    // Notificación (si hay puntos)
    if (puntosGanados > 0) {
      const dias = obtenerDiasCaducidadParaPuntos(puntosGanados);
      const vence = sumarDias(new Date(), dias);
      // Ya calculaste y persististe esto arriba:
const { puntosProximosAVencer, fechaProximoVencimiento } =
  computeProximoVencimientoDesdeHistorial(historialLocal);

const templateData = {
  nombre: cliente.nombre || '',
  // mantenemos este campo por si la plantilla quiere anunciar lo ganado hoy
  puntos_ganados: puntosGanados,

  // saldo total post-compra
  puntos_totales: puntosTotalesCliente,

  // vencimiento correcto: sobre el saldo total → próximo bloque a vencer
  puntos_vencen: Number(puntosProximosAVencer || 0),
  vencimiento_text: fechaProximoVencimiento ? fechaArg(fechaProximoVencimiento) : '',

  // opcionales de contexto
  nombre_bono: etiquetas.join(' + '),
  detalle_extra: etiquetas.length ? `(${etiquetas.join(' + ')})` : ''
};

      await enviarNotificacionTransaccional(
        { ...cliente, id: clienteId },
        'puntos_ganados',
        templateData
      );
    }

    // Reset UI
    document.getElementById('monto-compra').value = '';
    document.getElementById('cliente-compra-buscar').value = '';
    document.getElementById('pago-efectivo-check').checked = false;
    document.getElementById('detalle-compra-cliente').style.display = 'none';

  } catch (error) {
    console.error("Error registrando compra:", error);
    UI.showToast("Error al procesar la compra.", "error");
  }
}

// ─────────────────────────────────────────────────────────────
// FIN DEL MÓDULO
// ─────────────────────────────────────────────────────────────
