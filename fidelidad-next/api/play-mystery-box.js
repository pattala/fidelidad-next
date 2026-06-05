import admin from "firebase-admin";

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

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();

    // GET = diagnostic/admin mode
    if (req.method === 'GET') {
        try {
            const adminApp = initFirebaseAdmin();
            const db = adminApp.firestore();
            const action = req.query.action || 'config';

            // ?action=config → show mysteryBox config
            if (action === 'config') {
                const configSnap = await db.collection('config').doc('general').get();
                const configData = configSnap.exists ? configSnap.data() : null;
                const mb = configData?.mysteryBox || null;
                return res.status(200).json({
                    ok: true,
                    configExists: configSnap.exists,
                    mysteryBoxExists: !!mb,
                    mysteryBoxEnabled: mb?.enabled ?? 'FIELD_MISSING',
                    prizeScalesCount: mb?.prizeScales?.length ?? 0,
                    prizeScales: mb?.prizeScales || [],
                    allMysteryBoxKeys: mb ? Object.keys(mb) : []
                });
            }

            // ?action=list → show all mystery_box_chances
            if (action === 'list') {
                const snap = await db.collection('mystery_box_chances').get();
                const chances = snap.docs.map(d => ({
                    id: d.id,
                    status: d.data().status,
                    clientName: d.data().clientName || d.data().userName,
                    amount: d.data().amount,
                    createdAt: d.data().createdAt?.toDate?.() || d.data().createdAt,
                    expiresAt: d.data().expiresAt?.toDate?.() || d.data().expiresAt,
                    clientId: d.data().clientId || d.data().userId
                }));
                return res.status(200).json({ ok: true, total: chances.length, chances });
            }

            // ?action=cleanup → delete ALL mystery_box_chances
            if (action === 'cleanup') {
                const snap = await db.collection('mystery_box_chances').get();
                const batch = db.batch();
                snap.docs.forEach(d => batch.delete(d.ref));
                await batch.commit();
                return res.status(200).json({ ok: true, deleted: snap.size, message: `Se eliminaron ${snap.size} registros de mystery_box_chances` });
            }

            return res.status(400).json({ ok: false, error: 'Acción no válida. Usá ?action=config, ?action=list o ?action=cleanup' });
        } catch (e) {
            return res.status(500).json({ ok: false, error: e.message });
        }
    }

    if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

    try {
        const adminApp = initFirebaseAdmin();
        const db = adminApp.firestore();

        const { id } = req.body;
        if (!id) {
            return res.status(400).json({ ok: false, error: 'Falta el ID de la caja sorpresa' });
        }

        const result = await db.runTransaction(async (t) => {
            const mbRef = db.collection('mystery_box_chances').doc(id);
            const doc = await t.get(mbRef);
            
            if (!doc.exists) {
                throw new Error("Caja Sorpresa no encontrada.");
            }
            
            const data = doc.data();
            
            if (data.status !== 'pending') {
                throw new Error("Esta caja ya fue jugada o expiró.");
            }
            
            const now = adminApp.firestore.Timestamp.now();
            if (data.expiresAt && data.expiresAt.toDate() < now.toDate()) {
                throw new Error("El tiempo límite para abrir esta caja ha expirado.");
            }

            // Get prize scales from config
            const configSnap = await t.get(db.collection('config').doc('general'));
            const configData = configSnap.exists ? configSnap.data() : {};
            console.log('[play-mystery-box] config/general exists:', configSnap.exists);
            console.log('[play-mystery-box] mysteryBox raw:', JSON.stringify(configData?.mysteryBox || 'MISSING'));
            
            const mysteryBoxConfig = configData?.mysteryBox || {};
            
            if (!mysteryBoxConfig.enabled) {
                throw new Error("El sistema de Cajas Sorpresa no está habilitado en la configuración. Verificá en Ajustes > Motor de Sorteos que esté ACTIVADO.");
            }
            if (!mysteryBoxConfig.prizeScales || !mysteryBoxConfig.prizeScales.length) {
                throw new Error("No hay escalas de premios configuradas. Verificá en Ajustes > Motor de Sorteos > Escalas de Premios que haya al menos un rango.");
            }

            // Calculate prize based on probabilities
            const random = Math.random() * 100;
            let cumulative = 0;
            let selectedScale = mysteryBoxConfig.prizeScales[mysteryBoxConfig.prizeScales.length - 1];
            
            for (const scale of mysteryBoxConfig.prizeScales) {
                cumulative += scale.probabilityPct;
                if (random <= cumulative) {
                    selectedScale = scale;
                    break;
                }
            }

            const pointsWon = Math.floor(Math.random() * (selectedScale.maxPoints - selectedScale.minPoints + 1)) + selectedScale.minPoints;

            // 1. Update Mystery Box Chance
            t.update(mbRef, {
                status: 'played',
                pointsWon,
                playedAt: now
            });

            // 2. Update User Points
            if (data.clientId) {
                const userRef = db.collection('users').doc(data.clientId);
                const userDoc = await t.get(userRef);
                
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    const expDays = mysteryBoxConfig.pointsExpirationDays || 15;
                    const expDate = new Date(now.toDate().getTime() + (expDays * 24 * 60 * 60 * 1000));
                    
                    const expDetails = userData.expirationDetails || [];
                    expDetails.push({
                        date: expDate.toISOString(),
                        points: pointsWon
                    });
                    
                    let newExpDateStr = userData.nextExpirationDate;
                    const newExpDateStrFormatted = expDate.toISOString().split('T')[0];
                    if (!newExpDateStr || newExpDateStrFormatted < newExpDateStr) {
                        newExpDateStr = newExpDateStrFormatted;
                    }

                    t.update(userRef, {
                        points: (userData.points || 0) + pointsWon,
                        expirationDetails: expDetails,
                        nextExpirationDate: newExpDateStr
                    });

                    // 3. Add to Points History
                    const historyRef = db.collection('users').doc(data.clientId).collection('points_history').doc();
                    t.set(historyRef, {
                        type: 'credit',
                        amount: pointsWon,
                        date: now,
                        concept: 'Premio Caja Sorpresa',
                        moneySpent: 0,
                        source: 'caja_sorpresa'
                    });
                }
            }

            return { pointsWon };
        });

        return res.status(200).json({ ok: true, pointsWon: result.pointsWon });

    } catch (e) {
        console.error("Error playing mystery box:", e);
        return res.status(400).json({ ok: false, error: e.message || 'Error interno al procesar el premio.' });
    }
}
