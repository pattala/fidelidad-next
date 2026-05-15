// /api/engine-campaigns.js
// Gestor de campañas: Maneja el auto-despacho (broadcast) y mantenimiento de campañas activas.

import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { buildHtmlLayout } from "../utils/emailLayout.js";
import { getEffectiveDate } from "../utils/timeUtils.js";

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    tls: { rejectUnauthorized: false }
});

function getAbsoluteUrl(url, baseUrl) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const base = (baseUrl || "").replace(/\/$/, "");
    return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

function initFirebaseAdmin() {
    try {
        if (!admin.apps.length) {
            const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
            if (!credsRaw) {
                console.error("[Firebase Admin Campaigns] MISSING GOOGLE_CREDENTIALS_JSON");
                throw new Error("Missing credentials.");
            }
            
            let creds;
            try { 
                creds = JSON.parse(credsRaw); 
            } catch (err) { 
                creds = JSON.parse(credsRaw.replace(/\\n/g, "\n")); 
            }
            
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: creds.project_id,
                    clientEmail: creds.client_email,
                    privateKey: creds.private_key?.replace(/\\n/g, "\n"),
                }),
            });
            console.log("[Firebase Admin Campaigns] Initialized successfully");
        }
        return admin;
    } catch (error) {
        console.error("[Firebase Admin Campaigns] Init Error:", error.message);
        throw error;
    }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];

    // Solo permitir acceso con la clave secreta o cron
    if (!req.headers["x-vercel-cron"] && (!authHeader || !authHeader.includes(SECRET))) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    try {
        // 1. CARGAR CONFIGURACIÓN GLOBAL
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : {
            enableDuplicateControl: true,
            messaging: { engineAllowedStartHour: 9, engineAllowedEndHour: 21 }
        };

        const simulatedDateParam = req.body?.simulatedDate || req.query?.simulatedDate;

        // Usamos la utilidad centralizada para respetar el Simulador
        const now = await getEffectiveDate(db, simulatedDateParam);
        
        if (simulatedDateParam || (config.enableDateSimulator && config.simulatedOffsetDays)) {
            console.log(`[Engine-Campaigns] Usando fecha efectiva (simulada): ${now.toISOString().split('T')[0]}`);
        }

        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        const todayDay = now.getDay();
        const currentH = now.getHours();

        const allowedStart = config.messaging?.engineAllowedStartHour ?? 9;
        const allowedEnd = config.messaging?.engineAllowedEndHour ?? 21;
        const isWithinNotificationWindow = currentH >= allowedStart && currentH < allowedEnd;

        // --- DEDUPLICACIÓN DE SEGURIDAD ---
        const triggerSource = req.query?.trigger || req.body?.trigger || "unknown";
        const isManualSim = req.body?.isManual === true || req.query?.isManual === 'true' || req.query?.ignoreDeduplication === 'true';
        
        // Formateador para logs y comparaciones consistentes
        const arFormatter = new Intl.DateTimeFormat('en-CA', {
            timeZone: 'America/Argentina/Buenos_Aires',
            year: 'numeric', month: '2-digit', day: '2-digit'
        });
        const todayAR = arFormatter.format(now);


        // 2. VERIFICAR SIMULADOR
        if (config.simulationConfig?.campaigns === false) {
            return res.status(200).json({ ok: true, skipped: true, message: "Campañas desactivadas en el simulador" });
        }

        // 3. OBTENER TODAS LAS CAMPAÑAS ACTIVAS
        const snapshot = await db.collection('campanas').where('active', '==', true).get();

        const results = {
            processed: 0,
            notified: 0,
            deactivated: 0,
            skipped: 0,
            details: []
        };

        for (const doc of snapshot.docs) {
            const camp = doc.data();
            const campId = doc.id;
            results.processed++;

            // --- A. MANTENIMIENTO PREVENTIVO (24/7) ---
            // Solo desactivar si tiene una FECHA de fin explícita y ya pasó.
            // Las campañas Flash recurrentes NO deben desactivarse solas.
            if (camp.endDate && camp.endDate < todayStr) {
                await doc.ref.update({ active: false });
                results.deactivated++;
                continue;
            }

            // Si es hoy, verificar hora de fin + gracia (Solo para TRADICIONALES con fecha de fin hoy)
            if (!camp.isFlash && camp.endDate === todayStr && camp.endTime) {
                const [endH, endM] = camp.endTime.split(':').map(Number);
                const endTimeDate = new Date(now);
                endTimeDate.setHours(endH, endM, 0, 0);

                if (now > endTimeDate) {
                    await doc.ref.update({ active: false });
                    results.deactivated++;
                    continue;
                }
            }

            // --- B. DIFUSIÓN AUTOMÁTICA (Respetando Ventana) ---
            if (!camp.autoBroadcast) continue;

            // 1. ¿Ya se envió hoy?
            if (camp.broadcastSentAt === todayStr && !isManualSim) {
                results.skipped++;
                continue;
            }

            // 2. ¿Dentro de la Ventana de Notificación?
            if (!isWithinNotificationWindow && !isManualSim) {
                // Si la campaña empieza antes de las 9 AM, se notificará a las 9 AM exactas.
                continue;
            }

            // 3. ¿Es el día de la semana correcto?
            const targetDays = camp.isFlash ? camp.flashDays : camp.daysOfWeek;
            if (targetDays && Array.isArray(targetDays) && targetDays.length > 0 && !targetDays.includes(todayDay)) continue;

            // 4. ¿Estamos en el momento de la Antelación?
            // V.1.4.67: Si es TRADICIONAL, no esperamos a la hora de inicio, se manda apenas arranca el día.
            // PERO si tiene startTime definido, lo respetamos (V.1.4.79)
            if (camp.startTime) {
                const [startH, startM] = camp.startTime.split(':').map(Number);
                const startTimeDate = new Date(now);
                startTimeDate.setHours(startH, startM, 0, 0);

                if (camp.isFlash) {
                    const leadMins = camp.broadcastLeadMins || 0;
                    startTimeDate.setMinutes(startTimeDate.getMinutes() - leadMins);
                }

                // Si aún falta para llegar al margen de antelación, saltar.
                if (now < startTimeDate) continue;

                // Si ya pasó mucho tiempo (ej. más de 6 horas desde el inicio), 
                // ya no tiene sentido mandar la notificación masiva de "inicio".
                if (camp.isFlash) {
                    const sixHoursLater = new Date(startTimeDate);
                    sixHoursLater.setHours(sixHoursLater.getHours() + 6);
                    if (now > sixHoursLater && !isManualSim) continue;
                }
            } else if (!camp.isFlash) {
                // Para tradicionales sin startTime, simplemente verificamos que la fecha de inicio ya haya llegado
                if (camp.startDate && camp.startDate > todayStr) continue;
            }

            // --- EJECUCIÓN DEL BROADCAST ---
            console.log(`[Engine-Campaigns] Executing Broadcast for: ${camp.name}`);

            const title = camp.flashTitle || camp.title || camp.name;
            const body = camp.flashDescription || camp.description || "¡Nueva promoción disponible!";
            const url = camp.link || "/";

            const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
            const iconUrl = config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "";
            const usersSnap = await db.collection('users').get();
            const fcmTokens = [];
            const userDocs = [];
            const emails = [];

            usersSnap.forEach(u => {
                const uData = u.data();
                if (uData.role === 'admin') return;
                userDocs.push({ id: u.id, ref: u.ref, data: uData });
                if (uData.fcmTokens?.length > 0) {
                    const validTokens = uData.fcmTokens.filter((t: any) => t && typeof t === 'string' && t.length > 10);
                    if (validTokens.length > 0) fcmTokens.push(...validTokens);
                }
                if (uData.email) emails.push({ email: uData.email, name: uData.name || uData.nombre || '' });
            });

            if (fcmTokens.length > 0 || emails.length > 0) {
                try {
                    // 1. ENVIAR PUSH (BATCH) con logo
                    if (fcmTokens.length > 0 && config.messaging?.pushEnabled !== false) {
                        const chunks = [];
                        for (let i = 0; i < fcmTokens.length; i += 500) chunks.push(fcmTokens.slice(i, i + 500));
                        for (const chunk of chunks) {
                            await app.messaging().sendEachForMulticast({
                                tokens: chunk,
                                notification: { title, body, icon: iconUrl || undefined },
                                data: { url, type: "campaign", icon: iconUrl },
                                webpush: { fcmOptions: { link: `${PWA_URL}${url.startsWith('/') ? url : '/' + url}` } }
                            });
                        }
                    }

                    // 2. ENVIAR EMAILS
                    if (emails.length > 0 && process.env.SMTP_USER && config.messaging?.emailEnabled !== false) {
                        const innerHtml = `<div style="color:#333"><h2 style="color:#6366f1;margin-top:0">${title}</h2><p style="font-size:16px;line-height:1.6">${body}</p>${url && url !== '/' ? `<p><a href="${PWA_URL}${url}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Ver Oferta</a></p>` : ''}</div>`;
                        const emailPromises = emails.map(({ email, name }) =>
                            transporter.sendMail({
                                from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                                to: email,
                                subject: title,
                                html: buildHtmlLayout(innerHtml, config)
                            }).catch(e => console.error(`Campaign email error for ${email}:`, e.message))
                        );
                        await Promise.allSettled(emailPromises);
                    }

                    // 3. INBOX (por usuario)
                    if (config.messaging?.inboxEnabled !== false) {
                        const inboxBatch = db.batch();
                        userDocs.forEach(u => {
                            const inboxRef = u.ref.collection('inbox').doc();
                            inboxBatch.set(inboxRef, {
                                title, body, url, type: 'campaign', read: false,
                                date: admin.firestore.Timestamp.fromDate(now)
                            });
                        });
                        await inboxBatch.commit();
                    }

                    // 3. ACTUALIZAR MARCA DE ENVÍO
                    await doc.ref.update({ broadcastSentAt: todayStr });
                    results.notified++;
                    results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length });

                    // Auditoría + Recordatorio de WhatsApp
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.Timestamp.fromDate(now),
                        type: 'campaign_broadcast',
                        status: 'success',
                        summary: `Difusión automática: ${camp.name}`,
                        details: [{ campId, notifiedCount: fcmTokens.length, title, trigger: req.query.trigger || 'auto', action: 'campaign_broadcasted', campName: camp.name }],
                        executor: 'system'
                    });

                } catch (err) {
                    console.error(`Error broadcasting campaign ${campId}:`, err);
                    results.details.push({ id: campId, name: camp.name, error: err.message });
                }
            }
        }

        // Marcar como ejecutado para deduplicación (SOLO si estamos en la ventana de notificación)
        if (triggerSource !== 'dashboard' && !isManualSim && isWithinNotificationWindow) {
            const arFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
            await db.collection('config').doc('campaignCheck').set({
                lastRunDate: arFormatter.format(now),
                lastRunTimestamp: admin.firestore.Timestamp.fromDate(now),
                trigger: triggerSource
            }, { merge: true });
        }

        return res.status(200).json({ ok: true, results });

    } catch (error) {
        console.error("[Engine-Campaigns] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
