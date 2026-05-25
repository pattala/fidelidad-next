import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");

if (!fs.existsSync(credsPath)) {
    console.error("Credentials file not found");
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
    console.log("⚙️ Patching expirationWarningDays to 4 in Firestore config/general...");
    
    const configDocRef = db.collection("config").doc("general");
    
    await configDocRef.update({
        "messaging.expirationWarningDays": 4
    });
    
    const snap = await configDocRef.get();
    console.log("✅ Configuration successfully patched!");
    console.log("New expirationWarningDays:", snap.data().messaging?.expirationWarningDays);
}

run().catch(console.error);
