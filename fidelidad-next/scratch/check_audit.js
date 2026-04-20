import admin from 'firebase-admin';
import * as fs from 'fs';

const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
const creds = JSON.parse(credsRaw);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(creds),
    });
}

const db = admin.firestore();

async function checkAudit() {
    console.log("Checking recent audit logs...");
    const snap = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();
    
    const logs = [];
    snap.forEach(doc => logs.push({ id: doc.id, ...doc.data() }));
    console.log(JSON.stringify(logs, null, 2));
}

checkAudit().catch(console.error);
