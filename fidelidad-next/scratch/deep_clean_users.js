
import admin from "firebase-admin";
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const raw = process.env.GOOGLE_CREDENTIALS_JSON;
if (!raw) {
    console.error("ERROR: GOOGLE_CREDENTIALS_JSON not found.");
    process.exit(1);
}

let sa;
try {
    sa = JSON.parse(raw);
} catch (e) {
    try {
        const cleaned = raw.replace(/\\n/g, "\\\\n").replace(/\n/g, "\\n");
        sa = JSON.parse(cleaned);
    } catch (e2) {
        const fixedRaw = raw.replace(/\r?\n|\r/g, "\\n");
        sa = JSON.parse(fixedRaw);
    }
}

if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

/**
 * Borra una colección o subcolección recursivamente
 */
async function deleteCollection(collectionRef, batchSize = 100) {
    const query = collectionRef.limit(batchSize);
    
    return new Promise((resolve, reject) => {
        deleteQueryBatch(db, query, resolve).catch(reject);
    });
}

async function deleteQueryBatch(db, query, resolve) {
    const snapshot = await query.get();

    if (snapshot.size === 0) {
        resolve();
        return;
    }

    const batch = db.batch();
    snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
    });

    await batch.commit();

    // Recursividad para el siguiente lote
    process.nextTick(() => {
        deleteQueryBatch(db, query, resolve);
    });
}

async function deepCleanUsers() {
    console.log("Iniciando limpieza profunda de la colección 'users'...");
    
    // Firestore no permite listar subcolecciones de documentos que no existen fácilmente desde el SDK de cliente,
    // pero desde Admin SDK podemos usar listCollections() en las referencias de documentos.
    // Sin embargo, para encontrar los "fantasmas", necesitamos listar todas las referencias.
    
    const collections = await db.collection('users').listDocuments();
    console.log(`Encontrados ${collections.length} IDs (incluyendo documentos borrados con subcolecciones).`);

    for (const docRef of collections) {
        const subcollections = await docRef.listCollections();
        for (const sub of subcollections) {
            console.log(`  Borrando subcolección '${sub.id}' del usuario ${docRef.id}...`);
            await deleteCollection(sub);
        }
        // Borrar el documento principal por si acaso existe
        await docRef.delete();
        console.log(`  ID ${docRef.id} limpiado.`);
    }

    console.log("Limpieza de 'users' completada.");
}

deepCleanUsers()
    .then(() => process.exit(0))
    .catch(err => {
        console.error(err);
        process.exit(1);
    });
