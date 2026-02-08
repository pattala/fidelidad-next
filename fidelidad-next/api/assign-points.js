
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

// ---------- Handler ----------
export default async function handler(req, res) {
    if (req.method === "OPTIONS") return res.status(204).end();

    // MODO BÚSQUEDA (Para la Extensión)
    if (req.method === "GET") {
        try {
            const db = getDb();
            const { q } = req.query;
            const apiKey = req.headers["x-api-key"];

            if (!apiKey || !process.env.API_SECRET_KEY || apiKey !== process.env.API_SECRET_KEY) {
                return res.status(401).json({ ok: false, error: "Unauthorized" });
            }

            if (!q || q.length < 3) return res.status(200).json({ ok: true, clients: [] });

            const results = new Map();

            // 1. Buscar por Socio Número (prefijo)
            const socioSnap = await db.collection('users')
                .where('socio_number', '>=', q)
                .where('socio_number', '<=', q + '\uf8ff')
                .limit(5)
                .get();
            socioSnap.docs.forEach(d => results.set(d.id, {
                id: d.id,
                name: d.data().name || d.data().nombre,
                dni: d.data().dni,
                socio_number: d.data().socio_number,
                phone: d.data().phone || d.data().telefono
            }));

            // 2. Buscar por DNI (prefijo)
            if (results.size < 5) {
                const dniSnap = await db.collection('users')
                    .where('dni', '>=', q)
                    .where('dni', '<=', q + '\uf8ff')
                    .limit(5)
                    .get();
                dniSnap.docs.forEach(d => {
                    if (!results.has(d.id)) results.set(d.id, {
                        id: d.id,
                        name: d.data().name || d.data().nombre,
                        dni: d.data().dni,
                        socio_number: d.data().socio_number,
                        phone: d.data().phone || d.data().telefono
                    });
                });
            }

            // 3. Buscar por Nombre (prefijo - intentar capitalizado)
            if (results.size < 5) {
                // Firestore prefix search is case-sensitive, so we try raw and capitalized
                const queryParts = [q];
                const capitalized = q.charAt(0).toUpperCase() + q.slice(1);
                if (capitalized !== q) queryParts.push(capitalized);

                for (const qp of queryParts) {
                    const nameSnap = await db.collection('users')
                        .where('name', '>=', qp)
                        .where('name', '<=', qp + '\uf8ff')
                        .limit(5)
                        .get();
                    nameSnap.docs.forEach(d => {
                        if (results.size < 10 && !results.has(d.id)) results.set(d.id, {
                            id: d.id,
                            name: d.data().name || d.data().nombre,
                            dni: d.data().dni,
                            socio_number: d.data().socio_number,
                            phone: d.data().phone || d.data().telefono
                        });
                    });
                }
            }

            // 4. Obtener ratio de conversión oficial (config/general)
            const configSnap = await db.collection('config').doc('general').get();
            const configData = configSnap.exists ? configSnap.data() : {};

            const pointsMoneyBase = Number(configData.pointsMoneyBase) || 100;
            const pointsPerPeso = Number(configData.pointsPerPeso) || 1;

            // 5. Obtener Campañas Activas (Promociones)
            const now = new Date();
            // AJUSTE TIMEZONE: Argentina es UTC-3. 
            // Usamos UTC methods sobre un objeto desplazado para obtener la fecha local de AR de forma consistente en el servidor.
            const nowArg = new Date(now.getTime() - (3 * 60 * 60 * 1000));

            const todayDay = nowArg.getUTCDay();
            const year = nowArg.getUTCFullYear();
            const month = String(nowArg.getUTCMonth() + 1).padStart(2, '0');
            const day = String(nowArg.getUTCDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const campSnap = await db.collection('campanas').where('active', '==', true).get();
            const activePromotions = [];

            campSnap.docs.forEach(doc => {
                const b = doc.data();

                // Filtro de fechas (comparación de strings YYYY-MM-DD)
                if (b.startDate && typeof b.startDate === 'string' && b.startDate > todayStr) return;
                if (b.endDate && typeof b.endDate === 'string' && b.endDate < todayStr) return;

                // Filtro por día de la semana
                if (b.daysOfWeek && Array.isArray(b.daysOfWeek) && b.daysOfWeek.length > 0) {
                    if (!b.daysOfWeek.includes(todayDay)) return;
                }

                // Tipos permitidos
                if (b.rewardType === 'FIXED' || b.rewardType === 'MULTIPLIER' || b.rewardType === 'INFO') {
                    activePromotions.push({
                        id: doc.id,
                        name: b.name || 'Sin nombre',
                        title: b.title || b.name || 'Promoción',
                        rewardType: b.rewardType,
                        rewardValue: Number(b.rewardValue) || 0
                    });
                }
            });

            return res.status(200).json({
                ok: true,
                clients: Array.from(results.values()),
                pointsMoneyBase,
                pointsPerPeso,
                activePromotions,
                todayStr // Para debugging
            });
        } catch (err) {
            return res.status(500).json({ ok: false, error: err.message });
        }
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    try {
        const db = getDb();
        const { uid, reason, amountOverride, amount, concept, metadata, bonusIds, applyWhatsApp } = req.body || {};

        // 1. Autenticación (DUAL MODE)
        let isAdmin = false;
        let requestUid = null;

        const apiKey = req.headers["x-api-key"];
        const authHeader = req.headers["authorization"];

        if (apiKey && process.env.API_SECRET_KEY && apiKey === process.env.API_SECRET_KEY) {
            isAdmin = true; // Modo Admin (Panel o Extensión)
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

        // Si es Usuario intentando asignarse a otro
        if (!isAdmin && uid && uid !== requestUid) {
            return res.status(403).json({ ok: false, error: "Forbidden: Can only assign to self" });
        }

        // 3. Chequeo de Integración Externa
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : {};

        if (reason === 'external_integration') {
            if (config.enableExternalIntegration === false) {
                return res.status(403).json({ ok: false, error: "External integration is disabled in settings" });
            }
        }

        // 4. Determinar Monto de Puntos
        let points = 0;
        const finalAmount = amountOverride || amount;

        if (isAdmin && finalAmount) {
            if (reason === 'external_integration') {
                // APLICAR CONVERSIÓN OFICIAL
                const base = Number(config.pointsMoneyBase) || 100;
                const multiplier = Number(config.pointsPerPeso) || 1;
                let basePoints = Math.floor((Number(finalAmount) / base) * multiplier);

                // Aplicar Bonos/Promociones seleccionadas
                if (bonusIds && Array.isArray(bonusIds) && bonusIds.length > 0) {
                    let totalBonus = 0;
                    let totalMultiplier = 1;

                    const bonusSnaps = await Promise.all(bonusIds.map(bid => db.collection('campanas').doc(bid).get()));
                    bonusSnaps.forEach(bsnap => {
                        if (bsnap.exists) {
                            const b = bsnap.data();
                            if (b.rewardType === 'FIXED') totalBonus += (Number(b.rewardValue) || 0);
                            if (b.rewardType === 'MULTIPLIER') totalMultiplier *= (Number(b.rewardValue) || 1);
                        }
                    });

                    points = Math.floor(basePoints * totalMultiplier) + totalBonus;
                } else {
                    points = basePoints;
                }
            } else {
                let directPoints = Number(finalAmount);
                // También aplicar Bonos/Promociones si vienen en modo manual
                if (bonusIds && Array.isArray(bonusIds) && bonusIds.length > 0) {
                    let totalBonus = 0;
                    let totalMultiplier = 1;

                    const bonusSnaps = await Promise.all(bonusIds.map(bid => db.collection('campanas').doc(bid).get()));
                    bonusSnaps.forEach(bsnap => {
                        if (bsnap.exists) {
                            const b = bsnap.data();
                            if (b.rewardType === 'FIXED') totalBonus += (Number(b.rewardValue) || 0);
                            if (b.rewardType === 'MULTIPLIER') totalMultiplier *= (Number(b.rewardValue) || 1);
                        }
                    });
                    points = Math.floor(directPoints * totalMultiplier) + totalBonus;
                } else {
                    points = directPoints;
                }
            }
        } else {
            // Modo Reglas de Negocio
            if (reason === 'profile_address') {
                const cfgSnap = await db.collection('config').doc('gamification').get();
                const cfg = cfgSnap.exists ? cfgSnap.data() : {};
                points = Number(cfg.pointsForAddress) || 50;
            } else if (reason === 'welcome_signup') {
                points = Number(config.welcomePoints) || 0;
            } else {
                return res.status(400).json({ ok: false, error: "Unknown reason or missing amount" });
            }
        }

        if (points <= 0) return res.status(200).json({ ok: true, pointsAdded: 0, message: "No points to add" });

        // 5. Idempotencia & Transacción
        const clientRef = db.collection("users").doc(targetUid);

        let result = { ok: false };

        await db.runTransaction(async (tx) => {
            const docSnapshot = await tx.get(clientRef);
            if (!docSnapshot.exists) throw new Error("Client not found");
            const data = docSnapshot.data();

            // Chequeo de duplicados (solo para razones fijas, no para integraciones externas)
            if (reason !== 'external_integration' && data.rewards_awarded && data.rewards_awarded[reason]) {
                throw new Error("ALREADY_AWARDED");
            }

            const currentPoints = Number(data.points || data.puntos || 0);
            const newPoints = currentPoints + points;

            tx.update(clientRef, {
                points: newPoints,
                puntos: newPoints,
                [`rewards_awarded.${reason}`]: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Log Historial (Subcollection points_history)
            const histRef = clientRef.collection('points_history').doc();

            // Support custom purchase date
            const recordDate = req.body?.date ? new Date(req.body.date + (req.body.date.includes('T') ? '' : 'T12:00:00')) : new Date();

            // Default expiration: 365 days
            const expirationDate = new Date(recordDate);
            expirationDate.setDate(expirationDate.getDate() + 365);

            tx.set(histRef, {
                amount: points,
                moneySpent: req.body?.moneySpent || (reason === 'external_integration' && finalAmount ? Number(finalAmount) : 0),
                type: 'credit',
                reason: reason || 'manual',
                concept: concept || (reason === 'welcome_signup' ? 'Puntos de Bienvenida' : (reason === 'profile_address' ? 'Premio por completar dirección' : 'Asignación automática')),
                metadata: metadata || {},
                date: recordDate,
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                remainingPoints: points,
                balanceAfter: newPoints
            });

            // Opcional: Crear mensaje en Inbox
            if (reason === 'welcome_signup' || reason === 'external_integration') {
                const inboxRef = clientRef.collection('inbox').doc();
                const title = reason === 'welcome_signup' ? '¡Te damos la bienvenida!' : '¡Sumaste Puntos! 💰';
                const body = reason === 'welcome_signup'
                    ? `Gracias por registrarte. Ya tienes ${points} puntos para empezar a disfrutar nuestros beneficios.`
                    : `Has sumado ${points} puntos por tu compra. Tu nuevo saldo es de ${newPoints} pts.`;

                tx.set(inboxRef, {
                    title,
                    body,
                    type: reason === 'welcome_signup' ? 'welcome' : 'points_earned',
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    isRead: false
                });
            }

            result = { ok: true, pointsAdded: points, newBalance: newPoints };

            // Agregar WhatsApp Link si hay teléfono
            const phone = data.phone || data.telefono;
            if (phone && reason === 'external_integration') {
                const cleanPhone = String(phone).replace(/\D/g, '');
                const msg = `¡Hola! 👋 Sumaste ${points} puntos en tu última compra. ¡Gracias por elegirnos! 🎁`;
                result.whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
            }
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
