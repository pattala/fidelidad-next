import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const serviceAccount = JSON.parse(
  await readFile(new URL('./service-account.json', import.meta.url))
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkUserLogs(userId) {
    console.log(`--- REGISTRATION LOGS FOR ${userId} ---`);
    const snap = await db.collection('audit_logs')
        .where('type', '==', 'token_registration')
        .orderBy('timestamp', 'desc')
        .get();

    let count = 0;
    snap.forEach(d => {
        const data = d.data();
        if (data.details?.userId === userId) {
            console.log(`[${data.timestamp?.toDate?.().toLocaleString()}] ${data.summary}`);
            console.log(`- Token: ${data.details?.token}`);
            count++;
        }
    });
    console.log(`Found ${count} total registration logs for this user.`);
}

checkUserLogs('RFnE43gw9ng1mfJSADnRQ12uFTx2')
    .then(() => process.exit(0))
    .catch(err => { console.error(err); process.exit(1); });
