import admin from "firebase-admin";
import dotenv from "dotenv";
dotenv.config({ path: '.env.local' });

const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
let creds;
try {
    // Robust parsing for keys with raw newlines
    creds = JSON.parse(credsRaw);
} catch (e) {
    // Attempt to fix escape characters if it's a stringified JSON within a string
    const fixed = credsRaw.replace(/\\n/g, '\n').replace(/\n/g, '\\n');
    try {
        creds = JSON.parse(fixed);
    } catch (e2) {
        // Last resort: if it's already a JS object-like string but not valid JSON
        console.error("Critical: Could not parse GOOGLE_CREDENTIALS_JSON");
        process.exit(1);
    }
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(creds),
    });
}

const db = admin.firestore();
const userId = "kH3Yc5kCA1NOeqnbiMijxWJXqef1";

async function cleanGhost() {
    console.log(`Buscando rastros para ${userId}...`);
    const subs = ['visit_history', 'points_history', 'inbox', 'notifications'];
    for (const subName of subs) {
        const subRef = db.collection('users').doc(userId).collection(subName);
        const snap = await subRef.get();
        if (!snap.empty) {
            console.log(`Limpiando ${snap.size} documentos en ${subName}...`);
            const batch = db.batch();
            snap.docs.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }
    }
    await db.collection('users').doc(userId).delete();
    console.log("Limpieza completada.");
}

cleanGhost().catch(console.error);
