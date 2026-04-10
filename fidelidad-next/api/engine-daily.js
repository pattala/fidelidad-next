// /api/check-birthdays.js
// Tarea programada (Cron Job) para saludar y bonificar a los socios en su cumpleaños.

import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { buildHtmlLayout } from "../utils/emailLayout.js";

// ---------- Inicialización Firebase Admin ----------
function initFirebaseAdmin() {
    try {
        if (!admin.apps.length) {
            const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
            if (!credsRaw) {
                console.error("[Firebase Admin] MISSING GOOGLE_CREDENTIALS_JSON");
                throw new Error("Missing environment credentials.");
            }
            
            let creds;
            try { 
                creds = JSON.parse(credsRaw); 
            } catch (err) { 
                // Fallback for double-escaped newlines in some ENV environments
                creds = JSON.parse(credsRaw.replace(/\\n/g, "\n")); 
            }
            
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: creds.project_id,
                    clientEmail: creds.client_email,
                    privateKey: creds.private_key?.replace(/\\n/g, "\n"),
                }),
            });
            console.log("[Firebase Admin] Initialized successfully");
        }
        return admin;
    } catch (error) {
        console.error("[Firebase Admin] Init Error:", error.message);
        throw error;
    }
}

// ---------- Nodemailer ----------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function getAbsoluteUrl(url, baseUrl) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const base = (baseUrl || "").replace(/\/$/, "");
    const path = url.startsWith("/") ? url : `/${url}`;
    return `${base}${path}`;
}

