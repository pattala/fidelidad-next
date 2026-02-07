
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
                let resolvedRole: AdminRole = null;
                try {
                    const userEmail = firebaseUser.email?.toLowerCase() || '';
                    const isMaster = MASTER_ADMINS.map(e => e.toLowerCase()).includes(userEmail);
                    const isDefaultAdmin = userEmail === 'admin@admin.com';

                    if (isMaster || isDefaultAdmin) {
                        resolvedRole = 'admin';
                    } else {
                        // Check explicit admins collection
                        const adminDoc = await getDoc(doc(db, 'admins', firebaseUser.uid));
                        if (adminDoc.exists()) {
                            resolvedRole = adminDoc.data().role as AdminRole;
                        } else {
                            // Check 'users' collection for promoted role
                            const userDoc = await getDoc(doc(db, 'users', firebaseUser.uid));
                            if (userDoc.exists() && userDoc.data().role === 'admin') {
                                resolvedRole = 'admin';
                            }
                        }
                    }
                } catch (e) {
                    console.error("Error fetching admin role:", e);
                }

                // Update both together to avoid intermediate states
                setRole(resolvedRole);
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
