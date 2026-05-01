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
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    if (!authHeader || !authHeader.includes(SECRET)) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
        const db = getDb();
        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Obtener valor del punto
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        const prizesSnap = await db.collection('prizes').where('active', '==', true).get();
        let totalRatio = 0, pCount = 0;
        prizesSnap.forEach(d => {
            const p = d.data();
            if (p.cashValue && p.pointsRequired > 0) { totalRatio += (p.cashValue / p.pointsRequired); pCount++; }
        });
        const pointValue = pCount > 0 ? (totalRatio / pCount) : (config.pointValue || 10);

        // CONSULTA ULTRA-SEGURA: Usamos el cache 'nextExpirationDate' de los usuarios
        const usersSnap = await db.collection('users')
            .where('nextExpirationDate', '>=', todayStr)
            .get();

        const intervals = {
            short:  { label: 'Próximos 7 días', points: 0, money: 0, count: 0 },
            medium: { label: '8 a 30 días',      points: 0, money: 0, count: 0 },
            long:   { label: '31 a 90 días',      points: 0, money: 0, count: 0 },
            future: { label: 'Más de 90 días',    points: 0, money: 0, count: 0 }
        };

        usersSnap.forEach(doc => {
            const data = doc.data();
            const points = Number(data.nextExpirationAmount || 0);
            const date = data.nextExpirationDate;
            if (points <= 0 || !date) return;

            const expiresAt = new Date(date + 'T12:00:00');
            const diffDays = Math.ceil((expiresAt.getTime() - now.getTime()) / 86400000);

            if (diffDays >= 0) {
                let bucket;
                if (diffDays <= 7) bucket = intervals.short;
                else if (diffDays <= 30) bucket = intervals.medium;
                else if (diffDays <= 90) bucket = intervals.long;
                else bucket = intervals.future;
                
                bucket.points += points;
                bucket.money += (points * pointValue);
                bucket.count++;
            }
        });

        return res.status(200).json({ 
            ok: true, 
            summary: {
                totalPoints: Object.values(intervals).reduce((acc, b) => acc + b.points, 0),
                totalMoney: Object.values(intervals).reduce((acc, b) => acc + b.money, 0),
                intervals: Object.entries(intervals).map(([key, val]) => ({ key, ...val }))
            },
            pointValue 
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
}
