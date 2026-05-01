import admin from "firebase-admin";

function getDb() {
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
    return admin.firestore();
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    if (!authHeader || !authHeader.includes(SECRET)) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
        const db = getDb();
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];
        const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const currentYear = now.getFullYear().toString();
        const logResults = [];

        // 1. CUMPLEAÑOS
        const usersWithBirthdays = await db.collection('users').where('birthDate', '!=', '').get();
        for (const doc of usersWithBirthdays.docs) {
            const data = doc.data();
            if (data.birthDate?.endsWith(todayMD) && data.lastBirthdayGreetingYear !== currentYear) {
                await doc.ref.update({ points: admin.firestore.FieldValue.increment(100), lastBirthdayGreetingYear: currentYear });
                await doc.ref.collection('points_history').add({ amount: 100, concept: '🎂 ¡Feliz Cumpleaños!', date: admin.firestore.Timestamp.fromDate(now), type: 'credit', remainingPoints: 100 });
                logResults.push({ action: 'birthday', info: data.name });
            }
        }

        // 2. VENCIMIENTOS
        const toExpireSnap = await db.collection('users').where('nextExpirationDate', '<=', todayStr).get();
        for (const doc of toExpireSnap.docs) {
            const history = doc.ref.collection('points_history');
            const expiredItems = await history.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(now)).get();
            let total = 0;
            const batch = db.batch();
            expiredItems.docs.forEach(d => {
                const data = d.data();
                if (data.status === 'expired') return;
                const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
                if (data.type === 'credit' && rem > 0) {
                    total += rem;
                    batch.update(d.ref, { status: 'expired', remainingPoints: 0 });
                }
            });
            if (total > 0) {
                batch.update(doc.ref, { points: admin.firestore.FieldValue.increment(-total) });
                batch.set(history.doc(), { amount: -total, concept: 'Vencimiento automático', date: admin.firestore.FieldValue.serverTimestamp(), type: 'debit' });
                await batch.commit();
                logResults.push({ action: 'expired', info: `${doc.id}: -${total}` });
            }
        }

        await db.collection('audit_logs').add({
            type: 'engine_daily_unified',
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            executor: req.query.trigger || 'auto',
            summary: `V.1.3.6: ${logResults.length} acciones procesadas.`
        });

        return res.status(200).json({ ok: true, details: logResults });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
