// test-expirations.js
import admin from 'firebase-admin';
import fs from 'fs';

// Inicializar Firebase
const credsRaw = fs.readFileSync('service-account.json', 'utf8');
const creds = JSON.parse(credsRaw);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(creds)
    });
}

const db = admin.firestore();

async function runTest() {
    const referenceDateStr = new Date().toISOString().split('T')[0];
    const proactivePinStr = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
    const warningDateStr = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0];
    const startOfToday = new Date();
    startOfToday.setHours(0, 0, 0, 0);

    const proactiveSnap = await db.collection('users')
        .where('nextExpirationDate', '<=', proactivePinStr)
        .where('nextExpirationDate', '>', referenceDateStr)
        .get();

    console.log(`Found ${proactiveSnap.docs.length} users with nextExpirationDate between ${referenceDateStr} and ${proactivePinStr}`);

    for (const doc of proactiveSnap.docs) {
        const userData = doc.data();
        console.log(`\nEvaluating User: ${doc.id} | Role: ${userData.role} | Name: ${userData.name}`);
        console.log(`- lastWhatsAppManualDate: ${userData.lastWhatsAppManualDate}`);
        console.log(`- lastExpirationNotice: ${userData.lastExpirationNotice}`);

        const userPoints = userData.points || 0;
        if (userPoints <= 0 && (userData.nextExpirationAmount || 0) <= 0) {
            console.log(`- Skipped: No points (${userPoints})`);
            continue;
        }

        if (userData.lastWhatsAppManualDate === referenceDateStr) {
            console.log(`- Skipped: Handled today manually (${userData.lastWhatsAppManualDate})`);
            continue;
        }

        // Dashboard filter:
        const isGhost = !userData.name && !userData.nombre && !userData.dni;
        if (userData.role === 'admin' || isGhost) {
            console.log(`- DASHBOARD WOULD HIDE THIS USER (role=${userData.role}, ghost=${isGhost})`);
        }

        const historyRef = doc.ref.collection('points_history');
        const impendingCreditsSnap = await historyRef
            .where('type', '==', 'credit')
            .where('expiresAt', '>', admin.firestore.Timestamp.fromDate(startOfToday))
            .get();

        let totalImpendingAmount = 0;
        impendingCreditsSnap.forEach(d => {
            const data = d.data();
            if (data.status === 'expired') return;
            const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
            if (rem > 0) totalImpendingAmount += rem;
        });

        console.log(`- Impending Amount: ${totalImpendingAmount}`);

        if (totalImpendingAmount <= 0) {
            console.log(`- Skipped: No valid impending credits`);
            continue;
        }

        console.log(`>>> WOULD INCREMENT totalInWindow FOR THIS USER <<<`);
    }
}

runTest().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
