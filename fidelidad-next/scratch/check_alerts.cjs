const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function check() {
    const today = new Date();
    const argTime = new Date(today.toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"}));
    const y = argTime.getFullYear();
    const m = String(argTime.getMonth() + 1).padStart(2, '0');
    const d = String(argTime.getDate()).padStart(2, '0');
    const todayStr = `${y}-${m}-${d}`;

    console.log("Checking for date:", todayStr);

    const paSnap = await db.collection('audit_logs')
        .where('type', '==', 'points_assignment')
        .get();

    let count = 0;
    paSnap.forEach(doc => {
        const data = doc.data();
        const dtl = data.details?.find(x => x.action === 'points_credited');
        if (dtl) {
            let dStr = dtl.timestamp ? dtl.timestamp.split('T')[0] : '';
            if (dStr === todayStr) {
                console.log("Found PA for today:", doc.id, dtl);
                count++;
            }
        }
    });
    console.log("Total PA:", count);

    const bSnap = await db.collection('users')
        .where('status', '==', 'active')
        .where('dob_month', '==', m)
        .where('dob_day', '==', d)
        .get();
    console.log("Total Birthdays:", bSnap.size);

    const eSnap = await db.collection('users')
        .where('status', '==', 'active')
        .where('nextExpirationDate', '==', todayStr)
        .get();
    console.log("Total Expirations:", eSnap.size);
    
    process.exit(0);
}
check();
