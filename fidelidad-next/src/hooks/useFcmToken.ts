import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjIw05sMTioOuc_MdZgOD_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);

    useEffect(() => {
        const registerToken = async () => {
            // 1. Check if Messaging is supported (in this env)
            if (!messaging) return;

            // 2. Check if user is logged in (usually yes if using this hook in protected route)
            const user = auth.currentUser;
            if (!user) return;

            try {
                // 3. Request Permission
                const permission = await Notification.requestPermission();
                if (permission === 'granted') {
                    // 4. Get Token
                    const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
                    if (currentToken) {
                        console.log('FCM Token Retrieved:', currentToken);
                        setToken(currentToken);

                        // 5. Save to Firestore
                        // We assume 'fcmToken' is the field key. Backend might look there.
                        // Ideally we append to a list, but simple set is fine for getting started.
                        await setDoc(doc(db, 'users', user.uid), {
                            fcmToken: currentToken,
                            lastFcmUpdate: new Date()
                        }, { merge: true });
                    } else {
                        console.log('No registration token available. Request permission to generate one.');
                    }
                } else {
                    console.log('Notification permission denied.');
                }
            } catch (e) {
                console.error("Error retrieving FCM token:", e);
            }
        };

        registerToken();
    }, []);

    return { token };
};
