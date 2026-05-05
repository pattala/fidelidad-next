
import admin from "firebase-admin";

const raw = process.env.GOOGLE_CREDENTIALS_JSON;
if (!raw) {
    console.error("ERROR: GOOGLE_CREDENTIALS_JSON not found.");
    process.exit(1);
}

const sa = JSON.parse(raw);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function checkExpirations() {
    console.log("Checking users with expirations around Feb 27...");
    const snap = await db.collection('users').get();

    snap.forEach(doc => {
        const data = doc.data();
        if (data.nextExpirationDate && data.nextExpirationDate.includes('2026-02')) {
            console.log(`User: ${data.name || data.nombre || doc.id}`);
            console.log(`  nextExpirationDate: ${data.nextExpirationDate}`);
            console.log(`  nextExpirationAmount: ${data.nextExpirationAmount}`);
            console.log(`  points: ${data.points || data.puntos}`);
            console.log(`  lastExpirationNotice: ${data.lastExpirationNotice}`);
            console.log(`  lastExpirationNoticeTargetDate: ${data.lastExpirationNoticeTargetDate}`);
            console.log(`  lastExpirationNoticeAmount: ${data.lastExpirationNoticeAmount}`);
        }
    });
}

checkExpirations().then(() => process.exit(0)).catch(console.error);
