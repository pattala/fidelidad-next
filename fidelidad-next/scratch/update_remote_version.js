import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config({ path: '.env.local' });

if (!admin.apps.length) {
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
    let creds;
    try { 
        creds = JSON.parse(credsRaw); 
    } catch { 
        // Limpiar saltos de línea literales y otros caracteres de control que rompen JSON.parse
        const fixed = credsRaw.replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
        creds = JSON.parse(fixed); 
    }
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: creds.project_id,
            clientEmail: creds.client_email,
            privateKey: creds.private_key?.replace(/\\n/g, "\n"),
        }),
    });
}

const db = admin.firestore();

async function updateRemoteVersion() {
    const version = "V.1.4.52";
    await db.collection('config').doc('general').update({
        latestVersion: version
    });
    console.log(`Versión remota actualizada a ${version} en Firestore.`);
}

updateRemoteVersion().catch(console.error);
