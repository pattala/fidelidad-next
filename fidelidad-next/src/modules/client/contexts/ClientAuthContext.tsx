
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';

interface ClientAuthContextType {
    user: User | null;
    userData: any | null;
    loading: boolean;
    isAdmin: boolean;
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

    useEffect(() => {
        let unsubFirestore: (() => void) | undefined;

        const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                setUser(firebaseUser);

                // 1. Verify if Admin
                const adminRef = doc(db, 'admins', firebaseUser.uid);
                const userRef = doc(db, 'users', firebaseUser.uid);

                // Listen to User Data
                unsubFirestore = onSnapshot(userRef, async (snap) => {
                    if (snap.exists()) {
                        setUserData(snap.data());
                        setIsAdmin(false);
                        setLoading(false);
                    } else {
                        // Check if admin (could be visiting PWA side)
                        try {
                            const { getDoc } = await import('firebase/firestore');
                            const adminSnap = await getDoc(adminRef);
                            if (adminSnap.exists()) {
                                setIsAdmin(true);
                                setUserData(null); // Admins don't have a socio document
                            } else {
                                // Real anonymous or missing doc
                                setIsAdmin(false);
                                setUserData(null);
                            }
                        } catch (e) {
                            console.error("Error checking admin status:", e);
                        } finally {
                            setLoading(false);
                        }
                    }
                }, (err) => {
                    console.error("Firestore Client Auth Error:", err);
                    setLoading(false);
                });

            } else {
                setUser(null);
                setUserData(null);
                setIsAdmin(false);
                setLoading(false);
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubFirestore) unsubFirestore();
        };
    }, []);

    return (
        <ClientAuthContext.Provider value={{ user, userData, loading, isAdmin }}>
            {children}
        </ClientAuthContext.Provider>
    );
};

export const useClientAuth = () => useContext(ClientAuthContext);
