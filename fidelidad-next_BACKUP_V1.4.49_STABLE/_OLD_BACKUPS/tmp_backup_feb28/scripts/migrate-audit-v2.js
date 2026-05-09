/**
 * SCRIPT DE MIGRACIÓN: Consolida logs de auditoría antiguos en el nuevo formato.
 * Para ejecutar: node scripts/migrate-audit-v2.js
 */

import admin from "firebase-admin";
import fs from 'fs';
import path from 'path';

// Cargar credenciales desde variables de entorno o archivo local si lo necesitas
// Aquí asumimos que usas la variable que ya tienes configurada.
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

async function migrate() {
    console.log("🚀 Iniciando migración de Audit Logs...");

    // 1. Obtener logs que NO tengan el formato nuevo (ej: sin campo 'details')
    // Nota: Firebase no permite query por "campo no existe" de forma directa de forma eficiente en listPaged, 
    // así que traemos los últimos 500 y filtramos.
    const snapshot = await db.collection('audit_logs')
        .orderBy('timestamp', 'desc')
        .limit(1000)
        .get();

    console.log(`🔍 Analizando ${snapshot.size} registros...`);

    let migrated = 0;
    let skipped = 0;

    for (const doc of snapshot.docs) {
        const log = doc.data();

        // Si ya tiene detalles, lo saltamos
        if (log.details && Array.isArray(log.details) && log.details.length > 0) {
            skipped++;
            continue;
        }

        const updates = {};

        // Casos comunes de logs viejos
        if (log.type === 'points_assignment' || log.type === 'manual_points') {
            // Reconstruir un detalle básico para que la UI no se rompa
            updates.details = [
                {
                    action: 'legacy_migration_sync',
                    status: 'success',
                    info: 'Registro migrado de versión anterior',
                    timestamp: log.timestamp ? log.timestamp.toDate().toISOString() : new Date().toISOString()
                }
            ];

            // Intentar extraer info del summary
            if (log.summary && log.summary.includes('pts')) {
                updates.details[0].info = log.summary;
            }
        }

        // Si no tiene ejecutor, poner 'sistema' o 'admin' por defecto
        if (!log.executor) {
            updates.executor = 'admin_legacy';
        }

        // Si el estado es 'success' pero Falta, lo agregamos
        if (!log.status) {
            updates.status = 'success';
        }

        if (Object.keys(updates).length > 0) {
            await doc.ref.update(updates);
            migrated++;
        }
    }

    console.log("✅ Migración completada.");
    console.log(`📊 Total migrados: ${migrated}`);
    console.log(`📊 Ya actualizados/saltados: ${skipped}`);
}

migrate().catch(console.error);
