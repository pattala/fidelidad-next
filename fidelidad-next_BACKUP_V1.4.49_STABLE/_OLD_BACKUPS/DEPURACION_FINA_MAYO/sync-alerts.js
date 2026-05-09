// api/sync-alerts.js
// Endpoint para sincronizar el estado de las alertas diarias entre extensión y panel.

import admin from "firebase-admin";

function initFirebaseAdmin() {
    if (admin.apps.length) return;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");
    let sa;
    try { sa = JSON.parse(raw); }
    catch { throw new Error("Invalid GOOGLE_CREDENTIALS_JSON"); }
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: sa.project_id,
            clientEmail: sa.client_email,
            privateKey: sa.private_key?.replace(/\\n/g, "\n"),
        }),
    });
}

export default async function handler(req, res) {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    const apiKey = req.headers["x-api-key"] || req.headers["x-api-secret"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!apiKey || apiKey !== SECRET) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
        initFirebaseAdmin();
        const db = admin.firestore();
        const { alertId, action, date } = req.body;

        if (!alertId || !action) {
            return res.status(400).json({ ok: false, error: "Missing alertId or action" });
        }

        const todayStr = date || new Date().toISOString().split('T')[0];
        const docRef = db.collection("audit_logs").doc(`daily_alerts_${todayStr}`);

        await db.runTransaction(async (t) => {
            const doc = await t.get(docRef);
            let actions = {};
            if (doc.exists) {
                actions = doc.data().actions || {};
            }
            
            if (action === 'delete') {
                delete actions[alertId];
            } else {
                actions[alertId] = action;
            }

            t.set(docRef, { 
                actions, 
                lastUpdate: admin.firestore.FieldValue.serverTimestamp() 
            }, { merge: true });
        });

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("[sync-alerts] Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
