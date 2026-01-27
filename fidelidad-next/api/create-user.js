// api/create-user.js
// Alta de usuario (Auth + Firestore) con CORS + x-api-key + lectura de body segura.
// Idempotente: si ya existe en Auth/Firestore, completa lo que falte y responde ok.
// ✨ Cambios: admite domicilio (opcional) => domicilio.status/addressLine/components + auditoría.

import admin from "firebase-admin";

// ---------- Firebase Admin ----------
function initFirebaseAdmin() {
  if (admin.apps.length) return;

  const raw = process.env.GOOGLE_CREDENTIALS_JSON;
  if (!raw) throw new Error("GOOGLE_CREDENTIALS_JSON missing");

  let sa;
  try { sa = JSON.parse(raw); }
  catch { throw new Error("Invalid GOOGLE_CREDENTIALS_JSON (not valid JSON)"); }

  admin.initializeApp({
    credential: admin.credential.cert(sa),
  });
}

function getDb() {
  initFirebaseAdmin();
  return admin.firestore();
}

// ---------- CORS ----------
function getAllowedOrigin(req) {
  const allowed = (process.env.CORS_ALLOWED_ORIGINS || "")
    .split(",")
    .map(s => s.trim())
    .filter(Boolean);
  const origin = req.headers.origin;
  if (origin && allowed.includes(origin)) return origin;
  return allowed[0] || "";
}

function setCors(res, origin) {
  if (origin) res.setHeader("Access-Control-Allow-Origin", origin);
  res.setHeader("Vary", "Origin");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS, GET");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
}

// ---------- Body seguro ----------
async function readJsonBody(req) {
  try {
    const chunks = [];
    for await (const c of req) chunks.push(c);
    const raw = Buffer.concat(chunks).toString("utf8");
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    const e = new Error("BAD_JSON");
    e.code = "BAD_JSON";
    throw e;
  }
}

// ---------- Util ----------
function nowTs() {
  return admin.firestore.FieldValue.serverTimestamp();
}

