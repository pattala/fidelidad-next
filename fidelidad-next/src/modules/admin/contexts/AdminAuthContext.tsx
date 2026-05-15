
import React, { createContext, useContext, useState, useEffect } from 'react';
import { onAuthStateChanged, type User } from 'firebase/auth';
import { doc, getDoc, getDocs, collection, query, limit } from 'firebase/firestore';
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
                    console.log(`[AdminAuth] Found cached role: ${cachedRole} for ${firebaseUser.uid}. UI unblocked.`);
                    setRole(cachedRole);
                    setUser(firebaseUser);
                    setLoading(false); // ← fix: don't block UI waiting for network
                } else {
                    console.log(`[AdminAuth] No cached role for ${firebaseUser.uid}. Fetching...`);
                }

                const fetchRole = async (retryCount = 0): Promise<void> => {
                    try {
                        const isMaster = MASTER_ADMINS.map(e => e.toLowerCase()).includes(userEmail);
                        const isDefaultAdmin = userEmail === 'admin@admin.com';

                        console.log(`[AdminAuth] Checking role for ${userEmail}. Master: ${isMaster}, Default: ${isDefaultAdmin}`);

                        let resolvedRole: AdminRole = null;

                        if (isMaster) {
                            resolvedRole = 'admin';
                        } else {
                            const [adminDoc, userDoc, adminsColSnap] = await Promise.all([
                                getDoc(doc(db, 'admins', firebaseUser.uid)),
                                getDoc(doc(db, 'users', firebaseUser.uid)),
                                getDocs(query(collection(db, 'admins'), limit(1)))
                            ]);

                            const hasExternalAdmins = !adminsColSnap.empty;
                            console.log(`[AdminAuth] Docs fetched. AdminDoc exists: ${adminDoc.exists()}, UserDoc exists: ${userDoc.exists()}, HasOtherAdmins: ${hasExternalAdmins}`);

                            // Bootstrap Mode: admin@admin only works as fallback if NO other admins exist
                            if (userEmail === 'admin@admin.com') {
                                if (!hasExternalAdmins) {
                                    resolvedRole = 'admin';
                                } else {
                                    console.warn("[AdminAuth] Factory admin blocked because other admins exist.");
                                    resolvedRole = null; 
                                }
                            } else if (adminDoc.exists()) {
                                resolvedRole = adminDoc.data().role as AdminRole;
                            } else if (userDoc.exists() && userDoc.data().role === 'admin') {
                                resolvedRole = 'admin';
                            }
                        }

                        console.log(`[AdminAuth] Resolved role: ${resolvedRole}`);

                        if (resolvedRole) {
                            localStorage.setItem(cacheKey, resolvedRole);
                            setRole(resolvedRole);
                        } else if (!cachedRole) {
                            console.warn("[AdminAuth] No role resolved and no cache found.");
                            setRole(null);
                        }

                        setUser(firebaseUser);
                        setLoading(false);
                    } catch (e: any) {
                        console.error(`[AdminAuth] Error fetching role (attempt ${retryCount + 1}):`, e);

                        // SI es error de permisos y tenemos cache, asumimos que la sesión se pisó
                        // en otra pestaña pero NO matamos la sesión actual del admin.
                        if ((e.code === 'permission-denied' || e.message?.includes('permission')) && cachedRole) {
                            console.warn("[AdminAuth] Permission denied. Maintaining cached role to prevent false logout.");
                            setRole(cachedRole);
                            setUser(firebaseUser);
                            setLoading(false);
                            return;
                        }

                        if (retryCount < 2) {
                            console.log("[AdminAuth] Retrying in 1s...");
                            setTimeout(() => fetchRole(retryCount + 1), 1000);
                        } else {
                            if (cachedRole) {
                                console.warn("[AdminAuth] Using cached role due to persistent network errors.");
                                setRole(cachedRole);
                                setUser(firebaseUser);
                            } else {
                                console.error("[AdminAuth] Final attempt failed. No cache. Access denied.");
                                setRole(null);
                            }
                            setLoading(false);
                        }
                    }
                };

                fetchRole();
            } else {
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
