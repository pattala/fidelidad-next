const admin = require("firebase-admin");
const serviceAccount = require("./service-account.json");
admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
const db = admin.firestore();

async function check() {
    const snap = await db.collection("mystery_box_chances").get();
    console.log("Total chances:", snap.size);
    snap.forEach(doc => {
        console.log(doc.id, doc.data().clientId, doc.data().clientDni, doc.data().status, doc.data().expiresAt ? doc.data().expiresAt.toDate() : "No expires");
    });
}
check();