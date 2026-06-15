import admin from "firebase-admin";

const DEFAULT_TEMPLATES = {
    campaign: "🌟 ¡Nueva Campaña!: {titulo}. {descripcion}. ¡No te la pierdas! 🎁",
    offer: "🎁 ¡Oferta Especial! {titulo}: {detalle}. Válido hasta el {vencimiento}. 🎁",
    flashOffer: "⚡ ¡OFERTA FLASH! {titulo}: {detalle}. Solo disponible hoy hasta las {horario} hs. 🎁"
};

export default async function handler(req, res) {
    if (req.method !== 'GET' && req.method !== 'POST') {
        return res.status(405).json({ ok: false, error: 'Method Not Allowed' });
    }

    try {
        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert({
                    projectId: process.env.FIREBASE_PROJECT_ID,
                    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
                    privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
                })
            });
        }
        const db = admin.firestore();

        const authHeader = req.headers["x-api-key"] || req.headers["authorization"];
        if (!authHeader) {
            return res.status(401).json({ ok: false, error: "Unauthorized" });
        }

        const campId = req.query.campId || req.body?.campId;
        if (!campId) {
            return res.status(400).json({ ok: false, error: "campId is required" });
        }

        // Fetch campaign
        const campDoc = await db.collection('campanas').doc(campId).get();
        if (!campDoc.exists) {
            return res.status(404).json({ ok: false, error: "Campaign not found" });
        }
        const bonus = campDoc.data();

        // Fetch config
        const configDoc = await db.collection('config').doc('global').get();
        const config = configDoc.exists ? configDoc.data() : {};

        let template = "";
        if (bonus.isFlash) {
            template = config?.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
        } else if (bonus.rewardType === 'INFO' || bonus.rewardType === 'TEXT') {
            template = config?.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer;
        } else {
            template = config?.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign;
        }

        const usersSnap = await db.collection('users').get();
        
        let csvContent = "Nombre,Telefono,Mensaje\n";
        
        usersSnap.forEach(doc => {
            const data = doc.data();
            if (data.role === 'admin' || !data.phone) return;
            
            let phoneNum = data.phone.replace(/\D/g, '');
            if (!phoneNum.startsWith('54') && phoneNum.length === 10) phoneNum = '549' + phoneNum;

            const userName = data.name || data.nombre || '';
            const firstName = userName.split(' ')[0];
            
            let msg = template.replace(/{nombre}/g, firstName).replace(/{nombre_completo}/g, userName);
            
            if (bonus.isFlash) {
                const horario = bonus.endTime || '23:59';
                const hora_inicio = bonus.startTime || '00:00';
                msg = msg.replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                            .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : ''))
                            .replace(/{horario}/g, horario)
                            .replace(/{hora_inicio}/g, hora_inicio);
            } else if (bonus.rewardType === 'INFO' || bonus.rewardType === 'TEXT') {
                const vencimiento = bonus.endDate ? new Date(bonus.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'agotar stock';
                msg = msg.replace(/{titulo}/g, bonus.title || bonus.name)
                            .replace(/{detalle}/g, bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : ''))
                            .replace(/{vencimiento}/g, vencimiento);
            } else {
                msg = msg.replace(/{titulo}/g, bonus.title || bonus.name)
                            .replace(/{descripcion}/g, bonus.description || '');
            }

            const escapeCSV = (str) => `"${str.replace(/"/g, '""')}"`;
            csvContent += `${escapeCSV(userName)},${phoneNum},${escapeCSV(msg)}\n`;
        });

        return res.status(200).json({ ok: true, csvContent });

    } catch (error) {
        console.error("Error generating CSV:", error);
        return res.status(500).json({ ok: false, error: error.message });
    }
}
