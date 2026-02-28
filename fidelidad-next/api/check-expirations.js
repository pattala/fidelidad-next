// /api/check-expirations.js
// Motor de vencimientos de puntos con horario de ejecución configurable.
// Trigger: Vercel Cron (configurado cada hora en vercel.json).
// Tarea programada (Cron Job) para avisar a los socios con vencimientos próximos.

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

// ---------- Nodemailer (Gmail) ----------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// ---------- Handler Principal ----------
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

    // 1. Priorizar TOKEN de Usuario (Bearer) para rastro real de identidad
    const bearerHeader = req.headers["authorization"] || "";
    if (bearerHeader.startsWith("Bearer ")) {
        const token = bearerHeader.split("Bearer ")[1];
        try {
            const decoded = await initFirebaseAdmin().auth().verifyIdToken(token);
            executorEmail = decoded.email || decoded.uid;
            isAuthorized = true;
        } catch (e) {
            console.error("[Cron] Token verification failed:", e.message);
        }
    }

    // 2. Si no hay token de usuario, verificar API KEY / Cron (Usado por Vercel o Scripts)
    if (!isAuthorized) {
        if (cronHeader) {
            isAuthorized = true;
            executorEmail = 'system';
        } else if (authHeader && SECRET && authHeader.includes(SECRET)) {
            isAuthorized = true;
            executorEmail = 'admin';
        }
    }

    console.log(`[Cron] Auth Check - Executor: ${executorEmail}, Authorized: ${isAuthorized}`);

    if (!isAuthorized) {
        console.warn("[Cron] Unauthorized access attempt blocked.");
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    // 0. PING LOG (Confirmación de que el motor arrancó)
    console.log("[Cron] Engine started.");

    try {
        // 1. Obtener Configuración
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) {
            console.error("[Cron] Config not found (general)");
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'expiration_engine',
                status: 'error',
                summary: "Error fatal: No se encontró el documento de configuración 'general'.",
                details: [],
                executor: 'system'
            });
            return res.status(404).json({ ok: false, error: "Config not found" });
        }
        const config = configSnap.data();

        // 2. Determinar Fecha y Hora de Referencia
        let referenceDate = new Date();
        const simulatedDateBody = req.body?.simulatedDate || req.query?.simulatedDate;
        const isFromUI = req.body?.isManual === true || req.query?.isManual === 'true';

        // Detectar si es una SIMULACIÓN REAL (fecha distinta a hoy)
        const todayStr = new Date().toISOString().split('T')[0];
        const simulatedStr = simulatedDateBody ? new Date(simulatedDateBody).toISOString().split('T')[0] : null;
        const isSimulation = simulatedStr && simulatedStr !== todayStr;

        if (simulatedDateBody) {
            referenceDate = new Date(simulatedDateBody);
            console.log(`[Cron] Executed with date parameter. Using: ${simulatedDateBody} (Real Simulation: ${isSimulation})`);
        }

        // Determinar el tipo de LOG según el origen y parámetros
        let logType = 'expiration_engine'; // Por defecto: Motor automático (System)
        let logSummaryPrefix = 'Proceso Automático (Sistema)';

        if (executorEmail !== 'system') {
            if (isSimulation) {
                logType = 'manual_expiration';
                logSummaryPrefix = 'Simulación/Prueba (Admin)';
            } else if (isFromUI) {
                logType = 'manual_expiration';
                logSummaryPrefix = 'Revisión Forzada (Admin)';
            } else {
                logType = 'session_refresh_check';
                logSummaryPrefix = 'Revisión Automática (Sesión)';
            }
        }

        // LOG DE INICIO
        const startLogRef = await db.collection('audit_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: logType,
            status: 'running',
            summary: `Iniciando ${logSummaryPrefix}...`,
            details: [],
            executor: executorEmail,
            role: executorRole === 'system' && executorEmail !== 'system' ? 'admin' : executorRole
        });

        const referenceDateStr = referenceDate.toISOString().split('T')[0];
        const startOfToday = new Date(referenceDate);
        startOfToday.setHours(0, 0, 0, 0);

        // Calcular fecha para avisos (Días configurables)
        const warningDays = Number(config.messaging?.expirationWarningDays) || 7;
        const warningDate = new Date(referenceDate);
        warningDate.setDate(warningDate.getDate() + warningDays);
        const warningDateStr = warningDate.toISOString().split('T')[0];
        console.log(`[Cron] Window: > ${referenceDateStr} and <= ${warningDateStr}`);

        const logResults = {
            processed: 0,
            expiredPoints: 0,
            expiredUsersCount: 0,
            notified: 0,
            totalInWindow: 0,
            details: [], // { userName, userId, action, status, info }
            errors: []
        };

        // --- PASO A: PROCESAR DESCUENTOS (Vencimientos Reales) ---
        // Buscamos usuarios cuyo 'nextExpirationDate' sea <= hoy
        const toExpireSnap = await db.collection('users')
            .where('nextExpirationDate', '<=', referenceDateStr)
            .get();

        for (const userDoc of toExpireSnap.docs) {
            try {
                const userId = userDoc.id;
                const userData = userDoc.data();
                const historyRef = db.collection('users').doc(userId).collection('points_history');

                // Query for UNPROCESSED expired items
                const expiredItemsSnap = await historyRef
                    .where('expiresAt', '<', admin.firestore.Timestamp.fromDate(startOfToday))
                    .get();

                if (expiredItemsSnap.empty) {
                    // Si no hay items pero el cache decía que sí, actualizamos el cache y seguimos
                    await updateNextExpirationCacheAdmin(db, userId, startOfToday);
                    continue;
                }

                let totalExpired = 0;
                const batch = db.batch();
                const now = admin.firestore.FieldValue.serverTimestamp();

                expiredItemsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.status === 'expired') return;

                    const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;
                    if (data.type === 'credit' && currentRemaining > 0) {
                        totalExpired += currentRemaining;
                        batch.update(d.ref, {
                            status: 'expired',
                            remainingPoints: 0,
                            expiredAmount: currentRemaining,
                            processedAt: now
                        });
                    }
                });

                if (totalExpired > 0) {
                    logResults.expiredPoints += totalExpired;
                    logResults.expiredUsersCount++;

                    logResults.details.push({
                        userId,
                        userName: userData?.name || userData?.nombre || 'Socio',
                        dni: userData?.dni || '',
                        socioNumber: userData?.socioNumber || userData?.numeroSocio || userData?.socio_number || '',
                        action: 'points_subtracted',
                        status: 'success',
                        info: `${totalExpired} pts vencidos (Ref: ${referenceDateStr})`
                    });

                    // Registrar Descuento
                    const newHistRef = historyRef.doc();
                    batch.set(newHistRef, {
                        amount: -totalExpired,
                        concept: 'Vencimiento de puntos acumulados (Auto)',
                        date: now,
                        type: 'debit',
                        isExpirationAdjustment: true
                    });

                    // Update Balance
                    batch.update(userDoc.ref, {
                        points: admin.firestore.FieldValue.increment(-totalExpired)
                    });

                    await batch.commit();
                    console.log(`[Cron] Expired ${totalExpired} pts for user ${userId}`);
                }

                // Recalcular cache usando la utilidad unificada
                await updateNextExpirationDate(db, userId, referenceDate);
                logResults.processed++;
            } catch (e) {
                console.error(`[Cron] Error processing expiration for ${userDoc.id}:`, e);
                logResults.errors.push({ id: userDoc.id, error: e.message });
            }
        }

        // --- PASO B: ENVIAR AVISOS (Usuarios que vencen pronto) ---
        // Usamos una ventana de 30 días para los contadores (match Dashboard)
        const proactiveWindow = new Date(referenceDate);
        proactiveWindow.setDate(proactiveWindow.getDate() + 30);
        const proactiveWindowStr = proactiveWindow.toISOString().split('T')[0];

        console.log(`[Cron] Step B: Searching for notices > ${referenceDateStr} and <= ${proactiveWindowStr}`);
        if (config.messaging?.enableExpirationWarnings !== false) {
            const proactiveSnap = await db.collection('users')
                .where('nextExpirationDate', '<=', proactiveWindowStr)
                .where('nextExpirationDate', '>', referenceDateStr)
                .get();

            console.log(`[Cron] Found ${proactiveSnap.size} candidates in 30-day proactive window.`);

            const itinerancyDays = config.messaging?.expirationItinerancyDays || 0;
            const today = referenceDate;

            for (const userDoc of proactiveSnap.docs) {
                const userId = userDoc.id;
                try {
                    const userData = userDoc.data();
                    const userPoints = userData.points ?? userData.puntos ?? 0;
                    // Verificar si tiene puntos para avisar
                    // Robustez: Algunos usuarios pueden no tener el campo 'points'/'puntos' en el root
                    // pero sí tener 'nextExpirationAmount' calculado via scripts.
                    if (userPoints <= 0 && (userData.nextExpirationAmount || 0) <= 0) {
                        console.log(`[Cron] Skipping ${userId}: No root points and no nextExpirationAmount.`);
                        continue;
                    }

                    // --- LÓGICA DE NOTIFICACIÓN AUTOMÁTICA ---
                    // 1. Contar para la burbuja de la extensión (siempre 30 días para match con Dashboard/FAB)
                    const dashboardWindowDate = new Date(referenceDate);
                    dashboardWindowDate.setDate(dashboardWindowDate.getDate() + 30);
                    const dashboardWindowStr = dashboardWindowDate.toISOString().split('T')[0];

                    if (userData.nextExpirationDate <= dashboardWindowStr) {
                        logResults.totalInWindow++;
                    }

                    // 2. Solo proceder con el aviso automático si está dentro de la ventana de configuración (ej: 7 días)
                    if (userData.nextExpirationDate > warningDateStr) {
                        // Es un vencimiento futuro lejano; no disparamos notificación aún
                        continue;
                    }

                    // NUEVA LÓGICA: Sumar TODOS los puntos que vencen en la ventana de aviso
                    const historyRef = userDoc.ref.collection('points_history');
                    const impendingCreditsSnap = await historyRef
                        .where('type', '==', 'credit')
                        .where('expiresAt', '>', admin.firestore.Timestamp.fromDate(startOfToday))
                        .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(warningDate))
                        .get();

                    let totalImpendingAmount = 0;
                    const validCredits = [];

                    impendingCreditsSnap.forEach(d => {
                        const dData = d.data();
                        if (dData.status === 'expired') return;
                        const rem = dData.remainingPoints !== undefined ? Number(dData.remainingPoints) : Number(dData.amount);

                        if (rem > 0) {
                            totalImpendingAmount += rem;
                            const dObj = dData.expiresAt.toDate();
                            const dd = String(dObj.getDate()).padStart(2, '0');
                            const mm = String(dObj.getMonth() + 1).padStart(2, '0');
                            const yyyy = dObj.getFullYear();
                            validCredits.push({ rem, date: `${dd}/${mm}/${yyyy}` });
                        }
                    });

                    console.log(`[Cron] User ${userId}: Total in window = ${totalImpendingAmount}. Valid credits: ${validCredits.length}`);

                    if (totalImpendingAmount <= 0) {
                        console.log(`[Cron] Skipping ${userId}: No points actually expiring in window.`);
                        continue;
                    }

                    // --- ITINERANCIA INTELIGENTE ---
                    // Toggle master ON/OFF + intervalo configurable en días
                    const isItinerancyEnabled = config.messaging?.repeatExpirationWarnings === true;
                    const rawInterval = config.messaging?.expirationReminderIntervalDays !== undefined
                        ? config.messaging?.expirationReminderIntervalDays
                        : config.messaging?.expirationItinerancyDays;
                    const reminderIntervalDays = (rawInterval !== undefined && rawInterval !== null) ? Number(rawInterval) : 5;

                    // ¿Ya fue notificado para esta misma fecha+monto?
                    const sameTargetAndAmount =
                        userData.lastExpirationNoticeTargetDate === userData.nextExpirationDate &&
                        userData.lastExpirationNoticeAmount === totalImpendingAmount;

                    let isItinerancy = false;
                    if (sameTargetAndAmount) {
                        if (!isItinerancyEnabled && !isSimulation) {
                            // Itinerancia OFF → saltar (salvo si es simulación activa)
                            console.log(`[Cron] Skipping ${userId}: Already notified and itinerancy is disabled.`);
                            logResults.details.push({
                                userId,
                                userName: userData.name || userData.nombre || 'Socio',
                                action: 'skipped_notification',
                                info: `Ya notificado (${totalImpendingAmount} pts al ${userData.nextExpirationDate}). Itinerancia: OFF`
                            });
                            continue;
                        }

                        // Si itinerancia está ON, chequear intervalo (salvo si es simulación o intervalo es 0)
                        const lastNoticeDate = userData.lastExpirationNotice; // "YYYY-MM-DD"
                        if (lastNoticeDate && reminderIntervalDays > 0 && !isSimulation) {
                            const daysSinceLastNotice = Math.floor(
                                (new Date(referenceDateStr).getTime() - new Date(lastNoticeDate).getTime()) / (1000 * 60 * 60 * 24)
                            );
                            if (daysSinceLastNotice < reminderIntervalDays) {
                                console.log(`[Cron] Skipping ${userId}: Itinerancy ON but only ${daysSinceLastNotice}/${reminderIntervalDays} days since last notice.`);
                                logResults.details.push({
                                    userId,
                                    userName: userData.name || userData.nombre || 'Socio',
                                    action: 'skipped_notification',
                                    info: `Itinerancia: esperando (${daysSinceLastNotice}/${reminderIntervalDays} días).`
                                });
                                continue;
                            }
                        }
                        isItinerancy = true;
                        console.log(`[Cron] Itinerancy triggered for ${userId}: ${reminderIntervalDays > 0 ? reminderIntervalDays + ' days elapsed' : 'immediate'}.`);
                    }



                    const channels = config.messaging?.eventConfigs?.expirationWarning?.channels || ['push', 'email'];
                    const template = config.messaging?.templates?.expirationWarning ||
                        "¡Hola {nombre}! 📢 Tienes {puntos} puntos próximos a vencer en los próximos días. ⏳ Entra a la App para ver el detalle de fechas y aprovecharlos. 🎁";

                    // Formatear fecha para el mensaje (usamos la más cercana)
                    const [y, m, d] = userData.nextExpirationDate.split('-');
                    const displayDate = `${d}/${m}/${y}`;

                    const msg = template
                        .replace(/{nombre}/g, userData.name || 'Socio')
                        .replace(/{puntos}/g, totalImpendingAmount.toString())
                        .replace(/{fecha}/g, displayDate);

                    const breakdownStr = validCredits.map(c => `${c.rem} pts (${c.date})`).join(', ');
                    const title = "⚠️ Tus puntos están por vencer";

                    // PUSH
                    if (channels.includes('push') && userData.fcmTokens?.length) {
                        console.log(`[Cron] Sending PUSH to ${userId} (${userData.fcmTokens.length} tokens)`);
                        await app.messaging().sendEachForMulticast({
                            tokens: userData.fcmTokens,
                            notification: { title, body: msg },
                            data: { url: "/activity", icon: config.logoUrl || "" }
                        }).catch(e => console.error(`[Cron] Push error for ${userId}:`, e));
                    }

                    // EMAIL
                    if (channels.includes('email') && userData.email && process.env.SMTP_USER) {
                        const innerHtml = `
                            <div style="color: #333;">
                                <h2 style="color: #e67e22; margin-top: 0;">${title}</h2>
                                <p style="font-size: 16px;">${msg}</p>
                                <div style="margin-top: 24px; padding: 20px; background: #fdf2f2; border-radius: 12px; border: 1px solid #fee2e2;">
                                    <h4 style="margin: 0 0 12px 0; color: #991b1b; font-size: 11px; text-transform: uppercase;">Detalle de vencimientos:</h4>
                                    <p style="margin: 0; font-size: 15px; font-weight: bold; color: #7f1d1d;">${breakdownStr}</p>
                                </div>
                                <p style="margin-top: 24px; font-size: 12px; color: #64748b; line-height: 1.5;">
                                    * Esta suma corresponde a los puntos que vencen en los próximos ${warningDays} días. Te recomendamos entrar a la App para ver el detalle.
                                </p>
                            </div>
                        `;
                        const html = buildHtmlLayout(innerHtml, config);

                        await transporter.sendMail({
                            from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                            to: userData.email,
                            subject: title,
                            html
                        }).catch(e => console.error(`[Cron] Email error for ${userId}:`, e));
                    }

                    // INBOX
                    await userDoc.ref.collection('inbox').add({
                        title,
                        body: `${msg}\n\nDetalle: ${breakdownStr}`,
                        url: "/activity",
                        type: "system",
                        read: false,
                        date: admin.firestore.FieldValue.serverTimestamp(),
                        expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                    });

                    // Guardamos la fecha y el MONTO del vencimiento avisado
                    // Reseteamos lastWhatsAppManualDate para que la burbuja del dashboard reaparezca
                    await userDoc.ref.update({
                        lastExpirationNotice: referenceDateStr,
                        lastExpirationNoticeTargetDate: userData.nextExpirationDate,
                        lastExpirationNoticeAmount: totalImpendingAmount,
                        lastWhatsAppManualDate: null  // reset: el admin debe volver a gestionar el WhatsApp
                    });

                    logResults.notified++;
                    logResults.details.push({
                        userId,
                        userName: userData.name || userData.nombre || 'Socio',
                        dni: userData?.dni || '',
                        socioNumber: userData?.socioNumber || userData?.numeroSocio || userData?.socio_number || '',
                        action: 'notified_expiration',
                        status: 'success',
                        isItinerancy: isItinerancy,
                        info: `${isItinerancy ? '[ITINERANCIA] ' : ''}Enviado: "${msg}" | Desglose: ${breakdownStr}`
                    });
                } catch (e) {
                    console.error(`[Cron] Error notifying ${userDoc.id}:`, e);
                }
            }
        }


        // PASO C: GUARDAR LOG DE AUDITORÍA
        try {
            const summaryMessage = logResults.processed === 0 && logResults.expiredUsersCount === 0 && logResults.notified === 0
                ? `Motor ejecutado. Sin vencimientos para hoy ni avisos nuevos en la ventana de ${warningDays} días.`
                : `Socios Procesados: ${logResults.processed}, Vencidos: ${logResults.expiredPoints} pts (${logResults.expiredUsersCount} socios), Notificados: ${logResults.notified}`;

            await startLogRef.update({
                status: logResults.errors.length === 0 ? 'success' : 'partial',
                summary: summaryMessage,
                details: [
                    {
                        action: 'engine_parameters',
                        referenceDate: referenceDateStr,
                        warningWindowDays: warningDays,
                        warningWindowTargetDate: warningDateStr,
                        timezoneOffset: referenceDate.getTimezoneOffset()
                    },
                    ...logResults.details
                ].slice(0, 500)
            });
        } catch (e) {
            console.error("[Cron] Error saving final audit log:", e);
        }

        return res.status(200).json({
            ok: true,
            summary: logResults,
            referenceDate: referenceDateStr
        });

    } catch (error) {
        console.error("[Cron Expirations] Fatal Error:", error);
        // LOG DE ERROR FATAL (Para que aparezca en la auditoría si algo explota)
        try {
            const db = admin.firestore();
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'expiration_engine',
                status: 'error',
                summary: `Error fatal en el motor: ${error.message}`,
                details: [{ action: 'fatal_error', status: 'failed', info: error.stack?.slice(0, 200) }],
                executor: 'system'
            });
        } catch (inner) {
            console.error("[Cron] Could not even log the fatal error:", inner);
        }
        return res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * Helper para actualizar el cache (OBSOLETO - Se usa updateNextExpirationDate de _expiration-utils.js)
 */
async function updateNextExpirationCacheAdmin(db, userId, startOfToday) {
    return updateNextExpirationDate(db, userId, startOfToday);
}
