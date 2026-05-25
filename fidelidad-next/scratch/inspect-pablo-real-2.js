import admin from " firebase-admin\;
import fs from \fs\;
const raw = JSON.parse(fs.readFileSync(\c:/Users/pablo/.gemini/antigravity/playground/azure-shuttle/fidelidad-next/.dev_creds.json\,\utf8\));
const sa = JSON.parse(raw.credentials);
if (!admin.apps.length) admin.initializeApp({ credential: admin.credential.cert(sa) });
const db = admin.firestore();
const userId = \mcmZ3EOy4BZZ0pqBR4pCcKDBoQN2\;
db.collection(\users\).doc(userId).get().then(snap => {
 const d = snap.data();
 console.log(\Nombre:\, d.nombre || d.name);
 console.log(\Points/Puntos:\, d.points, \/\, d.puntos);
 console.log(\nextExpirationDate:\, d.nextExpirationDate);
 console.log(\nextExpirationAmount:\, d.nextExpirationAmount);
 console.log(\lastExpirationWarningDates:\, d.lastExpirationWarningDates);
 console.log(\lastBirthdayGreetingYear:\, d.lastBirthdayGreetingYear);
 console.log(\lastBirthdayPointsYear:\, d.lastBirthdayPointsYear);
});
