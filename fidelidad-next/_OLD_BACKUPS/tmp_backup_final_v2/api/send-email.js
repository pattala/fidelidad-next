// /api/send-email.js (ESM) — Email con plantillas unificadas, CORS, auth y Nodemailer (Gmail)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';
import { resolveTemplate, applyBlocksAndVars } from '../utils/templates.js';
import { buildHtmlLayout } from '../utils/emailLayout.js';

// --- Init Firebase Admin ---
if (!getApps().length) {
  const creds = process.env.GOOGLE_CREDENTIALS_JSON
    ? JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
    : null;
  initializeApp(creds ? { credential: cert(creds) } : {});
}
const db = getFirestore();
const adminAuth = getAuth();

// --- Nodemailer Transporter (Gmail) ---
// Se requiere SMTP_USER (tu gmail) y SMTP_PASS (App Password generada en Google)
const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

// --- CORS ---
const ALLOWED = (process.env.CORS_ALLOWED_ORIGINS || '')
  .split(',').map(s => s.trim()).filter(Boolean);

function cors(req, res) {
  const origin = req.headers.origin || '';
  if (ALLOWED.includes(origin)) res.setHeader('Access-Control-Allow-Origin', origin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
  if (req.method === 'OPTIONS') { res.status(204).end(); return true; }
  return false;
}

// --- Auth ---
async function authCheck(req) {
  const origin = req.headers.origin || '';
  const authHeader = req.headers.authorization || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  const SECRET_RAW = process.env.API_SECRET_KEY || process.env.MI_API_SECRET || process.env.VITE_API_KEY || "";
  const SECRET = SECRET_RAW.trim();
  const receivedApiKeyRaw = req.headers['x-api-key'] || req.headers['x-api-secret'] || "";
  const receivedApiKey = String(receivedApiKeyRaw).trim();

  const match = (receivedApiKey && SECRET && receivedApiKey === SECRET);

  console.log(`[send-email] Auth check:`, {
    receivedKeyLen: receivedApiKey.length,
    secretLen: SECRET.length,
    match,
    hasToken: !!token,
    permissive: !SECRET || !receivedApiKey
  });

  if (!SECRET || !receivedApiKey) return { ok: true, mode: 'permissive' };
  if (match) return { ok: true, mode: 'secret' };
  if (token && (token.trim() === SECRET || token.trim() === (process.env.MI_API_SECRET || "").trim())) return { ok: true, mode: 'secret' };

  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded) return { ok: true, mode: 'idToken' };
    } catch (e) {
      console.warn('[send-email] ID Token verification failed:', e.message);
    }
  }

  if (ALLOWED.includes(origin)) return { ok: true, mode: 'origin' };

  return { ok: false, reason: 'unauthorized', origin };
}

// La función buildHtmlLayout ha sido movida a ../utils/emailLayout.js

