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

                    try {
                        const response = await fetch('/api/notifications?action=register-token', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                token: currentToken,
                                userId: user.uid
                            })
                        });
                        const resData = await response.json();
                        if (!resData.ok) throw new Error(resData.error || 'Error registrando token');
                        console.log('[FCM] Token registered via API', resData);
                    } catch (err: any) {
                        console.error('[FCM] Error calling register-fcm-token API:', err);
                        // Fallback manual si la API falla (opcional, pero mejor centralizar)
                        const userRef = doc(db, 'users', user.uid);
                        const { updateDoc, arrayUnion, serverTimestamp } = await import('firebase/firestore');
                        await updateDoc(userRef, {
                            fcmToken: currentToken,
                            fcmTokens: arrayUnion(currentToken),
                            lastFcmUpdate: serverTimestamp(),
                            'permissions.notifications.status': 'granted'
                        }).catch(() => { });
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

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && auth.currentUser) {
                console.log('[FCM] App visible, re-checking token...');
                retrieveToken();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return { token, retrieveToken };
};
