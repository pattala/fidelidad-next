
// api/redeem-prize.js
// Procesa el canje de un premio de forma segura y centralizada.

import admin from "firebase-admin";

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
        const { uid, prizeId } = req.body || {};

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
        const currentPoints = Number(clientData.points || clientData.puntos || 0);

        if (currentPoints < pointsNeeded) return res.status(400).json({ ok: false, error: "Insufficient points" });
        if ((Number(prizeData.stock) || 0) <= 0) return res.status(400).json({ ok: false, error: "No stock available" });

        // 3. FIFO Logic & Transaction
        let result = { ok: false };
        const now = new Date();

        await db.runTransaction(async (tx) => {
            // Re-fetch in transaction
            const cSnap = await tx.get(clientSnap.ref);
            const pSnap = await tx.get(prizeSnap.ref);
            const cData = cSnap.data();
            const pData = pSnap.data();

            if (Number(cData.points || cData.puntos || 0) < pointsNeeded) throw new Error("Insufficient points");
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
            const eventConfig = messagingCfg.eventConfigs?.[event];
            const channels = eventConfig?.channels || [];

            const firstName = (cData.name || cData.nombre || '').split(' ')[0];
            const shortCode = prizeId.substring(0, 4).toUpperCase();

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
                historialPuntos: admin.firestore.FieldValue.arrayUnion({
                    fechaObtencion: admin.firestore.Timestamp.fromDate(now),
                    puntosObtenidos: -pointsNeeded,
                    puntosDisponibles: 0,
                    diasCaducidad: 0,
                    origen: `Canje: ${pData.name} (${shortCode})`,
                    estado: 'Canjeado'
                }),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
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
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Global Transaction
            const globalTransRef = db.collection('transactions').doc();
            tx.set(globalTransRef, {
                uid: targetUid,
                clientName: cData.name || cData.nombre || 'Sin nombre',
                socioNumber: cData.socioNumber || cData.numeroSocio || 'N/A',
                points: -pointsNeeded,
                amount: 0,
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
                type: 'redemption',
                redemptionCode: shortCode,
                date: admin.firestore.FieldValue.serverTimestamp(),
                sentAt: admin.firestore.FieldValue.serverTimestamp(),
                read: false
            });

            result = { ok: true, pointsRedeemed: pointsNeeded, newBalance: newTotalPoints, unifiedMsg };

            // --- WHATSAPP LINK GENERATION (MANUAL TRIGGER) ---
            const isWhatsAppConfigured = messagingCfg.whatsappEnabled && channels.includes('whatsapp');
            if (isWhatsAppConfigured) {
                const cleanPhone = (cData.phone || '').replace(/\D/g, '');
                if (cleanPhone.length >= 8) {
                    const encodedMsg = encodeURIComponent(unifiedMsg);
                    result.whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodedMsg}`;

                    // Log WhatsApp Audit
                    const auditRef = db.collection('audit_logs').doc();
                    tx.set(auditRef, {
                        type: 'whatsapp_manual',
                        status: 'link_ready',
                        summary: `Link de WhatsApp preparado para ${cData.name || 'Socio'} (${pData.name} - ${shortCode})`,
                        details: [{
                            userId: targetUid,
                            userName: cData.name || 'Socio',
                            action: 'whatsapp_link_generated',
                            status: 'link_ready',
                            timestamp: new Date().toISOString()
                        }],
                        executor: 'system',
                        timestamp: admin.firestore.FieldValue.serverTimestamp()
                    });
                }
            } else {
                // Log Skip: WhatsApp Disabled
                const auditRef = db.collection('audit_logs').doc();
                tx.set(auditRef, {
                    type: 'whatsapp_manual',
                    status: 'skipped',
                    summary: `WhatsApp OMITIDO para ${cData.name || 'Socio'} (${shortCode}): Canal desactivado`,
                    executor: 'system',
                    timestamp: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        });

        // 4. Trigger Automatic Channels (Push & Email)
        if (result.ok) {
            try {
                const messagingCfg = config.messaging || {};
                const eventConfig = messagingCfg.eventConfigs?.['redemption'];
                const channels = eventConfig?.channels || [];

                const isPushConfigured = messagingCfg.pushEnabled && channels.includes('push');
                const isEmailConfigured = messagingCfg.emailEnabled && channels.includes('email');

                // Executor for Audit Logs
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
                const baseUrl = currentHost ? `https://${currentHost}` : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

                const SECRET = (process.env.API_SECRET_KEY || process.env.MI_API_SECRET || process.env.VITE_API_KEY || "").trim();
                const internalAuth = {
                    'x-api-key': SECRET,
                    'x-api-secret': SECRET
                };
                const notifications = [];

                if (isPushConfigured) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-notification`, {
                            headers: { 'Content-Type': 'application/json', ...internalAuth },
                            method: 'POST',
                            body: JSON.stringify({
                                clienteId: targetUid,
                                title: '¡Canje Exitoso! 🎁',
                                body: result.unifiedMsg,
                                icon: config.logoUrl || '/logo.png',
                                points: -pointsNeeded, executor,
                                extraData: { skipInbox: true, source: 'redemption' }
                            })
                        }).catch(err => console.error("Push redemption error:", err))
                    );
                } else {
                    // Log Push Skip
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'push_notification',
                        status: 'skipped',
                        summary: `Push OMITIDO para ${clientData.name || 'Socio'}: Canal desactivado`,
                        executor
                    }).catch(e => { });
                }

                if (isEmailConfigured && (clientData.email || clientData.correo)) {
                    notifications.push(
                        fetch(`${baseUrl}/api/send-email`, {
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
                        }).catch(err => console.error("Email redemption error:", err))
                    );
                } else if (clientData.email || clientData.correo) {
                    // Log Email Skip
                    await db.collection('audit_logs').add({
                        timestamp: admin.firestore.FieldValue.serverTimestamp(),
                        type: 'email_notification',
                        status: 'skipped',
                        summary: `Email OMITIDO para ${clientData.name || 'Socio'}: Canal desactivado`,
                        executor
                    }).catch(e => { });
                }

                if (notifications.length > 0) await Promise.allSettled(notifications);
            } catch (err) {
                console.error("Error triggering redemption notifications:", err);
            }
        }

        return res.status(200).json(result);

    } catch (error) {
        console.error("redeem-prize error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
