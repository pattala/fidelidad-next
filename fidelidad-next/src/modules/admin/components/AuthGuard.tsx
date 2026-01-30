import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { onAuthStateChanged, signOut } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

export const AuthGuard = ({ children }: { children: React.ReactNode }) => {
    const [loading, setLoading] = useState(true);
    const [authorized, setAuthorized] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (user) => {
            if (user) {
                try {
                    // Try to find the user role in Firestore
                    // Check in 'users' collection (for promoted clients)
                    const userDoc = await getDoc(doc(db, 'users', user.uid));
                    if (userDoc.exists() && userDoc.data().role === 'admin') {
                        setAuthorized(true);
                        setLoading(false);
                        return;
                    }

                    // Check in 'admins' collection (dedicated administrators)
                    const adminDoc = await getDoc(doc(db, 'admins', user.uid));
                    if (adminDoc.exists()) {
                        setAuthorized(true);
                        setLoading(false);
                        return;
                    }

                    // If not found in either, access is denied
                    console.warn("Acceso denegado: El usuario no tiene rol administrativo.");
                    toast.error("No tienes permisos de administrador.");
                    setAuthorized(false);
                    navigate('/admin/login');
                } catch (error) {
                    console.error("Error verificando permisos:", error);
                    toast.error("Error al verificar permisos.");
                    setAuthorized(false);
                    navigate('/admin/login');
                }
            } else {
                setAuthorized(false);
                navigate('/admin/login');
            }
            setLoading(false);
        });

        return () => unsubscribe();
    }, [navigate]);

    if (loading) return (
        <div className="h-screen flex flex-col items-center justify-center gap-4 bg-gray-50">
            <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
            <p className="text-gray-500 font-medium animate-pulse">Verificando credenciales...</p>
        </div>
    );

    return authorized ? <>{children}</> : null;
};
