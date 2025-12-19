// modules/data.js (Panel Admin – limpio y sin import circular)

import { db } from './firebase.js';
import * as UI from './ui.js';
import { mostrarFichaCliente } from './clientes.js';

// ===== Modelo central =====
export let appData = {
  clientes: [],
  premios: [],
  bonos: [],
  campanas: [],
  plantillas: {},
  config: {
    tasaConversion: 100,
    multiplicadorEfectivo: 1,
    reglasCaducidad: [],
    bono_bienvenida_activo: false,
    bono_bienvenida_puntos: 0,

    apiBase: '',
    publicPanelToken: ''
  }
};

export let premioEnEdicionId = null;
export function setPremioEnEdicionId(id) { premioEnEdicionId = id; }

export let bonoEnEdicionId = null;
export function setBonoEnEdicionId(id) { bonoEnEdicionId = id; }

export let campanaEnEdicionId = null;
export function setCampanaEnEdicionId(id) { campanaEnEdicionId = id; }

// ===== Nuevos registros (badge/parpadeo) =====
export function gestionarNotificacionNuevosRegistros() {
  const clientesPWA = appData.clientes.filter(c => c.authUID);
  const idsClientesPWA = clientesPWA.map(c => c.id).sort();

  const idsVistos = JSON.parse(localStorage.getItem('nuevosRegistrosVistos') || '[]');
  const nuevosNoVistos = idsClientesPWA.filter(id => !idsVistos.includes(id));

  const contadorBadge = document.getElementById('contador-nuevos-registros');
  const tabButton = document.querySelector('.tablinks[data-tab="nuevos-registros"]');

  if (!contadorBadge || !tabButton) return;

  if (nuevosNoVistos.length > 0) {
    contadorBadge.textContent = String(nuevosNoVistos.length);
    contadorBadge.style.display = 'inline-block';
    tabButton.classList.add('parpadeo');
  } else {
    contadorBadge.style.display = 'none';
    tabButton.classList.remove('parpadeo');
  }
}

export function marcarNuevosRegistrosComoVistos() {
  const clientesPWA = appData.clientes.filter(c => c.authUID);
  const idsClientesPWA = clientesPWA.map(c => c.id).sort();
  localStorage.setItem('nuevosRegistrosVistos', JSON.stringify(idsClientesPWA));
  gestionarNotificacionNuevosRegistros();
}

// ===== Suscripciones / snapshots =====
// Helper para reiniciar escuchas ante error de permisos (Race Condition)
function suscribir(coleccion, callback, orderByField = null, orderDirection = 'asc') {
  let ref = db.collection(coleccion);
  if (orderByField) {
    ref = ref.orderBy(orderByField, orderDirection);
  }

  const unsubscribe = ref.onSnapshot(callback, (error) => {
    console.error(`Error escuchando ${coleccion}:`, error);
    if (error.code === 'permission-denied') {
      console.warn(`[Retry] Reiniciando suscripción a ${coleccion} en 2s...`);
      setTimeout(() => suscribir(coleccion, callback, orderByField, orderDirection), 2000);
    }
  });
  return unsubscribe;
}

export function iniciarEscuchasFirestore() {
  // Config
  suscribir('configuracion', (snapshot) => {
    // Es un QuerySnapshot o DocSnapshot? .doc('principal') es un doc.
    // Ajuste para doc único:
  });

  // CORRECCIÓN: La función 'suscribir' genérica asume colecciones. 
  // Hacemos el manejo específico aquí para mantener el código limpio y robusto.

  // 1. Configuración (Documento único)
  const subConfig = () => {
    db.collection('configuracion').doc('principal').onSnapshot((doc) => {
      if (doc.exists) {
        appData.config = { ...appData.config, ...doc.data() };
        UI.renderizarConfiguracion?.(appData.config);
      }
    }, (error) => {
      console.error("Error config:", error);
      if (error.code === 'permission-denied') setTimeout(subConfig, 2500);
    });
  };
  subConfig();

  // 2. Plantillas
  suscribir('plantillas_mensajes', (snapshot) => {
    appData.plantillas = {};
    snapshot.forEach(doc => { appData.plantillas[doc.id] = doc.data(); });
    UI.cargarSelectorPlantillas?.();
    const selector = document.getElementById('plantilla-selector');
    if (selector && selector.value) UI.mostrarPlantillaParaEdicion?.(selector.value);
  });

  // 3. Clientes
  suscribir('clientes', (snapshot) => {
    appData.clientes = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    UI.renderizarTablaClientes?.();
    UI.renderizarTablaNuevosRegistros?.();
    UI.actualizarContadorSuscritos?.();
    UI.verificarCumpleanos?.();
    UI.buildSearchIndex?.(appData.clientes);
    gestionarNotificacionNuevosRegistros();

    // Refresco ficha si está abierta
    const ficha = document.getElementById('ficha-contenido');
    const idFicha = document.getElementById('ficha-numero-socio')?.textContent;
    if (ficha && ficha.style.display !== 'none' && idFicha) mostrarFichaCliente(idFicha);
  }, "numeroSocio");

  // 4. Premios
  suscribir('premios', (snapshot) => {
    appData.premios = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    UI.actualizarTablaPremiosAdmin?.();
  });

  // 5. Bonos
  suscribir('bonos', (snapshot) => {
    appData.bonos = snapshot.docs.map(d => ({ ...d.data(), id: d.id }));
    UI.actualizarTablaBonosAdmin?.();
  });

  // 6. Campañas
  suscribir('campanas', (snapshot) => {
    appData.campanas = snapshot.docs.map(doc => {
      const d = doc.data();
      return {
        id: doc.id, ...d,
        fechaCreacion: d.fechaCreacion?.toDate ? d.fechaCreacion.toDate().toISOString() : new Date().toISOString()
      };
    });
    UI.renderizarTablaCampanas?.();
  }, "fechaCreacion", "desc");
}
