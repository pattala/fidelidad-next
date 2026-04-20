
import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { buildHtmlLayout } from "../utils/emailLayout.js";

// ---------- Inicialización Firebase Admin ----------
function initFirebaseAdmin() {
    try {
        if (!admin.apps.length) {
            const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
            if (!credsRaw) throw new Error("Missing environment credentials.");
            
            let creds;
            try { creds = JSON.parse(credsRaw); } 
            catch (err) { creds = JSON.parse(credsRaw.replace(/\\n/g, "\n")); }
            
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: creds.project_id,
                    clientEmail: creds.client_email,
                    privateKey: creds.private_key?.replace(/\\n/g, "\n"),
                }),
            });
        }
        return admin;
    } catch (error) {
        console.error("[PetAlerts] Init Error:", error.message);
        throw error;
    }
}

// ---------- Nodemailer ----------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function getAbsoluteUrl(url, baseUrl) {
    if (!url) return "";
    if (url.startsWith("http")) return url;
    const base = (baseUrl || "").replace(/\/$/, "");
    return `${base}${url.startsWith("/") ? url : `/${url}`}`;
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const cronHeader = req.headers["x-vercel-cron"] || req.headers["X-Vercel-Cron"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    if (!cronHeader && (!authHeader || !SECRET || !authHeader.includes(SECRET))) {
        return res.status(401).json({ ok: false, error: "Unauthorized" });
    }

    const app = initFirebaseAdmin();
    const db = app.firestore();

    const configSnap = await db.collection('config').doc('general').get();
    if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
    const config = configSnap.data();

    if (!config.enablePetModule) {
        return res.status(200).json({ ok: true, message: "Pet module is disabled" });
    }

    const simCfg = config.simulationConfig || { birthdays: true, expirations: true, petAlerts: true, campaigns: true };
    const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
    const referenceDate = (simulatedDateStr && simCfg.petAlerts) ? new Date(simulatedDateStr) : new Date();
    const todayStr = referenceDate.toISOString().split('T')[0];

    const results = {
        scanned: 0,
        notified: 0,
        details: [],
        errors: []
    };

    try {
        // Query users with pets
        const usersSnap = await db.collection('users').where('pets', '!=', null).get();
        results.scanned = usersSnap.size;

        for (const userDoc of usersSnap.docs) {
            const userData = userDoc.data();
            const pets = userData.pets || [];
            if (!Array.isArray(pets)) continue;

            for (let i = 0; i < pets.length; i++) {
                const pet = pets[i];
                if (!pet.receiveAlerts || !pet.lastPurchaseDate || !pet.frequencyDays) continue;

                const lastPurchase = pet.lastPurchaseDate.toDate ? pet.lastPurchaseDate.toDate() : new Date(pet.lastPurchaseDate);
                const leadDays = Number(config.petFoodAlertLeadDays || 0);
                
                // exhaustionDate: Cuando se acaba el alimento definitivamente
                const exhaustionDate = new Date(lastPurchase);
                exhaustionDate.setDate(lastPurchase.getDate() + Number(pet.frequencyDays));
                
                // alertDate: Cuando enviamos el aviso (exhaustion - leadDays)
                const alertDate = new Date(exhaustionDate);
                alertDate.setDate(exhaustionDate.getDate() - leadDays);

                const alertDateStr = alertDate.toISOString().split('T')[0];

                if (todayStr === alertDateStr) {
                    // Check if already notified today for this pet
                    const alertId = `petfood_${userDoc.id}_${pet.id}_${alertDateStr}`;
                    // (Optional: Implement a log check to avoid duplicates)
                    
                    try {
                        const template = config.messaging?.templates?.petFoodAlert || "¡Hola {nombre}! 🐾 Notamos que a {mascota} se le debe estar terminando su {marca}. ¡No olvides pasar por {siteName}!";
                        const msg = template
                            .replace(/{nombre}/g, (userData.name || '').split(' ')[0])
                            .replace(/{mascota}/g, pet.name)
                            .replace(/{marca}/g, pet.foodBrand || pet.brand || 'alimento')
                            .replace(/{siteName}/g, config.siteName || 'Petshop');

                        const title = "🐾 Aviso de Alimento";
                        const eventConfig = config.messaging?.eventConfigs?.petFoodAlert || { channels: ['push', 'inbox'] };

                        // Send Push
                        if (eventConfig.channels.includes('push') && userData.fcmTokens?.length) {
                             const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                             const icon = getAbsoluteUrl(config.logoUrl || "/pwa-192x192.png", PWA_URL);
                             await app.messaging().sendEachForMulticast({
                                 tokens: Array.from(new Set(userData.fcmTokens)),
                                 data: { title, body: msg, url: "/profile", icon, type: "pet_alert" }
                             });
                        }

                        // Send Email
                        if (eventConfig.channels.includes('email') && userData.email) {
                             const innerHtml = `<div style="color: #333;"><h2 style="color: #f97316;">${title}</h2><p>${msg}</p></div>`;
                             await transporter.sendMail({ 
                                 from: `"${config.siteName}" <${process.env.SMTP_USER}>`, 
                                 to: userData.email, 
                                 subject: title, 
                                 html: buildHtmlLayout(innerHtml, config) 
                             });
                        }

                        // Inbox
                        if (eventConfig.channels.includes('inbox')) {
                             await userDoc.ref.collection('inbox').add({
                                 title, body: msg, url: "/profile", type: "pet_alert",
                                 read: false, date: admin.firestore.FieldValue.serverTimestamp()
                             });
                        }

                        results.notified++;
                        results.details.push({ user: userData.name, pet: pet.name, status: "sent" });

                    } catch (err) {
                        results.errors.push(`${userDoc.id}-${pet.name}: ${err.message}`);
                    }
                }
            }
        }

        return res.status(200).json({ ok: true, results });

    } catch (error) {
        console.error("[PetAlerts] Fatal Error:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
