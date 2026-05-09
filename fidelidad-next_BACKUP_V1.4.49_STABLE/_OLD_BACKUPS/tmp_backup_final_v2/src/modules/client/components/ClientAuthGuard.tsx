import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useClientAuth } from '../contexts/ClientAuthContext';

export const ClientAuthGuard = ({ children }: { children: React.ReactNode }) => {
    const { user, loading } = useClientAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading && !user) {
            navigate('/login');
        }
    }, [user, loading, navigate]);

    if (loading) return (
        <div className="h-screen w-full bg-gray-50 flex items-center justify-center flex-col gap-4">
            <div className="w-12 h-12 border-4 border-purple-200 border-t-purple-600 rounded-full animate-spin"></div>
            <p className="text-gray-400 font-bold text-sm animate-pulse">Cargando Socio...</p>
        </div>
    );

    return user ? <>{children}</> : null;
};