// ---------- Handler ----------
export default async function handler(req, res) {
  const allowOrigin = getAllowedOrigin(req);
  setCors(res, allowOrigin);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "/api/create-user",
      corsOrigin: allowOrigin || null,
      project: "sistema-fidelizacion",
      tips: "POST con x-api-key y body { email, dni(password), nombre?, telefono?, numeroSocio?, fechaNacimiento?, fechaInscripcion?, domicilio? }",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // API key
  // API key DISABLED
  // const clientKey = req.headers["x-api-key"];
  // if (!clientKey || clientKey !== process.env.API_SECRET_KEY) {
  //   return res.status(401).json({ ok: false, error: "Unauthorized" });
  // }

  // Body
  let payload = {};
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    if (e.code === "BAD_JSON") {
      return res.status(400).json({ ok: false, error: "Invalid JSON body" });
    }
    return res.status(400).json({ ok: false, error: "Invalid request body" });
  }

  try {
    const db = getDb();

    // Campos esperados (algunos opcionales)
    let {
      email,            // obligatorio
      dni,              // password por default
      nombre,           // opcional
      telefono,         // opcional
      numeroSocio,      // opcional
      fechaNacimiento,  // opcional (yyyy-mm-dd)
      fechaInscripcion, // opcional (yyyy-mm-dd)
      domicilio,        // opcional: { status, addressLine?, components? }
      docId             // opcional (fijar ID del doc)
    } = payload || {};

    // Validaciones mínimas
    if (!email || !dni) {
      return res.status(400).json({ ok: false, error: "Faltan campos obligatorios: email y dni" });
    }
    // 0. Normalización y Validaciones Previas
    email = String(email).toLowerCase().trim();
    dni = String(dni).trim();

    // Validación Email
    if (!email.match(/^[^\s@]+@[^\s@]+\.[^\s@]+$/)) {
      return res.status(400).json({ ok: false, error: "Formato de email inválido" });
    }

    // Validación y Corrección DNI (Password)
    // Firebase pide min 6 chars. Si DNI < 6, agregar ceros adelante.
    if (dni.length < 6) {
      dni = dni.padStart(6, '0');
    }

    // Normalizar Teléfono (si existe)
    // Antes de procesar telefono, validamos unicidad de DNI en BD
    const dbDniRef = getDb();
    const snapDni = await dbDniRef.collection('users').where('dni', '==', dni).limit(1).get();
    if (!snapDni.empty) {
      const foundDniData = snapDni.docs[0].data();
      // Si el DNI existe pero el email es distinto, es colisión.
      // Si el email es el mismo, es el mismo usuario actualizando.
      if (foundDniData.email !== email) {
        return res.status(400).json({
          ok: false,
          error: `El DNI ${dni} ya está registrado en el sistema con otro email.`
        });
      }
    }

    let formattedPhone = undefined;
    if (telefono) {
      // Estrategia Robustez WhatsApp (+54 9 ...)
      let val = String(telefono).replace(/\D/g, "");

      // 2. Manejo de prefijos argentinos típicos
      if (val.startsWith("549") && val.length > 10) {
        // ok, formato perfecto
      } else if (val.startsWith("54") && val.length > 10) {
        // Viene con 54 pero sin 9? (ej 5411...) -> agregar 9
        if (!val.startsWith("549") && (val.startsWith("5411") || val.startsWith("5415") || val.startsWith("542") || val.startsWith("543"))) {
          val = val.replace("54", "549");
        }
      } else {
        // Input local (011..., 15..., 11...)
        // Quitar "0" inicial (011 -> 11)
        if (val.startsWith("0")) val = val.substring(1);

        // Quitar "15" inicial (si es que la gente pone 154444... asumiendo celular)
        // Nota: esto es delicado porque algunos codigos de area empiezan con 1, pero bueno, prioridad celular
        // Si tiene 10 digitos (ej 11 1234 5678) -> +54 9 11 ...
        if (val.length === 10) {
          val = "549" + val;
        } else if (val.length > 10) {
          // Si es largo y no tiene prefijo país, asumimos error o ya tiene 54
          if (!val.startsWith("54")) val = "549" + val;
        }
      }

      if (!val.startsWith("54")) val = "54" + val; // Fallback final
      formattedPhone = `+${val}`;
    }

    // 1) Auth: Gestión de Usuario
    initFirebaseAdmin();
    let authUser = null;
    let createdAuth = false;
    console.log('[create-user] Payload received:', { email, dni, phone: formattedPhone });

    try {
      // A. Verificar existencia por EMAIL
      try {
        authUser = await admin.auth().getUserByEmail(email);
        console.log('[create-user] User exists (Email match):', authUser.uid);
      } catch (e) {
        if (e.code !== 'auth/user-not-found') throw e;
      }

      // B. Verificar existencia por TELÉFONO (si no encontró por email y hay teléfono)
      if (!authUser && formattedPhone) {
        try {
          const authUserByPhone = await admin.auth().getUserByPhoneNumber(formattedPhone);
          // Si encontramos usuario por teléfono, chequeamos si el email coincide.
          // Si el email es distinto, es un conflicto: NO debemos sobreescribir.
          if (authUserByPhone.email && authUserByPhone.email !== email) {
            return res.status(400).json({
              ok: false,
              error: `El teléfono ${formattedPhone} ya está registrado por otro usuario (${authUserByPhone.email}). Usá un teléfono único.`
            });
          }
          // Si no tiene email o coincide, asumimos que es el mismo usuario
          authUser = authUserByPhone;
          console.log('[create-user] User exists (Phone match):', authUser.uid);
        } catch (e) {
          if (e.code !== 'auth/user-not-found') throw e;
        }
      }

      // C. Lógica de Creación o Actualización
      if (authUser) {
        // --- ACTUALIZAR ---
        console.log('[create-user] Updating existing user:', authUser.uid);

        // Preparar updates
        const updateData = {
          disabled: false // Reactivar siempre
        };

        // Solo actualizar password si el DNI cambió (para no romper otras flows, o forzar siempre)
        updateData.password = dni;

        if (nombre) updateData.displayName = nombre;

        // Actualizar email si difiere (OJO: puede fallar si el nuevo email está en uso por OTRO user)
        if (authUser.email !== email) {
          updateData.email = email;
          updateData.emailVerified = false;
        }

        // Actualizar teléfono si se proveyó y difiere
        if (formattedPhone && authUser.phoneNumber !== formattedPhone) {
          updateData.phoneNumber = formattedPhone;
        }

        await admin.auth().updateUser(authUser.uid, updateData);
        console.log('[create-user] User Updated Successfully');

      } else {
        // --- CREAR ---
        console.log('[create-user] Creating new user...');

        const createData = {
          email,
          password: dni,
          displayName: nombre || "",
          emailVerified: false,
          disabled: false,
        };

        if (formattedPhone) {
          createData.phoneNumber = formattedPhone;
        }

        authUser = await admin.auth().createUser(createData);
        createdAuth = true;
        console.log('[create-user] User Created. UID:', authUser.uid);
      }

    } catch (authError) {
      console.error('[create-user] Auth Error:', authError);

      // Mapeo de errores comunes para devolver mensaje claro
      const code = authError.errorInfo?.code || authError.code;
      let msg = "Error en autenticación";

      if (code === 'auth/email-already-exists') msg = "El email ya está siendo usado por otro usuario.";
      if (code === 'auth/phone-number-already-exists') msg = "El teléfono ya está registrado en otra cuenta.";
      if (code === 'auth/invalid-phone-number') msg = "El número de teléfono no es válido.";
      if (code === 'auth/invalid-email') msg = "El formato del email es incorrecto.";
      if (code === 'auth/weak-password') msg = "El DNI es demasiado corto para ser contraseña (min 6).";

      return res.status(400).json({ ok: false, error: msg, code: code });
    }

    const authUID = authUser.uid;

    // 2) Firestore: crear/actualizar doc cliente
    const col = db.collection("users");

    // Intentar encontrar doc existente por email
    const fsDocSnap = await col.where("email", "==", email).limit(1).get();
    let fsDocRef = null;
    let createdFs = false;

    // Helper: construir payload con campos opcionales
    const buildFsPayload = (isNew) => {
      const base = {
        email,
        dni: dni, // Guardar explícitamente en BD
        nombre: isNew ? (nombre || "") : (nombre ?? admin.firestore.FieldValue.delete()),
        telefono: isNew ? (telefono || "") : (telefono ?? admin.firestore.FieldValue.delete()),
        numeroSocio: (numeroSocio != null)
          ? Number(numeroSocio)
          : (isNew ? null : admin.firestore.FieldValue.delete()),
        authUID,
        estado: "activo",
      };

      // campos de fecha opcionales (si vienen)
      if (fechaNacimiento) base.fechaNacimiento = fechaNacimiento;
      if (fechaInscripcion) base.fechaInscripcion = fechaInscripcion;

      // domicilio opcional (status/partial/complete)
      if (domicilio && domicilio.status) {
        base.domicilio = {
          status: domicilio.status,
          addressLine: domicilio.addressLine || "",
          components: domicilio.components || {},
          updatedBy: "admin",
          updatedAt: nowTs(),
        };
      }

      if (isNew) {
        base.fcmTokens = [];
        base.createdAt = nowTs();
        base.updatedAt = nowTs();
      } else {
        base.updatedAt = nowTs();
      }
      return base;
    };

    if (!fsDocSnap.empty) {
      // existe → merge
      fsDocRef = fsDocSnap.docs[0].ref;
      const fsPayload = buildFsPayload(false);
      await fsDocRef.set(fsPayload, { merge: true });
    } else {
      // nuevo → usar authUID como ID si existe (paridad PWA), sino docId opcional o random
      const finalDocId = docId || authUID;
      fsDocRef = finalDocId ? col.doc(finalDocId) : col.doc();

      const newDoc = buildFsPayload(true);
      await fsDocRef.set(newDoc);
      createdFs = true;
    }

    return res.status(200).json({
      ok: true,
      auth: { uid: authUID, created: createdAuth },
      firestore: { docId: fsDocRef.id, created: createdFs },
    });

  } catch (err) {
    console.error("create-user error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}
