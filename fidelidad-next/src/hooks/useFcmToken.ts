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
                console.log('[FCM] Requesting token (Simple Mode)...');
                
                // Intentamos el método más directo posible
                const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });

                if (currentToken) {
                    console.log('[FCM] Token Retrieved Successfully:', currentToken);
                    setToken(currentToken);

                    // REGISTRO DIRECTO EN FIRESTORE (Como el Backup)
                    const { updateDoc, serverTimestamp, arrayUnion } = await import('firebase/firestore');
                    const userRef = doc(db, 'users', user.uid);
                    
                    await updateDoc(userRef, {
                        fcmToken: currentToken,
                        fcmTokens: arrayUnion(currentToken),
                        lastFcmUpdate: serverTimestamp(),
                        fcmState: 'registered',
                        lastActive: serverTimestamp()
                    });
                    
                    console.log('[FCM] Token saved directly to Firestore.');

                } else {
                    console.log('[FCM] No token available.');
                    const { updateDoc } = await import('firebase/firestore');
                    await updateDoc(doc(db, 'users', user.uid), { fcmState: 'token_null' }).catch(() => {});
                }
            } else {
                const { updateDoc } = await import('firebase/firestore');
                await updateDoc(doc(db, 'users', user.uid), { fcmState: `permission_${Notification.permission}` }).catch(() => {});
            }
        } catch (e: any) {
            console.error(`[FCM] Error (Attempt ${retryCount}):`, e);
            
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'users', user.uid), {
                fcmState: 'client_error',
                lastFcmError: e.message
            }).catch(() => { });

            if (retryCount < 2) {
                setTimeout(() => {
                    isRetrieving.current = false;
                    retrieveToken(retryCount + 1);
                }, 2000);
                return;
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
