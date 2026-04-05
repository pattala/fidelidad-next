
const admin = require('firebase-admin');
const fs = require('fs');

async function run() {
    const creds = JSON.parse(fs.readFileSync('./service-account.json', 'utf-8'));

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(creds)
        });
    }

    const db = admin.firestore();
    
    console.log("--- RECENT USERS ---");
    const userSnap = await db.collection('users').orderBy('lastActive', 'desc').limit(5).get();
    userSnap.forEach(d => {
        const data = d.data();
        const lastActiveStr = data.lastActive ? (data.lastActive.toDate ? data.lastActive.toDate().toISOString() : 'no-toDate') : 'null';
        console.log(`ID: ${d.id}, Name: ${data.name || data.nombre || 'anon'}, fcmState: ${data.fcmState || 'undef'}, fcmToken: ${data.fcmToken ? 'SET' : 'MISSING'}, lastActive: ${lastActiveStr}, lastError: ${data.lastError || data.lastFcmError || 'none'}`);
    });

    console.log("\n--- RECENT AUDIT LOGS (TOKEN) ---");
    const snap = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();

    snap.docs.forEach(doc => {
        const data = doc.data();
        if (data.type === 'token_registration' || data.summary?.toLowerCase().includes('token')) {
            const tsStr = data.timestamp ? (data.timestamp.toDate ? data.timestamp.toDate().toISOString() : 'no-toDate') : 'null';
            console.log(`[${tsStr}] ${data.summary} - Status: ${data.status} - Executor: ${data.executor}`);
        }
    });
}

run().catch(console.error);
