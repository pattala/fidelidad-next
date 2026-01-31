
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';

// --- Init Firebase Admin ---
if (!getApps().length) {
    const creds = process.env.GOOGLE_CREDENTIALS_JSON
        ? JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
        : null;
    initializeApp(creds ? { credential: cert(creds) } : {});
}
const db = getFirestore();
const adminAuth = getAuth();

// --- Nodemailer Transporter ---
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

export default async function handler(req, res) {
    // CORS (permitir llamadas desde el frontend)
    const origin = req.headers.origin || '';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    // Seguridad: Verificar x-api-key o Token
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_SECRET_KEY && apiKey !== process.env.VITE_API_KEY) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    const { email, role, invitedBy } = req.body;

    try {
        // 1. Obtener configuración del comercio para el branding
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : { siteName: 'Club de Fidelidad', primaryColor: '#2563eb' };

        // 2. Crear o recuperar usuario en Firebase Auth
        let user;
        try {
            user = await adminAuth.getUserByEmail(email);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                // No existe, lo creamos sin password (estará deshabilitado hasta que ponga uno)
                user = await adminAuth.createUser({
                    email,
                    emailVerified: true
                });
            } else {
                throw e;
            }
        }

        // 3. Generar link de "Setup Password" (es el mismo de Reset)
        const baseUrl = origin || process.env.PWA_URL || 'https://fidelidad-next.vercel.app';
        const actionCodeSettings = {
            url: baseUrl + '/admin/login',
        };
        const actionLink = await adminAuth.generatePasswordResetLink(email, actionCodeSettings);

        // 4. Registrar en la colección 'admins' con el UID correcto
        await db.collection('admins').doc(user.uid).set({
            email,
            role,
            invitedBy,
            status: 'active',
            createdAt: new Date(),
            uid: user.uid
        }, { merge: true });

        // 5. Enviar Email con Branding
        const html = `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #eee; border-radius: 12px; overflow: hidden;">
        <div style="background-color: ${config.primaryColor || '#2563eb'}; padding: 30px; text-align: center; color: white;">
          ${config.logoUrl ? `<img src="${config.logoUrl}" style="height: 60px; margin-bottom: 10px;" />` : ''}
          <h1 style="margin: 0; font-size: 24px;">¡Bienvenido al Equipo!</h1>
        </div>
        <div style="padding: 30px; line-height: 1.6; color: #333;">
          <p>Hola,</p>
          <p>Has sido invitado por <b>${invitedBy}</b> para administrar el panel de <b>${config.siteName}</b> con el rol de <b>${role.toUpperCase()}</b>.</p>
          <p>Para comenzar a trabajar, por favor haz clic en el siguiente botón para crear tu contraseña de acceso:</p>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${actionLink}" style="background-color: ${config.primaryColor || '#2563eb'}; color: white; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">Activar mi Cuenta</a>
          </div>
          <p style="font-size: 12px; color: #666;">Si el botón no funciona, copia y pega este link en tu navegador:<br/>${actionLink}</p>
          <hr style="border: 0; border-top: 1px solid #eee; margin: 20px 0;" />
          <p style="font-size: 12px; color: #999; text-align: center;">Este es un mensaje automático de ${config.siteName}.</p>
        </div>
      </div>
    `;

        await transporter.sendMail({
            from: `"${config.siteName}" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `Invitación de Administración - ${config.siteName}`,
            html: html
        });

        return res.status(200).json({ ok: true, message: 'Invitación enviada' });

    } catch (error) {
        console.error('Error in invite-admin:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
