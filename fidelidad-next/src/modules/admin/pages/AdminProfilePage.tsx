
import React, { useState, useEffect } from 'react';
import { updatePassword, reauthenticateWithCredential, EmailAuthProvider } from 'firebase/auth';
import { auth } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import { Lock, User, Users, Trash2, Eye, EyeOff } from 'lucide-react';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export const AdminProfilePage = () => {
    const { user, role } = useAdminAuth();
    const [currentPass, setCurrentPass] = useState('');
    const [newPass, setNewPass] = useState('');
    const [loading, setLoading] = useState(false);
    const [showPass, setShowPass] = useState(false);

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
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                required
                                className="w-full p-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition pr-10"
                                placeholder="••••••••"
                                value={currentPass}
                                onChange={e => setCurrentPass(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Nueva Contraseña</label>
                        <div className="relative">
                            <input
                                type={showPass ? "text" : "password"}
                                required
                                minLength={6}
                                className="w-full p-3 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 transition pr-10"
                                placeholder="••••••••"
                                value={newPass}
                                onChange={e => setNewPass(e.target.value)}
                            />
                            <button
                                type="button"
                                onClick={() => setShowPass(!showPass)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition"
                            >
                                {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                            </button>
                        </div>
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

            {/* GESTIÓN DE EQUIPO - Only Admin */}
            {role === 'admin' && (
                <div className="mt-12">
                    <h2 className="text-2xl font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <Users size={24} className="text-blue-600" />
                        Gestión de Equipo
                    </h2>
                    <TeamManagement />
                </div>
            )}
        </div>
    );
};

// Subcomponente para gestión de equipo
const TeamManagement = () => {
    const [admins, setAdmins] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [newEmail, setNewEmail] = useState('');
    const [newRole, setNewRole] = useState('editor'); // admin, editor, viewer
    const currentUserEmail = auth.currentUser?.email;

    useEffect(() => {
        loadAdmins();
    }, []);

    const loadAdmins = async () => {
        try {
            const { collection, getDocs, orderBy, query } = await import('firebase/firestore');
            const { db } = await import('../../../lib/firebase');

            const q = query(collection(db, 'admins'), orderBy('email'));
            const snap = await getDocs(q);
            setAdmins(snap.docs.map(d => ({ id: d.id, ...d.data() })));
        } catch (e) {
            console.error(e);
            toast.error('Error al cargar equipo');
        } finally {
            setLoading(false);
        }
    };

    const handleInvite = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newEmail) return;

        // No permitir duplicados en la lista visual (opcional, el backend también maneja)
        if (admins.some(a => a.email === newEmail && a.status === 'active')) {
            toast.error('Este usuario ya es administrador activo.');
            return;
        }

        const toastId = toast.loading('Enviando invitación...');

        try {
            const response = await fetch('/api/invite-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || ''
                },
                body: JSON.stringify({
                    email: newEmail,
                    role: newRole,
                    invitedBy: currentUserEmail
                })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al enviar invitación');
            }

            toast.success(`¡Invitación enviada a ${newEmail}!`, { id: toastId });
            setNewEmail('');
            loadAdmins();
        } catch (e: any) {
            console.error(e);
            toast.error('Error al invitar: ' + e.message, { id: toastId });
        }
    };

    const handleDelete = async (id: string, email: string) => {
        if (!window.confirm(`¿Seguro que deseas eliminar el acceso a ${email}?`)) return;
        if (email === currentUserEmail) {
            toast.error('No puedes eliminarte a ti mismo.');
            return;
        }

        const toastId = toast.loading('Revocando acceso...');

        try {
            const response = await fetch('/api/delete-admin', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || ''
                },
                body: JSON.stringify({ uid: id, email })
            });

            const result = await response.json();

            if (!response.ok) {
                throw new Error(result.error || 'Error al eliminar administrador');
            }

            toast.success('Acceso revocado y cuenta eliminada.', { id: toastId });
            loadAdmins();
        } catch (e: any) {
            console.error(e);
            toast.error('Error: ' + e.message, { id: toastId });
        }
    };

    if (loading) return <div className="p-4 text-gray-500">Cargando equipo...</div>;

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
            {/* Formulario de Invitación */}
            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                <form onSubmit={handleInvite} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Email del Nuevo Usuario</label>
                        <input
                            type="email"
                            required
                            placeholder="colaborador@empresa.com"
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 outline-none"
                            value={newEmail}
                            onChange={e => setNewEmail(e.target.value)}
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Rol / Permisos</label>
                        <select
                            className="w-full p-2.5 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-100 outline-none bg-white"
                            value={newRole}
                            onChange={e => setNewRole(e.target.value)}
                        >
                            <option value="admin">Administrador</option>
                            <option value="editor">Operador</option>
                            <option value="viewer">Solo Ver</option>
                        </select>
                    </div>
                    <button
                        type="submit"
                        className="w-full md:w-auto px-6 py-2.5 bg-gray-900 text-white font-bold rounded-lg hover:bg-black transition shadow-lg"
                    >
                        + Invitar
                    </button>
                </form>
            </div>

            {/* Lista */}
            <div className="overflow-x-auto">
                <table className="w-full text-left">
                    <thead className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                        <tr>
                            <th className="p-4">Usuario</th>
                            <th className="p-4">Rol</th>
                            <th className="p-4">Estado</th>
                            <th className="p-4 text-right">Acciones</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {admins.map((admin) => (
                            <tr key={admin.id} className="hover:bg-gray-50/50 transition">
                                <td className="p-4">
                                    <div className="font-medium text-gray-800">{admin.email}</div>
                                    <div className="text-xs text-gray-400">Creado: {admin.createdAt?.seconds ? new Date(admin.createdAt.seconds * 1000).toLocaleDateString() : 'N/A'}</div>
                                </td>
                                <td className="p-4">
                                    <span className={`px-2 py-1 rounded-md text-xs font-bold uppercase
                                        ${admin.role === 'admin' ? 'bg-purple-100 text-purple-700' :
                                            admin.role === 'viewer' ? 'bg-gray-100 text-gray-600' : 'bg-blue-100 text-blue-700'}`}>
                                        {admin.role}
                                    </span>
                                </td>
                                <td className="p-4">
                                    {admin.status === 'invited' ? (
                                        <span className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded-full font-bold">Pendiente Registro</span>
                                    ) : (
                                        <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full font-bold">Activo</span>
                                    )}
                                </td>
                                <td className="p-4 text-right">
                                    {admin.email !== currentUserEmail && (
                                        <button
                                            onClick={() => handleDelete(admin.id, admin.email)}
                                            className="text-red-400 hover:text-red-700 p-2 hover:bg-red-50 rounded-lg transition"
                                            title="Revocar Acceso"
                                        >
                                            <Trash2 size={18} />
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
                {admins.length === 0 && <p className="text-center p-8 text-gray-400">No hay otros administradores.</p>}
            </div>
        </div>
    );
};
