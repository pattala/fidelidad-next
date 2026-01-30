// modules/auth.js
// (Login, registro con domicilio opcional y consentimientos, cambio de clave, logout)

import { auth, db, firebase } from './firebase.js';
import * as UI from './ui.js';
import { cleanupListener } from './data.js';
// ──────────────────────────────────────────────────────────────
// FIX re-registro: mutex + reseteo duro de cachés Firebase
// ──────────────────────────────────────────────────────────────
let __signupLock = false;

async function hardResetFirebaseCaches() {
  console.log('[Auth] Limpiando sesión previa...');
  // Cierra sesión si hubiera alguien logueado
  try { if (auth.currentUser) await auth.signOut(); } catch { }

  // 1. Promesa de borrado de IndexedDB
  const deletePromise = (async () => {
    const toDelete = [
      'firebaseLocalStorageDb',
      'firebase-installations-database',
      'firebase-messaging-database',
      'firebase-messaging-database-worker',
      'firestore/[DEFAULT]/sistema-fidelizacion/main',
      'firestore/[DEFAULT]/main'
    ];
    await Promise.allSettled(
      toDelete.map(name => new Promise(res => {
        try {
          const req = indexedDB.deleteDatabase(name);
          req.onsuccess = req.onerror = req.onblocked = () => res();
        } catch (e) {
          res(); // Si falla sincrónicamente (SecurityError), seguir
        }
      }))
    );
  })();

  // 2. Timeout de seguridad (1.5s) por si el navegador bloquea IDB silently
  const timeoutPromise = new Promise(resolve => setTimeout(resolve, 1500));

  // Race: lo que termine primero
  await Promise.race([deletePromise, timeoutPromise]);
  console.log('[Auth] Limpieza terminada (o timeout).');

  // Limpia flags locales de la PWA
  try { localStorage.removeItem('justSignedUp'); } catch { }
  try { localStorage.removeItem('addressProvidedAtSignup'); } catch { }
}

async function ensureCleanAuthSession() {
  await hardResetFirebaseCaches();
}

function g(id) { return document.getElementById(id); }
function gv(id) { return g(id)?.value?.trim() || ''; }
function gc(id) { return !!g(id)?.checked; }

// ──────────────────────────────────────────────────────────────
// CONFIG NOTIF SERVER (toma de window.__RAMPET__ si existe)
// ──────────────────────────────────────────────────────────────
const NOTIF_BASE = (window.APP_CONFIG && window.APP_CONFIG.serverUrl)
  || window.APP_CONFIG?.apiUrl || 'https://fidelidad-api.vercel.app';
const API_KEY = (window.APP_CONFIG && window.APP_CONFIG.apiKey)
  || (window.APP_CONFIG && window.APP_CONFIG.serverApiKey)
  || 'Felipe01';

// ──────────────────────────────────────────────────────────────
// LOGIN
// ──────────────────────────────────────────────────────────────
export async function login() {
  const email = gv('login-email').toLowerCase();
  const password = gv('login-password');
  const boton = g('login-btn');

  if (!email && !password) return UI.showToast("Ingresa tu email y contraseña.", "error");
  if (!email) return UI.showToast("Falta ingresar el email.", "error");
  if (!password) return UI.showToast("Falta ingresar la contraseña.", "error");

  boton.disabled = true; boton.textContent = 'Ingresando...';
  try {
    await auth.signInWithEmailAndPassword(email, password);
    // onAuthStateChanged en app.js continúa el flujo
  } catch (error) {
    if (['auth/user-not-found', 'auth/wrong-password', 'auth/invalid-credential'].includes(error.code)) {
      UI.showToast("Email o contraseña incorrectos.", "error");
    } else {
      UI.showToast("Error al iniciar sesión.", "error");
    }
  } finally {
    boton.disabled = false; boton.textContent = 'Ingresar';
  }
}

