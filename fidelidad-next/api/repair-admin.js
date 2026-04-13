// api/repair-admin.js
import admin from "firebase-admin";
import { MASTER_ADMINS, MASTER_LOGIN_KEY, DEFAULT_ADMIN_KEY } from "../src/lib/adminConfig";

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

        const finalEmail = email.toLowerCase();
        
        // 1. Validar si es una credencial maestra válida según el código
        const isMasterAccount = MASTER_ADMINS.map(e => e.toLowerCase()).includes(finalEmail);
        const isDefaultAccount = finalEmail === 'admin@admin.com';
        
        const isValidMasterKey = (isMasterAccount && password === MASTER_LOGIN_KEY);
        const isValidDefaultKey = (isDefaultAccount && password === DEFAULT_ADMIN_KEY);

        if (!isValidMasterKey && !isValidDefaultKey) {
            return res.status(403).json({ ok: false, error: "Credenciales maestras no válidas para reparación." });
        }

        console.log(`[repair-admin] Iniciando reparación para: ${finalEmail}`);

        // 2. Intentar buscar el usuario en Auth
        let userRecord;
        try {
            userRecord = await auth.getUserByEmail(finalEmail);
            // Si existe, actualizamos la contraseña forzosamente
            await auth.updateUser(userRecord.uid, {
                password: password
            });
            console.log(`[repair-admin] Contraseña actualizada para: ${finalEmail}`);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                // Si no existe, lo creamos
                userRecord = await auth.createUser({
                    email: finalEmail,
                    password: password,
                    emailVerified: true
                });
                console.log(`[repair-admin] Usuario creado para: ${finalEmail}`);
            } else {
                throw e;
            }
        }

        // 3. Asegurar que tenga el documento en Firestore 'admins'
        const adminRef = db.collection('admins').doc(userRecord.uid);
        const adminSnap = await adminRef.get();
        
        if (!adminSnap.exists) {
            await adminRef.set({
                email: finalEmail,
                role: 'admin',
                isMaster: true,
                repairedAt: admin.firestore.FieldValue.serverTimestamp(),
                status: 'active'
            });
            console.log(`[repair-admin] Documento Firestore creado para: ${finalEmail}`);
        } else {
            await adminRef.update({
                isMaster: true,
                lastRepairAt: admin.firestore.FieldValue.serverTimestamp()
            });
        }

        return res.status(200).json({ 
            ok: true, 
            message: "Cuenta reparada y sincronizada correctamente.",
            action: adminSnap.exists ? 'updated' : 'created'
        });

    } catch (err) {
        console.error("repair-admin error:", err);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
