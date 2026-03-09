const admin = require('firebase-admin');
const creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
admin.initializeApp({ credential: admin.credential.cert(creds) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection('users').get();
    snap.forEach(doc => {
        const d = doc.data();
        console.log('--- USER:', doc.id, d.name, '---');
        console.log('puntos:', d.puntos);
        console.log('nextExpirationDate:', d.nextExpirationDate);
        console.log('lastExpirationNotice:', d.lastExpirationNotice);
        console.log('lastExpirationNoticeTargetDate:', d.lastExpirationNoticeTargetDate);
        console.log('lastExpirationNoticeAmount:', d.lastExpirationNoticeAmount);
    });

    const config = await db.collection('config').doc('general').get();
    console.log('--- CONFIG ---');
    console.log('enableDuplicateControl:', config.data().enableDuplicateControl);
    console.log('repeatExpirationWarnings:', config.data().messaging?.repeatExpirationWarnings);
    console.log('expirationReminderIntervalDays:', config.data().messaging?.expirationReminderIntervalDays);
    console.log('expirationWarningDays:', config.data().messaging?.expirationWarningDays);

    process.exit(0);
}

check().catch(e => { console.error(e); process.exit(1); });
