
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const saPath = path.join(__dirname, '..', '_OLD_BACKUPS', 'DEPURACION_FINA_MAYO', 'service-account.json');

if (!fs.existsSync(saPath)) {
    console.error('Error: No se encontró el archivo de credenciales en:', saPath);
    process.exit(1);
}

const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function audit() {
    try {
        console.log('--- REPORTE TÉCNICO DE LIMPIEZA V.1.4.6 ---');
        
        const usersSnap = await db.collection('users').get();
        const clients = usersSnap.docs.filter(d => d.data().role === 'client');
        console.log('Socios (Clientes) en DB:', clients.length);
        
        const transactionsSnap = await db.collection('transactions').get();
        console.log('Transacciones totales en tabla global:', transactionsSnap.size);
        
        const auditSnap = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(5).get();
        console.log('--- ÚLTIMOS LOGS DE ACTIVIDAD ---');
        auditSnap.forEach(d => {
            const data = d.data();
            console.log(`- [${data.action}] ${data.details || ''} (${data.timestamp?.toDate().toLocaleString() || 'sin fecha'})`);
        });

        if (clients.length === 0 && transactionsSnap.size === 0) {
            console.log('\n✅ RESULTADO: El sistema está 100% PURGADO de datos de socios.');
        } else {
            console.log('\n⚠️ AVISO: Aún detecto registros en la base de datos.');
        }
    } catch (e) {
        console.error('Error en auditoría:', e.message);
    }
    process.exit(0);
}
audit();
