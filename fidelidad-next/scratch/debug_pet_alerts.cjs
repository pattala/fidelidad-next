
const admin = require('firebase-admin');
const fs = require('fs');

async function debug() {
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) {
        console.error("GOOGLE_CREDENTIALS_JSON missing");
        return;
    }
    const sa = JSON.parse(raw);
    if (!admin.apps.length) {
        admin.initializeApp({ credential: admin.credential.cert(sa) });
    }
    const db = admin.firestore();

    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data();
    console.log("--- CONFIG ---");
    console.log("Pet Module Enabled:", config.enablePetModule);
    console.log("Pet Food Alert Lead Days:", config.petFoodAlertLeadDays);

    const userSnap = await db.collection('users').where('role', '==', 'client').limit(5).get();
    console.log("\n--- CLIENTS PETS ---");
    userSnap.forEach(doc => {
        const data = doc.data();
        if (data.pets && data.pets.length > 0) {
            console.log(`\nClient: ${data.name} (${doc.id})`);
            data.pets.forEach(p => {
                const lp = p.lastPurchaseDate?.toDate ? p.lastPurchaseDate.toDate() : (p.lastPurchaseDate ? new Date(p.lastPurchaseDate) : 'N/A');
                console.log(` - Pet: ${p.name}`);
                console.log(`   Freq: ${p.frequencyDays}`);
                console.log(`   Last Purchase: ${lp}`);
                console.log(`   Last Alert Sent: ${p.lastFoodAlertDate}`);
                console.log(`   Next Alert Target: ${p.nextFoodAlertDate}`);
            });
        }
    });
}

debug();
