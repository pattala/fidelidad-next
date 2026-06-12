/**
 * Centraliza el cálculo de la fecha "actual" para el backend (API Routes),
 * respetando el Simulador de Fecha configurado en Firestore.
 */
export async function getEffectiveDate(db, simulatedDateParam = null) {
    const today = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"}));
    
    // 1. Prioridad: Parámetro explícito en la request (body o query)
    if (simulatedDateParam) {
        // Soporta YYYY-MM-DD o ISOString
        const dateStr = simulatedDateParam.includes('T') ? simulatedDateParam.split('T')[0] : simulatedDateParam;
        return new Date(dateStr + 'T12:00:00');
    }

    // 2. Segunda prioridad: Configuración global del Simulador
    try {
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        
        if (config.enableDateSimulator && config.simulatedOffsetDays) {
            const effective = new Date(today);
            effective.setDate(effective.getDate() + (Number(config.simulatedOffsetDays) || 0));
            return effective;
        }
    } catch (e) {
        console.error("[TimeUtils] Error leyendo config:", e.message);
    }

    // 3. Por defecto: Fecha real (Forzada a Argentina para evitar desfasaje en la nube)
    const argentinaDate = new Date(new Date().toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"}));
    return argentinaDate;
}

/**
 * Retorna la fecha EFECTIVA pero con el Timestamp CORRECTO (sin hack de timezone)
 * Ideal para guardar en la base de datos sin alterar el valor absoluto de tiempo (epoch).
 */
export async function getTrueEffectiveDate(db, simulatedDateParam = null) {
    const today = new Date();
    if (simulatedDateParam) {
        const dateStr = simulatedDateParam.includes('T') ? simulatedDateParam.split('T')[0] : simulatedDateParam;
        return new Date(dateStr + 'T12:00:00Z');
    }
    try {
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.data() || {};
        if (config.enableDateSimulator && config.simulatedOffsetDays) {
            const effective = new Date(today);
            effective.setDate(effective.getDate() + (Number(config.simulatedOffsetDays) || 0));
            return effective;
        }
    } catch (e) {
        console.error("[TimeUtils] Error leyendo config:", e.message);
    }
    return today;
}

/**
 * Retorna la fecha efectiva en formato YYYY-MM-DD
 */
export async function getEffectiveDateStr(db, simulatedDateParam = null) {
    const date = await getEffectiveDate(db, simulatedDateParam);
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
}
