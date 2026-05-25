const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .get();
    
    const logs = snap.docs.map(d => d.data());
    // Sort by timestamp desc locally
    logs.sort((a,b) => b.timestamp.toMillis() - a.timestamp.toMillis());
    const recent = logs.slice(0, 3);
    recent.forEach(d => {
        console.log("Root timestamp: ", d.timestamp.toDate().toISOString());
        console.log("Details timestamp: ", d.details[0].timestamp);
    });
}
check();
