import { useEffect, useState, useRef } from 'react';
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

// TRUE ORIGINAL VAPID KEY (verified from multiple working backups and original_vapid.txt)
const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjIw05sMTioOuc_MdZgOD_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const isRetrieving = useRef(false);

    const retrieveToken = async (retryCount = 0) => {
        if (!messaging || typeof window === 'undefined' || isRetrieving.current) return;

        const user = auth.currentUser;
        if (!user) return;

        isRetrieving.current = true;
        try {
            // SILENT REFRESH MECHANISM
            // Check if we already registered with a DIFFERENT VAPID key in this browser
            const storedVapid = localStorage.getItem('fcm_vapid_key_v2');
            if (storedVapid && storedVapid !== VAPID_KEY) {
                console.log('[FCM] VAPID Key Mismatch detected (Likely corrupted earlier). Forcing silent refresh...');
                try {
                    await deleteToken(messaging);
                    console.log('[FCM] Old corrupted token deleted successfully.');
                } catch (err) {
                    console.warn('[FCM] Error deleting old token (might not exist):', err);
                }
            }

            if (Notification.permission === 'granted') {
                console.log('[FCM] Permission granted. Waiting for Service Worker...');

                // Use SW registered by PWA plugin
                const registration = await navigator.serviceWorker.ready;

                console.log('[FCM] Requesting token with definitive VAPID key...');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully');
                    setToken(currentToken);
                    
                    // Track that we successfully used the CORRECT VAPID key
                    localStorage.setItem('fcm_vapid_key_v2', VAPID_KEY);

                    const userRef = doc(db, 'users', user.uid);
                    
                    try {
                        await updateDoc(userRef, {
                            fcmToken: currentToken,
                            fcmTokens: arrayUnion(currentToken),
                            lastFcmUpdate: serverTimestamp(),
                            'permissions.notifications.status': 'granted',
                            fcmState: 'registered_v2' // Tag identifying the new working logic
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
                                },
                                fcmState: 'registered_v2'
                            }, { merge: true });
                        } else {
                            throw err;
                        }
                    }
                }
            } else if (Notification.permission === 'denied') {
                const userRef = doc(db, 'users', user.uid);
                try {
                    await updateDoc(userRef, {
                        fcmToken: null,
                        'permissions.notifications.status': 'denied',
                        lastFcmUpdate: new Date(),
                        fcmState: 'denied_v2'
                    });
                } catch (e) {}
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
                return;
            }
        } finally {
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
