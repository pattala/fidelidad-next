// ====================================================================
// MÓDULO: CAMPANAS (CORS friendly + sin secretos hardcodeados)
// ====================================================================

import { db, firebase } from './firebase.js';
import { appData } from './data.js';
import * as UI from './ui.js';

let campanaEnEdicionId = null;
let isCampanasInitialized = false;

// === Helpers para config del server de notificaciones ===
function getNotifConfig() {
  const base = window.ADMIN_CONFIG?.apiUrl || '';
  const key = window.ADMIN_CONFIG?.apiKey || '';
  return { base, key };
}
const isEditMode = () => !!campanaEnEdicionId;

// Pequeña utilidad para normalizar URLs (evita guardar basura)
function sanitizeUrl(u) {
  try {
    if (!u) return '';
    const x = new URL(u);
    return x.href;
  } catch {
    return '';
  }
}

// ====================================================================
// LÓGICA DE NEGOCIO Y COMUNICACIÓN CON APIS
// ====================================================================

async function manejarGuardadoCampana() {
  const datosFormulario = leerDatosDelFormulario();
  if (!datosFormulario.esValido) {
    return UI.showToast(datosFormulario.mensajeError, 'error');
  }

  const { campanaData, notificar, opcionesNotificacion } = datosFormulario;
  UI.deshabilitarBotonesFormulario(true);

  try {
    let campanaId;
    if (campanaEnEdicionId) {
      const ref = db.collection('campanas').doc(campanaEnEdicionId);
      await ref.update(campanaData);
      campanaId = campanaEnEdicionId;

      const reenvioBox = document.getElementById('reenvio-container');
      const reenvioVisible = reenvioBox && reenvioBox.style.display !== 'none';
      const debeReenviar = !!opcionesNotificacion.reenviar || !reenvioVisible;

      if (notificar && debeReenviar) {
        const ok = confirm('¿Reenviar notificaciones para esta campaña?');
        if (ok) {
          try {
            await programarNotificaciones(campanaId, campanaData, opcionesNotificacion, true);
            await ref.update({ notificacionEnviada: true });
            UI.showToast('Campaña actualizada y notificaciones reprogramadas.', 'success');
          } catch (e) {
            console.warn('No se pudo programar el reenvío:', e);
            UI.showToast('Campaña actualizada, pero NO se pudo reprogramar el envío (CORS/Red/Auth).', 'warning');
          }
        } else {
          UI.showToast('Campaña actualizada (sin reenvío).', 'info');
        }
      } else {
        UI.showToast('Campaña actualizada.', 'success');
      }
    } else {
      const nueva = await db.collection('campanas').add({
        ...campanaData,
        fechaCreacion: firebase.firestore.FieldValue.serverTimestamp(),
        notificacionEnviada: false
      });
      campanaId = nueva.id;

      if (notificar) {
        try {
          await programarNotificaciones(campanaId, campanaData, opcionesNotificacion, false);
          await db.collection('campanas').doc(campanaId).update({ notificacionEnviada: true });
          UI.showToast('Campaña creada y notificaciones programadas.', 'success');
        } catch (e) {
          console.warn('Programación falló:', e);
          UI.showToast('Campaña creada, pero NO se pudo programar el envío (CORS/Red/Auth).', 'warning');
        }
      } else {
        UI.showToast('Campaña creada.', 'success');
      }
    }

    limpiarYResetearFormulario();
  } catch (error) {
    console.error('Error guardando campaña:', error);
    UI.showToast(`Error al guardar: ${error.message}`, 'error');
  } finally {
    UI.deshabilitarBotonesFormulario(false);
  }
}

/**
 * Programa notificaciones de lanzamiento y recordatorios.
 */
