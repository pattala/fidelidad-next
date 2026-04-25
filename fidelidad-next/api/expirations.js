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

// ---------- Handler Principal ----------
export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    try {
        const db = initFirebaseAdmin();
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        
        const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
        const triggerSource = req.body?.source || req.query?.source || 'Sistema (QStash)';

        // Usamos la utilidad centralizada para respetar el Simulador
        const referenceDate = await getEffectiveDate(db, simulatedDateStr);
        const referenceDateStr = referenceDate.toISOString().split('T')[0];
        const startOfToday = new Date(referenceDate);
        startOfToday.setHours(0, 0, 0, 0);

        const isSilent = req.query?.silent === 'true' || req.body?.silent === true;
        const logResults = { processed: 0, expired: 0, notified: 0, list: [], details: [], errors: [] };

        // Eliminada auditoría inicial para unificarla al final.

        // --- PASO A: RESTAR PUNTOS VENCIDOS ---
        // Buscamos usuarios que:
        // 1. Tengan una fecha de vencimiento menor o igual a hoy (Caché).
        // 2. O usuarios con puntos > 0 que NO tengan fecha de vencimiento seteada (para forzar revisión).
        const toExpireSnap = await db.collection('users')
            .where('points', '>', 0)
            .get();
        
        for (const userDoc of toExpireSnap.docs) {
            try {
                const userData = userDoc.data();
                const nextExp = userData.nextExpirationDate;

                // Si tiene fecha cacheada y es futura (según el simulador), saltamos para ahorrar lectura de subcoleccion.
                // PERO si no tiene fecha o es pasada/hoy, debemos entrar a revisar.
                if (nextExp && nextExp > referenceDateStr) {
                    continue; 
                }

                const userId = userDoc.id;
                const historyRef = userDoc.ref.collection('points_history');
                const expiredItemsSnap = await historyRef.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(startOfToday)).get();
                
                let totalToSubtract = 0;
                const batch = db.batch();
                const nowTimestamp = admin.firestore.Timestamp.fromDate(referenceDate);

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
                    
                    // 1. Registro en el historial del usuario
                    const historyDocRef = historyRef.doc();
                    batch.set(historyDocRef, { 
                        amount: -totalToSubtract, 
                        concept: 'Vencimiento de puntos acumulados (Auto)', 
                        date: nowTimestamp, 
                        type: 'debit', 
                        isExpirationAdjustment: true 
                    });

                    // 2. Registro en la colección GLOBAL para Métricas
                    const globalTxRef = db.collection('transactions').doc();
                    batch.set(globalTxRef, {
                        uid: userId,
                        clientName: userData.nombre || userData.name || 'Socio',
                        points: -totalToSubtract,
                        amount: 0,
                        type: 'debit',
                        reason: 'expiration',
                        concept: 'Vencimiento automático de puntos',
                        date: nowTimestamp,
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
        const isManual = triggerSource === 'dashboard' || triggerSource === 'extension';
        const inWindow = (hr >= startHr && hr < endHr) || isManual || !!simulatedDateStr;

        if (!isSilent && inWindow && config.messaging?.enableExpirationWarnings !== false) {
             const warningDays = config.warnings?.expirationDays || 7;
             const warningDate = new Date(referenceDate);
             warningDate.setDate(warningDate.getDate() + warningDays);
             const warningDateStr = warningDate.toISOString().split('T')[0];

             // Buscamos socios que tengan SU PRÓXIMO vencimiento en la ventana de aviso
             const proactiveSnap = await db.collection('users')
                .where('nextExpirationDate', '<=', warningDateStr)
                .where('nextExpirationDate', '>', referenceDateStr)
                .get();

             for (const userDoc of proactiveSnap.docs) {
                 try {
                     const userData = userDoc.data();
                     const historyRef = userDoc.ref.collection('points_history');
                     
                     // Escaneamos qué vence en esta ventana de 7 días
                     const impendingSnap = await historyRef
                        .where('type', '==', 'credit')
                        .where('expiresAt', '>', admin.firestore.Timestamp.fromDate(startOfToday))
                        .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(warningDate))
                        .get();

                     let breakdown = [];
                     let totalImpending = 0;

                     impendingSnap.docs.forEach(d => {
                         const dData = d.data();
                         if (dData.status === 'expired') return;
                         const rem = dData.remainingPoints !== undefined ? Number(dData.remainingPoints) : Number(dData.amount);
                         if (rem > 0) {
                             totalImpending += rem;
                             const dateObj = dData.expiresAt.toDate();
                             const dStr = `${dateObj.getDate()}/${dateObj.getMonth() + 1}`;
                             breakdown.push(`${rem} pts el ${dStr}`);
                         }
                     });

                     if (totalImpending > 0) {
                         const userName = (userData.nombre || userData.name || 'Socio').split(' ')[0];
                         const breakdownStr = breakdown.join(', ');
                         const title = "⚠️ Tus puntos están por vencer";
                         const msg = `¡Hola ${userName}! 📢 Tenés puntos próximos a vencer: ${breakdownStr}. Total a vencer: ${totalImpending} pts. ¡Aprovechalos pronto! 🎁`;

                         // Notificación Push
                         if (userData.fcmTokens?.length) {
                             await admin.messaging().sendEachForMulticast({
                                tokens: userData.fcmTokens,
                                notification: { title, body: msg },
                                data: { url: "/rewards" }
                             }).catch(() => {});
                         }
                         
                         // Email (si aplica)
                         // Inbox
                         await userDoc.ref.collection('inbox').add({
                             title,
                             body: msg,
                             date: admin.firestore.Timestamp.fromDate(referenceDate),
                             read: false,
                             type: 'system'
                         });

                         logResults.notified++;
                         logResults.list.push({
                             id: userDoc.id,
                             name: userData.nombre || userData.name || 'Socio',
                             phone: userData.phone || userData.telefono || '',
                             points: totalImpending,
                             nextExpirationDate: userData.nextExpirationDate || referenceDateStr,
                             breakdown: breakdown.map(b => ({ date: b.split(' pts el ')[1], rem: parseInt(b.split(' pts')[0]) }))
                         });
                         logResults.details.push({ userId: userDoc.id, userName, action: 'notified', info: msg });
                     }
                 } catch (err) {
                     console.error("Error notifying user:", userDoc.id, err);
                 }
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

        // --- PASO D: LOG DE AUDITORÍA UNIFICADO ---
        if (!isSilent) {
            const isManual = triggerSource === 'dashboard';
            const logType = isManual ? 'manual_expiration' : 'expiration_engine';
            
            const summaryText = logResults.processed > 0 || logResults.notified > 0
                ? `Revisión finalizada: ${logResults.processed} procesados, ${logResults.expired} puntos restados, ${logResults.notified} avisos enviados.`
                : `Revisión ejecutada: 0 registros para procesar en fecha ${referenceDateStr}.`;
                
            await db.collection('audit_logs').add({
                type: logType,
                status: logResults.errors.length > 0 ? 'partial' : 'success',
                summary: summaryText,
                executor: isManual ? 'Ejecución Manual (Admin)' : 'Ejecución Automática (Sistema)',
                timestamp: admin.firestore.Timestamp.fromDate(referenceDate),
                details: logResults.details.length > 0 ? logResults.details : [{
                    userId: 'system',
                    action: 'check_finished',
                    status: 'skipped',
                    info: 'Todo al día. No se requirieron acciones ni vencimientos en esta fecha.'
                }]
            });
        }

        return res.status(200).json({ ok: true, summary: logResults });

    } catch (error) {
        console.error("[Expirations] Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
