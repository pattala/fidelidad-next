import { useEffect, useState, useRef } from 'react';
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

// TRUE ORIGINAL VAPID KEY (verified from token-ok backup and original_vapid.txt)
const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjIw05sMTioOuc_MdZgOD_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const isRetrieving = useRef(false);

    const retrieveToken = async (retryCount = 0) => {
        if (!messaging || typeof window === 'undefined' || isRetrieving.current) return;

        const user = auth.currentUser;
        if (!user) {
            console.log('[FCM] No user, skipping.');
            return;
        }

        isRetrieving.current = true;
        try {
            // SILENT REFRESH MECHANISM (Safety Layer)
            const storedVapid = localStorage.getItem('fcm_vapid_key_v2');
            if (storedVapid && storedVapid !== VAPID_KEY) {
                console.log('[FCM] VAPID Key Mismatch detected. Forcing silent refresh...');
                try {
                    await deleteToken(messaging);
                    console.log('[FCM] Old corrupted token deleted successfully.');
                } catch (err) {
                    console.warn('[FCM] Error deleting old token:', err);
                }
            }

            if (Notification.permission === 'granted') {
                console.log('[FCM] Permission granted. Registering Service Worker...');

                // Explicit registration of the SW to ensure it's active
                console.log('[FCM] Registering Service Worker...');
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                // Wait for the SW to be active
                if (registration.installing) {
                    await new Promise<void>((resolve) => {
                        const sw = registration.installing;
                        if (!sw) return resolve();
                        const stateChangeListener = () => {
                            if (sw.state === 'activated') {
                                sw.removeEventListener('statechange', stateChangeListener);
                                resolve();
                            }
                        };
                        sw.addEventListener('statechange', stateChangeListener);
                        setTimeout(resolve, 5000); // Fallback
                    });
                }
                
                await navigator.serviceWorker.ready;
                console.log('[FCM] SW Registration Active & Ready.');

                console.log('[FCM] Requesting token with definitive VAPID key...');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully');
                    setToken(currentToken);
                    
                    localStorage.setItem('fcm_vapid_key_v2', VAPID_KEY);

                    const userRef = doc(db, 'users', user.uid);
                    
                    try {
                        await updateDoc(userRef, {
                            fcmToken: currentToken,
                            fcmTokens: arrayUnion(currentToken),
                            lastFcmUpdate: serverTimestamp(),
                            fcmState: 'registered_vok', // Tag for the token-ok logic
                            'permissions.notifications.status': 'granted',
                            lastActive: serverTimestamp()
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
                                fcmState: 'registered_vok'
                            }, { merge: true });
                        } else {
                            throw err;
                        }
                    }
                } else {
                    console.log('[FCM] No token returned.');
                    await updateDoc(doc(db, 'users', user.uid), { fcmState: 'token_null' }).catch(() => { });
                }
            } else if (Notification.permission === 'denied') {
                console.log('[FCM] Permission denied.');
                await updateDoc(doc(db, 'users', user.uid), {
                    fcmState: 'denied',
                    'permissions.notifications.status': 'denied',
                    lastFcmUpdate: serverTimestamp()
                }).catch(() => { });
            }
        } catch (e: any) {
            console.error(`[FCM] Error (Attempt ${retryCount}):`, e);

            await updateDoc(doc(db, 'users', user.uid), {
                fcmState: 'client_error',
                lastFcmError: e.message
            }).catch(() => { });

            if (retryCount < 2) {
                console.log('[FCM] Retrying in 3s...');
                setTimeout(() => {
                    isRetrieving.current = false;
                    retrieveToken(retryCount + 1);
                }, 3000);
            }
        } finally {
            isRetrieving.current = false;
        }
    };

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) retrieveToken();
        });

        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && auth.currentUser) {
                console.log('[FCM] Visibility change: checking token');
                retrieveToken();
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            (window as any).retrieveToken = retrieveToken;
        }
        return () => {
            if (typeof window !== 'undefined') {
                delete (window as any).retrieveToken;
            }
        };
    }, []);

    return { token, retrieveToken };
};
