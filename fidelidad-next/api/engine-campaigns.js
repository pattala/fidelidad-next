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

const DEFAULT_TEMPLATES = {
    campaign: "🚀 ¡Nueva Campaña!: {titulo}. {descripcion}. ¡No te la pierdas! 🔥",
    offer: "🔥 ¡Oferta Especial! {titulo}: {detalle}. Válido hasta el {vencimiento}. 📢",
    flashOffer: "⚡ ¡OFERTA FLASH! {titulo}: {detalle}. Solo disponible hoy hasta las {horario} hs. 🔥"
};

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

    // V.1.6.4: Debug de Parámetros
    const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
    const triggerSource = req.query?.trigger || req.body?.trigger || "unknown";
    const isManualSim = req.body?.isManual === true || req.query?.isManual === 'true' || req.query?.ignoreDeduplication === 'true';

    console.log(`[Engine-Campaigns] RUN PARAMS -> simulatedDate: ${simulatedDateStr || 'NONE'} | trigger: ${triggerSource} | isManual: ${isManualSim}`);
    console.log(`[Engine-Campaigns] REQUEST -> Method: ${req.method} | Cron: ${!!req.headers["x-vercel-cron"]} | Auth: ${!!authHeader}`);

    // Solo permitir acceso con la clave secreta o cron
    if (!req.headers["x-vercel-cron"] && (!authHeader || !authHeader.includes(SECRET))) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    if (req.query.mode === 'downloadCSV') {
        try {
            const campId = req.query.campId || req.body?.campId;
            if (!campId) return res.status(400).json({ ok: false, error: "campId is required" });
            const campDoc = await db.collection('campanas').doc(campId).get();
            if (!campDoc.exists) return res.status(404).json({ ok: false, error: "Campaign not found" });
            const bonus = campDoc.data();
            const configDoc = await db.collection('config').doc('global').get();
            const configObj = configDoc.exists ? configDoc.data() : {};
            let template = "";
            if (bonus.isFlash) {
                template = configObj?.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
            } else if (bonus.rewardType === 'INFO' || bonus.rewardType === 'TEXT') {
                template = configObj?.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer;
            } else {
                template = configObj?.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign;
            }
            const usersSnap = await db.collection('users').get();
            let csvContent = "Nombre,Telefono,Mensaje\\n";
            usersSnap.forEach(doc => {
                const data = doc.data();
                if (data.role === 'admin' || !data.phone) return;
                let phoneNum = data.phone.replace(/\\D/g, '');
                if (!phoneNum.startsWith('54') && phoneNum.length === 10) phoneNum = '549' + phoneNum;
                const userName = data.name || data.nombre || '';
                const firstName = userName.split(' ')[0];
                let msg = template.replace(/{nombre}/g, firstName).replace(/{nombre_completo}/g, userName);
                if (bonus.isFlash) {
                    const horario = bonus.endTime || '23:59';
                    const hora_inicio = bonus.startTime || '00:00';
                    msg = msg.replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                                .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : ''))
                                .replace(/{horario}/g, horario)
                                .replace(/{hora_inicio}/g, hora_inicio);
                } else if (bonus.rewardType === 'INFO' || bonus.rewardType === 'TEXT') {
                    const vencimiento = bonus.endDate ? new Date(bonus.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'agotar stock';
                    msg = msg.replace(/{titulo}/g, bonus.title || bonus.name)
                                .replace(/{detalle}/g, bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : ''))
                                .replace(/{vencimiento}/g, vencimiento);
                } else {
                    msg = msg.replace(/{titulo}/g, bonus.title || bonus.name)
                                .replace(/{descripcion}/g, bonus.description || '');
                }
                const escapeCSV = (str) => `"${str.replace(/"/g, '""')}"`;
                csvContent += `${escapeCSV(userName)},${phoneNum},${escapeCSV(msg)}\\n`;
            });
            return res.status(200).json({ ok: true, csvContent });
        } catch (error) {
            console.error("Error generating CSV:", error);
            return res.status(500).json({ ok: false, error: error.message });
        }
    }

    let auditLogRef = null;

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
        // Soporta rangos nocturnos que cruzan la medianoche
        let isWithinNotificationWindow = true;
        if (allowedStart !== allowedEnd) {
            if (allowedStart < allowedEnd) {
                // Rango normal
                isWithinNotificationWindow = (currentH >= allowedStart && currentH < allowedEnd);
            } else {
                // Rango nocturno
                isWithinNotificationWindow = (currentH >= allowedStart || currentH < allowedEnd);
            }
        }

        const triggerSourceParam = req.query?.trigger || req.body?.trigger || "unknown";

        // Identificación de Ejecutor para Auditoría
        let executorDetail = "SISTEMA (Auto)";
        if (simulatedDateParam) {
            executorDetail = `SIMULADOR (${simulatedDateParam})`;
        } else if (triggerSourceParam === 'dashboard' || triggerSourceParam === 'sidebar_manual' || triggerSourceParam === 'manual') {
            executorDetail = "SISTEMA (Panel)";
        } else if (triggerSourceParam === 'extension') {
            executorDetail = "SISTEMA (Extensión)";
        }

        // V.1.6.4: Registrar SIEMPRE el inicio en la auditoría al comienzo
        auditLogRef = await db.collection('audit_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'campaign_engine_execution',
            status: 'running',
            summary: `Ejecutando motor de campañas (${todayStr})`,
            executor: executorDetail,
            triggerSource: triggerSourceParam,
            simulated: !!simulatedDateParam
        });

        // 2. VERIFICAR CONFIGURACIÓN SIMULADOR
        if (config.simulationConfig?.campaigns === false) {
            await auditLogRef.update({
                status: 'skipped',
                summary: "Motor omitido: Campañas desactivadas en el simulador"
            });
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
            if (camp.endDate && camp.endDate < todayStr) {
                await doc.ref.update({ active: false });
                results.deactivated++;
                continue;
            }

            // Si es hoy, verificar hora de fin + gracia
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

            // --- B. DIFUSIÓN AUTOMÁTICA ---
            if (!camp.autoBroadcast) {
                results.skipped++;
                continue;
            }

            // 1. ¿Ya se envió hoy?
            if (camp.broadcastSentAt === todayStr && !isManualSim) {
                results.skipped++;
                continue;
            }

            // 1.5 Lógica para Tradicionales (Primer día y fechas adicionales)
            if (!camp.isFlash) {
                const hasBeenSentBefore = !!camp.broadcastSentAt;
                const isScheduledForToday = camp.additionalBroadcastDates && camp.additionalBroadcastDates.includes(todayStr);

                // Si ya fue enviada alguna vez en su historia y HOY no es una fecha programada adicional, se saltea.
                // (Si NO fue enviada nunca, se permite pasar para que haga su envío inicial).
                if (hasBeenSentBefore && !isScheduledForToday && !isManualSim) {
                    results.skipped++;
                    continue;
                }
            }

            // 2. ¿Dentro de la Ventana de Notificación?
            if (!isWithinNotificationWindow && !isManualSim && !camp.isFlash) {
                results.skipped++;
                continue;
            }

            // 3. ¿La fecha de inicio ya llegó?
            const campStartDate = camp.startDate || camp.flashDate || null;
            if (campStartDate && campStartDate > todayStr) {
                results.skipped++;
                continue;
            }

            // 4. ¿Es el día de la semana correcto?
            const targetDays = camp.isFlash ? camp.flashDays : camp.daysOfWeek;
            if (targetDays && Array.isArray(targetDays) && targetDays.length > 0 && !targetDays.includes(todayDay)) {
                results.skipped++;
                continue;
            }

            // 5. ¿Estamos en el momento de la Antelación?
            if (camp.startTime) {
                const [startH, startM] = camp.startTime.split(':').map(Number);
                const startTimeDate = new Date(now);
                startTimeDate.setHours(startH, startM, 0, 0);

                if (camp.isFlash) {
                    const leadMins = camp.broadcastLeadMins || 0;
                    startTimeDate.setMinutes(startTimeDate.getMinutes() - leadMins);
                }

                // Si aún falta para llegar al margen de antelación, saltar (salvo modo manual).
                if (now < startTimeDate && !isManualSim) {
                    results.skipped++;
                    continue;
                }

                // Si ya pasó mucho tiempo (ej. más de 6 horas desde el inicio), ya no enviar.
                if (camp.isFlash) {
                    const sixHoursLater = new Date(startTimeDate);
                    sixHoursLater.setHours(sixHoursLater.getHours() + 6);
                    if (now > sixHoursLater && !isManualSim) {
                        results.skipped++;
                        continue;
                    }
                }
            } else if (!camp.isFlash) {
                if (camp.startDate && camp.startDate > todayStr) {
                    results.skipped++;
                    continue;
                }
            }

            // --- EJECUCIÓN DEL BROADCAST ---
            console.log(`[Engine-Campaigns] Executing Broadcast for: ${camp.name}`);

            // V.1.6.4: Construir los mensajes utilizando el formato estético premium de plantillas
            let template = "";
            let msg = "";
            
            // Valores dinámicos por defecto
            const tituloCamp = camp.isFlash ? (camp.flashTitle || camp.title || camp.name) : (camp.title || camp.name);
            const descCamp = camp.isFlash ? (camp.flashDescription || camp.description || '') : (camp.description || '');
            const premio = camp.rewardText || (camp.rewardValue ? camp.rewardValue.toString() : '');
            const puntos = camp.rewardValue ? camp.rewardValue.toString() : '';
            const horario = camp.endTime || '23:59';
            const hora_inicio = camp.startTime || '';
            const vencimiento = camp.endDate ? new Date(camp.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'agotar stock';

            if (camp.isFlash) {
                template = config.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
                msg = template
                    .replace(/{titulo}/g, tituloCamp)
                    .replace(/{detalle}/g, descCamp || (premio ? `¡${premio}!` : ''))
                    .replace(/{descripcion}/g, descCamp)
                    .replace(/{horario}/g, horario)
                    .replace(/{hora_inicio}/g, hora_inicio)
                    .replace(/{premio}/g, premio)
                    .replace(/{puntos}/g, puntos);
            } else if (camp.rewardType === 'INFO' || camp.rewardType === 'TEXT') {
                template = config.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer;
                msg = template
                    .replace(/{titulo}/g, tituloCamp)
                    .replace(/{detalle}/g, descCamp || (premio ? `¡${premio}!` : ''))
                    .replace(/{descripcion}/g, descCamp)
                    .replace(/{vencimiento}/g, vencimiento)
                    .replace(/{premio}/g, premio)
                    .replace(/{puntos}/g, puntos);
            } else {
                template = config.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign;
                msg = template
                    .replace(/{titulo}/g, tituloCamp)
                    .replace(/{descripcion}/g, descCamp || '¡Sumá más puntos!')
                    .replace(/{detalle}/g, descCamp || '¡Sumá más puntos!')
                    .replace(/{premio}/g, premio)
                    .replace(/{puntos}/g, puntos)
                    .replace(/{vencimiento}/g, vencimiento);
            }

            // Fallback general por si quedó alguna etiqueta
            msg = msg.replace(/{hora_inicio}/g, hora_inicio).replace(/{horario}/g, horario).replace(/{descripcion}/g, descCamp).replace(/{titulo}/g, tituloCamp);

            // El título nativo de la push notification (en negrita arriba de todo)
            const title = camp.isFlash ? "⚡ ¡OFERTA FLASH!" : (camp.rewardType === 'INFO' || camp.rewardType === 'TEXT' ? "🎁 ¡Oferta Especial!" : "🚀 ¡Nueva Campaña!");
            // Se puede sobrescribir si en la config admin pusieron algo. Pero lo dejamos así por impacto visual, y usamos el título real en el cuerpo.
            
            const body = msg;
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
                    const validTokens = (uData.fcmTokens || []).map(t => typeof t === 'object' && t !== null ? t.token : t).filter((t) => t && typeof t === 'string' && t.length > 10);
                    if (validTokens.length > 0) fcmTokens.push(...validTokens);
                }
                if (uData.email) emails.push({ email: uData.email, name: uData.name || uData.nombre || '' });
            });

            if (userDocs.length > 0 || emails.length > 0) {
                try {
                    // 0. CANDADO ANTI-DUPLICADOS (Transacción Atómica)
                    const shouldBroadcast = await db.runTransaction(async (transaction) => {
                        const freshDoc = await transaction.get(doc.ref);
                        if (!freshDoc.exists) return false;
                        
                        const freshData = freshDoc.data();
                        if (freshData.broadcastSentAt === todayStr && !isManualSim) {
                            return false; // Otro proceso paralelo ya lo mandó en este milisegundo
                        }
                        
                        // Bloqueamos el envío para otros marcándolo ahora mismo
                        transaction.update(doc.ref, { broadcastSentAt: todayStr });
                        return true;
                    });

                    if (!shouldBroadcast) {
                        console.log(`[Engine-Campaigns] Carrera detectada y evitada. Campaña ${camp.name} ya enviada hoy por otro proceso.`);
                        results.skipped++;
                        continue;
                    }

                    // 1. ENVIAR PUSH INDIVIDUALIZADO (Soporte para {nombre})
                    if (config.messaging?.pushEnabled !== false) {
                        const messages = [];
                        userDocs.forEach(u => {
                            const validTokens = (u.data.fcmTokens || []).map(t => typeof t === 'object' && t !== null ? t.token : t).filter((t) => t && typeof t === 'string' && t.length > 10) || [];
                            
                            // Personalizar para cada socio
                            const userName = u.data.name || u.data.nombre || 'Socio';
                            const personalizedBody = body.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName);
                            
                            validTokens.forEach(token => {
                                messages.push({
                                    token: token,
                                    data: { 
                                        id: db.collection("_ids").doc().id,
                                        title, 
                                        body: personalizedBody, 
                                        url, 
                                        click_action: url,
                                        type: "campaign", 
                                        icon: iconUrl,
                                        badge: iconUrl
                                    },
                                    notification: { title, body: personalizedBody },
                                    android: { 
                                        priority: "high",
                                        notification: {
                                            sound: "default",
                                            channelId: "fidelidad-notif-channel"
                                        }
                                    },
                                    webpush: { 
                                        headers: { Urgent: "high" },
                                        fcmOptions: { link: `${PWA_URL}${url.startsWith('/') ? url : '/' + url}` } 
                                    }
                                });
                            });
                        });

                        if (messages.length > 0) {
                            const chunks = [];
                            for (let i = 0; i < messages.length; i += 500) chunks.push(messages.slice(i, i + 500));
                            
                            for (const chunk of chunks) {
                                try {
                                    await app.messaging().sendEach(chunk);
                                    console.log(`[Engine-Campaigns] Push batch sent with ${chunk.length} personalized messages.`);
                                } catch (pError) {
                                    console.error("[Engine-Campaigns] Push chunk error:", pError.message);
                                }
                            }
                        }
                    }

                    // 2. ENVIAR EMAILS (V.1.6.6: Envío directo por SMTP para evitar fallos de fetch loopback)
                    if (emails.length > 0 && config.messaging?.emailEnabled !== false && process.env.SMTP_USER && process.env.SMTP_PASS) {
                        const emailPromises = emails.map(async ({ email, name }) => {
                            // Personalizar {nombre} en el cuerpo
                            const userName = name || 'Socio';
                            const personalizedBody = body.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName);
                            const htmlContent = buildHtmlLayout(
                                `<div style="color:#333">
                                    <h2 style="color:#6366f1;margin-top:0">${title}</h2>
                                    <p style="font-size:16px;line-height:1.6">${personalizedBody}</p>
                                    ${url && url !== '/' ? `<p><a href="${PWA_URL}${url}" style="background:#6366f1;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold">Ver Oferta</a></p>` : ''}
                                 </div>`,
                                config
                            );

                            try {
                                const sendInfo = await transporter.sendMail({
                                    from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                                    to: email,
                                    subject: title,
                                    html: htmlContent
                                });

                                // Auditoría de éxito
                                let userId = 'unknown';
                                const userQuery = await db.collection('users').where('email', '==', email).limit(1).get();
                                if (!userQuery.empty) {
                                    userId = userQuery.docs[0].id;
                                }

                                return db.collection('audit_logs').add({
                                    timestamp: admin.firestore.Timestamp.fromDate(now),
                                    type: 'email_notification',
                                    status: 'success',
                                    summary: `Email enviado a ${name} (${email}): "${title}"`,
                                    details: [{ userId, userName: name, to: email, subject: title, messageId: sendInfo.messageId, campName: camp.name }],
                                    executor: 'system'
                                });
                            } catch (e) {
                                console.error(`[Engine-Campaigns] Campaign email error for ${email}:`, e.message);
                                // Auditoría de error
                                return db.collection('audit_logs').add({
                                    timestamp: admin.firestore.Timestamp.fromDate(now),
                                    type: 'campaign_email_error',
                                    status: 'failed',
                                    summary: `Error al enviar email a ${name} (${email})`,
                                    details: [{ email, error: e.message, campName: camp.name }],
                                    executor: 'system'
                                });
                            }
                        });
                        await Promise.allSettled(emailPromises);
                    }

                    // 3. INBOX (V.1.6.6: Reemplazo dinámico de {nombre} y campos extendidos)
                    if (config.messaging?.inboxEnabled !== false) {
                        const inboxBatch = db.batch();
                        userDocs.forEach(u => {
                            const inboxRef = u.ref.collection('inbox').doc();
                            // Personalizar {nombre} en el cuerpo
                            const userName = u.data.name || u.data.nombre || 'Socio';
                            const personalizedBody = body.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName);
                            inboxBatch.set(inboxRef, {
                                title, 
                                body: personalizedBody, 
                                url, 
                                type: 'campaign', 
                                read: false,
                                date: admin.firestore.Timestamp.fromDate(now),
                                sentAt: admin.firestore.Timestamp.fromDate(now),
                                status: "sent"
                            });
                        });
                        await inboxBatch.commit();
                    }

                    // 3. (MARCA DE ENVÍO YA GRABADA POR LA TRANSACCIÓN)
                    results.notified++;
                    results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length });

                    // Auditoría + Recordatorio de WhatsApp
                    const affected = userDocs.map(u => ({ id: u.id, name: u.data.name || u.data.nombre || 'Socio', email: u.data.email }));
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.Timestamp.fromDate(now),
                        type: 'campaign_broadcast',
                        status: 'success',
                        summary: `Difusi�n autom�tica: ${camp.name}`,
                        details: [{ campId, notifiedCount: fcmTokens.length, userCount: userDocs.length, affectedUsers: affected, title, trigger: req.query.trigger || 'auto', action: 'campaign_broadcasted', campName: camp.name, timestamp: now.toISOString() }],
                        executor: 'system'
                    });
                    
                    // Alerta espec�fica para generar el CSV en el Dashboard
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.Timestamp.fromDate(now),
                        type: 'campaign_whatsapp_csv',
                        status: 'success',
                        summary: `Generaci�n de CSV para WhatsApp pendiente: ${camp.name}`,
                        details: [{ action: 'csv_downloaded', campaignId: campId }],
                        executor: 'system'
                    });

                } catch (err) {
                    console.error(`Error broadcasting campaign ${campId}:`, err);
                    results.details.push({ id: campId, name: camp.name, error: err.message });
                }
            }
        }

        // V.1.6.4: Actualizar auditoría con éxito al finalizar
        if (auditLogRef) {
            await auditLogRef.update({
                status: 'success',
                summary: `Motor de campañas finalizado: ${results.notified} difusiones, ${results.deactivated} desactivadas.`,
                details: [results]
            });
        }

        // Registrar timestamp del último run sin bloquear futuras ejecuciones
        const arFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
        await db.collection('config').doc('campaignCheck').set({
            lastRunDate: arFormatter.format(now),
            lastRunTimestamp: admin.firestore.Timestamp.fromDate(now),
            trigger: triggerSource
        }, { merge: true });

        return res.status(200).json({ ok: true, results });

    } catch (error) {
        console.error("[Engine-Campaigns] Fatal Error:", error);
        
        try {
            if (auditLogRef) {
                await auditLogRef.update({
                    status: 'failed',
                    summary: `Falla en motor de campañas: ${error.message}`
                });
            }
        } catch (auditErr) {
            console.error("Failed to update audit log error:", auditErr);
        }

        return res.status(500).json({ ok: false, error: error.message });
    }
}
