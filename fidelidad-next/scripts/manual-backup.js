
import admin from "firebase-admin";
import fs from "fs";
import path from "path";

async function backup() {
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) {
        console.error("GOOGLE_CREDENTIALS_JSON missing");
        process.exit(1);
    }

    let sa;
    try {
        sa = JSON.parse(raw);
    } catch (e) {
        sa = JSON.parse(raw.replace(/\\n/g, "\n"));
    }

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(sa)
        });
    }

    const db = admin.firestore();
    const collections = ['users', 'prizes', 'campanas', 'config', 'audit_logs'];
    const backupDir = "C:\\Users\\pablo\\.gemini\\antigravity\\brain\\7344a735-df4e-45da-9a87-09523ec32758\\backups";

    if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(backupDir, `full_backup_${timestamp}.json`);
    const fullData = {};

    for (const col of collections) {
        console.log(`Backing up ${col}...`);
        const snap = await db.collection(col).get();
        fullData[col] = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    }

    fs.writeFileSync(backupFile, JSON.stringify(fullData, null, 2));
    console.log(`Backup saved to ${backupFile}`);
    console.log(`Summary: ${Object.keys(fullData).map(k => `${k}: ${fullData[k].length}`).join(', ')}`);
}

backup().catch(console.error);
