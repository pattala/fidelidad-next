
// /api/assign-points-external.js
// Asigna puntos desde fuentes externas (como la Extensión de Navegador).
// Este endpoint es una versión especializada de assign-points.js optimizada para integraciones.

import admin from "firebase-admin";

function initFirebaseAdmin() {
    if (admin.apps.length) return;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");
    let sa;
    try { sa = JSON.parse(raw); }
    catch { throw new Error("Invalid GOOGLE_CREDENTIALS_JSON"); }
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: sa.project_id,
            clientEmail: sa.client_email,
            privateKey: sa.private_key?.replace(/\\n/g, "\n"),
        })
    });
}

function getDb() {
    initFirebaseAdmin();
    return admin.firestore();
}

function setCors(res, origin) {
    // Permitimos cualquier origen para la extensión, o configuramos específico si es necesario
    res.setHeader("Access-Control-Allow-Origin", origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
    res.setHeader("Access-Control-Max-Age", "86400");
}

export default async function handler(req, res) {
    setCors(res, req.headers.origin);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    try {
        const db = getDb();

        // 0. Verificar si la integración está habilitada en la configuración
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : {};
        if (config.enableExternalIntegration === false) {
            return res.status(403).json({ ok: false, error: "External integration is disabled in settings" });
        }

        const { uid, amount, concept, metadata = {} } = req.body || {};

        // 1. Seguridad: x-api-key requerida (la misma que usa el Admin Panel)
        const apiKey = req.headers["x-api-key"];
        if (!apiKey || !process.env.API_SECRET_KEY || apiKey !== process.env.API_SECRET_KEY) {
            return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        if (!uid || !amount) {
            return res.status(400).json({ ok: false, error: "Missing required fields: uid, amount" });
        }

        const points = Math.floor(Number(amount));
        if (isNaN(points) || points <= 0) {
            return res.status(400).json({ ok: false, error: "Invalid amount" });
        }

        // 2. Transacción de Asignación de Puntos
        const clientRef = db.collection("users").doc(uid);
        let updatedData = { ok: false };

        await db.runTransaction(async (tx) => {
            const docSnapshot = await tx.get(clientRef);
            if (!docSnapshot.exists) throw new Error("Client not found");
            const data = docSnapshot.data();

            const currentPoints = Number(data.points || data.puntos || 0);
            const newPoints = currentPoints + points;

            tx.update(clientRef, {
                points: newPoints,
                puntos: newPoints,
                lastActivity: admin.firestore.FieldValue.serverTimestamp(),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            });

            // Log de Historial
            const histRef = clientRef.collection('points_history').doc();
            const expirationDate = new Date();
            expirationDate.setDate(expirationDate.getDate() + 365); // 1 año de vigencia por defecto

            tx.set(histRef, {
                amount: points,
                type: 'credit',
                reason: 'external_integration',
                concept: concept || 'Puntos asignados externamente',
                metadata: {
                    source: 'browser_extension',
                    ...metadata
                },
                date: admin.firestore.FieldValue.serverTimestamp(),
                expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                remainingPoints: points,
                balanceAfter: newPoints
            });

            updatedData = { ok: true, pointsAdded: points, newBalance: newPoints, clientName: data.name || data.nombre || 'Cliente' };
        });

        // 3. Notificación Automática (Opcional pero recomendado)
        // Intentamos enviar una notificación push si el cliente tiene tokens
        try {
            const clientDoc = await clientRef.get();
            const clientData = clientDoc.data();
            const tokens = clientData.fcmTokens || [];

            if (tokens.length > 0) {
                // Notificación simple de "Puntos Sumados"
                const notificationTitle = "¡Sumaste Puntos! 💰";
                const notificationBody = `Has sumado ${points} puntos. Tu nuevo saldo es de ${updatedData.newBalance} pts.`;

                // Usamos el endpoint interno o llamamos directamente a FCM aquí
                // Para mantenerlo simple en este archivo, solo creamos el doc en inbox
                const inboxRef = clientRef.collection('inbox').doc();
                await inboxRef.set({
                    title: notificationTitle,
                    body: notificationBody,
                    type: 'points_earned',
                    points: points,
                    newBalance: updatedData.newBalance,
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    isRead: false,
                    date: admin.firestore.FieldValue.serverTimestamp()
                });
            }
        } catch (notifErr) {
            console.error("Non-critical error sending notification:", notifErr);
        }

        // 4. Preparar respuesta para WhatsApp (URL base)
        const phone = (await clientRef.get()).data().phone || (await clientRef.get()).data().telefono;
        let whatsappLink = null;
        if (phone) {
            const cleanPhone = String(phone).replace(/\D/g, '');
            const msg = `¡Hola! 👋 Sumaste ${points} puntos en tu última compra. ¡Gracias por elegirnos! 🎁`;
            whatsappLink = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg)}`;
        }

        return res.status(200).json({
            ...updatedData,
            whatsappLink
        });

    } catch (error) {
        console.error("assign-points-external error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
