
import admin from "firebase-admin";
import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
dotenv.config();

// Inicialización
if (!admin.apps.length) {
    const fs = await import('fs');
    const creds = JSON.parse(fs.readFileSync('./service-account.json', 'utf8'));
    admin.initializeApp({
        credential: admin.credential.cert(creds)
    });
}
const db = admin.firestore();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

async function runTest() {
    console.log("Iniciando prueba de notificaciones agrupadas...");
    
    // Configuración base
    const configSnap = await db.collection('config').doc('general').get();
    const config = configSnap.data();
    const referenceDate = new Date(); // Hoy
    const referenceDateStr = referenceDate.toISOString().split('T')[0];
    const startOfToday = new Date(referenceDate);
    startOfToday.setHours(0, 0, 0, 0);

    const warningDays = 7;
    const warningDate = new Date(referenceDate);
    warningDate.setDate(warningDate.getDate() + warningDays);
    warningDate.setHours(23, 59, 59, 999);

    // Buscamos usuarios que venzan pronto
    const proactivePin = new Date(referenceDate);
    proactivePin.setDate(proactivePin.getDate() + 30);
    const proactivePinStr = proactivePin.toISOString().split('T')[0];

    const proactiveSnap = await db.collection('users')
        .where('nextExpirationDate', '<=', proactivePinStr)
        .where('nextExpirationDate', '>', referenceDateStr)
        .get();

    console.log(`Usuarios encontrados para aviso: ${proactiveSnap.length}`);

    for (const userDoc of proactiveSnap.docs) {
        const userData = userDoc.data();
        if (userData.name !== 'Pepe') continue; // Solo probamos con Pepe para no molestar a todos

        console.log(`Procesando a ${userData.name}...`);
        
        const historyRef = userDoc.ref.collection('points_history');
        const impendingCreditsSnap = await historyRef.where('type', '==', 'credit')
            .where('expiresAt', '>', admin.firestore.Timestamp.fromDate(startOfToday))
            .where('expiresAt', '<=', admin.firestore.Timestamp.fromDate(warningDate))
            .get();

        let totalImpendingAmount = 0;
        const creditsByDate = {};

        impendingCreditsSnap.forEach(d => {
            const dData = d.data();
            if (dData.status === 'expired') return;
            const rem = dData.remainingPoints !== undefined ? Number(dData.remainingPoints) : Number(dData.amount);
            if (rem > 0) {
                totalImpendingAmount += rem;
                const dObj = dData.expiresAt.toDate();
                const dateKey = `${dObj.getDate().toString().padStart(2, '0')}/${(dObj.getMonth() + 1).toString().padStart(2, '0')}/${dObj.getFullYear()}`;
                creditsByDate[dateKey] = (creditsByDate[dateKey] || 0) + rem;
            }
        });

        if (totalImpendingAmount <= 0) {
            console.log("Sin puntos por vencer en la ventana de 7 días.");
            continue;
        }

        const validCredits = Object.entries(creditsByDate)
            .map(([date, rem]) => ({ rem, date }))
            .sort((a, b) => {
                const [da, ma, ya] = a.date.split('/').map(Number);
                const [db, mb, yb] = b.date.split('/').map(Number);
                return new Date(ya, ma - 1, da) - new Date(yb, mb - 1, db);
            });

        const template = config.messaging?.templates?.expirationWarning || "¡Hola {nombre}! 📢 Tienes {puntos} puntos próximos a vencer el {fecha}. Entra a la App para aprovecharlos.";
        let msg = template.replace(/{nombre}/g, userData.name || 'Socio').replace(/{puntos}/g, totalImpendingAmount.toString());

        if (validCredits.length > 1) {
            msg = msg.replace(/ el {fecha}/g, "").replace(/ el día {fecha}/g, "").replace(/{fecha}/g, "próximamente");
            msg += ` Detalle: ${validCredits.map(c => `${c.rem} pts (${c.date})`).join(', ')}`;
        } else {
            msg = msg.replace(/{fecha}/g, displayDate);
        }
        const breakdownStr = validCredits.map(c => `${c.rem} pts (${c.date})`).join(', ');
        const title = "⚠️ Tus puntos están por vencer";

        console.log("Mensaje generado:", msg);
        console.log("Detalle agrupado:", breakdownStr);

        // Token Deduplication
        const uniqueTokens = Array.from(new Set(userData.fcmTokens || []));
        console.log(`Enviando a ${uniqueTokens.length} dispositivos (Limpiados de ${userData.fcmTokens?.length || 0})`);

        if (uniqueTokens.length) {
            await admin.messaging().sendEachForMulticast({ 
                tokens: uniqueTokens, 
                notification: { title, body: msg }, 
                data: { url: "/", icon: config.logoUrl || "" } 
            }).catch(console.error);
        }

        // Inbox - Usamos el mismo ID determinístico que en el código real para probar deduplicación
        const inboxId = `exp_warning_${referenceDateStr}`;
        await userDoc.ref.collection('inbox').doc(inboxId).set({ 
            title: title + " (TEST FIXED ID)", 
            body: `${msg}\n\nDetalle: ${breakdownStr}`, 
            url: "/", 
            type: "system", 
            read: false, 
            date: admin.firestore.FieldValue.serverTimestamp(), 
            expireAt: admin.firestore.Timestamp.fromDate(new Date(Date.now() + 86400000)) 
        });

        console.log("Notificación enviada con éxito.");
    }
}

runTest().catch(console.error);
