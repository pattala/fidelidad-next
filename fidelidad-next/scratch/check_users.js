
import admin from "firebase-admin";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const raw = process.env.GOOGLE_CREDENTIALS_JSON;
if (!raw) {
    console.error("ERROR: GOOGLE_CREDENTIALS_JSON not found in environment.");
    process.exit(1);
}

let sa;
try {
    sa = JSON.parse(raw);
} catch (e) {
    // Si falla el parseo directo, intentamos limpiar caracteres de control
    try {
        const cleaned = raw.replace(/\\n/g, "\\\\n").replace(/\n/g, "\\n");
        sa = JSON.parse(cleaned);
    } catch (e2) {
        // Otra técnica común: si el string tiene saltos de línea reales
        const fixedRaw = raw.replace(/\r?\n|\r/g, "\\n");
        sa = JSON.parse(fixedRaw);
    }
}

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function check() {
    const snap = await db.collection('users').get();
    console.log(`Total de usuarios en la base de datos: ${snap.size}`);
    if (snap.size > 0) {
        snap.forEach(doc => {
            const data = doc.data();
            console.log(`- ID: ${doc.id}, Nombre: ${data.name || data.nombre || 'N/A'}, Email: ${data.email || 'N/A'}`);
            console.log(`  Tokens FCM: ${JSON.stringify(data.fcmTokens || [])}`);
        });
    }
}

check().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
