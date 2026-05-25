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
    console.log("🔍 Fetching user birthday info...");
    const snap = await db.collection("users").doc("CTGQITtvNSa5STZwuYJFHt79Neb2").get();
    if (snap.exists) {
        console.log("User Data:", JSON.stringify(snap.data(), null, 2));
    } else {
        console.log("User not found!");
    }
}

run().catch(console.error);
