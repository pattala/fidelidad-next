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
                // Registrar Service Worker explícitamente para evitar el error de "not found" o "timeout"
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });

                // Esperar a que el SW esté activo
                if (registration.installing) {
                    await new Promise<void>((resolve) => {
                        registration.installing?.addEventListener('statechange', (e: any) => {
                            if (e.target.state === 'activated') resolve();
                        });
                    });
                }

                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('FCM Token Retrieved:', currentToken);
                    setToken(currentToken);

                    const { getDoc } = await import('firebase/firestore');
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const userData = userDoc.data();

                    let tokens: string[] = userData?.fcmTokens || [];
                    if (userData?.fcmToken && !tokens.includes(userData.fcmToken)) {
                        tokens.push(userData.fcmToken);
                    }
                    if (!tokens.includes(currentToken)) {
                        tokens.push(currentToken);
                    }
                    if (tokens.length > 5) tokens = tokens.slice(-5);

                    await setDoc(doc(db, 'users', user.uid), {
                        fcmToken: currentToken,
                        fcmTokens: tokens,
                        lastFcmUpdate: new Date()
                    }, { merge: true });
                }
            }
        } catch (e) {
            console.error(`Error retrieving FCM token (Attempt ${retryCount}):`, e);
            // Reintentar una vez si falla por registro
            if (retryCount < 1) {
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
