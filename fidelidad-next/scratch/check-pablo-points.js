import admin from 'firebase-admin';
import fs from 'fs';
const raw = JSON.parse(fs.readFileSync('c:/Users/pablo/.gemini/antigravity/playground/azure-shuttle/fidelidad-next/.dev_creds.json','utf8'));
const sa = JSON.parse(raw.credentials);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();

const userId = '0ObNWynCViNlmCXYDq1DejN2mdJ2';
const userSnap = await db.collection('users').doc(userId).get();
if (!userSnap.exists) {
    console.log("User not found!");
    process.exit(1);
}
const userData = userSnap.data();
console.log("=== USER METADATA ===");
console.log(`Nombre: ${userData.nombre || userData.name}`);
console.log(`Points/Puntos: ${userData.points} / ${userData.puntos}`);
console.log(`nextExpirationDate: ${userData.nextExpirationDate}`);
console.log(`nextExpirationAmount: ${userData.nextExpirationAmount}`);
console.log(`expirationDetails:`, JSON.stringify(userData.expirationDetails, null, 2));

console.log("\n=== POINTS HISTORY CREDIT ITEMS ===");
const historySnap = await db.collection('users').doc(userId).collection('points_history').where('type', '==', 'credit').get();
historySnap.forEach(doc => {
    const data = doc.data();
    console.log(`ID: ${doc.id} | Amount: ${data.amount} | Remaining: ${data.remainingPoints} | Concept: ${data.concept} | Date: ${data.date?.toDate().toISOString()} | ExpiresAt: ${data.expiresAt?.toDate().toISOString()} | Status: ${data.status}`);
});

process.exit(0);
