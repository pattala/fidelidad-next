// /api/check-expirations.js
// Motor de vencimientos de puntos con horario de ejecución configurable.
// Trigger: Vercel Cron (configurado cada hora en vercel.json).
// Tarea programada (Cron Job) para avisar a los socios con vencimientos próximos.

import admin from "firebase-admin";
import nodemailer from 'nodemailer';

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
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const cronHeader = req.headers["x-vercel-cron"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!cronHeader && (!authHeader || !authHeader.includes(SECRET))) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    try {
        // 1. Obtener Configuración
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        // 2. Determinar Fecha y Hora de Referencia
        let referenceDate = new Date();
        const isManual = !!req.body?.simulatedDate;

        if (isManual) {
            referenceDate = new Date(req.body.simulatedDate);
            console.log(`[Cron] Manual execution detected. Using date: ${req.body.simulatedDate}`);
        } else {
            // Chequeo de hora automática (Solo si es dispara por el Cron de Vercel)
            // Asumimos que el usuario configura la hora en UTC-3 (Argentina)
            const currentUtcHour = referenceDate.getUTCHours();
            const currentLocalHour = (currentUtcHour - 3 + 24) % 24;
            const targetHour = config.messaging?.automaticCheckHour ?? 9;

            if (currentLocalHour !== targetHour) {
                console.log(`[Cron] Hour mismatch (Local: ${currentLocalHour}, Target: ${targetHour}). Skipping.`);

                // LOG DE SALTO (Audit log para visibilidad)
                try {
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'expiration_engine',
                        status: 'skipped',
                        summary: `Proceso saltado (Hora local: ${currentLocalHour}, Objetivo: ${targetHour})`,
                        details: [],
                        executor: 'system'
                    });
                } catch (e) {
                    console.error("[Cron] Error logging skip:", e);
                }

                return res.status(200).json({ ok: true, message: `Skipped. Current local hour is ${currentLocalHour}, target is ${targetHour}.` });
            }
        }

        const referenceDateStr = referenceDate.toISOString().split('T')[0];
        const startOfToday = new Date(referenceDate);
        startOfToday.setHours(0, 0, 0, 0);

        // Calcular fecha para avisos (Días configurables)
        const warningDays = Number(config.messaging?.expirationWarningDays) || 7;
        const warningDate = new Date(referenceDate);
        warningDate.setDate(warningDate.getDate() + warningDays);
        const warningDateStr = warningDate.toISOString().split('T')[0];

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
                        userName: userDoc.data()?.name || userDoc.data()?.nombre || 'Socio',
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

                // Recalcular cache
                await updateNextExpirationCacheAdmin(db, userId, startOfToday);
                logResults.processed++;
            } catch (e) {
                console.error(`[Cron] Error processing expiration for ${userDoc.id}:`, e);
                logResults.errors.push({ id: userDoc.id, error: e.message });
            }
        }

        // --- PASO B: ENVIAR AVISOS (Usuarios que vencen pronto) ---
        if (config.messaging?.enableExpirationWarnings !== false) {
            // FIX: Usamos '<=' en lugar de '==' para capturar vencimientos que estén dentro del rango
            // ej: si cargan puntos que vencen en 5 días y la ventana es de 7, ahora SÍ los toma.
            const toNotifySnap = await db.collection('users')
                .where('nextExpirationDate', '<=', warningDateStr)
                .where('nextExpirationDate', '>', referenceDateStr) // Solo futuros
                .get();

            for (const userDoc of toNotifySnap.docs) {
                try {
                    const userData = userDoc.data();
                    const userId = userDoc.id;

                    // Evitar duplicados: solo notificar si el target del aviso anterior es distinto al actual
                    // lastExpirationNoticeTargetDate guarda la fecha PARA LA CUAL se avisó (ej. 2026-02-20)
                    if (userData.lastExpirationNoticeTargetDate === userData.nextExpirationDate) {
                        continue;
                    }

                    const amount = userData.nextExpirationAmount || 0;
                    if (amount <= 0) continue;

                    const channels = config.messaging?.eventConfigs?.expirationWarning?.channels || ['push', 'email'];
                    const template = config.messaging?.templates?.expirationWarning ||
                        "¡Hola {nombre}! 📢 Te recordamos que tienes {puntos} puntos que vencen el {fecha}. ¡Aprovéchalos antes de que expiren! 🎁";

                    // Formatear fecha para el mensaje
                    const [y, m, d] = userData.nextExpirationDate.split('-');
                    const displayDate = `${d}/${m}/${y}`;

                    const msg = template
                        .replace(/{nombre}/g, userData.name || 'Socio')
                        .replace(/{puntos}/g, amount.toString())
                        .replace(/{fecha}/g, displayDate);

                    const title = "⚠️ Tus puntos están por vencer";

                    // PUSH
                    if (channels.includes('push') && userData.fcmTokens?.length) {
                        await app.messaging().sendEachForMulticast({
                            tokens: userData.fcmTokens,
                            data: { title, body: msg, url: "/mis-puntos", icon: config.logoUrl || "" }
                        }).catch(() => { });
                    }

                    // EMAIL
                    if (channels.includes('email') && userData.email && process.env.SMTP_USER) {
                        const html = `<div style="font-family: sans-serif; padding: 20px;"><h2>${title}</h2><p>${msg}</p></div>`;
                        await transporter.sendMail({
                            from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                            to: userData.email,
                            subject: title,
                            html
                        }).catch(() => { });
                    }

                    // INBOX
                    await userDoc.ref.collection('inbox').add({
                        title, body: msg, url: "/mis-puntos", type: "system", read: false,
                        date: admin.firestore.FieldValue.serverTimestamp(),
                        expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                    });

                    // Guardamos la fecha del vencimiento avisado para no repetir
                    await userDoc.ref.update({
                        lastExpirationNotice: referenceDateStr, // Cuándo se avisó
                        lastExpirationNoticeTargetDate: userData.nextExpirationDate // Sobre qué fecha se avisó
                    });

                    logResults.notified++;
                    logResults.details.push({
                        userId,
                        userName: userData.name || userData.nombre || 'Socio',
                        action: 'notified_expiration',
                        status: 'success',
                        info: `Aviso enviado (${amount} pts para el ${displayDate})`
                    });
                } catch (e) {
                    console.error(`[Cron] Error notifying ${userDoc.id}:`, e);
                }
            }
        }


        // PASO C: GUARDAR LOG DE AUDITORÍA (Mover antes del return)
        try {
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: isManual ? 'manual_expiration' : 'expiration_engine',
                status: logResults.errors.length === 0 ? 'success' : 'partial',
                summary: logResults.processed === 0 && logResults.expired === 0 && logResults.notified === 0
                    ? "Motor de vencimientos ejecutado. No hay puntos por expirar o avisos para hoy."
                    : `Procesados: ${logResults.processed}, Vencidos: ${logResults.expired} pts, Notificados: ${logResults.notified}`,
                details: logResults.details.slice(0, 500),
                executor: isManual ? 'admin' : 'system'
            });
        } catch (logError) {
            console.error("[Cron] Error saving final audit log:", logError);
        }

        return res.status(200).json({
            ok: true,
            summary: logResults,
            referenceDate: referenceDateStr
        });

    } catch (error) {
        console.error("[Cron Expirations] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}

/**
 * Helper para actualizar el cache usando Firebase Admin (Node.js)
 */
async function updateNextExpirationCacheAdmin(db, userId, startOfToday) {
    const historyRef = db.collection('users').doc(userId).collection('points_history');
    const creditsSnap = await historyRef.where('type', '==', 'credit').get();

    let nextDate = null;
    let nextAmount = 0;

    creditsSnap.docs.forEach(d => {
        const data = d.data();
        const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;

        if (currentRemaining <= 0 || data.status === 'expired') return;

        if (data.expiresAt) {
            const expireDate = data.expiresAt.toDate();
            // Solo futuras (desde hoy inclusive)
            if (expireDate >= startOfToday) {
                if (!nextDate || expireDate < nextDate) {
                    nextDate = expireDate;
                    nextAmount = currentRemaining;
                } else if (expireDate.getTime() === nextDate.getTime()) {
                    nextAmount += currentRemaining;
                }
            }
        }
    });

    const isoDate = nextDate ? nextDate.toISOString().split('T')[0] : null;
    await db.collection('users').doc(userId).update({
        nextExpirationDate: isoDate,
        nextExpirationAmount: nextDate ? nextAmount : 0
    });
}
