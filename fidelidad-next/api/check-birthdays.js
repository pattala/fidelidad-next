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

export default async function handler(req, res) {
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const cronHeader = req.headers["x-vercel-cron"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!cronHeader && (!authHeader || !authHeader.includes(SECRET))) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    try {
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        // Determinar Fecha de Referencia
        let referenceDate = new Date();
        if (req.body?.simulatedDate) {
            referenceDate = new Date(req.body.simulatedDate);
        }

        const currentYear = referenceDate.getFullYear().toString();
        const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;

        const logResults = {
            totalToday: 0,
            processed: 0,
            pointsGivenTotal: 0,
            details: [],
            errors: []
        };

        // LOG DE INICIO (Confirmación de que Vercel arrancó el motor)
        await db.collection('audit_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'birthday_engine',
            status: 'running',
            summary: "Iniciando proceso de chequeo de cumpleaños.",
            details: [],
            executor: 'system'
        });

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

                // 1. Evitar duplicar saludo el mismo año
                if (userData.lastBirthdayGreetingYear === currentYear) continue;

                const birthdayPoints = config?.birthdayPoints || 100;
                const autoBonusEnabled = config?.enableBirthdayBonus === true;
                const autoMessageEnabled = config?.enableBirthdayMessage !== false;

                let pointsAdded = 0;
                let actionsTaken = [];

                // 2. Aplicar Bono de Puntos
                if (autoBonusEnabled && userData.lastBirthdayPointsYear !== currentYear) {
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
                    const template = config?.messaging?.templates?.birthday || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día.";
                    const msg = template
                        .replace(/{nombre}/g, (userData.name || '').split(' ')[0])
                        .replace(/{puntos}/g, birthdayPoints.toString());

                    const title = "¡Feliz Cumpleaños! 🎂";

                    // PUSH
                    if (userData.fcmTokens?.length) {
                        try {
                            await app.messaging().sendEachForMulticast({
                                tokens: userData.fcmTokens,
                                data: { title, body: msg, url: "/", icon: config.logoUrl || "" }
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

                    await userDoc.ref.update({ lastBirthdayGreetingYear: currentYear });
                }

                logResults.processed++;
                logResults.details.push({
                    userId,
                    userName: userData.name || userData.nombre || 'Socio',
                    action: actionsTaken.join(', '),
                    status: 'success',
                    info: pointsAdded > 0 ? `+${pointsAdded} pts` : 'Solo saludo'
                });

            } catch (userError) {
                console.error(`[Birthdays] Error processing ${userDoc.id}:`, userError);
                logResults.errors.push(`${userDoc.id}: ${userError.message}`);
            }
        }

        // 4. GUARDAR LOG DE AUDITORÍA
        try {
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'birthday_engine',
                status: logResults.errors.length === 0 ? 'success' : 'partial',
                summary: logResults.totalToday === 0
                    ? "Ejecutado: No hay cumpleaños para procesar hoy."
                    : `Socios hoy: ${logResults.totalToday}, Procesados: ${logResults.processed}, Puntos: ${logResults.pointsGivenTotal}`,
                details: logResults.details.slice(0, 500),
                executor: 'system'
            });
        } catch (logError) {
            console.error("[Birthdays] Error saving audit log:", logError);
        }

        return res.status(200).json({
            ok: true,
            summary: logResults,
            today: todayMD
        });

    } catch (error) {
        console.error("[Birthdays Cron] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
