import admin from 'firebase-admin';
import fs from 'fs';

const credsRaw = fs.readFileSync('.env.local', 'utf8').split('\n').find(l => l.startsWith('GOOGLE_CREDENTIALS_JSON=')).split('=')[1];
let creds;
try { creds = JSON.parse(credsRaw); } catch { creds = JSON.parse(credsRaw.replace(/\\n/g, '\n')); }
admin.initializeApp({
    credential: admin.credential.cert({
        projectId: creds.project_id,
        clientEmail: creds.client_email,
        privateKey: creds.private_key?.replace(/\\n/g, '\n'),
    })
});

const db = admin.firestore();
db.collection('config').doc('general').get().then(doc => {
    console.log(JSON.stringify(doc.data().messaging, null, 2));
    process.exit(0);
});
