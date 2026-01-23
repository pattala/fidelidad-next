import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut, updatePassword } from 'firebase/auth';
import { LogOut, Key, ChevronRight, QrCode, FileText, X, ExternalLink } from 'lucide-react';
import QRCode from "react-qr-code";
import toast from 'react-hot-toast';
import { useNavigate, useOutletContext } from 'react-router-dom';

export const ClientProfilePage = () => {
    const [userAuth, setUserAuth] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);
    const navigate = useNavigate();
    const { config } = useOutletContext<any>();

    // Change Password State
    const [isChangePassOpen, setIsChangePassOpen] = useState(false);
    const [newPass, setNewPass] = useState('');
    const [loadingPass, setLoadingPass] = useState(false);
    const [isTermsOpen, setIsTermsOpen] = useState(false);

    useEffect(() => {
        const unsub = auth.onAuthStateChanged(u => {
            if (u) {
                setUserAuth(u);
                const unsubDb = onSnapshot(doc(db, 'users', u.uid), (doc) => {
                    setUserData(doc.data());
                });
                return () => unsubDb();
            } else {
                navigate('/login');
            }
        });
        return unsub;
    }, [navigate]);

    const handleLogout = async () => {
        await signOut(auth);
        navigate('/login');
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoadingPass(true);
        try {
            if (userAuth) {
                await updatePassword(userAuth, newPass);
                toast.success("¡Contraseña actualizada!");
                setIsChangePassOpen(false);
                setNewPass('');
            }
        } catch (error: any) {
            console.error(error);
            toast.error("Error: " + error.message);
            // Re-auth might be needed if session is old, handling basic case here
            if (error.code === 'auth/requires-recent-login') {
                toast.error("Por seguridad, vuelve a iniciar sesión para cambiar la clave.");
                handleLogout();
            }
        } finally {
            setLoadingPass(false);
        }
    };

    if (!userData) return <div className="p-10 text-center animate-pulse">Cargando perfil...</div>;

    const qrValue = userData.socioNumber || userData.dni || userAuth?.uid || 'no-id';

    return (
        <div className="min-h-screen bg-gray-50 pb-24 relative">

            {/* Header / Cover */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 h-48 relative rounded-b-[3rem] shadow-lg">
                <div className="absolute inset-0 bg-black/10"></div>
            </div>

            {/* Profile Card Overlay */}
            <div className="-mt-20 px-6 relative z-10">
                <div className="bg-white rounded-3xl shadow-xl p-6 text-center border border-gray-100">
                    <div className="w-24 h-24 bg-gray-100 rounded-full mx-auto border-4 border-white shadow-md mb-3 flex items-center justify-center text-3xl">
                        {/* Avatar */}
                        <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${userData.name}`}
                            alt="Avatar"
                            className="w-full h-full rounded-full"
                        />
                    </div>
                    <h2 className="text-xl font-black text-gray-800">{userData.name}</h2>
                    <p className="text-gray-500 font-medium text-sm">{userData.email}</p>

                    {/* Stats Row */}
                    <div className="flex justify-center gap-6 mt-6 border-t border-gray-100 pt-4">
                        <div className="text-center">
                            <span className="block text-2xl font-black text-purple-600">{userData.points}</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Puntos</span>
                        </div>
                        <div className="w-px bg-gray-100"></div>
                        <div className="text-center">
                            <span className="block text-2xl font-black text-indigo-600">
                                {userData.socioNumber ? `#${userData.socioNumber}` : '-'}
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">N° Socio</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* DIGITAL CREDENTIAL (QR) */}
            <div className="px-6 mt-6">
                <div className="bg-white rounded-3xl shadow-sm p-6 flex flex-col items-center gap-4 border border-gray-100">
                    <div className="flex items-center gap-2 text-gray-800 font-bold">
                        <QrCode className="text-indigo-500" />
                        <h3>Tu Credencial Digital</h3>
                    </div>
                    <div className="bg-white p-2 rounded-xl border-2 border-dashed border-gray-200">
                        {/* QR Code Lib Component */}
                        <div style={{ padding: "10px", background: 'white' }}>
                            <QRCode
                                value={qrValue}
                                size={180}
                                style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                viewBox={`0 0 256 256`}
                            />
                        </div>
                    </div>
                    <p className="text-xs text-gray-400 text-center max-w-[200px]">
                        Muestra este código en caja para sumar puntos o canjear premios.
                    </p>
                </div>
            </div>

            {/* SETTINGS GROUP */}
            <div className="px-6 mt-6 space-y-3">

                {/* Notification Toggle (New) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden mb-4">
                    <button
                        onClick={async () => {
                            const permission = await Notification.requestPermission();
                            if (permission === 'granted') {
                                toast.success('Notificaciones activadas');
                                // Force re-render or logic could handle state
                            } else {
                                toast.error('Permiso denegado. Actívalo en config.');
                            }
                        }}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-50 p-2 rounded-full text-purple-600">
                                <span className="text-xl">🔔</span>
                            </div>
                            <div className="text-left">
                                <span className="font-bold text-gray-700 text-sm block">Notificaciones</span>
                                <span className="text-xs text-gray-400 font-medium">
                                    {Notification.permission === 'granted' ? 'Activadas' : 'Toca para activar'}
                                </span>
                            </div>
                        </div>
                        <div className={`w-10 h-6 rounded-full p-1 transition-colors ${Notification.permission === 'granted' ? 'bg-green-500' : 'bg-gray-300'}`}>
                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${Notification.permission === 'granted' ? 'translate-x-4' : ''}`}></div>
                        </div>
                    </button>
                </div>

                <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider ml-2">Cuenta</h3>

                {/* Change Password Toggle */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                    <button
                        onClick={() => setIsChangePassOpen(!isChangePassOpen)}
                        className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-orange-50 p-2 rounded-full text-orange-500">
                                <Key size={20} />
                            </div>
                            <span className="font-bold text-gray-700 text-sm">Cambiar Contraseña</span>
                        </div>
                        <ChevronRight size={18} className={`text-gray-300 transition-transform ${isChangePassOpen ? 'rotate-90' : ''}`} />
                    </button>

                    {/* Collapsible Form */}
                    {isChangePassOpen && (
                        <div className="p-4 bg-gray-50/50 border-t border-gray-100 animate-fade-in">
                            <form onSubmit={handleChangePassword} className="flex flex-col gap-3">
                                <input
                                    type="password"
                                    placeholder="Nueva contraseña (mín 6 caracteres)"
                                    className="w-full p-3 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                    required
                                    minLength={6}
                                    value={newPass}
                                    onChange={e => setNewPass(e.target.value)}
                                />
                                <button
                                    type="submit"
                                    disabled={loadingPass}
                                    className="bg-orange-500 text-white py-2.5 rounded-xl font-bold text-sm shadow-md hover:bg-orange-600 active:scale-95 transition"
                                >
                                    {loadingPass ? 'Actualizando...' : 'Confirmar Cambio'}
                                </button>
                            </form>
                        </div>
                    )}
                </div>

                {/* Terms and Conditions */}
                {config?.contact?.termsAndConditions && (
                    <button
                        onClick={() => setIsTermsOpen(true)}
                        className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:bg-blue-50 group transition"
                    >
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-50 p-2 rounded-full text-blue-500 group-hover:bg-blue-100 transition">
                                <FileText size={20} />
                            </div>
                            <span className="font-bold text-gray-700 text-sm group-hover:text-blue-600 transition">Términos y Condiciones</span>
                        </div>
                        <ChevronRight size={18} className="text-gray-300" />
                    </button>
                )}

                {/* Logout Button */}
                <button
                    onClick={handleLogout}
                    className="w-full flex items-center justify-between p-4 bg-white rounded-2xl shadow-sm border border-gray-100 hover:bg-red-50 group transition"
                >
                    <div className="flex items-center gap-3">
                        <div className="bg-red-50 p-2 rounded-full text-red-500 group-hover:bg-red-100 transition">
                            <LogOut size={20} />
                        </div>
                        <span className="font-bold text-gray-700 text-sm group-hover:text-red-600 transition">Cerrar Sesión</span>
                    </div>
                </button>
            </div>

            <div className="h-4"></div>

            {/* Terms Modal */}
            {isTermsOpen && (
                <div className="fixed inset-0 z-50 flex flex-col bg-white animate-fade-in">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100 shadow-sm flex-none z-10">
                        <h2 className="text-lg font-black text-gray-800">Términos y Condiciones</h2>
                        <div className="flex items-center gap-2">
                            <a
                                href={config.contact.termsAndConditions}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-blue-500 hover:bg-blue-50 rounded-full transition"
                                title="Abrir en navegador"
                            >
                                <ExternalLink size={20} />
                            </a>
                            <button
                                onClick={() => setIsTermsOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                    {/* Content */}
                    <div className="flex-1 bg-gray-50 relative overflow-hidden">
                        <iframe
                            src={config.contact.termsAndConditions}
                            className="w-full h-full border-0"
                            title="Términos y Condiciones"
                            sandbox="allow-scripts allow-same-origin allow-popups"
                        />
                        <div className="absolute inset-0 -z-10 flex items-center justify-center text-gray-400 text-sm font-medium">
                            Cargando documento...
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
