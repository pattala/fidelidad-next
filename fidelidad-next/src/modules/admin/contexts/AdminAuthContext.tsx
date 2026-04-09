
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

                // If we have a cached role, use it immediately and stop loading
                // The background refresh will update if the role changed
                if (cachedRole) {
                    setRole(cachedRole);
                    setUser(firebaseUser);
                    setLoading(false); // ← fix: don't block UI waiting for network
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
                            setRole(null);
                        }

                        setUser(firebaseUser);
                        setLoading(false);
                    } catch (e) {
                        console.error(`Error fetching admin role (attempt ${retryCount + 1}):`, e);

                        if (retryCount < 2) {
                            setTimeout(() => fetchRole(retryCount + 1), 1000);
                        } else {
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
                // Check for manual Master Bypass
                const bypassEmail = localStorage.getItem('admin_master_bypass');
                if (bypassEmail) {
                    setRole('admin');
                    // Mock a firebase-like user object for compatibility
                    setUser({ 
                        email: bypassEmail, 
                        uid: 'master-bypass',
                        displayName: 'Master Admin'
                    } as any);
                    setLoading(false);
                    return;
                }

                // Grace period: give Firebase 800ms to restore session before treating as logged out
                // This prevents false guest redirects during page load with LOCAL persistence
                setTimeout(() => {
                    if (!auth.currentUser) {
                        setUser(null);
                        setRole(null);
                        setLoading(false);
                    }
                }, 4000);
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
