import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import fs from 'fs';

const serviceAccount = JSON.parse(fs.readFileSync('firebase-admin-key.json', 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function main() {
  const doc = await db.collection('config').doc('general').get();
  console.log(JSON.stringify(doc.data().mysteryBox, null, 2));
  process.exit(0);
}

main();
