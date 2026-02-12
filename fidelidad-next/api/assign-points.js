
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
            const searchPromises = [];

            // Determinar si la búsqueda es puramente numérica
            const isNumeric = /^\d+$/.test(q);
            const qNum = isNumeric ? Number(q) : null;

            // 1. Búsquedas por Socio (Paralelo)
            // Búsqueda por prefijo de texto (si existe como texto)
            searchPromises.push(db.collection('users').where('socioNumber', '>=', q).where('socioNumber', '<=', q + '\uf8ff').limit(5).get());
            searchPromises.push(db.collection('users').where('numeroSocio', '>=', q).where('numeroSocio', '<=', q + '\uf8ff').limit(5).get());
            searchPromises.push(db.collection('users').where('socio_number', '>=', q).where('socio_number', '<=', q + '\uf8ff').limit(5).get());

            // 2. Búsqueda por coincidencia exacta de NÚMERO (Importante para tipos numéricos)
            if (isNumeric) {
                searchPromises.push(db.collection('users').where('socioNumber', '==', qNum).limit(5).get());
                searchPromises.push(db.collection('users').where('numeroSocio', '==', qNum).limit(5).get());
                searchPromises.push(db.collection('users').where('socio_number', '==', qNum).limit(5).get());
            }

            // 3. Búsqueda por DNI (prefijo)
            searchPromises.push(db.collection('users').where('dni', '>=', q).where('dni', '<=', q + '\uf8ff').limit(5).get());

            // 4. Búsqueda por Nombre (intentar raw y capitalizado)
            searchPromises.push(db.collection('users').where('name', '>=', q).where('name', '<=', q + '\uf8ff').limit(5).get());
            const capitalized = q.charAt(0).toUpperCase() + q.slice(1);
            if (capitalized !== q) {
                searchPromises.push(db.collection('users').where('name', '>=', capitalized).where('name', '<=', capitalized + '\uf8ff').limit(5).get());
            }

            // Ejecutar todas las búsquedas en PARALELO
            const statusSnaps = await Promise.all(searchPromises);

            statusSnaps.forEach(snap => {
                snap.docs.forEach(d => {
                    const data = d.data();
                    if (!results.has(d.id)) {
                        results.set(d.id, {
                            id: d.id,
                            name: data.name || data.nombre,
                            dni: data.dni,
                            socioNumber: data.socioNumber || data.numeroSocio || data.socio_number,
                            phone: data.phone || data.telefono,
                            accumulated_balance: data.accumulated_balance || 0
                        });
                    }
                });
            });

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

                // Tipos permitidos (SOLO FIXED y MULTIPLIER en este contexto)
                if (b.rewardType === 'FIXED' || b.rewardType === 'MULTIPLIER') {
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

        // 4. Determinar Monto de Puntos y Saldo Acumulado
        let points = 0;
        let newAccumulatedBalance = 0;
        const finalAmount = amountOverride || amount;

        if (isAdmin && finalAmount) {
            // Obtener saldo acumulado actual del cliente para el cálculo
            const clientSnap = await db.collection('users').doc(targetUid).get();
            const currentAccumulated = clientSnap.exists ? Number(clientSnap.data().accumulated_balance || 0) : 0;

            let basePoints = 0;
            if (reason === 'external_integration') {
                // APLICAR CONVERSIÓN OFICIAL CON SALDO ACUMULADO
                const base = Number(config.pointsMoneyBase) || 100;
                const ratio = Number(config.pointsPerPeso) || 1;

                const totalVal = Number(finalAmount) + currentAccumulated;
                basePoints = Math.floor((totalVal / base) * ratio);
                newAccumulatedBalance = totalVal % base;
            } else {
                // Modo Manual (ya viene en puntos)
                basePoints = Number(finalAmount);
                newAccumulatedBalance = currentAccumulated;
            }

            let promoDetails = "";
            // Aplicar Bonos/Promociones seleccionadas (ahora disponible para ambos modos desde el Admin)
            if (bonusIds && Array.isArray(bonusIds) && bonusIds.length > 0) {
                let totalBonus = 0;
                let totalMultiplier = 1;

                const bonusSnaps = await Promise.all(bonusIds.map(bid => db.collection('campanas').doc(bid).get()));
                bonusSnaps.forEach(bsnap => {
                    if (bsnap.exists) {
                        const b = bsnap.data();
                        if (b.rewardType === 'FIXED') totalBonus += (Number(b.rewardValue) || 0);
                        if (b.rewardType === 'MULTIPLIER') totalMultiplier *= (Number(b.rewardValue) || 1);

                        const bonusAction = b.rewardType === 'MULTIPLIER' ? `x${b.rewardValue}` : `+${b.rewardValue}`;
                        promoDetails += (promoDetails ? ", " : " + Bono: ") + (b.name || b.title || "Promo") + ` (${bonusAction})`;
                    }
                });

                points = Math.floor(basePoints * totalMultiplier) + totalBonus;
            } else {
                points = basePoints;
            }

            // Expose it to the transaction logic
            req.body.calculatedPromoDetails = promoDetails;
        } else {
            // Modo Reglas de Negocio (Bienvenida, Dirección, etc)
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

        const now = new Date();
        const argentinaOffset = -3 * 60 * 60 * 1000;
        const nowArg = new Date(now.getTime() + argentinaOffset);
        const todayStr = nowArg.toISOString().split('T')[0];

        // Support custom purchase date or default to now
        let recordDate = new Date();
        if (req.body?.date) {
            // Si la fecha coincide con hoy, mantenemos la hora actual para precisión en heatmap
            if (req.body.date === todayStr) {
                recordDate = new Date(); // Hora actual
            } else {
                recordDate = new Date(req.body.date + 'T12:00:00');
            }
        }

        // Default expiration: 365 days
        const expirationDate = new Date(recordDate);
        expirationDate.setDate(expirationDate.getDate() + 365);
        const validityDays = 365; // Legacy field support

        const data = await db.runTransaction(async (tx) => {
            const docSnapshot = await tx.get(clientRef);
            if (!docSnapshot.exists) throw new Error("Client not found");
            const data = docSnapshot.data();

            // Chequeo de duplicados (solo para razones fijas, no para integraciones externas)
            if (reason !== 'external_integration' && data.rewards_awarded && data.rewards_awarded[reason]) {
                throw new Error("ALREADY_AWARDED");
            }

            // PRE-READ REFERRER (Must be done before any writes)
            let referrerSnap = null;
            const referralEnabled = reason === 'external_integration' && config.referrals?.enabled;
            const referredBy = data.referredBy;
            const referralAlreadyProcessed = data.referralStats?.processed || false;

            if (referralEnabled && referredBy && !referralAlreadyProcessed) {
                referrerSnap = await tx.get(db.collection('users').doc(referredBy));
            }

            // --- CÁLCULO DE PUNTOS PARA EL CLIENTE ---
            const currentPoints = Number(data.points || data.puntos || 0);
            const newPoints = currentPoints + points;

            const baseConcept = concept || (
                reason === 'welcome_signup' ? 'Puntos de Bienvenida' :
                    (reason === 'profile_address' ? 'Premio por completar dirección' : 'Compra en local')
            );
            const finalConcept = baseConcept + (req.body?.calculatedPromoDetails || "");

            // --- ESCRITURAS (WRITES) ---

            // 1. Actualización del Cliente (Invitado)
            const clientUpdate = {
                points: newPoints,
                puntos: newPoints,
                accumulated_balance: newAccumulatedBalance,
                [`rewards_awarded.${reason}`]: true,
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                historialPuntos: admin.firestore.FieldValue.arrayUnion({
                    fechaObtencion: admin.firestore.Timestamp.fromDate(recordDate),
                    puntosObtenidos: points,
                    puntosDisponibles: points,
                    diasCaducidad: validityDays,
                    origen: finalConcept,
                    estado: 'Activo'
                })
            };

            // Si hay referido a procesar, agregarlo a la actualización del cliente
            if (referrerSnap && referrerSnap.exists) {
                clientUpdate['referralStats.processed'] = true;
                clientUpdate['referralStats.processedAt'] = admin.firestore.FieldValue.serverTimestamp();
            }

            tx.update(clientRef, clientUpdate);

            // 2. Log Historial Cliente
            const histRef = clientRef.collection('points_history').doc();
            const moneySpent = req.body?.moneySpent || (reason === 'external_integration' && finalAmount ? Number(finalAmount) : 0);
            tx.set(histRef, {
                amount: points,
                moneySpent: moneySpent,
                type: 'credit',
                reason: reason || 'manual',
                concept: finalConcept,
                metadata: metadata || {},
                date: admin.firestore.Timestamp.fromDate(recordDate),
                createdAt: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                remainingPoints: points,
                balanceAfter: newPoints
            });

            // 3. Inbox Cliente
            tx.set(clientRef.collection('inbox').doc(), {
                title: '¡Puntos Sumados! 💰',
                body: `¡Has sumado ${points} puntos! (${finalConcept})`,
                url: '/mis-puntos',
                type: 'pointsAdded',
                read: false,
                date: admin.firestore.FieldValue.serverTimestamp(),
                sentAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // 4. Transacción Global
            tx.set(db.collection('transactions').doc(), {
                uid: targetUid,
                clientName: data.name || data.nombre || 'Sin nombre',
                socioNumber: data.socioNumber || data.numeroSocio || 'N/A',
                points: points,
                amount: moneySpent,
                moneySpent: moneySpent,
                type: 'credit',
                reason: reason || 'manual',
                concept: finalConcept,
                date: admin.firestore.Timestamp.fromDate(recordDate),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            result = { ok: true, pointsAdded: points, newBalance: newPoints };

            // --- LÓGICA DE RECOMPENSA AL REFERENTE (Escrituras) ---
            if (referrerSnap && referrerSnap.exists) {
                const rData = referrerSnap.data();
                const bonusAmount = Number(config.referrals.pointsForReferrer) || 200;
                const referrerName = rData.name || 'Referente';
                const referrerRef = referrerSnap.ref;

                // 1. Sumar puntos al Referente
                const oldPoints = Number(rData.points || 0);
                const newReferrerPoints = oldPoints + bonusAmount;

                tx.update(referrerRef, {
                    points: newReferrerPoints,
                    puntos: newReferrerPoints,
                    'referralStats.count': admin.firestore.FieldValue.increment(1),
                    'referralStats.pointsEarned': admin.firestore.FieldValue.increment(bonusAmount),
                    historialPuntos: admin.firestore.FieldValue.arrayUnion({
                        fechaObtencion: admin.firestore.Timestamp.fromDate(new Date()),
                        puntosObtenidos: bonusAmount,
                        puntosDisponibles: bonusAmount,
                        diasCaducidad: 365,
                        origen: `Bono Invitado: ${data.name || 'Amigo'}`,
                        estado: 'Activo'
                    })
                });

                // 2. Historial Referente
                tx.set(referrerRef.collection('points_history').doc(), {
                    amount: bonusAmount,
                    type: 'credit',
                    reason: 'referral_bonus',
                    concept: `Bono Invitado: ${data.name || 'Amigo'}`,
                    date: admin.firestore.Timestamp.fromDate(new Date()),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 365 * 86400000)),
                    remainingPoints: bonusAmount,
                    balanceAfter: newReferrerPoints
                });

                // 3. Inbox Referente
                tx.set(referrerRef.collection('inbox').doc(), {
                    title: '¡Puntos por Referido! 🎁',
                    body: `Tu amigo ${data.name || 'alguien'} realizó su primer consumo. ¡Ganaste ${bonusAmount} puntos!`,
                    url: '/referrals',
                    type: 'referralBonus',
                    read: false,
                    date: admin.firestore.FieldValue.serverTimestamp()
                });

                // 4. Transacción Global Bono
                tx.set(db.collection('transactions').doc(), {
                    uid: referredBy,
                    clientName: referrerName,
                    points: bonusAmount,
                    type: 'credit',
                    reason: 'referral_bonus',
                    concept: `Bono Invitado: ${data.name || 'Amigo'}`,
                    date: admin.firestore.FieldValue.serverTimestamp()
                });

                // Flag para notificar push luego
                result.referrerToNotify = {
                    uid: referredBy,
                    msg: `¡Ganaste ${bonusAmount} puntos porque tu amigo ${data.name || 'alguien'} se sumó al club!`
                };
            }

            return data;
        });

        // 6. NOTIFICACIONES Y MENSAJERÍA (Fuera de la transacción para evitar re-intentos innecesarios)
        try {
            const messagingCfg = config.messaging || {};
            const event = 'pointsAdded';
            const templates = messagingCfg.templates || {};
            const eventConfig = messagingCfg.eventConfigs?.[event];
            const channels = eventConfig?.channels || [];

            // Construir MENSAJE UNIFICADO (desde plantilla del panel)
            let unifiedMsg = templates[event] || "¡Sumaste {puntos} puntos! Tu saldo actual es {saldo}.";
            const fullName = data.name || data.nombre || req.body?.clientName || 'Cliente';
            const firstName = fullName.split(' ')[0];

            unifiedMsg = unifiedMsg.replace(/{nombre}/g, firstName)
                .replace(/{nombre_completo}/g, fullName)
                .replace(/{puntos}/g, points.toString())
                .replace(/{saldo}/g, (result.newBalance || 0).toString())
                .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

            const isPushEnabled = messagingCfg.pushEnabled && channels.includes('push');
            const isEmailEnabled = messagingCfg.emailEnabled && channels.includes('email');

            if (isPushEnabled || isEmailEnabled) {
                // Prioritize CURRENT HOST to bypass Vercel Deployment Protection on unique URLs
                const currentHost = req.headers.host;
                const baseUrl = currentHost ? `https://${currentHost}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

                const SECRET = (process.env.API_SECRET_KEY || process.env.MI_API_SECRET || process.env.VITE_API_KEY || "").trim();
                const internalAuth = { 'x-api-key': SECRET, 'x-api-secret': SECRET };
                const notifications = [];

                if (isPushEnabled) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-notification`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                clienteId: targetUid,
                                title: '¡Puntos Sumados! 💰',
                                body: unifiedMsg,
                                icon: config.logoUrl || '/logo.png',
                                extraData: { skipInbox: true, source: 'extension_or_panel' }
                            })
                        }).then(r => r.json().then(d => console.log("[assign-points] Push result:", r.status, d))).catch(err => console.error("Push error:", err))
                    );
                }

                if (isEmailEnabled && (data.email || data.correo || req.body?.clientEmail)) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                to: data.email || data.correo || req.body.clientEmail,
                                templateId: 'manual_override',
                                templateData: {
                                    subject: '¡Has sumado puntos! 💰',
                                    htmlContent: unifiedMsg
                                }
                            })
                        }).then(r => r.json().then(d => console.log("[assign-points] Email result:", r.status, d))).catch(err => console.error("Email error:", err))
                    );
                }

                if (notifications.length > 0) {
                    console.log(`[assign-points] Triggering ${notifications.length} notifications. SecretLen: ${SECRET.length}`);
                    await Promise.allSettled(notifications);
                }

                // --- NOTIFICACIÓN ADICIONAL AL REFERIDOR ---
                if (result.referrerToNotify) {
                    const { uid: rUid, msg: rMsg } = result.referrerToNotify;
                    await fetch(`${baseUrl}/api/send-notification`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', ...internalAuth },
                        body: JSON.stringify({
                            clienteId: rUid,
                            title: '¡Bono de Referido! 🎁',
                            body: rMsg,
                            icon: config.logoUrl || '/logo.png',
                            extraData: { skipInbox: true }
                        })
                    }).catch(e => console.error("Referrer notification error:", e));
                }
            }
        } catch (notifyErr) {
            console.error("Error triggering notifications outside tx:", notifyErr);
        }

        return res.status(200).json(result);

    } catch (error) {
        if (error.message === "ALREADY_AWARDED") {
            return res.status(200).json({ ok: true, message: "Already awarded", pointsAdded: 0 });
        }
        console.error("assign-points error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
