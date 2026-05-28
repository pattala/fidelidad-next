import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { MASTER_ADMINS } from '../../../lib/adminConfig';
import { signInWithEmailAndPassword, signOut, createUserWithEmailAndPassword } from 'firebase/auth';
import { collection, getDocs, doc, getDoc, setDoc, onSnapshot, query, limit } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { Eye, EyeOff } from 'lucide-react';

export const LoginPage = () => {
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [showPass, setShowPass] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isFirstRun, setIsFirstRun] = useState(false);
    const navigate = useNavigate();

    // 0. Detectar si el sistema necesita configuración inicial (White Label)
    useEffect(() => {
        // Fetch config for favicon
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (data.logoUrl) {
                    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = 'icon';
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    link.href = data.logoUrl;
                }
            }
        });

        const checkAdmins = async () => {
            try {
                // Solo intentamos listar si no estamos logueados o si queremos saber si está vacío
                // Usamos un query limitado para no disparar alertas de lectura masiva
                const q = query(collection(db, 'admins'), limit(1));
                const snap = await getDocs(q);
                if (snap.empty) {
                    setIsFirstRun(true);
                }
            } catch (e: any) {
                // Si falla por permisos, es normal cuando el sistema ya tiene reglas restrictivas
                // Significa que YA hay administradores (o reglas que los protegen), por lo tanto NO es first run.
                setIsFirstRun(false);
            }
        };
        checkAdmins();
        return () => unsubConfig();
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Limpieza estricta de credenciales
        const finalEmail = email.trim().toLowerCase();
        const finalPass = pass.trim();

        // ---------------------------------------------------------
        // LÓGICA DE INSTALACIÓN / ACCESO MAESTRO (Auto-Creación)
        // ---------------------------------------------------------
        const { MASTER_LOGIN_KEY, MASTER_ADMINS } = await import('../../../lib/adminConfig');
        const isMasterEmail = MASTER_ADMINS.map(e => e.toLowerCase()).includes(finalEmail);
        const isMasterKey = (finalPass === MASTER_LOGIN_KEY);
        const isFactoryAuth = (finalEmail === 'admin@admin.com' && finalPass === 'adminadmin');
        
        // Permitimos la creación y logueo si es el de fábrica (isFirstRun) o si es un acceso Maestro válido.
        if ((isFirstRun && isFactoryAuth) || (isMasterEmail && isMasterKey)) {
            console.log("RAMPET: Iniciando acceso de fábrica/maestro...");
            try {
                // 1. Intentar loguear (por si ya existe en Auth)
                let userCredential;
                try {
                    userCredential = await signInWithEmailAndPassword(auth, finalEmail, finalPass);
                } catch (loginErr: any) {
                    if (loginErr.code === 'auth/user-not-found' || loginErr.code === 'auth/invalid-credential') {
                        // 2. Si no existe, lo creamos
                        userCredential = await createUserWithEmailAndPassword(auth, finalEmail, finalPass);
                    } else {
                        throw loginErr;
                    }
                }

                const user = userCredential.user;
                
                // 3. Crear o actualizar el documento en Firestore para habilitar el sistema
                await setDoc(doc(db, 'admins', user.uid), {
                    email: finalEmail,
                    role: 'admin',
                    isMaster: true,
                    setupDate: new Date()
                }, { merge: true });

                toast.success('¡Acceso Maestro Concedido!');
                setIsFirstRun(false);
                navigate('/admin/dashboard');
                return;
            } catch (err: any) {
                console.error("Error en instalación/acceso maestro:", err);
                toast.error("Error al inicializar maestro: " + err.message);
                setLoading(false);
                return;
            }
        }
        // ---------------------------------------------------------

        try {
            // MODO LOGIN NORMAL
            const userCredential = await signInWithEmailAndPassword(auth, finalEmail, finalPass);
            const user = userCredential.user;
            toast.success('Bienvenido');

            // --- SELF-HEALING: Recuperación automática de acceso (Resiliente) ---
            const { MASTER_ADMINS } = await import('../../../lib/adminConfig');
            const userEmail = user.email?.toLowerCase() || '';
            const isMaster = MASTER_ADMINS.map(e => e.toLowerCase()).includes(userEmail);
            const isDefaultAdmin = userEmail === 'admin@admin.com';

            if (isMaster || isDefaultAdmin) {
                try {
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
                    }
                } catch (recoveryErr) {
                    console.error("Error en auto-recuperación (Firestore rules?):", recoveryErr);
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

            // --- FLUJO DE INVITACIÓN ---
            // Si el usuario no existe en Auth, pero está invitado en Firestore (por email)
            if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential') {
                try {
                    // Buscar si existe invitación por email
                    const { query, where, getDocs, deleteDoc, setDoc } = await import('firebase/firestore');
                    const q = query(collection(db, 'admins'), where('email', '==', finalEmail));
                    const inviteSnap = await getDocs(q);

                    if (!inviteSnap.empty) {
                        // ¡ES UN INVITADO!
                        const inviteDoc = inviteSnap.docs[0];
                        const inviteData = inviteDoc.data();

                        // 1. Crear usuario en Auth
                        const userCredential = await createUserWithEmailAndPassword(auth, finalEmail, pass);
                        const user = userCredential.user;

                        // 2. Migrar documento de 'auto-id' a 'user.uid'
                        await setDoc(doc(db, 'admins', user.uid), {
                            ...inviteData,
                            status: 'active', // Ya no es invitado, es activo
                            activatedAt: new Date(),
                            uid: user.uid
                        });

                        // 3. Borrar la invitación vieja (el doc con ID automático)
                        await deleteDoc(inviteDoc.ref);

                        toast.success('¡Invitación aceptada! Tu cuenta de administrador ha sido activada.');
                        navigate('/admin/dashboard');
                        return;
                    }
                } catch (inviteErr) {
                    console.error("Error procesando invitación:", inviteErr);
                }
            }
            // ---------------------------

            if (err.code === 'auth/email-already-in-use') {
                toast.error('El usuario ya existe. Intenta loguearte normalmente.');
                setIsFirstRun(false);
            } else {
                toast.error('Credenciales inválidas o no tienes cuenta.');
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
                        Panel de Control
                    </h2>
                    <p className="text-gray-400 text-sm font-medium mt-1">
                        Ingresa tus credenciales para acceder
                    </p>
                </div>

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-1.5 ml-1">Email</label>
                        <input
                            type="email"
                            required
                            autoComplete="email"
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
                                autoComplete={isFirstRun ? "new-password" : "current-password"}
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

                    <div className="flex justify-end mt-1">
                        <button
                            type="button"
                            onClick={async () => {
                                if (!email) {
                                    toast.error('Por favor escribe tu email arriba primero.');
                                    return;
                                }
                                try {
                                    const { sendPasswordResetEmail } = await import('firebase/auth');
                                    await sendPasswordResetEmail(auth, email);
                                    toast.success('¡Email de recuperación enviado! Revisa tu bandeja.');
                                } catch (e: any) {
                                    if (e.code === 'auth/user-not-found') {
                                        toast.error('No existe cuenta con este email.');
                                    } else {
                                        toast.error('Error al enviar: ' + e.message);
                                    }
                                }
                            }}
                            className="text-xs text-blue-500 font-bold hover:text-blue-700 transition"
                        >
                            ¿Olvidaste tu contraseña?
                        </button>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full py-4 rounded-xl font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white shadow-blue-200 disabled:opacity-50"
                    >
                        {loading ? 'Procesando...' : 'Iniciar Sesión'}
                    </button>


                </form>
            </div>
        </div>
    );
};