async function programarNotificaciones(campaignId, campanaData, opciones, esReenvio) {
  const { base: NOTIF_BASE, key: API_KEY } = getNotifConfig();
  const API_URL = `${NOTIF_BASE}/api/programar-lanzamiento`;

  const fechaAnuncioISO = opciones.anuncioInmediato
    ? new Date().toISOString()
    : new Date(opciones.fechaAnuncio).toISOString();

  // Lanzamiento
  const bodyLanzamiento = {
    campaignId,
    tipoNotificacion: 'lanzamiento',
    templateId: 'campaña_nueva_push',   // el server lo respeta
    templateData: {
      titulo: campanaData.nombre,
      descripcion: campanaData.cuerpo,
      vence_text: campanaData.fechaFin,
      url: campanaData.url || '',
      bannerUrl: campanaData.bannerUrl || '',
      imageUrl: campanaData.bannerUrl || ''
    },
    fechaNotificacion: fechaAnuncioISO,
  };
  if (opciones.destinatarios === 'prueba') {
    bodyLanzamiento.destinatarios = opciones.listaDestinatarios;
  }
  await doCorsPost(API_URL, bodyLanzamiento, API_KEY);

  // Recordatorios
  if (!esReenvio && (campanaData.frecuenciaRecordatorio || 0) > 0) {
    const fechas = calcularFechasRecordatorios(
      campanaData.fechaInicio,
      campanaData.fechaFin,
      campanaData.frecuenciaRecordatorio,
      campanaData.horasRecordatorio
    );

    for (const f of fechas) {
      const bodyRec = {
        campaignId,
        tipoNotificacion: 'recordatorio',
        templateId: 'recordatorio_campana',
        templateData: {
          titulo: campanaData.nombre,
          descripcion: campanaData.cuerpo,
          vence_text: campanaData.fechaFin,
          url: campanaData.url || '',
          bannerUrl: campanaData.bannerUrl || '',
          imageUrl: campanaData.bannerUrl || ''
        },
        fechaNotificacion: f.toISOString()
      };
      if (opciones.destinatarios === 'prueba') {
        bodyRec.destinatarios = opciones.listaDestinatarios;
      }
      try { await doCorsPost(API_URL, bodyRec, API_KEY); }
      catch (e) { console.warn('Fallo programando un recordatorio:', e); }
    }
  }
}

/** POST CORS con diagnóstico; lanza Error si !ok */
async function doCorsPost(url, payload, apiKey) {
  const headers = { 'Content-Type': 'application/json' };
  if (apiKey) {
    headers['x-api-key'] = apiKey;
    headers['Authorization'] = `Bearer ${apiKey}`;
  }

  let resp;
  try {
    resp = await fetch(url, {
      method: 'POST',
      mode: 'cors',
      headers,
      body: JSON.stringify(payload)
    });
  } catch (err) {
    throw new Error(`Fallo de red/CORS (preflight): ${err.message}`);
  }
  if (!resp.ok) {
    const txt = await resp.text().catch(() => '');
    throw new Error(`HTTP ${resp.status} ${txt}`);
  }
}

