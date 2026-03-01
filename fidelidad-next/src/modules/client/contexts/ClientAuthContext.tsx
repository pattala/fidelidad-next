
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

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
                setLoading(true);

                const userRef = doc(db, 'users', firebaseUser.uid);
                const adminRef = doc(db, 'admins', firebaseUser.uid);

                if (unsubFirestore) unsubFirestore();
                unsubFirestore = onSnapshot(userRef, async (snap) => {
                    if (snap.exists()) {
                        setUserData(snap.data());
                        setIsAdmin(false);
                        setLoading(false);

                        // Silent background trigger for daily engine
                        try {
                            const { getDoc, doc } = await import('firebase/firestore');
                            const configSnap = await getDoc(doc(db, 'config', 'general'));
                            if (configSnap.exists()) {
                                const cfg = configSnap.data();
                                if (cfg.messaging?.enableClientTrigger !== false) {
                                    fetch('/api/engine-daily?mode=daily', { method: 'POST' }).catch(() => { });
                                }
                            } else {
                                fetch('/api/engine-daily?mode=daily', { method: 'POST' }).catch(() => { });
                            }
                        } catch (e) { }
                    } else {
                        try {
                            const { getDoc } = await import('firebase/firestore');
                            const adminSnap = await getDoc(adminRef);
                            if (adminSnap.exists()) {
                                setIsAdmin(true);
                                setUserData(null);
                                fetch('/api/engine-daily?mode=daily&trigger=pwa', {
                                    method: 'POST',
                                    headers: {
                                        'Content-Type': 'application/json',
                                        'x-api-key': import.meta.env.VITE_API_KEY || ''
                                    },
                                    body: JSON.stringify({})
                                }).catch(err => console.error('[ClientAuth] Engine error:', err));
                            } else {
                                setIsAdmin(false);
                                setUserData(null);
                                setIsProfileMissing(true);
                            }
                        } catch (e) {
                            console.error("Error checking admin status:", e);
                            setIsProfileMissing(true);
                        } finally {
                            setLoading(false);
                        }
                    }
                }, (err: any) => {
                    console.error("Firestore Client Auth Error:", err);
                    setLoading(false);
                });

            } else {
                // Not authenticated
                setLoading(true);
                resolveTimer = setTimeout(() => {
                    if (!auth.currentUser) {
                        setUser(null);
                        setUserData(null);
                        setIsAdmin(false);
                        setIsProfileMissing(false);
                        setLoading(false);
                    }
                }, 1000); // Reduced to 1s
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubFirestore) unsubFirestore();
            if (resolveTimer) clearTimeout(resolveTimer);
        };
    }, []);

    return (
        <ClientAuthContext.Provider value={{ user, userData, loading, isAdmin, isProfileMissing } as any}>
            {children}
        </ClientAuthContext.Provider>
    );
};

export const useClientAuth = () => useContext(ClientAuthContext);
