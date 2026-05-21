import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");
const rawCreds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const sa = JSON.parse(rawCreds.credentials);

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function resetAll() {
    console.log("🧹 INICIANDO RESET COMPLETO DE BASE DE DATOS PARA PRUEBA LIMPIA...\n");

    const batch = db.batch();

    // 1. Resetear todas las campañas y sus flags de envío
    console.log("📢 1. Reseteando flags de todas las campañas...");
    const campSnap = await db.collection("campanas").get();
    campSnap.forEach(doc => {
        batch.update(doc.ref, { broadcastSentAt: "" });
        console.log(`   - Campaña "${doc.data().name || doc.id}" lista.`);
    });

    // 2. Resetear datos del usuario de prueba (auto-detección por nombre)
    console.log("\n👤 2. Buscando usuario de prueba (Pablo)...");
    const usersSnap = await db.collection("users").get();
    let foundUser = false;

    usersSnap.forEach(docSnap => {
        const data = docSnap.data();
        const nombre = (data.nombre || data.name || '').toLowerCase();
        if (nombre.includes('pablo') || data.email?.includes('pablo') || data.email?.includes('attala')) {
            console.log(`   - Encontrado: "${data.nombre || data.name}" (ID: ${docSnap.id})`);
            foundUser = true;

            batch.update(docSnap.ref, {
                // Cumpleaños
                lastBirthdayGreetingYear: admin.firestore.FieldValue.delete(),
                lastBirthdayPointsYear: admin.firestore.FieldValue.delete(),
                // Vencimientos — limpiar flags Y data calculada
                lastExpirationWarningDates: {},
                nextExpirationDate: null,
                nextExpirationAmount: 0,
                expirationDetails: [],
                // FCM / Permisos
                fcmState: "registered",
                'permissions.notifications.status': "pending",
                'permissions.notifications.mobile_status': "pending",
                'permissions.notifications.mobile_dismissedCount': 0,
                'permissions.notifications.mobile_nextPrompt': null,
                'permissions.notifications.pc_status': "pending",
                'permissions.notifications.pc_dismissedCount': 0,
                'permissions.notifications.pc_nextPrompt': null,
                'permissions.global_lastMobileDismissal': 0,
                'permissions.global_lastPcDismissal': 0
            });

            // Resetear mascotas: limpiar lastFoodAlertDate, lastWhatsAppDate Y lastPurchaseDate
            if (data.pets && Array.isArray(data.pets) && data.pets.length > 0) {
                const resetPets = data.pets.map(p => ({
                    ...p,
                    lastFoodAlertDate: null,
                    lastWhatsAppDate: null,
                    lastPurchaseDate: null
                }));
                batch.update(docSnap.ref, { pets: resetPets });
                console.log(`   - ${resetPets.length} mascota(s) reseteada(s).`);
            }
            console.log("   - Usuario reseteado con éxito.");
        }
    });

    if (!foundUser) {
        console.log("   - [!] No se encontró usuario de prueba. Saltando paso 2.");
    }

    // 3. Limpiar alertas procesadas del panel admin (hoy + 7 días simulados)
    console.log("\n🗂️  3. Limpiando alertas procesadas del panel admin (hoy + 7 días simulados)...");
    const now = new Date();
    for (let i = 0; i <= 7; i++) {
        const d = new Date(now);
        d.setDate(now.getDate() + i);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
        const dailyLogRef = db.collection("audit_logs").doc(`daily_alerts_${dateStr}`);
        batch.set(dailyLogRef, { actions: {}, lastUpdate: admin.firestore.FieldValue.serverTimestamp() }, { merge: false });
        console.log(`   - Log diario "${dateStr}" limpiado.`);
    }

    await batch.commit();

    // 4. Eliminar audit_logs de campañas/canjes/puntos creados HOY (evita alertas huérfanas en el panel)
    console.log("\n🗑️  4. Eliminando audit_logs de campañas y canjes de hoy...");
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    const typesToClean = ['campaign_broadcast', 'prize_redemption', 'points_assignment'];
    let deletedCount = 0;

    for (const type of typesToClean) {
        const logsSnap = await db.collection("audit_logs")
            .where("type", "==", type)
            .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfToday))
            .get();

        if (!logsSnap.empty) {
            const delBatch = db.batch();
            logsSnap.forEach(doc => {
                delBatch.delete(doc.ref);
                deletedCount++;
            });
            await delBatch.commit();
            console.log(`   - ${logsSnap.size} log(s) de tipo "${type}" eliminados.`);
        }
    }

    if (deletedCount === 0) console.log("   - No había logs de hoy para eliminar.");

    console.log("\n✅ ¡Base de datos limpia y lista para volver a testear de cero!");
}

resetAll().catch(console.error);
