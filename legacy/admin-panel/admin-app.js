// app.js (Panel de Administrador – limpio y sin ciclos)

import { auth } from './modules/firebase.js';
import {
  iniciarEscuchasFirestore,
  appData,
  marcarNuevosRegistrosComoVistos, // ← ahora viene del módulo de datos
} from './modules/data.js';

import * as Clientes from './modules/clientes.js';
import * as Transacciones from './modules/transacciones.js';
import * as Config from './modules/config.js';
import * as Notificaciones from './modules/notificaciones.js';
import * as Campanas from './modules/campanas.js';
import * as WhatsApp from './modules/whatsapp.js'; // [NEW]
import * as UI from './modules/ui.js';

// Referencias DOM
const loginScreen = document.getElementById('login-screen');
const mainAppScreen = document.getElementById('main-app-screen');
const adminPanel = document.getElementById('admin-panel');
const loginBtn = document.getElementById('login-btn');
const logoutBtn = document.getElementById('logout-btn');

// [FIX] Aislamiento de Sesión: Usar SESSION storage para el Admin.
// Esto evita que el login del Admin pise el login de la PWA (localStorage) si están en el mismo dominio.
auth.setPersistence(firebase.auth.Auth.Persistence.SESSION)
  .then(() => {
    // Configurar listener de estado
    auth.onAuthStateChanged(handleAuthStateChange);
  })
  .catch((error) => {
    console.error("Error seteando persistencia:", error);
    // Fallback por si falla (ej. settings de privacidad)
    auth.onAuthStateChanged(handleAuthStateChange);
  });

/**
 * Manejo centralizado del estado de autenticación
 */
function main() {
  loginBtn.addEventListener('click', loginAdmin);
  logoutBtn.addEventListener('click', logoutAdmin);
  document.getElementById('forgot-password-admin-link').addEventListener('click', (e) => {
    e.preventDefault();
    sendPasswordResetForAdmin();
  });
}

async function sendPasswordResetForAdmin() {
  const email = prompt("Email para restablecer la contraseña:");
  if (!email) return;
  try {
    await auth.sendPasswordResetEmail(email);
    UI.showToast(`Si existe una cuenta para ${email}, recibirás un correo para restablecer la clave.`, "success", 8000);
  } catch (error) {
    console.error("Error enviando correo de reseteo:", error);
    UI.showToast("Ocurrió un problema al enviar el correo. Inténtalo de nuevo.", "error");
  }
}

async function handleAuthStateChange(user) {
  if (user) {
    try {
      const idTokenResult = await user.getIdTokenResult(true);
      if (idTokenResult.claims.admin === true) {
        console.log("Acceso concedido. El usuario es administrador.");

        await user.getIdToken(true);

        showAdminPanel();

        // [FIX] Pequeña espera para asegurar que el Token de Auth se propague a Firestore
        setTimeout(() => {
          initializeApp();
          console.log("✅ Admin Panel inicializado. Listeners activos.");
        }, 1000);
      } else {
        console.warn("Acceso denegado. El usuario no es administrador.");
        UI.showToast("No tienes permisos para acceder a este panel.", "error");
        await auth.signOut();
      }
    } catch (error) {
      console.error("Error al verificar los permisos de administrador:", error);
      UI.showToast("Error al verificar permisos.", "error");
      await auth.signOut();
    }
  } else {
    console.log("Ningún usuario logueado. Mostrando pantalla de login.");
    showLoginScreen();
  }
}

async function loginAdmin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  if (!email || !password) return UI.showToast("Por favor, ingresa email y contraseña.", "error");

  loginBtn.disabled = true;
  loginBtn.textContent = 'Ingresando...';
  try {
    await auth.signInWithEmailAndPassword(email, password);
  } catch (error) {
    console.error("Error de inicio de sesión:", error?.code || error);
    UI.showToast("Email o contraseña incorrectos.", "error");
  } finally {
    loginBtn.disabled = false;
    loginBtn.textContent = 'Ingresar';
  }
}

async function logoutAdmin() {
  try {
    await auth.signOut();
  } catch (error) {
    console.error("Error al cerrar sesión:", error);
    UI.showToast("Error al cerrar sesión.", "error");
  }
}

function showAdminPanel() {
  loginScreen.style.display = 'none';
  adminPanel.style.display = 'block';
}

function showLoginScreen() {
  loginScreen.style.display = 'flex';
  adminPanel.style.display = 'none';
}

function initializeApp() {
  UI.showToast("Bienvenido, Administrador.", "success");

  // Seteamos fecha por defecto en "Registrar cliente"
  const fechaInscripcionInput = document.getElementById('nuevo-fecha-inscripcion');
  if (fechaInscripcionInput) fechaInscripcionInput.valueAsDate = new Date();

  setupEventListeners();
  iniciarEscuchasFirestore();
  Clientes.startRegistrosListener(); // Iniciar suscripción a registros solo post-login
  UI.actualizarUIPath?.();
}

