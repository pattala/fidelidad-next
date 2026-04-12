
import admin from 'firebase-admin';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const saPath = path.join(__dirname, '../service-account.json');
const sa = JSON.parse(fs.readFileSync(saPath, 'utf8'));

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const auth = admin.auth();
const db = admin.firestore();

async function setFixedMasterKeys() {
    const masters = [
        { email: "pablo_attala@yahoo.com.ar", name: "Pablo Attala", pass: "Felipe01" },
        { email: "admin@admin.com", name: "Admin Maestro", pass: "Felipe01" }
    ];

    console.log('--- RECONFIGURANDO CLAVES MAESTRAS FIJAS ---');

    for (const m of masters) {
        let user;
        try {
            user = await auth.getUserByEmail(m.email);
            console.log(`Actualizando ${m.email} con clave: ${m.pass}`);
            await auth.updateUser(user.uid, { password: m.pass });
        } catch (e) {
            console.log(`Creando master ${m.email} con clave: ${m.pass}`);
            user = await auth.createUser({
                email: m.email,
                password: m.pass,
                displayName: m.name
            });
        }

        // Marcar en la base SOLO como admin
        const payload = {
            email: m.email,
            name: m.name,
            role: 'admin',
            active: true,
            uid: user.uid,
            isMaster: true,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        // 1. Guardar en 'admins' para el login de panel
        await db.collection('admins').doc(user.uid).set(payload, { merge: true });
        
        // 2. ELIMINAR de 'users' para que no aparezca en métricas ni listados
        await db.collection('users').doc(user.uid).delete();
        
        console.log(`OK: ${m.email} configurado como ADMIN puro.`);
    }
}

setFixedMasterKeys().catch(console.error);
