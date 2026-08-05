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

console.log(`\n📦 RESPALDO FIRESTORE | Entorno: ${envName.toUpperCase()}\n`);

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

async function runBackup() {
    const collections = ['users', 'config', 'prizes', 'campanas', 'branches', 'mystery_box_chances', 'system_notifications'];
    const backupData = {
        metadata: {
            environment: envName,
            createdAt: new Date().toISOString(),
            collectionsCount: collections.length,
        },
        collections: {},
    };

    for (const colName of collections) {
        process.stdout.write(`   • Exportando colección '${colName}'... `);
        const snap = await db.collection(colName).get();
        backupData.collections[colName] = snap.docs.map(doc => ({
            id: doc.id,
            data: doc.data(),
        }));
        console.log(`✅ (${snap.docs.length} documentos)`);
    }

    const backupDir = path.resolve(__dirname, '../backups');
    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `backup-${envName.toUpperCase()}-${dateStr}_${Date.now()}.json`;
    const filePath = path.join(backupDir, filename);

    fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf8');

    console.log(`\n🎉 Resguardo completado con éxito!`);
    console.log(`📁 Guardado en: ${filePath}\n`);
}

runBackup().catch(err => {
    console.error(`❌ Error durante el respaldo:`, err);
    process.exit(1);
});
