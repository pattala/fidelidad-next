const admin = require('firebase-admin');
const fs    = require('fs');
const path  = require('path');

const args       = process.argv.slice(2);
const envArg     = args.find(a => a.startsWith('--env='));
const credsArg   = args.find(a => a.startsWith('--creds='));
const backupArg  = args.find(a => a.startsWith('--file='));
const envName    = envArg  ? envArg.split('=')[1]  : 'dev';
const credsFile  = credsArg
    ? path.resolve(process.cwd(), credsArg.split('=')[1])
    : path.resolve(__dirname, `../.${envName}_creds.json`);

if (!backupArg) {
    console.error(`❌ Error: Debes especificar el archivo de backup a restaurar con --file=backups/nombre.json`);
    process.exit(1);
}

const backupPath = path.resolve(process.cwd(), backupArg.split('=')[1]);
if (!fs.existsSync(backupPath)) {
    console.error(`❌ Error: No se encontró el archivo de backup en: ${backupPath}`);
    process.exit(1);
}

console.log(`\n📥 RESTAURACIÓN DE FIRESTORE | Entorno: ${envName.toUpperCase()}`);
console.log(`📄 Archivo origen: ${path.basename(backupPath)}\n`);

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

async function runRestore() {
    const rawBackup = fs.readFileSync(backupPath, 'utf8');
    const backup = JSON.parse(rawBackup);

    if (!backup.collections) {
        console.error(`❌ Estructura de backup inválida. No se encontraron colecciones.`);
        process.exit(1);
    }

    for (const [colName, docs] of Object.entries(backup.collections)) {
        process.stdout.write(`   • Restaurando colección '${colName}'... `);
        let count = 0;
        
        // Procesar en lotes de 400 documentos para no exceder límites de batch
        for (let i = 0; i < docs.length; i += 400) {
            const chunk = docs.slice(i, i + 400);
            const batch = db.batch();
            chunk.forEach(docItem => {
                const docRef = db.collection(colName).doc(docItem.id);
                batch.set(docRef, docItem.data, { merge: true });
                count++;
            });
            await batch.commit();
        }
        console.log(`✅ (${count} documentos restaurados)`);
    }

    console.log(`\n🎉 Restauración de base de datos finalizada con éxito!\n`);
}

runRestore().catch(err => {
    console.error(`❌ Error durante la restauración:`, err);
    process.exit(1);
});
