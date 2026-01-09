import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged } from 'firebase/auth';
import { auth } from '../../../lib/firebase';

export const ClientAuthGuard = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [user, setUser] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
            if (!currentUser) {
                // If not logged in, redirect to Client Login Page
                navigate('/login');
            } else {
                setUser(currentUser);
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
