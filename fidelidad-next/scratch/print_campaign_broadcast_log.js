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

async function checkLog() {
    console.log("🔍 OBTENIENDO DETALLES DEL LOG DE CAMPAÑA MASIVA DE HOY...\n");
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .orderBy("timestamp", "desc")
        .limit(5)
        .get();

    console.log(`Logs encontrados: ${snap.size}`);
    snap.forEach(doc => {
        const d = doc.data();
        console.log(`Document ID: ${doc.id}`);
        console.log(`Summary: "${d.summary}"`);
        console.log(`Timestamp:`, d.timestamp?.toDate ? d.timestamp.toDate().toISOString() : d.timestamp);
        console.log(`Details:`, JSON.stringify(d.details));
        console.log("-----------------------------------------");
    });
}

checkLog().catch(console.error);
