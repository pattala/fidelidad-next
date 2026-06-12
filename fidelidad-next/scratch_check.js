import admin from "firebase-admin";
import dotenv from "dotenv";

dotenv.config({ path: ".env.local" });
dotenv.config();

const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON;
if (!credsRaw) {
    console.log("No creds");
    process.exit(1);
}
let creds;
try { 
    creds = JSON.parse(credsRaw); 
} catch { 
    // If it has actual newlines, we need to escape them before JSON parsing
    const escaped = credsRaw.replace(/\n/g, '\\n').replace(/\r/g, '');
    try {
        creds = JSON.parse(escaped);
    } catch {
        // If it's literally the string '\n', we do another replace
        creds = JSON.parse(credsRaw.replace(/\\n/g, "\\n"));
    }
}

admin.initializeApp({
    credential: admin.credential.cert({
        projectId: creds.project_id,
        clientEmail: creds.client_email,
        privateKey: creds.private_key?.replace(/\\n/g, "\n"),
    }),
});

const db = admin.firestore();

async function run() {
    console.log("--- CONFIG ---");
    const configSnap = await db.collection('config').doc('general').get();
    const c = configSnap.data();
    console.log("petLitterAlertLeadDays:", c.petLitterAlertLeadDays);
    console.log("messaging.petFoodWarningDays:", c.messaging?.petFoodWarningDays);
    console.log("enableDateSimulator:", c.enableDateSimulator);
    console.log("simulatedOffsetDays:", c.simulatedOffsetDays);

    console.log("\n--- ENGINE LOGS ---");
    const logs = await db.collection('config').doc('engineCheck').get();
    console.log("engineCheck:", logs.data());

    console.log("\n--- USERS (Gato) ---");
    const users = await db.collection('users').get();
    users.forEach(doc => {
        const pets = doc.data().pets || [];
        pets.forEach(p => {
            if ((p.type || '').toLowerCase() === 'gato') {
                console.log("USER:", doc.data().nombre, doc.data().email);
                console.log("PET:", p);
            }
        });
    });
    console.log("\n--- AUDIT LOGS (Últimos días) ---");
    const today = new Date();
    today.setDate(today.getDate() - 5);
    const auditSnap = await db.collection('audit_logs')
        .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(today))
        .orderBy('timestamp', 'desc')
        .limit(20)
        .get();
        
    auditSnap.forEach(doc => {
        const d = doc.data();
        if (d.type === 'daily_alerts' || d.type === 'daily_check_info') {
            const dateStr = d.timestamp ? d.timestamp.toDate().toLocaleString("es-AR", {timeZone: "America/Argentina/Buenos_Aires"}) : 'Unknown';
            console.log(`[${dateStr}] ${d.type} - Status: ${d.status} - Trigger: ${d.triggerSource || d.executor}`);
        }
    });

    process.exit(0);
}

run().catch(console.error);
