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
    if (req.method === 'OPTIONS') return res.status(200).end();

    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const cronHeader = req.headers["x-vercel-cron"] || req.headers["X-Vercel-Cron"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!cronHeader && (!authHeader || !SECRET || !authHeader.includes(SECRET))) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();
    
    // Configuración global y gatillos
    const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
    const triggerSource = req.body?.source || req.query?.source || 'Sistema (QStash)';
    const isSilent = req.query?.silent === 'true' || req.body?.silent === true;
    
    try {
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        let referenceDate = new Date();
        if (simulatedDateStr) {
            referenceDate = new Date(simulatedDateStr + 'T12:00:00');
            console.log(`[Birthdays] Usando fecha simulada: ${simulatedDateStr}`);
        }

        const currentYear = referenceDate.getFullYear().toString();
        const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
        const todayStr = referenceDate.toISOString().split('T')[0];

        const logResults = {
            totalToday: 0,
            processed: 0,
            pointsGivenTotal: 0,
            list: [],       // Para la extensión de Chrome: socios cumpleañeros con sus datos de contacto
            details: [],
            errors: []
        };

        const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
        const birthdayUsers = usersSnap.docs.filter(doc => doc.data().birthDate?.endsWith(todayMD));

        logResults.totalToday = birthdayUsers.length;

        for (const userDoc of birthdayUsers) {
            try {
                const userData = userDoc.data();
                const userId = userDoc.id;

                if (userData.lastBirthdayGreetingYear === currentYear) continue;

                const birthdayPoints = config?.birthdayPoints || 100;
                const autoBonusEnabled = config?.enableBirthdayBonus === true;
                const autoMessageEnabled = config?.enableBirthdayMessage !== false;

                let pointsAdded = 0;
                let actionsTaken = [];

                if (autoBonusEnabled && userData.lastBirthdayPointsYear !== currentYear) {
                    const historyRef = userDoc.ref.collection('points_history');
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

                if (autoMessageEnabled) {
                    const templateFull = config?.messaging?.templates?.birthday || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día. Te regalamos {puntos} puntos.";
                    const templateSimple = config?.messaging?.templates?.birthdaySimple || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día.";

                    const template = (pointsAdded > 0) ? templateFull : templateSimple;
                    const msg = template
                        .replace(/{nombre}/g, (userData.name || '').split(' ')[0])
                        .replace(/{puntos}/g, birthdayPoints.toString());

                    const title = "¡Feliz Cumpleaños! 🎂";

                    if (userData.fcmTokens?.length) {
                        try {
                            const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                            await app.messaging().sendEachForMulticast({
                                tokens: userData.fcmTokens,
                                data: { title, body: msg, url: "/profile", icon: config.logoUrl ? `${PWA_URL}${config.logoUrl}` : "" }
                            });
                            actionsTaken.push("push_sent");
                        } catch (e) { console.error("Error push birthday:", e); }
                    }

                    if (userData.email && process.env.SMTP_USER) {
                        try {
                            const innerHtml = `<div style="color: #333;"><h2 style="color: #db2777; margin-top: 0;">${title}</h2><p style="font-size: 16px; line-height: 1.6;">${msg}</p></div>`;
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

                    await userDoc.ref.collection('inbox').add({
                        title, body: msg, url: "/profile", type: "birthday", read: false,
                        date: admin.firestore.FieldValue.serverTimestamp(),
                        expireAt: admin.firestore.Timestamp.fromDate(new Date(referenceDate.getTime() + 30 * 24 * 60 * 60 * 1000))
                    });
                    actionsTaken.push("inbox_saved");

                    await userDoc.ref.update({ lastBirthdayGreetingYear: currentYear });
                }

                logResults.processed++;
                logResults.list.push({
                    id: userId,
                    name: userData.name || userData.nombre || 'Socio',
                    phone: userData.phone || userData.telefono || '',
                    dni: userData.dni || '',
                    socioNumber: userData.socioNumber || userData.numeroSocio || userData.socio_number || '',
                    lastBirthdayPointsYear: userData.lastBirthdayPointsYear || '',
                    pointsAdded
                });
                logResults.details.push({
                    userId,
                    userName: userData.name || userData.nombre || 'Socio',
                    dni: userData.dni || '',
                    socioNumber: userData.socioNumber || userData.numeroSocio || userData.socio_number || '',
                    action: actionsTaken.join(', '),
                    status: 'success',
                    info: pointsAdded > 0 ? `+${pointsAdded} pts` : 'Solo saludo'
                });

            } catch (err) {
                logResults.errors.push(`${userDoc.id}: ${err.message}`);
            }
        }

        // Auditoria
        if (!isSilent) {
            const isManual = triggerSource === 'dashboard';
            const logType = isManual ? 'manual_birthday' : 'birthday_engine';
            
            const summaryText = logResults.processed > 0
                ? `Proceso de Cumpleaños: ${logResults.processed} socios notificados (Puntaje Total Regalo: ${logResults.pointsGivenTotal}).`
                : `Revisión ejecutada: 0 cumpleañeros detectados hoy.`;
                
            await app.firestore().collection('audit_logs').add({
                type: logType,
                status: logResults.errors.length > 0 ? 'partial' : 'success',
                summary: summaryText,
                executor: isManual ? 'Ejecución Manual (Admin)' : 'Ejecución Automática (Sistema)',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                details: logResults.details.length > 0 ? logResults.details : [{
                    userId: 'system',
                    action: 'check_finished',
                    status: 'skipped',
                    info: 'Ningún socio cumple años en la fecha de hoy.'
                }]
            });
        }

        return res.status(200).json({ ok: true, summary: logResults });

    } catch (error) {
        console.error("[Birthdays Cron] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
