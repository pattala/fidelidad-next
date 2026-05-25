const fs = require('fs');
const path = require('path');

const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
        if (!line || line.startsWith('#')) return;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
        process.env[key] = val;
    });
}

const admin = require('firebase-admin');

if (!admin.apps.length) {
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
    let creds;
    try {
        creds = JSON.parse(credsRaw);
    } catch(e) {
        creds = JSON.parse(credsRaw.replace(/\\n/g, '\n'));
    }
    admin.initializeApp({
        credential: admin.credential.cert(creds)
    });
}

const db = admin.firestore();

async function run() {
    console.log("=== CHECKING ALL USERS AND THEIR EMAILS ===");
    const snap = await db.collection('users').get();
    let nonAdmins = 0;
    snap.forEach(doc => {
        const data = doc.data();
        if (data.role === 'admin') return;
        nonAdmins++;
        console.log(`User ID: ${doc.id}`);
        console.log(`Name: ${data.name || data.nombre || 'N/A'}`);
        console.log(`Role: ${data.role || 'client'}`);
        console.log(`Email: ${data.email || 'NO EMAIL'}`);
        console.log(`Phone: ${data.phone || 'NO PHONE'}`);
        console.log(`FCM Tokens: ${data.fcmTokens?.length || 0}`);
        console.log("------------------------");
    });
    console.log(`Total non-admin users: ${nonAdmins}`);
}

run().catch(console.error);
