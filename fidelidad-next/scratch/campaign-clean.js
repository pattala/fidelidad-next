import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");

if (!fs.existsSync(credsPath)) {
    console.error("❌ Credentials file not found at:", credsPath);
    process.exit(1);
}

const rawCreds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const sa = JSON.parse(rawCreds.credentials);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa)
    });
}

const db = admin.firestore();

async function run() {
    console.log("🚀 Iniciando limpieza completa para pruebas de QA (con filtros en memoria y borrado en paralelo)...");

    // 1. Resetear config/general
    console.log("\n1️⃣ Limpiando flags dailyCheck y campaignCheck en config/general...");
    await db.collection("config").doc("general").update({
        dailyCheck: "",
        campaignCheck: ""
    });
    console.log("✅ Flags de configuración reseteados.");

    // 2. Eliminar dinámicamente todos los bloqueos de alertas diarias (daily_alerts_*)
    console.log("\n2️⃣ Eliminando bloqueos de alertas diarias (daily_alerts_*)...");
    const auditLogsSnapAll = await db.collection("audit_logs").get();
    const locksToDeletePromises = [];
    auditLogsSnapAll.forEach(doc => {
        if (doc.id.startsWith("daily_alerts_")) {
            console.log(`   -> Eliminando bloqueo diario: ${doc.id}`);
            locksToDeletePromises.push(doc.ref.delete());
        }
    });
    await Promise.all(locksToDeletePromises);
    console.log(`✅ Bloqueos diarios eliminados (${locksToDeletePromises.length} encontrados).`);

    // 3. Eliminar logs de difusiones de campaña y ejecuciones de hoy para arrancar sin alertas viejas
    console.log("\n3️⃣ Eliminando logs de ejecución de motores recientes...");
    
    // Filtro temporal amplio para limpiar logs del día de hoy y de la semana de pruebas
    const startOfToday = new Date("2026-05-22T00:00:00-03:00");
    const logTypesToDelete = [
        "campaign_broadcast",
        "campaign_engine_execution",
        "daily_engine_execution",
        "daily_check_info",
        "engine_daily_unified",
        "engine_daily_execution_finished"
    ];

    let deletedLogsCount = 0;
    for (const logType of logTypesToDelete) {
        console.log(`   Analizando tipo de log: ${logType}...`);
        const auditLogsSnap = await db.collection("audit_logs")
            .where("type", "==", logType)
            .get();

        const docsToDelete = [];
        for (const doc of auditLogsSnap.docs) {
            const data = doc.data();
            if (data.timestamp) {
                const logDate = data.timestamp.toDate();
                if (logDate >= startOfToday) {
                    docsToDelete.push(doc.ref);
                }
            }
        }

        if (docsToDelete.length > 0) {
            console.log(`      -> Encontrados ${docsToDelete.length} logs de tipo ${logType}. Eliminando en paralelo...`);
            const chunkSize = 100;
            for (let i = 0; i < docsToDelete.length; i += chunkSize) {
                const chunk = docsToDelete.slice(i, i + chunkSize);
                await Promise.all(chunk.map(ref => ref.delete()));
                deletedLogsCount += chunk.length;
            }
            console.log(`      ✅ Eliminados exitosamente.`);
        } else {
            console.log(`      -> Sin logs para eliminar.`);
        }
    }
    console.log(`✅ Se eliminaron en total ${deletedLogsCount} logs de motores del período de pruebas.`);

    // 4. Resetear el flag 'broadcastSentAt' en todas las campañas
    console.log("\n4️⃣ Reseteando fecha de último envío (broadcastSentAt) en todas las campañas...");
    const campaignsSnap = await db.collection("campanas").get();
    let updatedCampaignsCount = 0;
    
    const campaignsPromises = campaignsSnap.docs.map(doc => {
        updatedCampaignsCount++;
        console.log(`   ➡️ Campaña reseteada: ${doc.data().name}`);
        return doc.ref.update({ broadcastSentAt: "" });
    });
    await Promise.all(campaignsPromises);
    console.log(`✅ Se resetearon ${updatedCampaignsCount} campañas.`);

    // 5. Resetear flags de notificaciones de todos los usuarios (MANTENIENDO el fcmToken activo)
    console.log("\n5️⃣ Reseteando historial de alertas (Cumpleaños, Vencimientos y Mascotas) de los usuarios...");
    const usersSnap = await db.collection("users").get();
    let updatedUsersCount = 0;
    
    const usersPromises = usersSnap.docs.map(doc => {
        const uData = doc.data();
        
        // Resetear mascotas si existen
        let nextPets = uData.pets || [];
        let updatedPets = false;
        if (Array.isArray(nextPets) && nextPets.length > 0) {
            nextPets = nextPets.map(p => {
                if (p.lastFoodAlertDate || p.nextFoodAlertDate) {
                    updatedPets = true;
                    return { ...p, lastFoodAlertDate: "", nextFoodAlertDate: "" };
                }
                return p;
            });
        }

        const updateData = {
            lastBirthdayGreetingYear: admin.firestore.FieldValue.delete(),
            lastBirthdayPointsYear: admin.firestore.FieldValue.delete(),
            lastExpirationWarningDates: {}
        };
        if (updatedPets) {
            updateData.pets = nextPets;
        }

        updatedUsersCount++;
        console.log(`   ➡️ Alertas de usuario reseteadas: ${uData.nombre || uData.name || 'Socio'}`);
        return doc.ref.update(updateData);
    });
    await Promise.all(usersPromises);
    console.log(`✅ Se resetearon ${updatedUsersCount} perfiles de usuario.`);

    console.log("\n🚀 ¡LIMPIEZA DE CAMPAÑAS Y LOGS COMPLETADA CON ÉXITO! El sistema está 100% en limpio para tus pruebas QA.");
}

run().catch(console.error);