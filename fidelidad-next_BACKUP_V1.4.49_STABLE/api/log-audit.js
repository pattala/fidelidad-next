// api/log-audit.js
// Endpoint genérico para registrar eventos de auditoría desde el frontend.

import admin from "firebase-admin";

// ---------- Inicialización Firebase Admin ----------
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
        const { type, status, summary, details, executor = 'admin' } = req.body;

        if (!type || !summary) {
            return res.status(400).json({ ok: false, error: "Missing type or summary" });
        }

        await db.collection("audit_logs").add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type,
            status: status || 'success',
            summary,
            details: details || [],
            executor
        });

        // --- AUTOMATIC LOG ROTATION (Limit: 1000 records) ---
        // Efficient count and batch delete for maintenance
        try {
            const countSnap = await db.collection("audit_logs").count().get();
            const total = countSnap.data().count;
            if (total > 1000) {
                // Delete oldest 100 logs at once to avoid frequent cleanup
                const oldestLogs = await db.collection("audit_logs")
                    .orderBy("timestamp", "asc")
                    .limit(100)
                    .get();
                const batch = db.batch();
                oldestLogs.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`[log-audit] Pruned ${oldestLogs.size} old logs. Total was ${total}.`);
            }
        } catch (pruneErr) {
            console.error("[log-audit] Pruning error:", pruneErr);
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("[log-audit] Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
