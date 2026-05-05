// api/reset-factory.js
import admin from "firebase-admin";

function initFirebaseAdmin() {
    if (admin.apps.length) return;
    const raw = process.env.GOOGLE_CREDENTIALS_JSON;
    if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");
    let sa = JSON.parse(raw);
    admin.initializeApp({ credential: admin.credential.cert(sa) });
}

async function deleteByQueryPaged(db, makeQuery, label = "batch") {
    let count = 0;
    while (true) {
        const snap = await makeQuery().get();
        if (snap.empty) break;
        const batch = db.batch();
        snap.docs.forEach(d => {
            batch.delete(d.ref);
            count++;
        });
        await batch.commit();
    }
    return count;
}

async function deleteUserSubcollections(db, docId, subs = []) {
    // Si no se pasan subcolecciones específicas, usamos la lista maestra por defecto
    const masterSubs = subs.length > 0 ? subs : [
        "geo_raw",
        "points_history",
        "inbox",
        "notifications",
        "interacciones",
        "visit_history",
        "transactions",
        "tokens",
        "expiration_cache",
        "backups"
    ];
    for (const sub of masterSubs) {
        const makeQuery = () => db.collection(`users/${docId}/${sub}`).limit(500);
        await deleteByQueryPaged(db, makeQuery, `users/${docId}/${sub}`);
    }
}

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    const { action, options, confirmText } = req.body || {};

    try {
        initFirebaseAdmin();
        const db = admin.firestore();

        // --- ACCIÓN: BACKUP ---
        if (action === 'backup') {
            const configSnap = await db.collection('config').doc('general').get();
            const prizesSnap = await db.collection('prizes').get();
            const campaignsSnap = await db.collection('campanas').get();

            const backupData = {
                config: configSnap.exists ? configSnap.data() : null,
                prizes: prizesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                campaigns: campaignsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
                timestamp: admin.firestore.FieldValue.serverTimestamp()
            };

            await db.collection('backups').doc('last_reliable').set(backupData);
            return res.status(200).json({ ok: true, message: "Respaldo creado correctamente." });
        }

        // --- ACCIÓN: RESTORE ---
        if (action === 'restore') {
            const backupSnap = await db.collection('backups').doc('last_reliable').get();
            if (!backupSnap.exists) throw new Error("No se encontró ningún respaldo guardado.");

            const data = backupSnap.data();
            if (data.config) await db.collection('config').doc('general').set(data.config, { merge: true });

            // Restore Prizes/Campaigns (Overwriting current ones if they exist)
            // Note: Simplistic approach, deletes current and puts backup
            await deleteByQueryPaged(db, () => db.collection('prizes').limit(500));
            for (const p of data.prizes) {
                const { id, ...rest } = p;
                await db.collection('prizes').doc(id).set(rest);
            }

            await deleteByQueryPaged(db, () => db.collection('campanas').limit(500));
            for (const c of data.campaigns) {
                const { id, ...rest } = c;
                await db.collection('campanas').doc(id).set(rest);
            }

            return res.status(200).json({ ok: true, message: "Configuración restaurada correctamente." });
        }

        // --- ACCIÓN: RESET (GRANULAR) ---
        if (action === 'reset') {
            if (confirmText !== 'RESET') return res.status(400).json({ ok: false, error: "Debe confirmar con 'RESET'." });

            const results = {};

            // 1. SOCIOS Y ACTIVIDAD
            if (options.socios_total) {
                // DETECCIÓN DE FANTASMAS: listDocuments() obtiene incluso los docs en cursiva
                const usersRefs = await db.collection("users").listDocuments();
                let deletedCount = 0;
                const uidsToPurgeAuth = []; // Para borrar de Firebase Authentication

                for (const docRef of usersRefs) {
                    const snap = await docRef.get();
                    const data = snap.data();

                    // Proteger administradores
                    if (snap.exists && ["admin", "editor", "viewer"].includes(data?.role)) {
                        continue;
                    }

                    // Guardar UID para Auth si existe y no es el admin actual
                    const authUID = data?.authUID || data?.uid || (snap.exists ? snap.id : null);
                    if (authUID && authUID !== req.body.adminUid) {
                        uidsToPurgeAuth.push(authUID);
                    }

                    // Limpieza profunda de todas las subcolecciones del usuario
                    await deleteUserSubcollections(db, docRef.id);
                    await docRef.delete();
                    deletedCount++;
                }

                // Borrar de Firebase Auth en bloques de 1000 (límite del SDK)
                if (uidsToPurgeAuth.length > 0) {
                    console.log(`[reset-factory] Purging ${uidsToPurgeAuth.length} users from Firebase Auth...`);
                    for (let i = 0; i < uidsToPurgeAuth.length; i += 1000) {
                        const chunk = uidsToPurgeAuth.slice(i, i + 1000);
                        try {
                            await admin.auth().deleteUsers(chunk);
                        } catch (authErr) {
                            console.error("[reset-factory] Auth purge error chunk:", authErr);
                        }
                    }
                }

                results.socios_borrados = deletedCount;
                results.auth_purgados = uidsToPurgeAuth.length;
            } else if (options.socios_historial) {
                // Borrar solo historiales manteniendo usuarios
                const usersSnap = await db.collection("users").get();
                for (const d of usersSnap.docs) {
                    await deleteUserSubcollections(db, d.id, ["points_history", "transactions", "interacciones", "geo_raw", "visit_history", "expiration_cache"]);
                    await d.ref.update({
                        points: 0,
                        puntos: 0,
                        balance: 0,
                        accumulated_balance: 0,
                        lastExpirationNotice: null,
                        lastExpirationNoticeTargetDate: null,
                        lastExpirationNoticeAmount: null,
                        nextExpirationDate: null,
                        nextExpirationAmount: 0
                    });
                }
                results.historiales_vaciados = usersSnap.size;
            }

            if (options.socios_mensajes) {
                const usersSnap = await db.collection("users").get();
                for (const d of usersSnap.docs) {
                    await deleteUserSubcollections(db, d.id, ["inbox", "notifications"]);
                }
                results.mensajes_limpios = usersSnap.size;
            }

            if (options.geo_total) {
                results.geo_root = await deleteByQueryPaged(db, () => db.collection('geo_raw').limit(500));
            }

            if (options.transacciones_total) {
                results.transacciones_limpias = await deleteByQueryPaged(db, () => db.collection('transactions').limit(500));
            }

            // 2. MARCA E IDENTIDAD
            if (options.marca_total) {
                await db.collection('config').doc('general').update({
                    primaryColor: '#2563eb',
                    secondaryColor: '#1e3a8a',
                    backgroundColor: '#f9fafb',
                    logoUrl: ''
                });
                results.marca_reseteada = true;
            }

            // 3. REGLAS Y CATALOGO
            if (options.prizes_total) {
                results.prizes_borrados = await deleteByQueryPaged(db, () => db.collection('prizes').limit(500));
            }
            if (options.campaigns_total) {
                results.campanas_borradas = await deleteByQueryPaged(db, () => db.collection('campanas').limit(500));
            }
            if (options.gamification_total) {
                await db.collection('config').doc('general').update({
                    pointsPerPeso: 1,
                    pointsMoneyBase: 100,
                    welcomePoints: 100,
                    enableWelcomeBonus: true
                });
                results.gamification_reseteado = true;
            }

            // 4. EQUIPO Y CONTENIDOS
            if (options.team_total) {
                // DETECCIÓN DE TODOS LOS ADMINS PARA VACIADO TOTAL (Ciclo de Fábrica)
                const adminsSnap = await db.collection("admins").get();
                let deletedAdmins = 0;
                
                for (const d of adminsSnap.docs) {
                    // Borrar de Firestore
                    await d.ref.delete();
                    
                    // Borrar de Firebase Auth (Opcional, pero recomendado para limpieza)
                    const authEmail = d.data().email;
                    if (authEmail && authEmail !== 'admin@admin.com') {
                        try {
                            const u = await admin.auth().getUserByEmail(authEmail);
                            await admin.auth().deleteUser(u.uid);
                        } catch (e) {}
                    }
                    deletedAdmins++;
                }

                // REESTABLECER ACCESO DE FÁBRICA (Como un Router)
                const factoryEmail = 'admin@admin.com';
                const factoryPass = 'adminadmin';
                
                try {
                    const u = await admin.auth().getUserByEmail(factoryEmail);
                    await admin.auth().updateUser(u.uid, { password: factoryPass });
                    console.log("[reset-factory] Cuenta de fábrica restablecida (Update)");
                } catch (e) {
                    if (e.code === 'auth/user-not-found') {
                        await admin.auth().createUser({
                            email: factoryEmail,
                            password: factoryPass,
                            emailVerified: true
                        });
                        console.log("[reset-factory] Cuenta de fábrica creada (New)");
                    }
                }

                results.admins_borrados = deletedAdmins;
                results.factory_reset = true;
            }

            if (options.contact_total) {
                await db.collection('config').doc('general').update({
                    contact: {
                        whatsapp: '', email: '', instagram: '', facebook: '', website: '', termsAndConditions: '', pwaUrl: ''
                    }
                });
                results.contactos_limpios = true;
            }

            if (options.legales_total) {
                // Reset a los terminos por defecto (podriamos traerlos de un template)
                await db.collection('config').doc('general').update({
                    'contact.termsContent': '# Términos y Condiciones\n\nReset Factory Default...'
                });
                results.legales_reseteados = true;
            }

            if (options.audit_total) {
                results.audit_logs_borrados = await deleteByQueryPaged(db, () => db.collection('audit_logs').limit(500));
            }

            // 5. AUDITORIA FINAL DEL RESET
            try {
                // Extraer ejecutor del token si no viene
                let executor = 'admin';
                const authHeader = req.headers["authorization"];
                if (authHeader && authHeader.startsWith("Bearer ")) {
                    const token = authHeader.split("Bearer ")[1];
                    const decoded = await admin.auth().verifyIdToken(token);
                    executor = decoded.email || decoded.uid || 'admin';
                }

                await db.collection('audit_logs').add({
                    timestamp: admin.firestore.FieldValue.serverTimestamp(),
                    type: 'system_reset',
                    status: 'success',
                    summary: `Reinicio de fábrica ejecutado por ${executor}`,
                    details: [
                        { action: 'reset_executed', status: 'success', info: `Acciones: ${Object.keys(options).filter(k => options[k]).join(', ')}` },
                        ...Object.keys(results).map(key => ({
                            action: `reset_${key}`,
                            status: 'success',
                            info: typeof results[key] === 'number' ? `Registros afectados: ${results[key]}` : `Completado: ${results[key]}`
                        }))
                    ],
                    executor
                });
            } catch (auditErr) {
                console.error("Audit error in reset-factory:", auditErr);
            }

            return res.status(200).json({ ok: true, message: "Reset completado con éxito.", results });
        }

        return res.status(400).json({ ok: false, error: "Acción no válida." });

    } catch (err) {
        console.error("reset-factory error:", err);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
