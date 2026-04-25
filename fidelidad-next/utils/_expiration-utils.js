import admin from "firebase-admin";

/**
 * Recalcula y actualiza el campo 'nextExpirationDate' y 'nextExpirationAmount'
 * de un usuario basándose en su historial de puntos activos.
 * 
 * @param {admin.firestore.Firestore} db Instancia de Firestore
 * @param {string} userId ID del usuario
 */
export async function updateNextExpirationDate(db, userId, referenceDate = null) {
    try {
        const historyRef = db.collection('users').doc(userId).collection('points_history');

        // Buscamos solo créditos (sumas de puntos) que no estén expirados ni agotados totalmente
        const creditsSnap = await historyRef
            .where('type', '==', 'credit')
            .get();

        const now = referenceDate ? new Date(referenceDate) : new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        let nextDate = null;
        let nextAmount = 0;

        creditsSnap.docs.forEach(doc => {
            const data = doc.data();

            // Si ya está expirado o no tiene saldo remanente, ignorar
            if (data.status === 'expired') return;

            const currentRemaining = data.remainingPoints !== undefined
                ? Number(data.remainingPoints)
                : Number(data.amount);

            if (currentRemaining <= 0) return;

            // Chequear fecha de vencimiento
            if (data.expiresAt) {
                const expireDate = data.expiresAt.toDate();

                // Solo nos interesan vencimientos FUTUROS o de HOY.
                // Los pasados ya deberían haber sido procesados (o se procesarán en la próxima corrida de expiración real)
                // Pero para la fecha de "Próximo Vencimiento", buscamos la más cercana en el futuro.
                if (expireDate >= startOfToday) {
                    if (!nextDate || expireDate < nextDate) {
                        nextDate = expireDate;
                        nextAmount = currentRemaining;
                    } else if (expireDate.getTime() === nextDate.getTime()) {
                        nextAmount += currentRemaining;
                    }
                }
            }
        });

        const isoDate = nextDate ? `${nextDate.getFullYear()}-${(nextDate.getMonth()+1).toString().padStart(2, '0')}-${nextDate.getDate().toString().padStart(2, '0')}` : null;

        // Actualizamos el documento del usuario (metadata para queries rápidas)
        await db.collection('users').doc(userId).update({
            nextExpirationDate: isoDate,
            nextExpirationAmount: nextDate ? nextAmount : 0,
            metadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[ExpirationUtils] Updated cache for ${userId}: ${isoDate} (${nextAmount} pts)`);

    } catch (error) {
        console.error(`[ExpirationUtils] Error adjusting expiration cache for ${userId}:`, error);
    }
}
