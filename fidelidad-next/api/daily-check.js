// /api/daily-check.js
// Disparador diario unificado: cumpleaños + vencimientos.
// Se llama desde la extensión Chrome Y/O el Dashboard admin.
// Usa deduplicación en Firestore para correr solo 1 vez por día.

import admin from "firebase-admin";

// ---------- Firebase Admin ----------
function initFirebaseAdmin() {
    if (admin.apps.length) return admin;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");
    let sa;
    try { sa = JSON.parse(raw); } catch { sa = JSON.parse(Buffer.from(raw, 'base64').toString()); }
    admin.initializeApp({ credential: admin.credential.cert(sa) });
    return admin;
}

export default async function handler(req, res) {
    // ---------- Auth ----------
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const SECRET = (process.env.API_SECRET_KEY || process.env.MI_API_SECRET || process.env.VITE_API_KEY || "").trim();

    let isAuthorized = false;
    let executorEmail = 'daily-check';

    // Bearer token
    const bearerHeader = req.headers["authorization"] || "";
    if (bearerHeader.startsWith("Bearer ")) {
        try {
            const decoded = await initFirebaseAdmin().auth().verifyIdToken(bearerHeader.split("Bearer ")[1]);
            executorEmail = decoded.email || decoded.uid;
            isAuthorized = true;
        } catch (e) {
            console.error("[DailyCheck] Token verification failed:", e.message);
        }
    }

    // API Key fallback
    if (!isAuthorized && authHeader && SECRET && authHeader.includes(SECRET)) {
        isAuthorized = true;
        executorEmail = 'extension/dashboard';
    }

    if (!isAuthorized) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    // ---------- Deduplicación ----------
    const app = initFirebaseAdmin();
    const db = app.firestore();

    // Fecha de hoy en zona AR (YYYY-MM-DD)
    const now = new Date();
    const arFormatter = new Intl.DateTimeFormat('en-CA', { // en-CA da formato YYYY-MM-DD
        timeZone: 'America/Argentina/Buenos_Aires',
        year: 'numeric', month: '2-digit', day: '2-digit'
    });
    const todayAR = arFormatter.format(now); // "2026-02-25"

    const checkRef = db.collection('config').doc('dailyCheck');
    const checkSnap = await checkRef.get();
    const lastRun = checkSnap.exists ? checkSnap.data()?.lastRunDate : null;

    if (lastRun === todayAR) {
        console.log(`[DailyCheck] Ya se ejecutó hoy (${todayAR}). Saltando.`);
        return res.status(200).json({
            ok: true,
            skipped: true,
            message: `Ya se ejecutó hoy (${todayAR})`,
            lastRun: todayAR
        });
    }

    console.log(`[DailyCheck] Ejecutando para ${todayAR}. Última ejecución: ${lastRun || 'nunca'}`);

    // ---------- Ejecutar ambos procesos ----------
    const results = { birthdays: null, expirations: null };
    const currentHost = req.headers.host;
    const baseUrl = currentHost
        ? `https://${currentHost}`
        : (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : 'http://localhost:3000');

    // Headers para las llamadas internas
    const internalHeaders = {
        'Content-Type': 'application/json',
        'x-api-key': SECRET,
        'x-api-secret': SECRET,
        'x-executor-role': 'system'
    };

    // 1. Cumpleaños
    try {
        const bRes = await fetch(`${baseUrl}/api/check-birthdays`, {
            method: 'POST',
            headers: internalHeaders
        });
        results.birthdays = await bRes.json();
        console.log("[DailyCheck] Cumpleaños:", JSON.stringify(results.birthdays).substring(0, 200));
    } catch (e) {
        console.error("[DailyCheck] Error en cumpleaños:", e.message);
        results.birthdays = { ok: false, error: e.message };
    }

    // 2. Vencimientos
    try {
        const eRes = await fetch(`${baseUrl}/api/check-expirations`, {
            method: 'POST',
            headers: internalHeaders
        });
        results.expirations = await eRes.json();
        console.log("[DailyCheck] Vencimientos:", JSON.stringify(results.expirations).substring(0, 200));
    } catch (e) {
        console.error("[DailyCheck] Error en vencimientos:", e.message);
        results.expirations = { ok: false, error: e.message };
    }

    // ---------- Marcar como ejecutado ----------
    await checkRef.set({
        lastRunDate: todayAR,
        lastRunTimestamp: admin.firestore.FieldValue.serverTimestamp(),
        executor: executorEmail,
        results: {
            birthdaysOk: results.birthdays?.ok || false,
            expirationsOk: results.expirations?.ok || false
        }
    }, { merge: true });

    console.log(`[DailyCheck] ✅ Completado para ${todayAR}`);

    return res.status(200).json({
        ok: true,
        skipped: false,
        date: todayAR,
        executor: executorEmail,
        results
    });
}
