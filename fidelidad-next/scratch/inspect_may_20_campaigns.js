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

async function inspectCampaigns() {
    console.log("📢 INSPECCIONANDO ESTADO DE TODAS LAS CAMPAÑAS EN FIRESTORE:\n");
    const snap = await db.collection("campanas").get();
    
    snap.forEach(doc => {
        const d = doc.data();
        console.log(`ID: ${doc.id} | Nombre: "${d.name || 'Sin Nombre'}"`);
        console.log(`- Active: ${d.active}`);
        console.log(`- StartDate: "${d.startDate}" | EndDate: "${d.endDate}"`);
        console.log(`- StartTime: "${d.startTime}" | EndTime: "${d.endTime}"`);
        console.log(`- AutoBroadcast: ${d.autoBroadcast}`);
        console.log(`- BroadcastSentAt: "${d.broadcastSentAt || ''}"`);
        console.log(`- Channels:`, JSON.stringify(d.channels || []));
        console.log(`- isFlash: ${d.isFlash}`);
        console.log("------------------------------------------------");
    });
}

inspectCampaigns().catch(console.error);
