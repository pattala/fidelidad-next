import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { buildHtmlLayout } from "../utils/emailLayout.js";
import { getEffectiveDate } from "../utils/timeUtils.js";
import { updateNextExpirationDate } from "../utils/_expiration-utils.js";

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

function formatDateToDisplay(dateStr) {
    if (!dateStr || typeof dateStr !== 'string' || !dateStr.includes('-')) return dateStr;
    const parts = dateStr.split('-');
    if (parts.length !== 3) return dateStr;
    const [y, m, d] = parts;
    return `${d}/${m}/${y}`;
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    // V.1.4.61: Debug Inicial en Consola del Servidor (Vercel)
    const debugTrigger = req.query?.trigger || req.query?.source || req.body?.source || 'auto';
    console.log(`[Engine-Daily] Inicio: ${req.method} | Trigger: ${debugTrigger} | Signature: ${!!req.headers["x-qstash-signature"]} | Cron: ${!!req.headers["x-vercel-cron"]}`);

    const authHeader = req.headers["x-api-key"] || req.headers["authorization"] || req.headers["X-API-Key"];
    const cronHeader = req.headers["x-vercel-cron"] || req.headers["X-Vercel-Cron"];
    const qstashHeader = req.headers["x-qstash-signature"];
    const SECRET = (process.env.API_SECRET_KEY || "").trim();

    try {
        const app = initFirebaseAdmin();
        const db = app.firestore();

        const configSnap = await db.collection('config').doc('general').get();
        if (!configSnap.exists) return res.status(404).json({ ok: false, error: "Config not found" });
        const config = configSnap.data();

        const simulatedDateStr = req.body?.simulatedDate || req.query?.simulatedDate;
        const triggerSource = req.body?.source || req.query?.source || req.query?.trigger || 'auto';
        const skipDuplicityCheck = req.query?.ignoreDeduplication === 'true' || req.body?.ignoreDeduplication === true;

        // V.1.4.60: Identificación de Ejecutor Temprana para Auditoría
        let executorDetail = "SISTEMA (Auto)";
        if (simulatedDateStr) {
            executorDetail = `SIMULADOR (${formatDateToDisplay(simulatedDateStr)})`;
        } else if (triggerSource === 'dashboard' || triggerSource === 'sidebar_manual') {
            executorDetail = "SISTEMA (Panel)";
            const authHeaderVal = req.headers["authorization"];
            if (authHeaderVal && authHeaderVal.startsWith("Bearer ")) {
                try {
                    const idToken = authHeaderVal.split("Bearer ")[1];
                    const decodedToken = await admin.auth().verifyIdToken(idToken);
                    if (decodedToken.email) executorDetail = `ADMIN (${decodedToken.email})`;
                } catch (e) { }
            }
        } else if (qstashHeader || triggerSource === 'qstash') {
            executorDetail = "SISTEMA (QStash)";
        } else if (triggerSource === 'extension') {
            executorDetail = "SISTEMA (Extensión)";
        } else if (cronHeader) {
            executorDetail = "SISTEMA (Cron Vercel)";
        }

        // V.1.4.60: Bypass de Seguridad para Gatillos Conocidos (Si no hay SECRET o viene de QStash/Extensión)
        const isAuthorized = cronHeader || qstashHeader || (triggerSource === 'qstash') || (triggerSource === 'extension') || (authHeader && SECRET && authHeader.includes(SECRET));
        
        if (!isAuthorized) {
            return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        // Usamos la utilidad centralizada para respetar el Simulador
        const referenceDate = await getEffectiveDate(db, simulatedDateStr);
        const y = referenceDate.getFullYear();
        const m = String(referenceDate.getMonth() + 1).padStart(2, '0');
        const d = String(referenceDate.getDate()).padStart(2, '0');
        const todayStr = `${y}-${m}-${d}`;
        
        // Validaciones de Ventana Horaria y Gatillos (Master Control)
        const currentHour = referenceDate.getHours();
        const startHour = Number(config.messaging?.engineAllowedStartHour ?? 6);
        const endHour = Number(config.messaging?.engineAllowedEndHour ?? 6);
        
        // 1. Validar Ventana Horaria (Si start === end, es 24hs según el usuario)
        let isInsideWindow = true;
        if (startHour !== endHour) {
            if (startHour < endHour) {
                isInsideWindow = (currentHour >= startHour && currentHour < endHour);
            } else {
                isInsideWindow = (currentHour >= startHour || currentHour < endHour);
            }
        }

        // 3. Validar si el gatillo está habilitado en Config
        let isTriggerEnabled = true;
        if ((triggerSource === 'qstash' || qstashHeader) && config.messaging?.enableQStashTrigger === false) isTriggerEnabled = false;
        if (triggerSource === 'extension' && config.messaging?.enableExtensionTrigger === false) isTriggerEnabled = false;
        if (triggerSource === 'dashboard' && config.messaging?.enableDashboardTrigger === false) isTriggerEnabled = false;

        // V.1.4.60: LOG TEMPRANO de Check (Para ver por qué falla o se salta)
        const isManual = (triggerSource === 'sidebar_manual' || simulatedDateStr);
        if (!isManual && (!isInsideWindow || !isTriggerEnabled)) {
            const reason = !isInsideWindow ? `Fuera de ventana horaria (${currentHour}hs)` : `Gatillo ${triggerSource} desactivado`;
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_check_info',
                status: 'skipped',
                summary: `Motor detenido: ${reason}`,
                executor: executorDetail,
                triggerSource,
                simulated: !!simulatedDateStr
            });
            return res.status(200).json({ ok: true, skipped: true, reason });
        }

        // Restaurar variables de estado necesarias para el resto del motor
        let processedAlerts = {};
        try {
            const statusSnap = await db.collection('audit_logs').doc(`daily_alerts_${todayStr}`).get();
            if (statusSnap.exists) {
                processedAlerts = statusSnap.data().actions || {};
            }
        } catch (e) { console.error("Error fetching daily status:", e); }

        const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
        const currentYear = referenceDate.getFullYear().toString();
        
        const results = {
            birthdays: 0,
            expirations: 0,
            petAlerts: 0,
            details: [],
            errors: []
        };


        // 1. PROCESAR CUMPLEAÑOS
        const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
        const birthdayUsers = usersSnap.docs.filter(doc => {
            const bDate = doc.data().birthDate;
            if (!bDate || typeof bDate !== 'string') return false;
            
            // V.1.4.63: Normalización Robusta (Soporta DD/MM, DD/MM/YYYY, YYYY-MM-DD, etc)
            let normalized = bDate;
            const separator = bDate.includes('/') ? '/' : (bDate.includes('-') ? '-' : null);
            
            if (separator) {
                const parts = bDate.split(separator).map(p => p.trim());
                if (parts.length >= 2) {
                    let day, month;
                    // Caso A: YYYY-MM-DD (o similar con año al principio)
                    if (parts[0].length === 4) {
                        month = parts[1];
                        day = parts[2];
                    } 
                    // Caso B: DD-MM... (Formato latino o sin año)
                    else {
                        day = parts[0];
                        month = parts[1];
                    }
                    if (day && month) {
                        normalized = `${month.padStart(2, '0')}-${day.padStart(2, '0')}`;
                    }
                }
            }
            return normalized.endsWith(todayMD);
        });

        console.log(`[Engine] Evaluando ${usersSnap.size} usuarios con fecha de nacimiento. Encontrados hoy (${todayMD}): ${birthdayUsers.length}`);

        for (const userDoc of birthdayUsers) {
            try {
                const userData = userDoc.data();
                const simCfg = config?.simulationConfig || { birthdays: true, expirations: true, petAlerts: true, campaigns: true };
                const skipBirthdays = simCfg.birthdays === false;
                const alreadyGreeted = userData.lastBirthdayGreetingYear === currentYear;

                // Lógica Automática (Solo si no se saludó hoy o forzamos repetición)
                if (!skipBirthdays && (!alreadyGreeted || skipDuplicityCheck)) {
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
                        
                        // Lógica estricta: si está habilitado el bono, usamos template full. Si no, simple.
                        const template = autoBonusEnabled ? templateFull : templateSimple;
                        
                        const msg = template.replace(/{nombre}/g, (userData.nombre || userData.name || '').split(' ')[0]).replace(/{puntos}/g, birthdayPoints.toString());
                        const title = "¡Feliz Cumpleaños! 🎂";

                        // 1. PWA PUSH
                        if (userData.fcmTokens?.length && config.messaging?.pushEnabled !== false) {
                            const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                            const iconUrl = config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "";
                            await app.messaging().sendEachForMulticast({
                                tokens: userData.fcmTokens,
                                notification: { title, body: msg },
                                data: { title, body: msg, url: `${PWA_URL}/perfil`, icon: iconUrl },
                                android: { 
                                    priority: "high",
                                    notification: { sound: "default", channelId: "fidelidad-notif-channel" }
                                },
                                webpush: {
                                    headers: { Urgent: "high" },
                                    fcmOptions: { link: `${PWA_URL}/perfil` }
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
                                title, body: msg, url: "/perfil", type: "birthday", read: false,
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
                    const nextAmt = userData.nextExpirationAmount || userData.points || 0;
                    results.details.push({
                        userId: doc.id,
                        userName: userData.nombre || userData.name || 'Socio',
                        socioNumber: userData.socioNumber || userData.numeroSocio || '',
                        dni: userData.dni || '',
                        action: "points_expired",
                        status: "success",
                        info: total > 0 ? `-${total} pts han vencido hoy.` : `Tiene ${nextAmt} pts por vencer pronto.`,
                        phone: userData.phone || userData.telefono || '',
                        points: total > 0 ? total : nextAmt
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
                const skipExpirations = (config?.simulationConfig?.expirations === false);
                // V.1.4.81: Tracking por fecha de vencimiento específica (evita que una fecha bloquee a la otra)
                const warningDates = userData.lastExpirationWarningDates || {};
                const nextExpDate = userData.nextExpirationDate;
                let alreadyNotified = warningDates[nextExpDate] === todayStr;

                // V.1.4.82: Lógica de Itinerancia (Respetar intervalo de repetición)
                if (!alreadyNotified && warningDates[nextExpDate]) {
                    const lastWarnStr = warningDates[nextExpDate];
                    const repeat = config.messaging?.repeatExpirationWarnings === true;
                    if (repeat) {
                        const d1 = new Date(lastWarnStr + 'T12:00:00');
                        const d2 = new Date(todayStr + 'T12:00:00');
                        const diffDays = Math.round((d2.getTime() - d1.getTime()) / 86400000);
                        const interval = Number(config.messaging?.expirationReminderIntervalDays || 0);
                        if (diffDays < interval) alreadyNotified = true;
                    } else {
                        alreadyNotified = true; // No repetir si la itinerancia está apagada
                    }
                }

                if (!skipExpirations && (!alreadyNotified || skipDuplicityCheck) && config?.enableExpirationMessage !== false) {
                    const title = "⚠️ ¡Tus puntos vencen pronto!";
                    const template = config?.messaging?.templates?.expirationWarning || "¡Hola {nombre}! 📢 Te recordamos que tus {puntos} puntos vencen el {fecha}. ¡No los pierdas!";
                    let nextAmt = userData.nextExpirationAmount !== undefined ? userData.nextExpirationAmount : null;
                    let dateStr = formatDateToDisplay(userData.nextExpirationDate);

                    if (userData.expirationDetails && Array.isArray(userData.expirationDetails) && userData.expirationDetails.length > 1) {
                        const details = userData.expirationDetails;
                        let totalExpiring = 0;
                        const dateParts = [];
                        details.forEach((d, index) => {
                            const pts = d.points || 0;
                            totalExpiring += pts;
                            const jsDate = d.date?.toDate ? d.date.toDate() : new Date(d.date);
                            const dStr = `${String(jsDate.getDate()).padStart(2, '0')}/${String(jsDate.getMonth() + 1).padStart(2, '0')}/${jsDate.getFullYear()}`;
                            dateParts.push(`${dStr} (${pts} pts)`);
                        });
                        nextAmt = totalExpiring;
                        if (dateParts.length === 2) {
                            dateStr = dateParts.join(' y ');
                        } else {
                            const last = dateParts.pop();
                            dateStr = dateParts.join(', ') + ' y ' + last;
                        }
                    } else if (nextAmt === null || nextAmt === undefined) {
                        const historySnap = await db.collection('users').doc(doc.id).collection('points_history').where('type', '==', 'credit').get();
                        let calc = 0;
                        historySnap.docs.forEach(h => {
                            const hd = h.data();
                            if (hd.status !== 'expired' && hd.expiresAt) {
                                const eDate = hd.expiresAt.toDate();
                                const eStr = `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, '0')}-${String(eDate.getDate()).padStart(2, '0')}`;
                                if (eStr === userData.nextExpirationDate) {
                                    calc += (hd.remainingPoints !== undefined ? Number(hd.remainingPoints) : Number(hd.amount));
                                }
                            }
                        });
                        nextAmt = calc;
                        updateNextExpirationDate(db, doc.id, referenceDate).catch(() => {});
                    }
                    
                    if (nextAmt === 0 && (userData.points || 0) > 0) {
                        // Prevent sending confusing 0 point expirations. The cache update will fix it for tomorrow.
                        return;
                    }

                    const msg = template
                        .replace(/{nombre}/g, (userData.nombre || userData.name || 'Socio').split(' ')[0])
                        .replace(/{puntos}/g, nextAmt.toString())
                        .replace(/{fecha}/g, dateStr);

                    // 1. PWA PUSH
                    if (userData.fcmTokens?.length && config.messaging?.pushEnabled !== false) {
                        const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                        const iconUrl = config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "";
                        await app.messaging().sendEachForMulticast({
                            tokens: userData.fcmTokens,
                            notification: { title, body: msg },
                            data: { title, body: msg, url: "/perfil", icon: iconUrl },
                            android: { 
                                priority: "high",
                                notification: { sound: "default", channelId: "fidelidad-notif-channel" }
                            },
                            webpush: {
                                headers: { Urgent: "high" },
                                fcmOptions: { link: "/perfil" }
                            }
                        }).catch(() => {});
                    }

                    // 2. INBOX
                    if (config.messaging?.inboxEnabled !== false) {
                        await doc.ref.collection('inbox').add({
                            title, body: msg, url: "/perfil", type: "expiration_warning", read: false,
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

                    // V.1.4.81: Guardar tracking por fecha específica de vencimiento
                    const updatedWarningDates = { ...warningDates, [nextExpDate]: todayStr };
                    await doc.ref.update({ lastExpirationWarningDates: updatedWarningDates });
                }

                let auditNextAmt = userData.nextExpirationAmount || userData.points || 0;
                let auditDateStr = formatDateToDisplay(userData.nextExpirationDate);
                
                if (userData.expirationDetails && Array.isArray(userData.expirationDetails) && userData.expirationDetails.length > 1) {
                    const details = userData.expirationDetails;
                    let totalExpiring = 0;
                    const dateParts = [];
                    details.forEach((d, index) => {
                        const pts = d.points || 0;
                        totalExpiring += pts;
                        const jsDate = d.date?.toDate ? d.date.toDate() : new Date(d.date);
                        const dStr = `${String(jsDate.getDate()).padStart(2, '0')}/${String(jsDate.getMonth() + 1).padStart(2, '0')}/${jsDate.getFullYear()}`;
                        dateParts.push(`${pts} pts el ${dStr}`);
                    });
                    auditNextAmt = totalExpiring;
                    auditDateStr = dateParts.join(' | ');
                } else if (userData.nextExpirationAmount === undefined) {
                    const historySnap = await db.collection('users').doc(doc.id).collection('points_history').where('type', '==', 'credit').get();
                    let calc = 0;
                    historySnap.docs.forEach(h => {
                        const hd = h.data();
                        if (hd.status !== 'expired' && hd.expiresAt) {
                            const eDate = hd.expiresAt.toDate();
                            const eStr = `${eDate.getFullYear()}-${String(eDate.getMonth() + 1).padStart(2, '0')}-${String(eDate.getDate()).padStart(2, '0')}`;
                            if (eStr === userData.nextExpirationDate) {
                                calc += (hd.remainingPoints !== undefined ? Number(hd.remainingPoints) : Number(hd.amount));
                            }
                        }
                    });
                    auditNextAmt = calc > 0 ? calc : (userData.points || 0);
                } else if (auditNextAmt === 0) {
                    auditNextAmt = userData.points || 0;
                }

                results.details.push({
                    userId: doc.id, userName: userData.nombre || userData.name || 'Socio',
                    socioNumber: userData.socioNumber || userData.numeroSocio || '',
                    dni: userData.dni || '', action: "expiration_warning", status: "info",
                    info: `Vencen ${auditNextAmt} pts: ${auditDateStr}`,
                    phone: userData.phone || userData.telefono || '',
                    points: auditNextAmt,
                    nextExpirationAmount: auditNextAmt,
                    nextExpirationDate: userData.nextExpirationDate
                });
            }
        }

        // 3. PROCESAR ALERTAS DE MASCOTAS
        if (config.enablePetModule) {
            const petUsersSnap = await db.collection('users').where('pets', '!=', null).get();
            for (const userDoc of petUsersSnap.docs) {
                try {
                    const userData = userDoc.data();
                    const skipPets = (config?.simulationConfig?.petAlerts === false);
                    if (skipPets) continue;

                    const pets = userData.pets || [];
                    let updatedPets = false;
                    const nextPets = [...pets];

                    for (let i = 0; i < nextPets.length; i++) {
                        const pet = nextPets[i];
                        const lastPurchase = pet.lastPurchaseDate?.toDate ? pet.lastPurchaseDate.toDate() : (pet.lastPurchaseDate ? new Date(pet.lastPurchaseDate + 'T12:00:00') : null);
                        if (!lastPurchase) continue;

                        const cycleDays = Number(pet.foodCycleDays || pet.frequencyDays || 30);
                        const warningDays = Number(config?.messaging?.petFoodWarningDays || config?.petFoodAlertLeadDays || 3);
                        
                        // Fecha en la que se le acaba el alimento
                        const exhaustionDate = new Date(lastPurchase);
                        exhaustionDate.setDate(lastPurchase.getDate() + cycleDays);
                        
                        // Fecha en la que hay que avisar
                        const alertDate = new Date(exhaustionDate);
                        alertDate.setDate(exhaustionDate.getDate() - warningDays);

                        const isAlertWindow = (referenceDate >= alertDate);
                        
                        // Evitar duplicados: Si la última alerta enviada es >= a la fecha de esta compra, ya avisamos.
                        // Usamos mediodía (T12) para evitar errores de zona horaria al comparar fechas.
                        const lastAlertSent = pet.lastFoodAlertDate ? new Date(pet.lastFoodAlertDate + 'T12:00:00') : null;
                        const alreadyAlerted = lastAlertSent && lastAlertSent >= lastPurchase;

                        if (isAlertWindow) {
                            if (!alreadyAlerted) {
                                const userName = (userData.nombre || userData.name || '').split(' ')[0];
                                const template = config.messaging?.templates?.petFoodAlert || "¡Hola {nombre}! 🐾 Notamos que a {mascota} se le debe estar terminando su {marca}.";
                                
                                // Formatear fecha de vencimiento (agotamiento) para el mensaje
                                const exhaustionStr = exhaustionDate.toISOString().split('T')[0];
                                const formattedExhaustion = formatDateToDisplay(exhaustionStr);

                                const msg = template
                                    .replace(/{nombre}/g, userName)
                                    .replace(/{mascota}/g, pet.name)
                                    .replace(/{marca}/g, pet.foodBrand || pet.brand || 'alimento')
                                    .replace(/{fecha}/g, formattedExhaustion)
                                    .replace(/{vencimiento}/g, formattedExhaustion);

                                // Saneamiento de tokens (Asegurar que sean strings)
                                const cleanTokens = (userData.fcmTokens || [])
                                    .filter(t => t && typeof t === 'string' && t.length > 10);

                                // DIAGNÓSTICO PUSH
                                if (!userData.fcmTokens?.length) results.errors.push(`Pet ${userDoc.id}: Sin tokens FCM`);
                                if (config.messaging?.pushEnabled === false) results.errors.push(`Pet ${userDoc.id}: Push desactivado en config`);

                                if (cleanTokens.length > 0 && config.messaging?.pushEnabled !== false) {
                                    const PWA_URL = process.env.PWA_URL || `https://${req.headers.host}`;
                                    const iconUrl = config.logoUrl ? getAbsoluteUrl(config.logoUrl, PWA_URL) : "";
                                    const title = "🐾 Aviso de Alimento";
                                    
                                    try {
                                        const response = await app.messaging().sendEachForMulticast({
                                            tokens: cleanTokens,
                                            notification: { title, body: msg },
                                            data: { title, body: msg, url: `${PWA_URL}/perfil`, icon: iconUrl },
                                            android: { 
                                                priority: "high",
                                                notification: { sound: "default", channelId: "fidelidad-notif-channel" }
                                            },
                                            webpush: {
                                                headers: { Urgent: "high" },
                                                fcmOptions: { link: `${PWA_URL}/perfil` }
                                            }
                                        });
                                        results.details.push({ action: "push_sent", userId: userDoc.id, success: response.successCount });
                                    } catch (pushErr) {
                                        results.errors.push(`Pet ${userDoc.id} Push Error: ${pushErr.message}`);
                                    }
                                }

                                if (config.messaging?.inboxEnabled !== false) {
                                    await userDoc.ref.collection('inbox').add({
                                        title: "🐾 Aviso de Alimento", body: msg, url: "/perfil", type: "pet_alert",
                                        read: false, date: admin.firestore.Timestamp.fromDate(referenceDate)
                                    });
                                }

                                // DIAGNÓSTICO EMAIL
                                if (!userData.email) results.errors.push(`Pet ${userDoc.id}: Sin email`);
                                if (!process.env.SMTP_USER) results.errors.push(`Pet ${userDoc.id}: SMTP no configurado en servidor`);
                                if (config.messaging?.emailEnabled === false) results.errors.push(`Pet ${userDoc.id}: Email desactivado en config`);

                                if (userData.email && process.env.SMTP_USER && config.messaging?.emailEnabled !== false) {
                                    const title = "🐾 Aviso de Alimento";
                                    const innerHtml = `<div style="color: #333;"><h2 style="color: #6366f1; margin-top: 0;">${title}</h2><p style="font-size: 16px; line-height: 1.6;">${msg}</p></div>`;
                                    try {
                                        await transporter.sendMail({
                                            from: `"${config.siteName || 'Club Fidelidad'}" <${process.env.SMTP_USER}>`,
                                            to: userData.email, subject: title, html: buildHtmlLayout(innerHtml, config)
                                        });
                                        results.details.push({ action: "email_sent", userId: userDoc.id });
                                    } catch (mailErr) {
                                        results.errors.push(`Pet ${userDoc.id} Mail Error: ${mailErr.message}`);
                                    }
                                }

                                nextPets[i].lastFoodAlertDate = todayStr; // Registramos que hoy enviamos la alerta
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

        const checkSnap = await db.collection('audit_logs').doc(`daily_alerts_${todayStr}`).get();
        const alreadyExecuted = checkSnap.exists && checkSnap.data().status === 'success';

        // --- 11. REGISTRO DE INICIO (Solo si no se saltó por duplicidad) ---
        let skipSideEffects = alreadyExecuted && !skipDuplicityCheck;
        
        console.log(`[Engine] Resultados parciales: ${results.birthdays} cumple, ${results.expirations} vencim, ${results.petAlerts} mascotas. Duplicado: ${skipSideEffects}`);

        // V.1.4.64: Consolidar Resumen y Detalles para Auditoría Completa
        const finalSummary = `Motor Diario (${executorDetail}): ${results.birthdays} cumple, ${results.expirations} vencim, ${results.petAlerts} mascotas.`;
        const finalStatus = results.errors.length > 0 ? 'partial' : 'success';

        if (!skipSideEffects) {
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_engine_execution',
                status: 'running',
                summary: `Iniciando motor diario (${todayStr})`,
                executor: executorDetail,
                triggerSource
            });
        } else {
            // Log de Verificación Enriquecido
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'daily_check_info',
                status: 'skipped',
                summary: `Motor al día. ${finalSummary}`,
                executor: executorDetail,
                triggerSource,
                details: results.details,
                simulated: !!simulatedDateStr
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
                if (dtl) {
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

        const pointsAssignmentsList = [];
        try {
            const pointsSnap = await db.collection('audit_logs')
                .where('type', '==', 'points_assignment')
                .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfToday))
                .get();

            pointsSnap.forEach(doc => {
                const data = doc.data();
                const dtl = data.details?.find(x => x.action === 'points_credited');
                if (dtl) {
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

        try {
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
            }

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
            }
        } catch (e) { console.error("Error in transaction maintenance:", e); }

        // AUDITORÍA FINAL CONSOLIDADA
        if (!skipSideEffects) {
            // 1. Registro de Historia (No se sobreescribe)
            await db.collection('audit_logs').add({
                type: 'engine_daily_execution_finished',
                status: finalStatus,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                executor: executorDetail,
                summary: finalSummary,
                details: results.details,
                simulated: !!simulatedDateStr
            });

            // 2. Registro de Estado (Fijo para Dashboard)
            await db.collection('audit_logs').doc(`daily_alerts_${todayStr}`).set({
                type: 'engine_daily_unified',
                status: finalStatus,
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                executor: executorDetail,
                summary: finalSummary,
                details: results.details.length > 0 ? results.details : [{ userId: 'system', action: 'check', status: 'skipped', info: 'Sin acciones hoy' }],
                actions: processedAlerts,
                lastUpdate: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
        }

        // 7. DISPARAR MOTOR DE CAMPAÑAS (Sincronizado)
        const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
        fetch(`${baseUrl}/api/engine-campaigns?trigger=engine-daily&isManual=${skipDuplicityCheck}`, {
            method: 'POST',
            headers: { 'x-api-key': process.env.API_SECRET_KEY || '' },
            body: JSON.stringify({ simulatedDate: simulatedDateStr })
        }).catch(() => { });

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
