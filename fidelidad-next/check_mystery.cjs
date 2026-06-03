const admin = require('firebase-admin');
const fs = require('fs');

async function main() {
    try {
        const raw = fs.readFileSync('./api/firebase-service-account.json', 'utf8');
        const sa = JSON.parse(raw);
        admin.initializeApp({ credential: admin.credential.cert(sa) });
    } catch (err) {
        console.error("Could not load credentials:", err.message);
        return;
    }
    const db = admin.firestore();

    const chances = await db.collection('mystery_box_chances').orderBy('createdAt', 'desc').limit(5).get();
    
    console.log(`Found ${chances.size} recent mystery boxes.`);
    
    for (const doc of chances.docs) {
        const data = doc.data();
        console.log(`\nBox ID: ${doc.id}`);
        console.log(`- clientId: ${data.clientId}`);
        console.log(`- status: ${data.status}`);
        console.log(`- createdAt: ${data.createdAt ? data.createdAt.toDate() : 'null'}`);
        
        // Fetch the user
        const userSnap = await db.collection('users').doc(data.clientId).get();
        if (userSnap.exists) {
            const userData = userSnap.data();
            console.log(`- User Data: name=${userData.name || userData.nombre}, dni=${userData.dni}, email=${userData.email || 'N/A'}`);
        } else {
            console.log(`- User: NOT FOUND IN FIRESTORE`);
        }
    }
}

main().catch(console.error);