import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../contexts/ClientAuthContext';

export const ClientAuthGuard = ({ children }: { children: React.ReactNode }) => {
    const { user, userData, loading, isProfileMissing, isAdmin } = useClientAuth();
    const navigate = useNavigate();

    useEffect(() => {
        const checkAuth = async () => {
            if (!loading) {
                if (!user) {
                    const currentPath = window.location.pathname;
                    if (currentPath !== '/login' && currentPath !== '/register') {
                        sessionStorage.setItem('client_redirect_to', currentPath + window.location.search);
                    }
                    navigate('/login');
                } else if (isAdmin) {
                    // CRITICAL: Admins are NOT allowed in the PWA zone as clients.
                    // We force a logout so they can log in with a user account if they wish.
                    console.log("[AuthGuard] Admin detected in PWA. Forcing logout and redirect to login.");
                    const { auth } = await import('../../../lib/firebase');
                    const { signOut } = await import('firebase/auth');
                    await signOut(auth);
                    navigate('/login');
                } else if (isProfileMissing) {
                    // User is authenticated but has no Firestore profile in 'users'.
                    // We force a logout to avoid loops and send to login.
                    const { auth } = await import('../../../lib/firebase');
                    const { signOut } = await import('firebase/auth');
                    await signOut(auth);
                    navigate('/login');
                }
            }
        };

        checkAuth();
    }, [user, loading, isProfileMissing, isAdmin, navigate]);

    if (loading) return (
        <div className="h-screen w-full bg-gray-50 flex items-center justify-center flex-col gap-4">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="text-gray-400 font-bold text-sm animate-pulse">Cargando Socio...</p>
        </div>
    );

    return user ? <>{children}</> : null;
};
