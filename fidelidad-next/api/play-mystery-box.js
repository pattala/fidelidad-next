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
            const config = configSnap.data() || {};
            const mysteryBoxConfig = config.mysteryBox || {};
            
            if (!mysteryBoxConfig.enabled || !mysteryBoxConfig.prizeScales || !mysteryBoxConfig.prizeScales.length) {
                throw new Error("El sistema de Cajas Sorpresa está temporalmente inhabilitado.");
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
