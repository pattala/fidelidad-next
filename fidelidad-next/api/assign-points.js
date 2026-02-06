
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
            // Modo Reglas de Negocio
            if (reason === 'profile_address') {
                const cfgSnap = await db.collection('config').doc('gamification').get();
                const cfg = cfgSnap.exists ? cfgSnap.data() : {};
                points = Number(cfg.pointsForAddress) || 50;
            } else if (reason === 'welcome_signup') {
                const cfgSnap = await db.collection('config').doc('general').get();
                const cfg = cfgSnap.exists ? cfgSnap.data() : {};
                points = Number(cfg.welcomePoints) || 0;
            } else {
                return res.status(400).json({ ok: false, error: "Unknown reason or missing amount" });
            }
        }

        if (points <= 0) return res.status(200).json({ ok: true, pointsAdded: 0, message: "No points to add" });

        // 4. Idempotencia & Transacción
        const clientRef = db.collection("users").doc(targetUid);

        let result = { ok: false };

        await db.runTransaction(async (tx) => {
            const docSnapshot = await tx.get(clientRef);
            if (!docSnapshot.exists) throw new Error("Client not found");
            const data = docSnapshot.data();

            // Chequeo de duplicados
            if (data.rewards_awarded && data.rewards_awarded[reason]) {
                throw new Error("ALREADY_AWARDED");
            }

            const currentPoints = Number(data.points || data.puntos || 0);
            const newPoints = currentPoints + points;

            tx.update(clientRef, {
                points: newPoints,
                puntos: newPoints, // Keep legacy for safety but update points
                [`rewards_awarded.${reason}`]: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Log Historial (Subcollection points_history)
            const histRef = clientRef.collection('points_history').doc();

            // Default expiration: 365 days
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 365);

            tx.set(histRef, {
                amount: points,
                type: 'credit',
                reason: reason || 'manual',
                concept: reason === 'welcome_signup' ? 'Puntos de Bienvenida' : (reason === 'profile_address' ? 'Premio por completar dirección' : 'Asignación automática'),
                date: admin.firestore.FieldValue.serverTimestamp(),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                remainingPoints: points,
                balanceAfter: newPoints
            });

            // Opcional: Crear mensaje en Inbox si es bienvenida
            if (reason === 'welcome_signup') {
                const inboxRef = clientRef.collection('inbox').doc();
                tx.set(inboxRef, {
                    title: '¡Te damos la bienvenida!',
                    body: `Gracias por registrarte. Ya tienes ${points} puntos para empezar a disfrutar nuestros beneficios.`,
                    type: 'welcome',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    isRead: false
                });
            }

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
