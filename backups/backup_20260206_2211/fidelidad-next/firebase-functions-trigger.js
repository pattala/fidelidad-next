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

        // 1. Obtener los tokens FCM del usuario
        const userDoc = await admin.firestore().collection("users").doc(userId).get();
        const userData = userDoc.data();

        let tokens = userData?.fcmTokens || [];
        // Si no hay array pero hay token individual, lo usamos
        if (tokens.length === 0 && userData?.fcmToken) {
            tokens = [userData.fcmToken];
        }

        if (tokens.length === 0) {
            console.log(`El usuario ${userId} no tiene tokens FCM asociados.`);
            return null;
        }

        // 2. Construir la estructura base del mensaje
        const basePayload = {
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
                    requireInteraction: true,
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

        // 3. Enviar a todos los tokens (Multicast)
        try {
            const response = await admin.messaging().sendEachForMulticast({
                tokens: tokens,
                ...basePayload
            });

            console.log(`Push enviado: ${response.successCount} éxitos, ${response.failureCount} fallos.`);

            // 4. Limpieza de tokens inválidos
            if (response.failureCount > 0) {
                const failedTokens = [];
                response.responses.forEach((resp, idx) => {
                    if (!resp.success) {
                        const errorCode = resp.error?.code;
                        if (errorCode === 'messaging/invalid-registration-token' ||
                            errorCode === 'messaging/registration-token-not-registered') {
                            failedTokens.push(tokens[idx]);
                        }
                    }
                });

                if (failedTokens.length > 0) {
                    const remainingTokens = tokens.filter(t => !failedTokens.includes(t));
                    await admin.firestore().collection("users").doc(userId).update({
                        fcmTokens: remainingTokens
                    });
                    console.log(`Tokens limpiados para ${userId}: ${failedTokens.length}`);
                }
            }
        } catch (error) {
            console.error("Error general enviando Push Multicast:", error);
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

