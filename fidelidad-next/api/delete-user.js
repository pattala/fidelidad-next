// api/delete-user.js
// Purga total SIEMPRE: borra doc en Firestore, datos relacionados (geo_raw, subcolecciones configurables)
// y también usuario en Firebase Auth (si existe).
// CORS robusto + x-api-key + lectura de body segura (sin req.body para evitar "Invalid JSON" en Vercel).

import admin from "firebase-admin";

/* ─────────────────────────────────────────────────────────────
   Firebase Admin
   ──────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   CORS
   ──────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   Body seguro
   ──────────────────────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────────────────────
   Resolver cliente
   ──────────────────────────────────────────────────────────── */
async function findClienteDoc(db, { docId, numeroSocio, authUID, email }) {
  const col = db.collection("users");

  if (docId) {
    const snap = await col.doc(docId).get();
    if (snap.exists) return { id: snap.id, data: snap.data() };
  }

  if (numeroSocio != null && numeroSocio !== "") {
    const n = Number(numeroSocio);
    if (!Number.isNaN(n)) {
      const q = await col.where("numeroSocio", "==", n).limit(1).get();
      if (!q.empty) {
        const d = q.docs[0];
        return { id: d.id, data: d.data() };
      }
    }
  }

  if (authUID) {
    const q = await col.where("authUID", "==", authUID).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, data: d.data() };
    }
  }

  if (email) {
    const q = await col.where("email", "==", String(email).toLowerCase()).limit(1).get();
    if (!q.empty) {
      const d = q.docs[0];
      return { id: d.id, data: d.data() };
    }
  }

  return null;
}

/* ─────────────────────────────────────────────────────────────
   NUEVO: Helpers de borrado en cascada
   ──────────────────────────────────────────────────────────── */

async function deleteByQueryPaged(db, makeQuery, label = "batch") {
  while (true) {
    const snap = await makeQuery().get();
    if (snap.empty) break;

    const batch = db.batch();
    snap.docs.forEach(d => batch.delete(d.ref));
    await batch.commit();
  }
  console.log(`[delete-user][cascade] ${label}: completo`);
}

async function deleteClienteSubcollections(db, docId) {
  const subs = ["geo_raw", "points_history", "inbox", "notifications"];
  for (const sub of subs) {
    const makeQuery = () => db.collection(`users/${docId}/${sub}`).limit(500);
    await deleteByQueryPaged(db, makeQuery, `users/${docId}/${sub}`);
  }
}

async function deleteLooseCollections(db, { uid, docId }) {
  const makeQueryUid = () => db.collection("geo_raw").where("uid", "==", uid).limit(500);
  await deleteByQueryPaged(db, makeQueryUid, `geo_raw where uid==${uid}`);

  const makeQueryDoc = () => db.collection("geo_raw").where("clienteId", "==", docId).limit(500);
  await deleteByQueryPaged(db, makeQueryDoc, `geo_raw where clienteId==${docId}`);
}

/* ─────────────────────────────────────────────────────────────
   Handler
   ──────────────────────────────────────────────────────────── */
export default async function handler(req, res) {
  const allowOrigin = getAllowedOrigin(req);
  setCors(res, allowOrigin);

  if (req.method === "OPTIONS") return res.status(204).end();

  if (req.method === "GET") {
    return res.status(200).json({
      ok: true,
      route: "/api/delete-user",
      corsOrigin: allowOrigin || null,
      project: "sistema-fidelizacion",
      tips: "POST con x-api-key y body { docId | numeroSocio | authUID | email } (purga total en cascada).",
    });
  }

  if (req.method !== "POST") {
    return res.status(405).json({ ok: false, error: "Method Not Allowed" });
  }

  // API key TEMPORARILY DISABLED
  // const clientKey = req.headers["x-api-key"];
  // if (!clientKey || clientKey !== process.env.API_SECRET_KEY) {
  //   return res.status(401).json({ ok: false, error: "Unauthorized" });
  // }

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
    const { docId, numeroSocio, authUID, email } = payload || {};

    if (!docId && !numeroSocio && !authUID && !email) {
      return res.status(400).json({
        ok: false,
        error: "Parámetros inválidos. Envíe al menos uno: docId | numeroSocio | authUID | email",
      });
    }

    const found = await findClienteDoc(db, { docId, numeroSocio, authUID, email });

    let deletedDocId = null;
    let matchedBy = null;
    let data = null;

    let resolvedDocId = found?.id || docId || null;
    let resolvedAuthUID = authUID || found?.data?.authUID || null;
    let resolvedEmail = email || found?.data?.email || null;

    if (found) {
      deletedDocId = found.id;
      data = found.data;
      matchedBy = docId ? "docId" : authUID ? "authUID" : email ? "email" : "numeroSocio";

      await deleteClienteSubcollections(db, found.id);
      await deleteLooseCollections(db, {
        uid: data?.authUID || resolvedAuthUID || "",
        docId: found.id
      });
      await db.collection("users").doc(found.id).delete();
    } else {
      matchedBy = docId ? "docId" : authUID ? "authUID" : email ? "email" : "numeroSocio";
      if (resolvedDocId || resolvedAuthUID) {
        await deleteLooseCollections(db, {
          uid: resolvedAuthUID || "",
          docId: resolvedDocId || ""
        });
      }
    }

    // 3) Borrar usuario en Auth
    initFirebaseAdmin();
    console.log('[delete-user] Inicio purga Auth. Payload:', JSON.stringify(payload));

    let uidToDelete = resolvedAuthUID || data?.authUID || null;
    console.log('[delete-user] UID resuelto:', uidToDelete);

    if (!uidToDelete) {
      const emailToResolve = resolvedEmail || data?.email;
      if (emailToResolve) {
        try {
          console.log('[delete-user] Buscando UID por email:', emailToResolve);
          const user = await admin.auth().getUserByEmail(String(emailToResolve).toLowerCase());
          uidToDelete = user.uid;
          console.log('[delete-user] UID encontrado:', uidToDelete);
        } catch (e) {
          console.log('[delete-user] Email no existe en Auth:', emailToResolve);
        }
      }
    }

    let authDeletion = null;
    if (uidToDelete) {
      try {
        await admin.auth().deleteUser(uidToDelete);
        console.log('[delete-user] AUTH DELETED OK:', uidToDelete);
        authDeletion = { deleted: true, uid: uidToDelete };
      } catch (e) {
        console.error('[delete-user] ERROR AUTH DELETE:', e);
        authDeletion = { deleted: false, uid: uidToDelete, error: e?.message || String(e) };
      }
    } else {
      console.log('[delete-user] No UID to delete.');
      authDeletion = { deleted: false, reason: "auth user not found" };
    }

    return res.status(200).json({
      ok: true,
      deletedDocId,
      matchedBy,
      authDeletion,
      cascade: { geo_raw: "done", subcollections: "done" }
    });

  } catch (err) {
    console.error("delete-user error:", err);
    return res.status(500).json({ ok: false, error: "Internal Server Error" });
  }
}