// ──────────────────────────────────────────────────────────────
// RESET PASSWORD (desde login)
// ──────────────────────────────────────────────────────────────
export async function sendPasswordResetFromLogin() {
  const email = prompt("Por favor, ingresa tu dirección de email para enviarte el enlace de recuperación:");
  if (!email) return;
  try {
    const actionCodeSettings = {
      url: window.location.origin,
      handleCodeInApp: false
    };
    try {
      await auth.sendPasswordResetEmail(email, actionCodeSettings);
    } catch (e) {
      if (e.code === 'auth/unauthorized-continue-uri') {
        console.warn('Dominio no autorizado para redirect. Enviando email básico.');
        console.error(`⚠️ ACCIÓN REQUERIDA: Ve a Firebase Console -> Authentication -> Settings -> Authorized Domains y agrega: ${window.location.hostname}`);
        await auth.sendPasswordResetEmail(email);
      } else {
        throw e;
      }
    }

    UI.showToast(`Si existe una cuenta para ${email}, recibirás un correo en breve.`, "success", 10000);
    // User request: volver a la pantalla de login
    UI.showScreen('login-screen');
  } catch (error) {
    UI.showToast("Ocurrió un problema al enviar el correo. Inténtalo de nuevo.", "error");
    console.error("Error en sendPasswordResetFromLogin:", error);
  }
}

// ──────────────────────────────────────────────────────────────
// Construcción de DOMICILIO desde el formulario de registro
// ──────────────────────────────────────────────────────────────
function collectSignupAddress() {
  const get = (id) => document.getElementById(id)?.value?.trim() || '';

  const calle = get('reg-calle');
  const numero = get('reg-numero');
  const piso = get('reg-piso');
  const depto = get('reg-depto');
  const provincia = get('reg-provincia');
  const partido = get('reg-partido');   // para BA
  const localidad = get('reg-localidad'); // barrio/localidad
  const codigoPostal = get('reg-cp');
  const pais = get('reg-pais') || 'Argentina';
  const referencia = get('reg-referencia');

  const seg1 = [calle, numero].filter(Boolean).join(' ');
  const seg2 = [piso, depto].filter(Boolean).join(' ');
  const seg3 = provincia === 'CABA'
    ? [localidad, 'CABA'].filter(Boolean).join(', ')
    : [localidad, partido, provincia].filter(Boolean).join(', ');
  const seg4 = [codigoPostal, pais].filter(Boolean).join(', ');
  const addressLine = [seg1, seg2, seg3, seg4].filter(Boolean).join(' — ');

  const filled = [calle, numero, localidad || partido || provincia, pais].some(Boolean);
  const status = filled ? (calle && numero && (localidad || partido) && provincia ? 'COMPLETE' : 'PARTIAL') : 'NONE';

  return {
    status,                  // 'COMPLETE' | 'PARTIAL' | 'NONE'
    addressLine: filled ? addressLine : '—',
    components: {
      calle, numero, piso, depto,
      provincia,
      partido: provincia === 'Buenos Aires' ? partido : '',
      barrio: provincia === 'CABA' ? localidad : '',
      localidad: provincia === 'CABA' ? '' : localidad,
      codigoPostal,
      pais,
      referencia
    }
  };
}

