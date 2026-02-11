const admin = require("firebase-admin");
const raw = process.env.GOOGLE_CREDENTIALS_JSON;
const sa = JSON.parse(raw);
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function checkConfig() {
    const snap = await db.collection('config').doc('general').get();
    console.log("CONFIG GENERAL:", JSON.stringify(snap.data(), null, 2));
}

checkConfig().catch(console.error);