export default async function handler(req, res) {
    // 0. CORS Preflight
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Seguridad: Obtener identidad y verificar acceso
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const cronHeader = req.headers["x-vercel-cron"] || req.headers["X-Vercel-Cron"];
    const executorRole = req.headers["x-executor-role"] || 'system';
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    let executorEmail = 'system';
    let isAuthorized = false;

    // 1. Priorizar TOKEN de Usuario (Bearer)
    const bearerHeader = req.headers["authorization"] || "";
    if (bearerHeader.startsWith("Bearer ")) {
        const token = bearerHeader.split("Bearer ")[1];
        try {
            const decoded = await initFirebaseAdmin().auth().verifyIdToken(token);
            executorEmail = decoded.email || decoded.uid;
            isAuthorized = true;
        } catch (e) {
            console.error("[Cron Birthdays] Token verification failed:", e.message);
        }
    }

    // 2. Fallback a API KEY / Cron
    if (!isAuthorized) {
        if (cronHeader) {
            isAuthorized = true;
            executorEmail = 'system';
        } else if (authHeader && SECRET && authHeader.includes(SECRET)) {
            isAuthorized = true;
            executorEmail = 'admin';
        }
    }

    if (!isAuthorized) {
        console.warn("[Cron Birthdays] Unauthorized access");
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    // 1. CARGAR CONFIGURACIÓN (CENTRALIZADO)
    const configSnap = await db.collection('config').doc('general').get();
    if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
    const config = configSnap.data();

    // 2. PARÁMETROS DE CONTROL
    const isDailyMode = req.query?.mode === 'daily' || req.body?.mode === 'daily';
    const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
    const isManual = req.body?.isManual === true || req.query?.isManual === 'true';
    const reqIgnoreDeduplication = req.body?.ignoreDeduplication === true || req.query?.ignoreDeduplication === 'true';

    // El control de duplicidad es ignorado si se pide por request O si está desactivado globalmente
    const finalIgnoreDeduplication = reqIgnoreDeduplication || (config.enableDuplicateControl === false);
    // isManualSim define si "saltamos" los guards de seguridad (horario, deduplicación, etc)
    const isManualSim = !!simulatedDateStr || isManual || finalIgnoreDeduplication;

    const triggerSource = req.query?.trigger || req.body?.trigger || "unknown"; // dashboard, pwa, extension, qstash

    // --- TIME WINDOW & TOGGLE GUARDS (Solo automático diario) ---
    if (isDailyMode && !isManualSim) {
        const messagingConfig = config.messaging || {};

        // 1. Check if the specific trigger is enabled
        const isTriggerEnabled =
            (triggerSource === 'dashboard' && (messagingConfig.enableDashboardTrigger ?? true)) ||
            (triggerSource === 'pwa' && (messagingConfig.enableClientTrigger ?? true)) ||
            (triggerSource === 'extension' && (messagingConfig.enableExtensionTrigger ?? true)) ||
            (triggerSource === 'qstash' && (messagingConfig.enableQStashTrigger ?? true)) ||
            (triggerSource === 'unknown');

        if (!isTriggerEnabled) {
            console.log(`[DailyCheck] Gatillo '${triggerSource}' desactivado por configuración.`);
            if (triggerSource !== 'pwa') {
                await db.collection('audit_logs').add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'system_skip',
                    status: 'skipped',
                    summary: `Motor Diario Salteado: Gatillo '${triggerSource}' desactivado por configuración.`,
                    executor: triggerSource,
                    role: 'system'
                });
            }
            return res.status(200).json({ ok: true, skipped: true, message: `Gatillo '${triggerSource}' desactivado` });
        }

        // 2. Check Time Window
        const currentHour = new Date().toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires", hour: '2-digit', hour12: false });
        const hourInt = parseInt(currentHour, 10);
        const minHour = messagingConfig.engineAllowedStartHour ?? 9;
        const maxHour = messagingConfig.engineAllowedEndHour ?? 22;

        if (hourInt < minHour || hourInt >= maxHour) {
            console.log(`[DailyCheck] Fuera de horario permitido (${minHour} - ${maxHour} hs). Hora actual AR: ${hourInt}`);
            if (triggerSource !== 'pwa') {
                await db.collection('audit_logs').add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'system_skip',
                    status: 'skipped',
                    summary: `Motor Diario Salteado: Fuera de ventana horaria (${minHour}-${maxHour} hs). Gatillo: ${triggerSource}.`,
                    executor: triggerSource,
                    role: 'system'
                });
            }
            return res.status(200).json({ ok: true, skipped: true, message: "Fuera de horario permitido", currentHour: hourInt, minHour, maxHour });
        }
    }

    const sourceLabelMap = {
        'dashboard': 'Ejecución en Dashboard',
        'pwa': 'Ejecución en PWA',
        'extension': 'Ejecución en Extensión',
        'qstash': 'Ejecución vía QStash',
        'unknown': 'Auto'
    };
    const logSourceLabel = sourceLabelMap[triggerSource] || 'Auto';

    // --- DEDUPLICACIÓN INTELIGENTE (RED DE SEGURIDAD) ---
    if (isDailyMode && !isManualSim) {
        const arFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
        const todayAR = arFormatter.format(new Date());
        
        // Cargar marcador de última ejecución
        const checkSnap = await db.collection('config').doc('dailyCheck').get();
        const dailyCheckData = checkSnap.exists ? checkSnap.data() : {};
        const lastRun = dailyCheckData.lastRunDate;
        const lastRunTimestamp = dailyCheckData.lastRunTimestamp || null;

        // Lógica de salto para gatillos automáticos (PWA, Extensión, QStash)
        if (lastRun === todayAR && triggerSource !== 'dashboard' && !finalIgnoreDeduplication) {
            
            // RED DE SEGURIDAD: ¿Hubo cambios administrativos después de la última ejecución?
            let hasAdministrativeChanges = false;
            if (lastRunTimestamp) {
                const recentAudits = await db.collection('audit_logs')
                    .where('timestamp', '>', lastRunTimestamp)
                    .where('type', 'in', ['config_mgmt', 'campaign_mgmt', 'prize_updated'])
                    .limit(1)
                    .get();
                
                if (!recentAudits.empty) {
                    hasAdministrativeChanges = true;
                    console.log(`[DailyCheck] Detectados cambios administrativos recientes (${triggerSource}). Forzando ejecución.`);
                }
            }

            if (!hasAdministrativeChanges) {
                console.log(`[DailyCheck] Todo al día y sin cambios (${todayAR}). Gatillo: ${triggerSource}. SALTANDO LECTURAS.`);
                return res.status(200).json({
                    ok: true,
                    skipped: true,
                    message: `Todo al día (${todayAR})`,
                    lastRun: todayAR,
                    trigger: triggerSource
                });
            }
        }
    }

    try {
        // Determinar Fecha de Referencia
        let referenceDate = new Date();
        if (simulatedDateStr) {
            referenceDate = new Date(simulatedDateStr);
            console.log(`[Dashboard] Usando fecha simulada: ${simulatedDateStr}`);
        }

        const currentYear = referenceDate.getFullYear().toString();
        const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
        const todayStr = referenceDate.toISOString().split('T')[0];

        const logResults = {
            totalToday: 0,
            processed: 0,
            pointsGivenTotal: 0,
            details: [],
            errors: []
        };

        // --- PASO 1: CUMPLEAÑOS ---
        const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
        const birthdayUsers = usersSnap.docs.filter(doc => doc.data().birthDate?.endsWith(todayMD));
        logResults.totalToday = birthdayUsers.length;

        for (const userDoc of birthdayUsers) {
            try {
                const userData = userDoc.data();
                const userId = userDoc.id;
                if (userData.lastBirthdayGreetingYear === currentYear && !finalIgnoreDeduplication) continue;

                const birthdayPoints = config?.birthdayPoints || 100;
                const autoBonusEnabled = config?.enableBirthdayBonus === true;
                const autoMessageEnabled = config?.enableBirthdayMessage !== false;

                let pointsAdded = 0;
                let actionsTaken = [];

                if (autoBonusEnabled && (userData.lastBirthdayPointsYear !== currentYear || finalIgnoreDeduplication)) {
                    const historyRef = userDoc.ref.collection('points_history');
                    let expirationDate = new Date(referenceDate);
                    expirationDate.setDate(expirationDate.getDate() + 365);

                    await historyRef.add({
                        amount: birthdayPoints,
                        concept: '🎂 ¡Feliz Cumpleaños! Regalo del Club',
                        date: admin.firestore.Timestamp.fromDate(referenceDate),
                        type: 'credit',
                        expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                        remainingPoints: birthdayPoints,
                        balanceAfter: (Number(userData.points) || 0) + birthdayPoints
                    });
                    await userDoc.ref.update({
                        points: admin.firestore.FieldValue.increment(birthdayPoints),
                        lastBirthdayPointsYear: currentYear
                    });
                    pointsAdded = birthdayPoints;
                    logResults.pointsGivenTotal += birthdayPoints;
                    actionsTaken.push("puntos");
                }

                if (autoMessageEnabled) {
                    const template = (pointsAdded > 0) ? (config?.messaging?.templates?.birthday || "¡Feliz cumple {nombre}! 🎂 +{puntos} pts.") : (config?.messaging?.templates?.birthdaySimple || "¡Feliz cumple {nombre}! 🎂");
                    const msg = template.replace(/{nombre}/g, (userData.name || '').split(' ')[0]).replace(/{puntos}/g, birthdayPoints.toString());
                    const title = "¡Feliz Cumpleaños! 🎂";

                    if (userData.fcmTokens?.length) {
                        try {
                            const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                            const icon = getAbsoluteUrl(config.logoUrl || "/pwa-192x192.png", PWA_URL);
                            const uniqueTokens = Array.from(new Set(userData.fcmTokens));
                            await app.messaging().sendEachForMulticast({
                                tokens: uniqueTokens,
                                data: { title, body: msg, url: "/", icon: icon, type: "birthday" }
                            });
                            actionsTaken.push("push");
                        } catch (e) { }
                    }
                    if (userData.email && process.env.SMTP_USER) {
                        try {
                            const innerHtml = `<div style="color: #333;"><h2 style="color: #db2777;">${title}</h2><p>${msg}</p></div>`;
                            await transporter.sendMail({ from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`, to: userData.email, subject: title, html: buildHtmlLayout(innerHtml, config) });
                            actionsTaken.push("email");
                        } catch (e) { }
                    }
                    await userDoc.ref.collection('inbox').add({ title, body: msg, url: "/", type: "birthday", read: false, date: admin.firestore.FieldValue.serverTimestamp() });
                    actionsTaken.push("inbox");
                    if (!finalIgnoreDeduplication) await userDoc.ref.update({ lastBirthdayGreetingYear: currentYear });
                }
                logResults.processed++;
                logResults.details.push({
                    userId, userName: userData.name || 'Socio',
                    action: 'birthday', status: 'success', info: `${actionsTaken.join(', ')} (${pointsAdded} pts)`
                });
            } catch (userError) { logResults.errors.push(`${userDoc.id}: ${userError.message}`); }
        }

        // --- PASO 2: VENCIMIENTOS (CALL SILENT) ---
        let expirationsResult = { ok: true, summary: { notified: 0, expiredPoints: 0, details: [] } };
        if (isDailyMode) {
            try {
                const currentHost = req.headers.host;
                const baseUrl = currentHost ? `https://${currentHost}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
                
                // Red de seguridad: Timeout para evitar que Vercel mate el proceso por una llamada lenta
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

                const eRes = await fetch(`${baseUrl}/api/expirations?action=check&trigger=${triggerSource}&silent=true`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-api-key': SECRET, 
                        'x-api-secret': SECRET, 
                        'x-executor-role': 'system' 
                    },
                    body: JSON.stringify({
                        simulatedDate: referenceDate.toISOString(),
                        ignoreDeduplication: finalIgnoreDeduplication,
                        isManual: isManual
                    }),
                    signal: controller.signal
                });
                
                clearTimeout(timeoutId);
                
                if (eRes.ok) {
                    expirationsResult = await eRes.json();
                } else {
                    console.error(`[DailyCheck] Expirations API returned status ${eRes.status}`);
                    expirationsResult = { ok: false, error: `Status ${eRes.status}` };
                }
            } catch (e) { 
                console.error("[DailyCheck] Error calling expirations API:", e.message); 
                expirationsResult = { ok: false, error: e.message };
            }
        }

        // --- PASO 3: ALERTAS PETSHOP (CALL SILENT) ---
        let petAlertsResult = { ok: true, summary: { notified: 0, details: [] } };
        if (isDailyMode && config.enablePetModule) {
            try {
                const currentHost = req.headers.host;
                const baseUrl = currentHost ? `https://${currentHost}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');
                
                const pRes = await fetch(`${baseUrl}/api/pet-alerts?trigger=${triggerSource}&silent=true`, {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'x-api-key': SECRET, 
                        'x-api-secret': SECRET, 
                        'x-executor-role': 'system' 
                    },
                    body: JSON.stringify({
                        simulatedDate: referenceDate.toISOString(),
                        ignoreDeduplication: finalIgnoreDeduplication
                    })
                });
                
                if (pRes.ok) {
                    petAlertsResult = await pRes.json();
                }
            } catch (e) { 
                console.error("[DailyCheck] Error calling pet-alerts API:", e.message); 
            }
        }

        // --- AUDITORIA CONSOLIDADA ---
        const totalNotified = logResults.processed + (expirationsResult.summary?.notified || 0) + (petAlertsResult.results?.notified || 0);
        const auditSummary = `Motor Diario Ejecutado. Gatillo: ${logSourceLabel}. Total Notificaciones: ${totalNotified}. 
            (Cumpleaños: ${logResults.processed}, Vencimientos: ${expirationsResult.summary?.notified || 0}, Petshop: ${petAlertsResult.results?.notified || 0})`;

        await db.collection('audit_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'daily_engine_run',
            status: 'success',
            summary: auditSummary,
            details: [
                ...logResults.details.map(d => ({ ...d, category: 'cumpleaños' })),
                ...(expirationsResult.summary?.details || []).map(d => ({ ...d, category: 'vencimientos' }))
            ].slice(0, 500),
            executor: logSourceLabel
        });

        // Marcar como ejecutado
        if (!isManualSim && isDailyMode) {
            const arFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
            await db.collection('config').doc('dailyCheck').set({
                lastRunDate: arFormatter.format(new Date()),
                lastRunTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                executor: logSourceLabel
            }, { merge: true });
        }

        return res.status(200).json({
            ok: true,
            summary: auditSummary,
            birthdays: logResults,
            expirations: expirationsResult
        });

    } catch (error) {
        console.error("[Birthdays Cron] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
