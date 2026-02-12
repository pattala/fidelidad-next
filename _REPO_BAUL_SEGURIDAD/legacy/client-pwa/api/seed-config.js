
// api/seed-config.js
// Inicializa la configuración base en Firestore (ej. Gamification).
// Seguridad: requiere header 'x-api-key' = process.env.API_SECRET_KEY

import admin from "firebase-admin";

// --- Seguridad básica con API key ---
function assertAuth(req) {
    const key = req.headers["x-api-key"] || req.query.key;
    if (!key || key !== process.env.API_SECRET_KEY) {
        const err = new Error("Unauthorized");
        err.status = 401;
        throw err;
    }
}

// --- Inicializar Firebase Admin ---
function initAdmin() {
    if (admin.apps.length) return admin;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) {
        const err = new Error("Falta GOOGLE_CREDENTIALS_JSON.");
        err.status = 500;
        throw err;
    }
    const creds = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(creds) });
    return admin;
}

// --- Handler ---
export default async function handler(req, res) {
    try {
        if (req.method !== "POST") {
            return res.status(405).json({ ok: false, error: "Method Not Allowed" });
        }

        assertAuth(req);

        // Configuración Base a sembrar
        const configsToSeed = {
            gamification: {
                pointsForAddress: 50,
                welcomeBonusEnabled: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }
            // Agregar más configs aquí si necesario
        };

        const app = initAdmin();
        const db = app.firestore();
        const results = [];

        for (const [docId, data] of Object.entries(configsToSeed)) {
            await db.collection("config").doc(docId).set(data, { merge: true });
            results.push(docId);
        }

        return res.status(200).json({ ok: true, seeded: results, message: "Configuration initialized successfully." });
    } catch (err) {
        console.error(err);
        const status = err.status || 500;
        return res.status(status).json({ ok: false, error: err.message || "Unknown error" });
    }
}
