import admin from "firebase-admin";

// --- INICIALIZACIÓN ROBUSTA ---
function getDb() {
    if (!admin.apps.length) {
        const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
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

// --- UTILIDAD DE FECHA INTEGRADA (Evita error de importación) ---
async function getNow(db, simulatedDateParam) {
    if (simulatedDateParam) {
        const dateStr = simulatedDateParam.includes('T') ? simulatedDateParam.split('T')[0] : simulatedDateParam;
        return new Date(dateStr + 'T12:00:00');
    }
    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data() || {};
    if (config.enableDateSimulator && config.simulatedOffsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + Number(config.simulatedOffsetDays));
        return d;
    }
    return new Date();
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    if (!authHeader || !authHeader.includes(SECRET)) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
        const db = getDb();
        const customStartStr = req.query?.startDate || req.body?.startDate;
        const customEndStr = req.query?.endDate || req.body?.endDate;
        const hasCustom = !!(customStartStr && customEndStr);

        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};

        const prizesSnap = await db.collection('prizes').where('active', '==', true).get();
        let totalRatio = 0, pCount = 0;
        prizesSnap.forEach(d => {
            const p = d.data();
            if (p.cashValue && p.pointsRequired > 0) { totalRatio += (p.cashValue / p.pointsRequired); pCount++; }
        });
        const pointValue = pCount > 0 ? (totalRatio / pCount) : (config.pointValue || 10);

        const now = await getNow(db);
        const startOfToday = new Date(now); startOfToday.setHours(0, 0, 0, 0);

        const intervals = {
            short:  { label: 'Próximos 7 días', maxDays: 7,    points: 0, money: 0, count: 0 },
            medium: { label: '8 a 30 días',      maxDays: 30,   points: 0, money: 0, count: 0 },
            long:   { label: '31 a 90 días',      maxDays: 90,   points: 0, money: 0, count: 0 },
            future: { label: 'Más de 90 días',    maxDays: 9999, points: 0, money: 0, count: 0 }
        };

        const customRange = {
            active: hasCustom,
            start: hasCustom ? new Date(customStartStr + 'T00:00:00') : null,
            end:   hasCustom ? new Date(customEndStr + 'T23:59:59')   : null,
            points: 0, money: 0, count: 0
        };

        // FILTRADO EN MEMORIA PARA EVITAR ERROR 500 DE ÍNDICE
        const creditsSnap = await db.collectionGroup('points_history').where('type', '==', 'credit').get();
        
        creditsSnap.forEach(doc => {
            const data = doc.data();
            if (data.status === 'expired' || !data.expiresAt || (data.remainingPoints || 0) <= 0) return;

            const expiresAt = data.expiresAt.toDate();
            const diffDays = Math.ceil((expiresAt.getTime() - startOfToday.getTime()) / 86400000);

            if (diffDays > 0) {
                let bucket;
                if (diffDays <= 7) bucket = intervals.short;
                else if (diffDays <= 30) bucket = intervals.medium;
                else if (diffDays <= 90) bucket = intervals.long;
                else bucket = intervals.future;
                
                const rem = Number(data.remainingPoints);
                bucket.points += rem;
                bucket.money += (rem * pointValue);
                bucket.count++;
            }
            if (customRange.active && expiresAt >= customRange.start && expiresAt <= customRange.end) {
                const rem = Number(data.remainingPoints);
                customRange.points += rem;
                customRange.money += (rem * pointValue);
                customRange.count++;
            }
        });

        return res.status(200).json({ 
            ok: true, 
            summary: {
                totalPoints: Object.values(intervals).reduce((acc, b) => acc + b.points, 0),
                totalMoney: Object.values(intervals).reduce((acc, b) => acc + b.money, 0),
                intervals: Object.entries(intervals).map(([key, val]) => ({ key, ...val })),
                customRange: customRange.active ? customRange : null
            },
            pointValue 
        });
    } catch (error) {
        return res.status(500).json({ ok: false, error: error.message });
    }
}
