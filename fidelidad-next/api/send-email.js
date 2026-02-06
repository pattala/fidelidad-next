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
  const apiKey = req.headers['x-api-key'] || null;
  const auth = req.headers.authorization || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : null;

  if (apiKey && apiKey === process.env.API_SECRET_KEY) return { ok: true, mode: 'secret' };
  if (token && (token === process.env.API_SECRET_KEY || token === process.env.MI_API_SECRET)) return { ok: true, mode: 'secret' };

  if (token) {
    try {
      const decoded = await adminAuth.verifyIdToken(token);
      if (decoded) return { ok: true, mode: 'idToken' };
    } catch { /* ignore */ }
  }

  if (ALLOWED.includes(origin)) return { ok: true, mode: 'origin' };

  return { ok: false, reason: token ? 'token-mismatch' : 'no-auth-header', origin };
}

function buildHtmlLayout(innerHtml, config = {}) {
  const base = process.env.PWA_URL || `https://${process.env.VERCEL_URL}`;
  const logo = config.logoUrl || process.env.PUSH_ICON_URL || `${base}/images/mi_logo.png`;
  const siteName = config.siteName || 'Club Fidelidad';
  const terms = process.env.URL_TERMINOS_Y_CONDICIONES || '#';

  return `<!doctype html>
  <html lang="es">
    <head><meta charset="utf-8"/><meta name="viewport" content="width=device-width,initial-scale=1"/><title>${siteName}</title></head>
    <body style="background:#f7f7f7;padding:0;margin:0;font-family:Arial,Helvetica,sans-serif;color:#111;">
      <table width="100%" cellspacing="0" cellpadding="0" style="background:#f7f7f7;padding:24px 0;">
        <tr><td align="center">
          <table width="600" cellspacing="0" cellpadding="0" style="background:#fff;border-radius:8px;overflow:hidden;border:1px solid #eee;">
            <tr><td style="background:#0ea5e9;height:6px;"></td></tr>
            <tr><td style="padding:16px;text-align:center;"><img src="${logo}" alt="${siteName}" style="max-width:140px;height:auto"/></td></tr>
            <tr><td style="padding:16px 24px;font-size:16px;line-height:1.5;">${innerHtml}</td></tr>
            <tr><td style="padding:16px 24px;text-align:center;color:#666;font-size:12px;">
              <a href="${base}" style="color:#0ea5e9;text-decoration:none;">Abrir App</a> · 
              <a href="${terms}" style="color:#0ea5e9;text-decoration:none;">Términos</a> · 
              © ${new Date().getFullYear()} ${siteName}
            </td></tr>
          </table>
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
      html = buildHtmlLayout(templateData.htmlContent || '<p>Sin contenido</p>', appConfig);
    } else {
      let tpl = await resolveTemplate(db, templateId, 'email');

      // HARDCODED FALLBACK FOR BIENVENIDA if empty
      if (templateId === 'bienvenida' && (!tpl.cuerpo || tpl.cuerpo.trim() === "")) {
        tpl = {
          titulo: "¡Bienvenido a {siteName}!",
          cuerpo: `<p>Hola <strong>{nombre}</strong>,</p>
                   <p>¡Gracias por sumarte a nuestro programa de fidelidad! Estamos felices de tenerte con nosotros.</p>
                   <p>Tu <strong>Número de Socio</strong> es: <span style="font-size: 18px; color: #0ea5e9;">#{numero_socio}</span></p>
                   [BLOQUE_PUNTOS_BIENVENIDA]
                   <p>Como regalo de bienvenida, te hemos asignado <strong>{puntos_ganados} puntos</strong> para que empieces a disfrutar de tus beneficios.</p>
                   [/BLOQUE_PUNTOS_BIENVENIDA]
                   <p>Ya puedes empezar a sumar puntos con tus compras y canjearlos por premios increíbles.</p>
                   <p>¡Nos vemos pronto!</p>`
        };
      }

      const mergedData = { ...templateData, email: to, siteName };
      subject = applyBlocksAndVars(tpl.titulo, mergedData);
      const htmlInner = applyBlocksAndVars(tpl.cuerpo, mergedData);

      html = buildHtmlLayout(htmlInner, appConfig);
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
    console.log('[send-email] Attempting to send via Nodemailer...', { to, subject });

    const info = await transporter.sendMail({
      from: `"${siteName}" <${process.env.SMTP_USER}>`,
      to,
      subject,
      html
    });

    console.log('[send-email] Nodemailer success:', info.messageId);
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