export default async function handler(req, res) {
  if (cors(req, res)) return;
  if (req.method !== 'POST') return res.status(405).json({ message: `Método ${req.method} no permitido.` });

  const auth = await authCheck(req);
  if (!auth.ok) {
    console.warn('send-email unauthorized', { reason: auth.reason, origin: auth.origin || null });
    return res.status(401).json({ message: 'No autorizado.' });
  }

  try {
    const { to, templateId, templateData = {} } = req.body || {};
    if (!to || !templateId) return res.status(400).json({ message: 'Faltan parámetros: to y templateId.' });

    // 1) Fetch Dynamic Config for Branding
    const configSnap = await db.collection('config').doc('general').get();
    const appConfig = configSnap.exists ? configSnap.data() : { siteName: 'Club Fidelidad' };
    const siteName = appConfig.siteName || 'Club Fidelidad';

    // 2) Plantilla unificada o Manual Override
    let subject, html;

    if (templateId === 'manual_override') {
      subject = templateData.subject || 'Notificación';
      // If we are in manual_override, we assume the caller provides the full HTML or we trust their layout.
      // THE BUG: We were wrapping it in buildHtmlLayout again, causing double headers/footers.
      html = templateData.htmlContent || '<p>Sin contenido</p>';

      // If the html doesn't look like a full document, we wrap it, otherwise we use it raw.
      if (!html.toLowerCase().includes('<html')) {
        html = buildHtmlLayout(html, appConfig);
      }
    } else {
      const tpl = await resolveTemplate(db, templateId, 'email');

      // HARDCODED FALLBACK FOR BIENVENIDA if empty
      if (templateId === 'bienvenida' && (!tpl?.cuerpo || tpl.cuerpo.trim() === "")) {
        subject = `¡Bienvenido a ${siteName}!`;
        const htmlInner = `<p>Hola <strong>{nombre}</strong>,</p>
                   <p>¡Gracias por sumarte a nuestro programa de fidelidad! Estamos felices de tenerte con nosotros.</p>
                   <p>Tu <strong>Número de Socio</strong> es: <span style="font-size: 18px; color: #0ea5e9;">#{numero_socio}</span></p>
                   <p>Ya puedes empezar a sumar puntos con tus compras y canjearlos por premios increíbles.</p>
                   <p>¡Nos vemos pronto!</p>`;
        html = buildHtmlLayout(applyBlocksAndVars(htmlInner, { ...templateData, siteName }), appConfig);
      } else {
        const mergedData = { ...templateData, email: to, siteName };
        subject = applyBlocksAndVars(tpl.titulo || 'Notificación', mergedData);
        const htmlInner = applyBlocksAndVars(tpl.cuerpo || '', mergedData);
        html = buildHtmlLayout(htmlInner, appConfig);
      }
    }

    // 3) Validar Credenciales SMTP
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
      console.error('Faltan credenciales SMTP_USER / SMTP_PASS');
      return res.status(500).json({
        message: 'Error de configuración de correo (SMTP).',
        missing: !process.env.SMTP_USER ? 'SMTP_USER' : 'SMTP_PASS'
      });
    }

    // 4) Enviar con Nodemailer (Gmail)
    console.log('[send-email] Attempting to send...', {
      to,
      subject,
      smtpUser: process.env.SMTP_USER ? (process.env.SMTP_USER.substring(0, 3) + '...') : 'MISSING',
      hasPass: !!process.env.SMTP_PASS
    });

    let sendInfo = null;
    let sendError = null;

    try {
      sendInfo = await transporter.sendMail({
        from: `"${siteName}" <${process.env.SMTP_USER}>`,
        to,
        subject,
        html
      });
      console.log('[send-email] Nodemailer success:', sendInfo.messageId);
    } catch (err) {
      console.error('[send-email] Nodemailer error:', err);
      sendError = err;
    }

    // 5) AUDIT LOG (Always runs)
    try {
      // Intentar buscar al usuario por email para el log de auditoría
      let userName = 'Socio';
      let userId = 'unknown';
      try {
        const userQuery = await db.collection('users').where('email', '==', to).limit(1).get();
        if (!userQuery.empty) {
          const userDoc = userQuery.docs[0];
          userId = userDoc.id;
          userName = userDoc.data()?.name || userDoc.data()?.nombre || 'Socio';
        } else if (templateData?.nombre) {
          userName = templateData.nombre;
        }
      } catch (searchErr) {
        console.warn('[send-email] Error searching user for audit:', searchErr.message);
      }

      const { points, executor: reqExecutor } = req.body;
      const pointsInfo = points ? ` [${points} pts]` : "";

      const auditStatus = sendError ? 'failed' : 'success';
      const auditSummary = sendError
        ? `ERROR al enviar Email a ${userName} (${to}): "${subject}"`
        : `Email enviado a ${userName} (${to}): "${subject}"${pointsInfo}`;

      await db.collection('audit_logs').add({
        timestamp: FieldValue.serverTimestamp(),
        type: 'email_notification',
        status: auditStatus,
        summary: auditSummary,
        details: [{
          userId,
          userName,
          to,
          subject,
          points: points || null,
          messageId: sendInfo?.messageId || null,
          error: sendError?.message || null,
          action: 'email_sent',
          status: auditStatus,
          timestamp: new Date().toISOString()
        }],
        executor: reqExecutor || 'system'
      });
    } catch (logErr) {
      console.error('[send-email] Error saving audit log:', logErr);
    }

    if (sendError) {
      return res.status(500).json({
        ok: false,
        error: sendError.message,
        details: sendError.response || null
      });
    }

    return res.status(200).json({ ok: true, sent: true, to, subject, messageId: sendInfo.messageId });

  } catch (error) {
    console.error('Error fatal procesando el email:', error);
    // Return more details for debugging (careful not to expose too much in prod, but needed now)
    return res.status(500).json({
      message: 'Error interno del servidor.',
      error: error.message,
      code: error.code,
      details: error.response || null,
      smtpConfigured: !!(process.env.SMTP_USER && process.env.SMTP_PASS)
    });
  }
}
