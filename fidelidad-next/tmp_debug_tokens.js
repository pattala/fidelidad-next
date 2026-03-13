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

async function debugTokens() {
    console.log('--- AUDITING RECENTLY UPDATED USERS ---');
    const usersSnap = await db.collection('users')
        .orderBy('lastActive', 'desc')
        .limit(5)
        .get();

    if (usersSnap.empty) {
        console.log('No users found.');
    } else {
        usersSnap.forEach(doc => {
            const data = doc.data();
            console.log(`User ID: ${doc.id}`);
            console.log(`- Email: ${data.email || 'N/A'}`);
            console.log(`- Name: ${data.name || data.nombre || 'N/A'}`);
            console.log(`- Last Active: ${data.lastActive?.toDate?.() || 'N/A'}`);
            console.log(`- fcmToken (primary): ${data.fcmToken ? (data.fcmToken.substring(0, 15) + '...') : 'NULL'}`);
            console.log(`- fcmTokens (array): ${data.fcmTokens ? data.fcmTokens.length : 0} tokens`);
            if (data.fcmTokens) {
                data.fcmTokens.forEach((t, i) => console.log(`  [${i}] ${t.substring(0, 15)}...`));
            }
            console.log(`- Notifications Config:`, JSON.stringify(data.permissions?.notifications || {}, null, 2));
            console.log(`- Mobile Status: ${data.permissions?.notifications?.mobile_status || 'N/A'}`);
            console.log(`- PC Status: ${data.permissions?.notifications?.pc_status || 'N/A'}`);
            console.log(`- Active Platforms: ${JSON.stringify(data.permissions?.notifications?.platforms || [])}`);
            console.log('-----------------------------------');
        });
    }

    console.log('\n--- AUDITING RECENT AUDIT LOGS (Push Failures) ---');
    const logsSnap = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    logsSnap.forEach(doc => {
        const data = doc.data();
        if (data.type === 'push_notification' || data.type === 'campaign_broadcast') {
            console.log(`[${data.timestamp?.toDate?.().toLocaleTimeString()}] ${data.summary}`);
            console.log(`- Type: ${data.type} | Status: ${data.status}`);
            if (data.details && Array.isArray(data.details)) {
                const failures = data.details.filter(d => d.success === false);
                if (failures.length > 0) {
                    failures.slice(0, 2).forEach(f => console.log(`  * FAIL: ${f.token.substring(0, 8)}... Code: ${f.errorCode}`));
                }
            } else if (data.details) {
                 console.log(`- Details:`, JSON.stringify(data.details).substring(0, 100));
            }
            console.log('---');
        }
    });
}

debugTokens().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
