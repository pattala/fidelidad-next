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

        // 2. Construir el mensaje (FCM V1)
        const payload = {
            token: fcmToken,
            notification: {
                title: newMessage.title || "Nuevo Mensaje",
                body: newMessage.body || "Tienes una notificación nueva.",
            },
            data: {
                url: "/inbox",
                messageId: context.params.messageId
            },
            webpush: {
                notification: {
                    icon: '/pwa-192x192.png',
                    badge: '/pwa-192x192.png',
                    requireInteraction: true, // Mantiene la notificación hasta que el usuario la cierre/haga clic (ideal para Windows)
                    vibrate: [200, 100, 200]
                },
                fcmOptions: {
                    link: "/inbox"
                }
            },
            android: {
                priority: "high",
                notification: {
                    sound: "default",
                    clickAction: "OPEN_ACTIVITY_1"
                }
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

/**
 * Escucha cuando se BORRA un usuario de Firestore: users/{userId}
 * y elimina automáticamente su cuenta de Firebase Authentication.
 * Esto asegura consistencia total al borrar desde el panel Admin.
 */
exports.cleanupUserAuth = functions.firestore
    .document("users/{userId}")
    .onDelete(async (snap, context) => {
        const userId = context.params.userId;
        const userData = snap.data();
        const userName = userData.name || 'Desconocido';

        console.log(`[Cleanup] Iniciando borrado de Auth para usuario: ${userId} (${userName})`);

        try {
            await admin.auth().deleteUser(userId);
            console.log(`[Cleanup] Usuario Auth eliminado correctamente: ${userId}`);
        } catch (error) {
            if (error.code === 'auth/user-not-found') {
                console.log(`[Cleanup] El usuario Auth ya no existía: ${userId}`);
            } else {
                console.error(`[Cleanup] Error eliminando usuario Auth: ${userId}`, error);
            }
        }
    });

