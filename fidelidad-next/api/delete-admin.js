
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';

// --- Init Firebase Admin ---
if (!getApps().length) {
    const creds = process.env.GOOGLE_CREDENTIALS_JSON
        ? JSON.parse(process.env.GOOGLE_CREDENTIALS_JSON)
        : null;
    initializeApp(creds ? { credential: cert(creds) } : {});
}
const db = getFirestore();
const adminAuth = getAuth();

export default async function handler(req, res) {
    // CORS
    const origin = req.headers.origin || '';
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization,x-api-key');
    if (req.method === 'OPTIONS') return res.status(204).end();

    if (req.method !== 'POST') return res.status(405).json({ message: 'Method not allowed' });

    // Seguridad: Verificar x-api-key
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== process.env.API_SECRET_KEY && apiKey !== process.env.VITE_API_KEY) {
        return res.status(401).json({ message: 'No autorizado' });
    }

    const { uid, email } = req.body;

    if (!uid && !email) {
        return res.status(400).json({ message: 'Se requiere UID o Email' });
    }

    try {
        let targetUid = uid;

        // Si no tenemos UID pero sí email, buscamos el UID
        if (!targetUid && email) {
            try {
                const user = await adminAuth.getUserByEmail(email);
                targetUid = user.uid;
            } catch (e) {
                console.log('Usuario no encontrado en Auth por email:', email);
            }
        }

        // 1. Borrar de Firestore (colección admins)
        if (targetUid) {
            await db.collection('admins').doc(targetUid).delete();
        } else if (email) {
            // Backup por si el ID en firestore no es el UID (aunque debería serlo)
            const snap = await db.collection('admins').where('email', '==', email).get();
            const batch = db.batch();
            snap.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
        }

        // 2. Borrar de Firebase Auth
        if (targetUid) {
            try {
                await adminAuth.deleteUser(targetUid);
                console.log('Usuario eliminado de Auth:', targetUid);
            } catch (e) {
                if (e.code === 'auth/user-not-found') {
                    console.log('Usuario no existe en Auth, saltando...');
                } else {
                    throw e;
                }
            }
        }

        return res.status(200).json({ ok: true, message: 'Administrador eliminado completamente' });

    } catch (error) {
        console.error('Error in delete-admin:', error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
