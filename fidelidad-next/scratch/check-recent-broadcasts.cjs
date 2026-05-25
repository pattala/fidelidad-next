const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .orderBy("timestamp", "desc")
        .limit(5)
        .get();
    snap.forEach(d => console.log(d.id, d.data()));
}
check();
