const admin = require('firebase-admin');
const fs = require('fs');

const envContent = fs.readFileSync('.env.local', 'utf8');
const match = envContent.match(/GOOGLE_CREDENTIALS_JSON="(.*)"/);
if (!match) {
    console.error("No se encontró GOOGLE_CREDENTIALS_JSON en .env.local");
    process.exit(1);
}

// El JSON en .env.local puede tener escapes.
let raw = match[1];
// Reemplazar escapes si es necesario (el regex capturó lo que está entre comillas)
// Pero en .env.local de Vercel, a veces están escapados los "
try {
    // Intentar parsear tal cual
    const sa = JSON.parse(raw.replace(/\\"/g, '"').replace(/\\\\n/g, '\\n'));
    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(sa)
        });
    }
} catch (e) {
    console.error("Error al parsear JSON:", e.message);
    process.exit(1);
}

const db = admin.firestore();

async function checkAudit() {
    const snap = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
    
    const logs = snap.docs.map(d => ({ 
        id: d.id, 
        timestamp: d.data().timestamp?.toDate ? d.data().timestamp.toDate().toISOString() : d.data().timestamp,
        type: d.data().type,
        executor: d.data().executor,
        summary: d.data().summary
    }));
    console.log(JSON.stringify(logs, null, 2));
}

checkAudit();
