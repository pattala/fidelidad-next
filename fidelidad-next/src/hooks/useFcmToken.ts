import { useEffect, useState, useRef } from 'react';
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, arrayUnion } from 'firebase/firestore';

// TRUE ORIGINAL VAPID KEY (VERIFIED FROM fidelidad-next_token-ok BACKUP)
const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTio0uc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk';

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

    const retrieveToken = async (retryCount = 0) => {
        if (!messaging || typeof window === 'undefined' || isRetrieving.current) return;

        const user = auth.currentUser;
        if (!user) return;

        const deviceKey = getDeviceKey();
        isRetrieving.current = true;

        try {
            const storedVapid = localStorage.getItem('fcm_vapid_key_vfinal');
            if (storedVapid && storedVapid !== VAPID_KEY) {
                try {
                    await deleteToken(messaging);
                    localStorage.removeItem('fcm_vapid_key_vfinal');
                } catch (err) { console.warn('[FCM] Token cleanup failed:', err); }
            }

            if (Notification.permission === 'granted') {
                const registration = await navigator.serviceWorker.ready;
                const currentToken = await getToken(messaging, {
                    vapidKey: VAPID_KEY,
                    serviceWorkerRegistration: registration
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
                                [`fcmToken_${deviceKey}`]: currentToken,
                                lastFcmUpdate: serverTimestamp(),
                                fcmState: `registered_${deviceKey}_ok`,
                                'permissions.notifications.status': 'granted',
                                [`permissions.notifications.${deviceKey}_status`]: 'granted',
                                lastActive: serverTimestamp()
                            });
                        }
                    }
                }
            } else {
                console.log(`[FCM] Permission is ${Notification.permission}. Skipping auto-sync.`);
            }
        } catch (e: any) {
            console.error(`[FCM] Error (Attempt ${retryCount}):`, e);
            if (retryCount < 2) {
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
