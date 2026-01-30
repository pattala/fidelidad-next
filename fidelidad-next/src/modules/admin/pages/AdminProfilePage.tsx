
import React, { useState } from 'react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import { Lock, User } from 'lucide-react';

export const AdminProfilePage = () => {
    const user = auth.currentUser;
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [loading, setLoading] = useState(false);

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user || !user.email) return;
        setLoading(true);

        try {
            // 1. Re-autenticar (necesario para cambios sensibles)
            const credential = EmailAuthProvider.credential(user.email, currentPass);
            await reauthenticateWithCredential(user, credential);

            // 2. Actualizar contraseña
            await updatePassword(user, newPass);

            toast.success('¡Contraseña actualizada correctamente!');
            setCurrentPass('');
            setNewPass('');
        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/wrong-password') {
                toast.error('La contraseña actual es incorrecta.');
            } else if (error.code === 'auth/weak-password') {
                toast.error('La nueva contraseña es muy debil (min 6 caracteres).');
            } else if (error.code === 'auth/too-many-requests') {
                toast.error('Demasiados intentos fallidos. Espere unos minutos.');
            } else {
                toast.error('Error al actualizar: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800 mb-2">Mi Perfil</h1>
            <p className="text-gray-500 mb-8">Administra tu cuenta y seguridad.</p>

            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 max-w-lg">
                <h2 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Lock size={20} className="text-blue-600" />
                    Cambiar Contraseña
                </h2>

                <form onSubmit={handleChangePassword} className="space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="flex items-center gap-2 bg-gray-50 p-3 rounded-lg border border-gray-200 text-gray-500 font-medium">
                            <User size={16} />
                            {user?.email}
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Contraseña Actual</label>
                        <input
                            type="password"
                            required
                            className="w-full p-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition"
                            placeholder="••••••••"
                            value={currentPass}
                            onChange={e => setCurrentPass(e.target.value)}
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                        <input
                            type="password"
                            required
                            minLength={6}
                            className="w-full p-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition"
                            placeholder="••••••••"
                            value={newPass}
                            onChange={e => setNewPass(e.target.value)}
                        />
                        <p className="text-xs text-gray-400 mt-1">Mínimo 6 caracteres.</p>
                    </div>

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full bg-blue-600 text-white font-bold py-3 rounded-xl hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50"
                    >
                        {loading ? 'Actualizando...' : 'Actualizar Contraseña'}
                    </button>
                </form>
            </div>
        </div>
    );
};
