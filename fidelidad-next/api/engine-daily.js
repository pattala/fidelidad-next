import admin from "firebase-admin";
import nodemailer from 'nodemailer';

// --- INICIALIZACIÓN ROBUSTA ---
function getDb() {
    if (!admin.apps.length) {
        const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
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
    return admin.firestore();
}

// --- UTILIDAD DE FECHA INTEGRADA ---
async function getNow(db, simulatedDateParam) {
    if (simulatedDateParam) {
        const dateStr = simulatedDateParam.includes('T') ? simulatedDateParam.split('T')[0] : simulatedDateParam;
        return new Date(dateStr + 'T12:00:00');
    }
    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data() || {};
    if (config.enableDateSimulator && config.simulatedOffsetDays) {
        const d = new Date();
        d.setDate(d.getDate() + (Number(config.simulatedOffsetDays) || 0));
        return d;
    }
    return new Date();
}

// --- ACTUALIZACIÓN DE CACHE DE EXPIRACIÓN INTEGRADA ---
async function updateCache(db, userId, refDate) {
    try {
        const historyRef = db.collection('users').doc(userId).collection('points_history');
        const creditsSnap = await historyRef.where('type', '==', 'credit').get();
        const startOfToday = new Date(refDate); startOfToday.setHours(0,0,0,0);
        
        let nextDate = null; let nextAmount = 0;
        const expirationMap = new Map();

        creditsSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.status === 'expired') return;
            const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
            if (rem <= 0 || !data.expiresAt) return;
            const expireDate = data.expiresAt.toDate();
            if (expireDate >= startOfToday) {
                if (!nextDate || expireDate < nextDate) { nextDate = expireDate; nextAmount = rem; }
                else if (expireDate.getTime() === nextDate.getTime()) { nextAmount += rem; }
            }
            const dateKey = expireDate.toISOString().split('T')[0];
            expirationMap.set(dateKey, (expirationMap.get(dateKey) || 0) + rem);
        });

        const isoDate = nextDate ? nextDate.toISOString().split('T')[0] : null;
        const details = Array.from(expirationMap.entries())
            .map(([date, points]) => ({ date: admin.firestore.Timestamp.fromDate(new Date(date + 'T12:00:00')), points }))
            .sort((a,b) => a.date.toMillis() - b.date.toMillis()).slice(0, 3);

        await db.collection('users').doc(userId).update({
            nextExpirationDate: isoDate,
            nextExpirationAmount: nextAmount,
            expirationDetails: details,
            metadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });
    } catch (e) { console.error("Error cache:", e); }
}

// --- TAREAS ---
async function doBirthdays(db, now, config, logs) {
    try {
        const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const year = now.getFullYear().toString();
        const snap = await db.collection('users').where('birthDate', '!=', '').get();
        for (const doc of snap.docs) {
            const data = doc.data();
            if (data.birthDate?.endsWith(todayMD) && data.lastGreetingYear !== year) {
                const pts = config.birthdayPoints || 100;
                await doc.ref.update({ points: admin.firestore.FieldValue.increment(pts), lastGreetingYear: year });
                await doc.ref.collection('points_history').add({ amount: pts, concept: '🎂 ¡Feliz Cumpleaños!', date: admin.firestore.Timestamp.fromDate(now), type: 'credit', remainingPoints: pts });
                logs.push({ action: 'birthday', info: data.name });
            }
        }
    } catch (e) { logs.push({ action: 'error_birthday', info: e.message }); }
}

async function doExpirations(db, now, config, logs) {
    try {
        const todayStr = now.toISOString().split('T')[0];
        const snap = await db.collection('users').where('nextExpirationDate', '<=', todayStr).get();
        for (const doc of snap.docs) {
            const history = doc.ref.collection('points_history');
            const items = await history.where('expiresAt', '<', admin.firestore.Timestamp.fromDate(now)).get();
            let total = 0; const batch = db.batch();
            items.docs.forEach(d => {
                const data = d.data();
                if (data.status === 'expired') return;
                const rem = data.remainingPoints !== undefined ? Number(data.remainingPoints) : Number(data.amount);
                if (data.type === 'credit' && rem > 0) { total += rem; batch.update(d.ref, { status: 'expired', remainingPoints: 0 }); }
            });
            if (total > 0) {
                batch.update(doc.ref, { points: admin.firestore.FieldValue.increment(-total) });
                batch.set(history.doc(), { amount: -total, concept: 'Vencimiento automático', date: admin.firestore.FieldValue.serverTimestamp(), type: 'debit' });
                await batch.commit();
                logs.push({ action: 'expired', info: `${doc.id}: -${total}` });
            }
            await updateCache(db, doc.id, now);
        }
    } catch (e) { logs.push({ action: 'error_expirations', info: e.message }); }
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    const auth = req.headers["x-api-key"] || req.headers["authorization"];
    if (!auth || !auth.includes(SECRET)) return res.status(401).json({ ok: false, error: "Unauthorized" });

    try {
        const db = getDb();
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        const now = await getNow(db, req.body?.simulatedDate || req.query?.simulatedDate);
        const logResults = [];

        await doBirthdays(db, now, config, logResults);
        await doExpirations(db, now, config, logResults);

        await db.collection('audit_logs').add({
            type: 'engine_daily_unified',
            status: 'success',
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            executor: req.query.trigger || 'auto',
            summary: `V1.3.4: ${logResults.length} acciones.`
        });
        return res.status(200).json({ ok: true, details: logResults });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}
