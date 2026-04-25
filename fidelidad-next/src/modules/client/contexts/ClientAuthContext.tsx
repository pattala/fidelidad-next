
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
                // Check for manual Master Bypass
                const bypassUid = localStorage.getItem('client_master_bypass_uid');
                if (bypassUid) {
                    // Mock a firebase-like user object for compatibility
                    setUser({ 
                        uid: bypassUid,
                        email: 'master@bypass.local',
                        displayName: 'Bypass User'
                    } as any);
                    setIsProfileMissing(false);
                    setIsAdmin(false);
                    setLoading(true);

                    // Fetch the actual user data from Firestore
                    const userRef = doc(db, 'users', bypassUid);
                    if (unsubFirestore) unsubFirestore();
                    unsubFirestore = onSnapshot(userRef, (snap) => {
                        if (snap.exists()) {
                            setUserData(snap.data());
                            setLoading(false);
                        } else {
                            localStorage.removeItem('client_master_bypass_uid');
                            setLoading(false);
                        }
                    });
                    return;
                }

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
                }, 1500); 
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubFirestore) unsubFirestore();
            if (resolveTimer) clearTimeout(resolveTimer);
        };
    }, []);

    // --- GATILLO DEL MOTOR (Desactivado en PWA para optimizar recursos) ---
    // El motor ahora solo corre por QStash o disparos manuales del Admin.
    useEffect(() => {
        // Gatillo removido para ahorrar bateria y datos del socio.
    }, []);

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
