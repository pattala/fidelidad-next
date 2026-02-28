
import admin from "firebase-admin";

// ---------- Inicialización Firebase Admin ----------
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

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    if (req.method !== 'POST') return res.status(405).json({ ok: false, error: 'Method not allowed' });

    const { token, userId } = req.body;

    if (!token || !userId) {
        return res.status(400).json({ ok: false, error: 'Falta token o userId' });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    try {
        const cleanToken = token.trim();

        // 1. Buscar otros usuarios que tengan este token
        const othersSnap = await db.collection("users")
            .where("fcmTokens", "array-contains", cleanToken)
            .get();

        const batch = db.batch();
        let cleanedCount = 0;

        othersSnap.forEach(doc => {
            if (doc.id !== userId) {
                const data = doc.data();
                const newTokens = (data.fcmTokens || []).filter(t => t !== cleanToken);
                const update = { fcmTokens: newTokens };
                if (data.fcmToken === cleanToken) {
                    update.fcmToken = null;
                }
                batch.update(doc.ref, update);
                cleanedCount++;
            }
        });

        // 2. Registrar el token para el usuario actual
        const userRef = db.collection("users").doc(userId);
        const userDoc = await userRef.get();

        if (userDoc.exists) {
            const userData = userDoc.data();
            const currentTokens = userData.fcmTokens || [];
            if (!currentTokens.includes(cleanToken)) {
                currentTokens.push(cleanToken);
            }
            batch.update(userRef, {
                fcmTokens: currentTokens,
                fcmToken: cleanToken,
                lastFcmUpdate: admin.firestore.FieldValue.serverTimestamp(),
                'permissions.notifications.status': 'granted'
            });
        } else {
            // Si por alguna razón no existe el doc de usuario, lo creamos
            batch.set(userRef, {
                fcmTokens: [cleanToken],
                fcmToken: cleanToken,
                lastFcmUpdate: admin.firestore.FieldValue.serverTimestamp(),
                permissions: {
                    notifications: {
                        status: 'granted',
                        updatedAt: new Date()
                    }
                }
            }, { merge: true });
        }

        await batch.commit();

        console.log(`[register-fcm-token] Token ${cleanToken.substring(0, 10)}... registered to ${userId}. Cleaned from ${cleanedCount} accounts.`);

        return res.status(200).json({ ok: true, cleanedCount });

    } catch (error) {
        console.error("Error registering FCM token:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
