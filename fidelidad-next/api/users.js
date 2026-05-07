// /api/users.js
// Consolidated users API: Create, Delete, and Assign Socio Number.
// Actions: 'create' (default), 'delete', 'assign-socio'

import admin from "firebase-admin";
import { getValidityDays } from "../utils/_expiration-utils.js";
import { getEffectiveDate } from "../utils/timeUtils.js";

// ---------- Firebase Admin Init ----------
function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
        if (!credsRaw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON.");
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

// --- UTILS ---
async function readJsonBody(req) {
    if (req.body && typeof req.body === 'object') return req.body;
    try {
        const chunks = [];
        for await (const c of req) chunks.push(c);
        const raw = Buffer.concat(chunks).toString("utf8");
        return raw ? JSON.parse(raw) : {};
    } catch { throw new Error("BAD_JSON"); }
}

function applyCors(req, res) {
    const raw = (process.env.CORS_ALLOWED_ORIGINS || "").trim();
    const allowed = raw.split(",").map(s => s.trim()).filter(Boolean);
    const origin = req.headers.origin || "";
    if (allowed.includes(origin)) { res.setHeader("Access-Control-Allow-Origin", origin); res.setHeader("Vary", "Origin"); }
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}

// --- SUB-HANDLER: CREATE USER ---
async function handleCreate(req, res, db) {
    let payload = req.body;
    try {
        let { 
            email, dni, nombre, telefono, numeroSocio, fechaNacimiento, 
            birthDate, fechaInscripcion, domicilio, docId, termsAccepted, 
            termsAcceptedAt, source, isTestUser, photoUrl, metadata 
        } = payload || {};
        
        if (!email || !dni) return res.status(400).json({ ok: false, error: "Faltan email y dni" });

        const finalBirthDate = birthDate || fechaNacimiento || "";

        email = String(email).toLowerCase().trim();
        dni = String(dni).trim();
        if (dni.length < 6) dni = dni.padStart(6, '0');

        // Check uniqueness of DNI
        const snapDni = await db.collection('users').where('dni', '==', dni).limit(1).get();
        if (!snapDni.empty && snapDni.docs[0].data().email !== email) {
            return res.status(400).json({ ok: false, error: `El DNI ${dni} ya está registrado con otro email.` });
        }

        let authUser, createdAuth = false;
        try {
            authUser = await admin.auth().getUserByEmail(email);
        } catch (e) {
            if (e.code === 'auth/user-not-found') {
                authUser = await admin.auth().createUser({ email, password: dni, displayName: nombre || "" });
                createdAuth = true;
            } else throw e;
        }

        const authUID = authUser.uid;
        const col = db.collection("users");
        const fsDocSnap = await col.where("email", "==", email).limit(1).get();
        let fsDocRef, createdFs = false;

        const fsPayload = {
            email, dni, nombre: nombre || "", telefono: telefono || "",
            numeroSocio: numeroSocio ? Number(numeroSocio) : null,
            socioNumber: numeroSocio ? Number(numeroSocio) : null,
            birthDate: finalBirthDate, // Canonical name
            fechaNacimiento: finalBirthDate, // Alias for legacy or specific modules
            authUID, role: "client", estado: "activo",
            source: source || 'local',
            isTestUser: isTestUser || false,
            photoUrl: photoUrl || "",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (metadata) fsPayload.metadata = { ...metadata };
        if (termsAccepted !== undefined) fsPayload.termsAccepted = termsAccepted;
        if (termsAcceptedAt) fsPayload.termsAcceptedAt = termsAcceptedAt;
        const now = await getEffectiveDate(db, req.query?.simulatedDate || req.body?.simulatedDate);
        if (fechaInscripcion) fsPayload.fechaInscripcion = fechaInscripcion;
        if (domicilio) fsPayload.domicilio = { ...domicilio, updatedAt: now };
        if (req.body.pets) fsPayload.pets = req.body.pets;

        if (!fsDocSnap.empty) {
            fsDocRef = fsDocSnap.docs[0].ref;
            await fsDocRef.set(fsPayload, { merge: true });
        } else {
            fsDocRef = col.doc(docId || authUID);
            await fsDocRef.set({ ...fsPayload, createdAt: admin.firestore.FieldValue.serverTimestamp(), fcmTokens: [] });
            createdFs = true;
        }

        // AUDITORIA: Registro de creación
        await db.collection('audit_logs').add({
            timestamp: admin.firestore.FieldValue.serverTimestamp(),
            type: 'user_created',
            status: 'success',
            summary: `Usuario creado: ${fsPayload.nombre} (Socio #${fsPayload.socioNumber || 'N/A'}, DNI ${fsPayload.dni})`,
            details: { email: fsPayload.email, source: fsPayload.source },
            executor: req.headers["x-executor-email"] || "admin" // V.1.4.33
        });

        return res.status(200).json({ ok: true, auth: { uid: authUID, created: createdAuth }, firestore: { docId: fsDocRef.id, created: createdFs } });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}

// --- SUB-HANDLER: DELETE USER ---
async function handleDelete(req, res, db) {
    const { docId, authUID: provAuthUID, email: provEmail, targetCollection = 'users' } = req.body;
    if (!docId && !provAuthUID && !provEmail) return res.status(400).json({ ok: false, error: "Falta identificador" });
    try {
        let userId = docId, authUID = provAuthUID, email = provEmail;
        if (userId) {
            const snap = await db.collection(targetCollection).doc(userId).get();
            if (snap.exists) {
                const userData = snap.data();
                authUID = userData.authUID || userData.uid;
                email = userData.email;

                // PROTECCIÓN DE CUENTAS MAESTRAS
                const masterEmails = ['pablo_attala@yahoo.com.ar', 'admin@admin.com'];
                if (masterEmails.includes(email?.toLowerCase())) {
                    return res.status(403).json({ ok: false, error: "Esta cuenta está protegida por el sistema y no puede ser eliminada." });
                }
            }
        } else if (provEmail) {
            // PROTECCIÓN DE CUENTAS MAESTRAS (Check by provEmail too)
            const masterEmails = ['pablo_attala@yahoo.com.ar', 'admin@admin.com'];
            if (masterEmails.includes(provEmail?.toLowerCase())) {
                return res.status(403).json({ ok: false, error: "Esta cuenta está protegida por el sistema y no puede ser eliminada." });
            }

            const snap = await db.collection(targetCollection).where("email", "==", provEmail.toLowerCase()).limit(1).get();
            if (!snap.empty) { userId = snap.docs[0].id; authUID = snap.docs[0].data().authUID || snap.docs[0].data().uid; }
        }

        if (userId) {
            const userRef = db.collection(targetCollection).doc(userId);
            const auditDocSnap = await userRef.get();
            let auditSummary = `Usuario eliminado: ${email || userId}`;
            let socioNumber = '';
            
            if (auditDocSnap.exists) {
                const d = auditDocSnap.data();
                socioNumber = d.socioNumber || d.numeroSocio || '';
                auditSummary = `Usuario eliminado: ${d.name || d.nombre || 'N/A'} (Socio #${socioNumber || 'N/A'}, DNI ${d.dni || 'N/A'})`;
            }
            req.body.cachedAuditSummary = auditSummary;

            // 1. Borrar transacciones globales asociadas
            const tSnap1 = await db.collection('transactions').where('userId', '==', userId).get();
            const tSnap2 = await db.collection('transactions').where('uid', '==', userId).get();
            
            const tBatch = db.batch();
            tSnap1.forEach(d => tBatch.delete(d.ref));
            tSnap2.forEach(d => tBatch.delete(d.ref));
            if (tSnap1.size > 0 || tSnap2.size > 0) await tBatch.commit();
            
            // 2. Borrar subcolecciones de forma recursiva y dinámica
            const subcollections = await userRef.listCollections();
            for (const sub of subcollections) {
                const subSnap = await sub.get();
                if (!subSnap.empty) {
                    const batch = db.batch();
                    subSnap.docs.forEach(d => batch.delete(d.ref));
                    await batch.commit();
                }
            }

            // --- NUEVO: Limpiar rastro en audit_logs para GlobalAlerts (Burbujas) ---
            const nowSim = await getEffectiveDate(db, req.query?.simulatedDate || req.body?.simulatedDate);
            const startOfToday = new Date(nowSim);
            startOfToday.setHours(0, 0, 0, 0);

            const auditCleanupSnap = await db.collection('audit_logs')
                .where('timestamp', '>=', admin.firestore.Timestamp.fromDate(startOfToday))
                .get();

            const auditBatch = db.batch();
            let countAudit = 0;
            auditCleanupSnap.docs.forEach(doc => {
                const data = doc.data();
                const isRelevantType = ['prize_redemption', 'points_assignment', 'whatsapp_notification', 'whatsapp_manual'].includes(data.type);
                
                // Búsqueda profunda en detalles (puede ser objeto o array)
                let isTargetUser = false;
                if (Array.isArray(data.details)) {
                    isTargetUser = data.details.some(d => d.userId === userId || (socioNumber && (d.socioNumber === socioNumber || d.socio === socioNumber)));
                } else if (data.details) {
                    isTargetUser = data.details.userId === userId || (socioNumber && (data.details.socioNumber === socioNumber || data.details.socio === socioNumber));
                }

                if (isRelevantType && isTargetUser) {
                    auditBatch.delete(doc.ref);
                    countAudit++;
                }
            });
            if (countAudit > 0) await auditBatch.commit();
            
            // 3. Finalmente borrar el perfil
            await userRef.delete();
        }
        if (authUID) await admin.auth().deleteUser(authUID).catch(() => { });
        else if (email) {
            const user = await admin.auth().getUserByEmail(email).catch(() => null);
            if (user) await admin.auth().deleteUser(user.uid);
        }
        // AUDITORIA: Registro de borrado
        if (userId) {
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'user_deleted',
                status: 'success',
                summary: req.body.cachedAuditSummary || `Usuario eliminado: ${email || userId}`,
                details: { userId, authUID, email },
                executor: "admin"
            });
        }

        return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}

// --- SUB-HANDLER: ASSIGN SOCIO ---
async function handleAssignSocio(req, res, db) {
    const { docId, sendWelcome } = req.body;
    if (!docId) return res.status(400).json({ ok: false, error: "Falta docId" });
    try {
        // 1. Leer config para días de vencimiento
        const configSnap = await db.collection('config').doc('general').get();
        const config = configSnap.exists ? configSnap.data() : {};
        const siteName = config.siteName || 'Club Fidelidad';

        const contadorRef = db.collection('config').doc('counters');
        const clienteRef = db.collection("users").doc(docId);
        let assignedNumber = null;

        await db.runTransaction(async (tx) => {
            const [cSnap, uSnap] = await Promise.all([tx.get(contadorRef), tx.get(clienteRef)]);
            if (!uSnap.exists) throw new Error("Cliente no encontrado");
            if (uSnap.data().numeroSocio) { assignedNumber = uSnap.data().numeroSocio; return; }
            let nextNum = (cSnap.exists ? Number(cSnap.data().lastSocioId || 999) : 999) + 1;
            tx.set(contadorRef, { lastSocioId: nextNum }, { merge: true });
            tx.update(clienteRef, { socioNumber: nextNum, numeroSocio: nextNum });
            assignedNumber = nextNum;
        });

        // 2. Leer datos del cliente (despues de la transacción)
        const clientSnap = await clienteRef.get();
        const clientData = clientSnap.data() || {};
        const userName = clientData.name || clientData.nombre || 'Socio';
        const userEmail = clientData.email || '';

        // 3. Registrar puntos de bienvenida en points_history (con expiresAt)
        if (sendWelcome) {
            const bonusDetails = clientData.metadata?.bonusDetails || {};
            const wPoints = Number(bonusDetails.welcome || 0);
            const aPoints = Number(bonusDetails.address || 0);
            const totalBonus = wPoints + aPoints;

            const expirationRules = config.expirationRules || [];
            const validityDays = getValidityDays(totalBonus, expirationRules);

            // Calcular fecha de vencimiento usando reglas de escala
            const now = await getEffectiveDate(db, req.query?.simulatedDate || req.body?.simulatedDate);
            const expirationDate = new Date(now);
            expirationDate.setDate(expirationDate.getDate() + validityDays);
            const expY = expirationDate.getFullYear();
            const expM = String(expirationDate.getMonth() + 1).padStart(2, '0');
            const expD = String(expirationDate.getDate()).padStart(2, '0');
            const expirationDateStr = `${expD}/${expM}/${expY}`;

            const batch = db.batch();

            if (wPoints > 0) {
                const wRef = clienteRef.collection('points_history').doc();
                batch.set(wRef, {
                    amount: wPoints, moneySpent: 0, type: 'credit',
                    reason: 'welcome_signup', concept: 'Puntos de Bienvenida por registro',
                    date: admin.firestore.Timestamp.fromDate(now),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                    remainingPoints: wPoints, balanceAfter: clientData.points || totalBonus
                });
            }

            if (aPoints > 0) {
                const aRef = clienteRef.collection('points_history').doc();
                batch.set(aRef, {
                    amount: aPoints, moneySpent: 0, type: 'credit',
                    reason: 'profile_address', concept: 'Premio por completar dirección',
                    date: admin.firestore.Timestamp.fromDate(now),
                    createdAt: admin.firestore.FieldValue.serverTimestamp(),
                    expiresAt: admin.firestore.Timestamp.fromDate(expirationDate),
                    remainingPoints: aPoints, balanceAfter: clientData.points || totalBonus
                });
            }

            if (totalBonus > 0) {
                // Actualizar nextExpirationDate en el user doc
                batch.update(clienteRef, {
                    nextExpirationDate: `${expY}-${expM}-${expD}`,
                    nextExpirationAmount: totalBonus,
                    accumulated_balance: admin.firestore.FieldValue.increment(totalBonus)
                });
            }

            // Inbox: mensaje de bienvenida (siempre, con o sin puntos)
            const inboxRef = clienteRef.collection('inbox').doc(`welcome_${docId}`);
            batch.set(inboxRef, {
                title: `¡Bienvenido/a a ${siteName}! 🎉`,
                body: totalBonus > 0
                    ? `Tu cuenta fue creada con éxito. Número de socio: #${assignedNumber}. ¡Recibiste ${totalBonus} puntos de bienvenida que vencen el ${expirationDateStr}!`
                    : `Tu cuenta fue creada con éxito. Número de socio: #${assignedNumber}. ¡Ya podés empezar a acumular puntos!`,
                url: '/', type: 'welcome', read: false,
                date: admin.firestore.FieldValue.serverTimestamp(),
                expireAt: admin.firestore.Timestamp.fromDate(new Date(now.getTime() + 7776000000))
            });

            await batch.commit();

            // AUDITORIA: Registro de finalización de alta (PWA)
            await db.collection('audit_logs').add({
                timestamp: admin.firestore.FieldValue.serverTimestamp(),
                type: 'user_created',
                status: 'success',
                summary: `Nuevo socio registrado (PWA): ${userName} (Socio #${assignedNumber}, DNI ${clientData.dni || 'N/A'})`,
                details: { userId: docId, email: userEmail, source: 'pwa' },
                executor: 'system'
            });

            // 4. Enviar email de bienvenida con datos correctos
            if (userEmail) {
                const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
                await fetch(`${baseUrl}/api/notifications?action=email`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.API_SECRET_KEY || "" },
                    body: JSON.stringify({
                        to: userEmail,
                        templateId: 'bienvenida',
                        // CRITICAL: Welcome email variables mapping.
                        // Do not modify these aliases (puntos, socio) as they are used in Admin Panel templates.
                        templateData: {
                            nombre: userName,
                            nombre_completo: userName, // Alias
                            numero_socio: assignedNumber,
                            socio: assignedNumber, // Alias
                            puntos_ganados: totalBonus,
                            puntos: totalBonus, // Alias
                            fecha_vencimiento: expirationDateStr,
                            siteName
                        }
                    })
                }).catch(console.error);
            }
        }

        return res.status(200).json({ ok: true, numeroSocio: assignedNumber });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}


export default async function handler(req, res) {
    applyCors(req, res);
    if (req.method === "OPTIONS") return res.status(204).end();
    const action = req.query?.action || req.body?.action || 'create';
    const db = initFirebaseAdmin().firestore();

    // Auth check
    const SECRET = (process.env.API_SECRET_KEY || "").trim();
    const receivedKey = req.headers["x-api-key"] || req.headers["X-API-Key"] || req.body?.apiKey;
    const authHeader = req.headers["authorization"];
    let authorized = (receivedKey && receivedKey === SECRET);
    if (!authorized && authHeader?.startsWith("Bearer ")) {
        try { await admin.auth().verifyIdToken(authHeader.split("Bearer ")[1]); authorized = true; } catch (e) { }
    }
    if (!authorized) return res.status(401).json({ ok: false, error: "Unauthorized" });

    switch (action) {
        case 'create': return handleCreate(req, res, db);
        case 'delete': return handleDelete(req, res, db);
        case 'assign-socio': return handleAssignSocio(req, res, db);
        default: return res.status(400).json({ ok: false, error: "Invalid action" });
    }
}
