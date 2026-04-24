
import admin from 'firebase-admin';

async function checkUsers() {
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    const sa = JSON.parse(raw);
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    const db = admin.firestore();
    
    console.log("--- Checking Users Birthday Fields ---");
    const users = await db.collection('users').limit(5).get();
    users.forEach(doc => {
        const data = doc.data();
        console.log(`User: ${data.nombre || data.name || doc.id}`);
        console.log(`  birthDate: ${data.birthDate}`);
        console.log(`  fechaNacimiento: ${data.fechaNacimiento}`);
    });

    console.log("\n--- Checking Config Simulation ---");
    const config = await db.collection('config').doc('general').get();
    console.log("Simulation Config:", JSON.stringify(config.data().simulationConfig, null, 2));
    console.log("Simulated Offset Days:", config.data().simulatedOffsetDays);
}

checkUsers().catch(console.error);
