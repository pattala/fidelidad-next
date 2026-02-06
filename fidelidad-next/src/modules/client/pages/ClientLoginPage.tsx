import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, query, where, getDocs, setDoc, deleteDoc, doc } from 'firebase/firestore';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfigService } from '../../../services/configService';
import { useEffect } from 'react';

export const ClientLoginPage = () => {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const navigate = useNavigate();

    useEffect(() => {
        ConfigService.get().then(setConfig);
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            // 1. Try Standard Login
            await signInWithEmailAndPassword(auth, email, pass);
            navigate('/');
            toast.success('¡Hola de nuevo!', { icon: '👋', duration: 3000 });
        } catch (err: any) {
            console.error(err);

            // 2. Lazy Registration (If user exists in DB but not in Auth)
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/invalid-login-credentials') {
                try {
                    // Check if exists in Firestore "users" collection (created by Admin)
                    const q = query(collection(db, 'users'), where('email', '==', email));
                    const snapshot = await getDocs(q);

                    if (!snapshot.empty) {
                        const userDoc = snapshot.docs[0];
                        const userData = userDoc.data();

                        // VALIDATION: Password must match DNI for initial setup (or user-set password if we add that later)
                        if (userData.dni === pass) {
                            // Create the Auth User for the first time
                            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
                            const newAuthUid = userCredential.user.uid;

                            // MIGRATION: 
                            // 1. Copy old Firestore data to NEW doc with ID = authUser.uid
                            await setDoc(doc(db, 'users', newAuthUid), {
                                ...userData,
                                // Update ID reference inside if needed, though mostly ID is key.
                                // Preserving createdAt is good.
                                migratedFrom: userDoc.id,
                                lastLoginAt: new Date()
                            });

                            // 2. Delete the old document (to avoid duplicates)
                            await deleteDoc(doc(db, 'users', userDoc.id));

                            navigate('/');
                            toast.success('¡Cuenta activada y sincronizada!', { duration: 4000 });
                            return;
                        }
                    }
                } catch (dbError) {
                    console.error("Database check failed", dbError);
                }
            }

            toast.error('Credenciales incorrectas o cuenta no registrada');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-200/50 rounded-full blur-3xl -ml-16 -mb-16"></div>

            <div className="relative z-10 w-full max-w-sm">

                {/* Logo / Brand */}
                <div className="mb-10 text-center">
                    <div className="w-20 h-20 bg-white rounded-3xl mx-auto shadow-xl shadow-purple-500/10 flex items-center justify-center mb-4 transform -rotate-3 overflow-hidden p-2">
                        {config?.logoUrl ? (
                            <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-4xl">🚀</span>
                        )}
                    </div>
                    <h1 className="text-3xl font-black text-gray-800 tracking-tight">
                        {config?.siteName || 'Club Fidelidad'}
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Tu programa de recompensas</p>
                </div>

                {/* Login Card */}
                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Iniciar Sesión</h2>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input
                                type="email"
                                required
                                placeholder="tu@email.com"
                                className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <Lock className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input
                                type="password"
                                required
                                placeholder="Tu contraseña"
                                className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                value={pass}
                                onChange={e => setPass(e.target.value)}
                            />
                        </div>

                        <div className="text-right">
                            <a href="#" className="text-xs font-bold text-purple-600 hover:underline">
                                ¿Olvidaste tu clave?
                            </a>
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-gray-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:scale-100"
                        >
                            {loading ? (
                                'Ingresando...'
                            ) : (
                                <>
                                    Entrar ahora <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>

                {/* Footer Link */}
                <div className="text-center mt-8">
                    <p className="text-sm text-gray-500 font-medium">
                        ¿No tienes cuenta? <button onClick={() => navigate('/register')} className="text-purple-600 font-bold hover:underline">Regístrate gratis</button>
                    </p>
                </div>

            </div>
        </div>
    );
};
