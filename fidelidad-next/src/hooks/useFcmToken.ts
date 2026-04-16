import { useEffect, useState } from 'react';
import { getToken, deleteToken } from 'firebase/messaging';
import { messaging, db, auth } from '../lib/firebase';
import { doc, updateDoc, serverTimestamp, arrayUnion, setDoc } from 'firebase/firestore';

// VAPID KEY — clave pública del proyecto Firebase para web push
const VAPID_KEY = 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTio0uc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk';

// -------------------------------------------------------------------
// Singleton a nivel módulo: garantiza que sólo una instancia del hook
// ejecute getToken() a la vez, aunque el hook esté montado en
// ClientLayout + ClientHomePage + ClientProfilePage simultáneamente.
// -------------------------------------------------------------------
let _isRetrieving = false;

export const useFcmToken = () => {
    const [token, setToken] = useState<string | null>(null);

    const retrieveToken = async (retryCount = 0) => {
        // Guard: no llamar si otra instancia ya está trabajando
        if (_isRetrieving || !messaging || typeof window === 'undefined') return;

        const user = auth.currentUser;
        if (!user) {
            console.log('[FCM] No user, skipping.');
            return;
        }

        // Solo continuar si el permiso ya fue otorgado (o si lo acabamos de otorgar)
        const perm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
        if (perm !== 'granted') {
            if (perm === 'denied') {
                console.log('[FCM] Permission denied by browser.');
                updateDoc(doc(db, 'users', user.uid), {
                    fcmState: 'denied',
                    'permissions.notifications.status': 'denied',
                    lastFcmUpdate: serverTimestamp()
                }).catch(() => { });
            }
            return;
        }

        _isRetrieving = true;
        console.log('[FCM] Retrieving token for user:', user.uid);

        try {
            // --- Rotate token si el VAPID key cambió ---
            const storedVapid = localStorage.getItem('fcm_vapid_key_vfinal');
            if (storedVapid && storedVapid !== VAPID_KEY) {
                console.log('[FCM] VAPID mismatch, rotating token...');
                await deleteToken(messaging).catch(e => console.warn('[FCM] rotate delete:', e));
            }

            // --- Usar el SW ya activo (navegador lo gestiona, no re-registramos) ---
            // navigator.serviceWorker.ready retorna la registration activa sin re-instalar.
            // Esto evita conflictos con el SW que Vite/Workbox ya registró.
            const registration = await navigator.serviceWorker.ready;
            console.log('[FCM] SW ready, scope:', registration.scope);

            // --- Obtener/refrescar el token FCM ---
            // getToken() es idempotente: devuelve el mismo token si nada cambió,
            // o uno nuevo si el anterior expiró. Funciona correctamente en celular y PC.
            const currentToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (currentToken) {
                console.log('[FCM] Token OK:', currentToken.substring(0, 20) + '...');
                setToken(currentToken);
                localStorage.setItem('fcm_vapid_key_vfinal', VAPID_KEY);

                // Guardar en Firestore usando arrayUnion para preservar tokens de otros dispositivos
                const userRef = doc(db, 'users', user.uid);
                try {
                    await updateDoc(userRef, {
                        fcmToken: currentToken,           // último token activo (referencia rápida)
                        fcmTokens: arrayUnion(currentToken), // array multi-dispositivo
                        lastFcmUpdate: serverTimestamp(),
                        fcmState: 'registered_final_ok',
                        'permissions.notifications.status': 'granted',
                        lastActive: serverTimestamp()
                    });
                    console.log('[FCM] Token saved to Firestore.');
                } catch (err: any) {
                    if (err.code === 'not-found') {
                        await setDoc(userRef, {
                            fcmToken: currentToken,
                            fcmTokens: [currentToken],
                            lastFcmUpdate: serverTimestamp(),
                            permissions: { notifications: { status: 'granted', updatedAt: new Date() } },
                            fcmState: 'registered_final_ok'
                        }, { merge: true });
                    } else {
                        throw err;
                    }
                }

                // Exponer globalmente para que NotificationPermissionPrompt lo llame al otorgar permiso
                (window as any).__lastFcmToken = currentToken;

            } else {
                console.warn('[FCM] getToken() returned null — no push subscription active.');
                updateDoc(doc(db, 'users', user.uid), { fcmState: 'token_null' }).catch(() => { });
            }

        } catch (e: any) {
            console.error(`[FCM] Error (attempt ${retryCount}):`, e.message);
            updateDoc(doc(db, 'users', user.uid), {
                fcmState: 'client_error',
                lastFcmError: e.message
            }).catch(() => { });

            if (retryCount < 2) {
                console.log('[FCM] Retrying in 5s...');
                setTimeout(() => {
                    _isRetrieving = false;
                    retrieveToken(retryCount + 1);
                }, 5000);
                return; // No liberar _isRetrieving todavía
            }
        } finally {
            _isRetrieving = false;
        }
    };

    useEffect(() => {
        // Ejecutar al montarse si ya hay un usuario autenticado
        if (auth.currentUser) {
            retrieveToken();
        }

        // Ejecutar cuando el estado de auth cambia (login)
        const unsubscribe = auth.onAuthStateChanged((user) => {
            if (user) retrieveToken();
        });

        // Ejecutar cuando la app vuelve al primer plano (minimizada → abierta)
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'visible' && auth.currentUser) {
                console.log('[FCM] App visible — refreshing token...');
                retrieveToken();
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Focus también captura el caso de volver desde otra app en móvil
        const handleFocus = () => {
            if (auth.currentUser) retrieveToken();
        };
        window.addEventListener('focus', handleFocus);

        return () => {
            unsubscribe();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('focus', handleFocus);
        };
    }, []);

    // Exponer retrieveToken globalmente para NotificationPermissionPrompt
    useEffect(() => {
        (window as any).retrieveToken = retrieveToken;
        return () => { delete (window as any).retrieveToken; };
    }, []);

    return { token, retrieveToken };
};
