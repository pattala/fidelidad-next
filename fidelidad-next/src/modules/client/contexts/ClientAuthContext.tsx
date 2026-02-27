
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
                // If we found a user, set it immediately
                setUser(firebaseUser);

                const userRef = doc(db, 'users', firebaseUser.uid);
                const adminRef = doc(db, 'admins', firebaseUser.uid);

                // Listen to User Data
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
                            } else {
                                setIsAdmin(false);
                                setUserData(null);
                            }
                        } catch (e) {
                            console.error("Error checking admin status:", e);
                        } finally {
                            setLoading(false);
                        }
                    }
                }, (err: any) => {
                    console.error("Firestore Client Auth Error:", err);
                    // If IDB fails, we might still have the user from auth
                    if (err.message?.includes('IDBDatabase') || err.code === 'failed-precondition') {
                        console.warn("Detected IDB issue, attempting fallback...");
                    }
                    setLoading(false);
                });

            } else {
                // Wait 1.5s before deciding there's definitely no user (persistence safety)
                const timer = setTimeout(() => {
                    if (!auth.currentUser) {
                        setUser(null);
                        setUserData(null);
                        setIsAdmin(false);
                        setLoading(false);
                    }
                }, 1500);
                return () => clearTimeout(timer);
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
