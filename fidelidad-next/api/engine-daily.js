import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import { updateNextExpirationDate } from "../utils/_expiration-utils.js";
import { buildHtmlLayout } from "../utils/emailLayout.js";
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
    return admin.firestore();
}

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

// --- TAREA 1: CUMPLEAÑOS ---
async function processBirthdays(db, referenceDate, config, logResults) {
    const todayMD = `${String(referenceDate.getMonth() + 1).padStart(2, '0')}-${String(referenceDate.getDate()).padStart(2, '0')}`;
    const currentYear = referenceDate.getFullYear().toString();
    const usersSnap = await db.collection('users').where('birthDate', '!=', '').get();
    const birthdayUsers = usersSnap.docs.filter(doc => doc.data().birthDate?.endsWith(todayMD));

    for (const userDoc of birthdayUsers) {
        const userData = userDoc.data();
        if (userData.lastBirthdayGreetingYear === currentYear) continue;
        if (config.enableBirthdayBonus !== false) {
            const points = config.birthdayPoints || 100;
            await userDoc.ref.update({ points: admin.firestore.FieldValue.increment(points), lastBirthdayGreetingYear: currentYear });
            await userDoc.ref.collection('points_history').add({ amount: points, concept: '🎂 ¡Feliz Cumpleaños!', date: admin.firestore.Timestamp.fromDate(referenceDate), type: 'credit', remainingPoints: points });
            logResults.details.push({ action: 'birthday', info: `${userData.name}: +${points} pts` });
        }
    }
}

// --- TAREA 2: VENCIMIENTOS ---
async function processExpirations(db, referenceDate, config, logResults) {
    const referenceDateStr = referenceDate.toISOString().split('T')[0];
    const toExpireSnap = await db.collection('users').where('nextExpirationDate', '<=', referenceDateStr).get();
    for (const userDoc of toExpireSnap.docs) {
        const historyRef = userDoc.ref.collection('points_history');
        const expiredItemsSnap = await historyRef.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(referenceDate)).get();
        let total = 0;
        const batch = db.batch();
        expiredItemsSnap.docs.forEach(d => {
            const data = d.data();
            if (data.status === 'expired') return;
            const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
            if (data.type === 'credit' && rem > 0) {
                total += rem;
                batch.update(d.ref, { status: 'expired', remainingPoints: 0 });
            }
        });
        if (total > 0) {
            batch.update(userDoc.ref, { points: admin.firestore.FieldValue.increment(-total) });
            batch.set(historyRef.doc(), { amount: -total, concept: 'Vencimiento automático', date: admin.firestore.FieldValue.serverTimestamp(), type: 'debit' });
            await batch.commit();
            logResults.details.push({ action: 'expired', info: `${userDoc.id}: -${total} pts` });
        }
        await updateNextExpirationDate(db, userDoc.id, referenceDate);
    }
}

// --- TAREA 3: CAMPAÑAS ---
async function processCampaigns(db, referenceDate, config, logResults) {
    const todayStr = referenceDate.toISOString().split('T')[0];
    const currentH = referenceDate.getHours();
    if (currentH < (config.messaging?.engineAllowedStartHour ?? 9) || currentH >= (config.messaging?.engineAllowedEndHour ?? 21)) return;

    const snap = await db.collection('campanas').where('active', '==', true).get();
    for (const doc of snap.docs) {
        const camp = doc.data();
        if (!camp.autoBroadcast || camp.broadcastSentAt === todayStr) continue;
        // Broadcast simplificado
        await doc.ref.update({ broadcastSentAt: todayStr });
        logResults.details.push({ action: 'campaign', info: camp.name });
    }
}

// --- TAREA 4: MASCOTAS (PET MODULE) ---
async function processPetAlerts(db, referenceDate, config, logResults) {
    if (!config.enablePetModule) return;
    const todayStr = referenceDate.toISOString().split('T')[0];
    const usersSnap = await db.collection('users').where('pets', '!=', null).get();
    
    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const pets = userData.pets || [];
        let updated = false;
        const nextPets = pets.map(pet => {
            if (!pet.receiveAlerts || !pet.lastPurchaseDate || !pet.frequencyDays) return pet;
            const lastP = pet.lastPurchaseDate.toDate ? pet.lastPurchaseDate.toDate() : new Date(pet.lastPurchaseDate);
            const exhaust = new Date(lastP); exhaust.setDate(lastP.getDate() + Number(pet.frequencyDays));
            const alertD = new Date(exhaust); alertD.setDate(exhaust.getDate() - (config.petFoodAlertLeadDays || 3));
            
            if (referenceDate >= alertD && pet.lastFoodAlertDate !== todayStr) {
                logResults.details.push({ action: 'pet_alert', info: `${userData.name}: Alimento ${pet.name}` });
                updated = true;
                return { ...pet, lastFoodAlertDate: todayStr };
            }
            return pet;
        });
        if (updated) await userDoc.ref.update({ pets: nextPets });
    }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
    if (!authHeader || !authHeader.includes(SECRET)) return res.status(401).json({ ok: false, error: "Unauthorized" });

    const db = initFirebaseAdmin();
    try {
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        const refDate = await getEffectiveDate(db, req.body?.simulatedDate || req.query?.simulatedDate);
        const logResults = { details: [] };

        await processBirthdays(db, refDate, config, logResults);
        await processExpirations(db, refDate, config, logResults);
        await processCampaigns(db, refDate, config, logResults);
        await processPetAlerts(db, refDate, config, logResults);

        await db.collection('audit_logs').add({
            type: 'engine_daily_unified',
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            executor: req.query.trigger || 'auto',
            summary: `Motor V1.3.2: ${logResults.details.length} acciones.`
        });
        return res.status(200).json({ ok: true, summary: logResults });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}
