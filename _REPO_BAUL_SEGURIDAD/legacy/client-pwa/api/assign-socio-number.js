
// api/assign-socio-number.js
// Asigna número de socio correlativo y envía email (opcional).
// Refactorizado para consistencia con create-user.js (CORS robusto, Auth check, Safe Parsing).

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
  // Configuración más permisiva por defecto para evitar errores CORS en setups nuevos
  const envAllowed = process.env.CORS_ALLOWED_ORIGINS;

  // Si no hay variable definida, permitimos el origen de la petición (modo desarrollo/demo)
  if (!envAllowed) return req.headers.origin || "*";

  const allowed = envAllowed.split(",").map(s => s.trim()).filter(Boolean);
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
  // En Vercel a veces req.body ya viene parseado si usas ciertos middleware,
  // pero para standard raw function:
  if (req.body && typeof req.body === 'object') return req.body;
  if (req.body && typeof req.body === 'string') {
    try { return JSON.parse(req.body); } catch { throw new Error("BAD_JSON"); }
  }
  // Fallback stream reading (raro en Vercel Functions modernas pero util)
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

// ---------- Config Email ----------
// URL para llamarse a sí mismo (email)
function getSelfBaseUrl(req) {
  if (process.env.PUBLIC_BASE_URL) return process.env.PUBLIC_BASE_URL;
  const host = req.headers.host;
  const proto = req.headers['x-forwarded-proto'] || 'https';
  return `${proto}://${host}`;
}

// ---------- Handler ----------
export default async function handler(req, res) {
  const allowOrigin = getAllowedOrigin(req);
  setCors(res, allowOrigin);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // API key Check (Seguridad)
  const clientKey = req.headers["x-api-key"];
  if (process.env.API_SECRET_KEY && (!clientKey || clientKey !== process.env.API_SECRET_KEY)) {
    console.warn("Unauthorized attempt to assign-socio-number");
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Body Parsing
  let payload = {};
  try {
    payload = await readJsonBody(req);
  } catch (e) {
    return res.status(400).json({ ok: false, error: "Invalid JSON body" });
  }

  const { docId, sendWelcome } = payload;
  if (!docId) {
    return res.status(400).json({ ok: false, error: "Falta docId" });
  }

  // Lógica de negocio
  try {
    const db = getDb();
    const contadorRef = db.collection('configuracion').doc('contadores');
    const clienteRef = db.collection('clientes').doc(docId);

    let datosClienteParaEmail = null;
    let assignedNumber = null;
    let alreadyHadNumber = false;

    await db.runTransaction(async (tx) => {
      const [contadorDoc, clienteDoc] = await Promise.all([
        tx.get(contadorRef),
        tx.get(clienteRef),
      ]);

      if (!clienteDoc.exists) throw new Error("Cliente no encontrado");

      const data = clienteDoc.data();
      if (data.numeroSocio) {
        alreadyHadNumber = true;
        assignedNumber = data.numeroSocio;
        return;
      }

      // Calcular nuevo número
      let nextNum = 1;
      if (contadorDoc.exists && contadorDoc.data().ultimoNumeroSocio) {
        nextNum = contadorDoc.data().ultimoNumeroSocio + 1;
      }

      // Escribir
      tx.set(contadorRef, { ultimoNumeroSocio: nextNum }, { merge: true });
      tx.update(clienteRef, { numeroSocio: nextNum });

      assignedNumber = nextNum;
      datosClienteParaEmail = {
        id_cliente: docId,
        nombre: data.nombre,
        email: data.email,
        puntos_ganados: data.puntos || 0,
        numero_socio: nextNum
      };
    });

    if (alreadyHadNumber) {
      return res.status(200).json({
        ok: true,
        numeroSocio: assignedNumber,
        message: "El cliente ya tenía número de socio.",
        emailEnviado: false
      });
    }

    // Enviar email si corresponde
    let mailResult = null;
    if (sendWelcome && datosClienteParaEmail) {
      try {
        const baseUrl = getSelfBaseUrl(req);
        // Llamada interna a la API de email
        const r = await fetch(`${baseUrl}/api/send-email`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': process.env.API_SECRET_KEY || ''
          },
          body: JSON.stringify({
            to: datosClienteParaEmail.email,
            templateId: 'bienvenida',
            templateData: {
              nombre: datosClienteParaEmail.nombre,
              numero_socio: datosClienteParaEmail.numero_socio,
              puntos_ganados: datosClienteParaEmail.puntos_ganados,
              id_cliente: datosClienteParaEmail.id_cliente
            }
          })
        });
        mailResult = await r.json().catch(() => ({}));
      } catch (errEmail) {
        console.error("Error enviando email welcome:", errEmail);
        mailResult = { error: "Failed to send email" };
      }
    }

    return res.status(200).json({
      ok: true,
      numeroSocio: assignedNumber,
      emailEnviado: !!(sendWelcome && datosClienteParaEmail),
      mail: mailResult
    });

  } catch (error) {
    console.error("assign-socio-number error:", error);
    return res.status(500).json({ ok: false, error: error.message });
  }
}
