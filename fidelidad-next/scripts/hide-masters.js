
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

const db = admin.firestore();

async function hideMastersFromClients() {
    const masterEmails = ['pablo_attala@yahoo.com.ar', 'admin@admin.com'];
    
    console.log('--- OCULTANDO CUENTAS MAESTRAS DE LA LISTA DE CLIENTES ---');

    for (const email of masterEmails) {
        const snap = await db.collection('users').where('email', '==', email).get();
        if (!snap.empty) {
            for (const doc of snap.docs) {
                console.log(`Eliminando ${email} de la colección 'users' (ID: ${doc.id})...`);
                await doc.ref.delete();
            }
            console.log(`OK: ${email} ya no aparecerá en la lista de clientes.`);
        } else {
            console.log(`INFO: ${email} no estaba en la colección 'users'.`);
        }
    }
    
    console.log('\nNOTA: Las cuentas siguen siendo ADMINS y pueden loguearse normalmente.');
}

hideMastersFromClients().catch(console.error);
