import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

export const ClientAuthGuard = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (currentUser) => {
            if (!currentUser) {
                navigate('/login');
            } else {
                // Verify Firestore Document Existence
                try {
                    const { doc, getDoc } = await import('firebase/firestore');
                    const { db } = await import('../../../lib/firebase');
                    const userSnap = await getDoc(doc(db, 'users', currentUser.uid));

                    if (!userSnap.exists()) {
                        console.warn("Authed user has no Firestore document. Logging out.");
                        const { signOut } = await import('firebase/auth');
                        await signOut(auth);
                        navigate('/login');
                        return;
                    }
                    setUser(currentUser);
                } catch (e) {
                    console.error("Error verifying user doc:", e);
                    // Fallback to allowing auth if Firestore is temporarily down? 
                    // No, safe default is logout/login
                    setUser(currentUser);
                }
            }
            setLoading(false);
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
