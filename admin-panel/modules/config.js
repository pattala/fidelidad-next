// --------------------------------------------------------------------
// MÓDULO: CONFIG
// --------------------------------------------------------------------
// Descripción: Este módulo agrupa toda la lógica de negocio de la
// pestaña "Configuración". Esto incluye el CRUD de premios y bonos,
// la gestión de reglas de caducidad, plantillas de mensajes,
// y la importación/exportación de datos.
// --------------------------------------------------------------------

import { db } from './firebase.js';
import { appData, premioEnEdicionId, setPremioEnEdicionId, bonoEnEdicionId, setBonoEnEdicionId } from './data.js';
import * as UI from './ui.js';

/**
 * Guarda la configuración general del sistema y las reglas de caducidad en Firestore.
 */
// ─────────────────────────────────────────────────────────
// RAMPET FIX: guardarConfiguracionGeneral con lecturas seguras
// (no rompe si falta algún input en el DOM)
// ─────────────────────────────────────────────────────────
export async function guardarConfiguracionGeneral() {
  const botonGuardar = document.getElementById('guardar-config-btn');
  if (botonGuardar) {
    botonGuardar.disabled = true;
    botonGuardar.textContent = 'Guardando...';
  }

  try {
    const cfg = {};

    // --- Conversión básica ---
    const elTasa = document.getElementById('tasa-conversion');
    cfg.tasaConversion = parseInt(elTasa?.value ?? '100') || 100;

    // --- Bono bienvenida ---
    const elBBActivo = document.getElementById('bono-bienvenida-activo');
    const elBBPuntos = document.getElementById('bono-bienvenida-puntos');
    cfg.bono_bienvenida_activo = !!elBBActivo?.checked;
    cfg.bono_bienvenida_puntos = parseInt(elBBPuntos?.value ?? '0') || 0;

    // --- Pago en efectivo (opcional: solo si existen inputs) ---
    const elEfActivo = document.getElementById('cfg-efectivo-activo');
    const elEfModo   = document.getElementById('cfg-efectivo-modo');     // 'add' | 'mul'
    const elEfValor  = document.getElementById('cfg-efectivo-valor');    // number
    const elEfScope  = document.getElementById('cfg-efectivo-scope');    // 'post_bono' | 'base'

    if (elEfActivo || elEfModo || elEfValor || elEfScope) {
      cfg.pago_efectivo_activo = !!elEfActivo?.checked;
      cfg.pago_efectivo_modo   = (elEfModo?.value || 'add').trim();
      cfg.pago_efectivo_valor  = Number(elEfValor?.value ?? 0);
      cfg.pago_efectivo_scope  = (elEfScope?.value || 'post_bono').trim();
    }

    // --- Reglas de caducidad (tolerante) ---
    const nuevasReglas = [];
    const minPuntosSet = new Set();
    const reglasItems = document.querySelectorAll('.config-caducidad-item');

    reglasItems.forEach(item => {
      const minPuntosInput = item.querySelector('.regla-min');
      const cadaDiasInput  = item.querySelector('.regla-dias');
      if (!minPuntosInput || !cadaDiasInput) return;

      const minPuntos = parseInt(minPuntosInput.value);
      const cadaDias  = parseInt(cadaDiasInput.value);
      if (isNaN(minPuntos) || isNaN(cadaDias) || minPuntos <= 0 || cadaDias <= 0) return;

      if (minPuntosSet.has(minPuntos)) {
        throw new Error(`El valor de "Mín. Puntos" (${minPuntos}) está duplicado.`);
      }
      minPuntosSet.add(minPuntos);
      nuevasReglas.push({ minPuntos, cadaDias });
    });

    cfg.reglasCaducidad = nuevasReglas;

    // Guardar en Firestore
    await db.collection('configuracion').doc('parametros').set(cfg, { merge: true });
    UI.showToast("Configuración guardada correctamente.", "success");

  } catch (e) {
    console.error("Error al guardar configuración:", e);
    UI.showToast("Error al guardar: " + (e?.message || e), "error");
  } finally {
    if (botonGuardar) {
      botonGuardar.disabled = false;
      botonGuardar.textContent = 'Guardar Toda la Configuración';
    }
  }
}


