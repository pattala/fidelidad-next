// --------------------------------------------------------------------
// MÓDULO: NOTIFICACIONES (VERSIÓN FINAL - sin secretos en el front)
// --------------------------------------------------------------------
// - Envía email y push por plantilla (legacy /programar-lanzamiento).
// - Envío manual (título + mensaje) a UNO o a TODOS via /api/send-notification.
// --------------------------------------------------------------------

import { appData } from './data.js';
import * as UI from './ui.js';

// ========== CONSTANTES Y ESTADO ==========
const API_BASE_URL = (window.__RAMPET__?.NOTIF_BASE || '').replace(/\/+$/, '') + '/api';
const API_KEY = window.__RAMPET__?.API_KEY || '';
let clienteSeleccionadoParaNotificacion = null;

// ========== LÓGICA: TRANSACCIONALES (plantillas) ==========
// Se mantiene legacy por ahora. Luego migraremos a /send-notification con contrato unificado.
/**
 * Envía notificaciones transaccionales (email y push) a un cliente.
 * @param {object} cliente  Objeto del cliente (debe tener .id)
 * @param {string} templateId  ID de plantilla en Firestore (p.ej. 'puntos_ganados')
 * @param {object} templateData  Datos para rellenar la plantilla
 */
export async function enviarNotificacionTransaccional(cliente, templateId, templateData = {}) {
  UI.showToast(`Intentando enviar comunicación '${templateId}' a ${cliente?.nombre || '-' }...`, "info");
  if (!cliente || !cliente.id) {
    console.error("enviarNotificacionTransaccional: cliente inválido o sin ID.");
    return;
  }

  const datosBase = {
    nombre: (cliente.nombre || '').split(' ')[0],
    numero_socio: cliente.numeroSocio,
    puntos_transaccion: 0,
    puntos_ganados: 0,
    puntos_totales: cliente.puntos,
    id_cliente: cliente.id
  };
  const datosCompletos = { ...datosBase, ...templateData };

  // 1) EMAIL por plantilla
  if (cliente.email) {
    try {
      fetch(`${API_BASE_URL}/send-email`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ to: cliente.email, templateId, templateData: datosCompletos }),
      }).catch(err => console.error("fetch send-email:", err));
    } catch (error) {
      console.error("Error en fetch para email transaccional:", error);
    }
  }


  // 2) PUSH por plantilla (nuevo endpoint unificado)
try {
  const idToken = await (window.__FIREBASE__?.auth?.currentUser?.getIdToken?.() || null);
  const r = await fetch(`${API_BASE_URL}/send-push`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-secret': (window.__RAMPET__?.API_KEY || ''),
      ...(idToken ? { 'Authorization': `Bearer ${idToken}` } : {})
    },
    body: JSON.stringify({
      templateId,
      segment: { type: 'one', uid: cliente.id },
      options: { dryRun: false, saveInbox: true, batchSize: 200, maxPerSecond: 200 },
      defaults: { pwa_url: window.location.origin, link_terminos: window.__RAMPET__?.URL_TYC || '' },
      overrideVars: {}
    })
  });
  const js = await r.json().catch(() => ({}));
  if (!r.ok) {
    console.warn('Push no enviado', js);
    UI.showToast(`Push no enviado: ${js?.error || js?.message || r.status}`, 'warning');
  } else {
    console.log('Push OK', js);
  }
} catch (error) {
  console.error('Error en fetch para push transaccional:', error);
}

}

// ========== LÓGICA: ENVÍO MANUAL (título + mensaje) ==========
/**
 * Envía una notificación manual desde el panel (título + mensaje).
 * Si querés que también use plantilla acá, podemos agregar un selector y mandar templateId.
 */
/**
 * Envía una notificación manual desde el panel (título + mensaje).
 * Si querés que también use plantilla acá, podemos agregar un selector y mandar templateId.
 */
