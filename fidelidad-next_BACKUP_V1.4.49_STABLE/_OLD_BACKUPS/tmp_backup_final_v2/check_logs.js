
import admin from 'firebase-admin';

async function run() {
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
    if (!credsRaw) {
        console.error("GOOGLE_CREDENTIALS_JSON missing");
        process.exit(1);
    }

    let creds;
    try {
        creds = JSON.parse(credsRaw);
    } catch (e) {
        creds = JSON.parse(credsRaw.replace(/\\n/g, "\n"));
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(creds)
        });
    }

    const db = admin.firestore();
    const snap = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(5)
        .get();

    if (snap.empty) {
        console.log("No logs found.");
        return;
    }

    snap.docs.forEach(doc => {
        const data = doc.data();
        console.log('---');
        console.log(`ID: ${doc.id}`);
        console.log(`Timestamp: ${data.timestamp?.toDate().toISOString()}`);
        console.log(`Type: ${data.type}`);
        console.log(`Status: ${data.status}`);
        console.log(`Summary: ${data.summary}`);
        console.log(`Executor: ${data.executor}`);
    });
}

run().catch(console.error);
