const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const args      = process.argv.slice(2);
const envArg    = args.find(a => a.startsWith('--env='));
const credsArg  = args.find(a => a.startsWith('--creds='));
const envName   = envArg  ? envArg.split('=')[1]  : 'dev';
const credsFile = credsArg
    ? path.resolve(process.cwd(), credsArg.split('=')[1])
    : path.resolve(__dirname, `../.${envName}_creds.json`);

console.log(`\n🧹 LIMPIEZA & MANTENIMIENTO FIRESTORE | Entorno: ${envName.toUpperCase()}\n`);

let creds;
try {
    const raw = fs.readFileSync(credsFile, 'utf8');
    const parsed = JSON.parse(raw);
    creds = parsed.credentials
        ? (typeof parsed.credentials === 'string' ? JSON.parse(parsed.credentials) : parsed.credentials)
        : parsed;
} catch (e) {
    console.error(`❌ Error al cargar ${path.basename(credsFile)}:`, e.message);
    process.exit(1);
}

if (!admin.apps.length) {
    const projectId   = creds.project_id   || creds.projectId;
    const clientEmail = creds.client_email || creds.clientEmail;
    const privateKey  = (creds.private_key || creds.privateKey || '').replace(/\\n/g, '\n');

    admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
    });
}
const db = admin.firestore();
try { db.settings({ preferRest: true }); } catch (_) {}

async function runCleanup() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 60);
    const cutoffTimestamp = admin.firestore.Timestamp.fromDate(cutoffDate);

    console.log(`   • Buscando registros anteriores a: ${cutoffDate.toISOString().split('T')[0]} (60 días atrás)...`);

    // 1. Limpieza de Mystery Box antiguas (>60 días)
    const mbxSnap = await db.collection('mystery_box_chances')
        .where('createdAt', '<', cutoffTimestamp)
        .get();

    let deletedMbx = 0;
    if (!mbxSnap.empty) {
        const batch = db.batch();
        mbxSnap.docs.forEach(doc => {
            batch.delete(doc.ref);
            deletedMbx++;
        });
        await batch.commit();
    }
    console.log(`   ✅ Chances de Mystery Box antiguas purgadas: ${deletedMbx}`);

    // 2. Limpieza de notificaciones leídas de usuarios (>60 días)
    let deletedNotifs = 0;
    const usersSnap = await db.collection('users').get();
    for (const uDoc of usersSnap.docs) {
        const notifSnap = await db.collection('users').doc(uDoc.id).collection('notifications')
            .where('createdAt', '<', cutoffTimestamp)
            .get();
        if (!notifSnap.empty) {
            const batch = db.batch();
            notifSnap.docs.forEach(d => {
                batch.delete(d.ref);
                deletedNotifs++;
            });
            await batch.commit();
        }
    }
    console.log(`   ✅ Notificaciones antiguas purgadas: ${deletedNotifs}`);

    console.log(`\n🎉 Mantenimiento y optimización de base de datos finalizados!\n`);
}

runCleanup().catch(err => {
    console.error(`❌ Error durante el mantenimiento:`, err);
    process.exit(1);
});
