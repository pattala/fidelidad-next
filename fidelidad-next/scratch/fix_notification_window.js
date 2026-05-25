import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");

if (!fs.existsSync(credsPath)) {
    console.error("Credentials file not found at:", credsPath);
    process.exit(1);
}

const rawCreds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const sa = JSON.parse(rawCreds.credentials);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa)
    });
}

const db = admin.firestore();

async function run() {
    console.log("⚙️ Corrigiendo ventana horaria de notificaciones...");

    const configDocRef = db.collection("config").doc("general");
    const snap = await configDocRef.get();
    
    if (!snap.exists) {
        console.error("❌ config/general no existe!");
        return;
    }

    const data = snap.data();
    const messaging = data.messaging || {};

    messaging.engineAllowedStartHour = 9; // 9:00 AM
    messaging.engineAllowedEndHour = 21;   // 9:00 PM

    await configDocRef.update({
        messaging: messaging
    });

    console.log("✅ Ventana horaria de notificaciones corregida: 09:00 a 21:00 hs.");
}

run().catch(console.error);
