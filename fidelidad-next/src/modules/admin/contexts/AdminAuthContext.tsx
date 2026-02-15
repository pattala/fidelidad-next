
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { MASTER_ADMINS } from '../../../lib/adminConfig';

export type AdminRole = 'admin' | 'editor' | 'viewer' | null;

interface AdminAuthContextType {
    user: User | null;
    role: AdminRole;
    loading: boolean;
    isReadOnly: boolean;
}

const AdminAuthContext = createContext<AdminAuthContextType>({
    user: null,
    role: null,
    loading: true,
    isReadOnly: false,
});

export const AdminAuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [user, setUser] = useState<User | null>(null);
    const [role, setRole] = useState<AdminRole>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
            if (firebaseUser) {
                // If we already have the same user and role, don't trigger intermediate loading
                // But on initialization we need to fetch the role

                try {
                    const userEmail = firebaseUser.email?.toLowerCase() || '';
                    const isMaster = MASTER_ADMINS.map(e => e.toLowerCase()).includes(userEmail);
                    const isDefaultAdmin = userEmail === 'admin@admin.com';

                    let resolvedRole: AdminRole = null;

                    if (isMaster || isDefaultAdmin) {
                        resolvedRole = 'admin';
                    } else {
                        // Parallel check for performance
                        const [adminDoc, userDoc] = await Promise.all([
                            getDoc(doc(db, 'admins', firebaseUser.uid)),
                            getDoc(doc(db, 'users', firebaseUser.uid))
                        ]);

                        if (adminDoc.exists()) {
                            resolvedRole = adminDoc.data().role as AdminRole;
                        } else if (userDoc.exists() && userDoc.data().role === 'admin') {
                            resolvedRole = 'admin';
                        }
                    }

                    setRole(resolvedRole);
                    setUser(firebaseUser);
                    setLoading(false);
                } catch (e) {
                    console.error("Error fetching admin role:", e);
                    // In case of network error, we DON'T stop loading immediately to prevent redirect 
                    // unless it persists. We can try one more time or just let it be.
                    // For now, allow a fallback if it was already set or set null if confirmed missing.
                    setLoading(false);
                }
            } else {
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, []);

    return (
        <AdminAuthContext.Provider value={{ user, role, loading, isReadOnly: role === 'viewer' }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
