const admin = require('firebase-admin');

// Initialize Firebase Admin
const creds = require('../service-account.json');

admin.initializeApp({
    credential: admin.credential.cert(creds)
});

const db = admin.firestore();

async function run() {
    try {
        console.log("Running broad query...");
        const creditsSnap = await db.collectionGroup('points_history')
            .where('remainingPoints', '>', 0)
            .get();
        console.log(`Query successful, found ${creditsSnap.size} documents.`);

        creditsSnap.forEach(doc => {
            console.log(doc.id, "=>", doc.data());
        });
    } catch (error) {
        console.error("Error executing query:");
        console.error(error);
    }
}

run();
