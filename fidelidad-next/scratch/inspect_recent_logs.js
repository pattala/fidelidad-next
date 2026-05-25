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

async function inspectRecent() {
    console.log("📜 OBTENIENDO ÚLTIMOS 20 LOGS DE AUDITORÍA...");
    const logsSnap = await db.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(20)
        .get();
    
    logsSnap.forEach(doc => {
        const data = doc.data();
        const dateStr = data.timestamp?.toDate ? data.timestamp.toDate().toLocaleString("es-AR") : "Reciente";
        console.log(`- [${dateStr}] Type: ${data.type} | Status: ${data.status} | Summary: ${data.summary}`);
        if (data.details) {
            console.log("  Details:", JSON.stringify(data.details));
        }
    });
}

inspectRecent().catch(console.error);
