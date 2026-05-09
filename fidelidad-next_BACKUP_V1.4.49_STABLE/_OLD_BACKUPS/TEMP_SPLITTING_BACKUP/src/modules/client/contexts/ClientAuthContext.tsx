
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';

interface ClientAuthContextType {
    user: User | null;
    userData: any | null;
    loading: boolean;
    isAdmin: boolean;
    isProfileMissing?: boolean;
}

const ClientAuthContext = createContext<ClientAuthContextType>({
    user: null,
    userData: null,
    loading: true,
    isAdmin: false,
});

export const ClientAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [userData, setUserData] = useState<any | null>(null);
    const [loading, setLoading] = useState(true);
    const [isAdmin, setIsAdmin] = useState(false);
    const [isProfileMissing, setIsProfileMissing] = useState(false);

    useEffect(() => {
        let unsubFirestore: (() => void) | undefined;
        let resolveTimer: any | undefined;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            // Clear any pending resolve timer
            if (resolveTimer) clearTimeout(resolveTimer);

            if (firebaseUser) {
                setUser(firebaseUser);
                setIsProfileMissing(false);
                setIsAdmin(false); // Reset to false until checked
                setLoading(true);

                const userRef = doc(db, 'users', firebaseUser.uid);
                const adminRef = doc(db, 'admins', firebaseUser.uid);

                if (unsubFirestore) unsubFirestore();
                unsubFirestore = onSnapshot(userRef, async (snap) => {
                    if (snap.exists()) {
                        setUserData(snap.data());
                        setIsAdmin(false);
                        setLoading(false);
                    } else {
                        try {
                            const { getDoc } = await import('firebase/firestore');
                            const adminSnap = await getDoc(adminRef);
                            if (adminSnap.exists()) {
                                setIsAdmin(true);
                                setUserData(null);
                                // Trigger dashboard style call for admins (to maintain activity)
                                fetch('/api/engine-daily?mode=daily&trigger=pwa_admin', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'x-api-key': import.meta.env.VITE_API_KEY || ''
                                    },
                                    body: JSON.stringify({})
                                }).catch(() => {});
                            } else {
                                setIsAdmin(false);
                                setUserData(null);
                                setIsProfileMissing(true);
                            }
                        } catch (e) {
                            console.error("Error checking role:", e);
                            setIsProfileMissing(true);
                        } finally {
                            setLoading(false);
                        }
                    }
                }, (err: any) => {
                    console.error("Firestore Auth Snapshot Error:", err);
                    setLoading(false);
                });

            } else {
                // Not authenticated immediately - Wait for Firebase to finish trying
                // Increasing to 4s for slower PWA environments/tabs
                resolveTimer = setTimeout(() => {
                    if (!auth.currentUser) {
                        setUser(null);
                        setUserData(null);
                        setIsAdmin(false);
                        setIsProfileMissing(false);
                        setLoading(false);
                    }
                }, 4000); 
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubFirestore) unsubFirestore();
            if (resolveTimer) clearTimeout(resolveTimer);
        };
    }, []);

    // --- GATILLO INTELIGENTE (PWA Autónoma) ---
    // Este efecto avisa al motor de cambios, pero el motor decide si trabajar o no.
    useEffect(() => {
        if (!user || isAdmin || isProfileMissing) return;

        const triggerEngine = async () => {
            try {
                const token = await auth.currentUser?.getIdToken();
                const API_KEY = import.meta.env.VITE_API_KEY || '';
                
                // Llamada silenciosa al motor diario
                // Usamos trigger=pwa para que el servidor sepa que puede aplicar deduplicación
                fetch('/api/engine-daily?mode=daily&trigger=pwa', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': API_KEY,
                        'Authorization': `Bearer ${token}`
                    }
                }).catch(() => {});
            } catch (e) {
                // Silencioso, no queremos interrumpir la UI
            }
        };

        // Debounce simple para no saturar ante cambios rápidos
        const timer = setTimeout(triggerEngine, 2000);
        return () => clearTimeout(timer);
    }, [userData?.points, userData?.accumulated_balance, userData?.lastPointsUpdate]);

    // --- SINCRONIZACIÓN GLOBAL DE TIEMPO ---
    useEffect(() => {
        const configRef = doc(db, 'config', 'general');
        const unsub = onSnapshot(configRef, (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                const offset = Number(data.simulatedOffsetDays || 0);
                TimeService.setGlobalOffset(offset);
            }
        });
        return () => unsub();
    }, []);

    return (
        <ClientAuthContext.Provider value={{
            user,
            userData,
            loading,
            isAdmin,
            isProfileMissing
        }}>
            {!loading && children}
        </ClientAuthContext.Provider>
    );
};

export const useClientAuth = () => useContext(ClientAuthContext);
