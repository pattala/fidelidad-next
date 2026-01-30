import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { MASTER_ADMINS } from '../../../lib/adminConfig';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isFirstRun, setIsFirstRun] = useState(false);
    const navigate = useNavigate();

    // 0. Detectar si el sistema necesita configuración inicial
    useEffect(() => {
        const checkAdmins = async () => {
            try {
                const snap = await getDocs(collection(db, 'admins'));
                if (snap.empty) {
                    setIsFirstRun(true);
                }
            } catch (e) {
                console.error("Error checking system state", e);
            }
        };
        checkAdmins();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Alias 'admin' -> 'admin@admin.com' para simplicidad
        const finalEmail = email.toLowerCase() === 'admin' ? 'admin@admin.com' : email;

        try {
            if (isFirstRun) {
                // MODO INSTALACIÓN: Crea el primer administrador
                const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, pass);
                const user = userCredential.user;

                await setDoc(doc(db, 'admins', user.uid), {
                    email: finalEmail,
                    role: 'admin',
                    isMaster: true,
                    createdAt: new Date()
                });

                toast.success('¡Sistema Inicializado! Esta es ahora tu cuenta maestra.');
                setIsFirstRun(false);
                navigate('/admin/dashboard');
                return;
            }

            // MODO LOGIN NORMAL
            const userCredential = await signInWithEmailAndPassword(auth, finalEmail, pass);
            const user = userCredential.user;

            // --- SELF-HEALING: Recuperación automática de acceso ---
            // Si el email es 'admin@admin.com' o está en la Whitelist, PERO no tiene documento en 'admins',
            // lo creamos ahora mismo para restaurar el acceso.
            const isMaster = MASTER_ADMINS.includes(user.email || '');
            const isDefaultAdmin = user.email === 'admin@admin.com';

            if (isMaster || isDefaultAdmin) {
                const adminRef = doc(db, 'admins', user.uid);
                const adminSnap = await getDoc(adminRef);

                if (!adminSnap.exists()) {
                    await setDoc(adminRef, {
                        email: user.email,
                        role: 'admin',
                        isMaster: true,
                        autoRecovered: true,
                        createdAt: new Date()
                    });
                    toast.success('¡Acceso Recuperado! Sistema restaurado.');
                } else {
                    toast.success('¡Bienvenido de vuelta!');
                }

                navigate('/admin/dashboard');
                return;
            }
            // --------------------------------------------------------

            // 2. Validar contra tabla de Admins (Normales)
            const adminDoc = await getDoc(doc(db, 'admins', user.uid));
            if (adminDoc.exists()) {
                toast.success('Acceso concedido.');
                navigate('/admin/dashboard');
                return;
            }

            // 3. Validar contra tabla de Usuarios (con rol admin)
            const userDoc = await getDoc(doc(db, 'users', user.uid));
            if (userDoc.exists() && userDoc.data().role === 'admin') {
                toast.success('Sesión iniciada.');
                navigate('/admin/dashboard');
                return;
            }

            // Si llegamos aquí, no tiene permisos
            await signOut(auth);
            toast.error('No tienes permisos de administrador.');
        } catch (err: any) {
            console.error(err);
            if (err.code === 'auth/email-already-in-use') {
                toast.error('El usuario ya existe. Intenta loguearte normalmente.');
                setIsFirstRun(false);
            } else {
                toast.error('Credenciales inválidas o error de conexión.');
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gray-100 flex items-center justify-center p-4">
            <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-sm border border-gray-100">
                <div className="text-center mb-8">
                    <h2 className="text-2xl font-black text-blue-600">
                        {isFirstRun ? 'Configuración de Sistema' : 'Panel de Control'}
                    </h2>
                    <p className="text-gray-400 text-sm font-medium mt-1">
                        {isFirstRun ? 'Crea la cuenta de administrador inicial' : 'Ingresa tus credenciales'}
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                        <input
                            type="email"
                            required
                            placeholder={isFirstRun ? 'admin@empresa.com' : 'tu@email.com'}
                            className="w-full bg-gray-50 px-4 py-3 rounded-xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-50 outline-none transition-all"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                        />
                    </div>
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                required
                                placeholder="••••••••"
                                className="w-full bg-gray-50 px-4 py-3 rounded-xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-blue-100 focus:ring-4 focus:ring-blue-50 outline-none transition-all pr-12"
                                value={pass}
                                onChange={e => setPass(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors p-1"
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className={`w-full py-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 ${isFirstRun
                            ? 'bg-green-600 hover:bg-green-700 text-white shadow-green-200'
                            : 'bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200'
                            } disabled:opacity-50`}
                    >
                        {loading ? 'Procesando...' : (isFirstRun ? 'Crear Administrador Maestro' : 'Iniciar Sesión')}
                    </button>

                    {isFirstRun && (
                        <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 mt-4">
                            <p className="text-[10px] text-amber-700 leading-relaxed">
                                <strong>MODO INSTALACIÓN:</strong> No se detectaron administradores. La primera cuenta que crees tendrá el control total del sistema.
                            </p>
                        </div>
                    )}
                </form>
            </div>
        </div>
    );
};

