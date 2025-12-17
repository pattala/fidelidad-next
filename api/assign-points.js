
// api/assign-points.js
// Asigna puntos a un cliente de forma segura.
// Soporta modo ADMIN (x-api-key) y modo USUARIO (Token Firebase).

import admin from "firebase-admin";

// ---------- Firebase Admin ----------
function initFirebaseAdmin() {
    if (admin.apps.length) return;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");
    let sa;
    try { sa = JSON.parse(raw); }
    catch { throw new Error("Invalid GOOGLE_CREDENTIALS_JSON"); }
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

function getDb() {
    initFirebaseAdmin();
    return admin.firestore();
}

function getAuth() {
    initFirebaseAdmin();
    return admin.auth();
}

// ---------- CORS ----------
function setCors(res, origin) {
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
}

// ---------- Handler ----------
export default async function handler(req, res) {
    setCors(res, req.headers.origin);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    try {
        const db = getDb();
        const { uid, reason, amountOverride } = req.body || {};

        // 1. Autenticación (DUAL MODE)
        let isAdmin = false;
        let requestUid = null;

        const apiKey = req.headers["x-api-key"];
        const authHeader = req.headers["authorization"];

        if (apiKey && process.env.API_SECRET_KEY && apiKey === process.env.API_SECRET_KEY) {
            isAdmin = true; // Modo Admin
        } else if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            try {
                const decoded = await getAuth().verifyIdToken(token);
                requestUid = decoded.uid;
            } catch (e) {
                return res.status(401).json({ ok: false, error: "Invalid Token" });
            }
        } else {
            return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        // 2. Validación de Target
        const targetUid = isAdmin ? uid : requestUid; // Admin elige a quien, Usuario solo a sí mismo
        if (!targetUid) return res.status(400).json({ ok: false, error: "Missing Target UID" });

        // Si es Usuario intentando asignarse a otro (aunque envíe body uid, lo ignoramos arriba, pero validamos coherencia)
        if (!isAdmin && uid && uid !== requestUid) {
            return res.status(403).json({ ok: false, error: "Forbidden: Can only assign to self" });
        }

        // 3. Determinar Monto
        let points = 0;

        if (isAdmin && amountOverride) {
            points = Number(amountOverride); // Admin puede forzar monto
        } else {
            // Modo Reglas de Negocio (Usuario o Admin sin override)
            if (reason === 'profile_address') {
                // Leer config de Firestore
                const cfgSnap = await db.collection('config').doc('gamification').get();
                const cfg = cfgSnap.exists ? cfgSnap.data() : {};
                points = Number(cfg.pointsForAddress) || 50; // Default 50
            } else {
                return res.status(400).json({ ok: false, error: "Unknown reason or missing amount" });
            }
        }

        if (!points || points <= 0) return res.status(400).json({ ok: false, error: "Invalid points amount" });

        // 4. Idempotencia & Transacción
        const clientRef = db.collection('clientes').where('authUID', '==', targetUid).limit(1);

        let result = { ok: false };

        await db.runTransaction(async (tx) => {
            const qs = await tx.get(clientRef);
            if (qs.empty) throw new Error("Client not found");
            const doc = qs.docs[0];
            const data = doc.data();

            // Chequeo de duplicados (solo para reasons conocidos)
            if (reason === 'profile_address') {
                // Buscamos si ya tiene este premio en el historial reciente
                // Nota: Idealmente history es una subcollection, pero si es array en doc:
                const history = data.history || [];
                const alreadyAwarded = history.some(h => h.reason === reason);
                // O mejor, una flag en el root para query rápida
                // if (data.rewards?.[reason]) ...

                // Por simplicidad y performance, consultamos subcollection 'puntos_history' o el array si es pequeño.
                // Vamos a asumir historial en array por ahora (según app.js anterior).
                // Si app.js usa otra cosa, ajustar. (app.js usa .collection('historial') o array?)
                // Revisando app.js: usa .collection('inbox') pero puntos parece ser solo campo.

                // Vamos a usar una flag en el cliente para idempotencia fuerte: `rewards_awarded: { profile_address: true }`
                if (data.rewards_awarded && data.rewards_awarded[reason]) {
                    throw new Error("ALREADY_AWARDED");
                }
            }

            const newPoints = (data.puntos || 0) + points;

            tx.update(doc.ref, {
                puntos: newPoints,
                [`rewards_awarded.${reason}`]: true, // Marcar como dado
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Log Historial (Subcollection para no saturar doc principal)
            const histRef = doc.ref.collection('historial').doc();
            tx.set(histRef, {
                puntos: points,
                reason: reason || 'manual',
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                balanceAfter: newPoints
            });

            result = { ok: true, pointsAdded: points, newBalance: newPoints };
        });

        return res.status(200).json(result);

    } catch (error) {
        if (error.message === "ALREADY_AWARDED") {
            return res.status(200).json({ ok: true, message: "Already awarded", pointsAdded: 0 });
        }
        console.error("assign-points error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
