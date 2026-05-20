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

        const creditsSnap = await historyRef
            .where('type', '==', 'credit')
            .get();

        const now = referenceDate ? new Date(referenceDate) : new Date();
        const startOfToday = new Date(now);
        startOfToday.setHours(0, 0, 0, 0);

        // --- Agrupar TODOS los créditos activos por fecha (string YYYY-MM-DD) ---
        // Esto evita el problema de comparar timestamps al milisegundo exacto.
        const expirationMap = new Map();
        creditsSnap.docs.forEach(doc => {
            const data = doc.data();
            if (data.status === 'expired') return;
            const rem = data.remainingPoints !== undefined
                ? Number(data.remainingPoints)
                : Number(data.amount);
            if (rem <= 0 || !data.expiresAt) return;

            const expireDate = data.expiresAt.toDate();
            if (expireDate < startOfToday) return; // Solo vencimientos futuros o de hoy

            const dateKey = `${expireDate.getFullYear()}-${String(expireDate.getMonth() + 1).padStart(2, '0')}-${String(expireDate.getDate()).padStart(2, '0')}`;
            expirationMap.set(dateKey, (expirationMap.get(dateKey) || 0) + rem);
        });

        // --- Encontrar la fecha más próxima de la agrupación ---
        let nextDateKey = null;
        for (const dateKey of expirationMap.keys()) {
            if (!nextDateKey || dateKey < nextDateKey) {
                nextDateKey = dateKey;
            }
        }

        const nextAmount = nextDateKey ? (expirationMap.get(nextDateKey) || 0) : 0;
        const isoDate = nextDateKey || null;

        // --- Top 3 detalles ordenados por fecha ---
        const expirationDetails = Array.from(expirationMap.entries())
            .map(([date, points]) => ({ date: admin.firestore.Timestamp.fromDate(new Date(date + 'T12:00:00')), points }))
            .sort((a, b) => a.date.toMillis() - b.date.toMillis())
            .slice(0, 3);

        await db.collection('users').doc(userId).update({
            nextExpirationDate: isoDate,
            nextExpirationAmount: nextAmount,
            expirationDetails: expirationDetails,
            metadataUpdatedAt: admin.firestore.FieldValue.serverTimestamp()
        });

        console.log(`[ExpirationUtils] Updated cache for ${userId}: ${isoDate} (${nextAmount} pts)`);

    } catch (error) {
        console.log(`[ExpirationUtils] Error adjusting expiration cache for ${userId}:`, error);
    }
}

/**
 * Calcula los días de validez basados en los puntos y las reglas de configuración.
 * 
 * @param {number} pts Puntos asignados
 * @param {Array} rules Reglas de vencimiento (expirationRules)
 * @returns {number} Días de validez
 */
export function getValidityDays(pts, rules) {
    if (!rules || !Array.isArray(rules) || rules.length === 0) return 365;

    // Asegurar que pts sea número
    const points = Number(pts) || 0;

    // Ordenamos por puntos mínimos
    const sortedRules = [...rules].sort((a, b) => (Number(a.minPoints) || 0) - (Number(b.minPoints) || 0));

    // 1. Intentar match exacto de rango
    const match = sortedRules.find(r =>
        points >= (Number(r.minPoints) || 0) &&
        (r.maxPoints === null || r.maxPoints === undefined || points <= Number(r.maxPoints))
    );

    if (match) return Number(match.validityDays) || 365;

    // 2. Fallback: Si supera el valor más alto de la tabla
    const highestRule = sortedRules[sortedRules.length - 1];
    if (points >= (Number(highestRule.minPoints) || 0)) {
        return Number(highestRule.validityDays) || 365;
    }

    return 365;
}
