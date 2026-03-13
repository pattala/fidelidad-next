// /api/notifications.js
// Consolidated notifications API: Push, Email, and FCM Token Registration.
// Actions: 'send' (Push/Inbox, default), 'email', 'register-token'

import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { resolveTemplate, applyBlocksAndVars } from '../utils/templates.js';
import { buildHtmlLayout } from '../utils/emailLayout.js';

// ---------- Firebase Admin Init ----------
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

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// --- UTILS ---
function unique(arr = []) { return [...new Set((arr || []).filter(Boolean).map(s => String(s).trim()).filter(Boolean))]; }
function chunkArray(arr = [], size = 500) { const out = []; for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size)); return out; }
function isInvalidTokenError(code = "") { return code.includes("registration-token-not-registered") || code.includes("invalid-registration-token") || code.includes("messaging/registration-token-not-registered") || code.includes("messaging/invalid-registration-token") || code.includes("invalid-argument"); }
function asStringRecord(obj = {}) { const out = {}; for (const [k, v] of Object.entries(obj)) { if (v === undefined || v === null) continue; out[k] = String(v); } return out; }
function getAbsoluteUrl(url, baseUrl) { if (!url) return ""; if (url.startsWith("http")) return url; const base = (baseUrl || "").replace(/\/$/, ""); const path = url.startsWith("/") ? url : `/${url}`; return `${base}${path}`; }

// --- CORS ---
function applyCors(req, res) {
    const raw = (process.env.CORS_ALLOWED_ORIGINS || "").trim();
    const allowed = raw.split(",").map(s => s.trim()).filter(Boolean);
    const origin = req.headers.origin || "";
    if (allowed.includes(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

// --- SUB-HANDLER: REGISTER TOKEN ---
async function handleRegisterToken(req, res, db) {
    const { token, userId } = req.body;
    if (!token || !userId) return res.status(400).json({ ok: false, error: 'Falta token o userId' });
    try {
        const cleanToken = token.trim();
        const othersSnap = await db.collection("users").where("fcmTokens", "array-contains", cleanToken).get();
        const batch = db.batch();
        let cleanedCount = 0;
        othersSnap.forEach(doc => {
            if (doc.id !== userId) {
                const data = doc.data();
                const newTokens = (data.fcmTokens || []).filter(t => t !== cleanToken);
                const update = { fcmTokens: newTokens };
                if (data.fcmToken === cleanToken) update.fcmToken = null;
                batch.update(doc.ref, update);
                cleanedCount++;
            }
        });
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();
        if (userDoc.exists) {
            const currentTokens = userDoc.data().fcmTokens || [];
            if (!currentTokens.includes(cleanToken)) currentTokens.push(cleanToken);
            batch.update(userRef, { fcmTokens: currentTokens, fcmToken: cleanToken, lastFcmUpdate: admin.firestore.FieldValue.serverTimestamp() });
        } else {
            batch.set(userRef, { fcmTokens: [cleanToken], fcmToken: cleanToken, lastFcmUpdate: admin.firestore.FieldValue.serverTimestamp() }, { merge: true });
        }
        await batch.commit();
        // Audit registration
        try {
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'token_registration',
                status: 'success',
                summary: `Token FCM registrado para usuario: ${userId}`,
                details: { userId, token: token.substring(0, 10) + "..." },
                executor: 'client'
            });
        } catch (auditErr) { console.error("Error logging token registration:", auditErr); }
        return res.status(200).json({ ok: true, cleanedCount });
    } catch (e) {
        try {
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'token_registration',
                status: 'error',
                summary: `Falla registrando token para: ${userId}`,
                details: { userId, error: e.message },
                executor: 'client'
            });
        } catch (auditErr) {}
        return res.status(500).json({ ok: false, error: e.message }); 
    }
}

