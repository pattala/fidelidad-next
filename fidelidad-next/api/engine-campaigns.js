// /api/engine-campaigns.js
// Gestor de campañas: Maneja el auto-despacho (broadcast) y mantenimiento de campañas activas.

import admin from "firebase-admin";

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
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayDay = now.getDay();
        const currentH = now.getHours();

        // 1. CARGAR CONFIGURACIÓN GLOBAL
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : {
            enableDuplicateControl: true,
            messaging: { engineAllowedStartHour: 9, engineAllowedEndHour: 21 }
        };

        const allowedStart = config.messaging?.engineAllowedStartHour ?? 9;
        const allowedEnd = config.messaging?.engineAllowedEndHour ?? 21;
        const isWithinNotificationWindow = currentH >= allowedStart && currentH < allowedEnd;

        // --- DEDUPLICACIÓN INTELIGENTE (RED DE SEGURIDAD) ---
        const triggerSource = req.query?.trigger || req.body?.trigger || "unknown";
        const isManualSim = req.body?.isManual === true || req.query?.isManual === 'true';

        if (!isManualSim && triggerSource !== 'dashboard') {
            const arFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
                year: 'numeric', month: '2-digit', day: '2-digit'
            });
            const todayAR = arFormatter.format(new Date());

            // Usamos un marcador específico para campañas para no interferir con el diario
            const checkSnap = await db.collection('config').doc('campaignCheck').get();
            const checkData = checkSnap.exists ? checkSnap.data() : {};
            const lastRunDate = checkData.lastRunDate;
            const lastRunTimestamp = checkData.lastRunTimestamp || null;

            // Si ya corrió hoy, verificamos si hubo cambios administrativos
            if (lastRunDate === todayAR && lastRunTimestamp) {
                const recentAudits = await db.collection('audit_logs')
                    .where('timestamp', '>', lastRunTimestamp)
                    .where('type', 'in', ['campaign_mgmt', 'config_updated'])
                    .limit(1)
                    .get();

                if (recentAudits.empty) {
                    console.log(`[Engine-Campaigns] Todo al día. Gatillo ${triggerSource} saltado para ahorrar cuota.`);
                    return res.status(200).json({ ok: true, skipped: true, message: "Todo al día" });
                }
                console.log(`[Engine-Campaigns] Detectados cambios en campañas. Forzando ejecución para gatillo ${triggerSource}.`);
            }
        }

        // 2. OBTENER TODAS LAS CAMPAÑAS ACTIVAS
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
            // Si la campaña ya expiró, desactivar y saltar difusión.
            if (camp.endDate && camp.endDate < todayStr) {
                await doc.ref.update({ active: false });
                results.deactivated++;
                continue;
            }

            // Si es hoy, verificar hora de fin + gracia
            if (camp.endDate === todayStr && camp.endTime) {
                const [endH, endM] = camp.endTime.split(':').map(Number);
                const graceMins = camp.isFlash ? (camp.flashGraceMins || 15) : 0;
                const endTimeDate = new Date(now);
                endTimeDate.setHours(endH, endM, 0, 0);
                endTimeDate.setMinutes(endTimeDate.getMinutes() + graceMins);

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
            if (camp.startTime) {
                const [startH, startM] = camp.startTime.split(':').map(Number);
                const startTimeDate = new Date(now);
                startTimeDate.setHours(startH, startM, 0, 0);

                const leadMins = camp.broadcastLeadMins || 0;
                startTimeDate.setMinutes(startTimeDate.getMinutes() - leadMins);

                // Si aún falta para llegar al margen de antelación, saltar.
                if (now < startTimeDate) continue;

                // Si ya pasó mucho tiempo (ej. más de 6 horas desde el inicio), 
                // ya no tiene sentido mandar la notificación masiva de "inicio".
                const sixHoursLater = new Date(startTimeDate);
                sixHoursLater.setHours(sixHoursLater.getHours() + 6);
                if (now > sixHoursLater && !isManualSim) continue;
            }

            // --- EJECUCIÓN DEL BROADCAST ---
            console.log(`[Engine-Campaigns] Executing Broadcast for: ${camp.name}`);

            const title = camp.flashTitle || camp.title || camp.name;
            const body = camp.flashDescription || camp.description || "¡Nueva promoción disponible!";
            const url = camp.link || "/";

            // Obtener todos los socios con FCM o Email (simplificado)
            const usersSnap = await db.collection('users').get();
            const fcmTokens = [];
            const emails = [];

            usersSnap.forEach(u => {
                const uData = u.data();
                if (uData.fcmTokens?.length > 0) fcmTokens.push(...uData.fcmTokens);
                if (uData.email) emails.push({ email: uData.email, name: uData.name });
            });

            if (fcmTokens.length > 0 || emails.length > 0) {
                try {
                    // 1. ENVIAR PUSH (BATCH)
                    if (fcmTokens.length > 0) {
                        const chunks = [];
                        for (let i = 0; i < fcmTokens.length; i += 500) chunks.push(fcmTokens.slice(i, i + 500));
                        for (const chunk of chunks) {
                            await app.messaging().sendEachForMulticast({
                                tokens: chunk,
                                notification: { title, body },
                                data: { url, type: "campaign" }
                            });
                        }
                    }

                    // 2. ENVIAR EMAILS (Placeholder para integraciones futuras)

                    // 3. ACTUALIZAR MARCA DE ENVÍO
                    await doc.ref.update({ broadcastSentAt: todayStr });
                    results.notified++;
                    results.details.push({ id: campId, name: camp.name, tokens: fcmTokens.length });

                    // Auditoría
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'campaign_broadcast',
                        status: 'success',
                        summary: `Difusión automática: ${camp.name}`,
                        details: [{ campId, notifiedCount: fcmTokens.length, title, trigger: req.query.trigger || 'auto' }],
                        executor: 'system'
                    });

                } catch (err) {
                    console.error(`Error broadcasting campaign ${campId}:`, err);
                    results.details.push({ id: campId, name: camp.name, error: err.message });
                }
            }
        }

        // Marcar como ejecutado para deduplicación
        if (triggerSource !== 'dashboard' && !isManualSim) {
            const arFormatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit', day: '2-digit' });
            await db.collection('config').doc('campaignCheck').set({
                lastRunDate: arFormatter.format(new Date()),
                lastRunTimestamp: admin.firestore.FieldValue.serverTimestamp(),
                trigger: triggerSource
            }, { merge: true });
        }

        return res.status(200).json({ ok: true, results });

    } catch (error) {
        console.error("[Engine-Campaigns] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
