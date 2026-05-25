import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const credsPath = path.resolve("./.dev_creds.json");
const rawCreds = JSON.parse(fs.readFileSync(credsPath, "utf8"));
const sa = JSON.parse(rawCreds.credentials);

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(sa),
    });
}
const db = admin.firestore();

async function printTokens() {
    console.log("🔍 INSPECCIONANDO TOKENS DE PABLO EN LA DB...\n");
    const userDoc = await db.collection("users").doc("XlWZgAiSrmhEwJ2eqhrbGEYqVRK2").get();
    if (userDoc.exists) {
        const u = userDoc.data();
        console.log(`Nombre: ${u.nombre || u.name}`);
        console.log(`fcmToken: "${u.fcmToken}"`);
        console.log(`fcmToken_mobile: "${u.fcmToken_mobile}"`);
        console.log(`fcmToken_pc: "${u.fcmToken_pc}"`);
        console.log(`fcmTokens (Array):`, JSON.stringify(u.fcmTokens || []));
        console.log(`lastFcmUpdate:`, u.lastFcmUpdate?.toDate ? u.lastFcmUpdate.toDate().toLocaleString("es-AR") : "Ninguno");
        console.log(`fcmState: "${u.fcmState}"`);
        console.log(`lastPushResult: "${u.lastPushResult}"`);
        console.log(`lastPushDate: "${u.lastPushDate}"`);
    } else {
        console.log("No se encontró el usuario.");
    }
}

printTokens().catch(console.error);
