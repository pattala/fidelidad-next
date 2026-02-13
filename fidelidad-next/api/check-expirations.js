// /api/check-expirations.js
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

        // Verificar si el sistema está activo
        if (config.messaging?.enableExpirationWarnings === false) {
            return res.status(200).json({ ok: true, message: "Expirations system is disabled via config." });
        }

        // 2. Calcular fecha objetivo: Hoy + 7 días
        // Usamos la fecha del sistema del servidor (que coincide con el día de Vercel)
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 7);
        const targetDateStr = targetDate.toISOString().split('T')[0];

        console.log(`[Cron Expirations] Checking for users expiring on: ${targetDateStr}`);

        // 3. Buscar usuarios con ese vencimiento marcado en cache
        const usersSnap = await db.collection('users')
            .where('nextExpirationDate', '==', targetDateStr)
            .get();

        if (usersSnap.empty) {
            return res.status(200).json({ ok: true, message: "No users found for this date.", targetDate: targetDateStr });
        }

        const results = [];

        // 4. Procesar cada usuario
        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const userId = userDoc.id;

            // Evitar duplicados (no avisar dos veces el mismo día o muy seguido)
            // Solo avisamos si no se le avisó en los últimos 2 días (margen de error)
            const lastNotice = userData.lastExpirationNotice;
            const todayStr = new Date().toISOString().split('T')[0];
            if (lastNotice === todayStr) {
                console.log(`[Cron] Skipping user ${userId}, already noticed today.`);
                continue;
            }

            const amount = userData.nextExpirationAmount || 0;
            const channels = config.messaging?.eventConfigs?.expirationWarning?.channels || ['push', 'email'];
            const template = config.messaging?.templates?.expirationWarning ||
                "¡Hola {nombre}! 📢 Te recordamos que tienes {puntos} puntos que vencen el {fecha}. ¡Aprovéchalos antes de que expiren! 🎁";

            // Reemplazar variables
            const msg = template
                .replace(/{nombre}/g, userData.name || 'Socio')
                .replace(/{puntos}/g, amount.toString())
                .replace(/{fecha}/g, targetDateStr);

            const title = "⚠️ Tus puntos están por vencer";

            // A) PUSH NOTIFICATION
            if (channels.includes('push') && userData.fcmTokens?.length) {
                try {
                    await app.messaging().sendEachForMulticast({
                        tokens: userData.fcmTokens,
                        data: {
                            title,
                            body: msg,
                            url: "/mis-puntos",
                            icon: config.logoUrl || ""
                        }
                    });
                } catch (e) { console.error(`[Cron] Error Push for ${userId}:`, e.message); }
            }

            // B) EMAIL
            if (channels.includes('email') && userData.email && process.env.SMTP_USER) {
                try {
                    // Reutilizamos un layout simple
                    const html = `
                        <div style="font-family: sans-serif; padding: 20px; line-height: 1.6;">
                            <h2 style="color: #f97316;">${title}</h2>
                            <p>${msg}</p>
                            <div style="margin-top: 20px;">
                                <a href="${config.contact?.pwaUrl || '#'}/login" 
                                   style="background: #f97316; color: white; padding: 10px 20px; text-decoration: none; border-radius: 8px; font-weight: bold;">
                                   Ver mis puntos
                                </a>
                            </div>
                        </div>
                    `;
                    await transporter.sendMail({
                        from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                        to: userData.email,
                        subject: title,
                        html
                    });
                } catch (e) { console.error(`[Cron] Error Email for ${userId}:`, e.message); }
            }

            // C) INBOX (Historial interno)
            try {
                await db.collection('users').doc(userId).collection('inbox').add({
                    title,
                    body: msg,
                    url: "/mis-puntos",
                    type: "system",
                    read: false,
                    date: admin.firestore.FieldValue.serverTimestamp(),
                    expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 30 * 24 * 60 * 60 * 1000))
                });
            } catch (e) { console.error(`[Cron] Error Inbox for ${userId}:`, e.message); }

            // Marcar aviso enviado
            await userDoc.ref.update({ lastExpirationNotice: todayStr });
            results.push({ userId, status: 'notified' });
        }

        return res.status(200).json({
            ok: true,
            message: `Processed ${results.length} notifications.`,
            targetDate: targetDateStr,
            results
        });

    } catch (error) {
        console.error("[Cron Expirations] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
