const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function run() {
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .orderBy("timestamp", "desc")
        .limit(5)
        .get();

    snap.docs.forEach(d => {
        const data = d.data();
        console.log("Date:", data.timestamp.toDate().toISOString(), "Summary:", data.summary);
    });
}
run();
