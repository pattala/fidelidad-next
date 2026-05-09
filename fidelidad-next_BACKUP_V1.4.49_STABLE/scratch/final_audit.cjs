
const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const saPath = path.join(__dirname, '..', '_OLD_BACKUPS', 'DEPURACION_FINA_MAYO', 'service-account.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));
admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

async function audit() {
    try {
        console.log('--- AUDITORÍA DE REGISTRO V.1.4.7 ---');
        
        const usersSnap = await db.collection('users').where('role', '==', 'client').get();
        console.log('Socios encontrados:', usersSnap.size);
        usersSnap.forEach(d => {
            const u = d.data();
            console.log(`> SOCIO: ${u.nombre || u.name} | DNI: ${u.dni} | Socio #: ${u.numeroSocio || 'Pendiente'}`);
            console.log(`  Puntos: ${u.points || 0} | Domicilio: ${u.domicilio ? 'CARGADO' : 'PENDIENTE'}`);
        });
        
        console.log('\n--- ÚLTIMOS MOVIMIENTOS DE AUDITORÍA ---');
        const auditSnap = await db.collection('audit_logs').orderBy('timestamp', 'desc').limit(3).get();
        auditSnap.forEach(d => {
            const a = d.data();
            console.log(`- [${a.type || 'SISTEMA'}] ${a.summary || 'Sin resumen'}`);
            if (a.details) console.log(`  Detalles: ${JSON.stringify(a.details)}`);
        });

    } catch (e) {
        console.error('Error:', e.message);
    }
    process.exit(0);
}
audit();
