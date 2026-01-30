// --------------------------------------------------------------------
// MÓDULO: FIREBASE
// --------------------------------------------------------------------
// Descripción: Este módulo se encarga exclusivamente de la 
// inicialización de Firebase. Centraliza la configuración y exporta
// las instancias del SDK (db, auth) para que otros módulos 
// puedan importarlas y utilizarlas, asegurando que solo se 
// inicialice una vez.
// --------------------------------------------------------------------

// Se importa desde el script global cargado en el HTML
const firebase = window.firebase;

// Tu configuración de Firebase
// Tu configuración de Firebase (Leída desde config.js para White-Label)
const firebaseConfig = window.ADMIN_CONFIG?.firebaseConfig || {
  // Fallback seguro o error
  apiKey: "MISSING_CONFIG",
  authDomain: "missing.firebaseapp.com",
  projectId: "missing",
};

// Inicializar la aplicación de Firebase
const app = firebase.initializeApp(firebaseConfig);

// Obtener las instancias de los servicios que vamos a utilizar
const db = firebase.firestore();
const auth = firebase.auth();

// Exportar las instancias para que estén disponibles en otros módulos
export { db, auth, firebase };