const fs = require('fs');
const path = require('path');

// Cargar .env.local de forma manual en process.env
const envLocalPath = path.join(__dirname, '..', '.env.local');
if (fs.existsSync(envLocalPath)) {
    const envContent = fs.readFileSync(envLocalPath, 'utf8');
    envContent.split(/\r?\n/).forEach(line => {
        if (!line || line.startsWith('#')) return;
        const eqIdx = line.indexOf('=');
        if (eqIdx === -1) return;
        const key = line.slice(0, eqIdx).trim();
        let val = line.slice(eqIdx + 1).trim();
        // Quitar comillas si tiene
        if (val.startsWith('"') && val.endsWith('"')) {
            val = val.slice(1, -1);
        } else if (val.startsWith("'") && val.endsWith("'")) {
            val = val.slice(1, -1);
        }
        process.env[key] = val;
    });
    console.log("Loaded .env.local variables successfully.");
} else {
    console.log(".env.local not found at " + envLocalPath);
}

const admin = require('firebase-admin');

if (!admin.apps.length) {
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
    let creds;
    if (credsRaw) {
        try { 
            creds = JSON.parse(credsRaw); 
        } catch(e) { 
            creds = JSON.parse(credsRaw.replace(/\\n/g, '\n')); 
        }
        admin.initializeApp({
            credential: admin.credential.cert(creds)
        });
        console.log("Firebase Admin initialized successfully.");
    } else {
        admin.initializeApp();
    }
}

const db = admin.firestore();

async function run() {
    console.log("\n=== CHECKING GLOBAL CONFIG FOR MESSAGING ===");
    const configSnap = await db.collection('config').doc('general').get();
    if (configSnap.exists) {
        console.log(JSON.stringify(configSnap.data().messaging, null, 2));
    } else {
        console.log("No general config found.");
    }

    console.log("\n=== LATEST CAMPAIGN BROADCAST LOG (SORTED IN MEMORY) ===");
    // Hacemos query sin orden para no requerir índice compuesto
    const snap = await db.collection('audit_logs')
        .where('type', '==', 'campaign_broadcast')
        .limit(50)
        .get();

    const docs = [];
    snap.forEach(d => docs.push(d));

    // Ordenar en memoria por timestamp descendente
    docs.sort((a, b) => {
        const timeA = a.data().timestamp?.toDate ? a.data().timestamp.toDate() : new Date(a.data().timestamp || 0);
        const timeB = b.data().timestamp?.toDate ? b.data().timestamp.toDate() : new Date(b.data().timestamp || 0);
        return timeB - timeA;
    });

    const latestDocs = docs.slice(0, 3);
    latestDocs.forEach(doc => {
        const data = doc.data();
        console.log(`\nLog ID: ${doc.id}`);
        console.log(`Timestamp: ${data.timestamp?.toDate ? data.timestamp.toDate().toISOString() : data.timestamp}`);
        console.log(`Summary: ${data.summary}`);
        console.log(`Status: ${data.status}`);
        console.log(`Details:`, JSON.stringify(data.details, null, 2));
    });
}

run().catch(console.error);
