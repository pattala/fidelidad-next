const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

const DEFAULT_TEMPLATES = {
    whatsappDefaultMessage: "Hola {nombre}, ¡gracias por tu visita! Tenés {puntos} puntos disponibles. ??",
    pointsAdded: "?? ¡Hola {nombre}! ?? Sumaste {puntos} puntos. Tu nuevo saldo es {saldo} ??",
    redemption: "¡Felicidades {nombre}! ?? Canjeaste {premio}. Código: {codigo}. ¡Que lo disfrutes! ?",
    welcome: "¡Bienvenido a {siteName}, {nombre}! ?? Ya tienes {puntos} puntos de regalo. ??",
    campaign: "?? ¡Nueva Campaña!: {titulo}. {descripcion}. ¡No te la pierdas! ??",
    offer: "?? ¡Oferta Especial! {titulo}: {detalle}. Válido hasta el {vencimiento}. ??",
    flashOffer: "? ¡OFERTA FLASH! {titulo}: {detalle}. Solo disponible hoy hasta las {horario} hs. ??",
    birthday: "¡Feliz cumpleaños, {nombre}! ???? Te regalamos {puntos} puntos para que los disfrutes. ¡Que pases un gran día! ?",
    birthdaySimple: "¡Feliz cumpleaños, {nombre}! ???? Esperamos que pases un día increíble. ¡Te enviamos un gran saludo! ?",
    referralReward: "¡Hola {nombre}! ?? Ganaste {puntos} puntos porque tu amigo {amigo} comenzó a usar {siteName}. ¡Gracias por recomendarnos! ?",
    referralPoints: "?? ¡Buenas noticias! Ganaste {puntos} puntos porque {nombre_referido} se unió a {siteName}. ¡Gracias por recomendarnos! ??",
    expirationWarning: "¡Hola {nombre}! ?? Tenés {puntos} puntos para gastar antes del {fecha}. ¡Canjealos hoy por un premio antes de que se venzan! ???",
    referralChallenge: "¡NUEVO DESAFÍO ACTIVO! ?? Traé amigos a {siteName} y ganá bonos extra de puntos por tiempo limitado. ¡Entrá ahora para participar! ??",
    petFoodAlert: "¡Hola {nombre}! ?? A {mascota} le queda poco alimento {marca}. ¡Vení a buscar su bolsa y seguí sumando puntos! ???"
};

async function fix() {
    const docRef = db.collection("config").doc("general");
    const snap = await docRef.get();
    let data = snap.data() || {};
    
    if (!data.messaging) data.messaging = {};
    if (!data.messaging.templates) data.messaging.templates = {};

    let modified = false;
    for (const [key, val] of Object.entries(DEFAULT_TEMPLATES)) {
        if (!data.messaging.templates[key]) {
            data.messaging.templates[key] = val;
            modified = true;
        }
    }
    
    if (!data.messaging.whatsappDefaultMessage) {
        data.messaging.whatsappDefaultMessage = DEFAULT_TEMPLATES.whatsappDefaultMessage;
        modified = true;
    }

    if (modified) {
        await docRef.set(data, { merge: true });
        console.log("Templates guardados exitosamente.");
    } else {
        console.log("Ya existían todos los templates.");
    }
}
fix();
