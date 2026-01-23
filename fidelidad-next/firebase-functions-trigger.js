const functions = require("firebase-functions");
const admin = require("firebase-admin");
admin.initializeApp();

/**
 * Escucha cuando se crea un documento en: users/{userId}/inbox/{messageId}
 * y envía una notificación Push FCM al dispositivo del usuario.
 */
exports.sendInboxPush = functions.firestore
    .document("users/{userId}/inbox/{messageId}")
    .onCreate(async (snap, context) => {
        const newMessage = snap.data();
        const userId = context.params.userId;

        // 1. Obtener el token FCM del usuario
        const userDoc = await admin.firestore().collection("users").doc(userId).get();

        // Validar si existe token
        const fcmToken = userDoc.data()?.fcmToken;
        if (!fcmToken) {
            console.log(`El usuario ${userId} no tiene token FCM. No se envía Push.`);
            return null;
        }

        // 2. Construir el mensaje
        const payload = {
            token: fcmToken,
            notification: {
                title: newMessage.title || "Nuevo Mensaje",
                body: newMessage.body || "Tienes una notificación nueva.",
                // icon: '/pwa-192x192.png' // Opcional, Android lo maneja via Manifest a veces
            },
            data: {
                url: "/inbox", // Para abrir directo en la sección
                messageId: context.params.messageId
            }
        };

        // 3. Enviar
        try {
            await admin.messaging().send(payload);
            console.log(`Push enviado correctamente a ${userId}`);
        } catch (error) {
            console.error("Error enviando Push:", error);
            // Opcional: Si el error es "token inválido", borrarlo de la BD
        }
    });
