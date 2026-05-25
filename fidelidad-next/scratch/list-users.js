import admin from 'firebase-admin';
import fs from 'fs';
const raw = JSON.parse(fs.readFileSync('.dev_creds.json','utf8'));
const sa = JSON.parse(raw.credentials);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const snap = await db.collection('users').get();
console.log(`Total usuarios: ${snap.size}`);
snap.forEach(d => {
    const data = d.data();
    console.log(`ID: ${d.id} | Nombre: ${data.nombre || data.name || '-'} | Email: ${data.email || '-'} | Role: ${data.role || 'cliente'}`);
});
process.exit(0);
