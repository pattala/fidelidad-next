
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { readFileSync } from 'fs';
import { join } from 'path';

// Buscar service account
const serviceAccountPath = join(process.cwd(), 'service-account.json');
const serviceAccount = JSON.parse(readFileSync(serviceAccountPath, 'utf8'));

initializeApp({
  credential: cert(serviceAccount)
});

const db = getFirestore();

async function updateVersion() {
  const version = 'V.1.4.57';
  console.log(`Actualizando versión remota a ${version}...`);
  
  await db.collection('config').doc('general').set({
    latestVersion: version
  }, { merge: true });
  
  console.log('✅ Versión remota actualizada correctamente.');
  process.exit(0);
}

updateVersion().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
