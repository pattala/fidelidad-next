import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const saPath = path.join(__dirname, '../service-account.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa),
    });
}

const db = admin.firestore();

// Cuentas a limpiar de la colección 'admins'
const MASTERS_TO_CLEAN = [
    'pablo_attala@yahoo.com.ar',
    'admin@admin.com'
];

async function resetAdmins() {
    console.log("🚀 Iniciando limpieza de administradores para modo Bootstrap...");
    
    try {
        const adminsRef = db.collection('admins');
        const snapshot = await adminsRef.get();
        
        let cleaned = 0;
        
        for (const doc of snapshot.docs) {
            const data = doc.data();
            const email = data.email?.toLowerCase();
            
            if (MASTERS_TO_CLEAN.includes(email)) {
                console.log(`🗑️ Eliminando registro redundante: ${email} (${doc.id})`);
                await doc.ref.delete();
                cleaned++;
            }
        }
        
        console.log(`✅ Limpieza completada. ${cleaned} registros eliminados.`);
        console.log("ℹ️ El sistema ahora entrará en modo Bootstrap (admin@admin activo hasta que se cree un nuevo admin).");
        
    } catch (error) {
        console.error("❌ Error durante la limpieza:", error);
    }
}

resetAdmins();
