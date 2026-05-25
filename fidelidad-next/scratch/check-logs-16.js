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
    console.log("🔍 Fetching all audit logs from May 16th (Argentina time)...");
    
    // We get logs ordered by timestamp
    const snapshot = await db.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(1000)
        .get();
        
    console.log(`Fetched ${snapshot.size} logs.`);
    
    let rangeLogs = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        if (data.timestamp) {
            const date = data.timestamp.toDate();
            const argDate = new Date(date.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
            
            // May 16th, 2026
            if (argDate.getFullYear() === 2026 && 
                argDate.getMonth() === 4 && 
                argDate.getDate() === 16) {
                
                const dataStr = JSON.stringify(data).toLowerCase();
                if (dataStr.includes("birthday") || dataStr.includes("cumple")) {
                    rangeLogs.push({ id: doc.id, timeStr: argDate.toLocaleString("es-AR"), data });
                }
            }
        }
    });
    
    console.log(`Found ${rangeLogs.length} birthday-related logs on May 16th:`);
    rangeLogs.forEach(log => {
        console.log(`- [${log.timeStr}] ID: ${log.id} | Type: ${log.data.type} | Status: ${log.data.status} | Trigger: ${log.data.triggerSource || 'N/A'}`);
        console.log(`  Summary: ${log.data.summary}`);
        if (log.data.details) {
            console.log(`  Details: ${JSON.stringify(log.data.details)}`);
        }
    });
}

run().catch(console.error);
