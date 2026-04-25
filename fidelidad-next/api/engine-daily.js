import admin from "firebase-admin";

function initFirebase() {
    if (!admin.apps.length) {
        const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
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
    const cronHeader = req.headers["x-vercel-cron"];
    const SECRET = process.env.API_SECRET_KEY;

    if (!cronHeader && (!authHeader || !authHeader.includes(SECRET))) {
        return res.status(401).json({ error: "Unauthorized" });
    }

    try {
        const simulatedDate = req.body?.simulatedDate || req.query?.simulatedDate;
        const triggerSource = req.body?.source || req.query?.source || 'Sistema (QStash)';
        const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;

        const results = { expirations: null, petAlerts: null };

        // Llamada simple al motor de expiraciones con el gatillo (source)
        try {
            const expRes = await fetch(`${PWA_URL}/api/expirations`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET },
                body: JSON.stringify({ simulatedDate, source: triggerSource })
            });
            results.expirations = await expRes.json();
        } catch (e) { console.error("Error calling expirations:", e); }

        // 2. Ejecutar Alertas de Alimento (Pet Shop)
        try {
            const petRes = await fetch(`${PWA_URL}/api/pet-alerts`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET },
                body: JSON.stringify({ simulatedDate, source: triggerSource })
            });
            results.petAlerts = await petRes.json();
        } catch (e) { console.error("Error calling pet-alerts:", e); }

        return res.status(200).json({ ok: true, results });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
