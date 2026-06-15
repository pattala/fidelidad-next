
// api/redeem-prize.js
// Procesa el canje de un premio de forma segura y centralizada.

import admin from "firebase-admin";
import { sendNotificationInternal } from "./notifications.js";
import { updateNextExpirationDate } from "../utils/_expiration-utils.js";
import { getEffectiveDate } from "../utils/timeUtils.js";

// ---------- Firebase Admin ----------
function initFirebaseAdmin() {
    if (admin.apps.length) return;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");
    let sa;
    try { sa = JSON.parse(raw); }
    catch { throw new Error("Invalid GOOGLE_CREDENTIALS_JSON"); }
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

function getDb() {
    initFirebaseAdmin();
    return admin.firestore();
}

function getAuth() {
    initFirebaseAdmin();
    return admin.auth();
}

// ---------- Handler ----------
export default async function handler(req, res) {
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    try {
        const db = getDb();
        const { uid, prizeId, simulatedDate, purchaseAmount } = req.body || {};

        // 1. Autenticación (Dual Mode)
        let isAdmin = false;
        let requestUid = null;

        const apiKey = req.headers["x-api-key"];
        const authHeader = req.headers["authorization"];

        if (apiKey && process.env.API_SECRET_KEY && apiKey === process.env.API_SECRET_KEY) {
            isAdmin = true;
        } else if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.split("Bearer ")[1];
            try {
                const decoded = await getAuth().verifyIdToken(token);
                requestUid = decoded.uid;
            } catch (e) {
                return res.status(401).json({ ok: false, error: "Invalid Token" });
            }
        } else {
            return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        const targetUid = isAdmin ? uid : requestUid;
        if (!targetUid || !prizeId) return res.status(400).json({ ok: false, error: "Missing UID or prizeId" });

        // 2. Fetch Data
        const [clientSnap, prizeSnap, configSnap] = await Promise.all([
            db.collection("users").doc(targetUid).get(),
            db.collection("prizes").doc(prizeId).get(),
            db.collection("config").doc("general").get()
        ]);

        if (!clientSnap.exists) return res.status(404).json({ ok: false, error: "Client not found" });
        if (!prizeSnap.exists) return res.status(404).json({ ok: false, error: "Prize not found" });

        const clientData = clientSnap.data();
        const prizeData = prizeSnap.data();
        const config = configSnap.exists ? configSnap.data() : {};

        const pointsNeeded = Number(prizeData.pointsRequired) || 0;
        const currentPoints = Number((clientData.points !== undefined) ? clientData.points : (clientData.puntos ?? 0));

        // 2.5 Validación de Ventana Horaria Operativa
        const nowTime = new Date();
        const ch = nowTime.getHours();
        const startH = Number(config.messaging?.engineAllowedStartHour ?? 6);
        const endH = Number(config.messaging?.engineAllowedEndHour ?? 6);
        let isInsideWindow = true;
        if (startH !== endH) {
            if (startH < endH) {
                isInsideWindow = (ch >= startH && ch < endH);
            } else {
                isInsideWindow = (ch >= startH || ch < endH);
            }
        }

        if (!isInsideWindow) {
            return res.status(400).json({ ok: false, error: "El sistema está fuera del horario operativo. No se pueden realizar canjes en este momento." });
        }

        if (currentPoints < pointsNeeded) return res.status(400).json({ ok: false, error: "Insufficient points" });
        if ((Number(prizeData.stock) || 0) <= 0) return res.status(400).json({ ok: false, error: "No stock available" });

        // --- RELOJ SIMULADO ---
        const now = await getEffectiveDate(db, simulatedDate);

        // Expiration check
        if (prizeData.expirationDate) {
            const expDate = new Date(prizeData.expirationDate);
            // Adjust expDate to end of day to be generous
            expDate.setHours(23, 59, 59, 999);
            if (now > expDate) {
                return res.status(400).json({ ok: false, error: "Prize has expired" });
            }
        }

        // Test Mode Restriction
        if (prizeData.isInternal && !clientData.isTestUser) {
            return res.status(403).json({ ok: false, error: "Internal prize restricted to test users" });
        }

        // 3. FIFO Logic & Transaction
        let result = { ok: false, auditDetails: [] };

        console.time("redemption-transaction");
        await db.runTransaction(async (tx) => {
            // Re-fetch in transaction
            const cSnap = await tx.get(clientSnap.ref);
            const pSnap = await tx.get(prizeSnap.ref);
            const cData = cSnap.data();
            const pData = pSnap.data();

            if (Number((cData.points !== undefined) ? cData.points : (cData.puntos ?? 0)) < pointsNeeded) throw new Error("Insufficient points");
            if ((Number(pData.stock) || 0) <= 0) throw new Error("No stock available");

            let pointsToDeduct = pointsNeeded;
            const batchesUsed = [];

            // Fetch credits for FIFO
            const creditsSnap = await tx.get(
                db.collection("users").doc(targetUid).collection("points_history")
                    .where("type", "==", "credit")
                    .where("expiresAt", ">", admin.firestore.Timestamp.fromDate(now))
                    .orderBy("expiresAt", "asc")
            );

            for (const docSnap of creditsSnap.docs) {
                if (pointsToDeduct <= 0) break;
                const data = docSnap.data();
                const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;

                if (currentRemaining <= 0) continue;

                let deduction = 0;
                if (currentRemaining >= pointsToDeduct) {
                    deduction = pointsToDeduct;
                    pointsToDeduct = 0;
                } else {
                    deduction = currentRemaining;
                    pointsToDeduct -= deduction;
                }

                const remainingAfter = currentRemaining - deduction;
                tx.update(docSnap.ref, {
                    remainingPoints: remainingAfter,
                    lastUsageDate: admin.firestore.FieldValue.serverTimestamp()
                });

                const d = data.date?.toDate();
                const dateStr = d ? `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1).toString().padStart(2, '0')}` : "??";
                batchesUsed.push(`${deduction} pts del ${dateStr}${remainingAfter > 0 ? ` (Quedan: ${remainingAfter})` : ''}`);
            }

            const historyDescription = batchesUsed.length > 0 ? `(Tomados: ${batchesUsed.join(', ')})` : '';
            // --- NOTIFICACIONES ---
            const messagingCfg = config.messaging || {};
            const event = 'redemption';
            const templates = messagingCfg.templates || {};
            // Default to ALL channels if config is missing
            const eventConfig = messagingCfg.eventConfigs?.[event] || { channels: ['whatsapp', 'push', 'email', 'inbox'] };
            const channels = eventConfig.channels || ['whatsapp', 'push', 'email', 'inbox'];

            // Default enabled unless explicitly set to false
            const whatsappEnabled = messagingCfg.whatsappEnabled !== false;

            const firstName = (cData.name || cData.nombre || '').split(' ')[0];
            const shortCode = prizeId.substring(0, 4).toUpperCase();
            const currentPts = Number((cData.points !== undefined) ? cData.points : (cData.puntos ?? 0));
            const newTotalPoints = currentPts - pointsNeeded;

            // Update User
            tx.update(cSnap.ref, {
                points: newTotalPoints,
                puntos: newTotalPoints,
                historialCanjes: admin.firestore.FieldValue.arrayUnion({
                    fechaCanje: admin.firestore.Timestamp.fromDate(now),
                    nombrePremio: pData.name,
                    puntosCoste: pointsNeeded,
                    prizeId: prizeId,
                    redemptionCode: shortCode
                }),
                historialPuntos: [...(cData.historialPuntos || []), {
                    fechaObtencion: admin.firestore.Timestamp.fromDate(now),
                    puntosObtenidos: -pointsNeeded,
                    puntosDisponibles: 0,
                    diasCaducidad: 0,
                    origen: `Canje: ${pData.name} (${shortCode})`,
                    estado: 'Canjeado'
                }].slice(-100),
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                lastPurchaseDate: admin.firestore.Timestamp.fromDate(now)
            });

            // AUDITORIA: Agregar detalle del canje
            result.auditDetails.push({
                userId: targetUid,
                userName: cData.name || cData.nombre || 'Socio',
                dni: cData.dni || '',
                socioNumber: cData.socioNumber || cData.numeroSocio || cData.socio_number || '',
                prizeId: prizeId,
                prizeName: pData.name,
                pointsRedeemed: pointsNeeded,
                action: 'prize_redeemed',
                status: 'success',
                info: `Canjeó ${pData.name} por ${pointsNeeded} pts`,
                timestamp: now.toISOString()
            });

            // Update Prize Stock
            tx.update(pSnap.ref, {
                stock: admin.firestore.FieldValue.increment(-1)
            });

            // Log History (Debit)
            const debitRef = db.collection("users").doc(targetUid).collection("points_history").doc();
            tx.set(debitRef, {
                amount: -pointsNeeded,
                concept: `Canje: ${pData.name}`,
                redemptionCode: shortCode,
                details: historyDescription,
                date: admin.firestore.Timestamp.fromDate(now),
                type: 'debit',
                prizeId: prizeId,
                redeemedValue: pData.cashValue || 0,
                purchaseAmount: purchaseAmount ? Number(purchaseAmount) : 0,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Global Transaction
            const globalTransRef = db.collection('transactions').doc();
            tx.set(globalTransRef, {
                uid: targetUid,
                clientName: cData.name || cData.nombre || 'Sin nombre',
                socioNumber: cData.socioNumber || cData.numeroSocio || 'N/A',
                points: -pointsNeeded,
                amount: purchaseAmount ? Number(purchaseAmount) : 0,
                redeemedValue: pData.cashValue || 0,
                type: 'debit',
                reason: 'redemption',
                redemptionCode: shortCode,
                concept: `Canje: ${pData.name} (${shortCode})`,
                prizeId: prizeId,
                date: admin.firestore.Timestamp.fromDate(now),
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            let unifiedMsg = templates[event] || "¡Canje exitoso! Canjeaste {premio}. Código: {codigo}";

            unifiedMsg = unifiedMsg.replace(/{nombre}/g, firstName)
                .replace(/{nombre_completo}/g, cData.name || cData.nombre || '')
                .replace(/{premio}/g, pData.name)
                .replace(/{codigo}/g, shortCode)
                .replace(/{siteName}/g, config.siteName || 'Club Fidelidad');

            // Inbox Notification (MANUAL)
            const inboxRef = db.collection("users").doc(targetUid).collection("inbox").doc();
            tx.set(inboxRef, {
                title: '¡Canje Exitoso! 🎁',
                body: unifiedMsg,
                url: '/',
                type: 'redemption',
                redemptionCode: shortCode,
                date: admin.firestore.FieldValue.serverTimestamp(),
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            result = { ok: true, pointsRedeemed: pointsNeeded, newBalance: newTotalPoints, unifiedMsg, redemptionCode: shortCode, auditDetails: result.auditDetails || [] };

            // --- WHATSAPP LINK GENERATION (MANUAL TRIGGER) ---
            const isWhatsAppConfigured = whatsappEnabled && channels.includes('whatsapp');
            if (isWhatsAppConfigured) {
                // Robust phone check: phone (Auth) or telefono (Firestore)
                const cleanPhone = (cData.phone || cData.telefono || '').replace(/\D/g, '');
                if (cleanPhone.length >= 8) {
                    const encodedMsg = encodeURIComponent(unifiedMsg);
                    result.whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

                    // Log WhatsApp Audit - ACUMULAR
                    result.auditDetails.push({
                        userId: targetUid,
                        userName: cData.name || cData.nombre || 'Socio',
                        dni: cData.dni || '',
                        socioNumber: cData.socioNumber || cData.numeroSocio || cData.socio_number || '',
                        prizeId: prizeId,
                        prizeName: pData.name,
                        pointsRedeemed: pointsNeeded,
                        action: 'whatsapp_link_generated',
                        status: 'link_ready'
                    });
                }
            } else {
                // Log Skip: WhatsApp Disabled - ACUMULAR
                result.auditDetails.push({
                    userId: targetUid,
                    userName: cData.name || cData.nombre || 'Socio',
                    dni: cData.dni || '',
                    socioNumber: cData.socioNumber || cData.numeroSocio || cData.socio_number || '',
                    action: 'whatsapp_skipped',
                    status: 'skipped',
                    reason: 'config_disabled'
                });
            }
        });
        console.timeEnd("redemption-transaction");

        // 3.5 Actualizar Cache de Vencimientos (Porque gastó puntos, quizás gastó los que vencían pronto)
        if (result.ok) {
            updateNextExpirationDate(db, targetUid).catch(e => console.error("Error updating expiration cache (redemption):", e));
        }

        // 4. Trigger Automatic Channels (Push & Email)
        if (result.ok) {
            console.time("redemption-notifications");
            try {
                const messagingCfg = config.messaging || {};
                const eventConfig = messagingCfg.eventConfigs?.['redemption'] || { channels: ['whatsapp', 'push', 'email', 'inbox'] };
                const channels = eventConfig.channels || ['whatsapp', 'push', 'email', 'inbox'];

                const isPushConfigured = (messagingCfg.pushEnabled !== false) && channels.includes('push');
                const isEmailConfigured = (messagingCfg.emailEnabled !== false) && channels.includes('email');

                // Executor for Audit Logs
                const executorRole = req.headers["x-executor-role"] || 'admin';
                let executor = 'admin';
                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const token = authHeader.split("Bearer ")[1];
                    try {
                        const decoded = await getAuth().verifyIdToken(token);
                        executor = decoded.email || decoded.uid || 'admin';
                    } catch (e) {
                        console.error("Executor extraction error (redemption):", e.message);
                    }
                }

                // Prioritize CURRENT HOST to bypass Vercel Deployment Protection
                const currentHost = req.headers.host;
                const proto = req.headers['x-forwarded-proto'] || 'https';
                const baseUrl = currentHost ? `${proto}://${currentHost}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

                const SECRET = (process.env.API_SECRET_KEY || process.env.MI_API_SECRET || process.env.VITE_API_KEY || "").trim();
                const internalAuth = {
                    'x-api-key': SECRET,
                    'x-api-secret': SECRET
                };
                const notifications = [];

                if (isPushConfigured) {
                    // Optimization: Call internal function directly to avoid HTTP latency
                    console.log("PERF: Invoking sendNotificationInternal directly");
                    notifications.push(
                        sendNotificationInternal({
                            db,
                            clienteId: targetUid,
                            title: '¡Canje Exitoso! 🎁',
                            body: result.unifiedMsg,
                            // Use clientData.fcmTokens as we are outside transaction but data should match
                            tokens: clientData?.fcmTokens || [],
                            icon: config.logoUrl || '/logo.png',
                            points: -pointsNeeded,
                            executor,
                            extraData: { skipInbox: true, source: 'redemption' }
                        }).then(() => {
                            result.auditDetails.push({ userId: targetUid, userName: clientData.name, action: 'push_sent', status: 'success' });
                        }).catch(err => {
                            console.error("Push redemption error:", err);
                            result.auditDetails.push({ userId: targetUid, userName: clientData.name, action: 'push_error', status: 'failed', info: err.message });
                        })
                    );
                } else {
                    // Log Push Skip - ACUMULAR
                    result.auditDetails.push({
                        userId: targetUid,
                        userName: clientData.name || 'Socio',
                        dni: clientData.dni || '',
                        socioNumber: clientData.socioNumber || '',
                        action: 'push_skipped',
                        status: 'skipped',
                        info: 'Configuración desactivada'
                    });
                }

                if (isEmailConfigured && (clientData.email || clientData.correo)) {
                    notifications.push(
                        fetch(`${baseUrl}/api/notifications?action=email`, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            body: JSON.stringify({
                                to: clientData.email || clientData.correo,
                                points: -pointsNeeded, executor,
                                templateId: 'manual_override',
                                templateData: {
                                    subject: '¡Canje Exitoso! 🎁',
                                    htmlContent: result.unifiedMsg
                                }
                            })
                        }).then(() => {
                            result.auditDetails.push({
                                userId: targetUid,
                                userName: clientData.name,
                                action: 'email_sent',
                                status: 'success',
                                info: `Enviado a: ${clientData.email || clientData.correo}`
                            });
                        }).catch(err => {
                            console.error("Email error redemption:", err);
                            result.auditDetails.push({
                                userId: targetUid,
                                userName: clientData.name,
                                action: 'email_error',
                                status: 'failed',
                                info: `${clientData.email || clientData.correo} - ${err.message}`
                            });
                        })
                    );
                } else if (clientData.email || clientData.correo) {
                    // Log Email Skip - ACUMULAR
                    result.auditDetails.push({
                        userId: targetUid,
                        userName: clientData.name || 'Socio',
                        dni: clientData.dni || '',
                        socioNumber: clientData.socioNumber || '',
                        action: 'email_skipped',
                        status: 'skipped',
                        info: 'Configuración desactivada'
                    });
                }

                if (notifications.length > 0) await Promise.all(notifications);

                // --- FINAL AUDIT LOG (UNIFIED) ---
                if (result.auditDetails && result.auditDetails.length > 0) {
                    try {
                        await db.collection('audit_logs').add({
                            timestamp: admin.firestore.FieldValue.serverTimestamp(),
                            type: 'prize_redemption',
                            status: 'success',
                            summary: `Canje de premio: ${clientData.name || clientData.nombre || 'Socio'} (Socio #${clientData.socioNumber || clientData.numeroSocio || 'N/A'}, DNI ${clientData.dni || 'N/A'}) - Premio: ${prizeData.name}`,
                            details: result.auditDetails,
                            executor,
                            role: executorRole || 'admin'
                        });

                        // --- SINCRO AUTO: Si se generó el WhatsApp, marcar como 'sent' en el log diario ---
                        if (result.whatsappLink) {
                            const todayStr = now.toISOString().split('T')[0];
                            const todaySyncRef = db.collection('audit_logs').doc(`daily_alerts_${todayStr}`);
                            const alertId = `redemption-${clientData.socioNumber || clientData.numeroSocio || clientData.phone || targetUid}-${result.redemptionCode || 'N/A'}`;
                            
                            await db.runTransaction(async (t) => {
                                const syncDoc = await t.get(todaySyncRef);
                                let actions = {};
                                if (syncDoc.exists) actions = syncDoc.data().actions || {};
                                actions[alertId] = 'sent';
                                t.set(todaySyncRef, { actions, lastUpdate: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
                            });
                        }
                    } catch (auditErr) {
                        console.error("Final audit log error (redemption):", auditErr);
                    }
                }
            } catch (err) {
                console.error("Error triggering redemption notifications:", err);
            }
            console.log("PERF: Finished redemption-notifications");
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error("redeem-prize error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
