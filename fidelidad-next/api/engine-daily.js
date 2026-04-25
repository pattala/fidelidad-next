import admin from "firebase-admin";
import { getEffectiveDate } from "../utils/timeUtils.js";

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

/**
 * Construye las listas de alertas para la extensión de Chrome directamente
 * desde Firestore, SIN modificar nada. Solo lectura.
 * Se llama tanto en ejecución normal como cuando hay deduplicación activa.
 */
async function buildExtensionLists(db, simulatedDate) {
    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data() || {};

    const effectiveDate = await getEffectiveDate(db, simulatedDate);

    const arMD = `${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`;
    const currentYear = effectiveDate.getFullYear().toString();
    const todayStr = effectiveDate.toISOString().split('T')[0];
    const winEnd = new Date(effectiveDate);
    winEnd.setDate(winEnd.getDate() + 30);
    const winEndStr = winEnd.toISOString().split('T')[0];

    const usersSnap = await db.collection('users').get();

    const birthdayList = [];
    const expirationList = [];
    const petAlertList = [];

    usersSnap.forEach(d => {
        const data = d.data();
        if (data.role === 'admin') return;

        // Cumpleaños
        const bd = data.birthDate || data.fechaNacimiento;
        if (bd && bd.endsWith(arMD)) {
            birthdayList.push({
                id: d.id,
                name: data.name || data.nombre || 'Socio',
                phone: data.phone || data.telefono || '',
                dni: data.dni || '',
                socioNumber: data.socioNumber || data.numeroSocio || '',
                lastBirthdayPointsYear: data.lastBirthdayPointsYear || '',
            });
        }

        // Vencimientos (ventana 30 días)
        if (data.nextExpirationDate && data.nextExpirationDate > todayStr && data.nextExpirationDate <= winEndStr) {
            if ((data.points || 0) > 0) {
                expirationList.push({
                    id: d.id,
                    name: data.name || data.nombre || 'Socio',
                    phone: data.phone || data.telefono || '',
                    points: data.points || 0,
                    nextExpirationDate: data.nextExpirationDate,
                    breakdown: data.pointsBreakdown || [],
                });
            }
        }

        // Alertas pet
        if (data.pets) {
            data.pets.forEach(p => {
                if (p.nextFoodAlertDate === todayStr) {
                    petAlertList.push({
                        id: d.id,
                        name: data.name || data.nombre || 'Socio',
                        phone: data.phone || data.telefono || '',
                        petName: p.name,
                        category: p.category || 'Mascota',
                    });
                }
            });
        }
    });

    return {
        birthdayList,
        expirationList,
        petAlertList,
        config,
    };
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
        const target = req.query?.target || 'all';

        const app = initFirebaseAdmin();
        const db = app.firestore();

        const configSnap = await db.collection('config').doc('general').get();
        const systemEnableDuplicateControl = configSnap.data()?.enableDuplicateControl !== false;

        // --- CONTROL DE DUPLICIDAD (Safety Wall) ---
        // Protege el RE-PROCESAMIENTO automático (puntos, push, email).
        // NUNCA bloquea la lectura de listas para la extensión de Chrome.
        if (!ignoreDeduplication && systemEnableDuplicateControl) {
            const arFormatter = new Intl.DateTimeFormat('en-CA', {
                timeZone: 'America/Argentina/Buenos_Aires',
                year: 'numeric', month: '2-digit', day: '2-digit'
            });
            const todayAR = arFormatter.format(new Date());
            const checkSnap = await db.collection('config').doc('dailyCheck').get();
            const lastRunDate = checkSnap.exists ? checkSnap.data()?.[`lastRun_${target}`] : null;

            if (lastRunDate === todayAR) {
                // Ya se ejecutó hoy → skip del procesamiento, PERO igual devolver listas para la burbuja
                const { birthdayList, expirationList, petAlertList, config } = await buildExtensionLists(db, simulatedDate);
                return res.status(200).json({
                    ok: true,
                    skipped: true,
                    message: `Proceso '${target}' ya ejecutado hoy (${todayAR}). Solo modo lectura.`,
                    birthdays:   { list: birthdayList },
                    expirations: { list: expirationList },
                    petAlerts:   { list: petAlertList },
                    config,
                });
            }
        }

        // --- PROCESAMIENTO NORMAL ---
        const results = { birthdays: null, expirations: null, petAlerts: null };

        // 1. Cumpleaños
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

        // 2. Expiraciones
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

        // 3. Alertas Pet
        if (target === 'all' || target === 'pet-alerts') {
            try {
                const petRes = await fetch(`${PWA_URL}/api/pet-alerts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET },
                    body: JSON.stringify({ simulatedDate, source: triggerSource, silent: isSilent, ignoreDeduplication })
                });
                results.petAlerts = await petRes.json();
            } catch (e) { console.error("Error calling pet-alerts:", e); }
        }

        // --- GUARDAR ESTADO DE EJECUCIÓN ---
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

        // --- RESPUESTA FORMATO EXTENSIÓN ---
        // La extensión de Chrome espera: data.birthdays.list, data.expirations.list, data.petAlerts.list, data.config
        const { birthdayList, expirationList, petAlertList, config } = await buildExtensionLists(db, simulatedDate);

        return res.status(200).json({
            ok: true,
            results,
            birthdays:   { list: birthdayList },
            expirations: { list: expirationList },
            petAlerts:   { list: petAlertList },
            config,
        });

    } catch (error) {
        return res.status(500).json({ error: error.message });
    }
}
