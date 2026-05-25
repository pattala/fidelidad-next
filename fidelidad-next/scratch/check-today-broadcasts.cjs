const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const today = new Date();
    today.setHours(0,0,0,0);
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(today))
        .get();
    console.log("Found: ", snap.docs.length);
    snap.forEach(d => console.log(d.id, d.data()));
}
check();
