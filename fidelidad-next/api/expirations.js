// /api/expirations.js
// Consolidated expiration engine and forecast API.
// Updated with advanced telemetry to debug simulation issues.

import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { updateNextExpirationDate } from "../utils/_expiration-utils.js";
import { buildHtmlLayout } from "../utils/emailLayout.js";

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
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

async function handleCheck(req, res, db) {
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const cronHeader = req.headers["x-vercel-cron"] || req.headers["X-Vercel-Cron"];
    const executorRole = req.headers["x-executor-role"] || 'system';
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    let executorEmail = 'system';
    let isAuthorized = false;

    const bearerHeader = req.headers["authorization"] || "";
    if (bearerHeader.startsWith("Bearer ")) {
        const token = bearerHeader.split("Bearer ")[1];
        try {
            const decoded = await admin.auth().verifyIdToken(token);
            executorEmail = decoded.email || decoded.uid;
            isAuthorized = true;
        } catch (e) { console.error("[Cron] Token verification failed:", e.message); }
    }

    if (!isAuthorized) {
        if (cronHeader) { isAuthorized = true; executorEmail = 'system'; }
        else if (authHeader && SECRET && authHeader.includes(SECRET)) { isAuthorized = true; executorEmail = 'admin'; }
    }

    if (!isAuthorized) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        let referenceDate = new Date();
        let todayStr = referenceDate.toISOString().split('T')[0];
        let refStr = todayStr;

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
        const logSourceLabel = triggerSource === 'dashboard' ? 'Ejecución en Dashboard' : (triggerSource === 'extension' ? 'Ejecución en Extensión' : 'Auto');
        
        const finalIgnoreDeduplication = ignoreDeduplication || (config.enableDuplicateControl === false);
        const silent = req.body?.silent === true || req.query?.silent === 'true';

        let startLogRef = null;
        if (!silent) {
            startLogRef = await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: isSimulation ? 'manual_expiration' : 'expiration_engine',
                status: 'running',
                summary: `Iniciando Proceso... Simulación: ${isSimulation ? 'SÍ ('+refStr+')' : 'NO'}. Ignorar Duplicidad: ${finalIgnoreDeduplication ? 'SÍ' : 'NO'}.`,
                details: [],
                executor: logSourceLabel,
                role: 'admin'
            });
        }

        const referenceDateStr = refStr;
        const startOfToday = new Date(referenceDate);
        startOfToday.setHours(0, 0, 0, 0);

        const warningDays = Number(config.messaging?.expirationWarningDays) || 7;
        const warningDate = new Date(referenceDate);
        warningDate.setDate(warningDate.getDate() + warningDays);
        warningDate.setHours(23, 59, 59, 999);

        const proactivePin = new Date(referenceDate);
        proactivePin.setDate(proactivePin.getDate() + 30);
        const proactivePinStr = proactivePin.toISOString().split('T')[0];

        const logResults = { processed: 0, expiredPoints: 0, expiredUsersCount: 0, notified: 0, totalInWindow: 0, details: [], list: [], errors: [] };

        // --- PASO A: PROCESAR DESCUENTOS ---
        const toExpireSnap = await db.collection('users').where('nextExpirationDate', '<=', referenceDateStr).get();
        for (const userDoc of toExpireSnap.docs) {
            try {
                const userId = userDoc.id;
                const userData = userDoc.data();
                const historyRef = userDoc.ref.collection('points_history');
                const expiredItemsSnap = await historyRef.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).get();
                
                if (expiredItemsSnap.empty) { 
                    await updateNextExpirationDate(db, userId, startOfToday); 
                    continue; 
                }

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
                    logResults.details.push({ userId, userName: userData?.name || 'Socio', action: 'points_subtracted', status: 'success', info: `${totalExpired} pts vencidos en fecha ${referenceDateStr}` });
                    batch.set(historyRef.doc(), { amount: -totalExpired, concept: 'Vencimiento de puntos acumulados (Auto)', date: now, type: 'debit', isExpirationAdjustment: true });
                    batch.update(userDoc.ref, { points: admin.firestore.FieldValue.increment(-totalExpired) });
                    await batch.commit();
                }
                await updateNextExpirationDate(db, userId, referenceDate);
                logResults.processed++;
            } catch (e) { logResults.errors.push({ id: userDoc.id, error: e.message }); }
        }

        // --- PASO B: ENVIAR AVISOS ---
        if (config.messaging?.enableExpirationWarnings !== false) {
            const proactiveSnap = await db.collection('users')
                .where('nextExpirationDate', '<=', proactivePinStr)
                .where('nextExpirationDate', '>=', referenceDateStr)
                .get();

            logResults.details.push({ action: 'debug_info', info: `Usuarios en ventana de 30 días encontrados: ${proactiveSnap.size}` });

            for (const userDoc of proactiveSnap.docs) {
                try {
                    const userId = userDoc.id;
                    const userData = userDoc.data();
                    const userPoints = userData.points || 0;
                    
                    if (userPoints <= 0 && (userData.nextExpirationAmount || 0) <= 0) {
                        logResults.details.push({ userId, userName: userData.name || 'Socio', action: 'skip', info: 'Saldo 0' });
                        continue;
                    }

                    if (userData.lastWhatsAppManualDate && userData.lastWhatsAppManualDate >= referenceDateStr) {
                        logResults.details.push({ userId, userName: userData.name || 'Socio', action: 'skip', info: 'Gestionado manualmente hoy' });
                        continue;
                    }

                    const historyRef = userDoc.ref.collection('points_history');
                    // Query detallada hasta 30 días para coincidir con panel
                    const impendingCreditsSnap = await historyRef.where('type', '==', 'credit').where('expiresAt', '>', admin.firestore.Timestamp.fromDate(startOfToday)).where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(proactivePin)).get();
                    
                    let totalImpendingAmount = 0;
                    const creditsByDate = {};
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
                    
                    if (totalImpendingAmount <= 0) {
                        logResults.details.push({ userId, userName: userData.name || 'Socio', action: 'skip', info: `Vencimiento detectado en perfil (${userData.nextExpirationDate}) pero historial detallado vacío o vencido.` });
                        continue;
                    }

                    const validCredits = Object.entries(creditsByDate).map(([date, rem]) => ({ rem, date })).sort((a, b) => {
                        const [da, ma, ya] = a.date.split('/').map(Number);
                        const [db, mb, yb] = b.date.split('/').map(Number);
                        return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
                    });

                    logResults.totalInWindow++;
                    logResults.list.push({
                        id: userId, name: userData.name || 'Socio', phone: userData.phone || userData.telefono || '',
                        points: totalImpendingAmount, nextExpirationDate: userData.nextExpirationDate, breakdown: validCredits
                    });

                    // Itinerancia / Duplicidad
                    const sameTargetDate = userData.lastExpirationNoticeTargetDate === userData.nextExpirationDate;
                    if (sameTargetDate && !finalIgnoreDeduplication) {
                        logResults.details.push({ userId, userName: userData.name || 'Socio', action: 'push_skipped', info: 'Ya notificado para esta fecha (Ignorar Itinerancia: NO)' });
                        continue;
                    }

                    const channels = config.messaging?.eventConfigs?.expirationWarning?.channels || ['push', 'email'];
                    const template = config.messaging?.templates?.expirationWarning || "¡Hola {nombre}! 📢 {puntos} pts por vencer el {fecha}.";
                    const userNameStr = (userData.name || 'Socio').split(' ')[0];
                    let msg = "";

                    if (validCredits.length > 1) {
                        const listStr = validCredits.map(c => `\n• ${c.date}: ${c.rem} pts`).join('');
                        msg = `¡Hola ${userNameStr}! 📢 Tus puntos vencen próximamente:${listStr}\n\n🔥 Total: ${totalImpendingAmount} pts.`;
                    } else {
                        const [y, m, d] = userData.nextExpirationDate.split('-');
                        msg = template.replace(/{nombre}/g, userNameStr).replace(/{puntos}/g, totalImpendingAmount.toString()).replace(/{fecha}/g, `${d}/${m}/${y}`);
                    }

                    const title = "⚠️ Tus puntos están por vencer";
                    const uniqueTokens = Array.from(new Set(userData.fcmTokens || []));

                    if (channels.includes('push') && uniqueTokens.length) {
                        await admin.messaging().sendEachForMulticast({ tokens: uniqueTokens, notification: { title, body: msg }, data: { url: "/", icon: config.logoUrl || "" } }).catch(e => console.error("Push Error:", e.message));
                    }
                    if (channels.includes('email') && userData.email && process.env.SMTP_USER) {
                        const htmlInner = `<div style="color: #333;"><h2>${title}</h2><p>${msg}</p></div>`;
                        await transporter.sendMail({ from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`, to: userData.email, subject: title, html: buildHtmlLayout(htmlInner, config) }).catch(e => console.error("Email Error:", e.message));
                    }
                    
                    const inboxId = `exp_warning_${userData.nextExpirationDate}`;
                    await userDoc.ref.collection('inbox').doc(inboxId).set({ title, body: msg, url: "/", type: "system", read: false, date: admin.firestore.FieldValue.serverTimestamp(), expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 2592000000)) }, { merge: true });
                    
                    await userDoc.ref.update({ lastExpirationNotice: referenceDateStr, lastExpirationNoticeTargetDate: userData.nextExpirationDate, lastExpirationNoticeAmount: totalImpendingAmount, lastWhatsAppManualDate: null });
                    logResults.notified++;
                    logResults.details.push({ userId, userName: userData.name || 'Socio', action: 'expiration_warning', status: 'success', info: `Notificado ${totalImpendingAmount} pts` });
                } catch (e) { console.error(`[Cron] Error notifying ${userDoc.id}:`, e); }
            }
        }

        if (startLogRef) {
            await startLogRef.update({
                status: logResults.errors.length === 0 ? 'success' : 'partial',
                summary: `Motor ejecutado (${refStr}). Procesados: ${logResults.processed}, Vencidos: ${logResults.expiredPoints} pts, Notificados: ${logResults.notified}`,
                details: [{ action: 'engine_parameters', referenceDate: referenceDateStr, notified_count: logResults.notified }, ...logResults.details].slice(0, 500)
            });
        }
        return res.status(200).json({ ok: true, summary: logResults });
    } catch (err) {
        console.error("Check Error:", err);
        return res.status(500).json({ ok: false, error: err.message });
    }
}

async function handleForecast(req, res, db) {
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    if (!authHeader || !authHeader.includes(SECRET)) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
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
            short: { label: '7 días', maxDays: 7, points: 0, money: 0, count: 0 },
            medium: { label: '30 días', maxDays: 30, points: 0, money: 0, count: 0 },
            long: { label: '90 días', maxDays: 90, points: 0, money: 0, count: 0 },
            future: { label: 'Más', maxDays: 9999, points: 0, money: 0, count: 0 }
        };

        const creditsSnap = await db.collectionGroup('points_history').where('type', '==', 'credit').get();
        creditsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.expiresAt || data.status === 'expired' || !(data.remainingPoints > 0)) return;
            const diffDays = Math.ceil((data.expiresAt.toDate().getTime() - startOfToday.getTime()) / 86400000);
            if (diffDays > 0) {
                let bucket = diffDays <= 7 ? intervals.short : (diffDays <= 30 ? intervals.medium : (diffDays <= 90 ? intervals.long : intervals.future));
                bucket.points += Number(data.remainingPoints);
                bucket.money += (Number(data.remainingPoints) * pointValue);
                bucket.count++;
            }
        });

        return res.status(200).json({ ok: true, summary: { totalPoints: Object.values(intervals).reduce((acc, b) => acc + b.points, 0), intervals: Object.entries(intervals).map(([key, val]) => ({ key, ...val })) } });
    } catch (error) { return res.status(500).json({ ok: false, error: error.message }); }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const action = req.query?.action || req.body?.action || 'check';
    const db = initFirebaseAdmin().firestore();
    if (action === 'forecast') return handleForecast(req, res, db);
    return handleCheck(req, res, db);
}
