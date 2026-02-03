
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
                try {
                    const userEmail = firebaseUser.email?.toLowerCase() || '';
                    const isMaster = MASTER_ADMINS.map(e => e.toLowerCase()).includes(userEmail);
                    const isDefaultAdmin = userEmail === 'admin@admin.com';

                    // Check if Master Admin or Default Factory Admin
                    if (isMaster || isDefaultAdmin) {
                        setRole('admin');
                    } else {
                        // Try to get role from 'admins' collection
                        const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
                        if (adminDoc.exists()) {
                            setRole(adminDoc.data().role as AdminRole);
                        } else {
                            // Fallback: check if it's a promoted user/role:admin
                            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                            if (userDoc.exists() && userDoc.data().role === 'admin') {
                                setRole('admin');
                            } else {
                                setRole(null);
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching admin role:", e);
                    setRole(null);
                }
                setUser(firebaseUser);
            } else {
                setUser(null);
                setRole(null);
            }
            setLoading(false);
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
