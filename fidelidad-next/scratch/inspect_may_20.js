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

async function inspect() {
    console.log("🔍 REALIZANDO AUDITORÍA COMPLETA DEL SISTEMA AL 20/05/2026...\n");

    // 1. Obtener Configuración General
    const configSnap = await db.collection("config").doc("general").get();
    console.log("⚙️ CONFIG GENERAL:");
    console.log(JSON.stringify(configSnap.data(), null, 2));

    // 2. Obtener Campañas Activas
    const campSnap = await db.collection("campanas").where("active", "==", true).get();
    console.log(`\n📢 CAMPAÑAS ACTIVAS (${campSnap.size}):`);
    campSnap.forEach(doc => {
        const c = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Nombre: ${c.name}`);
        console.log(`  autoBroadcast: ${c.autoBroadcast}`);
        console.log(`  startDate: ${c.startDate} | endDate: ${c.endDate}`);
        console.log(`  startTime: ${c.startTime} | endTime: ${c.endTime}`);
        console.log(`  broadcastSentAt: ${c.broadcastSentAt}`);
        console.log(`  isFlash: ${c.isFlash} | flashDays: ${c.flashDays} | daysOfWeek: ${JSON.stringify(c.daysOfWeek)}`);
    });

    // 3. Obtener Logs de hoy (20 de Mayo)
    const startOfToday = new Date("2026-05-20T00:00:00-03:00");
    const logsSnap = await db.collection("audit_logs")
        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfToday))
        .orderBy("timestamp", "desc")
        .get();

    console.log(`\n📜 LATEST AUDIT LOGS (Today, May 20):`);
    logsSnap.forEach(doc => {
        const data = doc.data();
        const dateStr = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString("es-AR") : "Reciente";
        console.log(`- [${dateStr}] Type: ${data.type} | Status: ${data.status} | Summary: ${data.summary}`);
        if (data.details) {
            console.log("  Details:", JSON.stringify(data.details, null, 2));
        }
    });
}

inspect().catch(console.error);