async function enviarNotificacionPersonalizada() {
  const titulo  = document.getElementById('notificacion-titulo').value.trim();
  const mensaje = document.getElementById('notificacion-mensaje').value.trim();
  if (!titulo || !mensaje) {
    return UI.showToast("El título y el mensaje no pueden estar vacíos.", "error");
  }

  const esParaTodos = document.getElementById('enviar-a-todos').checked;

  // Recolección/validación de destinatarios según modo
  let validTokens = [];
  let clienteId = null;

  if (esParaTodos) {
    // fanout a todos: juntar todos los tokens válidos
    validTokens = appData.clientes.flatMap(c => c.fcmTokens || []).filter(Boolean);
    if (!validTokens.length) {
      return UI.showToast("No hay suscriptores con tokens válidos para 'todos'.", "warning");
    }
  } else {
    // un cliente: debe haber cliente seleccionado y al menos un token
    if (!clienteSeleccionadoParaNotificacion?.id) {
      return UI.showToast("Seleccioná un cliente antes de enviar.", "warning");
    }
    clienteId = clienteSeleccionadoParaNotificacion.id;
    validTokens = (clienteSeleccionadoParaNotificacion.fcmTokens || []).filter(Boolean);
    if (!validTokens.length) {
      return UI.showToast("El cliente seleccionado no tiene tokens válidos. Pedile que abra la app y habilite notificaciones.", "warning");
    }
  }

  const botonEnviar = document.getElementById('enviar-notificacion-btn');
  botonEnviar.disabled = true;
  botonEnviar.textContent = 'Enviando...';

  try {
    // Armar payload acorde al modo
    const payload = esParaTodos
      ? {
          audience: 'tokens',
          tokens:  validTokens,
          title:   titulo,
          body:    mensaje,
          url:     '/notificaciones',
          tag:     'manual-' + Date.now()
        }
      : {
          audience:  'one',
          clienteId: clienteId,
          tokens:    validTokens, // ← requerido por el server
          title:     titulo,
          body:      mensaje,
          url:       '/notificaciones',
          tag:       'manual-' + Date.now()
        };

    // DEBUG opcional
    console.log('[DEBUG] payload a send-notification →', payload);

    // POST al server
    const respuesta = await fetch(`${API_BASE_URL}/send-notification`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(API_KEY ? { 'x-api-key': API_KEY } : {})
      },
      body: JSON.stringify(payload),
    });

    if (!respuesta.ok) {
      const txt = await respuesta.text().catch(() => '');
      console.warn('[DEBUG] respuesta no OK:', respuesta.status, txt);
    }

    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) {
      throw new Error(resultado?.message || `Error ${respuesta.status}`);
    }

    UI.showToast(
      `Notificación enviada con éxito${typeof resultado.successCount === 'number' ? ` a ${resultado.successCount} dispositivos` : ''}.`,
      "success"
    );

    // Reset inputs
    document.getElementById('notificacion-titulo').value = '';
    document.getElementById('notificacion-mensaje').value = '';
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    UI.showToast(`Error al enviar la notificación: ${error.message}`, "error");
  } finally {
    botonEnviar.disabled = false;
    botonEnviar.textContent = '🚀 Enviar Notificación Push';
  }
}





// ========== HANDLERS ==========
export function buscarClienteParaNotificacionHandler() {
  const identificador = document.getElementById('notificacion-buscar-cliente').value.trim();
  if (!identificador) return;

  const cliente = appData.clientes.find(c =>
    (c.numeroSocio && String(c.numeroSocio) === identificador) ||
    (c.dni === identificador) ||
    (c.email && c.email.toLowerCase() === identificador.toLowerCase())
  );

  const infoCliente = document.getElementById('cliente-encontrado-notificacion');
  if (cliente) {
    if (cliente.fcmTokens?.length) {
      clienteSeleccionadoParaNotificacion = cliente;
      infoCliente.textContent = `Cliente encontrado: ${cliente.nombre}. (Listo para recibir notificación)`;
      infoCliente.style.color = 'var(--success-color)';
    } else {
      clienteSeleccionadoParaNotificacion = null;
      infoCliente.textContent = `Cliente encontrado: ${cliente.nombre}, pero no tiene notificaciones activadas.`;
      infoCliente.style.color = 'var(--danger-color)';
    }
  } else {
    clienteSeleccionadoParaNotificacion = null;
    infoCliente.textContent = 'Cliente no encontrado.';
    infoCliente.style.color = 'var(--danger-color)';
  }
}

export function enviarNotificacionHandler() {
  enviarNotificacionPersonalizada();
}

export function limpiarSeleccionNotificacion() {
  clienteSeleccionadoParaNotificacion = null;
}

// ========== INICIALIZACIÓN DE LA SOLAPA ==========
export function initNotificaciones() {
  // Evitar listeners duplicados si se vuelve a abrir la pestaña
  const btnEnviar = document.getElementById('enviar-notificacion-btn');
  btnEnviar?.removeEventListener('click', enviarNotificacionHandler);
  btnEnviar?.addEventListener('click', enviarNotificacionHandler);

  const radios = document.querySelectorAll('input[name="destinatario"]');
  radios.forEach(r => {
    r.removeEventListener('change', UI.manejarSeleccionDestinatario);
    r.addEventListener('change', UI.manejarSeleccionDestinatario);
  });

  const btnBuscar = document.getElementById('notificacion-btn-buscar');
  btnBuscar?.removeEventListener('click', buscarClienteParaNotificacionHandler);
  btnBuscar?.addEventListener('click', buscarClienteParaNotificacionHandler);

  // Forzar estado inicial del selector (muestra/oculta el campo de búsqueda)
  UI.manejarSeleccionDestinatario?.();
}