// ========== (Opcional) Cargar configuración para pintar la UI ==========
export async function cargarConfiguracionGeneral() {
    try {
        const snap = await db.collection('configuracion').doc('parametros').get();
        const cfg = snap.exists ? (snap.data() || {}) : {};

        // Conversión
        if (document.getElementById('tasa-conversion')) {
            document.getElementById('tasa-conversion').value = String(cfg.tasaConversion ?? 100);
        }

        // Bono bienvenida
        if (document.getElementById('bono-bienvenida-activo')) {
            document.getElementById('bono-bienvenida-activo').checked = !!cfg.bono_bienvenida_activo;
        }
        if (document.getElementById('bono-bienvenida-puntos')) {
            document.getElementById('bono-bienvenida-puntos').value = String(cfg.bono_bienvenida_puntos ?? 0);
        }

        // RAMPET FIX: leer propiedad unificada
        if (document.getElementById('cfg-efectivo-activo')) {
            document.getElementById('cfg-efectivo-activo').checked = !!cfg.pago_efectivo_activo;
        }
        if (document.getElementById('cfg-efectivo-modo')) {
            document.getElementById('cfg-efectivo-modo').value = cfg.pago_efectivo_modo || 'add';
        }
        if (document.getElementById('cfg-efectivo-valor')) {
            document.getElementById('cfg-efectivo-valor').value = String(cfg.pago_efectivo_valor ?? 0);
        }
        if (document.getElementById('cfg-efectivo-scope')) {
            document.getElementById('cfg-efectivo-scope').value = cfg.pago_efectivo_scope || 'post_bono';
        }

        // Reglas de caducidad
        UI.cargarReglasCaducidadUI(cfg.reglasCaducidad || []);
    } catch (e) {
        console.error('No se pudo cargar la configuración', e);
        UI.showToast("No se pudo cargar la configuración.", "error");
    }
}

// ========== CRUD DE PREMIOS ==========
export async function manejarGuardadoPremio() {
    const nombre = document.getElementById('nuevo-premio-nombre').value.trim();
    const puntos = parseInt(document.getElementById('nuevo-premio-puntos').value);
    const stock = parseInt(document.getElementById('nuevo-premio-stock').value);

    if (!nombre || isNaN(puntos) || isNaN(stock) || puntos < 0 || stock < 0) {
        return UI.showToast("Complete todos los campos del premio con valores válidos.", "error");
    }
    
    if (premioEnEdicionId !== null) {
        await db.collection('premios').doc(premioEnEdicionId).update({ nombre, puntos, stock });
        UI.showToast("Premio actualizado.", "success");
    } else {
        await db.collection('premios').add({ nombre, puntos, stock });
        UI.showToast("Premio agregado.", "success");
    }
    setPremioEnEdicionId(null);
    UI.cancelarEdicionPremio();
}

export function editarPremio(id) {
    const premio = appData.premios.find(p => p.id === id);
    if (!premio) return;
    
    setPremioEnEdicionId(id);
    document.getElementById('nuevo-premio-nombre').value = premio.nombre;
    document.getElementById('nuevo-premio-puntos').value = premio.puntos;
    document.getElementById('nuevo-premio-stock').value = premio.stock;
    
    document.getElementById('botones-edicion-premio').style.display = 'flex';
    document.getElementById('agregar-premio-btn').style.display = 'none';
}

export async function eliminarPremio(id) {
    if (confirm("¿Está seguro de que quiere eliminar este premio?")) {
        await db.collection('premios').doc(id).delete();
        UI.showToast("Premio eliminado.", "success");
    }
}

// ========== CRUD DE BONOS ==========
export async function manejarGuardadoBono() {
    const nombre = document.getElementById('nuevo-bono-nombre').value.trim();
    const tipo = document.getElementById('nuevo-bono-tipo').value;
    const valor = parseFloat(document.getElementById('nuevo-bono-valor').value);

    if (!nombre || !tipo || isNaN(valor) || valor <= 0) {
        return UI.showToast("Complete todos los campos del bono con valores válidos.", "error");
    }
    if (tipo === 'compra' && valor <= 1) {
        return UI.showToast("El multiplicador para un bono de compra debe ser mayor a 1.", "error");
    }

    const bonoData = { nombre, tipo, valor };
    if (bonoEnEdicionId !== null) {
        await db.collection('bonos').doc(bonoEnEdicionId).update(bonoData);
        UI.showToast("Bono actualizado.", "success");
    } else {
        await db.collection('bonos').add(bonoData);
        UI.showToast("Bono agregado.", "success");
    }
    setBonoEnEdicionId(null);
    UI.cancelarEdicionBono();
}

export function editarBono(id) {
    const bono = appData.bonos.find(b => b.id === id);
    if (!bono) return;
    
    setBonoEnEdicionId(id);
    document.getElementById('nuevo-bono-nombre').value = bono.nombre;
    document.getElementById('nuevo-bono-tipo').value = bono.tipo;
    document.getElementById('nuevo-bono-valor').value = bono.valor;
    
    UI.actualizarLabelValorBono();
    document.getElementById('botones-edicion-bono').style.display = 'flex';
    document.getElementById('agregar-bono-btn').style.display = 'none';
}

export async function eliminarBono(id) {
    if (confirm("¿Está seguro de que quiere eliminar este bono?")) {
        await db.collection('bonos').doc(id).delete();
        UI.showToast("Bono eliminado.", "success");
    }
}

