import { useEffect, useState, useRef } from 'react';
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

// TRUE ORIGINAL VAPID KEY (VERIFIED FROM fidelidad-next_token-ok BACKUP)
const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjIw05sMTioOuc_MdZgOD_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);
    const isRetrieving = useRef(false);

    const getDeviceKey = () => {
        if (typeof window === 'undefined') return 'pc';
        const ua = navigator.userAgent;
        const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
        const isIPadOS = (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
        return (isMobileUA || isIPadOS) ? 'mobile' : 'pc';
    };

    const retrieveToken = async (retryCount = 0): Promise<string | null> => {
        if (!messaging || typeof window === 'undefined' || isRetrieving.current) return null;

        const user = auth.currentUser;
        if (!user) return null;

        const deviceKey = getDeviceKey();
        isRetrieving.current = true;

        try {
            // 1. Clean up old VAPID if necessary
            const storedVapid = localStorage.getItem('fcm_vapid_key_vfinal');
            if (storedVapid && storedVapid !== VAPID_KEY) {
                try {
                    await deleteToken(messaging);
                    localStorage.removeItem('fcm_vapid_key_vfinal');
                } catch (err) { console.warn('[FCM] Token cleanup failed:', err); }
            }

            // 2. Check permission state
            let permission = Notification.permission;
            
            // If we think we have permission but it's 'default', try to check again
            // this handles some edge cases where the permission state is not updated yet.
            if (permission === 'default' && (navigator as any).permissions) {
                const status = await (navigator as any).permissions.query({ name: 'notifications' });
                permission = status.state as NotificationPermission;
            }

            if (permission === 'granted') {
                console.log('[FCM] Permission is granted. Fetching token...');
                
                // Wait for service worker to be ready with a timeout
                const swReady = await Promise.race([
                    navigator.serviceWorker.ready,
                    new Promise((_, reject) => setTimeout(() => reject(new Error('SW Ready Timeout')), 10000))
                ]) as ServiceWorkerRegistration;

                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: swReady
                });

                if (currentToken) {
                    setToken(currentToken);
                    localStorage.setItem('fcm_vapid_key_vfinal', VAPID_KEY);

                    const { getDoc } = await import('firebase/firestore');
                    const userRef = doc(db, 'users', user.uid);
                    const userSnap = await getDoc(userRef);
                    
                    if (userSnap.exists()) {
                        const userData = userSnap.data();
                        const storedToken = userData[`fcmToken_${deviceKey}`];
                        const currentStatus = userData.permissions?.notifications?.[`${deviceKey}_status`];
                        
                         if (storedToken !== currentToken || currentStatus !== 'granted') {
                             console.log(`[FCM] Token changed or status desync on ${deviceKey}. Updating...`);
                             await updateDoc(userRef, {
                                 fcmToken: currentToken,
                                 fcmTokens: arrayUnion(currentToken),
                                 [`fcmToken_${deviceKey}`]: currentToken,
                                 lastFcmUpdate: serverTimestamp(),
                                 fcmState: `registered_${deviceKey}_ok`,
                                 'permissions.notifications.status': 'granted',
                                 [`permissions.notifications.${deviceKey}_status`]: 'granted',
                                 lastActive: serverTimestamp(),
                                 [`fcmDebug_${deviceKey}`]: {
                                     step: 'sync_ok',
                                     timestamp: new Date().toISOString()
                                 }
                             });
                         }
                    }
                    return currentToken;
                }
            } else {
                console.log(`[FCM] Permission is ${permission}. Skipping auto-sync.`);
            }
            return null;
        } catch (e: any) {
            console.error(`[FCM] Error (Attempt ${retryCount}):`, e);
            const errorMsg = e.message || String(e);
            
            if (user?.uid) {
                await updateDoc(doc(db, 'users', user.uid), {
                    fcmState: `error_${deviceKey}`,
                    lastFcmError: errorMsg,
                    lastFcmUpdate: serverTimestamp(),
                    [`fcmDebug_${deviceKey}`]: {
                        step: 'token_fetch_fail',
                        error: errorMsg,
                        timestamp: new Date().toISOString()
                    }
                }).catch(() => { });
            }

            if (retryCount < 2 && !errorMsg.includes('Permission denied')) {
                await new Promise(r => setTimeout(r, 3000));
                isRetrieving.current = false;
                return retrieveToken(retryCount + 1);
            }
            return null;
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
