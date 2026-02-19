
// api/assign-points.js
// Asigna puntos a un cliente de forma segura.
// Soporta modo ADMIN (x-api-key) y modo USUARIO (Token Firebase).

import admin from "firebase-admin";
import { updateNextExpirationDate } from "./_expiration-utils.js";

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
                            accumulated_balance: data.accumulated_balance ?? 0
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
            const currentAccumulated = clientSnap.exists ? Number(clientSnap.data().accumulated_balance ?? 0) : 0;

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

        if (points < 0) return res.status(400).json({ ok: false, error: "Negative points not allowed" });

        // 5. Idempotencia & Transacción
        const clientRef = db.collection("users").doc(targetUid);
        let result = { ok: false, debug: {} };

        const now = new Date();
        const argentinaOffset = -3 * 60 * 60 * 1000;
        const nowArg = new Date(now.getTime() + argentinaOffset);
        const todayStr = nowArg.toISOString().split('T')[0];

        let recordDate = new Date();
        if (req.body?.date) {
            if (req.body.date === todayStr) recordDate = new Date();
            else recordDate = new Date(req.body.date + 'T12:00:00');
        }

        // 5. Determinar Días de Validez (Escalas)
        const expirationRules = config.expirationRules || [];
        function getValidityDays(pts, rules) {
            if (!rules || rules.length === 0) return 365;

            // Ordenamos por puntos mínimos para garantizar orden lógico
            const sortedRules = [...rules].sort((a, b) => (Number(a.minPoints) || 0) - (Number(b.minPoints) || 0));

            // 1. Intentar match exacto de rango
            const match = sortedRules.find(r =>
                pts >= (Number(r.minPoints) || 0) &&
                (r.maxPoints === null || r.maxPoints === undefined || pts <= Number(r.maxPoints))
            );

            if (match) return Number(match.validityDays) || 365;

            // 2. Fallback: Si supera el valor más alto de la tabla, aplicamos la regla superior
            const highestRule = sortedRules[sortedRules.length - 1];
            if (pts >= (Number(highestRule.minPoints) || 0)) {
                return Number(highestRule.validityDays) || 365;
            }

            return 365;
        }

        const validityDays = getValidityDays(points, expirationRules);
        const expirationDate = new Date(recordDate);
        expirationDate.setDate(expirationDate.getDate() + validityDays);

        await db.runTransaction(async (tx) => {
            const clientSnap = await tx.get(clientRef);
            if (!clientSnap.exists) throw new Error("Client not found");
            const cData = clientSnap.data();

            // Lógica de Referidos (Pre-lectura)
            let referrerSnap = null;
            const isExternal = reason === 'external_integration';
            const hasReferrer = !!cData.referredBy;
            const isReferralEnabled = config.referrals && (config.referrals.enabled === true || config.referrals.enabled === 'true');
            const alreadyProcessed = cData.referralStats?.processed === true;

            result.debug = { isExternal, hasReferrer, isReferralEnabled, alreadyProcessed, referredBy: cData.referredBy };

            if (isExternal && isReferralEnabled && hasReferrer && !alreadyProcessed) {
                const referrerRef = db.collection('users').doc(cData.referredBy);
                referrerSnap = await tx.get(referrerRef);
            }

            // --- ACTUALIZACIÓN DEL CLIENTE (INVITADO) ---
            if (points > 0) {
                const currentPoints = Number((cData.points !== undefined) ? cData.points : (cData.puntos ?? 0));
                const newPoints = currentPoints + points;
                const finalConcept = (concept || (reason === 'welcome_signup' ? 'Puntos de Bienvenida' : (reason === 'profile_address' ? 'Premio por completar dirección' : 'Compra en local'))) + (req.body?.calculatedPromoDetails || "");

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

                // Si hay referido válido, marcarlo aquí mismo
                if (referrerSnap && referrerSnap.exists) {
                    clientUpdate['referralStats.processed'] = true;
                    clientUpdate['referralStats.processedAt'] = admin.firestore.FieldValue.serverTimestamp();
                }

                tx.update(clientRef, clientUpdate);

                // Logs e Inbox
                const moneySpent = req.body?.moneySpent || (reason === 'external_integration' && finalAmount ? Number(finalAmount) : 0);
                tx.set(clientRef.collection('points_history').doc(), {
                    amount: points, moneySpent, type: 'credit', reason: reason || 'manual', concept: finalConcept,
                    date: admin.firestore.Timestamp.fromDate(recordDate), createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(expirationDate), remainingPoints: points, balanceAfter: newPoints
                });

                tx.set(clientRef.collection('inbox').doc(), {
                    title: '¡Puntos Sumados! 💰', body: `¡Has sumado ${points} puntos! (${finalConcept})`,
                    url: '/mis-puntos', type: 'pointsAdded', read: false, date: admin.firestore.FieldValue.serverTimestamp()
                });

                tx.set(db.collection('transactions').doc(), {
                    uid: targetUid, clientName: cData.name || 'Socio', points, amount: moneySpent, type: 'credit',
                    reason: reason || 'manual', concept: finalConcept, date: admin.firestore.Timestamp.fromDate(recordDate)
                });

                result.ok = true;
                result.pointsAdded = points;
                result.newBalance = newPoints;
            } else {
                // Si los puntos son 0 pero hay un referido que procesar, aún queremos marcarlo
                if (referrerSnap && referrerSnap.exists) {
                    tx.update(clientRef, {
                        'referralStats.processed': true,
                        'referralStats.processedAt': admin.firestore.FieldValue.serverTimestamp()
                    });
                    result.ok = true;
                    result.message = "Referral processed without points for guest";
                } else {
                    result.ok = true;
                    result.message = "No points added, no referral to process";
                }
            }

            // --- RECOMPENSA AL REFERENTE ---
            if (referrerSnap && referrerSnap.exists) {
                const rData = referrerSnap.data();
                const referralBonusAmount = Number(config.referrals?.pointsForReferrer) || 200;
                const rRef = referrerSnap.ref;
                const newRPoints = (Number(rData.points) || 0) + referralBonusAmount;

                const rValidityDays = getValidityDays(referralBonusAmount, expirationRules);
                const rExpirationDate = new Date();
                rExpirationDate.setDate(rExpirationDate.getDate() + rValidityDays);

                tx.update(rRef, {
                    points: newRPoints,
                    puntos: newRPoints,
                    'referralStats.count': admin.firestore.FieldValue.increment(1),
                    'referralStats.pointsEarned': admin.firestore.FieldValue.increment(referralBonusAmount),
                    historialPuntos: admin.firestore.FieldValue.arrayUnion({
                        fechaObtencion: admin.firestore.Timestamp.fromDate(new Date()),
                        puntosObtenidos: referralBonusAmount,
                        puntosDisponibles: referralBonusAmount,
                        diasCaducidad: rValidityDays,
                        origen: `Bono Invitado: ${cData.name || 'Amigo'}`,
                        estado: 'Activo'
                    })
                });

                tx.set(rRef.collection('points_history').doc(), {
                    amount: referralBonusAmount, type: 'credit', reason: 'referral_bonus', concept: `Bono Invitado: ${cData.name || 'Amigo'}`,
                    date: admin.firestore.Timestamp.fromDate(new Date()), createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(rExpirationDate), remainingPoints: referralBonusAmount, balanceAfter: newRPoints
                });

                tx.set(rRef.collection('inbox').doc(), {
                    title: '¡Puntos por Referido! 🎁', body: `Tu amigo ${cData.name || 'alguien'} realizó su primer consumo. ¡Ganaste ${bonusAmount} puntos!`,
                    url: '/referrals', type: 'referralBonus', read: false, date: admin.firestore.FieldValue.serverTimestamp()
                });

                tx.set(db.collection('transactions').doc(), {
                    uid: rRef.id, clientName: rData.name || 'Referente', points: bonusAmount, type: 'credit',
                    reason: 'referral_bonus', concept: `Bono Invitado: ${cData.name || 'Amigo'}`, date: admin.firestore.FieldValue.serverTimestamp()
                });

                result.referrerToNotify = {
                    uid: rRef.id,
                    email: rData.email || rData.correo,
                    name: rData.name || 'Socio',
                    friendName: cData.name || 'Tu amigo',
                    bonusAmount: bonusAmount
                };
                result.referralProcessed = true;
            }

            // Hacer disponibles los datos básicos para las notificaciones fuera de la tx
            result.guestData = {
                name: cData.name || 'Socio',
                phone: cData.phone || cData.telefono || '',
                email: cData.email || cData.correo,
                dni: cData.dni || '',
                socioNumber: cData.socioNumber || cData.numeroSocio || cData.socio_number || ''
            };

            // AUDITORIA: Agregar detalle de los puntos sumados
            if (!result.auditDetails) result.auditDetails = [];
            result.auditDetails.push({
                userId: targetUid,
                userName: result.guestData.name,
                dni: result.guestData.dni,
                socioNumber: result.guestData.socioNumber,
                points,
                action: 'points_credited',
                status: 'success',
                info: `+${points} pts (${(concept || 'Carga manual')})`,
                timestamp: new Date().toISOString()
            });
        });

        // 5.5 ACTUALIZAR METADATA DE VENCIMIENTOS (Cache)
        if (result.ok && points > 0) {
            // No bloqueamos la respuesta, pero lo ejecutamos
            updateNextExpirationDate(db, targetUid).catch(err => console.error("Error updating expiration date:", err));
        }

        // 6. NOTIFICACIONES Y MENSAJERÍA (Fuera de la transacción para evitar re-intentos innecesarios)
        try {
            const messagingCfg = config.messaging || {};
            const SECRET = (process.env.API_SECRET_KEY || process.env.MI_API_SECRET || process.env.VITE_API_KEY || "").trim();
            const internalAuth = { 'x-api-key': SECRET, 'x-api-secret': SECRET };

            const currentHost = req.headers.host;
            const baseUrl = currentHost ? `https://${currentHost}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

            // Executor for Audit Logs
            let executor = 'admin';
            if (authHeader && authHeader.startsWith("Bearer ")) {
                const token = authHeader.split("Bearer ")[1];
                try {
                    const decoded = await getAuth().verifyIdToken(token);
                    executor = decoded.email || decoded.uid || 'admin';
                } catch (e) {
                    console.error("Executor extraction error:", e.message);
                }
            }

            // WhatsApp Logic (Generation for Panel)
            const event = 'pointsAdded';
            const templates = messagingCfg.templates || {};
            const eventConfig = messagingCfg.eventConfigs?.[event];
            const channels = eventConfig?.channels || [];
            const isWhatsAppConfigured = messagingCfg.whatsappEnabled && channels.includes('whatsapp');

            if (applyWhatsApp && points > 0) {
                if (isWhatsAppConfigured) {
                    let waMsg = templates[event] || "¡Sumaste {puntos} puntos! Tu saldo actual es {saldo}.";
                    const fullName = result.guestData.name || 'Cliente';
                    const firstName = fullName.split(' ')[0];

                    waMsg = waMsg.replace(/{nombre}/g, firstName)
                        .replace(/{nombre_completo}/g, fullName)
                        .replace(/{puntos}/g, points.toString())
                        .replace(/{saldo}/g, (result.newBalance || 0).toString())
                        .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

                    const phone = (result.guestData.phone || '').replace(/\D/g, '');
                    if (phone.length >= 8) {
                        result.whatsappLink = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(waMsg.trim())}`;

                        // Audit Log (Manual) - ACUMULAR
                        result.auditDetails.push({
                            userId: targetUid,
                            userName: result.guestData.name,
                            dni: result.guestData.dni || '',
                            socioNumber: result.guestData.socioNumber || '',
                            points,
                            action: 'whatsapp_link_generated',
                            status: 'link_ready',
                            timestamp: new Date().toISOString()
                        });
                    }
                } else {
                    // Log Skip: Config Disabled
                    // Log Skip: Config Disabled - ACUMULAR
                    result.auditDetails.push({
                        userId: targetUid,
                        userName: result.guestData.name,
                        dni: result.guestData.dni || '',
                        socioNumber: result.guestData.socioNumber || '',
                        action: 'whatsapp_skipped',
                        status: 'skipped',
                        info: 'Canal desactivado en configuración',
                        reason: 'config_disabled'
                    });
                }
            } else if (points > 0) {
                // Log Skip: Not checked in UI
                // Log Skip: Not checked in UI - ACUMULAR
                result.auditDetails.push({
                    userId: targetUid,
                    userName: result.guestData.name,
                    dni: result.guestData.dni || '',
                    socioNumber: result.guestData.socioNumber || '',
                    action: 'whatsapp_skipped',
                    status: 'skipped',
                    info: 'Checkbox sin marcar',
                    reason: 'checkbox_off'
                });
            }

            const notifications = [];

            // --- 6.1 NOTIFICACIÓN AL CLIENTE (INVITADO) ---
            if (points > 0) {
                let unifiedMsg = templates[event] || "¡Sumaste {puntos} puntos! Tu saldo actual es {saldo}.";
                const fullName = result.guestData.name || 'Cliente';
                const firstName = fullName.split(' ')[0];

                unifiedMsg = unifiedMsg.replace(/{nombre}/g, firstName)
                    .replace(/{nombre_completo}/g, fullName)
                    .replace(/{puntos}/g, points.toString())
                    .replace(/{saldo}/g, (result.newBalance || 0).toString())
                    .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

                const isPushConfigured = messagingCfg.pushEnabled && channels.includes('push');
                const isEmailConfigured = messagingCfg.emailEnabled && channels.includes('email');

                if (isPushConfigured) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-notification`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                clienteId: targetUid, title: '¡Puntos Sumados! 💰', body: unifiedMsg,
                                icon: config.logoUrl || '/logo.png',
                                points, executor,
                                extraData: { skipInbox: true, source: 'extension_or_panel' }
                            })
                        }).then(() => {
                            result.auditDetails.push({ userId: targetUid, userName: result.guestData.name, action: 'push_sent', status: 'success' });
                        }).catch(err => {
                            console.error("Push error (guest):", err);
                            result.auditDetails.push({ userId: targetUid, userName: result.guestData.name, action: 'push_error', status: 'failed', info: err.message });
                        })
                    );
                } else {
                    // Log Push Skip - ACUMULAR
                    result.auditDetails.push({
                        userId: targetUid,
                        userName: result.guestData.name,
                        dni: result.guestData.dni || '',
                        socioNumber: result.guestData.socioNumber || '',
                        action: 'push_skipped',
                        status: 'skipped',
                        reason: 'config_disabled'
                    });
                }

                if (isEmailConfigured && result.guestData.email) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                to: result.guestData.email,
                                templateId: 'manual_override',
                                points, executor,
                                templateData: { subject: '¡Has sumado puntos! 💰', htmlContent: unifiedMsg }
                            })
                        }).then(() => {
                            result.auditDetails.push({ userId: targetUid, userName: result.guestData.name, action: 'email_sent', status: 'success' });
                        }).catch(err => {
                            console.error("Email error (guest):", err);
                            result.auditDetails.push({ userId: targetUid, userName: result.guestData.name, action: 'email_error', status: 'failed', info: err.message });
                        })
                    );
                } else if (result.guestData.email) {
                    // Log Email Skip - ACUMULAR
                    result.auditDetails.push({
                        userId: targetUid,
                        userName: result.guestData.name,
                        dni: result.guestData.dni || '',
                        socioNumber: result.guestData.socioNumber || '',
                        action: 'email_skipped',
                        status: 'skipped',
                        reason: 'config_disabled'
                    });
                }
            }

            // --- 6.2 NOTIFICACIÓN AL REFERENTE (SI APLICA) ---
            if (result.referrerToNotify) {
                const rInfo = result.referrerToNotify;
                const event = 'referralReward';
                const templates = messagingCfg.templates || {};
                const eventConfig = messagingCfg.eventConfigs?.[event];
                const channels = eventConfig?.channels || ['push', 'email']; // Default if not set

                let rMsg = templates[event] || "¡Hola {nombre}! 🎉 Ganaste {puntos} puntos porque tu amigo {amigo} comenzó a usar el club.";
                const rFirstName = (rInfo.name || 'Socio').split(' ')[0];

                rMsg = rMsg.replace(/{nombre}/g, rFirstName)
                    .replace(/{amigo}/g, rInfo.friendName)
                    .replace(/{puntos}/g, rInfo.bonusAmount.toString())
                    .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

                const isPushEnabled = messagingCfg.pushEnabled && channels.includes('push');
                const isEmailEnabled = messagingCfg.emailEnabled && channels.includes('email');

                if (isPushEnabled) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-notification`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                clienteId: rInfo.uid, title: '¡Bono de Referido! 🎁', body: rMsg,
                                icon: config.logoUrl || '/logo.png',
                                points: rInfo.bonusAmount, executor,
                                extraData: { skipInbox: true }
                            })
                        }).then(() => {
                            result.auditDetails.push({ userId: rInfo.uid, userName: rInfo.name, action: 'push_sent_referrer', status: 'success' });
                        }).catch(err => {
                            result.auditDetails.push({ userId: rInfo.uid, userName: rInfo.name, action: 'push_error_referrer', status: 'failed', info: err.message });
                        })
                    );
                }

                if (isEmailEnabled && rInfo.email) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                to: rInfo.email,
                                points: rInfo.bonusAmount, executor,
                                templateId: 'manual_override',
                                templateData: { subject: '¡Ganaste un premio de referido! 🎁', htmlContent: rMsg }
                            })
                        }).then(() => {
                            result.auditDetails.push({ userId: rInfo.uid, userName: rInfo.name, action: 'email_sent_referrer', status: 'success' });
                        }).catch(err => {
                            result.auditDetails.push({ userId: rInfo.uid, userName: rInfo.name, action: 'email_error_referrer', status: 'failed', info: err.message });
                        })
                    );
                }
            }

            if (notifications.length > 0) {
                console.log(`[assign-points] Triggering ${notifications.length} notifications.`);
                await Promise.all(notifications);
            }

            // --- FINAL AUDIT LOG (UNIFIED) ---
            if (result.auditDetails && result.auditDetails.length > 0) {
                try {
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'points_assignment',
                        status: 'success',
                        summary: `Asignación de puntos: ${result.guestData.name} (${result.pointsAdded || 0} pts)`,
                        details: result.auditDetails,
                        executor
                    });
                } catch (auditErr) {
                    console.error("Final audit log error:", auditErr);
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
