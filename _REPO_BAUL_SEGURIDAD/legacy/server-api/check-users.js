
import admin from "firebase-admin";

const raw = process.env.GOOGLE_CREDENTIALS_JSON;
if (!raw) {
    console.error("No credentials found");
    process.exit(1);
}

const sa = JSON.parse(raw);
admin.initializeApp({
    credential: admin.credential.cert(sa),
});

const db = admin.firestore();

async function listUsers() {
    console.log("Checking 'clientes' collection...");
    const snap = await db.collection("clientes").get();
    console.log(`Found ${snap.size} documents.`);
    snap.forEach(d => {
        console.log(`- ${d.id}:`, d.data());
    });
}

listUsers();
