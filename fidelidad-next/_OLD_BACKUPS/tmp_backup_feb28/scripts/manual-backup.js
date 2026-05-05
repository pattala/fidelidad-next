import admin from "firebase-admin";
import fs from "fs";
import path from "path";
import dotenv from "dotenv";

dotenv.config();

async function backup() {
    let raw = process.env.GOOGLE_CREDENTIALS_JSON;
    let sa;

    if (!raw) {
        console.log("GOOGLE_CREDENTIALS_JSON missing. Checking for service-account.json...");
        const saPath = path.resolve(process.cwd(), "service-account.json");
        if (fs.existsSync(saPath)) {
            raw = fs.readFileSync(saPath, 'utf8');
        } else {
            console.error("Neither GOOGLE_CREDENTIALS_JSON missing nor service-account.json found.");
            process.exit(1);
        }
    }

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
    const backupDir = "C:\\Users\\pablo\\.gemini\\antigravity\\brain\\e00e3d9d-6e80-4786-8c3e-6ec596a29a48\\backups";

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
