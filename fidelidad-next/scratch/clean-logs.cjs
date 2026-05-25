const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function run() {
    let deletedCount = 0;
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_engine_execution")
        .get();

    const batchSize = 100;
    const docs = snap.docs;
    
    for (let i = 0; i < docs.length; i += batchSize) {
        const batch = db.batch();
        const chunk = docs.slice(i, i + batchSize);
        chunk.forEach(d => batch.delete(d.ref));
        await batch.commit();
        deletedCount += chunk.length;
        console.log(`Deleted ${deletedCount}/${docs.length} engine logs...`);
    }

    console.log("Cleanup complete. Total deleted:", deletedCount);
}
run();
