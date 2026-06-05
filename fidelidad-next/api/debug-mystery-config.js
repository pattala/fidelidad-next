import admin from "firebase-admin";

function initFirebaseAdmin() {
    if (!admin.apps.length) {
        const credsRaw = (process.env.GOOGLE_CREDENTIALS_JSON || "").trim();
        if (!credsRaw) throw new Error("Falta GOOGLE_CREDENTIALS_JSON");
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

export default async function handler(req, res) {
    try {
        const adminApp = initFirebaseAdmin();
        const db = adminApp.firestore();

        const configSnap = await db.collection('config').doc('general').get();
        const configData = configSnap.exists ? configSnap.data() : null;

        const mb = configData?.mysteryBox || null;

        return res.status(200).json({
            ok: true,
            configExists: configSnap.exists,
            mysteryBoxExists: !!mb,
            mysteryBoxEnabled: mb?.enabled ?? 'FIELD_MISSING',
            prizeScalesCount: mb?.prizeScales?.length ?? 0,
            prizeScales: mb?.prizeScales || [],
            allMysteryBoxKeys: mb ? Object.keys(mb) : []
        });
    } catch (e) {
        return res.status(500).json({ ok: false, error: e.message });
    }
}
