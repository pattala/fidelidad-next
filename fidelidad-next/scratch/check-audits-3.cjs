const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function run() {
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .get();

    const docs = snap.docs.map(d => ({ id: d.id, ...d.data() }));
    docs.sort((a, b) => b.timestamp.toMillis() - a.timestamp.toMillis());
    
    console.log("Recent 5:");
    docs.slice(0, 5).forEach(data => {
        console.log("ID:", data.id, "Date:", data.timestamp.toDate().toISOString(), "Summary:", data.summary, "Details:", JSON.stringify(data.details));
    });
}
run();
