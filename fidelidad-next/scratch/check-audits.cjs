const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function run() {
    const minTimestamp = new Date();
    minTimestamp.setHours(0, 0, 0, 0);

    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .where("timestamp", ">=", minTimestamp)
        .get();

    console.log("Found:", snap.docs.length);
    snap.docs.forEach(d => {
        const data = d.data();
        console.log("ID:", d.id, "Summary:", data.summary, "Details:", JSON.stringify(data.details));
    });
}
run();