// ──────────────────────────────────────────────────────────────
// REGISTRO DE CUENTA (Opción A: asignación del N° via API del server)
// ──────────────────────────────────────────────────────────────
export async function registerNewAccount() {
  console.log('[Auth] registerNewAccount iniciado...');

  // ⬇️ Anti-doble envío
  // ⬇️ Obtener valores del DOM
  const nombre = gv('register-nombre');
  const dni = gv('register-dni');
  const email = (gv('register-email') || '').toLowerCase();
  const telefono = gv('register-telefono');
  const fechaNacimiento = gv('register-fecha-nacimiento');
  const password = gv('register-password');
  const termsAccepted = gc('register-terms');

  // Validaciones Detalladas
  const missing = [];
  if (!nombre) missing.push("Nombre");
  if (!dni) missing.push("DNI");
  if (!email) missing.push("Email");
  if (!password) missing.push("Contraseña");
  if (!fechaNacimiento) missing.push("Fecha Nac.");

  if (missing.length > 0) {
    return UI.showToast(`Faltan datos: ${missing.join(', ')}.`, "error");
  }

  // Validaciones formato
  if (!/^[0-9]+$/.test(dni) || dni.length < 6) {
    return UI.showToast("El DNI debe ser numérico y válido (mín 6 dígitos).", "error");
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return UI.showToast("El email no tiene un formato válido.", "error");
  }
  if (telefono && (!/^[0-9]+$/.test(telefono) || telefono.length < 10)) {
    return UI.showToast("El teléfono debe tener código de área y número (mín 10 dígitos).", "error");
  }
  if (password.length < 6) {
    return UI.showToast("La contraseña es muy corta (mín 6 caracteres).", "error");
  }
  if (!termsAccepted) {
    return UI.showToast("Es necesario aceptar los Términos y Condiciones.", "error");
  }

  // ⬇️ Anti-doble envío (MOVIDO DESPUÉS DE VALIDAR)
  if (__signupLock) {
    console.warn('[Auth] Registro bloqueado por signupLock activo');
    return UI.showToast("Estamos creando tu cuenta… espere un momento.", "info");
  }
  __signupLock = true;


  // Domicilio del registro
  const dom = collectSignupAddress();
  const hasAny = Object.values(dom.components).some(v => v && String(v).trim() !== "");

  // (Opcional) consentimientos si existen
  const regOptinNotifs = !!gc('register-optin-notifs');
  const regOptinGeo = !!gc('register-optin-geo');

  const btn = g('register-btn');
  btn.disabled = true; btn.textContent = 'Creando...';

  try {
    // 1) crear usuario
    try { if (auth.currentUser) await auth.signOut(); } catch { }
    try { localStorage.setItem('justSignedUp', '1'); } catch { }

    const cred = await auth.createUserWithEmailAndPassword(email, password);
    const uid = cred.user.uid;

    // 🟢 FEEDBACK VISUAL: CAMBIO DE PANTALLA
    // Ocultamos el form y mostramos la barra de carga
    try {
      UI.showScreen('registration-progress-screen');
      // Helper para marcar checks
      const tick = (id) => {
        const el = document.getElementById(id);
        if (el) {
          el.innerHTML = '✅ ' + el.innerText.replace('⚪ ', '');
          el.style.color = '#4caf50';
          el.style.fontWeight = 'bold';
        }
      };
      // Tick 1: Usuario creado
      tick('reg-check-1');
    } catch { }

    // 2) documento base
    const baseDoc = {
      authUID: uid,
      numeroSocio: null,
      nombre, dni, email, telefono, fechaNacimiento,
      fechaInscripcion: new Date().toISOString(),
      puntos: 0, saldoAcumulado: 0, totalGastado: 0,
      historialPuntos: [], historialCanjes: [],
      fcmTokens: [],
      terminosAceptados: true,
      terminosAceptadosAt: new Date().toISOString(),
      passwordPersonalizada: true,
      config: {
        notifEnabled: regOptinNotifs,
        geoEnabled: regOptinGeo,
        notifUpdatedAt: new Date().toISOString(),
        geoUpdatedAt: new Date().toISOString()
      },
      ...(hasAny ? { domicilio: dom } : {}),
      source: 'pwa',
      creadoDesde: 'pwa',
      metadata: { createdFrom: 'pwa', sourceVersion: 'pwa@2.0' },
      tyc: { acceptedAt: new Date().toISOString(), version: null, url: null }
    };

    // 3) guardar en clientes/{uid}
    await db.collection('clientes').doc(uid).set(baseDoc, { merge: true });

    // Tick 3: Perfil (Lo hacemos antes de puntos para UX)
    try {
      const el = document.getElementById('reg-check-3');
      if (el) { el.innerHTML = '✅ ' + el.innerText.replace('⚪ ', ''); el.style.color = '#4caf50'; el.style.fontWeight = 'bold'; }
      await new Promise(r => setTimeout(r, 1500)); // ⏳ UX: 1.5s pausa visual
    } catch { }

    // 4) Asignar N° Socio (API interna)
    try {
      const token = await cred.user.getIdToken();

      const rSocio = await fetch('/api/assign-socio-number', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          'x-api-key': window.APP_CONFIG?.apiKey || ''
        },
        body: JSON.stringify({ docId: uid, sendWelcome: true })
      });
      const dSocio = await rSocio.json();

      // Tick 4: Inbox (Emails disparados)
      try {
        const el = document.getElementById('reg-check-4');
        if (el) { el.innerHTML = '✅ ' + el.innerText.replace('⚪ ', ''); el.style.color = '#4caf50'; el.style.fontWeight = 'bold'; }
        await new Promise(r => setTimeout(r, 1500)); // ⏳ UX: 1.5s
      } catch { }

      // ─────────────────────────────────────────────
      // GAMIFICATION
      // ─────────────────────────────────────────────
      try {
        const rPts = await fetch('/api/assign-points', {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({ reason: 'welcome_signup' })
        });
        const dPts = await rPts.json();

        // Tick 2: Puntos (Lo marcamos ahora que se asignaron)
        try {
          const el = document.getElementById('reg-check-2');
          if (el) { el.innerHTML = '✅ ' + el.innerText.replace('⚪ ', ''); el.style.color = '#4caf50'; el.style.fontWeight = 'bold'; }
          await new Promise(r => setTimeout(r, 1500)); // ⏳ UX: 1.5s
        } catch { }

      } catch (eSig) { console.warn('Error awarding signup points', eSig); }

      // ADDRESS BONUS
      if (hasAny) { /* (Logic same as before, background) */
        const isComplete = dom.calle && dom.numero && dom.provincia && (dom.localidad || dom.barrio || dom.partido);
        if (isComplete) {
          fetch('/api/assign-points', {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({ reason: 'profile_address' })
          }).catch(() => { }); // Silent
        }
      }

      // Si el server devuelve el número, lo reflejamos
      if (rSocio.ok && Number.isInteger(dSocio?.numeroSocio)) {
        await db.collection('clientes').doc(uid).set(
          { numeroSocio: dSocio.numeroSocio },
          { merge: true }
        );
      }
    } catch (err) {
      console.warn('[assign-socio-number][PWA] API no disponible:', err);
    }

    // Success Message Final
    try {
      const msg = document.getElementById('reg-progress-msg');
      if (msg) { msg.textContent = '¡Todo listo! Bienvenido al Club.'; msg.style.color = '#4caf50'; msg.style.fontWeight = 'bold'; }
      await new Promise(r => setTimeout(r, 1000));
    } catch { }

    // TOAST FINAL (Backup)
    UI.showToast("¡Registro exitoso! Bienvenido/a al Club.", "success");
  } catch (error) {
    console.error('registerNewAccount error:', error?.code || error);
    // VOLVER A PANTALLA REGISTRO SI FALLA
    UI.showScreen('register-screen');
    if (error?.code === 'auth/email-already-in-use') {
      UI.showToast("Este email ya está registrado.", "error");
    } else {
      UI.showToast("No se pudo crear la cuenta.", "error");
    }
  } finally {
    btn.disabled = false; btn.textContent = 'Crear Cuenta';
    __signupLock = false;
  }
}

