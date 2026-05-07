
const admin = require('firebase-admin');

async function checkNotifications() {
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) return console.log("Missing credentials");
    const sa = JSON.parse(raw);
    if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
    const db = admin.firestore();

    console.log("--- ÚLTIMAS NOTIFICACIONES ENVIADAS (AUDITORÍA) ---");
    // Buscamos en audit_logs del día de hoy
    const todayStr = new Date().toISOString().split('T')[0];
    const snap = await db.collection('audit_logs')
        .where('timestamp', '>=', new Date(Date.now() - 3600000)) // Última hora
        .orderBy('timestamp', 'desc')
        .limit(10)
        .get();

    if (snap.empty) {
        console.log("No se encontraron registros en la última hora.");
    }

    snap.forEach(doc => {
        const data = doc.data();
        console.log(`\n[${data.timestamp?.toDate().toLocaleTimeString()}] Type: ${data.type}`);
        if (data.details && Array.isArray(data.details)) {
            data.details.forEach(dtl => {
                console.log(` - Action: ${dtl.action}`);
                console.log(` - Info: ${dtl.info}`);
            });
        } else {
            console.log(` - Info: ${data.info || 'N/A'}`);
        }
    });
    
    process.exit(0);
}

checkNotifications();
