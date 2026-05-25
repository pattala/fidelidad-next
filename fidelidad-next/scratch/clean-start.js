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
    const configDocRef = db.collection("config").doc("general");
    
    // 1. Get current config
    let snap = await configDocRef.get();
    if (!snap.exists) {
        console.error("❌ config/general document does not exist!");
        return;
    }
    
    console.log("📌 CURRENT CONFIG GENERAL:");
    console.log(JSON.stringify(snap.data(), null, 2));
    
    // 2. Perform Clean Start (Reset checks to force clean execution today)
    console.log("\n🧹 Resetting dailyCheck and campaignCheck to force a clean run today...");
    
    await configDocRef.update({
        dailyCheck: "",
        campaignCheck: ""
    });
    
    // 3. Confirm update
    snap = await configDocRef.get();
    console.log("\n✅ UPDATED CONFIG GENERAL:");
    console.log(JSON.stringify(snap.data(), null, 2));
}

run().catch(console.error);
