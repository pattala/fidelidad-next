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

async function testQueries() {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    try {
        console.log("🔍 Probando consulta de Campañas (type + timestamp)...");
        await db.collection("audit_logs")
            .where("type", "==", "campaign_broadcast")
            .where("timestamp", ">=", today)
            .get();
        console.log("✅ Consulta de Campañas exitosa!");
    } catch (e) {
        console.log("❌ Consulta de Campañas falló:", e.message);
    }

    try {
        console.log("\n🔍 Probando consulta de Puntos (type + timestamp)...");
        await db.collection("audit_logs")
            .where("type", "==", "points_assignment")
            .where("timestamp", ">=", today)
            .get();
        console.log("✅ Consulta de Puntos exitosa!");
    } catch (e) {
        console.log("❌ Consulta de Puntos falló:", e.message);
    }
}

testQueries().catch(console.error);