// ====================================================================
// INICIALIZACIÓN (debe existir porque app.js la llama)
// ====================================================================
export function initCampanas() {
  if (isCampanasInitialized) return;

  // Botones principales
  document.getElementById('crear-campana-btn')?.addEventListener('click', manejarGuardadoCampana);
  document.getElementById('guardar-campana-editada-btn')?.addEventListener('click', manejarGuardadoCampana);
  document.getElementById('cancelar-edicion-campana-btn')?.addEventListener('click', limpiarYResetearFormulario);
  document.getElementById('form-campana-titulo')?.addEventListener('click', limpiarYResetearFormulario);

  // Campos que cambian visibilidad de secciones
  [
    'campana-tipo',
    'programar-publicacion',
    'publicar-inmediatamente',
    'campana-enviar-notificacion-check',
    'programar-anuncio',
    'enviar-anuncio-inmediatamente'
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('change', manejarVisibilidadCamposUX);
  });

  const frecuenciaInput = document.getElementById('campana-frecuencia-recordatorio');
  if (frecuenciaInput) frecuenciaInput.addEventListener('input', manejarVisibilidadCamposUX);

  // Destinatarios (todos / prueba)
  document.querySelectorAll('input[name="destinatarios"]').forEach((radio) => {
    radio.addEventListener('change', manejarVisibilidadCamposUX);
  });

  // Clicks en filas/botones de la tabla (editar / eliminar)
  const tbody = document.getElementById('tabla-campanas-body');
  if (tbody) {
    tbody.addEventListener('click', (e) => {
      const fila = e.target.closest('tr');
      if (!fila || !fila.dataset.id) return;
      const id = fila.dataset.id;
      const boton = e.target.closest('button');
      if (boton) {
        if (boton.classList.contains('editar-campana-btn')) prepararFormularioParaEdicion(id);
        if (boton.classList.contains('eliminar-campana-btn')) eliminarCampana(id);
        return;
      }
      // Seleccionar/Ver
      if (fila.classList.contains('fila-seleccionada')) {
        limpiarYResetearFormulario();
      } else {
        const campana = appData.campanas.find((c) => c.id === id);
        if (!campana) return;
        limpiarYResetearFormulario();
        poblarFormulario(campana);
        document.getElementById('form-campana-titulo').textContent = `Viendo: ${campana.nombre}`;
        document.getElementById('crear-campana-btn').style.display = 'none';
        const botonesEdicion = document.getElementById('botones-edicion-campana');
        botonesEdicion.style.display = 'flex';
        const btnGuardar = document.getElementById('guardar-campana-editada-btn');
        btnGuardar.style.display = 'none';
        const btnCancelar = document.getElementById('cancelar-edicion-campana-btn');
        btnCancelar.textContent = 'Cerrar Vista';

        if (!botonesEdicion.querySelector('.temp-edit-btn')) {
          const btnEditar = document.createElement('button');
          btnEditar.textContent = 'Editar Campaña';
          btnEditar.className = 'secondary-btn temp-edit-btn';
          btnEditar.type = 'button';
          btnEditar.onclick = () => {
            UI.habilitarFormularioCampana(true);
            btnGuardar.style.display = 'inline-block';
            btnCancelar.textContent = 'Cancelar Edición';
            btnEditar.remove();
            manejarVisibilidadCamposUX();
          };
          btnCancelar.parentNode.insertBefore(btnEditar, btnCancelar);
        }

        UI.habilitarFormularioCampana(false);
        manejarVisibilidadCamposUX();
        UI.seleccionarFilaTabla('tabla-campanas-body', id);
        window.scrollTo(0, 0);
      }
    });
  }

  manejarVisibilidadCamposUX();
  isCampanasInitialized = true;
}

// ===================== UTILIDADES DE FORM =====================

