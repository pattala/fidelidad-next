const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_broadcast")
        .limit(20)
        .get();
        
    let docs = [];
    snap.docs.forEach(d => docs.push(d.data()));
    docs.sort((a,b) => b.timestamp.toDate() - a.timestamp.toDate());
    console.dir(docs[0], {depth: null});
}
check();
