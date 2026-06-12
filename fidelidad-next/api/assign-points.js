
// api/assign-points.js
// Asigna puntos a un cliente de forma segura.
// Soporta modo ADMIN (x-api-key) y modo USUARIO (Token Firebase).

import admin from "firebase-admin";
import { updateNextExpirationDate, getValidityDays } from "../utils/_expiration-utils.js";
import { getEffectiveDate, getTrueEffectiveDate } from "../utils/timeUtils.js";

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
            const activePrizes = [];
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
                            points: data.points ?? data.puntos ?? 0,
                            accumulated_balance: data.accumulated_balance ?? 0,
                            pets: data.pets || []  // Incluir mascotas para la extensión
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
            // --- RELOJ SIMULADO ---
            const now = await getEffectiveDate(db, req.query.simulatedDate);
            
            // AJUSTE TIMEZONE: Argentina es UTC-3. 
            // Usamos UTC methods sobre un objeto desplazado para obtener la fecha local de AR de forma consistente en el servidor.
            const nowArg = now;

            const todayDay = nowArg.getDay();
            const year = nowArg.getFullYear();
            const month = String(nowArg.getMonth() + 1).padStart(2, '0');
            const day = String(nowArg.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            // Marketing Dinámico: Obtener hora actual en HH:mm (Local AR)
            const currentHour = String(now.getHours()).padStart(2, '0');
            const currentMin = String(now.getMinutes()).padStart(2, '0');
            const currentTimeStr = `${currentHour}:${currentMin}`;

            const campSnap = await db.collection('campanas').where('active', '==', true).get();
            const activePromotions = [];

            campSnap.docs.forEach(doc => {
                const b = doc.data();

                // 1. Filtro de fechas (comparación de strings YYYY-MM-DD)
                if (b.startDate && typeof b.startDate === 'string' && b.startDate > todayStr) return;
                if (b.endDate && typeof b.endDate === 'string' && b.endDate < todayStr) return;

                // 3. Filtro de hora (Marketing Dinámico / Ofertas Flash)
                // Usamos un buffer de tolerancia para el GET para que el front pueda mostrar "TOLERANCIA"
                const flashGrace = b.isFlash ? ((b.flashGraceMins !== undefined && b.flashGraceMins !== null && !isNaN(Number(b.flashGraceMins))) ? Number(b.flashGraceMins) : 15) : 0;

                if (b.startTime && typeof b.startTime === 'string' && b.startTime > currentTimeStr) return;

                if (b.endTime && typeof b.endTime === 'string') {
                    // Si ya pasó la hora final, verificar si está dentro del buffer de tolerancia
                    const [endH, endM] = b.endTime.split(':').map(Number);
                    const endTimestamp = new Date(now);
                    endTimestamp.setHours(endH, endM + flashGrace, 0, 0);

                    if (now > endTimestamp) return; // Excedió la tolerancia (o la hora final si grace es 0)
                }

                // 2. Filtro por día de la semana (priorizar flashDays si es isFlash)
                const targetDays = b.isFlash ? b.flashDays : b.daysOfWeek;
                if (targetDays && Array.isArray(targetDays) && targetDays.length > 0) {
                    if (!targetDays.includes(todayDay)) return;
                }

                // Determinar Recompensa (Priorizar Flash si estamos dentro del filtro y es flash)
                const isApplyingFlash = b.isFlash;
                const rType = isApplyingFlash ? (b.flashRewardType || b.rewardType) : b.rewardType;
                const rValue = isApplyingFlash ? (Number(b.flashRewardValue) ?? b.rewardValue) : b.rewardValue;
                const rText = isApplyingFlash ? (b.flashRewardText || b.rewardText) : b.rewardText;

                // Tipos permitidos (SOLO FIXED, MULTIPLIER, TEXT en este contexto si es flash, o los estándar)
                if (rType === 'FIXED' || rType === 'MULTIPLIER' || rType === 'TEXT' || rType === 'INFO') {
                    activePromotions.push({
                        id: doc.id,
                        name: b.name || 'Sin nombre',
                        title: isApplyingFlash ? (b.flashTitle || b.title || b.name || 'Flash') : (b.title || b.name || 'Promoción'),
                        description: isApplyingFlash ? (b.flashDescription || b.description || '') : (b.description || ''),
                        rewardType: rType,
                        rewardValue: Number(rValue) || 0,
                        rewardText: rText,
                        isFlash: b.isFlash,
                        startTime: b.startTime || '',
                        endTime: b.endTime || '',
                        flashGraceMins: b.flashGraceMins || 0
                    });
                }
            });

            // 6. Obtener Premios Activos
            const prizeSnap = await db.collection('prizes').where('active', '==', true).get();
            prizeSnap.forEach(doc => {
                const p = doc.data();
                activePrizes.push({
                    id: doc.id,
                    name: p.name,
                    pointsRequired: p.pointsRequired,
                    image: p.image || '',
                    description: p.description || '',
                    stock: p.stock ?? 99,
                    isInternal: p.isInternal || false,
                    requiresMinimumPurchase: p.requiresMinimumPurchase || false,
                    minimumPurchaseAmount: p.minimumPurchaseAmount || 0
                });
            });

            return res.status(200).json({
                ok: true,
                clients: Array.from(results.values()),
                pointsMoneyBase,
                pointsPerPeso,

                enablePetModule: configData.enablePetModule === true,  // Flag para la extensión
                allowEmployeePrizeOverride: configData.allowEmployeePrizeOverride === true, // Para el catálogo
                strictMinimumPurchaseBlock: configData.strictMinimumPurchaseBlock === true, // Bloqueo estricto
                mysteryBox: configData.mysteryBox || null,
                activePromotions,
                activePrizes,
                todayStr // Para debugging
            });
        } catch (err) {
            return res.status(500).json({ ok: false, error: err.message });
        }
    }

    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    try {
        const db = getDb();
        const { uid, reason, amountOverride, amount, concept, metadata, bonusIds, applyWhatsApp, skipNotifications, isPetFood, petIds, isPetLitter, petLitterIds, date, generateMysteryBox } = req.body || {};

        // 1. Autenticación (DUAL MODE)
        let isAdmin = false;
        let requestUid = null;

        const apiKey = req.headers["x-api-key"];
        const authHeader = req.headers["authorization"];
        const executorRole = req.headers["x-executor-role"] || 'admin'; // Default to admin for safety

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
        const clientSnap = await db.collection('users').doc(targetUid).get();
        const currentAccumulated = clientSnap.exists ? Number(clientSnap.data().accumulated_balance ?? 0) : 0;
        let newAccumulatedBalance = currentAccumulated; // Por defecto mantenemos el saldo anterior
        const finalAmount = amountOverride || amount;

        // --- RELOJ SIMULADO ---
        // Se define aquí arriba para usar en todos los modos (Admin, Usuario, Reglas)
        const now = await getEffectiveDate(db, req.body?.simulatedDate);
        const trueNow = await getTrueEffectiveDate(db, req.body?.simulatedDate);
        const todayStr = now.toISOString().split('T')[0];

        if (isAdmin && finalAmount) {
            let basePoints = 0;
            if (reason === 'external_integration') {
                // --- CÁLCULO DE PUNTOS ---
                const base = Number(config.pointsMoneyBase) || 100;
                const ratio = Number(config.pointsPerPeso) || 1;
                const costPerPoint = base / ratio;

                const totalVal = Number(finalAmount) + currentAccumulated;
                
                // Puntos exclusivos de esta compra
                const purchasePoints = Math.floor(Number(finalAmount) / costPerPoint);
                // Puntos que se completan gracias al saldo acumulado previo
                const pointsFromBalance = Math.floor(totalVal / costPerPoint) - purchasePoints;
                
                basePoints = purchasePoints + pointsFromBalance;
                newAccumulatedBalance = totalVal % costPerPoint;
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

                        // Lógica de Recompensa Flash (Autónoma y sensible al tiempo)
                        let useFlashReward = b.isFlash;
                        if (b.isFlash && (b.startTime || b.endTime)) {
                            // Usamos el 'now' simulado
                            const curHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

                            const isAfterStart = !b.startTime || b.startTime <= curHHmm;

                            // Check end time with grace
                            let isBeforeEnd = true;
                            if (b.endTime) {
                                const [endH, endM] = b.endTime.split(':').map(Number);
                                const flashGrace = (b.flashGraceMins !== undefined && b.flashGraceMins !== null && !isNaN(Number(b.flashGraceMins))) ? Number(b.flashGraceMins) : 15;
                                const endTimestamp = new Date(now);
                                endTimestamp.setHours(endH, endM + flashGrace, 0, 0);

                                if (now > endTimestamp) {
                                    isBeforeEnd = false;
                                }
                            }

                            if (!isAfterStart || !isBeforeEnd) {
                                // Si es flash pero fuera de horario (incluyendo gracia), NO aplicamos.
                                useFlashReward = false;
                            }
                        }

                        if (b.isInternal && !clientSnap.data().isTestUser) {
                            console.log(`[API] Skipping internal bonus ${b.name} for non-test user ${targetUid}`);
                            return;
                        }

                        const rType = useFlashReward ? (b.flashRewardType || b.rewardType) : b.rewardType;
                        const rValue = useFlashReward ? (Number(b.flashRewardValue) ?? b.rewardValue) : b.rewardValue;
                        const rText = useFlashReward ? (b.flashRewardText || b.rewardText) : b.rewardText;

                        if (rType === 'FIXED') totalBonus += (Number(rValue) || 0);
                        if (rType === 'MULTIPLIER') totalMultiplier *= (Number(rValue) || 1);
                        if (rType === 'TEXT' && rText) {
                            const promoName = useFlashReward ? (b.flashTitle || b.title || b.name || "Flash") : (b.title || b.name || "Promo");
                            promoDetails += (promoDetails ? ", " : " + Bono: ") + promoName + ` (${rText})`;
                        }

                        if (rType !== 'TEXT') {
                            const promoName = useFlashReward ? (b.flashTitle || b.title || b.name || "Flash") : (b.title || b.name || "Promo");
                            const bonusAction = rType === 'MULTIPLIER' ? `x${rValue}` : `+${rValue}`;
                            promoDetails += (promoDetails ? ", " : " + Bono: ") + promoName + ` (${bonusAction})`;
                        }
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
                // VERIFICACIÓN DE SEGURIDAD: ¿Ya recibió este bono?
                const historySnap = await db.collection('users').doc(targetUid).collection('points_history')
                    .where('reason', '==', 'profile_address')
                    .limit(1)
                    .get();
                
                if (!historySnap.empty) {
                    return res.status(400).json({ ok: false, error: "Bono de domicilio ya otorgado anteriormente" });
                }

                points = Number(config.pointsForAddress) || 50;
            } else if (reason === 'welcome_signup') {
                const welcomePts = Number(config.welcomePoints) || 0;
                const addressPts = metadata?.includeAddressBonus ? (Number(config.pointsForAddress) || 0) : 0;
                points = welcomePts + addressPts;
                
                if (metadata?.includeAddressBonus && addressPts > 0) {
                    req.body.calculatedPromoDetails = " (Registro + Domicilio)";
                }
            } else {
                return res.status(400).json({ ok: false, error: "Unknown reason or missing amount" });
            }
        }

        if (points < 0) return res.status(400).json({ ok: false, error: "Negative points not allowed" });

        // 5. Idempotencia & Transacción
        const clientRef = db.collection("users").doc(targetUid);
        let result = { ok: false, debug: {}, auditDetails: [] };

        // (now y todayStr ya definidos arriba)

        let recordDate = trueNow;
        if (req.body?.date) {
            if (req.body.date === todayStr) recordDate = trueNow;
            else recordDate = new Date(req.body.date + 'T12:00:00Z');
        }

        // 5. Determinar Días de Validez (Escalas)
        const expirationRules = config.expirationRules || [];
        const validityDays = getValidityDays(points, expirationRules);
        const expirationDate = new Date(recordDate);
        expirationDate.setDate(expirationDate.getDate() + validityDays);
        expirationDate.setHours(12, 0, 0, 0); // Normalize to midday to prevent timezone drift
        let expirationDateStr = "";
        if (points > 0) {
            const y = expirationDate.getFullYear();
            const m = String(expirationDate.getMonth() + 1).padStart(2, '0');
            const d = String(expirationDate.getDate()).padStart(2, '0');
            expirationDateStr = `${d}/${m}/${y}`;
        }


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
                const currentPoints = Number(cData.points ?? cData.puntos ?? 0);
                const newPoints = (isNaN(currentPoints) ? 0 : currentPoints) + points;
                const finalConcept = (concept || (reason === 'welcome_signup' ? 'Puntos de Bienvenida' : (reason === 'profile_address' ? 'Premio por completar dirección' : 'Compra en local'))) + (req.body?.calculatedPromoDetails || "");

                const clientUpdate = {
                    points: admin.firestore.FieldValue.increment(points),
                    puntos: admin.firestore.FieldValue.increment(points),
                    accumulated_balance: newAccumulatedBalance,
                    accumulated_balance_updated_at: admin.firestore.FieldValue.serverTimestamp(),
                    [`rewards_awarded.${reason}`]: true,
                    updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                    lastPurchaseDate: admin.firestore.Timestamp.fromDate(recordDate),
                    // Limitamos el historial rápido a los últimos 1000 movimientos para fluidez en la App
                    historialPuntos: [...(cData.historialPuntos || []), {
                        fechaObtencion: admin.firestore.Timestamp.fromDate(recordDate),
                        puntosObtenidos: points,
                        puntosDisponibles: points,
                        diasCaducidad: validityDays,
                        origen: finalConcept,
                        estado: 'Activo'
                    }].slice(-100)
                };

                // Mascota Food Logic (V.1.4.31) - Sincronizar ciclo desde compra
                if (isPetFood && petIds.length > 0 && Array.isArray(cData.pets)) {
                    const todayStr = recordDate.toISOString().split('T')[0];
                    clientUpdate.pets = cData.pets.map(p => {
                        if (petIds.includes(p.id)) {
                            return { ...p, lastPurchaseDate: todayStr, lastFoodAlertDate: null };
                        }
                        return p;
                    });
                }
                
                if (isPetLitter && petLitterIds && petLitterIds.length > 0 && Array.isArray(cData.pets)) {
                    const todayStr = recordDate.toISOString().split('T')[0];
                      clientUpdate.pets = (clientUpdate.pets || cData.pets).map(p => {
                          if (petLitterIds.includes(p.id)) {
                              return { ...p, lastLitterPurchaseDate: todayStr, lastLitterWhatsAppDate: null, lastLitterAlertDate: null };
                          }
                          return p;
                      });
                }

                tx.update(clientRef, clientUpdate);

                // Logs e Inbox
                const moneySpent = req.body?.moneySpent || (reason === 'external_integration' && finalAmount ? Number(finalAmount) : 0);
                tx.set(clientRef.collection('points_history').doc(), {
                    amount: points, moneySpent, type: 'credit', reason: reason || 'manual', concept: finalConcept,
                    date: admin.firestore.Timestamp.fromDate(recordDate), createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(expirationDate), remainingPoints: points, balanceAfter: newPoints
                });

                if (!skipNotifications) {
                    let inboxMsg = `¡Has sumado ${points} puntos! (${finalConcept})`;
                    if (generateMysteryBox && config.mysteryBox && config.mysteryBox.enabled && finalAmount >= config.mysteryBox.minAmount) {
                        inboxMsg += "\n\n🎁 ¡Has ganado una Caja Sorpresa! Ingresá a la app para jugar.";
                    }
                    tx.set(clientRef.collection('inbox').doc(), {
                        title: '¡Puntos Sumados! 💰', body: inboxMsg,
                        url: '/', type: 'pointsAdded', read: false, date: admin.firestore.FieldValue.serverTimestamp()
                    });
                }

                tx.set(db.collection('transactions').doc(), {
                    uid: targetUid, clientName: cData.name || cData.nombre || 'Socio', points, amount: moneySpent, type: 'credit',
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
                const rRef = referrerSnap.ref;
                let referralBonusAmount = Number(config.referrals?.pointsForReferrer) || 200;
                let challengeBonus = 0;
                let tierReached = null;

                // Lógica de Desafío (Progresivo + Deadline)
                const challenge = config.referrals?.challenge;
                if (challenge && challenge.enabled) {
                    const todayStr = now.toISOString().split('T')[0];
                    if (todayStr >= challenge.startDate && todayStr <= challenge.endDate) {
                        // Contar cuántos referidos trajo en ESTE período de desafío
                        // Buscamos en el historial de puntos del referente
                        const historySnap = await tx.get(rRef.collection('points_history')
                            .where('reason', '==', 'referral_bonus')
                            .where('date', '>=', admin.firestore.Timestamp.fromDate(new Date(challenge.startDate + 'T00:00:00')))
                            .where('date', '<=', admin.firestore.Timestamp.fromDate(new Date(challenge.endDate + 'T23:59:59')))
                        );

                        const countInChallenge = historySnap.size + 1; // +1 por el actual que estamos procesando

                        // Buscar el tier más alto alcanzado
                        const tiers = challenge.tiers || [];
                        const sortedTiers = [...tiers].sort((a, b) => b.count - a.count); // De mayor a menor
                        const reached = sortedTiers.find(t => countInChallenge >= t.count);

                        if (reached) {
                            challengeBonus = Number(reached.bonus) || 0;
                            tierReached = reached.count;
                        }
                    }
                }

                const totalAwarded = referralBonusAmount + challengeBonus;
                const newRPoints = (Number(rData.points) || 0) + totalAwarded;

                const rValidityDays = getValidityDays(totalAwarded, expirationRules);
                const rExpirationDate = new Date(trueNow);
                rExpirationDate.setDate(rExpirationDate.getDate() + rValidityDays);
                rExpirationDate.setHours(12, 0, 0, 0); // Normalize to midday to prevent timezone drift
                const rY = rExpirationDate.getFullYear();
                const rM = String(rExpirationDate.getMonth() + 1).padStart(2, '0');
                const rD = String(rExpirationDate.getDate()).padStart(2, '0');
                const rExpirationDateStr = `${rD}/${rM}/${rY}`;

                const conceptBase = `Bono Invitado: ${cData.name || 'Amigo'}`;
                const conceptFinal = challengeBonus > 0
                    ? `${conceptBase} (+${challengeBonus} pts Desafío Nivel ${tierReached})`
                    : conceptBase;

                tx.update(rRef, {
                    points: newRPoints,
                    puntos: newRPoints,
                    'referralStats.count': admin.firestore.FieldValue.increment(1),
                    'referralStats.pointsEarned': admin.firestore.FieldValue.increment(totalAwarded),
                    historialPuntos: [...(rData.historialPuntos || []), {
                        fechaObtencion: admin.firestore.Timestamp.fromDate(trueNow),
                        puntosObtenidos: totalAwarded,
                        puntosDisponibles: totalAwarded,
                        diasCaducidad: rValidityDays,
                        origen: conceptFinal,
                        estado: 'Activo'
                    }].slice(-100)
                });

                tx.set(rRef.collection('points_history').doc(), {
                    amount: totalAwarded,
                    type: 'credit',
                    reason: 'referral_bonus',
                    concept: conceptFinal,
                    date: admin.firestore.Timestamp.fromDate(trueNow),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(rExpirationDate),
                    remainingPoints: totalAwarded,
                    balanceAfter: newRPoints
                });

                tx.set(rRef.collection('inbox').doc(), {
                    title: '¡Puntos por Referido! 🎁',
                    body: challengeBonus > 0
                        ? `¡Golazo! Tu amigo ${cData.name || 'alguien'} se sumó y como estás en el Desafío ganaste ${totalAwarded} puntos (Nivel ${tierReached}).`
                        : `Tu amigo ${cData.name || 'alguien'} realizó su primer consumo. ¡Ganaste ${referralBonusAmount} puntos!`,
                    url: '/referrals',
                    type: 'referralBonus',
                    read: false,
                    date: admin.firestore.FieldValue.serverTimestamp()
                });

                tx.set(rRef.collection('transactions').doc(), {
                    uid: rRef.id,
                    clientName: rData.name || 'Referente',
                    points: totalAwarded,
                    type: 'credit',
                    reason: 'referral_bonus',
                    concept: conceptFinal,
                    date: admin.firestore.FieldValue.serverTimestamp()
                });

                result.referrerToNotify = {
                    uid: rRef.id,
                    email: rData.email || rData.correo,
                    name: rData.name || 'Socio',
                    friendName: cData.name || 'Tu amigo',
                    bonusAmount: totalAwarded,
                    expirationDateStr: rExpirationDateStr
                };
                result.referralProcessed = true;
            }

            // Hacer disponibles los datos básicos para las notificaciones fuera de la tx
            result.guestData = {
                name: cData.name || cData.nombre || 'Socio',
                phone: cData.phone || cData.telefono || '',
                email: cData.email || cData.correo,
                dni: cData.dni || '',
                socioNumber: cData.socioNumber || cData.numeroSocio || cData.socio_number || '',
                expirationDateStr: expirationDateStr
            };

            // AUDITORIA: Agregar detalle de los puntos sumados
            if (!result.auditDetails) result.auditDetails = [];
            result.auditDetails.push({
                userId: targetUid,
                userName: result.guestData.name,
                dni: result.guestData.dni,
                phone: result.guestData.phone,
                socioNumber: result.guestData.socioNumber,
                points,
                balanceAfter: result.newBalance,
                action: 'points_credited',
                status: 'success',
                info: `+${points} pts (${(concept || 'Carga manual')})`,
                timestamp: trueNow.toISOString()
            });

            // AUDITORIA: Registro de Inbox
            result.auditDetails.push({
                userId: targetUid,
                userName: result.guestData.name,
                action: 'inbox_message_saved',
                status: 'success',
                info: `Mensaje guardado: +${points} pts`,
                timestamp: trueNow.toISOString()
            });

            // 5.5 GENERACIÓN DE CAJA SORPRESA
            if (generateMysteryBox && config.mysteryBox && config.mysteryBox.enabled && finalAmount >= config.mysteryBox.minAmount) {
                const mbId = 'MBX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
                const realNowTime = Date.now();
                const mbExpiresAt = new Date(realNowTime + ((config.mysteryBox.chanceDeadlineMinutes || 60) * 60 * 1000));
                const mbResendExpiresAt = new Date(realNowTime + ((config.mysteryBox.resendDeadlineMinutes || 60) * 60 * 1000));
                
                tx.set(db.collection('mystery_box_chances').doc(mbId), {
                    id: mbId,
                    clientId: targetUid,
                    clientName: result.guestData.name,
                    clientDni: (result.guestData.dni || '').replace(/\D/g, ''),
                    clientPhone: result.guestData.phone,
                    branchId: 'extension',
                    cashierId: 'extension',
                    amount: Number(finalAmount),
                    status: 'pending',
                    pointsWon: 0,
                    expiresAt: admin.firestore.Timestamp.fromDate(mbExpiresAt),
                    resendExpiresAt: admin.firestore.Timestamp.fromDate(mbResendExpiresAt),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    qrScanned: false
                });
                result.mysteryBoxGenerated = true;
                result.mysteryBoxId = mbId;
                result.showMysteryBoxAlert = config.mysteryBox?.enableCashierAlert !== false;
            }
        });

        // 5.5 ACTUALIZAR METADATA DE VENCIMIENTOS (Cache)
        if (result.ok && points > 0) {
            // No bloqueamos la respuesta, pero lo ejecutamos
            updateNextExpirationDate(db, targetUid).catch(err => console.error("Error updating expiration date:", err));
        }

        // 5.6 ACTUALIZAR lastPurchaseDate DE MASCOTAS (Pet Food Alert)
        // Cuando el operador marca "Reposicion de Alimento" - funciona tanto desde el panel como desde la extensión Chrome
        if (isPetFood && Array.isArray(petIds) && petIds.length > 0) {
            try {
                const userSnap = await db.collection('users').doc(targetUid).get();
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    const purchaseTimestamp = date
                        ? admin.firestore.Timestamp.fromDate(new Date(date + 'T12:00:00'))
                        : admin.firestore.FieldValue.serverTimestamp();

                    const updatedPets = (userData.pets || []).map(pet => {
                        if (petIds.includes(pet.id)) {
                            // Calcular próxima fecha de aviso (nextFoodAlertDate)
                            let nextDate = null;
                            const freq = Number(pet.frequencyDays || 30);
                            const lead = Number(config.petFoodAlertLeadDays || 0);
                            
                            const baseDate = date ? new Date(date + 'T12:00:00Z') : trueNow;
                            const exhaustionDate = new Date(baseDate);
                            exhaustionDate.setDate(baseDate.getDate() + freq);
                            
                            const alertDate = new Date(exhaustionDate);
                            alertDate.setDate(exhaustionDate.getDate() - lead);
                            
                            const nextDateStr = alertDate.toISOString().split('T')[0];

                            return { 
                                ...pet, 
                                lastPurchaseDate: purchaseTimestamp,
                                lastFoodAlertDate: null, // Resetear para que el motor avise en el nuevo ciclo
                                nextFoodAlertDate: nextDateStr // Sincronizamos para la barra lateral
                            };
                        }
                        return pet;
                    });

                    if (updatedPets.length > 0) {
                        await db.collection('users').doc(targetUid).update({ pets: updatedPets });
                        console.log(`[assign-points] Pet lastPurchaseDate actualizado para ${petIds.length} mascota(s) del cliente ${targetUid}`);
                    }
                }
            } catch (petErr) {
                // No bloqueamos la respuesta principal
                console.error('[assign-points] Error actualizando pet lastPurchaseDate:', petErr.message);
            }
        }

        // 5.7 ACTUALIZAR lastLitterPurchaseDate DE MASCOTAS (Piedras Gato)
        if (isPetLitter && Array.isArray(petLitterIds) && petLitterIds.length > 0) {
            try {
                const userSnap = await db.collection('users').doc(targetUid).get();
                if (userSnap.exists) {
                    const userData = userSnap.data();
                    const purchaseTimestamp = date 
                        ? admin.firestore.Timestamp.fromDate(new Date(date + 'T12:00:00Z')) 
                        : admin.firestore.FieldValue.serverTimestamp();
                    
                    const nextDate = new Date(trueNow);
                    const cycle = 15;
                    nextDate.setDate(nextDate.getDate() + cycle);
                    const nextDateStr = nextDate.toISOString().split('T')[0];
                    
                    if (Array.isArray(userData.pets)) {
                        const updatedPets = userData.pets.map(pet => {
                            if (petLitterIds.includes(pet.id)) {
                                return { 
                                    ...pet, 
                                    lastLitterPurchaseDate: purchaseTimestamp,
                                    lastLitterWhatsAppDate: null, 
                                    lastLitterAlertDate: null,
                                    nextLitterAlertDate: nextDateStr
                                };
                            }
                            return pet;
                        });

                        if (updatedPets.length > 0) {
                            await db.collection('users').doc(targetUid).update({ pets: updatedPets });
                            console.log(`[assign-points] Pet lastLitterPurchaseDate actualizado para ${petLitterIds.length} mascota(s) del cliente ${targetUid}`);
                        }
                    }
                }
            } catch (petErr) {
                console.error('[assign-points] Error actualizando pet lastLitterPurchaseDate:', petErr.message);
            }
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

            // WhatsApp Logic (Generation for Panel/Extension)
            const event = 'pointsAdded';
            const templates = messagingCfg.templates || {};

            // Permitimos el envío manual si applyWhatsApp es true, incluso si el canal está desactivado globalmente
            if (applyWhatsApp && points > 0) {
                // Si está configurado usamos el template, si no, un mensaje por defecto
                let waMsg = templates[event] || "¡Sumaste {puntos} puntos! Tu saldo actual es {saldo}.";
                const fullName = result.guestData.name || result.guestData.nombre || 'Cliente';
                const firstName = fullName.split(' ')[0];

                waMsg = waMsg.replace(/{nombre}/g, firstName)
                    .replace(/{nombre_completo}/g, fullName)
                    .replace(/{puntos}/g, points.toString())
                    .replace(/{saldo}/g, (result.newBalance || 0).toString())
                    .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

                if (result.mysteryBoxGenerated) {
                    waMsg += "\n\n🎁 ¡Has ganado una Caja Sorpresa! Ingresá a la app para jugar.";
                }

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
                        timestamp: now.toISOString()
                    });
                }
            } else if (points > 0) {
                // Log Skip: Not checked in UI
                result.auditDetails.push({
                    userId: targetUid,
                    userName: result.guestData.name,
                    dni: result.guestData.dni || '',
                    socioNumber: result.guestData.socioNumber || '',
                    action: 'whatsapp_skipped',
                    status: 'skipped',
                    info: 'Checkbox sin marcar'
                });
            }

            const notifications = [];

            // --- 6.1 NOTIFICACIÓN AL CLIENTE (INVITADO) ---
            if (points > 0 && !skipNotifications) {
                let unifiedMsg = templates[event] || "¡Sumaste {puntos} puntos! Tu saldo actual es {saldo}.";
                const fullName = result.guestData.name || result.guestData.nombre || 'Cliente';
                const firstName = fullName.split(' ')[0];

                unifiedMsg = unifiedMsg.replace(/{nombre}/g, firstName)
                    .replace(/{nombre_completo}/g, fullName)
                    .replace(/{puntos}/g, points.toString())
                    .replace(/{saldo}/g, (result.newBalance || 0).toString())
                    .replace(/{fecha_limite}/g, result.guestData.expirationDateStr || '')
                    .replace(/{vencimiento}/g, result.guestData.expirationDateStr || '')
                    .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

                if (result.mysteryBoxGenerated) {
                    unifiedMsg += "\n\n🎁 ¡Has ganado una Caja Sorpresa! Ingresá a la app para jugar.";
                }

                const eventConfig = messagingCfg.eventConfigs?.[event];
                const channels = eventConfig?.channels || ['push', 'email'];

                const isPushConfigured = messagingCfg.pushEnabled && channels.includes('push');
                const isEmailConfigured = messagingCfg.emailEnabled && channels.includes('email');

                if (isPushConfigured) {
                    notifications.push(
                        fetch(`${baseUrl}/api/notifications?action=send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                clienteId: targetUid, 
                                title: result.mysteryBoxGenerated ? '¡Puntos y Caja Sorpresa! 🎁✨' : '¡Puntos Sumados! 🌟', 
                                body: unifiedMsg,
                                icon: config.logoUrl || '/pwa-192x192.png',
                                click_action: '/',
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
                        info: 'Configuración desactivada'
                    });
                }

                if (isEmailConfigured && result.guestData.email) {
                    notifications.push(
                        fetch(`${baseUrl}/api/notifications?action=email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                to: result.guestData.email,
                                templateId: 'manual_override',
                                points, executor,
                                templateData: { subject: '¡Has sumado puntos! 💰', htmlContent: unifiedMsg }
                            })
                        }).then(async (emailRes) => {
                            if (!emailRes.ok) {
                                const errText = await emailRes.text();
                                throw new Error(`Status ${emailRes.status}: ${errText}`);
                            }
                            result.auditDetails.push({
                                userId: targetUid,
                                userName: result.guestData.name,
                                action: 'email_sent',
                                status: 'success',
                                info: `Enviado a: ${result.guestData.email}`
                            });
                        }).catch(err => {
                            console.error("Email error (guest):", err);
                            result.auditDetails.push({
                                userId: targetUid,
                                userName: result.guestData.name,
                                action: 'email_error',
                                status: 'failed',
                                info: `${result.guestData.email} - ${err.message}`
                            });
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
                        info: 'Configuración desactivada'
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
                    .replace(/{fecha_limite}/g, rInfo.expirationDateStr || '')
                    .replace(/{vencimiento}/g, rInfo.expirationDateStr || '')
                    .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

                const isPushEnabled = messagingCfg.pushEnabled && channels.includes('push');
                const isEmailEnabled = messagingCfg.emailEnabled && channels.includes('email');

                if (isPushEnabled) {
                    notifications.push(
                        fetch(`${baseUrl}/api/notifications?action=send`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                clienteId: rInfo.uid, title: '¡Bono de Referido! 🎁', body: rMsg,
                                icon: config.logoUrl || '/pwa-192x192.png',
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
                        fetch(`${baseUrl}/api/notifications?action=email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                to: rInfo.email,
                                points: rInfo.bonusAmount, executor,
                                templateId: 'manual_override',
                                templateData: { subject: '¡Ganaste un premio de referido! 🎁', htmlContent: rMsg }
                            })
                        }).then(() => {
                            result.auditDetails.push({
                                userId: rInfo.uid,
                                userName: rInfo.name,
                                action: 'email_sent_referrer',
                                status: 'success',
                                info: `Enviado a: ${rInfo.email}`
                            });
                        }).catch(err => {
                            result.auditDetails.push({
                                userId: rInfo.uid,
                                userName: rInfo.name,
                                action: 'email_error_referrer',
                                status: 'failed',
                                info: `${rInfo.email} - ${err.message}`
                            });
                        })
                    );
                }
            }

            if (notifications.length > 0) {
                try {
                    console.log(`[assign-points] Triggering ${notifications.length} notifications.`);
                    await Promise.allSettled(notifications);
                } catch (notifyPError) {
                    console.error("Error in parallel notifications:", notifyPError);
                }
            }

            // --- FINAL AUDIT LOG (UNIFIED) ---
            if (result.auditDetails && result.auditDetails.length > 0) {
                try {
                    const auditDoc = await db.collection('audit_logs').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'points_assignment',
                        status: 'success',
                        summary: `Asignación de puntos: ${result.guestData.name} (Socio #${result.guestData.socioNumber || 'N/A'}, DNI ${result.guestData.dni || 'N/A'}) - ${result.pointsAdded || 0} pts`,
                        details: result.auditDetails,
                        executor,
                        role: executorRole
                    });

                    // --- SINCRO AUTO: Si se generó el WhatsApp, marcar como 'sent' en el log diario ---
                    if (applyWhatsApp && result.whatsappLink) {
                        const todaySyncRef = db.collection('audit_logs').doc(`daily_alerts_${todayStr}`);
                        const alertId = `points-${result.guestData.socioNumber || result.guestData.phone || targetUid}-${auditDoc.id}`;
                        
                        await db.runTransaction(async (t) => {
                            const syncDoc = await t.get(todaySyncRef);
                            let actions = {};
                            if (syncDoc.exists) actions = syncDoc.data().actions || {};
                            actions[alertId] = 'sent';
                            t.set(todaySyncRef, { actions, lastUpdate: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                        });
                    }

                } catch (auditErr) {
                    console.error("Final audit log error:", auditErr);
                }
            }
        } catch (notifyOuterErr) {
            console.error("Error in post-transaction processing:", notifyOuterErr);
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
