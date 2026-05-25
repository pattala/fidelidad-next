const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("audit_logs")
        .where("type", "in", ["email_notification", "campaign_email_error"])
        .limit(5)
        .get();
        
    let docs = [];
    snap.docs.forEach(d => docs.push(d.data()));
    docs.sort((a,b) => b.timestamp.toDate() - a.timestamp.toDate());
    docs.forEach(d => console.log(d.timestamp.toDate().toISOString(), d.type, d.summary));
}
check();
