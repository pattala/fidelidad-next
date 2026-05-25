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
    console.log("🔍 Fetching all audit logs from May 17th between 11:00 and 13:00...");
    
    // We get 300 logs ordered by timestamp
    const snapshot = await db.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(500)
        .get();
        
    console.log(`Fetched ${snapshot.size} logs.`);
    
    let rangeLogs = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
            const date = data.timestamp.toDate();
            const argDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
            
            // Check if it's on May 17th, 2026 between 11:00 AM and 1:00 PM
            if (argDate.getFullYear() === 2026 && 
                argDate.getMonth() === 4 && // May is 4
                argDate.getDate() === 17 && 
                argDate.getHours() >= 11 && 
                argDate.getHours() <= 13) {
                rangeLogs.push({ id: doc.id, timeStr: argDate.toLocaleString("es-AR"), data });
            }
        }
    });
    
    console.log(`Found ${rangeLogs.length} logs in the target time frame:`);
    // Print them oldest first
    rangeLogs.reverse().forEach(log => {
        console.log(`- [${log.timeStr}] ID: ${log.id} | Type: ${log.data.type} | Status: ${log.data.status} | Trigger: ${log.data.triggerSource || 'N/A'}`);
        console.log(`  Summary: ${log.data.summary}`);
    });
}

run().catch(console.error);
