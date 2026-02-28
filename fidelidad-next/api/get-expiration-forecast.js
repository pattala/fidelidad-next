
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

    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!authHeader || !authHeader.includes(SECRET)) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    try {
        // 0. Parámetros de rango personalizado
        const customStartStr = req.query?.startDate || req.body?.startDate;
        const customEndStr = req.query?.endDate || req.body?.endDate;
        const hasCustom = !!(customStartStr && customEndStr);

        // 1. Obtener Configuración (para el valor del punto)
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : {};

        // Calcular Valor Real del Punto (Ratio promedio)
        const prizesSnap = await db.collection('prizes').where('active', '==', true).get();
        let totalRatio = 0, pCount = 0;
        prizesSnap.forEach(d => {
            const p = d.data();
            if (p.cashValue && p.pointsRequired > 0) {
                totalRatio += (p.cashValue / p.pointsRequired);
                pCount++;
            }
        });
        const pointValue = pCount > 0 ? (totalRatio / pCount) : (config.pointValue || 10);

        const now = new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        const intervals = {
            short: { label: 'Próximos 7 días', maxDays: 7, points: 0, money: 0, count: 0 },
            medium: { label: '8 a 30 días', maxDays: 30, points: 0, money: 0, count: 0 },
            long: { label: '31 a 90 días', maxDays: 90, points: 0, money: 0, count: 0 },
            future: { label: 'Más de 90 días', maxDays: 9999, points: 0, money: 0, count: 0 }
        };

        const customRange = {
            active: hasCustom,
            start: hasCustom ? new Date(customStartStr) : null,
            end: hasCustom ? new Date(customEndStr) : null,
            points: 0,
            money: 0,
            count: 0
        };

        // Normalizar fin de día para el rango personalizado
        if (customRange.end) customRange.end.setHours(23, 59, 59, 999);

        // 2. Usar collectionGroup para buscar todos los créditos activos
        const creditsSnap = await db.collectionGroup('points_history')
            .where('type', '==', 'credit')
            .where('status', '==', 'active')
            .where('remainingPoints', '>', 0)
            .get();

        creditsSnap.forEach(doc => {
            const data = doc.data();
            if (!data.expiresAt) return;

            const expiresAt = data.expiresAt.toDate();

            // Buckets fijos (basados en hoy)
            const diffTime = expiresAt.getTime() - startOfToday.getTime();
            const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

            if (diffDays > 0) {
                let bucket;
                if (diffDays <= 7) bucket = intervals.short;
                else if (diffDays <= 30) bucket = intervals.medium;
                else if (diffDays <= 90) bucket = intervals.long;
                else bucket = intervals.future;

                const pts = Number(data.remainingPoints);
                bucket.points += pts;
                bucket.money += (pts * pointValue);
                bucket.count++;
            }

            // Rango personalizado
            if (customRange.active) {
                if (expiresAt >= customRange.start && expiresAt <= customRange.end) {
                    const pts = Number(data.remainingPoints);
                    customRange.points += pts;
                    customRange.money += (pts * pointValue);
                    customRange.count++;
                }
            }
        });

        const summary = {
            totalPoints: Object.values(intervals).reduce((acc, b) => acc + b.points, 0),
            totalMoney: Object.values(intervals).reduce((acc, b) => acc + b.money, 0),
            intervals: Object.entries(intervals).map(([key, val]) => ({ key, ...val })),
            customRange: customRange.active ? {
                points: customRange.points,
                money: customRange.money,
                count: customRange.count,
                start: customStartStr,
                end: customEndStr
            } : null
        };

        return res.status(200).json({ ok: true, summary, pointValue });

    } catch (error) {
        console.error("Forecast Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
