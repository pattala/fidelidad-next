/**
 * SCRIPT: Recalcular nextExpirationDate para TODOS los usuarios.
 * Esto corrige usuarios cuyos créditos tienen expiresAt pero el campo 
 * nextExpirationDate del documento principal está vacío o desactualizado.
 * 
 * Para ejecutar: node scripts/recalc-expirations.js
 */

import admin from "firebase-admin";

const raw = process.env.GOOGLE_CREDENTIALS_JSON;
if (!raw) {
    console.error("ERROR: GOOGLE_CREDENTIALS_JSON no encontrada.");
    process.exit(1);
}

const sa = JSON.parse(raw);
if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

const db = admin.firestore();

async function recalcAll() {
    console.log("🚀 Recalculando nextExpirationDate para todos los usuarios...\n");

    const usersSnap = await db.collection('users').get();
    console.log(`📊 Total usuarios: ${usersSnap.size}\n`);

    let updated = 0;
    let skipped = 0;
    let noExpiration = 0;

    const now = new Date();
    const startOfToday = new Date(now);
    startOfToday.setHours(0, 0, 0, 0);

    for (const userDoc of usersSnap.docs) {
        const userData = userDoc.data();
        const userId = userDoc.id;
        const userName = userData.name || userData.nombre || userId;

        // Skip admins
        if (userData.role === 'admin') {
            skipped++;
            continue;
        }

        try {
            const historyRef = db.collection('users').doc(userId).collection('points_history');
            const creditsSnap = await historyRef.where('type', '==', 'credit').get();

            let nextDate = null;
            let nextAmount = 0;

            creditsSnap.docs.forEach(doc => {
                const data = doc.data();

                if (data.status === 'expired') return;

                const currentRemaining = data.remainingPoints !== undefined
                    ? Number(data.remainingPoints)
                    : Number(data.amount);

                if (currentRemaining <= 0) return;

                if (data.expiresAt) {
                    const expireDate = data.expiresAt.toDate();
                    if (expireDate >= startOfToday) {
                        if (!nextDate || expireDate < nextDate) {
                            nextDate = expireDate;
                            nextAmount = currentRemaining;
                        } else if (nextDate && expireDate.getTime() === nextDate.getTime()) {
                            nextAmount += currentRemaining;
                        }
                    }
                }
            });

            const isoDate = nextDate ? nextDate.toISOString().split('T')[0] : null;
            const oldDate = userData.nextExpirationDate || null;

            if (isoDate !== oldDate || (nextAmount > 0 && userData.nextExpirationAmount !== nextAmount)) {
                await db.collection('users').doc(userId).update({
                    nextExpirationDate: isoDate,
                    nextExpirationAmount: nextDate ? nextAmount : 0,
                    metadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
                });
                updated++;
                console.log(`  ✅ ${userName}: ${oldDate || '(vacío)'} → ${isoDate || '(sin vencimiento)'} (${nextAmount} pts)`);
            } else if (isoDate) {
                skipped++;
            } else {
                noExpiration++;
            }

        } catch (e) {
            console.error(`  ❌ Error con ${userName} (${userId}):`, e.message);
        }
    }

    console.log(`\n🏁 Resultado:`);
    console.log(`   Actualizados: ${updated}`);
    console.log(`   Ya correctos: ${skipped}`);
    console.log(`   Sin vencimientos: ${noExpiration}`);
}

recalcAll().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
