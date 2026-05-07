
const admin = require('firebase-admin');

async function inspect() {
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) {
        console.log("GOOGLE_CREDENTIALS_JSON missing in terminal");
        return;
    }
    const sa = JSON.parse(raw);
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    const db = admin.firestore();

    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data();
    
    console.log("--- CONFIG MESSAGING ---");
    console.log("Push Enabled:", config.messaging?.pushEnabled);
    console.log("Email Enabled:", config.messaging?.emailEnabled);
    console.log("Inbox Enabled:", config.messaging?.inboxEnabled);
    console.log("WhatsApp Enabled:", config.messaging?.whatsappEnabled);
    
    console.log("\n--- SIMULATION ---");
    console.log("Date Simulator Enabled:", config.enableDateSimulator);
    console.log("Simulated Offset Days:", config.simulatedOffsetDays);
    
    process.exit(0);
}

inspect();
