import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        // 1. Initial Check: Wait for persistence to settle
        const initCheck = async () => {
            await auth.authStateReady();
            setUser(auth.currentUser);
            setLoading(false);
            if (!auth.currentUser) {
                navigate('/admin');
            }
        };
        initCheck();

        // 2. Real-time Listener (for active sign-outs)
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            setUser(currentUser);
            if (!loading && !currentUser) {
                // Only redirect if we were already loaded (active logout)
                navigate('/admin');
            }
        });
        return () => unsubscribe();
    }, [navigate]); // Removed 'loading' from dependency to avoid loop, handled inside logic

    if (loading) return <div className="h-screen flex items-center justify-center">Cargando...</div>;

    return user ? <>{children}</> : null;
};
