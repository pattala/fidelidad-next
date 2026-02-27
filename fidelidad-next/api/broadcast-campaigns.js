
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import nodemailer from 'nodemailer';

// --- INITIALIZE FIREBASE ---
if (!getApps().length) {
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
    const creds = credsRaw ? JSON.parse(credsRaw) : null;
    initializeApp(creds ? { credential: cert(creds) } : {});
}
const db = getFirestore();
const messaging = getMessaging();

// --- SMTP CONFIG ---
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS
    }
});

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(204).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const authHeader = req.headers['x-api-key'] || req.headers['authorization'];
    const isCron = req.headers['x-vercel-cron'] === '1' || req.headers['user-agent']?.includes('vercel-cron');

    // Auth Check
    if (!isCron && authHeader !== process.env.API_SECRET_KEY && !authHeader?.startsWith('Bearer ')) {
        return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    try {
        const executorEmail = req.body?.executorEmail || 'system';
        const role = req.body?.role || 'system';

        // 1. Get Active Campaigns with autoBroadcast enabled that haven't been sent
        const now = new Date();
        const year = now.getFullYear();
        const month = String(now.getMonth() + 1).padStart(2, '0');
        const day = String(now.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const currentTimeStr = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const campaignSnap = await db.collection('campanas')
            .where('active', '==', true)
            .where('autoBroadcast', '==', true)
            .get();

        const pendingCampaigns = campaignSnap.docs.filter(doc => {
            const data = doc.data();
            if (data.broadcastSentAt) return false;

            // Start Date check
            if (data.startDate && data.startDate > todayStr) return false;

            // Start Time check (if it's today)
            if (data.startDate === todayStr && data.startTime && data.startTime > currentTimeStr) return false;

            return true;
        });

        if (pendingCampaigns.length === 0) {
            return res.status(200).json({ ok: true, message: 'No pending broadcasts' });
        }

        // 2. Process each campaign
        const results = [];
        const configSnap = await db.collection('config').doc('general').get();
        const appConfig = configSnap.exists ? configSnap.data() : {};
        const siteName = appConfig.siteName || 'Club Fidelidad';
        const PWA_URL = process.env.PWA_URL || `https://${process.env.VERCEL_URL}`;

        // Get all users with FCM tokens or emails
        const usersSnap = await db.collection('users').get();
        const users = usersSnap.docs.map(d => ({ id: d.id, ...d.data() }));

        for (const campDoc of pendingCampaigns) {
            const camp = { id: campDoc.id, ...campDoc.data() };
            let pushedCount = 0;
            let emailedCount = 0;
            let inboxCount = 0;

            const subject = camp.title || camp.name;
            const body = camp.description || '¡Nueva campaña disponible!';

            // A. Inbox Notifications (Always)
            const batch = db.batch();
            users.forEach(user => {
                const inboxRef = db.collection('clientes').doc(user.id).collection('inbox').doc();
                batch.set(inboxRef, {
                    title: subject,
                    body: body,
                    url: `${PWA_URL}/promociones`,
                    tag: `camp-${camp.id}`,
                    source: 'campania_auto',
                    status: 'sent',
                    sentAt: FieldValue.serverTimestamp(),
                    expireAt: camp.endDate ? new Date(camp.endDate) : null
                });
                inboxCount++;
            });
            await batch.commit();

            // B. Push Notifications
            const tokens = users.flatMap(u => u.fcmTokens || []);
            if (tokens.length > 0) {
                const chunks = [];
                for (let i = 0; i < tokens.length; i += 500) {
                    chunks.push(tokens.slice(i, i + 500));
                }

                for (const chunk of chunks) {
                    const message = {
                        notification: { title: subject, body: body },
                        data: {
                            url: `${PWA_URL}/notificaciones`,
                            tag: `camp-${camp.id}`
                        },
                        tokens: chunk
                    };
                    const pushResp = await messaging.sendEachForMulticast(message);
                    pushedCount += pushResp.successCount;
                }
            }

            // C. Email Notifications
            if (process.env.SMTP_USER && process.env.SMTP_PASS) {
                const emails = users.map(u => u.email).filter(Boolean);
                for (const email of emails) {
                    try {
                        const html = `
                            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                                <h1 style="color: #6366f1; text-align: center;">${subject}</h1>
                                <p style="font-size: 16px; line-height: 1.6; color: #333;">${body}</p>
                                <div style="text-align: center; margin-top: 30px;">
                                    <a href="${PWA_URL}" style="background-color: #6366f1; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; font-weight: bold;">Ver en la App</a>
                                </div>
                                <hr style="margin-top: 30px; border: 0; border-top: 1px solid #eee;">
                                <p style="font-size: 12px; color: #999; text-align: center;">Recibiste este mensaje porque sos socio de ${siteName}.</p>
                            </div>
                        `;
                        await transporter.sendMail({
                            from: `"${siteName}" <${process.env.SMTP_USER}>`,
                            to: email,
                            subject: subject,
                            html: html
                        });
                        emailedCount++;
                    } catch (err) {
                        console.error(`Email error to ${email}:`, err);
                    }
                }
            }

            // Update Campaign broadcast status
            await db.collection('campanas').doc(camp.id).update({
                broadcastSentAt: now.toISOString()
            });

            // Log to Audit
            await db.collection('audit_logs').add({
                timestamp: FieldValue.serverTimestamp(),
                type: 'campaign_broadcast',
                status: 'success',
                summary: `Motor Automático: Difusión enviada para "${camp.name}"`,
                details: {
                    campaignId: camp.id,
                    pushed: pushedCount,
                    emailed: emailedCount,
                    inbox: inboxCount,
                    executor: executorEmail
                },
                executor: executorEmail,
                role: role
            });

            results.push({
                campaign: camp.name,
                metrics: { pushed: pushedCount, emailed: emailedCount, inbox: inboxCount }
            });
        }

        return res.status(200).json({ ok: true, results });

    } catch (error) {
        console.error('Broadcast error:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
