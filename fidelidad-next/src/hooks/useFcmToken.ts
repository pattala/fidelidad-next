import { useEffect, useState, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTio0uc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);

    const isRetrieving = useRef(false);

    const retrieveToken = async (retryCount = 0) => {
        if (!messaging || typeof window === 'undefined' || isRetrieving.current) return;

        const user = auth.currentUser;
        if (!user) return;

        isRetrieving.current = true;
        try {
            if (Notification.permission === 'granted') {
                console.log('[FCM] Permission granted. Registering Service Worker...');
                const registration = await navigator.serviceWorker.register('/firebase-messaging-sw.js', {
                    scope: '/'
                });

                // Esperar a que el SW esté activo si está instalándose
                if (registration.installing) {
                    await new Promise<void>((resolve) => {
                        registration.installing?.addEventListener('statechange', (e: any) => {
                            if (e.target.state === 'activated') resolve();
                        });
                        // Timeout de seguridad para no quedar bloqueados
                        setTimeout(resolve, 5000);
                    });
                }

                console.log('[FCM] Requesting token...');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully');
                    setToken(currentToken);

                    const userRef = doc(db, 'users', user.uid);
                    const { getDoc, serverTimestamp } = await import('firebase/firestore');

                    const userDoc = await getDoc(userRef);
                    let tokens = userDoc.exists() ? (userDoc.data()?.fcmTokens || []) : [];
                    if (!Array.isArray(tokens)) tokens = [];
                    if (!tokens.includes(currentToken)) tokens.push(currentToken);
                    if (tokens.length > 5) tokens = tokens.slice(-5);

                    await setDoc(userRef, {
                        fcmToken: currentToken,
                        fcmTokens: tokens,
                        lastFcmUpdate: serverTimestamp(),
                        'permissions.notifications.status': 'granted'
                    }, { merge: true });
                }
            } else if (Notification.permission === 'denied') {
                const userRef = doc(db, 'users', user.uid);
                await setDoc(userRef, {
                    fcmToken: null,
                    'permissions.notifications.status': 'denied',
                    lastFcmUpdate: new Date()
                }, { merge: true });
            }
        } catch (e: any) {
            console.error(`[FCM] Error (Attempt ${retryCount}):`, e);

            const isIdbError = e?.message?.includes('database connection is closing') ||
                e?.code?.includes('indexeddb') ||
                e?.name === 'InvalidStateError';

            if (retryCount < 3) {
                const delay = isIdbError ? 3000 : 2000;
                console.log(`[FCM] Retrying in ${delay}ms...`);
                setTimeout(() => {
                    isRetrieving.current = false;
                    retrieveToken(retryCount + 1);
                }, delay);
                return; // Evitar el reset de isRetrieving al final si estamos reintentando
            }
        } finally {
            // Solo liberamos si no estamos en medio de un reintento programado
            if (retryCount >= 3 || !isRetrieving.current) {
                isRetrieving.current = false;
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
