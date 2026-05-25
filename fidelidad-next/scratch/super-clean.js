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
    console.log("🧹 Starting a Complete Super-Clean for Testing...");

    // 1. Reset config/general flags
    console.log("\n1️⃣ Resetting dailyCheck and campaignCheck in config/general...");
    await db.collection("config").doc("general").update({
        dailyCheck: "",
        campaignCheck: ""
    });
    console.log("✅ Config flags cleared.");

    // 2. Delete daily alerts execution locks (which prevent the engine from running again today)
    const datesToDelete = [
        "daily_alerts_2026-05-15",
        "daily_alerts_2026-05-16",
        "daily_alerts_2026-05-17",
        "daily_alerts_2026-05-18",
        "daily_alerts_2026-05-19",
        "daily_alerts_2026-05-20"
    ];
    
    console.log("\n2️⃣ Deleting daily execution lock documents from audit_logs...");
    for (const docId of datesToDelete) {
        await db.collection("audit_logs").doc(docId).delete();
        console.log(`🗑️ Deleted lock document: ${docId}`);
    }
    console.log("✅ Execution locks cleared.");

    // 3. Reset test users' greetings and points flags
    const testUserDnis = ["24042610", "24042609", "24042608"]; // usuario C, Usuario B, Pepito
    console.log("\n3️⃣ Resetting greeting and points flags in test users...");
    
    for (const dni of testUserDnis) {
        const snap = await db.collection("users").where("dni", "==", dni).get();
        if (!snap.empty) {
            for (const doc of snap.docs) {
                await doc.ref.update({
                    lastBirthdayGreetingYear: "",
                    lastBirthdayPointsYear: "",
                    lastExpirationWarningDates: {},
                    // Let's also restore points to a baseline if desired (e.g. 100 or keep current)
                });
                console.log(`👤 Reset test user: ${doc.data().nombre || doc.data().name} (DNI: ${dni})`);
            }
        } else {
            console.log(`⚠️ No test user found with DNI: ${dni}`);
        }
    }
    console.log("✅ Test users cleared.");

    console.log("\n✨ SUPER-CLEAN SUCCESSFUL! Your database is now 100% ready for fresh engine testing!");
}

run().catch(console.error);
