import admin from "firebase-admin";

function getDb() {
    if (!admin.apps.length) {
        const credsRaw = (process.env.GOOGLE_CREDENTIALS_JSON || "").trim();
        if (!credsRaw) throw new Error("GOOGLE_CREDENTIALS_JSON está vacío o no definido en Vercel");
        let creds;
        try {
            creds = JSON.parse(credsRaw);
        } catch (e) {
            // Re-intento con limpieza de saltos de línea
            creds = JSON.parse(credsRaw.replace(/\\n/g, "\n"));
        }
        admin.initializeApp({
            credential: admin.credential.cert({
                projectId: creds.project_id,
                clientEmail: creds.client_email,
                privateKey: creds.private_key?.replace(/\\n/g, "\n"),
            }),
        });
    }
    return admin.firestore();
}

export default async function handler(req, res) {
    if (req.method === 'OPTIONS') return res.status(200).end();
    
    try {
        const db = getDb();
        const now = new Date();
        
        // PRUEBA DE FUEGO: ¿Falla el collectionGroup?
        // Si el error es por falta de índice, Firebase devolverá un mensaje con la URL del índice.
        try {
            const testSnap = await db.collectionGroup('points_history').limit(1).get();
            
            // Si llegamos aquí, el collectionGroup funciona. 
            // Devolvemos un éxito falso para confirmar que el entorno está sano.
            return res.status(200).json({ 
                ok: true, 
                diagnostic: "Firebase OK", 
                message: "Si ves esto, el entorno está sano. El error anterior era probablemente de lógica o rutas.",
                summary: { totalPoints: 0, intervals: [] }
            });
        } catch (dbError) {
            return res.status(200).json({ 
                ok: false, 
                error: "ERROR DE BASE DE DATOS", 
                message: dbError.message, 
                stack: dbError.stack 
            });
        }

    } catch (fatalError) {
        return res.status(200).json({ 
            ok: false, 
            error: "ERROR CRÍTICO DE INICIALIZACIÓN", 
            message: fatalError.message 
        });
    }
}
