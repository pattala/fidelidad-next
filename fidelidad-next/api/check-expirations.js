// /api/check-expirations.js
// Motor de vencimientos de puntos con horario de ejecución configurable.
// Trigger: Vercel Cron (configurado cada hora en vercel.json).
// Tarea programada (Cron Job) para avisar a los socios con vencimientos próximos.

import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { updateNextExpirationDate } from "./_expiration-utils.js";
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
    // Seguridad: Solo permitir si viene la API KEY o el header de Vercel Cron
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const cronHeader = req.headers["x-vercel-cron"] || req.headers["X-Vercel-Cron"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    console.log(`[Cron] Auth Check - CronHeader: ${!!cronHeader}, AuthHeader: ${!!authHeader}`);

    if (!cronHeader && (!authHeader || (SECRET && !authHeader.includes(SECRET)))) {
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
        const isManual = !!req.body?.simulatedDate;

        if (isManual) {
            referenceDate = new Date(req.body.simulatedDate);
            console.log(`[Cron] Manual execution detected. Using date: ${req.body.simulatedDate}`);
        }

        // LOG DE INICIO (SIEMPRE se registra para ver que Vercel llamó al endpoint)
        const startLogRef = await db.collection('audit_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: isManual ? 'manual_expiration' : 'expiration_engine',
            status: 'running',
            summary: `Iniciando proceso de vencimientos (${isManual ? 'Manual' : 'Automático'}).`,
            details: [],
            executor: isManual ? 'admin' : 'system'
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
            expired: 0,
            notified: 0,
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
                    logResults.expired += totalExpired;
                    logResults.details.push({
                        userId,
                        userName: userData?.name || userData?.nombre || 'Socio',
                        dni: userData?.dni || '',
                        socioNumber: userData?.socioNumber || userData?.numeroSocio || userData?.socio_number || '',
                        action: 'points_subtracted',
                        status: 'success',
                        info: `${totalExpired} pts vencidos`
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
                    logResults.expired++;
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
        console.log(`[Cron] Step B: Searching for notices > ${referenceDateStr} and <= ${warningDateStr}`);
        if (config.messaging?.enableExpirationWarnings !== false) {
            const toNotifySnap = await db.collection('users')
                .where('nextExpirationDate', '<=', warningDateStr)
                .where('nextExpirationDate', '>', referenceDateStr)
                .get();

            console.log(`[Cron] Found ${toNotifySnap.size} candidates for notices.`);

            for (const userDoc of toNotifySnap.docs) {
                try {
                    const userData = userDoc.data();
                    const userId = userDoc.id;

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

                    // Chequeo de duplicados mejorado: avisar si cambió la fecha O el monto
                    // O si la ITINERANCIA está activada (para obligar el re-envío)
                    const isRepeatEnabled = config.messaging?.repeatExpirationWarnings === true;

                    const alreadyNotified =
                        !isRepeatEnabled &&
                        userData.lastExpirationNoticeTargetDate === userData.nextExpirationDate &&
                        userData.lastExpirationNoticeAmount === totalImpendingAmount;

                    if (alreadyNotified) {
                        console.log(`[Cron] Skipping ${userId}: Already notified and itinerancy is disabled.`);
                        logResults.details.push({
                            userId,
                            userName: userData.name || userData.nombre || 'Socio',
                            action: 'skipped_notification',
                            info: `Ya notificado (Sin cambios: ${totalImpendingAmount} pts al ${userData.nextExpirationDate}). Itinerancia: OFF`
                        });
                        continue;
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
                            data: { url: "/mis-puntos", icon: config.logoUrl || "" }
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
                        url: "/mis-puntos",
                        type: "system",
                        read: false,
                        date: admin.firestore.FieldValue.serverTimestamp(),
                        expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                    });

                    // LOG DE AUDITORÍA INDIVIDUAL
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'expiration_warning',
                        status: 'success',
                        summary: `Aviso de vencimiento: ${totalImpendingAmount} pts para ${userData.name || 'Socio'}`,
                        details: [{
                            action: 'notification_sent',
                            userId,
                            totalImpendingAmount,
                            closestDate: userData.nextExpirationDate,
                            channels,
                            messageSent: msg,
                            breakdown: breakdownStr
                        }],
                        executor: 'system'
                    });

                    // Guardamos la fecha y el MONTO del vencimiento avisado
                    await userDoc.ref.update({
                        lastExpirationNotice: referenceDateStr,
                        lastExpirationNoticeTargetDate: userData.nextExpirationDate,
                        lastExpirationNoticeAmount: totalImpendingAmount
                    });

                    logResults.notified++;
                    logResults.details.push({
                        userId,
                        userName: userData.name || userData.nombre || 'Socio',
                        dni: userData?.dni || '',
                        socioNumber: userData?.socioNumber || userData?.numeroSocio || userData?.socio_number || '',
                        action: 'notified_expiration',
                        status: 'success',
                        isItinerancy: isRepeatEnabled,
                        info: `Enviado: "${msg}" | Desglose: ${breakdownStr}`
                    });
                } catch (e) {
                    console.error(`[Cron] Error notifying ${userDoc.id}:`, e);
                }
            }
        }


        // PASO C: GUARDAR LOG DE AUDITORÍA
        try {
            const summaryMessage = logResults.processed === 0 && logResults.expired === 0 && logResults.notified === 0
                ? `Motor ejecutado. Sin vencimientos para hoy ni avisos nuevos en la ventana de ${warningDays} días.`
                : `Procesados: ${logResults.processed}, Vencidos: ${logResults.expired} pts, Notificados: ${logResults.notified}`;

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
                ].slice(0, 500),
                executor: isManual ? 'admin' : 'system'
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
