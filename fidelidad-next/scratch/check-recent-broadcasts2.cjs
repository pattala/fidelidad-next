const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const today = new Date();
    today.setHours(today.getHours() - 10);
    const snap = await db.collection("audit_logs")
        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(today))
        .get();
    
    const logs = snap.docs.map(d => d.data());
    const broadcasts = logs.filter(d => d.type === 'campaign_broadcast' || d.type === 'campaign_whatsapp_csv');
    console.log("Found broadcasts: ", broadcasts.length);
    broadcasts.forEach(d => console.log(d.type, d.details));
}
check();
