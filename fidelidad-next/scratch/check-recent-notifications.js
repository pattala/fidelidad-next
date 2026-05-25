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
    console.log("🔍 Fetching recent audit logs (filtering in memory to prevent index issues)...");
    
    const snapshot = await db.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(100)
        .get();
        
    console.log(`Fetched ${snapshot.size} raw logs.`);
    
    const filteredDocs = snapshot.docs.filter(doc => {
        const type = doc.data().type;
        return ["push_notification", "email_notification", "user_created"].includes(type);
    }).slice(0, 10);
    
    console.log(`Found ${filteredDocs.length} matching notification/creation logs in the last 100 audits.`);
    
    filteredDocs.forEach(doc => {
        const data = doc.data();
        console.log(`\n-------------------------------------`);
        console.log(`[${data.timestamp?.toDate().toISOString()}] Type: ${data.type}`);
        console.log(`Summary: ${data.summary}`);
        console.log(`Status: ${data.status}`);
        console.log(`Details:`, JSON.stringify(data.details, null, 2));
    });
}

run().catch(console.error);