function leerDatosDelFormulario() {
  const nombre = document.getElementById('campana-nombre')?.value.trim() || '';
  const tipo = document.getElementById('campana-tipo')?.value || 'informativa';
  const valorRaw = document.getElementById('campana-valor')?.value;
  const valor = valorRaw !== '' && valorRaw != null ? Number(valorRaw) : null;
  const bannerUrl = sanitizeUrl(document.getElementById('campana-banner-url')?.value.trim() || '');
  const destinoUrl = sanitizeUrl(document.getElementById('campana-destino-url')?.value.trim() || '');
  const cuerpo = document.getElementById('campana-cuerpo')?.value.trim() || '';
  const visibilidad = document.getElementById('campana-visibilidad')?.value || 'publica';
  const estaActiva = !!document.getElementById('campana-habilitada')?.checked;

  const programada = !!document.getElementById('programar-publicacion')?.checked;

  let fechaInicio = '';
  let fechaFin = '';
  if (programada) {
    fechaInicio = document.getElementById('campana-fecha-inicio')?.value || '';
    fechaFin = document.getElementById('campana-fecha-fin')?.value || '';
    if (!fechaInicio) return { esValido: false, mensajeError: 'Definí la fecha de inicio.' };
    if (fechaFin && fechaFin < fechaInicio) {
      return { esValido: false, mensajeError: 'La fecha fin no puede ser anterior a la de inicio.' };
    }
    if (!fechaFin) fechaFin = '2100-01-01';
  } else {
    fechaInicio = new Date().toISOString().split('T')[0];
    fechaFin = '2100-01-01';
  }

  const notificar = !!document.getElementById('campana-enviar-notificacion-check')?.checked;
  const anuncioInmediato = !!document.getElementById('enviar-anuncio-inmediatamente')?.checked;
  const anuncioProgramado = !!document.getElementById('programar-anuncio')?.checked;

  let fechaAnuncio = '';
  if (notificar) {
    if (anuncioInmediato) {
      fechaAnuncio = new Date().toISOString().slice(0, 16); // yyyy-mm-ddTHH:MM
    } else if (anuncioProgramado) {
      fechaAnuncio = (document.getElementById('campana-fecha-anuncio')?.value || '').trim();
      if (!fechaAnuncio) {
        return { esValido: false, mensajeError: 'Ingresá fecha/hora del anuncio.' };
      }
    }
  }

  const frecuenciaRecordatorio = Number(document.getElementById('campana-frecuencia-recordatorio')?.value || 0);
  const horasRecordatorioStr = (document.getElementById('campana-horas-recordatorio')?.value || '').trim();
  const horasRecordatorio = horasRecordatorioStr
    ? horasRecordatorioStr.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  const destPrueba = !!document.getElementById('destinatarios-prueba')?.checked;
  const listaDest = (document.getElementById('destinatarios-prueba-lista')?.value || '')
    .split(',').map(s => s.trim()).filter(Boolean);

  if (!nombre) return { esValido: false, mensajeError: 'El nombre de la campaña es obligatorio.' };
  if (tipo !== 'informativa') {
    if (valor == null || Number.isNaN(valor)) {
      return { esValido: false, mensajeError: 'Ingresá el valor numérico de la promoción.' };
    }
  }

  const campanaData = {
    nombre,
    tipo,           // informativa | multiplicador_compra | bono_fijo_compra
    valor: tipo === 'informativa' ? null : valor,
    bannerUrl,
    url: destinoUrl,
    cuerpo,
    visibilidad,    // publica | prueba
    estaActiva,
    fechaInicio,    // 'YYYY-MM-DD'
    fechaFin,       // 'YYYY-MM-DD'
    frecuenciaRecordatorio: Math.max(0, frecuenciaRecordatorio),
    horasRecordatorio, // ['09:30','18:45'] etc
  };

  const opcionesNotificacion = {
    anuncioInmediato,
    fechaAnuncio,
    destinatarios: destPrueba ? 'prueba' : 'todos',
    listaDestinatarios: listaDest,
    reenviar: !!document.getElementById('campana-reenviar-notificacion-check')?.checked
  };

  return { esValido: true, mensajeError: '', campanaData, notificar, opcionesNotificacion };
}

