import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");
const rawCreds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const sa = JSON.parse(rawCreds.credentials);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa),
    });
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

    // 2. Resetear datos del usuario de prueba (Pablo)
    console.log("\n👤 2. Reseteando flags del usuario Pablo...");
    const userId = "XlWZgAiSrmhEwJ2eqhrbGEYqVRK2";
    const userRef = db.collection("users").doc(userId);
    const userDoc = await userRef.get();

    if (userDoc.exists) {
        const userData = userDoc.data();

        batch.update(userRef, {
            // Cumpleaños
            lastBirthdayGreetingYear: admin.firestore.FieldValue.delete(),
            lastBirthdayPointsYear: admin.firestore.FieldValue.delete(),
            // Vencimientos de puntos
            lastExpirationWarningDates: {},
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

        // Resetear lastFoodAlertDate, lastWhatsAppDate Y lastPurchaseDate de todas las mascotas
        // Sin lastPurchaseDate el panel no puede calcular la ventana de alerta → no aparece ninguna alerta espuria
        if (userData.pets && Array.isArray(userData.pets) && userData.pets.length > 0) {
            const resetPets = userData.pets.map(p => ({
                ...p,
                lastFoodAlertDate: null,
                lastWhatsAppDate: null,
                lastPurchaseDate: null    // evita alertas residuales de compras de pruebas anteriores
            }));
            batch.update(userRef, { pets: resetPets });
            console.log(`   - ${resetPets.length} mascota(s) reseteada(s) (incluyendo lastPurchaseDate).`);
        }

        console.log("   - Usuario Pablo reseteado con éxito.");
    } else {
        console.log("   - [!] No se encontró el usuario Pablo.");
    }

    // 3. Limpiar logs de alertas diarias: hoy + próximos 7 días simulados
    // Evita que alertas "procesadas" de sesiones anteriores persistan al avanzar el simulador
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

    // 4. Ejecutar todo
    await batch.commit();
    console.log("\n✅ ¡Base de datos limpia y lista para volver a testear de cero!");
}

resetAll().catch(console.error);
