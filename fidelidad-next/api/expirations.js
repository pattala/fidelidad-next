import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { updateNextExpirationDate } from "../utils/_expiration-utils.js";
import { buildHtmlLayout } from "../utils/emailLayout.js";

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

// ---------- Handler Principal ----------
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = initFirebaseAdmin();
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        
        // --- RELOJ ARGENTINA (FIJO) ---
        // Forzamos que el sistema siempre piense en hora de Buenos Aires
        const todayRaw = new Date();
        const argentinaDate = new Date(todayRaw.toLocaleString("en-US", { timeZone: "America/Argentina/Buenos_Aires" }));
        
        const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
        let referenceDate = argentinaDate;
        if (simulatedDateStr) {
            const [y, m, d] = simulatedDateStr.split(/[-/]/);
            referenceDate = new Date(`${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}T12:00:00`);
        }

        const referenceDateStr = referenceDate.toISOString().split('T')[0];
        const startOfToday = new Date(referenceDate);
        startOfToday.setHours(0, 0, 0, 0);

        const isSilent = req.query?.silent === 'true' || req.body?.silent === true;
        const logResults = { processed: 0, expired: 0, notified: 0, details: [], errors: [] };

        // --- PASO A: RESTAR PUNTOS VENCIDOS ---
        const toExpireSnap = await db.collection('users').where('nextExpirationDate', '<=', referenceDateStr).get();
        
        for (const userDoc of toExpireSnap.docs) {
            try {
                const userId = userDoc.id;
                const historyRef = userDoc.ref.collection('points_history');
                const expiredItemsSnap = await historyRef.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).get();
                
                let totalToSubtract = 0;
                const batch = db.batch();
                const nowTimestamp = admin.firestore.FieldValue.serverTimestamp();

                expiredItemsSnap.docs.forEach(d => {
                    const data = d.data();
                    if (data.status === 'expired') return;
                    const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
                    if (data.type === 'credit' && rem > 0) {
                        totalToSubtract += rem;
                        batch.update(d.ref, { status: 'expired', remainingPoints: 0, expiredAmount: rem, processedAt: nowTimestamp });
                    }
                });

                if (totalToSubtract > 0) {
                    logResults.expired += totalToSubtract;
                    batch.set(historyRef.doc(), { 
                        amount: -totalToSubtract, 
                        concept: 'Vencimiento de puntos acumulados (Auto)', 
                        date: nowTimestamp, 
                        type: 'debit', 
                        isExpirationAdjustment: true 
                    });
                    batch.update(userDoc.ref, { points: admin.firestore.FieldValue.increment(-totalToSubtract) });
                    await batch.commit();
                }
                
                await updateNextExpirationDate(db, userId, referenceDate);
                logResults.processed++;
            } catch (e) {
                logResults.errors.push({ id: userDoc.id, error: e.message });
            }
        }

        // --- PASO B: ENVIAR AVISOS (SI ESTÁ EN HORARIO) ---
        const hr = referenceDate.getHours();
        const startHr = config.messaging?.startHour || 10;
        const endHr = config.messaging?.endHour || 20;
        const inWindow = hr >= startHr && hr < endHr;

        if (!isSilent && inWindow && config.messaging?.enableExpirationWarnings !== false) {
             // Lógica de avisos 7 días antes...
             const warningDays = config.warnings?.expirationDays || 7;
             const warningDate = new Date(referenceDate);
             warningDate.setDate(warningDate.getDate() + warningDays);
             const warningDateStr = warningDate.toISOString().split('T')[0];

             const proactiveSnap = await db.collection('users')
                .where('nextExpirationDate', '==', warningDateStr)
                .get();

             for (const userDoc of proactiveSnap.docs) {
                 const userData = userDoc.data();
                 const userName = (userData.nombre || userData.name || 'Socio').split(' ')[0];
                 const msg = (config.messaging?.templates?.expiration || "Hola {nombre}, tus puntos vencen el {fecha}!")
                    .replace(/{nombre}/g, userName)
                    .replace(/{puntos}/g, (userData.points || 0).toString())
                    .replace(/{fecha}/g, warningDateStr);
                 
                 // Enviar Push/WhatsApp...
                 if (userData.fcmTokens?.length) {
                     await admin.messaging().sendEachForMulticast({
                        tokens: userData.fcmTokens,
                        data: { title: "⚠️ Vencimiento de puntos", body: msg, url: "/rewards" }
                     }).catch(() => {});
                 }
                 logResults.notified++;
             }
        }

        // --- PASO C: AUTO-PURGA DE AUDITORÍA (Logs de más de 7 días) ---
        const purgeDate = new Date(referenceDate);
        purgeDate.setDate(purgeDate.getDate() - 7);
        const oldLogsSnap = await db.collection('audit_logs')
            .where('timestamp', '<', admin.firestore.Timestamp.fromDate(purgeDate))
            .limit(100)
            .get();
        
        if (!oldLogsSnap.empty) {
            const purgeBatch = db.batch();
            oldLogsSnap.docs.forEach(d => purgeBatch.delete(d.ref));
            await purgeBatch.commit();
        }

        return res.status(200).json({ ok: true, summary: logResults });

    } catch (error) {
        console.error("[Expirations] Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
