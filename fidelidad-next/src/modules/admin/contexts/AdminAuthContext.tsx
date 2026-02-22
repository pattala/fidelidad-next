
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
                const userEmail = firebaseUser.email?.toLowerCase() || '';
                const cacheKey = `admin_role_${firebaseUser.uid}`;
                const cachedRole = localStorage.getItem(cacheKey) as AdminRole;

                // If we have a cached role, use it immediately to avoid intermediate loading/redirects
                if (cachedRole) {
                    setRole(cachedRole);
                    setUser(firebaseUser);
                    // We still fetch fresh data, but don't set loading to true if we have a cache
                    // to prevent flickering. However, on first init, we are already loading=true.
                }

                const fetchRole = async (retryCount = 0): Promise<void> => {
                    try {
                        const isMaster = MASTER_ADMINS.map(e => e.toLowerCase()).includes(userEmail);
                        const isDefaultAdmin = userEmail === 'admin@admin.com';

                        let resolvedRole: AdminRole = null;

                        if (isMaster || isDefaultAdmin) {
                            resolvedRole = 'admin';
                        } else {
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

                        if (resolvedRole) {
                            localStorage.setItem(cacheKey, resolvedRole);
                            setRole(resolvedRole);
                        } else if (!cachedRole) {
                            // If no role found AND no cache, then it's definitely null
                            setRole(null);
                        }

                        setUser(firebaseUser);
                        setLoading(false);
                    } catch (e) {
                        console.error(`Error fetching admin role (attempt ${retryCount + 1}):`, e);

                        if (retryCount < 2) {
                            // Retry after 1s
                            setTimeout(() => fetchRole(retryCount + 1), 1000);
                        } else {
                            // Max retries reached. Use cache if available, otherwise fail.
                            if (cachedRole) {
                                console.warn("Using cached role due to persistent network errors.");
                                setRole(cachedRole);
                            } else {
                                setRole(null);
                            }
                            setLoading(false);
                        }
                    }
                };

                fetchRole();
            } else {
                localStorage.removeItem(user ? `admin_role_${user.uid}` : ''); // Cleanup if possible
                setUser(null);
                setRole(null);
                setLoading(false);
            }
        });

        return () => unsubscribe();
    }, [user?.uid]);

    return (
        <AdminAuthContext.Provider value={{ user, role, loading, isReadOnly: role === 'viewer' }}>
            {children}
        </AdminAuthContext.Provider>
    );
};

export const useAdminAuth = () => useContext(AdminAuthContext);