// ========== GESTIÓN DE PLANTILLAS ==========
export async function guardarPlantilla() {
  const plantillaId = document.getElementById('plantilla-selector').value;
  if (!plantillaId) {
    return UI.showToast("Por favor, selecciona una plantilla para guardar.", "warning");
  }

  const nuevoTitulo = document.getElementById('plantilla-titulo-edit').value;
  const nuevoCuerpo = document.getElementById('plantilla-cuerpo-edit').value;

  const boton = document.getElementById('btn-guardar-plantilla');
  boton.disabled = true;

  try {
    const SafeCtor = (UI && UI.SafeStringOrFallback) ? UI.SafeStringOrFallback : null;
    const tituloPush  = SafeCtor ? new SafeCtor(nuevoTitulo) : nuevoTitulo;
    const cuerpoPush  = SafeCtor ? new SafeCtor(nuevoCuerpo) : nuevoCuerpo;

    await db.collection('plantillas').doc(plantillaId).set({
      titulo_email: nuevoTitulo,
      cuerpo_email: nuevoCuerpo,
      titulo_push: tituloPush,
      cuerpo_push: cuerpoPush,
      titulo: nuevoTitulo,
      cuerpo: nuevoCuerpo
    }, { merge: true });

    UI.showToast(`Plantilla '${plantillaId}' guardada con éxito.`, "success");
  } catch (error) {
    console.error("Error al guardar la plantilla:", error);
    UI.showToast("No se pudo guardar la plantilla.", "error");
  } finally {
    boton.disabled = false;
  }
}

export async function crearNuevaPlantilla() {
    const idInput = document.getElementById('plantilla-nueva-id');
    const tituloInput = document.getElementById('plantilla-nueva-titulo');
    const cuerpoInput = document.getElementById('plantilla-nueva-cuerpo');

    const nuevoId = idInput.value.trim().toLowerCase().replace(/\s+/g, '_');
    const nuevoTitulo = tituloInput.value.trim();
    const nuevoCuerpo = cuerpoInput.value.trim();

    if (!nuevoId || !nuevoTitulo || !nuevoCuerpo) {
        return UI.showToast("Debes completar todos los campos para crear una plantilla.", "error");
    }
    if (!/^[a-z0-9_]+$/.test(nuevoId)) {
        return UI.showToast("El ID solo puede contener letras minúsculas, números y guiones bajos (_).", "error");
    }
    if (appData.plantillas[nuevoId]) {
        return UI.showToast(`El ID de plantilla '${nuevoId}' ya existe. Elige otro.`, "error");
    }
    
    const boton = document.getElementById('btn-crear-plantilla');
    boton.disabled = true;
    try {
        await db.collection('plantillas').doc(nuevoId).set({
            titulo_email: nuevoTitulo,
            cuerpo_email: nuevoCuerpo,
            titulo_push: nuevoTitulo,
            cuerpo_push: nuevoCuerpo,
            tipo: "email_y_push",
            titulo: nuevoTitulo,
            cuerpo: nuevoCuerpo
        });

        UI.showToast(`¡Plantilla '${nuevoId}' creada con éxito!`, "success");
        idInput.value = '';
        tituloInput.value = '';
        cuerpoInput.value = '';
    } catch (error) {
        console.error("Error al crear la nueva plantilla:", error);
        UI.showToast("No se pudo crear la plantilla.", "error");
    } finally {
        boton.disabled = false;
    }
}

// ========== IMPORTAR / EXPORTAR ==========
export async function exportarAExcel() {
    try {
        const wb = XLSX.utils.book_new();
        
        // Hoja de Clientes
        const clientesParaExportar = appData.clientes.map(c => ({
            'N° Socio': c.numeroSocio,
            'DNI': c.dni,
            'Nombre': c.nombre,
            'Email': c.email,
            'Telefono': c.telefono,
            'Fecha Nacimiento': c.fechaNacimiento,
            'Puntos': c.puntos,
            'Fecha Inscripcion': c.fechaInscripcion,
            'Ultima Compra': c.ultimaCompra,
            'Terminos Aceptados': c.terminosAceptados ? 'Sí' : 'No'
        }));
        const wsClientes = XLSX.utils.json_to_sheet(clientesParaExportar);
        XLSX.utils.book_append_sheet(wb, wsClientes, "Clientes");
        
        // Hoja de Historial de Canjes
        const canjesParaExportar = appData.clientes.flatMap(c => 
            (c.historialCanjes || []).map(canje => ({
                'N° Socio': c.numeroSocio,
                'Nombre Cliente': c.nombre,
                'Fecha Canje': canje.fechaCanje,
                'Premio': canje.nombrePremio,
                'Puntos Utilizados': canje.puntosCoste
            }))
        );
        const wsCanjes = XLSX.utils.json_to_sheet(canjesParaExportar);
        XLSX.utils.book_append_sheet(wb, wsCanjes, "Historial Canjes");

        XLSX.writeFile(wb, "datos_fidelizacion_rampet.xlsx");
        UI.showToast("Datos exportados a 'datos_fidelizacion_rampet.xlsx'", "success");
    } catch (error) {
        console.error("Error al exportar a Excel:", error);
        UI.showToast("Error al exportar los datos a Excel.", "error");
    }
}
