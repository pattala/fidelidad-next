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
    console.log("🔍 Fetching target audit documents...");
    
    const doc1 = await db.collection("audit_logs").doc("dXIzajoTwdCaJR72DIhD").get();
    const doc2 = await db.collection("audit_logs").doc("8zehLV4VnrbDcTOvUCWk").get();
    
    if (doc1.exists) {
        console.log("Document dXIzajoTwdCaJR72DIhD content:", JSON.stringify(doc1.data(), null, 2));
    } else {
        console.log("Document dXIzajoTwdCaJR72DIhD does not exist.");
    }
    
    if (doc2.exists) {
        console.log("Document 8zehLV4VnrbDcTOvUCWk content:", JSON.stringify(doc2.data(), null, 2));
    } else {
        console.log("Document 8zehLV4VnrbDcTOvUCWk does not exist.");
    }
}

run().catch(console.error);
