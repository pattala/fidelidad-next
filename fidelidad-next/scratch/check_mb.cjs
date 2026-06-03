const admin = require('firebase-admin');
const serviceAccount = require('./serviceAccountKey.json');

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
    });
}
const db = admin.firestore();

async function checkMB() {
    const mbSnapshot = await db.collection('mystery_box_chances').where('status', '==', 'pending').get();
    console.log("Pending Mystery Boxes:", mbSnapshot.size);
    mbSnapshot.docs.forEach(doc => {
        const data = doc.data();
        console.log(`ID: ${doc.id}, User: ${data.userName}, Phone: "${data.phone}", Telefono: "${data.telefono}"`);
    });
    process.exit(0);
}
checkMB();
