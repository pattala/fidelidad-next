const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snapEngine = await db.collection("audit_logs")
        .where("type", "==", "campaign_engine_execution")
        .orderBy("timestamp", "desc")
        .limit(5)
        .get();
        
    console.log("--- LATEST ENGINE LOGS ---");
    snapEngine.forEach(d => console.log(d.data().timestamp.toDate().toISOString(), d.data().summary));
    
    const snapBroadcast = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .orderBy("timestamp", "desc")
        .limit(3)
        .get();
        
    console.log("--- LATEST BROADCAST LOGS ---");
    snapBroadcast.forEach(d => console.log(d.data().timestamp.toDate().toISOString(), d.data().summary));
}
check();
