import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { updateNextExpirationDate } from "../utils/_expiration-utils.js";
import { buildHtmlLayout } from "../utils/emailLayout.js";
import { getEffectiveDate } from "../utils/timeUtils.js";

// ---------- Inicialización Firebase Admin ----------
function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
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
    return admin.firestore();
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// --- TAREA 1: PROCESAR CUMPLEAÑOS ---
async function processBirthdays(db, referenceDate, config, logResults) {
    const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
    const currentYear = referenceDate.getFullYear().toString();

    const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
    const birthdayUsers = usersSnap.docs.filter(doc => doc.data().birthDate?.endsWith(todayMD));

    for (const userDoc of birthdayUsers) {
        const userData = userDoc.data();
        if (userData.lastBirthdayGreetingYear === currentYear) continue;

        const birthdayPoints = config.birthdayPoints || 100;
        if (config.enableBirthdayBonus !== false) {
            await userDoc.ref.update({
                points: admin.firestore.FieldValue.increment(birthdayPoints),
                lastBirthdayGreetingYear: currentYear
            });
            await userDoc.ref.collection('points_history').add({
                amount: birthdayPoints,
                concept: '🎂 ¡Feliz Cumpleaños!',
                date: admin.firestore.Timestamp.fromDate(referenceDate),
                type: 'credit',
                remainingPoints: birthdayPoints
            });
            logResults.details.push({ userId: userDoc.id, action: 'birthday_bonus', info: `${birthdayPoints} pts` });
        }
    }
}

// --- TAREA 2: PROCESAR VENCIMIENTOS ---
async function processExpirations(db, referenceDate, config, logResults) {
    const referenceDateStr = referenceDate.toISOString().split('T')[0];
    const startOfToday = new Date(referenceDate);
    startOfToday.setHours(0, 0, 0, 0);

    const toExpireSnap = await db.collection('users').where('nextExpirationDate', '<=', referenceDateStr).get();
    for (const userDoc of toExpireSnap.docs) {
        const userId = userDoc.id;
        const historyRef = userDoc.ref.collection('points_history');
        const expiredItemsSnap = await historyRef.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).get();
        
        let totalToSubtract = 0;
        const batch = db.batch();
        expiredItemsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.status === 'expired') return;
            const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
            if (data.type === 'credit' && rem > 0) {
                totalToSubtract += rem;
                batch.update(d.ref, { status: 'expired', remainingPoints: 0, processedAt: admin.firestore.FieldValue.serverTimestamp() });
            }
        });

        if (totalToSubtract > 0) {
            batch.update(userDoc.ref, { points: admin.firestore.FieldValue.increment(-totalToSubtract) });
            batch.set(historyRef.doc(), { amount: -totalToSubtract, concept: 'Vencimiento automático', date: admin.firestore.FieldValue.serverTimestamp(), type: 'debit', isExpirationAdjustment: true });
            await batch.commit();
            logResults.details.push({ userId, action: 'expired', info: `${totalToSubtract} pts` });
        }
        await updateNextExpirationDate(db, userId, referenceDate);
    }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    if (!authHeader || !authHeader.includes(SECRET)) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const db = initFirebaseAdmin();
    try {
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};

        const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
        const referenceDate = await getEffectiveDate(db, simulatedDateStr);
        
        const logResults = { details: [] };

        // Ejecución secuencial en memoria (SIN FETCH INTERNOS)
        await processBirthdays(db, referenceDate, config, logResults);
        await processExpirations(db, referenceDate, config, logResults);

        await db.collection('audit_logs').add({
            type: 'engine_daily_unified',
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            executor: req.query.trigger || 'auto',
            summary: `Motor unificado ejecutado. Acciones: ${logResults.details.length}`
        });

        return res.status(200).json({ ok: true, summary: logResults });
    } catch (error) {
        console.error("[Engine-Daily] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
