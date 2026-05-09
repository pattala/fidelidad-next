import admin from "firebase-admin";
const raw = process.env.GOOGLE_CREDENTIALS_JSON;
if (!raw) {
    console.error("GOOGLE_CREDENTIALS_JSON missing");
    process.exit(1);
}
const sa = JSON.parse(raw);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}
const db = admin.firestore();

async function checkConfig() {
    const snap = await db.collection('config').doc('general').get();
    console.log("CONFIG GENERAL:", JSON.stringify(snap.data(), null, 2));
}

checkConfig().catch(console.error);