// --- SUB-HANDLER: SEND EMAIL ---
async function handleSendEmail(req, res, db) {
    try {
        const { to, templateId, templateData = {}, points, executor } = req.body;
        if (!to || !templateId) return res.status(400).json({ ok: false, error: 'Faltan parámetros: to y templateId.' });
        const configSnap = await db.collection('config').doc('general').get();
        const appConfig = configSnap.exists ? configSnap.data() : {};
        const siteName = appConfig.siteName || 'Club Fidelidad';
        let subject, html;
        if (templateId === 'manual_override') {
            subject = templateData.subject || 'Notificación';
            html = templateData.htmlContent || '<p>Sin contenido</p>';
            if (!html.toLowerCase().includes('<html')) html = buildHtmlLayout(html, appConfig);
        } else {
            const tpl = await resolveTemplate(db, templateId, 'email');
            const mergedData = { ...templateData, email: to, siteName };
            subject = applyBlocksAndVars(tpl.titulo || 'Notificación', mergedData);
            html = buildHtmlLayout(applyBlocksAndVars(tpl.cuerpo || '', mergedData), appConfig);
        }
        const sendInfo = await transporter.sendMail({ from: `"${siteName}" <${process.env.SMTP_USER}>`, to, subject, html });
        // Audit
        let userId = 'unknown', userName = 'Socio';
        const userQuery = await db.collection('users').where('email', '==', to).limit(1).get();
        if (!userQuery.empty) {
            const userSnap = userQuery.docs[0];
            userId = userSnap.id;
            userName = userSnap.data()?.name || userSnap.data()?.nombre || 'Socio';
        }
        await db.collection('audit_logs').add({ timestamp: admin.firestore.FieldValue.serverTimestamp(), type: 'email_notification', status: 'success', summary: `Email enviado a ${userName} (${to}): "${subject}"`, details: [{ userId, userName, to, subject, messageId: sendInfo.messageId }], executor: executor || 'system' });
        return res.status(200).json({ ok: true, messageId: sendInfo.messageId });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}

// --- SUB-HANDLER: SEND PUSH/INBOX ---
async function handleSendNotification(req, res, db) {
    const { title, body: msgBody, tokens: tokensIn = [], click_action = "/", icon, badge, extraData = {}, audience, clienteId, executor, points } = req.body;
    if (!title || !msgBody) return res.status(400).json({ ok: false, error: "Falta title/body." });
    try {
        const result = await sendNotificationInternal({ db, ...req.body });
        return res.status(200).json(result);
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}

// Re-using the robust logic from send-notification.js
export async function sendNotificationInternal({ db, title, body: msgBody, tokens: tokensIn = [], click_action = "/", icon, badge, extraData = {}, audience, clienteId, executor, points }) {
    let tokens = unique(tokensIn);
    if (!tokens.length && clienteId) {
        const snap = await db.collection("users").doc(String(clienteId)).get();
        if (snap.exists) tokens = unique(snap.data()?.fcmTokens || []);
    }
    const broadcast = (extraData?.broadcast === true || audience?.target === "all");
    const isInternal = extraData?.isInternal === true;
    const destinatarios = await resolveDestinatarios({ db, tokens, audience, clienteId, extraParams: { broadcast, isInternal } });
    let sendTokens = unique([...tokens, ...destinatarios.filter(d => d.token).map(d => d.token)]);
    const notifId = db.collection("_ids").doc().id;
    const data = asStringRecord({ id: notifId, title, body: msgBody, click_action, url: extraData?.url || click_action, icon: icon || process.env.PUSH_ICON_URL || "", badge: badge || process.env.PUSH_BADGE_URL || "", type: "simple", ...extraData });

    let successCount = 0, failureCount = 0;
    const invalidTokens = new Set(), perToken = [];

    if (sendTokens.length > 0 && !(extraData?.skipPush)) {
        const PWA_URL = process.env.PWA_URL || "";
        const iconUrl = getAbsoluteUrl(data.icon, PWA_URL);
        const message = { 
            notification: {
                title: data.title,
                body: data.body
            },
            data: { 
                ...data, 
                icon: iconUrl, 
                badge: iconUrl, 
                image: extraData?.image ? getAbsoluteUrl(extraData.image, PWA_URL) : "" 
            }, 
            android: { priority: "high" }, 
            webpush: { headers: { Urgent: "high" }, fcmOptions: { link: data.url || "/inbox" } } 
        };
        const batches = chunkArray(sendTokens, 500);
        for (const batchTokens of batches) {
            const resp = await admin.messaging().sendEachForMulticast({ ...message, tokens: batchTokens });
            successCount += resp.successCount; failureCount += resp.failureCount;
            resp.responses.forEach((r, idx) => {
                const t = batchTokens[idx];
                const code = r.error?.errorInfo?.code || r.error?.code || null;
                if (!r.success && code && isInvalidTokenError(code)) invalidTokens.add(t);
                perToken.push({ token: t, success: !!r.success, errorCode: code });
            });
        }
    }
    // Cleanup invalid tokens
    if (invalidTokens.size) {
        const toClean = Array.from(invalidTokens);
        const snap = await db.collection("users").where("fcmTokens", "array-contains-any", toClean.slice(0, 10)).get();
        for (const doc of snap.docs) {
            const d = doc.data();
            await doc.ref.update({ fcmTokens: (d.fcmTokens || []).filter(tk => !toClean.includes(tk)), fcmToken: toClean.includes(d.fcmToken) ? null : d.fcmToken });
        }
    }
    // Inbox
    if (!extraData?.skipInbox) {
        const byClient = new Map();
        destinatarios.forEach(d => { if (!byClient.has(d.id)) byClient.set(d.id, d.token || null); });
        for (const [cid, anyToken] of byClient.entries()) {
            await db.collection("users").doc(cid).collection("inbox").doc(notifId).set({ title: data.title, body: data.body, url: data.url, tag: data.tag || null, source: extraData?.source || "simple", campaignId: extraData?.campaignId || null, status: "sent", read: false, sentAt: admin.firestore.FieldValue.serverTimestamp(), date: admin.firestore.FieldValue.serverTimestamp(), expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 7776000000)) }, { merge: true });
        }
    }
    // Audit
    const uniqueIds = unique(destinatarios.map(d => d.id)).filter(id => id !== 'unknown');
    const userNamesMap = {};
    if (uniqueIds.length) {
        const namesSnap = await db.collection("users").where(admin.firestore.FieldPath.documentId(), "in", uniqueIds.slice(0, 10)).get();
        namesSnap.forEach(d => userNamesMap[d.id] = d.data().name || d.data().nombre || 'Socio');
    }
    const auditSummary = `Push: "${title}". Éxito: ${successCount}, Falla: ${failureCount}`;
    await db.collection('audit_logs').add({ timestamp: admin.firestore.FieldValue.serverTimestamp(), type: 'push_notification', status: failureCount === 0 ? 'success' : 'partial', summary: auditSummary, details: perToken.slice(0, 100), executor: executor || 'system' });

    return { ok: true, notifId, successCount, failureCount };
}

