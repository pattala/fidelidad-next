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
        const skipDuplicityCheck = req.query?.ignoreDeduplication === 'true' || req.body?.ignoreDeduplication === true;
        
        // Usamos la utilidad centralizada para respetar el Simulador
        const referenceDate = await getEffectiveDate(db, simulatedDateStr);
        const todayStr = referenceDate.toISOString().split('T')[0];
        
        // RECUPERAR ALERTAS PROCESADAS PARA SINCRONIZACIÓN
        let processedAlerts = {};
        try {
            const processedSnap = await db.collection('audit_logs').doc(`daily_alerts_${todayStr}`).get();
            if (processedSnap.exists) {
                processedAlerts = processedSnap.data().actions || {};
            }
        } catch (e) { console.error("Error fetching processed alerts:", e); }

        const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
        const currentYear = referenceDate.getFullYear().toString();
        
        const results = {
            birthdays: 0,
            expirations: 0,
            petAlerts: 0,
            details: [],
            errors: []
        };

        // Identificación del Ejecutor para Auditoría (V.1.4.3)
        let executorDetail = "Sistema (Auto)";
        if (cronHeader) {
            executorDetail = "Sistema (Vercel Cron)";
        } else if (req.headers["x-qstash-signature"]) {
            executorDetail = "Sistema (QStash)";
        } else {
            // Intentar extraer identidad real del token de autorización
            const authHeader = req.headers["authorization"];
            if (authHeader && authHeader.startsWith("Bearer ")) {
                try {
                    const idToken = authHeader.split("Bearer ")[1];
                    const decodedToken = await admin.auth().verifyIdToken(idToken);
                    executorDetail = decodedToken.email || decodedToken.uid || "Administrador (Sesión)";
                } catch (e) {
                    // Fallback a triggerSource si el token falla o es API Key
                    if (triggerSource === 'dashboard' || triggerSource === 'sidebar_manual') executorDetail = "Administrador (Panel)";
                    else if (triggerSource === 'extension') executorDetail = "Administrador (Extensión)";
                    else if (triggerSource === 'pwa_admin') executorDetail = "Administrador (PWA)";
                }
            } else {
                // Si no hay token, usamos el triggerSource detectado
                if (triggerSource === 'dashboard' || triggerSource === 'sidebar_manual') executorDetail = "Administrador (Panel)";
                else if (triggerSource === 'extension') executorDetail = "Administrador (Extensión)";
                else if (triggerSource === 'pwa_admin') executorDetail = "Administrador (PWA)";
            }
        }

        // 0. RECOLECTAR IDS DE USUARIOS ACTIVOS (Para filtrar huérfanos en auditoría)
        const activeUserIds = new Set();
        const allUsersSnap = await db.collection('users').select().get();
        allUsersSnap.forEach(u => activeUserIds.add(u.id));

        // 1. PROCESAR CUMPLEAÑOS
        const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
        const birthdayUsers = usersSnap.docs.filter(doc => {
            const bDate = doc.data().birthDate;
            if (!bDate) return false;
            // Normalizar: convertir YYYY-MM-DD o DD/MM/YYYY a MM-DD para comparar
            let normalized = bDate;
            if (bDate.includes('/')) {
                const parts = bDate.split('/');
                if (parts.length === 3) normalized = `${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
            } else if (bDate.includes('-')) {
                const parts = bDate.split('-');
                if (parts.length === 3) {
                    // Si es YYYY-MM-DD (estándar HTML5)
                    if (parts[0].length === 4) normalized = `${parts[1].padStart(2, '0')}-${parts[2].padStart(2, '0')}`;
                    // Si es DD-MM-YYYY
                    else normalized = `${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                }
            }
            return normalized.endsWith(todayMD);
        });

        console.log(`[Engine] Evaluando ${usersSnap.size} usuarios con fecha de nacimiento. Encontrados hoy (${todayMD}): ${birthdayUsers.length}`);

        for (const userDoc of birthdayUsers) {
            try {
                const userData = userDoc.data();
                const alreadyGreeted = userData.lastBirthdayGreetingYear === currentYear;

                // Lógica Automática (Solo si no se saludó hoy)
                if (!alreadyGreeted) {
                    const birthdayPoints = Number(config?.birthdayPoints || 100);
                    const autoBonusEnabled = config?.enableBirthdayBonus === true;
                    const autoMessageEnabled = config?.enableBirthdayMessage !== false;

                    let pointsAdded = 0;
                    if (autoBonusEnabled && userData.lastBirthdayPointsYear !== currentYear) {
                        const historyRef = userDoc.ref.collection('points_history');
                        let expirationDate = new Date(referenceDate);
                        expirationDate.setDate(expirationDate.getDate() + 365);

                        await historyRef.add({
                            amount: birthdayPoints, concept: '🎂 ¡Feliz Cumpleaños! Regalo del Club',
                            date: admin.firestore.Timestamp.fromDate(referenceDate), type: 'credit',
                            expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                            remainingPoints: birthdayPoints, balanceAfter: (Number(userData.points) || 0) + birthdayPoints
                        });

                        await userDoc.ref.update({
                            points: admin.firestore.FieldValue.increment(birthdayPoints),
                            lastBirthdayPointsYear: currentYear
                        });
                        pointsAdded = birthdayPoints;
                    }

                    if (autoMessageEnabled) {
                        const templateFull = config?.messaging?.templates?.birthday || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día. Te regalamos {puntos} puntos.";
                        const templateSimple = config?.messaging?.templates?.birthdaySimple || "¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día.";
                        const template = (pointsAdded > 0) ? templateFull : templateSimple;
                        const msg = template.replace(/{nombre}/g, (userData.nombre || userData.name || '').split(' ')[0]).replace(/{puntos}/g, birthdayPoints.toString());
                        const title = "¡Feliz Cumpleaños! 🎂";

                        // 1. PWA PUSH
                        if (userData.fcmTokens?.length && config.messaging?.pushEnabled !== false) {
                            const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                            const iconUrl = config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "";
                            await app.messaging().sendEachForMulticast({
                                tokens: userData.fcmTokens,
                                notification: { title, body: msg },
                                data: { title, body: msg, url: "/profile", icon: iconUrl },
                                android: { 
                                    priority: "high",
                                    notification: { sound: "default", channelId: "fidelidad-notif-channel" }
                                },
                                webpush: {
                                    headers: { Urgent: "high" },
                                    fcmOptions: { link: "/profile" }
                                }
                            }).catch(() => {});
                        }

                        // 2. EMAIL
                        if (userData.email && process.env.SMTP_USER && config.messaging?.emailEnabled !== false) {
                            const innerHtml = `<div style="color: #333;"><h2 style="color: #db2777; margin-top: 0;">${title}</h2><p style="font-size: 16px; line-height: 1.6;">${msg}</p></div>`;
                            await transporter.sendMail({
                                from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                                to: userData.email, subject: title, html: buildHtmlLayout(innerHtml, config)
                            }).catch(() => {});
                        }

                        // 3. INBOX
                        if (config.messaging?.inboxEnabled !== false) {
                            await userDoc.ref.collection('inbox').add({
                                title, body: msg, url: "/profile", type: "birthday", read: false,
                                date: admin.firestore.Timestamp.fromDate(referenceDate)
                            });
                        }
                        
                        await userDoc.ref.update({ lastBirthdayGreetingYear: currentYear });
                    }
                    results.birthdays++;
                }

                // SIEMPRE añadir a detalles para la extensión (WhatsApp)
                results.details.push({
                    userId: userDoc.id,
                    userName: userData.nombre || userData.name || 'Socio',
                    socioNumber: userData.socioNumber || userData.numeroSocio || '',
                    dni: userData.dni || '',
                    action: "birthday_greeting",
                    status: "success",
                    info: alreadyGreeted ? 'Ya saludado (Auto)' : 'Saludo procesado ahora',
                    phone: userData.phone || userData.telefono || ''
                });

            } catch (e) { results.errors.push(`Birthday ${userDoc.id}: ${e.message}`); }
        }

        // 2. PROCESAR VENCIMIENTOS
        // A. Ejecutar vencimientos REALES
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
                    batch.update(doc.ref, { points: admin.firestore.FieldValue.increment(-total), nextExpirationDate: null });
                    batch.set(history.doc(), { 
                        amount: -total, concept: 'Vencimiento automático de puntos acumulados (Auto)', 
                        date: admin.firestore.Timestamp.fromDate(referenceDate), type: 'debit' 
                    });
                    await batch.commit();
                    results.expirations++;
                }

                // SIEMPRE añadir a detalles para la extensión si tiene puntos o venció hoy
                if (total > 0 || (userData.points || 0) > 0) {
                    results.details.push({
                        userId: doc.id,
                        userName: userData.nombre || userData.name || 'Socio',
                        socioNumber: userData.socioNumber || userData.numeroSocio || '',
                        dni: userData.dni || '',
                        action: "points_expired",
                        status: "success",
                        info: total > 0 ? `-${total} pts vencidos hoy` : 'Vencimiento pendiente de aviso',
                        phone: userData.phone || userData.telefono || '',
                        points: total > 0 ? total : (userData.points || 0)
                    });
                }
            } catch (e) { results.errors.push(`Expiration ${doc.id}: ${e.message}`); }
        }

        // B. Detectar Vencimientos PRÓXIMOS
        const warningDays = Number(config?.messaging?.expirationWarningDays || 7);
        const warningLimit = new Date(referenceDate);
        warningLimit.setDate(warningLimit.getDate() + warningDays);
        const warningLimitStr = warningLimit.toISOString().split('T')[0];

        const upcomingExpsSnap = await db.collection('users')
            .where('nextExpirationDate', '>', todayStr)
            .where('nextExpirationDate', '<=', warningLimitStr)
            .get();

        for (const doc of upcomingExpsSnap.docs) {
            const userData = doc.data();
            if ((userData.points || 0) > 0) {
                const todayStrShort = todayStr;
                const alreadyNotified = userData.lastExpirationWarningDate === todayStrShort;

                if (!alreadyNotified && config?.enableExpirationMessage !== false) {
                    const title = "⚠️ ¡Tus puntos vencen pronto!";
                    const template = config?.messaging?.templates?.expirationWarning || "¡Hola {nombre}! 📢 Te recordamos que tus {puntos} puntos vencen el {fecha}. ¡No los pierdas!";
                    const msg = template
                        .replace(/{nombre}/g, (userData.nombre || userData.name || 'Socio').split(' ')[0])
                        .replace(/{puntos}/g, userData.points.toString())
                        .replace(/{fecha}/g, userData.nextExpirationDate);

                    // 1. PWA PUSH
                    if (userData.fcmTokens?.length && config.messaging?.pushEnabled !== false) {
                        const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                        const iconUrl = config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "";
                        await app.messaging().sendEachForMulticast({
                            tokens: userData.fcmTokens,
                            notification: { title, body: msg },
                            data: { title, body: msg, url: "/profile", icon: iconUrl },
                            android: { 
                                priority: "high",
                                notification: { sound: "default", channelId: "fidelidad-notif-channel" }
                            },
                            webpush: {
                                headers: { Urgent: "high" },
                                fcmOptions: { link: "/profile" }
                            }
                        }).catch(() => {});
                    }

                    // 2. INBOX
                    if (config.messaging?.inboxEnabled !== false) {
                        await doc.ref.collection('inbox').add({
                            title, body: msg, url: "/profile", type: "expiration_warning", read: false,
                            date: admin.firestore.Timestamp.fromDate(referenceDate)
                        });
                    }

                    // 3. EMAIL
                    if (userData.email && process.env.SMTP_USER && config.messaging?.emailEnabled !== false) {
                        const innerHtml = `<div style="color: #333;"><h2 style="color: #f59e0b; margin-top: 0;">${title}</h2><p style="font-size: 16px; line-height: 1.6;">${msg}</p></div>`;
                        await transporter.sendMail({
                            from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                            to: userData.email, subject: title, html: buildHtmlLayout(innerHtml, config)
                        }).catch(() => {});
                    }

                    await doc.ref.update({ lastExpirationWarningDate: todayStrShort });
                }

                results.details.push({
                    userId: doc.id, userName: userData.nombre || userData.name || 'Socio',
                    socioNumber: userData.socioNumber || userData.numeroSocio || '',
                    dni: userData.dni || '', action: "expiration_warning", status: "info",
                    info: `${userData.points} pts próximos a vencer el ${userData.nextExpirationDate}`,
                    phone: userData.phone || userData.telefono || '',
                    points: userData.points, nextExpirationDate: userData.nextExpirationDate
                });
            }
        }

        // 3. PROCESAR ALERTAS DE MASCOTAS
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
                        const alreadyAlerted = pet.lastFoodAlertDate === lastPurchase.toISOString().split('T')[0];

                        if (isAlertDay) {
                            if (!alreadyAlerted) {
                                const userName = (userData.nombre || userData.name || '').split(' ')[0];
                                const template = config.messaging?.templates?.petFoodAlert || "¡Hola {nombre}! 🐾 Notamos que a {mascota} se le debe estar terminando su {marca}.";
                                const msg = template.replace(/{nombre}/g, userName).replace(/{mascota}/g, pet.name).replace(/{marca}/g, pet.foodBrand || pet.brand || 'alimento');

                                if (userData.fcmTokens?.length && config.messaging?.pushEnabled !== false) {
                                    const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                                    const iconUrl = config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "";
                                    const title = "🐾 Aviso de Alimento";
                                    await app.messaging().sendEachForMulticast({
                                        tokens: userData.fcmTokens,
                                        notification: { title, body: msg },
                                        data: { title, body: msg, url: "/profile", icon: iconUrl },
                                        android: { 
                                            priority: "high",
                                            notification: { sound: "default", channelId: "fidelidad-notif-channel" }
                                        },
                                        webpush: {
                                            headers: { Urgent: "high" },
                                            fcmOptions: { link: "/profile" }
                                        }
                                    }).catch(() => {});
                                }

                                if (config.messaging?.inboxEnabled !== false) {
                                    await userDoc.ref.collection('inbox').add({
                                        title: "🐾 Aviso de Alimento", body: msg, url: "/profile", type: "pet_alert",
                                        read: false, date: admin.firestore.Timestamp.fromDate(referenceDate)
                                    });
                                }

                                if (userData.email && process.env.SMTP_USER && config.messaging?.emailEnabled !== false) {
                                    const title = "🐾 Aviso de Alimento";
                                    const innerHtml = `<div style="color: #333;"><h2 style="color: #6366f1; margin-top: 0;">${title}</h2><p style="font-size: 16px; line-height: 1.6;">${msg}</p></div>`;
                                    await transporter.sendMail({
                                        from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                                        to: userData.email, subject: title, html: buildHtmlLayout(innerHtml, config)
                                    }).catch(() => {});
                                }

                                nextPets[i].lastFoodAlertDate = lastPurchase.toISOString().split('T')[0];
                                updatedPets = true;
                                results.petAlerts++;
                            }

                            // SIEMPRE añadir a detalles para la extensión
                            results.details.push({
                                userId: userDoc.id, userName: userData.nombre || userData.name || 'Socio',
                                socioNumber: userData.socioNumber || userData.numeroSocio || '',
                                dni: userData.dni || '', action: "pet_food_alert", status: "success",
                                info: alreadyAlerted ? `Ya alertado (Auto)` : `Alerta mascota procesada`,
                                phone: userData.phone || userData.telefono || '',
                                petName: pet.name, foodBrand: pet.foodBrand || pet.brand || ''
                            });
                        }
                    }
                    if (updatedPets) await userDoc.ref.update({ pets: nextPets });
                } catch (e) { results.errors.push(`Pet ${userDoc.id}: ${e.message}`); }
            }
        }

        // 4. PROCESAR CANJES (Para sincronización de WhatsApp)
        // Buscamos si ya existe una ejecución para HOY (según fecha efectiva)
        const startOfToday = new Date(referenceDate);
        startOfToday.setHours(0, 0, 0, 0);

        const checkSnap = await db.collection('audit_logs')
            .where('type', '==', 'daily_engine_execution')
            .where('status', '==', 'success')
            .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfToday))
            .limit(1)
            .get();

        // --- 11. REGISTRO DE INICIO (Solo si no se saltó por duplicidad) ---
        let skipSideEffects = !checkSnap.empty && !skipDuplicityCheck;
        
        console.log(`[Engine] Resultados parciales: ${results.birthdays} cumple, ${results.expirations} vencim, ${results.petAlerts} mascotas. Duplicado: ${skipSideEffects}`);

        if (!skipSideEffects) {
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_engine_execution',
                status: 'running',
                summary: `Iniciando motor diario (${todayStr})`,
                executor: executorDetail,
                triggerSource
            });
        }

        const redemptionsList = [];
        try {
            const redsSnap = await db.collection('audit_logs')
                .where('type', '==', 'prize_redemption')
                .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfToday))
                .get();
            
            redsSnap.forEach(doc => {
                const data = doc.data();
                const dtl = data.details?.find(x => x.action === 'prize_redeemed');
                if (dtl && activeUserIds.has(dtl.userId)) {
                    const alertId = `redemption-${dtl.socioNumber || dtl.phone || dtl.userId || doc.id}-${dtl.redemptionCode || 'N/A'}`;
                    redemptionsList.push({
                        ...dtl,
                        alertId,
                        name: dtl.userName,
                        action: 'prize_redemption'
                    });
                }
            });
        } catch (e) { console.error("Error fetching redemptions for engine:", e); }

        // 5. PROCESAR ASIGNACIONES DE PUNTOS (Manuales)
        const pointsAssignmentsList = [];
        try {
            const pointsSnap = await db.collection('audit_logs')
                .where('type', '==', 'points_assignment')
                .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfToday))
                .get();

            pointsSnap.forEach(doc => {
                const data = doc.data();
                const dtl = data.details?.find(x => x.action === 'points_credited');
                if (dtl && activeUserIds.has(dtl.userId)) {
                    const alertId = `points-${dtl.socioNumber || dtl.phone || dtl.userId || doc.id}-${doc.id}`;
                    pointsAssignmentsList.push({
                        ...dtl,
                        alertId,
                        name: dtl.userName,
                        action: 'points_assignment',
                        points: dtl.points
                    });
                }
            });
        } catch (e) { console.error("Error fetching points assignments for engine:", e); }

        // 6. MANTENIMIENTO GLOBAL DE TRANSACCIONES (3 AÑOS O 5000 REGISTROS)
        try {
            // A. Borrar por antigüedad (3 años = 1095 días)
            const threeYearsAgo = new Date(referenceDate);
            threeYearsAgo.setDate(threeYearsAgo.getDate() - 1095);
            const oldTransSnap = await db.collection('transactions')
                .where('date', '<', admin.firestore.Timestamp.fromDate(threeYearsAgo))
                .limit(500)
                .get();

            if (!oldTransSnap.empty) {
                const batch = db.batch();
                oldTransSnap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`[engine] Purged ${oldTransSnap.size} transactions older than 3 years.`);
            }

            // B. Borrar por cantidad (Cap: 5000)
            const transCountSnap = await db.collection('transactions').count().get();
            const totalTrans = transCountSnap.data().count;
            if (totalTrans > 5000) {
                const toDelete = totalTrans - 5000;
                const excessSnap = await db.collection('transactions')
                    .orderBy('date', 'asc')
                    .limit(Math.min(toDelete, 500))
                    .get();
                
                const batch = db.batch();
                excessSnap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
                console.log(`[engine] Purged ${excessSnap.size} excess transactions (Total was ${totalTrans}).`);
            }
        } catch (e) { console.error("Error in transaction maintenance:", e); }

        // AUDITORÍA FINAL CONSOLIDADA (Solo si se procesó)
        if (!skipSideEffects) {
            await db.collection('audit_logs').add({
                type: 'engine_daily_unified',
                status: results.errors.length > 0 ? 'partial' : 'success',
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                executor: executorDetail,
                summary: `Motor Maestro V.1.4.20: ${results.birthdays} cumple, ${results.expirations} vencim, ${results.petAlerts} mascotas.`,
                details: results.details.length > 0 ? results.details : [{ userId: 'system', action: 'check', status: 'skipped', info: 'Sin acciones hoy' }]
            });
        }

        // Formatear listas para la extensión/dashboard
        const birthdaysList = results.details.filter(d => d.action === "birthday_greeting").map(d => ({...d, name: d.userName}));
        const expirationsList = results.details.filter(d => d.action === "points_expired" || d.action === "expiration_warning").map(d => ({...d, name: d.userName}));
        const petAlertsList = results.details.filter(d => d.action === "pet_food_alert").map(d => ({...d, name: d.userName}));

        return res.status(200).json({ 
            ok: true, 
            results,
            birthdays: birthdaysList,
            expirations: expirationsList,
            petAlerts: petAlertsList,
            redemptions: redemptionsList,
            pointsAssignments: pointsAssignmentsList,
            processedAlerts: processedAlerts,
            config: config,
            referenceDate: todayStr,
            skipped: skipSideEffects
        });

    } catch (e) {
        console.error("Fatal Engine Error:", e);
        return res.status(500).json({ ok: false, error: e.message });
    }
}
