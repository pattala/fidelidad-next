// api/repair-admin.js
import admin from "firebase-admin";

const MASTER_ADMINS = [
    'pablo_attala@yahoo.com.ar',
    'admin@admin.com',
];

// Usamos process.env para compatibilidad con Node.js en Vercel
const MASTER_LOGIN_KEY = process.env.VITE_MASTER_LOGIN_KEY || 'Felipe01';
const DEFAULT_ADMIN_KEY = 'adminadmin';

function initFirebaseAdmin() {
    if (admin.apps.length) return;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");
    let sa = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    const { email, password } = req.body || {};

    if (!email || !password) {
        return res.status(400).json({ ok: false, error: "Email y Contraseña requeridos" });
    }

    try {
        initFirebaseAdmin();
        const auth = admin.auth();
        const db = admin.firestore();

        const finalEmail = email.toLowerCase().trim();
        const finalPass = password.trim();
        
        // 1. Validar si es una credencial maestra válida según el código
        const isMasterAccount = MASTER_ADMINS.map(e => e.toLowerCase()).includes(finalEmail);
        const isDefaultAccount = finalEmail === 'admin@admin.com';
        
        const isValidMasterKey = (isMasterAccount && finalPass === MASTER_LOGIN_KEY);
        const isValidDefaultKey = (isDefaultAccount && finalPass === DEFAULT_ADMIN_KEY);

        if (!isValidMasterKey && !isValidDefaultKey) {
            console.warn(`[repair-admin] Intento de reparación no autorizado para: ${finalEmail}`);
            return res.status(403).json({ ok: false, error: "Credenciales no autorizadas." });
        }

        console.log(`[repair-admin] Procesando reparación estable para: ${finalEmail}`);

        // 2. Sincronizar usuario en Firebase Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(finalEmail);
            await auth.updateUser(userRecord.uid, { password: finalPass });
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                userRecord = await auth.createUser({
                    email: finalEmail,
                    password: finalPass,
                    emailVerified: true
                });
            } else {
                throw e;
            }
        }

        // 3. Sincronizar documento en Firestore
        const adminRef = db.collection('admins').doc(userRecord.uid);
        const adminSnap = await adminRef.get();
        
        if (!adminSnap.exists) {
            await adminRef.set({
                email: finalEmail,
                role: 'admin',
                isMaster: true,
                status: 'active',
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            });
        } else {
            await adminRef.update({
                role: 'admin',
                isMaster: true,
                lastSyncAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return res.status(200).json({ ok: true, message: "Acceso sincronizado." });

    } catch (err) {
        console.error("repair-admin fatal error:", err);
        return res.status(500).json({ ok: false, error: "Error interno de sincronización" });
    }
}
