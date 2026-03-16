// /api/users.js
// Consolidated users API: Create, Delete, and Assign Socio Number.
// Actions: 'create' (default), 'delete', 'assign-socio'

import admin from "firebase-admin";

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
        let { email, dni, nombre, telefono, numeroSocio, fechaNacimiento, fechaInscripcion, domicilio, docId, termsAccepted, termsAcceptedAt } = payload || {};
        if (!email || !dni) return res.status(400).json({ ok: false, error: "Faltan email y dni" });

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
            authUID, role: "client", estado: "activo",
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        };

        if (termsAccepted !== undefined) fsPayload.termsAccepted = termsAccepted;
        if (termsAcceptedAt) fsPayload.termsAcceptedAt = termsAcceptedAt;
        if (fechaNacimiento) fsPayload.fechaNacimiento = fechaNacimiento;
        if (fechaInscripcion) fsPayload.fechaInscripcion = fechaInscripcion;
        if (domicilio) fsPayload.domicilio = { ...domicilio, updatedAt: new Date() };

        if (!fsDocSnap.empty) {
            fsDocRef = fsDocSnap.docs[0].ref;
            await fsDocRef.set(fsPayload, { merge: true });
        } else {
            fsDocRef = col.doc(docId || authUID);
            await fsDocRef.set({ ...fsPayload, createdAt: admin.firestore.FieldValue.serverTimestamp(), fcmTokens: [] });
            createdFs = true;
        }

        return res.status(200).json({ ok: true, auth: { uid: authUID, created: createdAuth }, firestore: { docId: fsDocRef.id, created: createdFs } });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}

// --- SUB-HANDLER: DELETE USER ---
async function handleDelete(req, res, db) {
    const { docId, authUID: provAuthUID, email: provEmail } = req.body;
    if (!docId && !provAuthUID && !provEmail) return res.status(400).json({ ok: false, error: "Falta identificador" });
    try {
        let userId = docId, authUID = provAuthUID, email = provEmail;
        if (userId) {
            const snap = await db.collection("users").doc(userId).get();
            if (snap.exists) {
                const userData = snap.data();
                authUID = userData.authUID;
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

            const snap = await db.collection("users").where("email", "==", provEmail.toLowerCase()).limit(1).get();
            if (!snap.empty) { userId = snap.docs[0].id; authUID = snap.docs[0].data().authUID; }
        }

        if (userId) {
            await db.collection("users").doc(userId).delete();
            // Cascade delete subcollections (simplified for consolidate)
            const subs = ["points_history", "inbox", "visit_history"];
            for (const s of subs) {
                const snap = await db.collection(`users/${userId}/${s}`).get();
                const batch = db.batch();
                snap.forEach(d => batch.delete(d.ref));
                await batch.commit();
            }
        }
        if (authUID) await admin.auth().deleteUser(authUID).catch(() => { });
        else if (email) {
            const user = await admin.auth().getUserByEmail(email).catch(() => null);
            if (user) await admin.auth().deleteUser(user.uid);
        }
        return res.status(200).json({ ok: true });
    } catch (e) { return res.status(500).json({ ok: false, error: e.message }); }
}

// --- SUB-HANDLER: ASSIGN SOCIO ---
async function handleAssignSocio(req, res, db) {
    const { docId, sendWelcome } = req.body;
    if (!docId) return res.status(400).json({ ok: false, error: "Falta docId" });
    try {
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

        if (sendWelcome) {
            const baseUrl = process.env.PUBLIC_BASE_URL || `https://${req.headers.host}`;
            await fetch(`${baseUrl}/api/notifications?action=email`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': process.env.API_SECRET_KEY || "" },
                body: JSON.stringify({ to: (await clienteRef.get()).data().email, templateId: 'bienvenida', templateData: { numero_socio: assignedNumber, nombre: (await clienteRef.get()).data().nombre } })
            }).catch(console.error);
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
