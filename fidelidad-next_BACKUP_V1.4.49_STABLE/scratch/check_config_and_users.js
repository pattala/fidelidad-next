
import admin from 'firebase-admin';
import fs from 'fs';

async function run() {
    let credsRaw = "";
    try {
        const env = fs.readFileSync('.env.local', 'utf8');
        // Handle potential quotes and multi-line if needed, but usually it's one line in .env.local
        const match = env.match(/GOOGLE_CREDENTIALS_JSON=(.*)/);
        if (match) {
            credsRaw = match[1].trim();
            if (credsRaw.startsWith("'") || credsRaw.startsWith('"')) {
                credsRaw = credsRaw.substring(1, credsRaw.length - 1);
            }
        }
    } catch (e) {
        console.error("Error reading .env.local:", e.message);
    }

    if (!credsRaw) {
        console.error("GOOGLE_CREDENTIALS_JSON missing");
        process.exit(1);
    }

    let creds;
    try {
        creds = JSON.parse(credsRaw);
    } catch (e) {
        // Try unescaping newlines
        creds = JSON.parse(credsRaw.replace(/\\n/g, "\n"));
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(creds)
        });
    }

    const db = admin.firestore();
    
    console.log("--- CONFIGURACIÓN ---");
    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data() || {};
    console.log("Días de aviso (expirationWarningDays):", config.messaging?.expirationWarningDays);
    console.log("Puntos Cumpleaños:", config.birthdayPoints);

    console.log("\n--- BUSCANDO A PABLO ---");
    const usersSnap = await db.collection('users').where('name', '>=', 'Pablo').where('name', '<=', 'Pablo\uf8ff').get();
    if (usersSnap.empty) {
        console.log("No se encontró a Pablo.");
    } else {
        usersSnap.docs.forEach(doc => {
            const u = doc.data();
            console.log(`ID: ${doc.id}`);
            console.log(`Nombre: ${u.name}`);
            console.log(`Vencimiento: ${u.nextExpirationDate}`);
            console.log(`Puntos: ${u.points}`);
            console.log(`Detalles Vencimiento:`, JSON.stringify(u.expirationDetails || []));
            console.log(`Cumpleaños: ${u.birthDate || u.fechaNacimiento}`);
        });
    }

    const todayAR = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' });
    console.log("\nFecha hoy (Argentina):", todayAR);
}

run().catch(console.error);
