/**
 * 💎 ENSAYO GENERAL DE AVISOS (RAMPET)
 * Este script prepara un cliente "desde 0" con todas las condiciones para disparar:
 * 1. Cumpleaños (Hoy)
 * 2. Vencimiento Próximo (En 3 días)
 * 3. Alerta de Alimento (Hoy)
 * 4. Campaña de Marketing (Hoy)
 * 
 * Uso: node scripts/ensayo-general.js
 */

import admin from "firebase-admin";
import dotenv from "dotenv";
import fs from "fs";
import { resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

// Cargar variables de entorno
dotenv.config({ path: ".env.local" });

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Inicialización Firebase Admin
let creds;
try {
    const devCredsRaw = fs.readFileSync(resolve(__dirname, "../.dev_creds.json"), "utf8");
    const devCreds = JSON.parse(devCredsRaw);
    creds = JSON.parse(devCreds.credentials);
    console.log("📂 Cargando credenciales desde .dev_creds.json...");
} catch (e) {
    console.log("⚠️ No se pudo cargar .dev_creds.json, intentando .env.local...");
    const credsRaw = (process.env.GOOGLE_CREDENTIALS_JSON || "").trim();
    if (!credsRaw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON en .env.local");
    try { 
        creds = JSON.parse(credsRaw); 
    } catch { 
        creds = JSON.parse(credsRaw.replace(/\\n/g, "\n")); 
    }
}

if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: creds.project_id,
            clientEmail: creds.client_email,
            privateKey: creds.private_key?.replace(/\\n/g, "\n"),
        }),
    });
}

const db = admin.firestore();

async function runEnsayo() {
    console.log("🚀 Iniciando Ensayo General de Avisos...\n");

    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    
    const threeDaysLater = new Date(now);
    threeDaysLater.setDate(now.getDate() + 3);
    const threeDaysStr = threeDaysLater.toISOString().split('T')[0];

    const twentySevenDaysAgo = new Date(now);
    twentySevenDaysAgo.setDate(now.getDate() - 27);
    const twentySevenDaysStr = twentySevenDaysAgo.toISOString().split('T')[0];

    const TEST_USER_ID = "socio_ensayo_maestro";

    // 1. LIMPIAR/CREAR SOCIO DE ENSAYO
    console.log("👤 Preparando Socio Ensayo Maestro...");
    await db.collection('users').doc(TEST_USER_ID).set({
        nombre: "Socio Ensayo Maestro 💎",
        email: process.env.SMTP_USER || "test@example.com",
        dni: "00000000",
        phone: "5491100000000",
        role: "client",
        points: 2500,
        birthDate: `1995-${todayMD}`,
        nextExpirationDate: threeDaysStr,
        nextExpirationAmount: 500,
        fcmTokens: ["MOCK_TOKEN_ENSAYO_123"],
        pets: [
            {
                name: "Firulais Ensayo",
                foodBrand: "Pro Plan Adulto",
                lastPurchaseDate: twentySevenDaysStr, // Hace 27 días
                foodCycleDays: 30, // Alerta debería disparar hoy (3 días antes)
                lastFoodAlertDate: null
            }
        ],
        lastBirthdayGreetingYear: "2020", // Forzar que no haya saludado este año
        lastBirthdayPointsYear: "2020",
        lastExpirationWarningDates: {},
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    });

    // Agregar un registro al historial de puntos para que el motor de vencimiento sea feliz
    await db.collection('users').doc(TEST_USER_ID).collection('points_history').add({
        amount: 500,
        concept: "Puntos de prueba para vencimiento",
        type: "credit",
        date: admin.firestore.Timestamp.fromDate(now),
        expiresAt: admin.firestore.Timestamp.fromDate(threeDaysLater),
        status: "active",
        remainingPoints: 500
    });

    console.log("✅ Socio creado con éxito.");

    // 2. PREPARAR CAMPAÑA
    console.log("\n📢 Preparando Campaña de Ensayo...");
    const CAMP_ID = "campana_ensayo_general";
    await db.collection('campanas').doc(CAMP_ID).set({
        name: "🚀 Super Oferta Ensayo General",
        title: "¡Solo por hoy! 50% de descuento",
        description: "Aprovechá esta oferta exclusiva para socios VIP de ensayo.",
        active: true,
        autoBroadcast: true,
        startDate: todayStr,
        endDate: todayStr,
        isFlash: false,
        daysOfWeek: [now.getDay()], // Hoy
        broadcastSentAt: null, // Forzar envío
        link: "/canjes"
    });
    console.log("✅ Campaña preparada.");

    // 3. DISPARAR MOTORES
    console.log("\n⚙️  Disparando Motores (Simulación)...");
    
    // Importar dinámicamente los handlers
    const { default: engineDaily } = await import("../api/engine-daily.js");
    const { default: engineCampaigns } = await import("../api/engine-campaigns.js");

    const mockRes = {
        status: (code) => ({
            json: (data) => {
                console.log(`\n📥 Respuesta del Motor (${code}):`, JSON.stringify(data, null, 2));
                return { end: () => {} };
            },
            end: () => {}
        })
    };

    console.log("\n--- EJECUTANDO ENGINE DAILY ---");
    await engineDaily({
        method: 'GET',
        query: { trigger: 'ensayo_manual', ignoreDeduplication: 'true' },
        headers: { 'authorization': `Bearer ${process.env.API_SECRET_KEY}` }
    }, mockRes);

    console.log("\n--- EJECUTANDO ENGINE CAMPAIGNS ---");
    await engineCampaigns({
        method: 'POST',
        query: { trigger: 'ensayo_manual', ignoreDeduplication: 'true' },
        body: { trigger: 'ensayo_manual', isManual: true },
        headers: { 'x-api-key': process.env.API_SECRET_KEY }
    }, mockRes);

    console.log("\n✨ Ensayo finalizado. Revisá los audit_logs y el inbox del Socio Ensayo Maestro.");
}

runEnsayo().catch(console.error);
