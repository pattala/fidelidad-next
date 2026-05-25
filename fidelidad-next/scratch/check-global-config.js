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
    console.log("🔍 Fetching global config...");
    const snap = await db.collection("config").doc("general").get();
    if (snap.exists) {
        console.log("Config/General Data:", JSON.stringify(snap.data(), null, 2));
    } else {
        console.log("Config not found!");
    }
}

run().catch(console.error);
