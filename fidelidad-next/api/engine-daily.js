import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { buildHtmlLayout } from "../utils/emailLayout.js";
import { getEffectiveDate } from "../utils/timeUtils.js";

// ---------- Inicialización Firebase Admin ----------
function initFirebaseAdmin() {
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
    return admin;
}

// ---------- Nodemailer ----------
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
    tls: { rejectUnauthorized: false }
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

    try {
        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
        const triggerSource = req.body?.source || req.query?.source || req.query?.trigger || 'auto';
        
        // Usamos la utilidad centralizada para respetar el Simulador
        const referenceDate = await getEffectiveDate(db, simulatedDateStr);
        const todayStr = referenceDate.toISOString().split('T')[0];
        const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
        const currentYear = referenceDate.getFullYear().toString();
        
        const results = {
            birthdays: 0,
            expirations: 0,
            petAlerts: 0,
            details: [],
            errors: []
        };

        // Identificación del Ejecutor para Auditoría
        let executorDetail = "Sistema (Auto)";
        if (cronHeader) executorDetail = "Sistema (Vercel Cron)";
        else if (req.headers["x-qstash-signature"]) executorDetail = "Sistema (QStash)";
        else if (triggerSource === 'dashboard') executorDetail = "Administrador (Panel)";
        else if (triggerSource === 'extension') executorDetail = "Administrador (Extensión)";

        // 1. PROCESAR CUMPLEAÑOS
        const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
        const birthdayUsers = usersSnap.docs.filter(doc => doc.data().birthDate?.endsWith(todayMD));

        for (const userDoc of birthdayUsers) {
            try {
                const userData = userDoc.data();
                if (userData.lastBirthdayGreetingYear === currentYear) continue;

                const birthdayPoints = Number(config?.birthdayPoints || 100);
                const autoBonusEnabled = config?.enableBirthdayBonus === true;
                const autoMessageEnabled = config?.enableBirthdayMessage !== false;

                let pointsAdded = 0;
                let actionsTaken = [];

                // Acreditar puntos si corresponde
                if (autoBonusEnabled && userData.lastBirthdayPointsYear !== currentYear) {
                    const historyRef = userDoc.ref.collection('points_history');
                    let expirationDate = new Date(referenceDate);
                    expirationDate.setDate(expirationDate.getDate() + 365);

                    await historyRef.add({
                        amount: birthdayPoints,
                        concept: '🎂 ¡Feliz Cumpleaños! Regalo del Club',
                        date: admin.firestore.Timestamp.fromDate(referenceDate),
                        type: 'credit',
                        expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                        remainingPoints: birthdayPoints,
                        balanceAfter: (Number(userData.points) || 0) + birthdayPoints
                    });

                    await userDoc.ref.update({
                        points: admin.firestore.FieldValue.increment(birthdayPoints),
                        lastBirthdayPointsYear: currentYear
                    });
                    pointsAdded = birthdayPoints;
                    actionsTaken.push("puntos_acreditados");
                }

                // Enviar Saludo (Push/Email/Inbox)
                if (autoMessageEnabled) {
                    const templateFull = config?.messaging?.templates?.birthday || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día. Te regalamos {puntos} puntos.";
                    const templateSimple = config?.messaging?.templates?.birthdaySimple || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día.";
                    const template = (pointsAdded > 0) ? templateFull : templateSimple;
                    const msg = template
                        .replace(/{nombre}/g, (userData.nombre || userData.name || '').split(' ')[0])
                        .replace(/{puntos}/g, birthdayPoints.toString());
                    const title = "¡Feliz Cumpleaños! 🎂";

                    // Push
                    if (userData.fcmTokens?.length) {
                        const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                        await app.messaging().sendEachForMulticast({
                            tokens: userData.fcmTokens,
                            data: { title, body: msg, url: "/profile", icon: config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "" }
                        }).catch(() => {});
                        actionsTaken.push("push_enviado");
                    }

                    // Email
                    if (userData.email && process.env.SMTP_USER) {
                        const innerHtml = `<div style="color: #333;"><h2 style="color: #db2777; margin-top: 0;">${title}</h2><p style="font-size: 16px; line-height: 1.6;">${msg}</p></div>`;
                        await transporter.sendMail({
                            from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                            to: userData.email, subject: title, html: buildHtmlLayout(innerHtml, config)
                        }).catch(() => {});
                        actionsTaken.push("email_enviado");
                    }

                    // Inbox
                    await userDoc.ref.collection('inbox').add({
                        title, body: msg, url: "/profile", type: "birthday", read: false,
                        date: admin.firestore.Timestamp.fromDate(referenceDate)
                    });
                    actionsTaken.push("inbox_guardado");

                    await userDoc.ref.update({ lastBirthdayGreetingYear: currentYear });
                }

                results.birthdays++;
                results.details.push({
                    userId: userDoc.id,
                    userName: userData.nombre || userData.name || 'Socio',
                    socioNumber: userData.socioNumber || userData.numeroSocio || '',
                    dni: userData.dni || '',
                    action: "birthday_greeting",
                    status: "success",
                    info: pointsAdded > 0 ? `Saludo + ${pointsAdded} pts` : 'Solo saludo'
                });

            } catch (e) { results.errors.push(`Birthday ${userDoc.id}: ${e.message}`); }
        }

        // 2. PROCESAR VENCIMIENTOS
        const toExpireSnap = await db.collection('users').where('nextExpirationDate', '<=', todayStr).get();
        for (const doc of toExpireSnap.docs) {
            try {
                const userData = doc.data();
                const history = doc.ref.collection('points_history');
                const expiredItems = await history.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(referenceDate)).get();
                
                let total = 0;
                const batch = db.batch();
                expiredItems.docs.forEach(d => {
                    const data = d.data();
                    if (data.status === 'expired') return;
                    const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
                    if (data.type === 'credit' && rem > 0) {
                        total += rem;
                        batch.update(d.ref, { status: 'expired', remainingPoints: 0 });
                    }
                });

                if (total > 0) {
                    batch.update(doc.ref, { 
                        points: admin.firestore.FieldValue.increment(-total),
                        nextExpirationDate: null // Se recalculará en el próximo login o proceso
                    });
                    batch.set(history.doc(), { 
                        amount: -total, 
                        concept: 'Vencimiento automático de puntos acumulados (Auto)', 
                        date: admin.firestore.FieldValue.serverTimestamp(), 
                        type: 'debit' 
                    });
                    await batch.commit();
                    
                    results.expirations++;
                    results.details.push({
                        userId: doc.id,
                        userName: userData.nombre || userData.name || 'Socio',
                        socioNumber: userData.socioNumber || userData.numeroSocio || '',
                        dni: userData.dni || '',
                        action: "points_expired",
                        status: "success",
                        info: `-${total} pts vencidos`
                    });
                }
            } catch (e) { results.errors.push(`Expiration ${doc.id}: ${e.message}`); }
        }

        // 3. PROCESAR ALERTAS DE MASCOTAS (PETSHOP)
        if (config.enablePetModule) {
            const petUsersSnap = await db.collection('users').where('pets', '!=', null).get();
            for (const userDoc of petUsersSnap.docs) {
                try {
                    const userData = userDoc.data();
                    const pets = userData.pets || [];
                    let updatedPets = false;
                    const nextPets = [...pets];

                    for (let i = 0; i < nextPets.length; i++) {
                        const pet = nextPets[i];
                        if (!pet.receiveAlerts || !pet.lastPurchaseDate || !pet.frequencyDays) continue;

                        const lastPurchase = pet.lastPurchaseDate.toDate ? pet.lastPurchaseDate.toDate() : new Date(pet.lastPurchaseDate);
                        const leadDays = Number(config.petFoodAlertLeadDays || 0);
                        const exhaustionDate = new Date(lastPurchase);
                        exhaustionDate.setDate(lastPurchase.getDate() + Number(pet.frequencyDays));
                        const alertDate = new Date(exhaustionDate);
                        alertDate.setDate(exhaustionDate.getDate() - leadDays);

                        const diffDays = Math.floor((referenceDate.getTime() - alertDate.getTime()) / (1000 * 60 * 60 * 24));
                        const isAlertDay = (diffDays >= 0 && diffDays <= 4); 

                        if (isAlertDay && pet.lastFoodAlertDate !== lastPurchase.toISOString().split('T')[0]) {
                            const userName = (userData.nombre || userData.name || '').split(' ')[0];
                            const template = config.messaging?.templates?.petFoodAlert || "¡Hola {nombre}! 🐾 Notamos que a {mascota} se le debe estar terminando su {marca}.";
                            const msg = template
                                .replace(/{nombre}/g, userName)
                                .replace(/{mascota}/g, pet.name)
                                .replace(/{marca}/g, pet.foodBrand || pet.brand || 'alimento');

                            // Send Push/Email/Inbox (simplificado para brevedad)
                            if (userData.fcmTokens?.length) {
                                await app.messaging().sendEachForMulticast({
                                    tokens: userData.fcmTokens,
                                    data: { title: "🐾 Aviso de Alimento", body: msg, url: "/profile", type: "pet_alert" }
                                }).catch(() => {});
                            }
                            
                            await userDoc.ref.collection('inbox').add({
                                title: "🐾 Aviso de Alimento", body: msg, url: "/profile", type: "pet_alert",
                                read: false, date: admin.firestore.Timestamp.fromDate(referenceDate)
                            });

                            nextPets[i].lastFoodAlertDate = lastPurchase.toISOString().split('T')[0];
                            updatedPets = true;
                            
                            results.petAlerts++;
                            results.details.push({
                                userId: userDoc.id,
                                userName: userData.nombre || userData.name || 'Socio',
                                socioNumber: userData.socioNumber || userData.numeroSocio || '',
                                dni: userData.dni || '',
                                action: "pet_food_alert",
                                status: "success",
                                info: `Mascota: ${pet.name} (${pet.foodBrand || 'Alimento'})`
                            });
                        }
                    }
                    if (updatedPets) await userDoc.ref.update({ pets: nextPets });
                } catch (e) { results.errors.push(`Pet ${userDoc.id}: ${e.message}`); }
            }
        }

        // AUDITORÍA FINAL CONSOLIDADA
        await db.collection('audit_logs').add({
            type: 'engine_daily_unified',
            status: results.errors.length > 0 ? 'partial' : 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            executor: executorDetail,
            summary: `Motor Maestro V.1.3.6: ${results.birthdays} cumple, ${results.expirations} vencim, ${results.petAlerts} mascotas.`,
            details: results.details.length > 0 ? results.details : [{ userId: 'system', action: 'check', status: 'skipped', info: 'Sin acciones hoy' }]
        });

        return res.status(200).json({ ok: true, results });

    } catch (e) {
        console.error("Fatal Engine Error:", e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}
