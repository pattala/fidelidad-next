const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snapEngine = await db.collection("audit_logs")
        .where("type", "==", "campaign_engine_execution")
        .limit(20)
        .get();
        
    console.log("--- LATEST ENGINE LOGS ---");
    let logs = [];
    snapEngine.forEach(d => logs.push(d.data()));
    logs.sort((a,b) => b.timestamp.toDate() - a.timestamp.toDate());
    logs.slice(0, 5).forEach(l => console.log(l.timestamp.toDate().toISOString(), l.summary));
    
    const snapBroadcast = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .limit(20)
        .get();
        
    console.log("--- LATEST BROADCAST LOGS ---");
    let bLogs = [];
    snapBroadcast.forEach(d => bLogs.push(d.data()));
    bLogs.sort((a,b) => b.timestamp.toDate() - a.timestamp.toDate());
    bLogs.slice(0, 5).forEach(l => console.log(l.timestamp.toDate().toISOString(), l.summary));
}
check();
