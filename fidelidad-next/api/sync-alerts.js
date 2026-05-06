import admin from "firebase-admin";

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const credsRaw = (process.env.GOOGLE_CREDENTIALS_JSON || "").trim();
        if (!credsRaw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON");
        let creds;
        try { creds = JSON.parse(credsRaw); } catch { creds = JSON.parse(credsRaw.replace(/\\n/g, "\n")); }
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: creds.project_id,
                clientEmail: creds.client_email,
                privateKey: creds.private_key?.replace(/\\n/g, "\n"),
            }),
        });
    }
    return admin;
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!authHeader || !SECRET || !authHeader.includes(SECRET)) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const { alertId, action, date } = req.body;
    if (!alertId || !date) return res.status(400).json({ ok: false, error: "Missing alertId or date" });

    try {
        const app = initFirebaseAdmin();
        const db = app.firestore();

        const docRef = db.collection('audit_logs').doc(`daily_alerts_${date}`);
        
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            let actions = {};
            
            if (doc.exists) {
                actions = doc.data().actions || {};
            }
            
            if (action === 'delete') {
                delete actions[alertId];
            } else {
                actions[alertId] = action; // 'sent' or 'dismissed'
            }
            
            transaction.set(docRef, { 
                actions, 
                lastUpdate: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_alerts_sync'
            }, { merge: true });
        });

        return res.status(200).json({ ok: true });
    } catch (e) {
        console.error("Sync Error:", e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}