async function resolveDestinatarios({ db, tokens, audience, clienteId, extraParams }) {
    const out = [];
    if (extraParams.broadcast) {
        const snap = await db.collection("users").get();
        snap.forEach(d => { (d.data().fcmTokens || []).forEach(tk => out.push({ id: d.id, token: tk })); if (!(d.data().fcmTokens?.length)) out.push({ id: d.id, token: null }); });
    }
    if (audience?.docIds?.length) {
        const snap = await db.collection("users").where(admin.firestore.FieldPath.documentId(), "in", audience.docIds.slice(0, 10)).get();
        snap.forEach(d => { (d.data().fcmTokens || []).forEach(tk => out.push({ id: d.id, token: tk })); if (!(d.data().fcmTokens?.length)) out.push({ id: d.id, token: null }); });
    }
    if (clienteId) {
        const snap = await db.collection("users").doc(String(clienteId)).get();
        if (snap.exists) { (snap.data().fcmTokens || []).forEach(tk => out.push({ id: snap.id, token: tk })); if (!(snap.data().fcmTokens?.length)) out.push({ id: snap.id, token: null }); }
    }
    const seen = new Set();
    return out.filter(d => { const k = `${d.id}|${d.token}`; if (seen.has(k)) return false; seen.add(k); return true; });
}

export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method not allowed" });
    const action = req.query?.action || req.body?.action || 'send';
    const db = initFirebaseAdmin().firestore();

    // Auth Check
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    const receivedKey = req.headers["x-api-key"] || req.headers["X-API-Key"] || req.body?.apiKey;
    const authHeader = req.headers["authorization"];
    let authorized = (receivedKey && receivedKey === SECRET);
    if (!authorized && authHeader?.startsWith("Bearer ")) {
        const token = authHeader.split("Bearer ")[1];
        if (token === SECRET) authorized = true;
        else try { await admin.auth().verifyIdToken(token); authorized = true; } catch (e) { }
    }
    if (!authorized && action !== 'register-token') return res.status(401).json({ ok: false, error: "Unauthorized" });

    switch (action) {
        case 'register-token': return handleRegisterToken(req, res, db);
        case 'email': return handleSendEmail(req, res, db);
        case 'send': return handleSendNotification(req, res, db);
        default: return res.status(400).json({ ok: false, error: "Invalid action" });
    }
}
