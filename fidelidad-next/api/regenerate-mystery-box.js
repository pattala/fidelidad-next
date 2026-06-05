import admin from "firebase-admin";

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const credsRaw = (process.env.GOOGLE_CREDENTIALS_JSON || "").trim();
        if (!credsRaw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON");
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
    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!authHeader || !SECRET || !authHeader.includes(SECRET)) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    try {
        const adminApp = initFirebaseAdmin();
        const db = adminApp.firestore();

        const { alertId } = req.body; // Puede ser 'mb_123' o 'MBX-123'
        if (!alertId) {
            return res.status(400).json({ ok: false, error: 'Missing alertId' });
        }

        const mbId = alertId.startsWith('mb_') ? alertId.substring(3) : alertId;

        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        const mbConfig = config.mysteryBox || {};
        const chanceDeadlineMinutes = mbConfig.chanceDeadlineMinutes || 60;

        const mbRef = db.collection('mystery_box_chances').doc(mbId);
        
        const result = await db.runTransaction(async (t) => {
            const doc = await t.get(mbRef);
            if (!doc.exists) throw new Error("Sorteo no encontrado");
            
            const data = doc.data();
            
            if (data.status !== 'pending') {
                throw new Error("El sorteo ya no está pendiente o ya fue jugado");
            }
            if (data.isRegenerated) {
                throw new Error("Este código ya fue regenerado previamente. Solo se permite una vez.");
            }
            
            const now = adminApp.firestore.Timestamp.now();
            if (data.resendExpiresAt && data.resendExpiresAt.toDate() < now.toDate()) {
                throw new Error("El tiempo límite para reenviar este sorteo ha expirado.");
            }

            // Destruir (invalidar) el código viejo
            t.update(mbRef, {
                status: 'regenerated',
                regeneratedAt: now,
                updatedAt: now
            });

            // Crear el código nuevo
            const newId = 'MBX-' + Date.now().toString(36).toUpperCase() + '-' + Math.random().toString(36).substring(2, 6).toUpperCase();
            
            const realNowTime = Date.now();
            const newExpiresAt = new Date(realNowTime + (chanceDeadlineMinutes * 60 * 1000));
            // No seteamos resendExpiresAt porque no se puede volver a regenerar
            
            const newChance = {
                ...data,
                id: newId,
                status: 'pending',
                expiresAt: adminApp.firestore.Timestamp.fromDate(newExpiresAt),
                createdAt: now,
                qrScanned: false,
                isRegenerated: true,
                originalId: mbId
            };
            
            delete newChance.regeneratedAt;
            delete newChance.updatedAt;
            
            const newRef = db.collection('mystery_box_chances').doc(newId);
            t.set(newRef, newChance);

            return newId;
        });

        return res.status(200).json({ ok: true, newId: result });

    } catch (e) {
        console.error("Error regenerating mystery box:", e);
        return res.status(500).json({ ok: false, error: e.message || 'Error interno' });
    }
}
