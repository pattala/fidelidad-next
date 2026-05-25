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
    console.log("🔍 Searching for actual birthday sending logs (no 'Ya saludado')...");
    
    // We fetch a larger window of logs and filter them
    const snapshot = await db.collection("audit_logs")
        .orderBy("timestamp", "desc")
        .limit(1000)
        .get();
        
    console.log(`Fetched ${snapshot.size} logs.`);
    
    let sentGreetings = [];
    snapshot.docs.forEach(doc => {
        const data = doc.data();
        
        // Check inside details for any actual sending actions
        if (data.details && Array.isArray(data.details)) {
            const birthGreeting = data.details.find(d => 
                d.action === "birthday_greeting" && 
                d.status === "success" && 
                (!d.info || !d.info.includes("Ya saludado"))
            );
            if (birthGreeting) {
                sentGreetings.push({ id: doc.id, time: data.timestamp ? data.timestamp.toDate() : null, doc: data, detail: birthGreeting });
            }
        }
    });
    
    console.log(`Found ${sentGreetings.length} actual birth greetings sent:`);
    sentGreetings.forEach(g => {
        const timeStr = g.time ? g.time.toLocaleString("es-AR", { timeZone: "America/Argentina/Buenos_Aires" }) : "N/A";
        console.log(`- [${timeStr}] DocID: ${g.id} | Trigger: ${g.doc.triggerSource || 'N/A'}`);
        console.log(`  User: ${g.detail.userName} | Phone: ${g.detail.phone} | Status: ${g.detail.status}`);
        if (g.detail.info) {
            console.log(`  Info: ${g.detail.info}`);
        }
    });
}

run().catch(console.error);
