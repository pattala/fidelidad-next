// /api/send-notification.js
// Envío de notificaciones FCM en modo "data-only" + TRACKING "sent" por usuario.
//
// Env vars (Vercel):
// - GOOGLE_CREDENTIALS_JSON
// - API_SECRET_KEY
// - CORS_ALLOWED_ORIGINS ("https://rampet.vercel.app,http://127.0.0.1:5500")
// - (opcional) PUSH_ICON_URL, PUSH_BADGE_URL

import admin from "firebase-admin";

// ---------- Inicialización Firebase Admin (singleton) ----------
function initFirebaseAdmin() {
  if (!admin.apps.length) {
    const credsRaw = process.env.GOOGLE_CREDENTIALS_JSON || "";
    if (!credsRaw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON en variables de entorno.");

    let creds;
    try {
      creds = JSON.parse(credsRaw);
    } catch {
      const fallback = credsRaw.replace(/\\n/g, "\n");
      creds = JSON.parse(fallback);
    }

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
function getDb() { initFirebaseAdmin(); return admin.firestore(); }

// ---------- Utils ----------
function unique(arr = []) {
  return [...new Set((arr || []).filter(Boolean).map(s => String(s).trim()).filter(Boolean))];
}
function chunkArray(arr = [], size = 500) {
  const out = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}
function isInvalidTokenError(code = "") {
  return code.includes("registration-token-not-registered")
    || code.includes("invalid-registration-token")
    || code.includes("messaging/registration-token-not-registered")
    || code.includes("messaging/invalid-registration-token")
    || code.includes("invalid-argument"); // Admin SDK puede mapear así
}

// ---------- Utilidades CORS / Auth ----------
function parseAllowedOrigins() {
  const raw = (process.env.CORS_ALLOWED_ORIGINS || "").trim();
  if (!raw) return [];
  return raw.split(",").map((s) => s.trim()).filter(Boolean);
}
function applyCors(req, res) {
  const allowed = parseAllowedOrigins();
  const origin = req.headers.origin || "";
  if (allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
  }
  res.setHeader("Access-Control-Allow-Headers", "Content-Type, x-api-key, Authorization");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
}
function ensureAuth(req) {
  const required = process.env.API_SECRET_KEY || "";
  if (!required) return true; // (no recomendado en prod)
  const got = req.headers["x-api-key"] || req.headers["X-API-Key"];
  return got === required;
}
function asStringRecord(obj = {}) {
  const out = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v === undefined || v === null) continue;
    out[k] = String(v);
  }
  return out;
}

// ---------- Resolución de destinatarios ----------
// Devuelve una lista de { id: clienteId, token } (uno por token).
// Devuelve una lista de { id: clienteId, token: string | null }
async function resolveDestinatarios({ db, tokens = [], audience, clienteId }) {
  const out = [];

  // Helper: trae docs de una lista de ids
  async function fetchDocIds(docIds) {
    const ids = unique(docIds);
    for (let i = 0; i < ids.length; i += 10) {
      const batch = ids.slice(i, i + 10);
      const snap = await db.collection("users")
        .where(admin.firestore.FieldPath.documentId(), "in", batch)
        .get();
      snap.forEach(doc => {
        const data = doc.data() || {};
        const toks = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
        if (toks.length === 0) {
          out.push({ id: doc.id, token: null });
        } else {
          toks.forEach(tk => {
            const clean = String(tk || "").trim();
            if (clean) out.push({ id: doc.id, token: clean });
          });
        }
      });
    }
  }

  // 1) Audience explícito
  if (audience && Array.isArray(audience.docIds) && audience.docIds.length) {
    await fetchDocIds(audience.docIds);
  }

  // 2) Caso "uno"
  if (clienteId) {
    const snap = await db.collection("users").doc(String(clienteId)).get();
    if (snap.exists) {
      const data = snap.data() || {};
      const toks = Array.isArray(data.fcmTokens) ? data.fcmTokens : [];
      if (toks.length === 0) {
        out.push({ id: snap.id, token: null });
      } else {
        toks.forEach(tk => {
          const clean = String(tk || "").trim();
          if (clean) out.push({ id: snap.id, token: clean });
        });
      }
    }
  }

  // 3) Tokens explícitos (buscar dueño para tracking)
  if (Array.isArray(tokens) && tokens.length) {
    for (const tkRaw of tokens) {
      const tk = String(tkRaw || "").trim();
      if (!tk) continue;
      const q = await db.collection("users")
        .where("fcmTokens", "array-contains", tk)
        .limit(1).get();
      if (!q.empty) {
        out.push({ id: q.docs[0].id, token: tk });
      } else {
        // Token sin dueño conocido (pero se enviará igual por FCM)
        out.push({ id: "unknown", token: tk });
      }
    }
  }

  // De-dup por combinación (clienteId + token)
  const seen = new Set();
  return out.filter(d => {
    const key = `${d.id}|${d.token}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

// ---------- Tracking en Inbox ----------
// Crea/mergea el doc en clientes/{clienteId}/inbox/{notifId}. Si viene token, lo guarda.
async function createInboxSent({ db, clienteId, notifId, dataForDoc, token }) {
  const ref = db.collection("users").doc(clienteId).collection("inbox").doc(notifId);
  const base = {
    title: dataForDoc.title || "",
    body: dataForDoc.body || "",
    url: dataForDoc.url || "/notificaciones",
    tag: dataForDoc.tag || null,
    source: dataForDoc.source || "simple",
    campaignId: dataForDoc.campaignId || null,
    status: "sent",
    read: false, // Important for the PWA notification counter
    sentAt: admin.firestore.FieldValue.serverTimestamp(),
    date: admin.firestore.FieldValue.serverTimestamp(),
    expireAt: admin.firestore.Timestamp.fromDate(
      new Date(Date.now() + 90 * 24 * 60 * 60 * 1000)
    ),
  };
  if (token) base.token = token; // no sobreescribimos con null
  await ref.set(base, { merge: true });
  return ref.id;
}

// ---------- Handler principal ----------
export default async function handler(req, res) {
  applyCors(req, res);

  if (req.method === "OPTIONS") return res.status(204).end();
  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method not allowed. Use POST." });
  }

  const apiKey = req.headers["x-api-key"] || req.headers["X-API-Key"];
  const authHeader = req.headers["authorization"];

  let isAuthorized = false;
  const SECRET_RAW = process.env.API_SECRET_KEY || process.env.MI_API_SECRET || process.env.VITE_API_KEY || "";
  const SECRET = SECRET_RAW.trim();
  const receivedApiKeyRaw = req.headers["x-api-key"] || req.headers["x-api-secret"] || "";
  const receivedApiKey = String(receivedApiKeyRaw).trim();

  const match = (receivedApiKey && SECRET && receivedApiKey === SECRET);

  console.log(`[send-notification] Auth check:`, {
    receivedKeyLen: receivedApiKey.length,
    secretLen: SECRET.length,
    match,
    hasAuthHeader: !!authHeader,
    permissive: !SECRET || !receivedApiKey
  });

  if (!SECRET || !receivedApiKey) {
    isAuthorized = true;
  } else if (match) {
    isAuthorized = true;
  } else if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.split("Bearer ")[1]?.trim();
    if (token === SECRET) {
      isAuthorized = true;
    } else {
      try {
        await admin.auth().verifyIdToken(token);
        isAuthorized = true;
      } catch (e) {
        console.error("[send-notification] Bearer token verification failed:", e.message);
      }
    }
  }

  if (!isAuthorized) {
    return res.status(401).json({ ok: false, error: "Unauthorized" });
  }

  // Body
  let body;
  try {
    body = typeof req.body === "string" ? JSON.parse(req.body) : req.body;
  } catch {
    return res.status(400).json({ ok: false, error: "Invalid JSON body." });
  }

  const {
    title = "",
    body: msgBody = "",
    tokens: tokensIn = [],
    click_action = "/mis-puntos",
    icon,
    badge,
    extraData = {},           // { url, tag, source, campaignId, ... }
    audience,                 // { docIds: [...] }
    clienteId,                // cuando es "uno"
  } = body || {};

  if (!title || !msgBody) {
    return res.status(400).json({ ok: false, error: "Falta title/body." });
  }

  const db = getDb();

  // ====== Normalizar tokens de entrada ======
  let tokens = unique(tokensIn);

  // Si no trajeron tokens pero mandan clienteId → obtenemos los del cliente
  if (!tokens.length && clienteId) {
    try {
      const snap = await db.collection("users").doc(String(clienteId)).get();
      const dataC = snap.exists ? snap.data() : null;
      const fromCliente = Array.isArray(dataC?.fcmTokens) ? dataC.fcmTokens : [];
      tokens = unique(fromCliente);
    } catch (e) {
      console.error("Error resolviendo tokens por clienteId:", e?.message || e);
    }
  }

  // ====== Resolver destinatarios para enviar y para tracking ======
  // (Incluye audience.docIds → ahora SÍ se usan para ENVIAR)
  let destinatarios = [];
  try {
    destinatarios = await resolveDestinatarios({ db, tokens, audience, clienteId });
  } catch (e) {
    console.error("resolveDestinatarios error:", e?.message || e);
  }

  // Tokens para envío FCM (solo los no nulos e únicos)
  let sendTokens = unique([...tokens, ...destinatarios.filter(d => d.token).map(d => d.token)]);

  // ====== notifId (único por envío) ======
  const notifId = db.collection("_ids").doc().id;

  // ====== DATA para FCM (strings) ======
  const data = asStringRecord({
    id: notifId,
    title,
    body: msgBody,
    click_action,
    url: (extraData && extraData.url) ? extraData.url : click_action,
    icon: icon || process.env.PUSH_ICON_URL || "",
    badge: badge || process.env.PUSH_BADGE_URL || "",
    type: "simple",
    ...extraData,
  });

  // ====== Envío FCM (Transporte) ======
  let successCount = 0, failureCount = 0;
  const invalidTokens = new Set();
  const perToken = []; // { token, success, errorCode, errorMessage }

  if (sendTokens.length > 0) {
    // Config común a todos los lotes
    // Enviamos solo DATA para evitar "Doble Notificación" (SW + Browser default)
    const baseMsg = {
      data,
      webpush: {
        fcmOptions: { link: data.url || "/notificaciones" }
      },
      android: {
        priority: "high"
      }
    };

    console.log("FCM about to send:", JSON.stringify({ tokensCount: sendTokens.length, withAudience: !!(audience?.docIds?.length) }));

    const adminApp = initFirebaseAdmin();
    const batches = chunkArray(sendTokens, 500);

    for (const batchTokens of batches) {
      const message = { ...baseMsg, tokens: batchTokens };
      const resp = await adminApp.messaging().sendEachForMulticast(message);

      successCount += resp.successCount || 0;
      failureCount += resp.failureCount || 0;

      (resp.responses || []).forEach((r, idx) => {
        const t = batchTokens[idx];
        const code = r.error?.errorInfo?.code || r.error?.code || null;
        if (!r.success && code && isInvalidTokenError(code)) invalidTokens.add(t);

        perToken.push({
          token: t,
          success: !!r.success,
          errorCode: code,
          errorMessage: r.error?.message || null,
        });
      });
    }
  } else {
    console.log(`[send-notification] Skipping FCM transport: No tokens found for client ${clienteId || 'N/A'}`);
  }

  // ====== Limpieza de tokens inválidos en Firestore ======
  if (invalidTokens.size) {
    try {
      const toClean = Array.from(invalidTokens);
      for (let i = 0; i < toClean.length; i += 10) {
        const part = toClean.slice(i, i + 10);
        const snap = await db.collection("users")
          .where("fcmTokens", "array-contains-any", part)
          .get();
        for (const doc of snap.docs) {
          const d = doc.data() || {};
          const nuevos = (d.fcmTokens || []).filter(tk => !toClean.includes(tk));
          await doc.ref.update({ fcmTokens: nuevos });
          console.log(`🧹 Tokens inválidos eliminados de clientes/${doc.id}`);
        }
      }
    } catch (cleanErr) {
      console.error("Error limpiando tokens inválidos:", cleanErr);
    }
  }

  // ====== Tracking "sent" en Firestore (1 doc por cliente) ======
  // Si algunos tokens no tenían cliente mapeado, igual se enviaron,
  // pero acá sólo creamos inbox para los que sí mapean a clienteId.
  let createdInbox = 0;
  if (extraData?.skipInbox === true || extraData?.skipInbox === "true") {
    console.log("[send-notification] Skipping inbox tracking as requested by skipInbox flag.");
  } else {
    try {
      const dataForDoc = {
        title: data.title,
        body: data.body,
        url: data.url || data.click_action || "/notificaciones",
        tag: data.tag || null,
        source: extraData?.source || "simple",
        campaignId: extraData?.campaignId || null,
      };

      // Colapsar por cliente (primer token)
      const byClient = new Map();
      destinatarios.forEach(d => {
        if (!byClient.has(d.id)) byClient.set(d.id, d.token || null);
      });

      for (const [cid, anyToken] of byClient.entries()) {
        try {
          await createInboxSent({ db, clienteId: cid, notifId, dataForDoc, token: anyToken });
          createdInbox++;
        } catch (e) {
          console.error("inbox sent error", { cid, anyToken }, e?.message || e);
        }
      }
    } catch (e) {
      console.error("resolve destinatarios (tracking) error:", e?.message || e);
    }
  }

  // ====== GUARDAR LOG DE AUDITORÍA ======
  try {
    const details = destinatarios.map(d => {
      return {
        userId: d.id,
        userName: d.id === 'unknown' ? 'Dispositivo Desconocido' : 'Socio',
        action: 'push_sent',
        status: 'success',
        info: d.token ? `Token: ${d.token.substring(0, 8)}...` : 'Sin token'
      };
    });

    // Como queremos nombres reales, hacemos una pasada rápida por los IDs únicos
    const uniqueIds = unique(destinatarios.map(d => d.id)).filter(id => id !== 'unknown');
    const userNamesMap = {};
    if (uniqueIds.length > 0) {
      for (let i = 0; i < uniqueIds.length; i += 10) {
        const batch = uniqueIds.slice(i, i + 10);
        const snap = await db.collection("users").where(admin.firestore.FieldPath.documentId(), "in", batch).get();
        snap.forEach(doc => {
          const d = doc.data();
          userNamesMap[doc.id] = d.name || d.nombre || 'Socio';
        });
      }
    }

    const finalDetails = details.map(det => ({
      ...det,
      userName: userNamesMap[det.userId] || det.userName
    }));

    await db.collection('audit_logs').add({
      timestamp: admin.firestore.FieldValue.serverTimestamp(),
      type: 'push_notification',
      status: failureCount === 0 ? 'success' : (successCount > 0 ? 'partial' : 'failed'),
      summary: `Envío: "${title}". Éxito: ${successCount}, Falla: ${failureCount}`,
      details: finalDetails.slice(0, 500),
      executor: 'admin'
    });
  } catch (logErr) {
    console.error("Error saving audit log for notification:", logErr);
  }

  return res.status(200).json({
    ok: true,
    notifId,
    successCount,
    failureCount,
    invalidTokens: Array.from(invalidTokens),
    createdInbox,
    perToken
  });
}
