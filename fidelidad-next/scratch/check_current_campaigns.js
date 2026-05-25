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
    console.log("🔍 INSPECTING CURRENT CAMPAIGNS AND CONFIG...");

    // 1. Get Config
    const configSnap = await db.collection("config").doc("general").get();
    console.log("\n⚙️ CONFIG GENERAL:");
    if (configSnap.exists) {
        const data = configSnap.data();
        console.log({
            dailyCheck: data.dailyCheck,
            campaignCheck: data.campaignCheck,
            enableDateSimulator: data.enableDateSimulator,
            simulatedOffsetDays: data.simulatedOffsetDays,
            simulationConfig: data.simulationConfig,
            messaging: data.messaging
        });
    } else {
        console.log("❌ config/general does not exist!");
    }

    // 2. Get Campaigns
    console.log("\n📢 ACTIVE CAMPAIGNS:");
    const campaignsSnap = await db.collection("campanas").where("active", "==", true).get();
    if (campaignsSnap.empty) {
        console.log("❌ No active campaigns found in 'campanas' collection!");
    } else {
        campaignsSnap.forEach(doc => {
            const c = doc.data();
            console.log(`- ID: ${doc.id}`);
            console.log(`  Name: ${c.name}`);
            console.log(`  active: ${c.active}`);
            console.log(`  autoBroadcast: ${c.autoBroadcast}`);
            console.log(`  startDate: ${c.startDate}`);
            console.log(`  endDate: ${c.endDate}`);
            console.log(`  startTime: ${c.startTime}`);
            console.log(`  endTime: ${c.endTime}`);
            console.log(`  broadcastSentAt: ${c.broadcastSentAt}`);
            console.log(`  isFlash: ${c.isFlash}`);
            console.log(`  daysOfWeek: ${JSON.stringify(c.daysOfWeek)}`);
            console.log(`  flashDays: ${JSON.stringify(c.flashDays)}`);
        });
    }

    // 3. Get Latest Audit Logs
    console.log("\n📜 LATEST AUDIT LOGS (Today):");
    const startOfToday = new Date("2026-05-18T00:00:00-03:00");
    const logsSnap = await db.collection("audit_logs")
        .where("timestamp", ">=", admin.firestore.Timestamp.fromDate(startOfToday))
        .orderBy("timestamp", "desc")
        .limit(10)
        .get();

    if (logsSnap.empty) {
        console.log("❌ No audit logs found for today.");
    } else {
        logsSnap.forEach(doc => {
            const l = doc.data();
            console.log(`- [${l.timestamp.toDate().toISOString()}] Type: ${l.type} | Status: ${l.status} | Summary: ${l.summary}`);
            if (l.details) {
                console.log(`  Details: ${JSON.stringify(l.details)}`);
            }
        });
    }
}

run().catch(console.error);
