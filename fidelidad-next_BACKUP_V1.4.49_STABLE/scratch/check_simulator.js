
import admin from 'firebase-admin';
import fs from 'fs';

async function run() {
    let credsRaw = "";
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        const match = env.match(/GOOGLE_CREDENTIALS_JSON=(.*)/);
        if (match) credsRaw = match[1].trim();
    } catch (e) {}

    if (!credsRaw) process.exit(1);
    let creds = JSON.parse(credsRaw.replace(/\\n/g, "\n"));

    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(creds) });
    const db = admin.firestore();
    
    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data() || {};
    
    console.log("--- ESTADO DEL SIMULADOR ---");
    console.log("Activado (enableDateSimulator):", config.enableDateSimulator);
    console.log("Desfase de días (simulatedOffsetDays):", config.simulatedOffsetDays);
    console.log("Días de aviso configurados:", config.messaging?.expirationWarningDays);
}

run().catch(console.error);
