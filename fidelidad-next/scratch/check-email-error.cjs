const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("audit_logs")
        .where("type", "==", "campaign_email_error")
        .limit(1)
        .get();
    console.dir(snap.docs[0].data(), {depth: null});
}
check();
