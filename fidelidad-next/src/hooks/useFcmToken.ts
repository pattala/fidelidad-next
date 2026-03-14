import { useEffect, useState, useRef } from 'react';
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, updateDoc, arrayUnion, serverTimestamp } from 'firebase/firestore';

const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjIw05sMTioOuc_MdZgOD_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const isRetrieving = useRef(false);

    const retrieveToken = async (forceRefresh = false, retryCount = 0) => {
        if (!messaging || typeof window === 'undefined' || isRetrieving.current) return;

        const user = auth.currentUser;
        if (!user) {
            console.log('[FCM] No user, skipping.');
            return;
        }

        // Platform Detection
        const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || 
                         (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent));
        const platform = isMobile ? 'mobile' : 'pc';

        isRetrieving.current = true;
        try {
            // Check if VAPID key has changed (to force refresh)
            const storedVapid = localStorage.getItem('fcm_vapid_key');
            const shouldForce = forceRefresh || (storedVapid && storedVapid !== VAPID_KEY);

            if (shouldForce) {
                console.log('[FCM] VAPID changed or force refresh requested. Deleting old token...');
                try {
                    await deleteToken(messaging);
                } catch (err) {
                    console.warn('[FCM] deleteToken error (ignoring):', err);
                }
            }

            if (Notification.permission === 'granted') {
                console.log(`[FCM] Permission granted (${platform}). Registering Service Worker...`);

                // Registro explícito del SW unificado para asegurar que esté activo
                const registration = await navigator.serviceWorker.register('/sw.js', {
                    scope: '/'
                });

                // Asegurar readiness final
                await navigator.serviceWorker.ready;
                console.log('[FCM] SW Registration Ready.');

                console.log('[FCM] Requesting token...');
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
                });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully:', currentToken);
                    setToken(currentToken);
                    localStorage.setItem('fcm_vapid_key', VAPID_KEY);

                    // Update platform-specific status and unified status
                    const prefix = isMobile ? 'mobile_' : 'pc_';
                    const userRef = doc(db, 'users', user.uid);
                    
                    await updateDoc(userRef, {
                        fcmToken: currentToken,
                        fcmTokens: arrayUnion(currentToken),
                        lastFcmUpdate: serverTimestamp(),
                        fcmState: 'registered',
                        [`permissions.notifications.${prefix}status`]: 'granted',
                        'permissions.notifications.status': 'granted',
                        [`permissions.notifications.platforms`]: arrayUnion(platform),
                        'permissions.notifications.userAgent': navigator.userAgent,
                        [`permissions.notifications.${prefix}userAgent`]: navigator.userAgent,
                        lastActive: serverTimestamp()
                    }).catch(err => console.warn('[FCM] Firestore save error:', err));

                    console.log(`[FCM] Token saved for ${platform}`);
                } else {
                    console.log('[FCM] No token returned.');
                    await updateDoc(doc(db, 'users', user.uid), { fcmState: 'token_null' }).catch(() => { });
                }
            } else if (Notification.permission === 'denied') {
                console.log('[FCM] Permission denied.');
                const prefix = isMobile ? 'mobile_' : 'pc_';
                await updateDoc(doc(db, 'users', user.uid), {
                    fcmState: 'denied',
                    [`permissions.notifications.${prefix}status`]: 'denied',
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
                    retrieveToken(forceRefresh, retryCount + 1);
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
