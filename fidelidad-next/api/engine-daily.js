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
    try {
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};

        const effectiveDate = await getEffectiveDate(db, simulatedDate);
        const arMD = `${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`;
        const todayStr = effectiveDate.toISOString().split('T')[0];
        
        const winEnd = new Date(effectiveDate);
        winEnd.setDate(winEnd.getDate() + 30);
        const winEndStr = winEnd.toISOString().split('T')[0];

        // Optimization: Try to filter by points > 0 to reduce scan size for expirations
        // But birthday needs full scan unless we have an index on birthDate.
        const usersSnap = await db.collection('users').get();

        const birthdayList = [];
        const expirationList = [];
        const petAlertList = [];

        usersSnap.forEach(d => {
            const data = d.data();
            if (data.role === 'admin' || data.isTestUser) return;

            // Cumpleaños
            const bd = data.birthDate || data.fechaNacimiento;
            if (bd && bd.endsWith(arMD)) {
                birthdayList.push({
                    id: d.id,
                    name: data.name || data.nombre || 'Socio',
                    phone: data.phone || data.telefono || '',
                    dni: data.dni || '',
                    socioNumber: data.socioNumber || data.numeroSocio || '',
                });
            }

            // Vencimientos (ventana 30 días)
            if (data.nextExpirationDate && data.nextExpirationDate >= todayStr && data.nextExpirationDate <= winEndStr) {
                if ((data.points || 0) > 0) {
                    expirationList.push({
                        id: d.id,
                        name: data.name || data.nombre || 'Socio',
                        phone: data.phone || data.telefono || '',
                        points: data.points || 0,
                        nextExpirationDate: data.nextExpirationDate,
                    });
                }
            }

            if (data.pets && Array.isArray(data.pets)) {
                data.pets.forEach(p => {
                    let isAlertDay = (p.nextFoodAlertDate === todayStr);
                    
                    // Fallback dinámico si falta el campo o para mayor precisión
                    if (!isAlertDay && p.lastPurchaseDate && p.frequencyDays) {
                        const lastP = p.lastPurchaseDate.toDate ? p.lastPurchaseDate.toDate() : new Date(p.lastPurchaseDate);
                        const freq = Number(p.frequencyDays);
                        const lead = Number(config.petFoodAlertLeadDays || 0);
                        
                        const exDate = new Date(lastP);
                        exDate.setDate(lastP.getDate() + freq);
                        const alDate = new Date(exDate);
                        alDate.setDate(exDate.getDate() - lead);
                        
                        if (alDate.toISOString().split('T')[0] === todayStr) {
                            isAlertDay = true;
                        }
                    }

                    if (isAlertDay) {
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

        return { birthdayList, expirationList, petAlertList, config };
    } catch (error) {
        console.error("[Engine] buildExtensionLists error:", error.message);
        return { birthdayList: [], expirationList: [], petAlertList: [], config: {} };
    }
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

        console.log(`[Engine] Triggered by ${triggerSource} with mode ${target}. Simulated Date: ${simulatedDate || 'None'}`);

        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) throw new Error("General config not found");
        const configData = configSnap.data();
        const systemEnableDuplicateControl = configData?.enableDuplicateControl !== false;

        // --- CONTROL DE DUPLICIDAD (Safety Wall) ---
        if (!ignoreDeduplication && systemEnableDuplicateControl) {
            try {
                const arFormatter = new Intl.DateTimeFormat('en-CA', {
                    timeZone: 'America/Argentina/Buenos_Aires',
                    year: 'numeric', month: '2-digit', day: '2-digit'
                });
                const todayAR = arFormatter.format(new Date());
                const checkSnap = await db.collection('config').doc('dailyCheck').get();
                const lastRunDate = checkSnap.exists ? checkSnap.data()?.[`lastRun_${target}`] : null;

                // Si hay fecha simulada, saltamos el bloqueo para permitir pruebas
                if (lastRunDate === todayAR && !simulatedDate) {
                    console.log(`[Engine] Skip: Already run today (${todayAR}) for target ${target}`);
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
            } catch (e) {
                console.warn("[Engine] Deduplication check failed, proceeding anyway:", e.message);
            }
        }

        // --- PROCESAMIENTO CONCURRENTE (Previene Vercel Timeout) ---
        const results = { birthdays: null, expirations: null, petAlerts: null };
        const subRequests = [];

        const requestHeaders = { 
            'Content-Type': 'application/json', 
            'x-api-key': SECRET 
        };
        const requestBody = JSON.stringify({ simulatedDate, source: triggerSource, silent: isSilent, ignoreDeduplication });

        // Helper to fetch and catch
        const callSubApi = async (path, key) => {
            const url = `${PWA_URL}${path}`;
            console.log(`[Engine] Calling sub-api: ${url}`);
            try {
                const subRes = await fetch(url, {
                    method: 'POST',
                    headers: requestHeaders,
                    body: requestBody
                });
                const contentType = subRes.headers.get("content-type");
                if (contentType && contentType.includes("application/json")) {
                    results[key] = await subRes.json();
                } else {
                    const text = await subRes.text();
                    results[key] = { ok: false, error: "Non-JSON response", status: subRes.status, body: text.substring(0, 200) };
                    console.error(`[Engine] Sub-API ${key} returned non-JSON (${subRes.status}):`, text.substring(0, 100));
                }
            } catch (err) {
                console.error(`[Engine] Failed to call ${key} at ${url}:`, err.message);
                results[key] = { ok: false, error: err.message };
            }
        };

        // 1. Cumpleaños
        if (target === 'all' || target === 'birthdays') {
            subRequests.push(callSubApi('/api/birthdays', 'birthdays'));
        }

        // 2. Expiraciones
        if (target === 'all' || target === 'expirations') {
            subRequests.push(callSubApi('/api/expirations', 'expirations'));
        }

        // 3. Alertas Pet
        if (target === 'all' || target === 'pet-alerts') {
            subRequests.push(callSubApi('/api/pet-alerts', 'petAlerts'));
        }

        // Ejecutar todo en paralelo
        await Promise.all(subRequests);

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
        } catch (e) { console.error("[Engine] Could not set daily check lock", e.message); }

        // --- RESPUESTA FORMATO EXTENSIÓN ---
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
        console.error("[Engine] Fatal Error:", error);
        return res.status(500).json({ error: error.message, stack: error.stack });
    }
}
