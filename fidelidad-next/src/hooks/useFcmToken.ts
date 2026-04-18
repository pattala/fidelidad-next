import { useEffect, useState, useRef } from 'react';
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

// TRUE ORIGINAL VAPID KEY (VERIFIED FROM fidelidad-next_token-ok BACKUP)
const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTio0uc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk';

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
            const storedVapid = localStorage.getItem('fcm_vapid_key_vfinal_v3');
            if (storedVapid && storedVapid !== VAPID_KEY) {
                console.log('[FCM] VAPID Key Mismatch detected. Forcing silent refresh...');
                try {
                    await deleteToken(messaging);
                    console.log('[FCM] Old token deleted successfully.');
                } catch (err) {
                    console.warn('[FCM] Error deleting old token:', err);
                }
            }

            if (Notification.permission === 'granted') {
                console.log('[FCM] Permission granted. Registering Service Worker...');
                
                const isMobile = () => {
                    if (typeof window === 'undefined') return false;
                    const ua = navigator.userAgent;
                    return /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
                };
                const deviceKey = isMobile() ? 'mobile' : 'pc';

                const logStep = async (step: string, extra = {}) => {
                    try {
                        const userRef = doc(db, 'users', user.uid);
                        await updateDoc(userRef, {
                            [`fcmDebug_${deviceKey}`]: {
                                step,
                                timestamp: new Date().toISOString(),
                                ua: navigator.userAgent,
                                permission: Notification.permission,
                                ...extra
                            }
                        });
                    } catch (err) {
                        console.error('[FCM Debug] Failed to log step:', step, err);
                    }
                };

                await logStep('start_registration');

                // Explicit registration of the SW to ensure it's active (Robust logic from token-ok)
                console.log('[FCM] Registering Service Worker (/sw.js)...');
                await logStep('sw_register_attempt');
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });
                await logStep('sw_registered');

                // Wait for the SW to be active
                if (registration.installing) {
                    console.log('[FCM] SW Installing...');
                    await logStep('sw_installing');
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
                        setTimeout(resolve, 5000); 
                    });
                } else if (registration.waiting) {
                    console.log('[FCM] SW waiting.');
                    await logStep('sw_waiting');
                }
                
                await logStep('sw_waiting_ready');
                await navigator.serviceWorker.ready;
                console.log('[FCM] SW Registration Active & Ready.');
                await logStep('sw_ready');

                console.log('[FCM] Requesting token with definitive VAPID key...');
                await logStep('fcm_token_request');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });
                await logStep('fcm_token_received', { hasToken: !!currentToken });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully:', currentToken);
                    setToken(currentToken);
                    
                    localStorage.setItem('fcm_vapid_key_vfinal_v3', VAPID_KEY);

                    const userRef = doc(db, 'users', user.uid);
                    
                    try {
                        await updateDoc(userRef, {
                            fcmToken: currentToken,
                            fcmTokens: arrayUnion(currentToken),
                            [`fcmToken_${deviceKey}`]: currentToken,
                            lastFcmUpdate: serverTimestamp(),
                            fcmState: 'registered_final_ok',
                            'permissions.notifications.status': 'granted',
                            lastActive: serverTimestamp()
                        });
                    } catch (err: any) {
                        if (err.code === 'not-found') {
                            const { setDoc } = await import('firebase/firestore');
                            await setDoc(userRef, {
                                fcmToken: currentToken,
                                fcmTokens: [currentToken],
                                [`fcmToken_${deviceKey}`]: currentToken,
                                lastFcmUpdate: serverTimestamp(),
                                permissions: {
                                    notifications: {
                                        status: 'granted',
                                        updatedAt: new Date()
                                    }
                                },
                                fcmState: 'registered_final_ok'
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
                const deviceKey = (() => {
                    if (typeof window === 'undefined') return 'pc';
                    const ua = navigator.userAgent;
                    return /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua)) ? 'mobile' : 'pc';
                })();
                await updateDoc(doc(db, 'users', user.uid), {
                    fcmState: `denied_on_${deviceKey}`,
                    'permissions.notifications.status': 'denied',
                    lastFcmUpdate: serverTimestamp()
                }).catch(() => { });
            }
        } catch (e: any) {
            console.error(`[FCM] Error (Attempt ${retryCount}):`, e);

                await updateDoc(doc(db, 'users', user.uid), {
                    fcmState: 'client_error',
                    lastFcmError: e.message,
                    [`fcmDebug_${isMobile() ? 'mobile' : 'pc'}`]: {
                        step: 'error',
                        error: e.message,
                        code: e.code,
                        timestamp: new Date().toISOString()
                    }
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
