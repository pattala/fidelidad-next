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
    console.log("🔍 Fetching daily alert tracker docs for May 16th and 17th...");
    
    const doc16 = await db.collection("audit_logs").doc("daily_alerts_2026-05-16").get();
    const doc17 = await db.collection("audit_logs").doc("daily_alerts_2026-05-17").get();
    
    if (doc16.exists) {
        const data = doc16.data();
        const timeStr = data.timestamp ? data.timestamp.toDate().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "N/A";
        console.log(`📌 Document daily_alerts_2026-05-16:`);
        console.log(`- Created/Updated (es-AR): ${timeStr}`);
        console.log(`- Status: ${data.status}`);
        console.log(`- Summary: ${data.summary}`);
        console.log(`- Executor: ${data.executor}`);
        console.log(`- Details: ${JSON.stringify(data.details, null, 2)}`);
    } else {
        console.log("❌ Document daily_alerts_2026-05-16 does not exist!");
    }
    
    if (doc17.exists) {
        const data = doc17.data();
        const timeStr = data.timestamp ? data.timestamp.toDate().toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "N/A";
        console.log(`📌 Document daily_alerts_2026-05-17:`);
        console.log(`- Created/Updated (es-AR): ${timeStr}`);
        console.log(`- Status: ${data.status}`);
        console.log(`- Summary: ${data.summary}`);
        console.log(`- Executor: ${data.executor}`);
        console.log(`- Details: ${JSON.stringify(data.details, null, 2)}`);
    } else {
        console.log("❌ Document daily_alerts_2026-05-17 does not exist!");
    }
}

run().catch(console.error);
