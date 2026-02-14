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
                    console.log('[FCM] Token Retrieved Successfuly');
                    setToken(currentToken);

                    const { getDoc } = await import('firebase/firestore');
                    const userRef = doc(db, 'users', user.uid);
                    const userDoc = await getDoc(userRef);

                    if (userDoc.exists()) {
                        const userData = userDoc.data();
                        let tokens: string[] = userData?.fcmTokens || [];
                        if (userData?.fcmToken && !tokens.includes(userData.fcmToken)) {
                            tokens.push(userData.fcmToken);
                        }
                        if (!tokens.includes(currentToken)) {
                            tokens.push(currentToken);
                        }
                        if (tokens.length > 5) tokens = tokens.slice(-5);

                        console.log('[FCM] Saving tokens to Firestore for user:', user.uid);
                        await setDoc(userRef, {
                            fcmToken: currentToken,
                            fcmTokens: tokens,
                            lastFcmUpdate: new Date()
                        }, { merge: true });
                        console.log('[FCM] Tokens saved successfully.');
                    } else {
                        console.log('[FCM] User document does not exist yet. Skipping FCM token save.');
                    }
                } else {
                    console.warn('[FCM] No token retrieved (Permission might be granted but token generation failed).');
                }
            } else {
                console.warn('[FCM] Notification permission NOT granted. State:', Notification.permission);
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