// ──────────────────────────────────────────────────────────────
// CAMBIAR CONTRASEÑA
// ──────────────────────────────────────────────────────────────
export async function changePassword() {
  const curr = gv('current-password');
  const pass1 = gv('new-password');
  const pass2 = gv('confirm-new-password');

  if (!pass1 || !pass2) return UI.showToast("Debes completar todos los campos.", "error");
  if (pass1.length < 6) return UI.showToast("La nueva contraseña debe tener al menos 6 caracteres.", "error");
  if (pass1 !== pass2) return UI.showToast("Las nuevas contraseñas no coinciden.", "error");

  const boton = document.getElementById('save-new-password-btn') || document.getElementById('save-change-password');
  if (!boton) return;
  boton.disabled = true; const prev = boton.textContent; boton.textContent = 'Guardando...';

  try {
    const user = auth.currentUser;
    if (!user) throw new Error("No hay usuario activo.");

    if (curr) {
      const credential = firebase.auth.EmailAuthProvider.credential(user.email, curr);
      try { await user.reauthenticateWithCredential(credential); } catch { }
    }

    await user.updatePassword(pass1);
    UI.showToast("¡Contraseña actualizada con éxito!", "success");
    try { UI.closeChangePasswordModal?.(); } catch { }
  } catch (error) {
    if (error?.code === 'auth/requires-recent-login') {
      try {
        await firebase.auth().sendPasswordResetEmail(auth.currentUser?.email);
        UI.showToast('Por seguridad te enviamos un e-mail para restablecer la contraseña.', 'info');
      } catch {
        UI.showToast('No pudimos enviar el e-mail de restablecimiento.', 'error');
      }
    } else {
      UI.showToast("No se pudo actualizar la contraseña. Inténtalo de nuevo.", "error");
    }
    console.error("Error en changePassword:", error);
  } finally {
    boton.disabled = false; boton.textContent = prev || 'Guardar';
  }
}

// ──────────────────────────────────────────────────────────────
// LOGOUT
// ──────────────────────────────────────────────────────────────
export async function logout() {
  console.trace('[Auth] Logout called trace');
  try {
    cleanupListener?.();
    await auth.signOut();
  } catch (error) {
    UI.showToast("Error al cerrar sesión.", "error");
  }
}

export function getCurrentUser() {
  return auth.currentUser;
}
