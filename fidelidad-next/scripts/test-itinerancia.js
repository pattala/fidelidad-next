/**
 * SCRIPT DE PRUEBA: Itinerancia de Avisos de Vencimiento
 * Verifica que el intervalo de X días se respete.
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

dotenv.config({ path: ".env.local" });
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicialización Firebase Admin
const devCredsRaw = fs.readFileSync(resolve(__dirname, "../.dev_creds.json"), "utf8");
const devCreds = JSON.parse(devCredsRaw);
const creds = JSON.parse(devCreds.credentials);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: creds.project_id,
            clientEmail: creds.client_email,
            privateKey: creds.private_key?.replace(/\\n/g, "\n"),
        }),
    });
}
const db = admin.firestore();

async function testItinerancia() {
    const TEST_USER_ID = "socio_test_itinerancia";
    const nextExpDate = "2026-05-17";

    console.log("🛠️  Limpiando usuario anterior...");
    await db.collection('users').doc(TEST_USER_ID).delete();
    
    console.log("🛠️  Configurando usuario de prueba...");
    await db.collection('users').doc(TEST_USER_ID).set({
        nombre: "Socio Itinerante",
        points: 100,
        nextExpirationDate: nextExpDate,
        nextExpirationAmount: 100,
        lastExpirationWarningDates: {} // Limpiar historial
    }, { merge: true });

    await db.collection('users').doc(TEST_USER_ID).collection('points_history').add({
        amount: 100,
        type: 'credit',
        status: 'active',
        remainingPoints: 100,
        expiresAt: admin.firestore.Timestamp.fromDate(new Date(nextExpDate + 'T23:59:59'))
    });

    const { default: engineDaily } = await import("../api/engine-daily.js");

    const runEngine = async (simulatedDate) => {
        console.log(`\n📅 Corriendo motor para fecha: ${simulatedDate}`);
        
        // Limpiar log de auditoría del día para que el motor corra
        await db.collection('audit_logs').doc(`daily_alerts_${simulatedDate}`).delete();
        
        let sent = false;
        const mockRes = {
            status: () => ({
                json: (data) => {
                    // Verificamos si en los detalles está la acción de warning
                    sent = data.results.details.some(d => d.action === "expiration_warning" && d.status === "info");
                    // Nota: En el motor, si se envía el mensaje real, se agrega a details.
                    // Pero espera, el motor agrega a details SIEMPRE para la extensión.
                    // Tengo que ver si realmente disparó el envío (Inbox/Push).
                    // En el código, el envío está dentro del IF.
                },
                end: () => {}
            })
        };
        
        await engineDaily({
            method: 'GET',
            query: { simulatedDate, trigger: 'test_itinerancia', ignoreDeduplication: 'false' },
            headers: { 'authorization': `Bearer ${process.env.API_SECRET_KEY}` }
        }, mockRes);

        // Una mejor forma de saber si se envió es chequear si se actualizó lastExpirationWarningDates
        const snap = await db.collection('users').doc(TEST_USER_ID).get();
        const lastDate = snap.data().lastExpirationWarningDates?.[nextExpDate];
        const wasSentNow = lastDate === simulatedDate;
        
        console.log(wasSentNow ? "✅ AVISO ENVIADO" : "🚫 AVISO BLOQUEADO (Itinerancia)");
        return wasSentNow;
    };

    // Día 1: Debería enviar
    await runEngine("2026-05-14");

    // Día 2: Debería bloquear (Intervalo es 2 en config)
    await runEngine("2026-05-15");

    // Día 3: Debería enviar de nuevo
    await runEngine("2026-05-16");

    console.log("\n✨ Prueba finalizada.");
}

testItinerancia().catch(console.error);
