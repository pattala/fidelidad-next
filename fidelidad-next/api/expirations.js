// /api/expirations.js
// Consolidated expiration engine and forecast API.
// Actions: 'check' (default), 'forecast'

import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { updateNextExpirationDate } from "../utils/_expiration-utils.js";
import { buildHtmlLayout } from "../utils/emailLayout.js";

// ---------- Inicialización Firebase Admin ----------
function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
        if (!credsRaw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON.");
        let creds;
        try { creds = JSON.parse(credsRaw); } catch { creds = JSON.parse(credsRaw.replace(/\\n/g, "\n")); }
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: creds.project_id,
                clientEmail: creds.client_email,
                privateKey: creds.private_key?.replace(/\\n/g, "\n"),
            }),
        });
    }
    return admin;
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// --- SUB-HANDLER: CHECK EXPIRATIONS ---
async function handleCheck(req, res, db) {
    // Seguridad: Obtener identidad y verificar acceso
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const cronHeader = req.headers["x-vercel-cron"] || req.headers["X-Vercel-Cron"];
    const executorRole = req.headers["x-executor-role"] || 'system';
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    let executorEmail = 'system';
    let isAuthorized = false;

    // 1. Priorizar TOKEN de Usuario (Bearer) para rastro real de identidad
    const bearerHeader = req.headers["authorization"] || "";
    if (bearerHeader.startsWith("Bearer ")) {
        const token = bearerHeader.split("Bearer ")[1];
        try {
            const decoded = await admin.auth().verifyIdToken(token);
            executorEmail = decoded.email || decoded.uid;
            isAuthorized = true;
        } catch (e) {
            console.error("[Cron] Token verification failed:", e.message);
        }
    }

    // 2. Si no hay token de usuario, verificar API KEY / Cron
    if (!isAuthorized) {
        if (cronHeader) {
            isAuthorized = true;
            executorEmail = 'system';
        } else if (authHeader && SECRET && authHeader.includes(SECRET)) {
            isAuthorized = true;
            executorEmail = 'admin';
        }
    }

    if (!isAuthorized) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        let referenceDate = new Date();
        let todayStr = referenceDate.toISOString().split('T')[0]; // Real today
        let refStr = todayStr; // Effective today (simulation or real)

        const simCfg = config.dateSimulatorConfigs || {};
        const simulatedDateBody = req.body?.simulatedDate || req.query?.simulatedDate;

        if (simulatedDateBody && simCfg.expirations) {
            if (simulatedDateBody.includes('T')) {
                const [datePart] = simulatedDateBody.split('T');
                refStr = datePart;
                referenceDate = new Date(datePart + 'T12:00:00');
            } else {
                const [y, m, d] = simulatedDateBody.split(/[-/]/);
                refStr = `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
                referenceDate = new Date(refStr + 'T12:00:00');
            }
        }
        
        const isSimulation = refStr !== todayStr;
        const ignoreDeduplication = req.body?.ignoreDeduplication === true || req.query?.ignoreDeduplication === 'true';
        const triggerSource = req.query?.trigger || req.body?.trigger || "unknown";
        const sourceLabelMap = {
            'dashboard': 'Ejecución en Dashboard',
            'pwa': 'Ejecución en PWA',
            'extension': 'Ejecución en Extensión',
            'qstash': 'Ejecución vía QStash',
            'unknown': 'Auto'
        };
        const logSourceLabel = sourceLabelMap[triggerSource] || 'Auto';

        // El control de duplicidad es ignorado si se pide por request O si está desactivado globalmente
        const finalIgnoreDeduplication = ignoreDeduplication || (config.enableDuplicateControl === false);

        const silent = req.body?.silent === true || req.query?.silent === 'true';

        let logType = 'expiration_engine';
        let logSummaryPrefix = 'Proceso Automático (Sistema)';
        if (executorEmail !== 'system') {
            if (isSimulation || finalIgnoreDeduplication) { logType = 'manual_expiration'; logSummaryPrefix = 'Simulación/Prueba (Admin)'; }
            else if (isFromUI) { logType = 'manual_expiration'; logSummaryPrefix = 'Revisión Forzada (Admin)'; }
            else { logType = 'session_refresh_check'; logSummaryPrefix = 'Revisión Automática (Sesión)'; }
        }

        let startLogRef = null;
        if (!silent) {
            startLogRef = await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: logType,
                status: 'running',
                summary: `Iniciando ${logSummaryPrefix}... Gatillo: ${logSourceLabel}.`,
                details: [],
                executor: logSourceLabel,
                role: executorRole === 'system' && executorEmail !== 'system' ? 'admin' : executorRole
            });
        }

        const referenceDateStr = referenceDate.toISOString().split('T')[0];
        const startOfToday = new Date(referenceDate);
        startOfToday.setHours(0, 0, 0, 0);

        const warningDays = Number(config.messaging?.expirationWarningDays) || 7;
        const warningDate = new Date(referenceDate);
        warningDate.setDate(warningDate.getDate() + warningDays);
        warningDate.setHours(23, 59, 59, 999);

        const warningDateStr = warningDate.toISOString().split('T')[0];
        const logResults = { processed: 0, expiredPoints: 0, expiredUsersCount: 0, notified: 0, totalInWindow: 0, details: [], list: [], errors: [] };

        // --- PASO A: PROCESAR DESCUENTOS ---
        const toExpireSnap = await db.collection('users').where('nextExpirationDate', '<=', referenceDateStr).get();
        for (const userDoc of toExpireSnap.docs) {
            try {
                const userId = userDoc.id;
                const userData = userDoc.data();
                const historyRef = userDoc.ref.collection('points_history');
                const expiredItemsSnap = await historyRef.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).get();
                if (expiredItemsSnap.empty) { await updateNextExpirationDate(db, userId, startOfToday); continue; }

                let totalExpired = 0;
                const batch = db.batch();
                const now = admin.firestore.FieldValue.serverTimestamp();
                expiredItemsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.status === 'expired') return;
                    const rem = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;
                    if (data.type === 'credit' && rem > 0) {
                        totalExpired += rem;
                        batch.update(d.ref, { status: 'expired', remainingPoints: 0, expiredAmount: rem, processedAt: now });
                    }
                });
                if (totalExpired > 0) {
                    logResults.expiredPoints += totalExpired;
                    logResults.expiredUsersCount++;
                    logResults.details.push({ userId, userName: userData?.name || userData?.nombre || 'Socio', action: 'points_subtracted', status: 'success', info: `${totalExpired} pts vencidos` });
                    batch.set(historyRef.doc(), { amount: -totalExpired, concept: 'Vencimiento de puntos acumulados (Auto)', date: now, type: 'debit', isExpirationAdjustment: true });
                    batch.update(userDoc.ref, { points: admin.firestore.FieldValue.increment(-totalExpired) });
                    await batch.commit();
                }
                await updateNextExpirationDate(db, userId, referenceDate);
                logResults.processed++;
            } catch (e) { logResults.errors.push({ id: userDoc.id, error: e.message }); }
        }

        // --- PASO B: ENVIAR AVISOS ---
        const proactivePin = new Date(referenceDate);
        proactivePin.setDate(proactivePin.getDate() + 30);
        const proactivePinStr = proactivePin.toISOString().split('T')[0];

        if (config.messaging?.enableExpirationWarnings !== false) {
            const proactiveSnap = await db.collection('users').where('nextExpirationDate', '<=', proactivePinStr).where('nextExpirationDate', '>', referenceDateStr).get();
            for (const userDoc of proactiveSnap.docs) {
                try {
                    const userData = userDoc.data();
                    const userPoints = userData.points || 0;
                    if (userPoints <= 0 && (userData.nextExpirationAmount || 0) <= 0) continue;

                    // Si ya se gestionó manualmente hoy (o en el futuro de una simulación), lo ignoramos para los contadores y notificaciones
                    if (userData.lastWhatsAppManualDate && userData.lastWhatsAppManualDate >= referenceDateStr) continue;
                    if (userData.nextExpirationDate > warningDateStr) continue;

                    const historyRef = userDoc.ref.collection('points_history');
                    const impendingCreditsSnap = await historyRef.where('type', '==', 'credit').where('expiresAt', '>', admin.firestore.Timestamp.fromDate(startOfToday)).where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(warningDate)).get();
                    
                    let totalImpendingAmount = 0;
                    const creditsByDate = {}; // { 'dd/mm/yyyy': totalPoints }

                    impendingCreditsSnap.forEach(d => {
                        const dData = d.data();
                        if (dData.status === 'expired') return;
                        const rem = dData.remainingPoints !== undefined ? Number(dData.remainingPoints) : Number(dData.amount);
                        if (rem > 0) {
                            totalImpendingAmount += rem;
                            const dObj = dData.expiresAt.toDate();
                            const dateKey = `${dObj.getDate().toString().padStart(2, '0')}/${(dObj.getMonth() + 1).toString().padStart(2, '0')}/${dObj.getFullYear()}`;
                            creditsByDate[dateKey] = (creditsByDate[dateKey] || 0) + rem;
                        }
                    });
                    
                    if (totalImpendingAmount <= 0) continue;

                    // Convert grouped credits to a sorted array for the message
                    const validCredits = Object.entries(creditsByDate)
                        .map(([date, rem]) => ({ rem, date }))
                        .sort((a, b) => {
                            // Sort by date (assuming dd/mm/yyyy format)
                            const [da, ma, ya] = a.date.split('/').map(Number);
                            const [db, mb, yb] = b.date.split('/').map(Number);
                            return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
                        });

                    if (userData.nextExpirationDate <= proactivePinStr) {
                        logResults.totalInWindow++;
                        logResults.list.push({
                            id: userId,
                            name: userData.nombre || userData.name || 'Socio',
                            phone: userData.phone || userData.telefono || '',
                            points: totalImpendingAmount,
                            nextExpirationDate: userData.nextExpirationDate,
                            breakdown: validCredits // Envíamos el desglose ordenado
                        });
                    }

                    const isItinerancyEnabled = config.messaging?.repeatExpirationWarnings === true;
                    const rawInterval = config.messaging?.expirationReminderIntervalDays ?? config.messaging?.expirationItinerancyDays;
                    const reminderIntervalDays = rawInterval !== undefined ? Number(rawInterval) : 5;

                    // Solo consideramos "misma notificación" si la fecha del próximo vencimiento es la misma.
                    // Ignoramos ligeros cambios en 'totalImpendingAmount' para el control de duplicidad,
                    // ya que el 'window' de 7 días se mueve y puede capturar nuevos puntos sin ser un cambio "real" de vencimiento.
                    const sameTargetDate = userData.lastExpirationNoticeTargetDate === userData.nextExpirationDate;

                    let isItinerancy = false;
                    if (sameTargetDate) {
                        // Si la itinerancia está apagada, saltamos directamente si es la misma fecha de destino
                        if (!isItinerancyEnabled && !finalIgnoreDeduplication) {
                            if (!silent) logResults.details.push({ userId, userName: userData.name || 'Socio', action: 'push_skipped', status: 'skipped', info: 'Deduplicado: Misma fecha de destino y repetición desactivada.' });
                            continue;
                        }

                        // Si está prendida, chequeamos el intervalo de días
                        const lastNoticeDate = userData.lastExpirationNotice;
                        if (lastNoticeDate && !finalIgnoreDeduplication) {
                            const d1 = new Date(referenceDateStr);
                            const d2 = new Date(lastNoticeDate);
                            const diff = Math.round((d1.getTime() - d2.getTime()) / 86400000);

                            // Bloqueamos si es el mismo día (diff 0) O si no se cumplió el intervalo configurado
                            if (diff <= 0 || (reminderIntervalDays > 0 && diff < reminderIntervalDays)) {
                                if (userData.nextExpirationDate <= proactivePinStr) logResults.totalInWindow++;
                                if (!silent) logResults.details.push({ userId, userName: userData.name || 'Socio', action: 'push_skipped', status: 'skipped', info: diff <= 0 ? 'Deduplicado: Ya se notificó hoy (Switch Duplicidad activo).' : `Itinerancia: Faltan ${reminderIntervalDays - diff} días para repetir aviso.` });
                                continue;
                            }
                        }
                        isItinerancy = true;
                    }

                    const channels = config.messaging?.eventConfigs?.expirationWarning?.channels || ['push', 'email'];
                    const template = config.messaging?.templates?.expirationWarning || "¡Hola {nombre}! 📢 Tienes {puntos} puntos próximos a vencer el {fecha}. Entra a la App para aprovecharlos.";
                    const [y, m, d] = userData.nextExpirationDate.split('-');
                    let displayDate = `${d}/${m}/${y}`;
                    
                    const userName = (userData.nombre || userData.name || 'Socio').split(' ')[0];
                    let msg = template.replace(/{nombre}/g, userName).replace(/{puntos}/g, totalImpendingAmount.toString());

                    // Refinement: If there are multiple dates, avoid suggesting all points expire on a single date
                    if (validCredits.length > 1) {
                        // Remove " el {fecha}" or " el día {fecha}" to keep it natural
                        msg = msg.replace(/ el {fecha}/g, "").replace(/ el día {fecha}/g, "").replace(/{fecha}/g, "próximamente");
                        // Append breakdown to the main message for push notifications as well
                        msg += ` Detalle: ${validCredits.map(c => `${c.rem} pts (${c.date})`).join(', ')}`;
                    } else {
                        msg = msg.replace(/{fecha}/g, displayDate);
                    }
                    const breakdownStr = validCredits.map(c => `${c.rem} pts (${c.date})`).join(', ');
                    const title = "⚠️ Tus puntos están por vencer";

                    // Token Deduplication
                    const uniqueTokens = Array.from(new Set(userData.fcmTokens || []));

                    if (channels.includes('push') && uniqueTokens.length) {
                        await admin.messaging().sendEachForMulticast({ tokens: uniqueTokens, notification: { title, body: msg }, data: { url: "/", icon: config.logoUrl || "" } }).catch(console.error);
                    }
                    if (channels.includes('email') && userData.email && process.env.SMTP_USER) {
                        const htmlInner = `<div style="color: #333;"><h2>${title}</h2><p>${msg}</p><div style="background:#fdf2f2;padding:20px;border-radius:12px;"><h4>Detalle:</h4><p>${breakdownStr}</p></div></div>`;
                        await transporter.sendMail({ from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`, to: userData.email, subject: title, html: buildHtmlLayout(htmlInner, config) }).catch(console.error);
                    }
                    // Deterministic ID to prevent duplicates in Inbox
                    const inboxId = `exp_warning_${userData.nextExpirationDate}`;
                    await userDoc.ref.collection('inbox').doc(inboxId).set({ 
                        title, 
                        body: `${msg}\n\nDetalle: ${breakdownStr}`, 
                        url: "/", 
                        type: "system", 
                        read: false, 
                        date: admin.firestore.FieldValue.serverTimestamp(), 
                        expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000)) 
                    }, { merge: true });
                    
                    await userDoc.ref.update({ lastExpirationNotice: referenceDateStr, lastExpirationNoticeTargetDate: userData.nextExpirationDate, lastExpirationNoticeAmount: totalImpendingAmount, lastWhatsAppManualDate: null });
                    logResults.notified++;
                    logResults.details.push({
                        userId: userDoc.id,
                        userName: userData?.name || userData?.nombre || 'Socio',
                        action: 'expiration_warning',
                        status: 'success',
                        info: `${totalImpendingAmount} pts vencen ${displayDate}`,
                        isItinerancy
                    });
                } catch (e) { console.error(`[Cron] Error notifying ${userDoc.id}:`, e); }
            }
        }

        if (startLogRef) {
            await startLogRef.update({
                status: logResults.errors.length === 0 ? 'success' : 'partial',
                summary: `Motor ejecutado. Procesados: ${logResults.processed}, Vencidos: ${logResults.expiredPoints} pts, Notificados: ${logResults.notified}`,
                details: [{ action: 'engine_parameters', referenceDate: referenceDateStr }, ...logResults.details].slice(0, 500)
            });
        }
        return res.status(200).json({ ok: true, summary: logResults });
    } catch (err) {
        console.error("Check Error:", err);
        return res.status(500).json({ ok: false, error: err.message });
    }
}

