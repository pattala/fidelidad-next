// /api/send-email.js (ESM) — Email con plantillas unificadas, CORS, auth y Nodemailer (Gmail)
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';
import { resolveTemplate, applyBlocksAndVars } from '../utils/templates.js';

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

function buildHtmlLayout(innerHtml, config = {}) {
  const base = config.contact?.pwaUrl || process.env.PWA_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'https://fidelidad-next.vercel.app');
  const logo = config.logoUrl || process.env.PUSH_ICON_URL || `${base}/images/mi_logo.png`;
  const siteName = config.siteName || 'Club Fidelidad';
  const terms = config.contact?.termsAndConditions || process.env.URL_TERMINOS_Y_CONDICIONES || `${base}/profile`;

  const facebook = config.contact?.facebook;
  const instagram = config.contact?.instagram;
  const whatsapp = config.contact?.whatsapp;
  const website = config.contact?.website;
  const address = config.contact?.address;

  // Social Icons grouping
  const icons = [];
  if (facebook) icons.push(`<a href="${facebook}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/124/124010.png" width="32" height="32" alt="FB"></a>`);
  if (instagram) icons.push(`<a href="${instagram.startsWith('http') ? instagram : 'https://instagram.com/' + instagram}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/174/174855.png" width="32" height="32" alt="IG"></a>`);
  if (whatsapp) icons.push(`<a href="https://wa.me/${whatsapp.replace(/\D/g, '')}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/733/733585.png" width="32" height="32" alt="WA"></a>`);
  if (website) icons.push(`<a href="${website}" style="display:inline-block;margin:0 8px;text-decoration:none;"><img src="https://cdn-icons-png.flaticon.com/512/1006/1006771.png" width="32" height="32" alt="WEB"></a>`);

  const socialIconsRow = icons.length > 0
    ? `<tr><td style="padding: 0 32px 16px; text-align: center;">${icons.join('')}</td></tr>`
    : '';

  const whatsappNumberRow = whatsapp
    ? `<tr><td style="padding: 0 32px 32px; text-align: center; font-family: sans-serif; font-size: 14px; color: #64748b; font-weight: bold;">WhatsApp: ${whatsapp}</td></tr>`
    : '';

  const addressBlock = address ? `
    <tr><td style="padding: 0 32px 32px; text-align: center;">
      <p style="margin: 0 0 16px 0; font-family: sans-serif; font-size: 14px; color: #64748b;">
        📍 ${address}
      </p>
      <a href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}" 
         style="background-color: #f1f5f9; color: #475569; padding: 10px 20px; border-radius: 12px; text-decoration: none; font-size: 13px; font-weight: bold; display: inline-block;">
        Cómo llegar
      </a>
    </td></tr>
  ` : '';

  return `<!doctype html>
  <html lang="es">
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${siteName}</title></head>
    <body style="background:#f0f2f5;padding:0;margin:0;font-family:'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;color:#333;">
      <table width="100%" cellspacing="0" cellpadding="0" style="background:#f0f2f5;padding:40px 0;">
        <tr><td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:16px;overflow:hidden;box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06);">
            <tr><td style="background:#0ea5e9;height:8px;"></td></tr>
            <tr><td style="padding:32px 32px 24px;text-align:center;">
                <img src="${logo}" alt="${siteName}" style="max-width:120px;height:auto;border-radius:12px;display:block;margin:0 auto 12px;"/>
                <div style="font-size:18px;font-weight:bold;color:#1e293b;">${siteName}</div>
            </td></tr>
            <tr><td style="padding:0 32px 32px;font-size:16px;line-height:1.6;text-align:left;color:#4b5563;">${innerHtml}</td></tr>
            
            ${socialIconsRow}
            ${whatsappNumberRow}
            ${addressBlock}

            <tr><td style="background-color:#f8fafc;padding:24px;text-align:center;border-top:1px solid #e2e8f0;">
              <p style="margin:0 0 16px 0;font-size:14px;">
                <a href="${base}/login" style="display:inline-block;padding:10px 20px;background-color:#0ea5e9;color:#ffffff;text-decoration:none;border-radius:8px;font-weight:bold;">Abrir App Web</a>
              </p>
              <p style="margin:0;font-size:12px;color:#94a3b8;">
                <a href="${terms}" style="color:#64748b;text-decoration:underline;">Términos y Condiciones</a>
              </p>
              <p style="margin:8px 0 0;font-size:11px;color:#cbd5e1;">&copy; ${new Date().getFullYear()} ${siteName}. Todos los derechos reservados.</p>
            </td></tr>
          </table>
          <p style="margin-top:24px;text-align:center;font-size:11px;color:#94a3b8;max-width:400px;">
            Este correo fue enviado automáticamente por ${siteName}.
          </p>
        </td></tr>
      </table>
    </body>
  </html>`;
}

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

    const info = await transporter.sendMail({
      from: `"${siteName}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log('[send-email] Nodemailer success:', info.messageId);

    // 5) AUDIT LOG
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

      await db.collection('audit_logs').add({
        timestamp: admin.firestore.FieldValue ? admin.firestore.FieldValue.serverTimestamp() : new Date(),
        type: 'email_notification',
        status: 'success',
        summary: `Email enviado a ${userName} (${to}): "${subject}"`,
        details: [{
          userId,
          userName,
          to,
          subject,
          messageId: info.messageId,
          action: 'email_sent',
          status: 'success',
          timestamp: new Date().toISOString()
        }],
        executor: 'system'
      });
    } catch (logErr) {
      console.error('[send-email] Error saving audit log:', logErr);
    }

    return res.status(200).json({ ok: true, sent: true, to, subject, messageId: info.messageId });

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
