import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");
const rawCreds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const sa = JSON.parse(rawCreds.credentials);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa),
    });
}
const db = admin.firestore();

async function inspectInbox() {
    console.log("🔍 INSPECCIONANDO USUARIOS E INBOX EN LA BASE DE DATOS...\n");

    const usersSnap = await db.collection("users").get();
    console.log(`Total usuarios encontrados: ${usersSnap.size}`);

    for (const u of usersSnap.docs) {
        const uData = u.data();
        console.log(`👤 Usuario: ${uData.nombre || uData.name || 'Sin Nombre'} (${u.id})`);
        console.log(`   Rol: ${uData.role || 'client'}`);
        console.log(`   Teléfono: ${uData.phone || 'Ninguno'}`);
        console.log(`   Email: ${uData.email || 'Ninguno'}`);

        // Leer la subcolección 'inbox'
        const inboxSnap = await u.ref.collection("inbox").orderBy("date", "desc").limit(5).get();
        console.log(`   📥 Mensajes en Inbox (${inboxSnap.size}):`);
        
        inboxSnap.forEach(d => {
            const data = d.data();
            const dateStr = data.date?.toDate ? data.date.toDate().toLocaleString() : 'Sin Fecha';
            console.log(`      - [${dateStr}] Tipo: ${data.type} | Leído: ${data.read} | Título: ${data.title}`);
            console.log(`        Cuerpo: ${data.body}`);
        });
        console.log("----------------------------------------------------------------------");
    }
}

inspectInbox().catch(console.error);
