const fs = require("fs");
const admin = require("firebase-admin");
const creds = JSON.parse(fs.readFileSync("./.dev_creds.json", "utf8"));
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(JSON.parse(creds.credentials)) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("campaigns")
        .where("isFlash", "==", true)
        .where("active", "==", true)
        .get();
        
    console.log(`Found ${snap.docs.length} active flash campaigns`);
    snap.docs.forEach(d => {
        const data = d.data();
        console.log({
            id: d.id,
            name: data.name,
            startTime: data.startTime,
            leadMins: data.broadcastLeadMins,
            sentAt: data.broadcastSentAt,
            autoBroadcast: data.autoBroadcast
        });
    });
}
check();
