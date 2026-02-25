/**
 * SCRIPT: Preparar datos de prueba para Mejoras de Vencimientos/Cumpleaños.
 * Crea/Actualiza un socio que cumple años hoy y otro que vence mañana.
 * 
 * Para ejecutar: node scripts/setup-test-data.js
 */

import admin from "firebase-admin";
import fs from "fs";
import path from "path";

let sa;
const raw = process.env.GOOGLE_CREDENTIALS_JSON;

if (raw) {
    sa = JSON.parse(raw);
} else {
    // Intentar cargar desde archivo local en la raíz del proyecto
    const saPath = path.resolve(process.cwd(), "service-account.json");
    if (fs.existsSync(saPath)) {
        console.log("📂 Cargando credenciales desde service-account.json...");
        sa = JSON.parse(fs.readFileSync(saPath, "utf8"));
    } else {
        console.error("ERROR: No se encontró GOOGLE_CREDENTIALS_JSON ni service-account.json en la raíz.");
        process.exit(1);
    }
}

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function setupTestData() {
    console.log("🚀 Preparando datos de prueba...\n");

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    // Mes-Día para cumpleaños (MM-DD)
    const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;

    // 1. Socio para Vencimiento
    const expSocioId = "test_expiracion_socio";
    await db.collection('users').doc(expSocioId).set({
        name: "Socio Prueba Expiracion ⏳",
        dni: "99999991",
        phone: "5491100000001",
        role: "client",
        points: 1250,
        nextExpirationDate: tomorrowStr,
        nextExpirationAmount: 1250,
        metadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Socio Expiración configurado (Vence: ${tomorrowStr})`);

    // 2. Socio para Cumpleaños
    const birthdaySocioId = "test_cumple_socio";
    await db.collection('users').doc(birthdaySocioId).set({
        name: "Socio Prueba Cumpleaños 🎂",
        dni: "99999992",
        phone: "5491100000002",
        role: "client",
        points: 500,
        birthDate: `1990-${todayMD}`,
        metadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });
    console.log(`✅ Socio Cumpleaños configurado (Cumple: ${todayMD})`);

    console.log("\n✨ ¡Datos listos! Ahora entrá al Dashboard para ver los resultados.");
}

setupTestData().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
