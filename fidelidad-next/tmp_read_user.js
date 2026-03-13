import admin from 'firebase-admin';
import { readFile } from 'fs/promises';

const serviceAccount = JSON.parse(
  await readFile(new URL('./service-account.json', import.meta.url))
);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}

const db = admin.firestore();

async function checkSpecificUser() {
    const userId = 'RFnE43gw9ng1mfJSADnRQ12uFTx2';
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) {
        console.log('User not found');
    } else {
        console.log(JSON.stringify(doc.data(), null, 2));
    }
}

checkSpecificUser().then(() => process.exit(0)).catch(err => {
    console.error(err);
    process.exit(1);
});
