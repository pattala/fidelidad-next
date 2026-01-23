import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc } from 'firebase/firestore';
import { Mail, Lock, User, Phone, ArrowLeft, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';

export const ClientRegisterPage = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [phone, setPhone] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        if (pass.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            setLoading(false);
            return;
        }

        try {
            // 1. Crear usuario en Auth
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // 2. Actualizar perfil Auth (DisplayName)
            await updateProfile(user, {
                displayName: name
            });

            // 3. Crear documento en Firestore
            await setDoc(doc(db, 'users', user.uid), {
                name: name,
                email: email,
                phone: phone,
                role: 'client',
                createdAt: new Date(),
                points: 0,
                accumulated_balance: 0, // Saldo para puntos
                permissions: {
                    notifications: { status: 'pending' },
                    geolocation: { status: 'pending' }
                }
            });

            toast.success('¡Cuenta creada con éxito!');
            navigate('/'); // Ir al Home directamente

        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error('El email ya está registrado.');
            } else {
                toast.error('Error al registrarse: ' + error.message);
            }
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
                <button
                    onClick={() => navigate('/login')}
                    className="mb-6 flex items-center gap-2 text-gray-500 font-bold text-sm hover:text-purple-600 transition"
                >
                    <ArrowLeft size={18} /> Volver al Login
                </button>

                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 backdrop-blur-sm">
                    <h2 className="text-xl font-bold text-gray-800 mb-6 text-center">Crear Cuenta</h2>

                    <form onSubmit={handleRegister} className="space-y-4">
                        <div className="relative">
                            <User className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input
                                type="text"
                                required
                                placeholder="Nombre Completo"
                                className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                value={name}
                                onChange={e => setName(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <Phone className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input
                                type="tel"
                                required
                                placeholder="Teléfono"
                                className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                value={phone}
                                onChange={e => setPhone(e.target.value)}
                            />
                        </div>

                        <div className="relative">
                            <Mail className="absolute left-4 top-3.5 text-gray-400" size={20} />
                            <input
                                type="email"
                                required
                                placeholder="Email"
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
                                placeholder="Contraseña (min 6 chars)"
                                className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                value={pass}
                                onChange={e => setPass(e.target.value)}
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-gray-900/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4 disabled:opacity-70"
                        >
                            {loading ? 'Creando cuenta...' : (
                                <>
                                    Registrarme <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                                </>
                            )}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};
