// modules/whatsapp.js

import { appData } from './data.js';
import * as UI from './ui.js';

let isWhatsAppInitialized = false;

// ====================================================================
// INICIALIZACIÓN
// ====================================================================
export function initWhatsApp() {
    if (isWhatsAppInitialized) return;

    // Botón buscar cliente
    const btnBuscar = document.getElementById('whatsapp-btn-buscar');
    if (btnBuscar) {
        btnBuscar.addEventListener('click', manejarBusquedaClienteWhatsApp);
    }

    // Input búsqueda (Enter)
    const inputBuscar = document.getElementById('whatsapp-buscar-cliente');
    if (inputBuscar) {
        inputBuscar.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') manejarBusquedaClienteWhatsApp();
        });
    }

    // Opciones de plantilla predefinida (opcional, por si quieren mensajes rápidos)
    // De momento no solicitado, pero dejamos preparado

    // Botón Enviar
    const btnEnviar = document.getElementById('whatsapp-enviar-btn');
    if (btnEnviar) {
        btnEnviar.addEventListener('click', enviarMensajeWhatsApp);
    }

    isWhatsAppInitialized = true;
    console.log('[WhatsApp] Módulo inicializado');
}

// ====================================================================
// LÓGICA DE BÚSQUEDA
// ====================================================================
function manejarBusquedaClienteWhatsApp() {
    const query = document.getElementById('whatsapp-buscar-cliente')?.value.trim();
    const resultado = document.getElementById('whatsapp-cliente-encontrado');
    const zonaMensaje = document.getElementById('whatsapp-mensaje-area');

    if (!resultado || !zonaMensaje) return;

    if (!query) {
        resultado.innerHTML = '';
        zonaMensaje.style.display = 'none';
        UI.showToast('Ingresá un N° de Socio o DNI.', 'warning');
        return;
    }

    const clientes = appData.clientes || [];
    const cliente = clientes.find(c =>
        String(c.numeroSocio) === query ||
        String(c.dni) === query
    );

    if (!cliente) {
        resultado.innerHTML = '<span style="color:red;">Cliente no encontrado.</span>';
        zonaMensaje.style.display = 'none';
        return;
    }

    const telefono = cliente.telefono || '';
    if (!telefono) {
        resultado.innerHTML = `
      <strong>Cliente:</strong> ${cliente.nombre} (#${cliente.numeroSocio})<br>
      <span style="color:orange;">⚠️ Este cliente no tiene teléfono registrado.</span>
    `;
        zonaMensaje.style.display = 'none';
        return;
    }

    // Cliente encontrado y con teléfono
    resultado.innerHTML = `
    <strong>Cliente:</strong> ${cliente.nombre} (#${cliente.numeroSocio})<br>
    <strong>Teléfono:</strong> <span id="whatsapp-telefono-destino">${telefono}</span>
  `;
    zonaMensaje.style.display = 'block';
}


// ====================================================================
// ENVÍO DE MENSAJE (Protocolo whatsapp:// o wa.me)
// ====================================================================
function enviarMensajeWhatsApp() {
    const telefonoRaw = document.getElementById('whatsapp-telefono-destino')?.textContent;
    const mensaje = document.getElementById('whatsapp-mensaje-texto')?.value.trim();

    if (!telefonoRaw) {
        UI.showToast('Primero busca y selecciona un cliente válido.', 'error');
        return;
    }
    if (!mensaje) {
        UI.showToast('Escribe un mensaje para enviar.', 'warning');
        return;
    }

    // Limpieza de teléfono (Argentina por defecto si falta código)
    // Se asume que si empieza con 0, hay que quitarlo. Si no tiene 54, agregarlo.
    // Esta lógica puede variar según el país, ajustamos para el caso típico AR.
    let numero = telefonoRaw.replace(/\D/g, ''); // solo dígitos

    // Lógica simple para completar 549 si parece un local
    // Asumimos que si tiene 10 digitos (ej 11 1234 5678) es local con area sin pais
    if (numero.length === 10) {
        numero = '549' + numero;
    } else if (numero.length === 11 && numero.startsWith('15')) { // Caso viejo 15
        numero = '549' + numero.substring(2);
    } else if (numero.length === 11 && numero.startsWith('0')) { // Caso 011...
        numero = '549' + numero.substring(1);
    }
    // Si ya tiene 54 o 549 al inicio, lo dejamos (o normalizamos 54 -> 549 para celulares AR)
    else if (numero.startsWith('54') && !numero.startsWith('549') && numero.length >= 12) {
        // Es discutible, pero wa.me suele requerir el 9 para móviles AR
        numero = '549' + numero.substring(2);
    }

    console.log(`[WhatsApp] Telefono raw: ${telefonoRaw} -> Formateado: ${numero}`);

    const textoCodificado = encodeURIComponent(mensaje);

    // Preferencia usuario: "aplicación de escritorio"
    // Intentamos abrir whatsapp://send primero.
    // Nota: window.open con custom protocol no siempre es clean en todos los navegadores, 
    // pero wa.me redirige bien.
    // Si usamos wa.me, la web de whatsapp hace el handshake.
    // Si usamos whatsapp://send, intentamos protocolo directo.

    const protocolUrl = `whatsapp://send?phone=${numero}&text=${textoCodificado}`;
    const webUrl = `https://wa.me/${numero}?text=${textoCodificado}`;

    // Estrategia: Usar wa.me es más seguro porque maneja el fallback si no está instalado.
    // Pero el usuario pidió explícitamente "el que se instala en la compu".
    // Podemos intentar whatsapp:// en un iframe oculto o simplemente abrirlo.
    // Simplifiquemos con wa.me que tiene el botón "Abrir WhatsApp" que lanza la app.
    // PERO, si queremos forzar app, el protocol es directo.

    // Vamos a usar el protocol directe con un fallback visual o simplemente window.open
    // window.open(protocolUrl, '_blank') a veces es bloqueado o no hace nada si no maneja el protocolo.

    // Mejor opción UX: wa.me. Por qué? Porque wa.me DETECTA si tenés la app y te ofrece abrirla.
    // El "desktop" usuario lo asociará a que se abre la ventana.

    // Si el usuario insiste, probamos protocol. 

    try {
        // Probamos abrir el deep link
        window.open(protocolUrl, '_blank');
        UI.showToast('Intentando abrir WhatsApp Desktop...', 'success');
    } catch (e) {
        console.warn('Fallo deep link, fallback web', e);
        window.open(webUrl, '_blank');
    }
}
