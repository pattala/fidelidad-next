import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTio0uc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);

    const retrieveToken = async (retryCount = 0) => {
        if (!messaging || typeof window === 'undefined') return;

        const user = auth.currentUser;
        if (!user) return;

        try {
            if (Notification.permission === 'granted') {
                console.log('[FCM] Permission granted. Registering Service Worker...');
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });

                console.log('[FCM] SW Registered. State:', registration.installing ? 'installing' : (registration.waiting ? 'waiting' : 'active'));

                // Esperar a que el SW esté activo
                if (registration.installing) {
                    await new Promise<void>((resolve) => {
                        registration.installing?.addEventListener('statechange', (e: any) => {
                            console.log('[FCM] SW Installing state:', e.target.state);
                            if (e.target.state === 'activated') resolve();
                        });
                    });
                }

                console.log('[FCM] Requesting token with VAPID Key...');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully:', currentToken.substring(0, 10) + '...');
                    setToken(currentToken);

                    const { getDoc, serverTimestamp } = await import('firebase/firestore');
                    const userRef = doc(db, 'users', user.uid);

                    try {
                        const userDoc = await getDoc(userRef);
                        if (userDoc.exists()) {
                            const userData = userDoc.data();
                            let tokens: string[] = userData?.fcmTokens || [];

                            // Ensure array exists
                            if (!Array.isArray(tokens)) tokens = [];

                            // Add current if missing
                            if (!tokens.includes(currentToken)) {
                                tokens.push(currentToken);
                            }

                            // Keep max 5
                            if (tokens.length > 5) tokens = tokens.slice(-5);

                            console.log('[FCM] Updating Firestore for user:', user.uid);
                            await setDoc(userRef, {
                                fcmToken: currentToken, // Force update singular for UI
                                fcmTokens: tokens,
                                lastFcmUpdate: serverTimestamp(),
                                'permissions.notifications.status': 'granted'
                            }, { merge: true });

                            // Optional: Visual confirmation for debugging (can be removed later)
                            // toast.success('Dispositivo conectado a notificaciones', { id: 'fcm-toast' });
                            console.log('[FCM] Token verified and saved.');
                        }
                    } catch (err) {
                        console.error('[FCM] Error saving token to Firestore:', err);
                    }
                } else {
                    console.warn('[FCM] No token retrieved (Permission granted but no token).');
                }
            } else {
                console.warn('[FCM] Notification permission NOT granted. State:', Notification.permission);
                // Si el permiso es denegado pero teníamos un token en Firestore, avisamos que ya no es válido
                if (Notification.permission === 'denied') {
                    const userRef = doc(db, 'users', user.uid);
                    await setDoc(userRef, {
                        fcmToken: null,
                        'permissions.notifications.status': 'denied',
                        lastFcmUpdate: new Date()
                    }, { merge: true });
                }
            }
            // Si el permiso es denegado pero teníamos un token en Firestore, avisamos que ya no es válido
            if (Notification.permission === 'denied') {
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    fcmToken: null,
                    'permissions.notifications.status': 'denied',
                    lastFcmUpdate: new Date()
                }, { merge: true });
            }
        } catch (e) {
            console.error(`[FCM] Error retrieving FCM token (Attempt ${retryCount}):`, e);
            // Reintentar una vez si falla por registro
            if (retryCount < 1) {
                console.log('[FCM] Retrying token retrieval in 2s...');
                setTimeout(() => retrieveToken(retryCount + 1), 2000);
            }
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) retrieveToken();
        });
        return () => unsubscribe();
    }, []);

    return { token, retrieveToken };
};
