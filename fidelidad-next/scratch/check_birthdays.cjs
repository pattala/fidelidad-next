const admin = require('firebase-admin');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

if (!admin.apps.length) {
    let credsRaw = process.env.GOOGLE_CREDENTIALS_JSON;
    let creds;
    try {
        creds = JSON.parse(credsRaw);
    } catch (e) {
        // Try fixing escaped newlines if it fails
        creds = JSON.parse(credsRaw.replace(/\\n/g, "\n"));
    }
    admin.initializeApp({
        credential: admin.credential.cert(creds),
    });
}

const db = admin.firestore();

async function run() {
    console.log("--- DEBUG BIRTHDAYS (May 11) ---");
    const usersSnap = await db.collection('users').get();
    
    const todayMD = "05-11";
    const currentYear = "2026";

    let found = 0;
    usersSnap.forEach(doc => {
        const data = doc.data();
        const bDate = data.birthDate;
        if (!bDate) return;

        let normalized = bDate;
        const separator = bDate.includes('/') ? '/' : (bDate.includes('-') ? '-' : null);
        if (separator) {
            const parts = bDate.split(separator).map(p => p.trim());
            if (parts.length >= 2) {
                let day, month;
                if (parts[0].length === 4) { month = parts[1]; day = parts[2]; }
                else { day = parts[0]; month = parts[1]; }
                if (day && month) normalized = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
            }
        }

        if (normalized === todayMD) {
            found++;
            console.log(`USUARIO: ${data.nombre || data.name || 'Sin nombre'} (${doc.id})`);
            console.log(`- birthDate en DB: "${bDate}"`);
            console.log(`- Normalizado a: "${normalized}"`);
            console.log(`- lastGreetingYear: "${data.lastBirthdayGreetingYear}"`);
            console.log(`- Puntos: ${data.points || 0}`);
            console.log("-----------------------------------");
        }
    });

    if (found === 0) console.log("No se encontraron usuarios con cumpleaños hoy (05-11) en la base de datos.");
    process.exit(0);
}

run().catch(e => {
    console.error(e);
    process.exit(1);
});
