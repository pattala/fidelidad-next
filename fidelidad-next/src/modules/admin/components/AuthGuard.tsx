
import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import { MASTER_ADMINS } from '../../../lib/adminConfig';
import toast from 'react-hot-toast';
import { AdminAuthProvider, useAdminAuth } from '../contexts/AdminAuthContext';

const GuardInner = ({ children }: { children: React.ReactNode }) => {
    const { user, role, loading } = useAdminAuth();
    const navigate = useNavigate();

    useEffect(() => {
        if (!loading) {
            if (!user) {
                navigate('/admin/login');
                return;
            }

            if (!role) {
                console.warn("Acceso denegado: Usuario no tiene rol de admin.");
                toast.error("No tienes permisos de administrador.");
                signOut(auth).then(() => navigate('/admin/login'));
            }
        }
    }, [user, role, loading, navigate]);

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium animate-pulse">Verificando credenciales...</p>
        </div>
    );

    return (user && role) ? <>{children}</> : null;
};

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    return (
        <AdminAuthProvider>
            <GuardInner>{children}</GuardInner>
        </AdminAuthProvider>
    );
};