// Resetea el formulario a valores por defecto (sin tocar la tabla)
function limpiarYResetearFormulario() {
  campanaEnEdicionId = null;

  const elTipo = document.getElementById('campana-tipo');
  if (document.getElementById('campana-nombre')) document.getElementById('campana-nombre').value = '';
  if (elTipo) elTipo.value = 'informativa';
  if (document.getElementById('campana-valor')) document.getElementById('campana-valor').value = '';
  if (document.getElementById('campana-banner-url')) document.getElementById('campana-banner-url').value = '';
  if (document.getElementById('campana-destino-url')) document.getElementById('campana-destino-url').value = '';
  if (document.getElementById('campana-cuerpo')) document.getElementById('campana-cuerpo').value = '';

  const elPubInm = document.getElementById('publicar-inmediatamente');
  const elProg = document.getElementById('programar-publicacion');
  if (elPubInm) elPubInm.checked = true;
  if (elProg) elProg.checked = false;
  if (document.getElementById('campana-fecha-inicio')) document.getElementById('campana-fecha-inicio').value = '';
  if (document.getElementById('campana-fecha-fin')) document.getElementById('campana-fecha-fin').value = '';
  if (document.getElementById('campana-habilitada')) document.getElementById('campana-habilitada').checked = true;
  if (document.getElementById('campana-visibilidad')) document.getElementById('campana-visibilidad').value = 'publica';

  if (document.getElementById('campana-enviar-notificacion-check')) document.getElementById('campana-enviar-notificacion-check').checked = false;
  if (document.getElementById('enviar-anuncio-inmediatamente')) document.getElementById('enviar-anuncio-inmediatamente').checked = true;
  if (document.getElementById('programar-anuncio')) document.getElementById('programar-anuncio').checked = false;
  if (document.getElementById('campana-fecha-anuncio')) document.getElementById('campana-fecha-anuncio').value = '';
  if (document.getElementById('campana-frecuencia-recordatorio')) document.getElementById('campana-frecuencia-recordatorio').value = '0';
  if (document.getElementById('campana-horas-recordatorio')) document.getElementById('campana-horas-recordatorio').value = '';
  if (document.getElementById('destinatarios-todos')) document.getElementById('destinatarios-todos').checked = true;
  if (document.getElementById('destinatarios-prueba')) document.getElementById('destinatarios-prueba').checked = false;
  if (document.getElementById('destinatarios-prueba-lista')) document.getElementById('destinatarios-prueba-lista').value = '';
  if (document.getElementById('campana-reenviar-notificacion-check')) document.getElementById('campana-reenviar-notificacion-check').checked = false;

  const titulo = document.getElementById('form-campana-titulo');
  if (titulo) titulo.textContent = 'Crear / Editar Campaña';
  const btnCrear = document.getElementById('crear-campana-btn');
  const botonesBox = document.getElementById('botones-edicion-campana');
  const btnGuardar = document.getElementById('guardar-campana-editada-btn');
  const btnCancel = document.getElementById('cancelar-edicion-campana-btn');
  if (btnCrear) btnCrear.style.display = 'inline-block';
  if (botonesBox) botonesBox.style.display = 'none';
  if (btnGuardar) btnGuardar.style.display = 'none';
  if (btnCancel) btnCancel.textContent = 'Cancelar Edición';
  document.querySelectorAll('.temp-edit-btn').forEach(b => b.remove());

  manejarVisibilidadCamposUX();
  try { UI.habilitarFormularioCampana(true); } catch { }
}

function manejarVisibilidadCamposUX() {
  const tipo = document.getElementById('campana-tipo')?.value || 'informativa';
  const valorBox = document.getElementById('campana-valor-container');
  if (valorBox) valorBox.style.display = (tipo === 'informativa') ? 'none' : 'block';

  const programada = !!document.getElementById('programar-publicacion')?.checked;
  const fechasBox = document.getElementById('programacion-fechas-container');
  if (fechasBox) fechasBox.style.display = programada ? 'grid' : 'none';

  const notifOn = !!document.getElementById('campana-enviar-notificacion-check')?.checked;
  const notifBox = document.getElementById('notification-settings-container');
  if (notifBox) notifBox.style.display = notifOn ? 'block' : 'none';

  const anuncioProg = !!document.getElementById('programar-anuncio')?.checked;
  const anuncioBox = document.getElementById('anuncio-fecha-container');
  if (anuncioBox) anuncioBox.style.display = (notifOn && anuncioProg) ? 'block' : 'none';

  const freq = Number(document.getElementById('campana-frecuencia-recordatorio')?.value || 0);
  const horasBox = document.getElementById('campana-horas-recordatorio-container');
  if (horasBox) horasBox.style.display = notifOn && freq > 0 ? 'block' : 'none';

  const destPrueba = !!document.getElementById('destinatarios-prueba')?.checked;
  const destBox = document.getElementById('destinatarios-prueba-container');
  if (destBox) destBox.style.display = notifOn && destPrueba ? 'block' : 'none';

  const reenvioBox = document.getElementById('reenvio-container');
  if (reenvioBox) {
    reenvioBox.style.display = (notifOn && isEditMode()) ? 'block' : 'none';
  }

  const estado = document.getElementById('campana-notificacion-estado');
  if (estado) {
    if (!notifOn) estado.textContent = '';
    else if (anuncioProg) estado.textContent = 'Se enviará en la fecha/hora programada.';
    else estado.textContent = 'Se enviará inmediatamente.';
  }
}

