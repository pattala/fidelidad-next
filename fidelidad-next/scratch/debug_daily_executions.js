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

async function debugDaily() {
    console.log("🔍 INVESTIGANDO EJECUCIONES DEL MOTOR DIARIO DE HOY...\n");

    const startOfToday = new Date("2026-05-18T00:00:00-03:00");
    const logsSnap = await db.collection("audit_logs")
        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfToday))
        .orderBy("timestamp", "desc")
        .get();

    console.log(`📋 Logs de auditoría de hoy (${logsSnap.size}):`);
    logsSnap.forEach(doc => {
        const data = doc.data();
        const dateStr = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleTimeString("es-AR") : "Reciente";
        console.log(`- [${dateStr}] Tipo: ${data.type} | Estado: ${data.status} | Resumen: ${data.summary}`);
        if (data.details && data.details.length > 0) {
            console.log("  Detalles:", JSON.stringify(data.details, null, 2));
        }
    });

    console.log("\n👤 DATOS DE CUMPLEAÑOS Y VENCIMIENTO DEL USUARIO PABLO:");
    const userDoc = await db.collection("users").doc("XlWZgAiSrmhEwJ2eqhrbGEYqVRK2").get();
    if (userDoc.exists) {
        const u = userDoc.data();
        console.log(`Nombre: ${u.nombre}`);
        console.log(`Fecha de Nacimiento (birthDate): ${u.birthDate}`);
        console.log(`Último saludo de cumpleaños (lastBirthdayGreetingYear): ${u.lastBirthdayGreetingYear}`);
        console.log(`Últimos puntos de cumpleaños (lastBirthdayPointsYear): ${u.lastBirthdayPointsYear}`);
        console.log(`Próxima fecha de vencimiento (nextExpirationDate): ${u.nextExpirationDate}`);
        console.log(`Fechas de advertencias de vencimiento enviadas (lastExpirationWarningDates):`, JSON.stringify(u.lastExpirationWarningDates || {}, null, 2));
    } else {
        console.log("No se encontró al usuario Pablo.");
    }
}

debugDaily().catch(console.error);
