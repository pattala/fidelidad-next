
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
        let cfg = {}; // Fix: Scope global para que sea accesible abajo

        if (isAdmin && amountOverride) {
            points = Number(amountOverride);
        } else {
            // MODO: Configuración Centralizada (Admin Panel)
            const cfgSnap = await db.collection('configuracion').doc('parametros').get();
            cfg = cfgSnap.exists ? cfgSnap.data() : {};

            if (reason === 'profile_address') {
                // Default: Activo, 50 puntos (si no está configurado)
                const activo = (cfg.bono_domicilio_activo !== false); // default true
                if (!activo) {
                    return res.status(200).json({ ok: true, pointsAdded: 0, message: "Bono domicilio inactivo" });
                }
                points = Number(cfg.bono_domicilio_puntos);
                if (isNaN(points)) points = 50;

            } else if (reason === 'welcome_signup') {
                // Bono Bienvenida
                const activo = (cfg.bono_bienvenida_activo === true); // default false? Segun imagen estaba false.
                // Si la imagen muestra false, y queremos probar, asumamos que el usuario lo activará.
                // Pero el codigo debe respetar la flag.
                if (!activo) {
                    return res.status(200).json({ ok: true, pointsAdded: 0, message: "Bono bienvenida inactivo" });
                }
                points = Number(cfg.bono_bienvenida_puntos) || 0;

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

            // Chequeo de duplicados (Generic)
            if (reason) {
                if (data.rewards_awarded && data.rewards_awarded[reason]) {
                    throw new Error("ALREADY_AWARDED");
                }
            }

            const newPoints = (data.puntos || 0) + points;

            // Caducidad (Configurable vs Default 365)
            let diasCaducidad = 365;
            if (reason === 'welcome_signup') diasCaducidad = Number(cfg.bono_bienvenida_dias) || 365;
            if (reason === 'profile_address') diasCaducidad = Number(cfg.bono_domicilio_dias) || 365;

            // Objeto para Arrays (PWA Logic) y Subcollection (Audit)
            const historyEntry = {
                puntos: points,
                puntosDisponibles: points, // Logic de consumo debe restar de aquí
                diasCaducidad: diasCaducidad,
                fechaObtencion: admin.firestore.Timestamp.now(), // Timestamp real
                reason: reason || 'manual'
            };

            tx.update(doc.ref, {
                puntos: newPoints,
                [`rewards_awarded.${reason}`]: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // Agregamos al array historialPuntos para la PWA
                historialPuntos: admin.firestore.FieldValue.arrayUnion(historyEntry)
            });

            // Log Historial (Subcollection Audit)
            const histRef = doc.ref.collection('historial').doc();
            tx.set(histRef, {
                ...historyEntry,
                balanceAfter: newPoints,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // ⚡ FIX: Crear mensaje en Inbox para que salga en la campanita
            const inboxRef = doc.ref.collection('inbox').doc();
            // 🔄 TEMPLATE LOGIC (Backend Source of Truth)
            let inboxTitle = `¡Sumaste ${points} Puntos!`;
            let inboxBody = `Se acreditaron en tu cuenta.`;
            let inboxType = "system";

            // Try to fetch specific template if possible, or use hardcoded "Golden Path" matches
            try {
                // Determine Template ID based on reason
                let tplId = 'bono_manual';
                if (reason === 'welcome_signup') tplId = 'bienvenida';
                if (reason === 'profile_address') tplId = 'premio_domicilio'; // Hypothetical

                const tplSnap = await db.collection('plantillas').doc(tplId).get();
                if (tplSnap.exists) {
                    const tpl = tplSnap.data();
                    // Replace placeholders
                    if (tpl.titulo_push) inboxTitle = tpl.titulo_push.replace('{puntos}', points);
                    if (tpl.cuerpo_push) inboxBody = tpl.cuerpo_push.replace('{puntos}', points);
                    inboxType = "premio"; // Assume prize
                } else {
                    // Fallbacks (User specific requests)
                    if (reason === 'profile_address') {
                        inboxTitle = `🎁 ¡Sumaste ${points} Puntos!`;
                        inboxBody = `Gracias por completar tu domicilio.`;
                        inboxType = "premio";
                    } else if (reason === 'welcome_signup') {
                        inboxTitle = `👋 ¡Bienvenido! Sumaste ${points} Puntos`;
                        inboxBody = `Regalo de bienvenida para empezar.`;
                        inboxType = "premio";
                    }
                }
            } catch (e) {
                console.warn('Template fetch failed, using fallback', e);
            }

            tx.set(inboxRef, {
                title: inboxTitle,
                body: inboxBody,
                titulo: inboxTitle, // ⚡ FIX: Compatibilidad UI
                cuerpo: inboxBody,  // ⚡ FIX: Compatibilidad UI
                ts: Date.now(),
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                tipo: inboxType, // Para ícono en UI
                read: false, // ⚡ FIX: Mark as unread for badge count
                source: 'assign-points',
                expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 90 * 24 * 60 * 60 * 1000))
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
