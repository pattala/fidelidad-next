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
        if (!user) {
            console.log('[FCM] No user, skipping.');
            return;
        }

        isRetrieving.current = true;
        try {
            if (Notification.permission === 'granted') {
                console.log('[FCM] Permission granted. Registering Service Worker...');

                // Registro explícito del SW unificado para asegurar que esté activo
                console.log('[FCM] Registering Unified Service Worker (/sw.js)...');
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                // Esperar a que el SW esté activo (importante para el primer registro)
                if (registration.installing) {
                    console.log('[FCM] SW Installing...');
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
                        // Fallback por si ya se activó o tarda demasiado
                        setTimeout(resolve, 5000);
                    });
                } else if (registration.waiting) {
                    console.log('[FCM] SW waiting. skipWaiting() should handle this.');
                }
                
                // Asegurar readiness final
                await navigator.serviceWorker.ready;
                console.log('[FCM] SW Registration Active & Ready.');

                console.log('[FCM] Requesting token with VAPID key...');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully:', currentToken);
                    setToken(currentToken);

                    // Registro directo en Firestore con detección de dispositivo
                    const { updateDoc, serverTimestamp, arrayUnion } = await import('firebase/firestore');
                    const userRef = doc(db, 'users', user.uid);

                    const isMobileDevice = () => {
                        const ua = navigator.userAgent;
                        return /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
                    };
                    const deviceKey = isMobileDevice() ? 'fcmToken_mobile' : 'fcmToken_pc';

                    await updateDoc(userRef, {
                        fcmToken: currentToken,
                        fcmTokens: arrayUnion(currentToken),
                        [deviceKey]: currentToken, // Diferenciación para el Panel
                        lastFcmUpdate: serverTimestamp(),
                        fcmState: 'registered',
                        'permissions.notifications.status': 'granted',
                        lastActive: serverTimestamp()
                    }).catch(err => console.warn('[FCM] Firestore save error:', err));

                    console.log('[FCM] Token saved directly.');
                } else {
                    console.log('[FCM] No token returned.');
                    const { updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'users', user.uid), { fcmState: 'token_null' }).catch(() => { });
                }
            } else if (Notification.permission === 'denied') {
                console.log('[FCM] Permission denied.');
                const { updateDoc, serverTimestamp } = await import('firebase/firestore');
                await updateDoc(doc(db, 'users', user.uid), {
                    fcmState: 'denied',
                    'permissions.notifications.status': 'denied',
                    lastFcmUpdate: serverTimestamp()
                }).catch(() => { });
            }
        } catch (e: any) {
            console.error(`[FCM] Error (Attempt ${retryCount}):`, e);

            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'users', user.uid), {
                fcmState: 'client_error',
                lastFcmError: e.message
            }).catch(() => { });

            // Reintentar errores temporales o de falta de credenciales (para dar tiempo a que cargue)
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