// --- SUB-HANDLER: FORECAST ---
async function handleForecast(req, res, db) {
    // Auth Check
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    if (!authHeader || !authHeader.includes(SECRET)) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
        const customStartStr = req.query?.startDate || req.body?.startDate;
        const customEndStr = req.query?.endDate || req.body?.endDate;
        const hasCustom = !!(customStartStr && customEndStr);

        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : {};

        const prizesSnap = await db.collection('prizes').where('active', '==', true).get();
        let totalRatio = 0, pCount = 0;
        prizesSnap.forEach(d => {
            const p = d.data();
            if (p.cashValue && p.pointsRequired > 0) { totalRatio += (p.cashValue / p.pointsRequired); pCount++; }
        });
        const pointValue = pCount > 0 ? (totalRatio / pCount) : (config.pointValue || 10);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const intervals = {
            short: { label: 'Próximos 7 días', maxDays: 7, points: 0, money: 0, count: 0 },
            medium: { label: '8 a 30 días', maxDays: 30, points: 0, money: 0, count: 0 },
            long: { label: '31 a 90 días', maxDays: 90, points: 0, money: 0, count: 0 },
            future: { label: 'Más de 90 días', maxDays: 9999, points: 0, money: 0, count: 0 }
        };

        const customRange = { active: hasCustom, start: hasCustom ? new Date(customStartStr) : null, end: hasCustom ? new Date(customEndStr) : null, points: 0, money: 0, count: 0 };
        if (customRange.end) customRange.end.setHours(23, 59, 59, 999);

        const creditsSnap = await db.collectionGroup('points_history').where('type', '==', 'credit').get();

        creditsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.expiresAt) return;
            // Filter inactive points in memory since we drop the index requirement
            if (data.status === 'expired' || !(data.remainingPoints > 0)) return;

            const expiresAt = data.expiresAt.toDate();
            const diffDays = Math.ceil((expiresAt.getTime() - startOfToday.getTime()) / 86400000);

            if (diffDays > 0) {
                let bucket;
                if (diffDays <= 7) bucket = intervals.short;
                else if (diffDays <= 30) bucket = intervals.medium;
                else if (diffDays <= 90) bucket = intervals.long;
                else bucket = intervals.future;
                bucket.points += Number(data.remainingPoints);
                bucket.money += (Number(data.remainingPoints) * pointValue);
                bucket.count++;
            }
            if (customRange.active && expiresAt >= customRange.start && expiresAt <= customRange.end) {
                customRange.points += Number(data.remainingPoints);
                customRange.money += (Number(data.remainingPoints) * pointValue);
                customRange.count++;
            }
        });

        const summary = {
            totalPoints: Object.values(intervals).reduce((acc, b) => acc + b.points, 0),
            totalMoney: Object.values(intervals).reduce((acc, b) => acc + b.money, 0),
            intervals: Object.entries(intervals).map(([key, val]) => ({ key, ...val })),
            customRange: customRange.active ? { points: customRange.points, money: customRange.money, count: customRange.count, start: customStartStr, end: customEndStr } : null
        };

        return res.status(200).json({ ok: true, summary, pointValue });
    } catch (error) {
        console.error("Forecast Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const action = req.query?.action || req.body?.action || 'check';
    const db = initFirebaseAdmin().firestore();

    if (action === 'forecast') {
        return handleForecast(req, res, db);
    }

    return handleCheck(req, res, db);
}
