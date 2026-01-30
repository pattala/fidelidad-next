
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
// Assuming script is in /scripts, .env is in root ../
dotenv.config({ path: path.join(__dirname, '../.env') });

async function resetAdmins() {
    console.log("Iniciando reseteo de administradores...");

    if (!process.env.GOOGLE_CREDENTIALS_JSON) {
        console.error("ERROR: Falta GOOGLE_CREDENTIALS_JSON en .env");
        console.error("Asegurese de tener el archivo .env en la raiz del proyecto.");
        process.exit(1);
    }

    let creds;
    try {
        creds = JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON);
    } catch (e) {
        console.error("ERROR: GOOGLE_CREDENTIALS_JSON no es un JSON vÃ¡lido.");
        process.exit(1);
    }

    if (!getApps().length) {
        initializeApp({
            credential: cert(creds)
        });
    }

    const db = getFirestore();
    const adminsCol = db.collection('admins');
    const snapshot = await adminsCol.get();

    if (snapshot.empty) {
        console.log("No hay administradores para borrar. El sistema ya deberia estar en modo Setup.");
        return;
    }

    console.log(`Encontrados ${snapshot.size} administradores. Eliminando...`);

    const batch = db.batch();
    snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
        console.log(` - Borrando: ${doc.id} (${doc.data().email})`);
    });

    await batch.commit();
    console.log(`\n LISTO: Se eliminaron ${snapshot.size} administradores.`);
    console.log("Ahora refresca la pagina de Login para ver la pantalla de 'Configuracion de Sistema'.");
}

resetAdmins().catch(console.error);