function prepararFormularioParaEdicion(id) {
  const campana = appData.campanas?.find(c => c.id === id);
  if (!campana) return;

  campanaEnEdicionId = id;
  poblarFormulario(campana);

  const titulo = document.getElementById('form-campana-titulo');
  if (titulo) titulo.textContent = `Editando: ${campana.nombre}`;

  const btnCrear = document.getElementById('crear-campana-btn');
  const botonesBox = document.getElementById('botones-edicion-campana');
  const btnGuardar = document.getElementById('guardar-campana-editada-btn');
  const btnCancel = document.getElementById('cancelar-edicion-campana-btn');

  if (btnCrear) btnCrear.style.display = 'none';
  if (botonesBox) botonesBox.style.display = 'flex';
  if (btnGuardar) btnGuardar.style.display = 'inline-block';
  if (btnCancel) btnCancel.textContent = 'Cancelar Edición';

  try { UI.habilitarFormularioCampana(true); } catch { }
  manejarVisibilidadCamposUX();
  window.scrollTo(0, 0);
}

function poblarFormulario(c) {
  const setVal = (id, v) => { const el = document.getElementById(id); if (el) el.value = v ?? ''; };
  const setChk = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };

  setVal('campana-nombre', c.nombre || '');
  setVal('campana-tipo', c.tipo || 'informativa');
  setVal('campana-valor', (c.tipo === 'informativa' ? '' : (c.valor ?? '')));
  setVal('campana-banner-url', c.bannerUrl || '');
  setVal('campana-destino-url', c.url || '');
  setVal('campana-cuerpo', c.cuerpo || '');
  setVal('campana-visibilidad', c.visibilidad || 'publica');
  setChk('campana-habilitada', c.estaActiva !== false);

  const tieneVentana = !!(c.fechaInicio && c.fechaFin && c.fechaFin !== '2100-01-01');
  setChk('programar-publicacion', tieneVentana);
  setChk('publicar-inmediatamente', !tieneVentana);
  setVal('campana-fecha-inicio', c.fechaInicio || '');
  setVal('campana-fecha-fin', c.fechaFin || '');

  const freq = Number(c.frecuenciaRecordatorio || 0);
  setVal('campana-frecuencia-recordatorio', String(freq));
  const horasStr = Array.isArray(c.horasRecordatorio) ? c.horasRecordatorio.join(',') : '';
  setVal('campana-horas-recordatorio', horasStr);

  setChk('campana-enviar-notificacion-check', false);
  setChk('enviar-anuncio-inmediatamente', true);
  setChk('programar-anuncio', false);
  setVal('campana-fecha-anuncio', '');

  setChk('destinatarios-todos', true);
  setChk('destinatarios-prueba', false);
  setVal('destinatarios-prueba-lista', '');

  manejarVisibilidadCamposUX();
}

async function eliminarCampana(id) {
  if (!confirm('¿Eliminar esta campaña?')) return;
  try {
    await db.collection('campanas').doc(id).delete();
    UI.showToast('Campaña eliminada.', 'success');
  } catch (e) {
    console.error('Error eliminando campaña:', e);
    UI.showToast('No se pudo eliminar la campaña.', 'error');
  }
}

// ====================================================================
// Helpers para recordatorios
// ====================================================================
function calcularFechasRecordatorios(fechaInicio, fechaFin, cadaDias, horas) {
  const out = [];
  try {
    if (!cadaDias || cadaDias <= 0) return out;
    const start = new Date(`${fechaInicio}T00:00:00`);
    const end = new Date(`${fechaFin}T23:59:59`);
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + cadaDias)) {
      if (Array.isArray(horas) && horas.length) {
        for (const h of horas) {
          const [HH, MM] = String(h).split(':').map(n => parseInt(n, 10));
          const when = new Date(d);
          when.setHours(HH || 0, MM || 0, 0, 0);
          if (when >= start && when <= end) out.push(new Date(when));
        }
      } else {
        out.push(new Date(d));
      }
    }
  } catch { }
  return out;
}
