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

/**
 * Valida si la hora de una fecha cae dentro de la ventana operativa,
 * soportando configuraciones en formato numérico (ej. 9) o string (ej. "09:30").
 */
export function isInsideTimeWindow(startConfig, endConfig, currentDate) {
    let startH = 6, startM = 0;
    if (typeof startConfig === 'string' && startConfig.includes(':')) {
        const parts = startConfig.split(':');
        startH = Number(parts[0]);
        startM = Number(parts[1]);
    } else if (startConfig !== undefined) {
        startH = Number(startConfig);
    }

    let endH = 6, endM = 0;
    if (typeof endConfig === 'string' && endConfig.includes(':')) {
        const parts = endConfig.split(':');
        endH = Number(parts[0]);
        endM = Number(parts[1]);
    } else if (endConfig !== undefined) {
        endH = Number(endConfig);
    }

    const currentTotalM = currentDate.getHours() * 60 + currentDate.getMinutes();
    const startTotalM = startH * 60 + startM;
    const endTotalM = endH * 60 + endM;

    if (startTotalM === endTotalM) {
        return true; // Si es igual, asumimos 24hs abierto o que no hay restricción.
    } else if (startTotalM < endTotalM) {
        // Horario normal (ej. 09:00 a 20:00)
        return currentTotalM >= startTotalM && currentTotalM < endTotalM;
    } else {
        // Horario nocturno cruzando medianoche (ej. 20:00 a 04:00)
        return currentTotalM >= startTotalM || currentTotalM < endTotalM;
    }
}
