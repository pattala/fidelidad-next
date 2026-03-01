// /api/check-birthdays.js
// Tarea programada (Cron Job) para saludar y bonificar a los socios en su cumpleaños.

import admin from "firebase-admin";
import nodemailer from 'nodemailer';
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
        'dashboard': 'Panel Admin',
        'pwa': 'PWA Cliente',
        'extension': 'Extensión',
        'qstash': 'QStash (Cron)',
        'unknown': 'Auto'
    };
    const logSourceLabel = sourceLabelMap[triggerSource] || 'Auto';

    // --- DEDUPLICACIÓN (solo en modo daily y si no es manual/override) ---
    if (isDailyMode && !isManualSim) {
        const arFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
        const todayAR = arFormatter.format(new Date());
        const checkSnap = await db.collection('config').doc('dailyCheck').get();
        const lastRun = checkSnap.exists ? checkSnap.data()?.lastRunDate : null;

        if (lastRun === todayAR && !finalIgnoreDeduplication) {
            console.log(`[DailyCheck] Ya se ejecutó hoy (${todayAR}). Saltando procesos pero calculando contadores.`);

            // 1. Contar Cumpleaños Hoy (que no hayan sido saludados aún este año)
            const today = new Date();
            const currentYear = today.getFullYear().toString();
            const todayMsg = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

            const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
            const birthdayCount = usersSnap.docs.filter(doc => {
                const data = doc.data();
                return data.birthDate?.endsWith(todayMsg) && data.lastBirthdayGreetingYear !== currentYear;
            }).length;

            // 2. Contar Vencimientos (30 días de ventana)
            const todayStr = today.toISOString().split('T')[0];
            const windowEnd = new Date(today);
            windowEnd.setDate(windowEnd.getDate() + (config.messaging?.expirationWarningDays || 30));
            const windowEndStr = windowEnd.toISOString().split('T')[0];

            const expSnap = await db.collection('users')
                .where('nextExpirationDate', '<=', windowEndStr)
                .where('nextExpirationDate', '>', todayStr)
                .get();

            const expirationCount = expSnap.docs.filter(d => {
                const data = d.data();
                if ((data.points || 0) <= 0) return false;
                if (data.lastWhatsAppManualDate === todayStr) return false;
                return true;
            }).length;

            const skipSummary = `Motor al día: Los procesos ya corrieron hoy (${todayAR}). Gatillo: ${logSourceLabel}. Cumpleaños hoy: ${birthdayCount}. Vencimientos: ${expirationCount}.`;

            // Log de control enriquecido
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_check_skipped',
                status: 'success',
                summary: skipSummary,
                details: [{ action: 'idle_check', info: 'Deduplicación activa (Ya se ejecutó hoy).', trigger: triggerSource }],
                executor: executorEmail
            });

            return res.status(200).json({
                ok: true,
                skipped: true,
                message: `Ya se ejecutó hoy (${todayAR})`,
                lastRun: todayAR,
                summary: { notified: 0, totalToday: birthdayCount },
                expirations: { summary: { notified: 0, totalInWindow: expirationCount } }
            });
        }
    }

    try {
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        // Determinar Fecha de Referencia
        let referenceDate = new Date();
        if (simulatedDateStr) {
            referenceDate = new Date(simulatedDateStr);
            console.log(`[Dashboard] Usando fecha simulada: ${simulatedDateStr}`);
        }

        const currentYear = referenceDate.getFullYear().toString();
        const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;

        // El control de duplicidad es ignorado si se pide por request O si está desactivado globalmente
        const finalIgnoreDeduplication = ignoreDeduplication || (config.enableDuplicateControl === false);

        const logResults = {
            totalToday: 0,
            processed: 0,
            pointsGivenTotal: 0,
            details: [],
            errors: []
        };


        // --- BUSQUEDA DE SOCIOS (Query por MM-DD) ---
        // birthDate se guarda como YYYY-MM-DD. Buscamos los que terminan en todayMD.
        // Firestore no soporta "ends-with", así que traemos los que tengan birthDate seteado y filtramos en memoria (o usamos un campo indexado MM-DD)
        // Como la cantidad de socios no suele ser masiva, filtramos en memoria por ahora.
        const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
        const birthdayUsers = usersSnap.docs.filter(doc => doc.data().birthDate?.endsWith(todayMD));

        logResults.totalToday = birthdayUsers.length;

        for (const userDoc of birthdayUsers) {
            try {
                const userData = userDoc.data();
                const userId = userDoc.id;

                // 1. Evitar duplicar saludo el mismo año (Omitir si se ignora deduplicación)
                if (userData.lastBirthdayGreetingYear === currentYear && !finalIgnoreDeduplication) continue;

                const birthdayPoints = config?.birthdayPoints || 100;
                const autoBonusEnabled = config?.enableBirthdayBonus === true;
                const autoMessageEnabled = config?.enableBirthdayMessage !== false;

                let pointsAdded = 0;
                let actionsTaken = [];

                // 2. Aplicar Bono de Puntos (Omitir si se ignora deduplicación)
                if (autoBonusEnabled && (userData.lastBirthdayPointsYear !== currentYear || finalIgnoreDeduplication)) {
                    const historyRef = userDoc.ref.collection('points_history');

                    // Calcular expiración según reglas
                    let expirationDate = new Date(referenceDate);
                    expirationDate.setDate(expirationDate.getDate() + 365); // Default 1 año

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
                    actionsTaken.push("points_added");
                }

                // 3. Enviar Mensaje
                if (autoMessageEnabled) {
                    const templateFull = config?.messaging?.templates?.birthday || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día. Te regalamos {puntos} puntos.";
                    const templateSimple = config?.messaging?.templates?.birthdaySimple || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día.";

                    // Elegir plantilla: Full solo si se agregaron puntos AHORA.
                    const template = (pointsAdded > 0) ? templateFull : templateSimple;

                    const msg = template
                        .replace(/{nombre}/g, (userData.name || '').split(' ')[0])
                        .replace(/{puntos}/g, birthdayPoints.toString());

                    const title = "¡Feliz Cumpleaños! 🎂";

                    // PUSH
                    if (userData.fcmTokens?.length) {
                        try {
                            const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                            const icon = getAbsoluteUrl(config.logoUrl || "/pwa-192x192.png", PWA_URL);
                            await app.messaging().sendEachForMulticast({
                                tokens: userData.fcmTokens,
                                data: {
                                    title,
                                    body: msg,
                                    url: "/",
                                    icon: icon,
                                    badge: icon,
                                    type: "birthday"
                                },
                                android: { priority: "high" },
                                webpush: {
                                    headers: { Urgent: "high" },
                                    fcmOptions: { link: "/" }
                                }
                            });
                            actionsTaken.push("push_sent");
                        } catch (e) { console.error("Error push birthday:", e); }
                    }

                    // EMAIL
                    if (userData.email && process.env.SMTP_USER) {
                        try {
                            const innerHtml = `
                                <div style="color: #333;">
                                    <h2 style="color: #db2777; margin-top: 0;">${title}</h2>
                                    <p style="font-size: 16px; line-height: 1.6;">${msg}</p>
                                    <p style="margin-top: 24px; font-size: 14px; color: #64748b;">
                                        ¡Esperamos que pases un día increíble! Gracias por ser parte de nuestra comunidad.
                                    </p>
                                </div>
                            `;
                            const html = buildHtmlLayout(innerHtml, config);
                            await transporter.sendMail({
                                from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                                to: userData.email,
                                subject: title,
                                html
                            });
                            actionsTaken.push("email_sent");
                        } catch (e) { console.error("Error email birthday:", e); }
                    }

                    // INBOX
                    await userDoc.ref.collection('inbox').add({
                        title, body: msg, url: "/", type: "birthday", read: false,
                        date: admin.firestore.FieldValue.serverTimestamp(),
                        expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                    });
                    actionsTaken.push("inbox_saved");

                    if (!finalIgnoreDeduplication) {
                        await userDoc.ref.update({ lastBirthdayGreetingYear: currentYear });
                    }
                }

                logResults.processed++;
                logResults.details.push({
                    userId,
                    userName: userData.name || userData.nombre || 'Socio',
                    dni: userData.dni || '',
                    socioNumber: userData.socioNumber || userData.numeroSocio || userData.socio_number || '',
                    action: actionsTaken.join(', '),
                    status: 'success',
                    info: pointsAdded > 0 ? `+${pointsAdded} pts` : 'Solo saludo'
                });

            } catch (userError) {
                console.error(`[Birthdays] Error processing ${userDoc.id}:`, userError);
                logResults.errors.push(`${userDoc.id}: ${userError.message}`);
            }
        }

        // 4. GUARDAR LOG DE AUDITORÍA CONSOLIDADO
        try {
            let logType = 'birthday_engine';
            let logSummaryPrefix = 'Motor Automático (Sistema)';

            if (executorEmail !== 'system') {
                if (isManualSim) {
                    logType = 'manual_birthday_check';
                    logSummaryPrefix = 'Simulación/Prueba (Admin)';
                } else {
                    logType = 'session_refresh_check';
                    logSummaryPrefix = 'Revisión Automática (Sesión)';
                }
            }

            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: logType,
                status: logResults.errors.length === 0 ? 'success' : 'partial',
                summary: logResults.totalToday === 0
                    ? `${logSummaryPrefix}: No hay cumpleaños para enviar hoy. Gatillo: ${logSourceLabel}.`
                    : `${logSummaryPrefix}: Socios hoy: ${logResults.totalToday}, Procesados: ${logResults.processed}, Puntos: ${logResults.pointsGivenTotal}. Gatillo: ${logSourceLabel}.`,
                details: logResults.details.slice(0, 500),
                executor: executorEmail,
                role: executorRole === 'system' && executorEmail !== 'system' ? 'admin' : executorRole
            });
        } catch (logError) {
            console.error("[Birthdays] Error saving audit log:", logError);
        }

        // --- MODO DAILY: también ejecutar vencimientos y campañas ---
        let expirationsResult = null;
        let campaignResults = null;

        if (isDailyMode) {
            // 1. Ejecutar Vencimientos
            try {
                const currentHost = req.headers.host;
                const baseUrl = currentHost
                    ? `https://${currentHost}`
                    : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

                const eRes = await fetch(`${baseUrl}/api/expirations?action=check&trigger=${triggerSource}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': SECRET,
                        'x-api-secret': SECRET,
                        'x-executor-role': 'system'
                    },
                    body: JSON.stringify({
                        simulatedDate: referenceDate.toISOString()
                    })
                });
                expirationsResult = await eRes.json();
                console.log("[DailyCheck] Vencimientos:", JSON.stringify(expirationsResult).substring(0, 200));
            } catch (e) {
                console.error("[DailyCheck] Error en vencimientos:", e.message);
                expirationsResult = { ok: false, error: e.message };
            }

            // 2. Revisar Difusión de Campañas Automáticas
            try {
                const year = referenceDate.getFullYear();
                const month = String(referenceDate.getMonth() + 1).padStart(2, '0');
                const day = String(referenceDate.getDate()).padStart(2, '0');
                const todayStr = `${year}-${month}-${day}`;
                const currentTimeStr = `${String(referenceDate.getHours()).padStart(2, '0')}:${String(referenceDate.getMinutes()).padStart(2, '0')}`;

                const campaignSnap = await db.collection('campanas')
                    .where('active', '==', true)
                    .where('autoBroadcast', '==', true)
                    .get();

                const pendingCampaigns = campaignSnap.docs.filter(doc => {
                    const data = doc.data();
                    if (data.broadcastSentAt) return false;
                    if (data.startDate && data.startDate > todayStr) return false;
                    if (data.startDate === todayStr && data.startTime && data.startTime > currentTimeStr) return false;
                    return true;
                });

                if (pendingCampaigns.length > 0) {
                    console.log(`[DailyCheck] Procesando ${pendingCampaigns.length} campañas para difusión.`);
                    const siteName = config.siteName || 'Club Fidelidad';
                    const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;

                    const usersSnap = await db.collection('users').get();
                    const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

                    for (const campDoc of pendingCampaigns) {
                        const camp = { id: campDoc.id, ...campDoc.data() };
                        let pushedCount = 0;
                        let inboxCount = 0;

                        const subject = camp.title || camp.name;
                        const body = camp.description || '¡Nueva campaña disponible!';

                        // Inbox
                        const batch = db.batch();
                        users.forEach(user => {
                            const inboxRef = db.collection('clientes').doc(user.id).collection('inbox').doc();
                            batch.set(inboxRef, {
                                title: subject,
                                body,
                                url: `${PWA_URL}/promos`,
                                source: 'campania_auto',
                                status: 'sent',
                                sentAt: admin.firestore.FieldValue.serverTimestamp()
                            });
                            inboxCount++;
                        });
                        await batch.commit();

                        // Push tokens
                        const tokens = users.flatMap(u => u.fcmTokens || []);
                        if (tokens.length > 0) {
                            try {
                                const chunks = [];
                                for (let i = 0; i < tokens.length; i += 500) {
                                    chunks.push(tokens.slice(i, i + 500));
                                }
                                const icon = getAbsoluteUrl(config.logoUrl || "/pwa-192x192.png", PWA_URL);
                                for (const chunk of chunks) {
                                    const pushResp = await admin.messaging().sendEachForMulticast({
                                        tokens: chunk,
                                        data: {
                                            title: subject,
                                            body: body,
                                            url: `${PWA_URL}/inbox`,
                                            icon: icon,
                                            badge: icon,
                                            image: camp.imageUrl ? getAbsoluteUrl(camp.imageUrl, PWA_URL) : "",
                                            type: "campaign_auto"
                                        },
                                        android: { priority: "high" },
                                        webpush: {
                                            headers: { Urgent: "high" },
                                            fcmOptions: { link: `${PWA_URL}/inbox` }
                                        }
                                    });
                                    pushedCount += pushResp.successCount;
                                }
                            } catch (e) { console.error("Push Error:", e); }
                        }

                        await db.collection('campanas').doc(camp.id).update({ broadcastSentAt: referenceDate.toISOString() });

                        await db.collection('audit_logs').add({
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            type: 'campaign_broadcast',
                            status: 'success',
                            summary: `Motor Automático: Difusión enviada para "${camp.name}"`,
                            details: {
                                campaignId: camp.id,
                                pushed: pushedCount,
                                inbox: inboxCount,
                                executor: executorEmail
                            },
                            executor: executorEmail
                        });
                    }
                    campaignResults = { ok: true, processed: pendingCampaigns.length };
                }
            } catch (campErr) {
                console.error("[DailyCheck] Error en campañas:", campErr);
                campaignResults = { ok: false, error: campErr.message };
            }

            // Marcar como ejecutado (solo si no es simulación)
            if (!isManualSim) {
                const arFormatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Argentina/Buenos_Aires',
                    year: 'numeric', month: '2-digit', day: '2-digit'
                });
                await db.collection('config').doc('dailyCheck').set({
                    lastRunDate: arFormatter.format(new Date()),
                    lastRunTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                    executor: executorEmail,
                    results: {
                        birthdaysOk: true,
                        expirationsOk: expirationsResult?.ok || false,
                        campaignsOk: campaignResults?.ok || false
                    }
                }, { merge: true });
            }
        }

        return res.status(200).json({
            ok: true,
            skipped: false,
            summary: logResults,
            today: todayMD,
            ...(isDailyMode ? {
                expirations: {
                    ...expirationsResult,
                    summary: {
                        ...expirationsResult?.summary,
                        totalInWindow: expirationsResult?.summary?.totalInWindow || 0
                    }
                }
            } : {})
        });

    } catch (error) {
        console.error("[Birthdays Cron] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
