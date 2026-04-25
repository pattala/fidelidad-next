import admin from "firebase-admin";

function initFirebaseAdmin() {
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
    return admin;
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
        const triggerSource = req.body?.source || req.query?.source || req.query?.trigger || 'Sistema (QStash)';
        const isSilent = req.body?.silent === true || req.query?.silent === 'true';
        const ignoreDeduplication = req.body?.ignoreDeduplication === true;
        const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
        const target = req.query?.target || 'all'; // 'birthdays', 'expirations', 'pet-alerts', 'all'
        
        const app = initFirebaseAdmin();
        const db = app.firestore();
        
        const configSnap = await db.collection('config').doc('general').get();
        const systemEnableDuplicateControl = configSnap.data()?.enableDuplicateControl !== false;

        // --- CONTROL DE DUPLICIDAD (Safety Wall) ---
        // Se respeta la orden por request manual, o el default global si es cron (systemEnableDuplicateControl)
        if (!ignoreDeduplication && systemEnableDuplicateControl) {
            const arFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
                year: 'numeric', month: '2-digit', day: '2-digit'
            });
            const todayAR = arFormatter.format(new Date());
            const checkSnap = await db.collection('config').doc('dailyCheck').get();
            const lastRunDate = checkSnap.exists ? checkSnap.data()?.[`lastRun_${target}`] : null;

            if (lastRunDate === todayAR) {
                return res.status(200).json({
                    ok: true,
                    skipped: true,
                    message: `Proceso '${target}' ya fue ejecutado exitosamente hoy (${todayAR}). Control de duplicidad activo.`
                });
            }
        }

        const results = { birthdays: null, expirations: null, petAlerts: null };

        // 1. Ejecutar Cumpleaños
        if (target === 'all' || target === 'birthdays') {
            try {
                const bRes = await fetch(`${PWA_URL}/api/birthdays`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET },
                    body: JSON.stringify({ simulatedDate, source: triggerSource, silent: isSilent, ignoreDeduplication })
                });
                results.birthdays = await bRes.json();
            } catch (e) { console.error("Error calling birthdays:", e); }
        }

        // 2. Ejecutar Expiraciones
        if (target === 'all' || target === 'expirations') {
            try {
                const expRes = await fetch(`${PWA_URL}/api/expirations`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET },
                    body: JSON.stringify({ simulatedDate, source: triggerSource, silent: isSilent, ignoreDeduplication })
                });
                results.expirations = await expRes.json();
            } catch (e) { console.error("Error calling expirations:", e); }
        }

        // 3. Ejecutar Alertas de Alimento (Pet Shop)
        if (target === 'all' || target === 'pet-alerts' || target === 'expirations') {
            try {
                const petRes = await fetch(`${PWA_URL}/api/pet-alerts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET },
                    body: JSON.stringify({ simulatedDate, source: triggerSource, silent: isSilent, ignoreDeduplication })
                });
                results.petAlerts = await petRes.json();
            } catch (e) { console.error("Error calling pet-alerts:", e); }
        }

        // --- GUARDAR ESTADO DE EJECUCIÓN (Si no fue skippeado) ---
        try {
            const arFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
                year: 'numeric', month: '2-digit', day: '2-digit'
            });
            await db.collection('config').doc('dailyCheck').set({
                [`lastRun_${target}`]: arFormatter.format(new Date()),
                [`lastRunTimestamp_${target}`]: admin.firestore.FieldValue.serverTimestamp(),
            }, { merge: true });
        } catch (e) { console.error("Could not set daily check lock", e); }

        // Remapear al formato que espera la extensión de Chrome:
        // data.birthdays.list, data.expirations.list, data.petAlerts.list, data.config
        const configSnap2 = await db.collection('config').doc('general').get();
        const extensionConfig = configSnap2.data() || {};

        return res.status(200).json({
            ok: true,
            results,
            // Formato legible por la extensión
            birthdays:  { list: results.birthdays?.summary?.list  || [] },
            expirations:{ list: results.expirations?.summary?.list || [] },
            petAlerts:  { list: results.petAlerts?.results?.list  || [] },
            config: extensionConfig,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
