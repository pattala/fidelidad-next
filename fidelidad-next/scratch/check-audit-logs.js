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
    console.log("🔍 Fetching and counting all recent audit log types...");
    
    const snapshot = await db.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(300)
        .get();
        
    console.log(`Fetched ${snapshot.size} logs.`);
    
    const counts = {};
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const t = data.type || "MISSING_TYPE";
        counts[t] = (counts[t] || 0) + 1;
    });
    
    console.log("Log type breakdown:", JSON.stringify(counts, null, 2));
}

run().catch(console.error);
