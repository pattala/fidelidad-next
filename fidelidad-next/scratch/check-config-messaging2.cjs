const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("config").doc("general").get();
    console.dir(snap.data().messaging, {depth: null});
}
check();