function setupEventListeners() {
  // Tabs
  document.querySelectorAll('.tablinks').forEach(button => {
    button.addEventListener('click', event => {
      const tabName = button.dataset.tab;
      UI.openTab(tabName, event);

      if (tabName === 'nuevos-registros') {
        marcarNuevosRegistrosComoVistos(); // ← limpia badge/parpadeo
      }
      if (tabName === 'campanas') {
        Campanas.initCampanas?.();
      }
      if (tabName === 'notificaciones') {
        Notificaciones.initNotificaciones?.();
      }
      if (tabName === 'whatsapp') {
        WhatsApp.initWhatsApp?.();
      }
    });
  });

  // Clientes
  document.getElementById('registrar-cliente-btn')?.addEventListener('click', Clientes.registrarCliente);
  document.getElementById('busqueda')?.addEventListener('input', UI.renderizarTablaClientes);

  document.querySelector('#tabla-clientes tbody')?.addEventListener('click', e => {
    if (e.target.classList.contains('ver-ficha-btn')) {
      Clientes.mostrarFichaCliente(e.target.dataset.numeroSocio);
    }
  });

  // Nuevos registros (tabla)
  const tablaNuevosRegistrosBody = document.querySelector('#tabla-nuevos-registros tbody');
  tablaNuevosRegistrosBody?.addEventListener('click', e => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('eliminar-registro-btn')) {
      Clientes.eliminarClienteHandler(id);
    }
    if (e.target.classList.contains('ver-ficha-registro-btn')) {
      Clientes.mostrarFichaCliente(e.target.dataset.numeroSocio);
    }
  });

  document.getElementById('seleccionar-todos-nuevos-registros')?.addEventListener('change', Clientes.seleccionarTodosNuevosRegistros);
  document.getElementById('btn-eliminar-seleccionados')?.addEventListener('click', Clientes.eliminarSeleccionadosHandler);

  // Ficha
  document.getElementById('ficha-btn-buscar')?.addEventListener('click', Clientes.buscarFichaClienteHandler);
  document.getElementById('btn-eliminar-ficha')?.addEventListener('click', e => Clientes.eliminarClienteHandler(e.target.dataset.id));
  document.getElementById('btn-activar-edicion-datos')?.addEventListener('click', UI.activarEdicionDatos);
  document.getElementById('btn-cancelar-edicion-datos')?.addEventListener('click', UI.cancelarEdicionDatos);
  document.getElementById('btn-guardar-edicion-datos')?.addEventListener('click', Clientes.guardarCambiosFichaHandler);
  document.getElementById('btn-activar-edicion-puntos')?.addEventListener('click', UI.activarEdicionPuntos);
  document.getElementById('btn-cancelar-puntos')?.addEventListener('click', UI.cancelarEdicionPuntos);
  document.getElementById('btn-guardar-puntos')?.addEventListener('click', Clientes.guardarPuntosHandler);

  // Transacciones
  document.getElementById('buscar-cliente-compra-btn')?.addEventListener('click', Transacciones.buscarClienteParaCompraHandler);
  document.getElementById('registrar-compra-final-btn')?.addEventListener('click', Transacciones.registrarCompraFinal);

  document.getElementById('buscar-cliente-bono-btn')?.addEventListener('click', Transacciones.buscarClienteParaBonoHandler);
  document.getElementById('aplicar-bono-btn')?.addEventListener('click', Transacciones.aplicarBonoManual);

  document.getElementById('cargar-premios-btn')?.addEventListener('click', Transacciones.buscarClienteParaCanjeHandler);
  document.getElementById('canjear-premio-btn')?.addEventListener('click', Transacciones.canjearPremio);

  // Notificaciones
  // document.getElementById('enviar-notificacion-btn')?.addEventListener('click', Notificaciones.enviarNotificacionHandler);
  // document.querySelectorAll('input[name="destinatario"]').forEach(radio => radio.addEventListener('change', UI.manejarSeleccionDestinatario));
  // document.getElementById('notificacion-btn-buscar')?.addEventListener('click', Notificaciones.buscarClienteParaNotificacionHandler);

  // Config
  document.getElementById('guardar-config-btn')?.addEventListener('click', Config.guardarConfiguracionGeneral);
  document.getElementById('exportar-excel-btn')?.addEventListener('click', Config.exportarAExcel);

  document.getElementById('agregar-regla-btn')?.addEventListener('click', Config.agregarReglaCaducidad);
  document.getElementById('config-caducidad-container').addEventListener('click', e => {
    if (e.target.classList.contains('eliminar-regla-btn')) {
      Config.eliminarReglaCaducidad(parseInt(e.target.dataset.minPuntos));
    }
  });

  // Premios
  document.getElementById('agregar-premio-btn')?.addEventListener('click', Config.manejarGuardadoPremio);
  document.getElementById('guardar-premio-editado-btn')?.addEventListener('click', Config.manejarGuardadoPremio);
  document.getElementById('cancelar-edicion-premio-btn')?.addEventListener('click', UI.cancelarEdicionPremio);
  document.querySelector('#tabla-premios tbody')?.addEventListener('click', e => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('editar-premio-btn')) Config.editarPremio(id);
    if (e.target.classList.contains('eliminar-premio-btn')) Config.eliminarPremio(id);
  });

  // Bonos
  document.getElementById('agregar-bono-btn')?.addEventListener('click', Config.manejarGuardadoBono);
  document.getElementById('guardar-bono-editado-btn')?.addEventListener('click', Config.manejarGuardadoBono);
  document.getElementById('cancelar-edicion-bono-btn')?.addEventListener('click', UI.cancelarEdicionBono);
  document.getElementById('nuevo-bono-tipo')?.addEventListener('change', UI.actualizarLabelValorBono);
  document.querySelector('#tabla-bonos tbody')?.addEventListener('click', e => {
    const id = e.target.dataset.id;
    if (e.target.classList.contains('editar-bono-btn')) Config.editarBono(id);
    if (e.target.classList.contains('eliminar-bono-btn')) Config.eliminarBono(id);
  });

  // Plantillas
  document.getElementById('plantilla-selector')?.addEventListener('change', e => UI.mostrarPlantillaParaEdicion(e.target.value));
  document.getElementById('btn-guardar-plantilla')?.addEventListener('click', Config.guardarPlantilla);
  document.getElementById('btn-crear-plantilla')?.addEventListener('click', Config.crearNuevaPlantilla);

  // Cumpleaños (modal)
  document.getElementById('ver-cumpleanos-btn')?.addEventListener('click', UI.abrirModalCumpleanos);
  document.querySelector('.modal-close-btn')?.addEventListener('click', UI.cerrarModalCumpleanos);
  window.addEventListener('click', e => {
    if (e.target === document.getElementById('cumpleanos-modal')) UI.cerrarModalCumpleanos();
  });

  // Navegación con Enter en formularios
  document.addEventListener('keydown', function (event) {
    if (event.key === 'Enter') {
      const activeElement = document.activeElement;
      if (activeElement && activeElement.tagName === 'INPUT' && activeElement.type !== 'submit' && activeElement.type !== 'button') {
        event.preventDefault();
        const formElements = Array.from(document.querySelectorAll('input:not([type="hidden"]), select, textarea, button.primary-btn, button.save-btn'));
        const visible = formElements.filter(el => el.offsetWidth > 0 && el.offsetHeight > 0 && !el.disabled);
        const i = visible.indexOf(activeElement);
        if (i > -1 && i < visible.length - 1) {
          const next = visible[i + 1];
          next.focus();
          if (next.tagName === 'INPUT' && next.type === 'text') next.select();
        }
      }
    }
  });

  // Plantillas
  document.getElementById('plantilla-selector')?.addEventListener('change', e => UI.mostrarPlantillaParaEdicion(e.target.value));
  document.getElementById('btn-guardar-plantilla')?.addEventListener('click', Config.guardarPlantilla);
  document.getElementById('btn-crear-plantilla')?.addEventListener('click', Config.crearNuevaPlantilla);

  // ===== Autocomplete (con índice que arma data.js) =====
  UI.attachAutocomplete('busqueda', {
    onPick: (it) => {
      const i = document.getElementById('busqueda');
      if (i) i.value = String(it.numeroSocio || it.dni || '');
      UI.renderizarTablaClientes();
    }
  });
  UI.attachAutocomplete('ficha-buscar-cliente', {
    onPick: (it) => {
      const v = String(it.numeroSocio || it.dni || '');
      const i = document.getElementById('ficha-buscar-cliente');
      if (i) i.value = v;
      Clientes.mostrarFichaCliente(v);
    }
  });
  UI.attachAutocomplete('notificacion-buscar-cliente', {
    onPick: (it) => {
      const v = String(it.numeroSocio || it.dni || '');
      const i = document.getElementById('notificacion-buscar-cliente');
      if (i) i.value = v;
      const info = document.getElementById('cliente-encontrado-notificacion');
      if (info) info.textContent = `Seleccionado: ${it.nombre} (Socio ${it.numeroSocio || '—'})`;
    }
  });
  UI.attachAutocomplete('cliente-compra-buscar', { onPick: (it) => { const i = document.getElementById('cliente-compra-buscar'); if (i) i.value = String(it.numeroSocio || it.dni || ''); } });
  UI.attachAutocomplete('cliente-bono-buscar', { onPick: (it) => { const i = document.getElementById('cliente-bono-buscar'); if (i) i.value = String(it.numeroSocio || it.dni || ''); } });
  UI.attachAutocomplete('cliente-premio', { onPick: (it) => { const i = document.getElementById('cliente-premio'); if (i) i.value = String(it.numeroSocio || it.dni || ''); } });

  // WhatsApp Autocomplete
  UI.attachAutocomplete('whatsapp-buscar-cliente', {
    onPick: (it) => {
      const v = String(it.numeroSocio || it.dni || '');
      const i = document.getElementById('whatsapp-buscar-cliente');
      if (i) i.value = v;
      // Trigger manual de búsqueda para mostrar info
      const btn = document.getElementById('whatsapp-btn-buscar');
      if (btn) btn.click();
    }
  });

}



window.addEventListener('DOMContentLoaded', main);
