import { useEffect, useState } from 'react';
import { getToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, setDoc } from 'firebase/firestore';

const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTio0uc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk';

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);

    const retrieveToken = async () => {
        if (!messaging) return;
        const user = auth.currentUser;
        if (!user) return;

        try {
            if (Notification.permission === 'granted') {
                const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY });
                if (currentToken) {
                    console.log('FCM Token Retrieved:', currentToken);
                    setToken(currentToken);

                    // Get current tokens to manage the array
                    const { getDoc } = await import('firebase/firestore');
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    const userData = userDoc.data();

                    let tokens: string[] = userData?.fcmTokens || [];

                    // Si ya existe el token viejo 'fcmToken' (string), lo migramos al array
                    if (userData?.fcmToken && !tokens.includes(userData.fcmToken)) {
                        tokens.push(userData.fcmToken);
                    }

                    // Añadir el nuevo token si no está
                    if (!tokens.includes(currentToken)) {
                        tokens.push(currentToken);
                    }

                    // Limitar a los últimos 5 dispositivos/tokens para no saturar el doc
                    if (tokens.length > 5) {
                        tokens = tokens.slice(-5);
                    }

                    await setDoc(doc(db, 'users', user.uid), {
                        fcmToken: currentToken, // Mantenemos el último para compatibilidad
                        fcmTokens: tokens,
                        lastFcmUpdate: new Date()
                    }, { merge: true });
                }
            }
        } catch (e) {
            console.error("Error retrieving FCM token:", e);
        }
    };

    useEffect(() => {
        // Attempt on mount (passive check)
        retrieveToken();
    }, []);

    return { token, retrieveToken };
};
