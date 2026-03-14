import { useEffect, useState, useRef } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTioOuc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk';

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
                console.log('[FCM] Permission granted. Waiting for Service Worker...');

                // Usar el SW ya registrado por el plugin de PWA
                const registration = await navigator.serviceWorker.ready;

                console.log('[FCM] Requesting token...');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully');
                    setToken(currentToken);

                    const userRef = doc(db, 'users', user.uid);
                    const { getDoc, updateDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore');

                    try {
                        await updateDoc(userRef, {
                            fcmToken: currentToken,
                            fcmTokens: arrayUnion(currentToken),
                            lastFcmUpdate: serverTimestamp(),
                            'permissions.notifications.status': 'granted'
                        });
                    } catch (err: any) {
                        if (err.code === 'not-found') {
                            const { setDoc } = await import('firebase/firestore');
                            await setDoc(userRef, {
                                fcmToken: currentToken,
                                fcmTokens: [currentToken],
                                lastFcmUpdate: serverTimestamp(),
                                permissions: {
                                    notifications: {
                                        status: 'granted',
                                        updatedAt: new Date()
                                    }
                                }
                            }, { merge: true });
                        } else {
                            throw err;
                        }
                    }
                }
            } else if (Notification.permission === 'denied') {
                const userRef = doc(db, 'users', user.uid);
                const { updateDoc } = await import('firebase/firestore');
                try {
                    await updateDoc(userRef, {
                        fcmToken: null,
                        'permissions.notifications.status': 'denied',
                        lastFcmUpdate: new Date()
                    });
                } catch (e) {
                    // Silently fail if doc doesn't exist
                }
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
