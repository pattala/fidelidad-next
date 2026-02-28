
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

const serviceAccountPath = path.resolve("service-account.json");

if (!fs.existsSync(serviceAccountPath)) {
    console.error("Falta service-account.json para correr este script localmente.");
    process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(serviceAccountPath, "utf8"));

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
    });
}

const db = admin.firestore();

async function checkTokens() {
    console.log("Fetching all users...");
    const snap = await db.collection("users").get();

    const tokenToUsers = {};
    const usersWithNoTokens = [];
    let totalTokens = 0;

    snap.forEach(doc => {
        const data = doc.data();
        const tokens = new Set();

        // Limpiamos tokens vacíos o nulos
        if (data.fcmToken && typeof data.fcmToken === 'string' && data.fcmToken.trim()) {
            tokens.add(data.fcmToken.trim());
        }

        if (Array.isArray(data.fcmTokens)) {
            data.fcmTokens.forEach(t => {
                if (t && typeof t === 'string' && t.trim()) {
                    tokens.add(t.trim());
                }
            });
        }

        if (tokens.size === 0) {
            usersWithNoTokens.push({ id: doc.id, name: data.name || data.nombre || 'N/A' });
        } else {
            tokens.forEach(t => {
                if (!tokenToUsers[t]) tokenToUsers[t] = [];
                tokenToUsers[t].push({ id: doc.id, name: data.name || data.nombre || 'N/A' });
                totalTokens++;
            });
        }
    });

    console.log(`Total Users: ${snap.size}`);
    console.log(`Total Tokens Found: ${totalTokens}`);
    console.log(`Unique Tokens: ${Object.keys(tokenToUsers).length}`);
    console.log(`Users with NO tokens: ${usersWithNoTokens.length}`);

    const sharedTokens = Object.entries(tokenToUsers).filter(([t, users]) => users.length > 1);

    if (sharedTokens.length > 0) {
        console.log("\n⚠️ FOUND SHARED TOKENS (Multiple users with same token):");
        sharedTokens.forEach(([t, users]) => {
            console.log(`Token: ${t.substring(0, 15)}...`);
            users.forEach(u => console.log(`   - ${u.name} [${u.id}]`));
        });
    } else {
        console.log("\n✅ No shared tokens found.");
    }

    process.exit(0);
}

checkTokens().catch(err => {
    console.error(err);
    process.exit(1);
});
