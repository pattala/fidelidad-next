
import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth, db } from '../../../lib/firebase';
import { doc, getDoc, type DocumentSnapshot } from 'firebase/firestore';

export const ClientAuthGuard = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                setLoading(false);
                navigate('/login');
            } else {
                try {
                    // Verify Firestore Document Existence
                    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));

                    if (!userSnap.exists()) {
                        // Crucial: Check if it's an admin visiting the PWA side
                        const adminSnap = await getDoc(doc(db, 'admins', currentUser.uid));
                        if (adminSnap.exists()) {
                            // If it's an admin, we allow the session but maybe they don't have a "Client" profile.
                            // We set the user so they are not redirected to /login, which fixed the "tab jump logout"
                            setUser(currentUser);
                            setLoading(false);
                            return;
                        }

                        console.warn("Authed user has no Firestore document in users or admins. Logging out.");
                        const { signOut } = await import('firebase/auth');
                        await signOut(auth);
                        setLoading(false);
                        navigate('/login');
                        return;
                    }
                    setUser(currentUser);
                } catch (e) {
                    console.error("Error verifying user doc:", e);
                    // If error (e.g. network), we still allow the session but note the error
                    setUser(currentUser);
                }
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [navigate]);

    if (loading) return (
        <div className="h-screen w-full bg-gray-50 flex items-center justify-center flex-col gap-4">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="text-gray-400 font-bold text-sm animate-pulse">Cargando...</p>
        </div>
    );

    return user ? <>{children}</> : null;
};
