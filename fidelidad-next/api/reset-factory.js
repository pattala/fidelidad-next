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

async function deleteUserCascaded(db, docId) {
    const subs = ["points_history", "notifications", "inbox", "interacciones", "geo_raw"];
    for (const sub of subs) {
        const makeQuery = () => db.collection(`users/${docId}/${sub}`).limit(500);
        await deleteByQueryPaged(db, makeQuery, `users/${docId}/${sub}`);
    }
    await db.collection("users").doc(docId).delete();
}

export default async function handler(req, res) {
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "Method Not Allowed" });

    const { confirmText } = req.body || {};
    if (confirmText !== "RESET") {
        return res.status(400).json({ ok: false, error: "Debe enviar 'RESET' para confirmar la operacion." });
    }

    try {
        initFirebaseAdmin();
        const db = admin.firestore();

        // 1. Obtener todos los usuarios no-admin
        const usersSnap = await db.collection("users").where("role", "!=", "admin").get();
        const deletePromises = usersSnap.docs.map(doc => deleteUserCascaded(db, doc.id));
        await Promise.all(deletePromises);

        // 2. Limpiar colecciones raiz globales
        const rootCols = ["geo_raw", "transactions"];
        const rootCounts = {};
        for (const col of rootCols) {
            rootCounts[col] = await deleteByQueryPaged(db, () => db.collection(col).limit(500), col);
        }

        // 3. Opcional: Podriamos intentar borrar de Auth aqui tambien, 
        // pero es mas seguro que el Admin maneje sus usuarios.
        // Si quisieramos, hariamos un listUsers() y deleteUsers().

        return res.status(200).json({
            ok: true,
            message: "Sistema reseteado correctamente.",
            deletedUsers: usersSnap.size,
            details: rootCounts
        });

    } catch (err) {
        console.error("reset-factory error:", err);
        return res.status(500).json({ ok: false, error: err.message });
    }
}
