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

async function listAll() {
    console.log("📢 SCANNING ALL CAMPAIGNS IN FIRESTORE:\n");
    const snap = await db.collection("campanas").get();
    console.log(`Total campaigns: ${snap.size}`);
    snap.forEach(doc => {
        const c = doc.data();
        console.log(`- ID: ${doc.id}`);
        console.log(`  Name: "${c.name}"`);
        console.log(`  active: ${c.active}`);
        console.log(`  autoBroadcast: ${c.autoBroadcast}`);
        console.log(`  startDate: "${c.startDate}" | endDate: "${c.endDate}"`);
        console.log(`  startTime: "${c.startTime}" | endTime: "${c.endTime}"`);
        console.log(`  broadcastSentAt: "${c.broadcastSentAt}"`);
        console.log(`  channels: ${JSON.stringify(c.channels)}`);
        console.log(`  daysOfWeek: ${JSON.stringify(c.daysOfWeek)}`);
        console.log("-----------------------------------------");
    });
}

listAll().catch(console.error);
