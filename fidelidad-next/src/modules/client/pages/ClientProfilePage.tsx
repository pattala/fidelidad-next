import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut, updatePassword } from 'firebase/auth';
import { LogOut, Key, ChevronRight, QrCode, FileText, X, ExternalLink, Eye, EyeOff, MapPin, Phone, User as UserIcon, Building } from 'lucide-react';
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
    const [showPass, setShowPass] = useState(false);
    const [loadingPass, setLoadingPass] = useState(false);
    const [isTermsOpen, setIsTermsOpen] = useState(false);

    // Edit Profile State
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editData, setEditData] = useState<any>({});
    const [loadingEdit, setLoadingEdit] = useState(false);

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

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userAuth || !userData) return;
        setLoadingEdit(true);
        try {
            const { updateDoc } = await import('firebase/firestore');
            const userRef = doc(db, 'users', userAuth.uid);

            const fullCalle = `${editData.street || ''} ${editData.number || ''}`.trim();
            const updates = {
                name: editData.name,
                nombre: editData.name,
                phone: editData.phone,
                calle: fullCalle,
                piso: editData.piso || '',
                depto: editData.depto || '',
                localidad: editData.localidad || '',
                partido: editData.partido || '',
                provincia: editData.provincia || '',
                cp: editData.cp || '',
                'domicilio.components.calle': fullCalle,
                'domicilio.components.numero': editData.number || '',
                'domicilio.components.piso': editData.piso || '',
                'domicilio.components.depto': editData.depto || '',
                'domicilio.components.localidad': editData.localidad || '',
                'domicilio.components.partido': editData.partido || '',
                'domicilio.components.provincia': editData.provincia || '',
                'domicilio.components.zipCode': editData.cp || '',
            };

            await updateDoc(userRef, updates);
            toast.success("Perfil actualizado");
            setIsEditModalOpen(false);
        } catch (error: any) {
            console.error(error);
            toast.error("Error al actualizar");
        } finally {
            setLoadingEdit(false);
        }
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
            if (error.code === 'auth/requires-recent-login') {
                toast.error("Por seguridad, vuelve a iniciar sesión para cambiar la clave.");
                handleLogout();
            }
        } finally {
            setLoadingPass(false);
        }
    };

    const handleTogglePermission = async (type: 'notifications' | 'geolocation') => {
        if (!userAuth || !userData) return;

        const currentStatus = userData.permissions?.[type]?.status;
        const newStatus = currentStatus === 'granted' ? 'denied' : 'granted';

        // If trying to grant, we should probably ask browser again
        if (newStatus === 'granted') {
            if (type === 'notifications') {
                const p = await Notification.requestPermission();
                if (p !== 'granted') {
                    toast.error("Permiso bloqueado en el navegador");
                    return;
                }
            } else {
                // simple check for geo
                const p = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(() => resolve('granted'), () => resolve('denied'));
                });
                if (p !== 'granted') {
                    toast.error("Permiso de ubicación denegado");
                    return;
                }
            }
        }

        try {
            const { updateDoc } = await import('firebase/firestore');
            await updateDoc(doc(db, 'users', userAuth.uid), {
                [`permissions.${type}.status`]: newStatus
            });
            toast.success(`${type === 'notifications' ? 'Notificaciones' : 'Ubicación'} ${newStatus === 'granted' ? 'activadas' : 'desactivadas'}`);
        } catch (e) {
            console.error(e);
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
                            <span className="block text-2xl font-black text-purple-600">{userData.points || 0}</span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Puntos</span>
                        </div>
                        <div className="w-px bg-gray-100"></div>
                        <div className="text-center">
                            <span className="block text-2xl font-black text-indigo-600">
                                {userData.socioNumber || userData.numeroSocio ? `#${userData.socioNumber || userData.numeroSocio}` : '-'}
                            </span>
                            <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">N° Socio</span>
                        </div>
                    </div>

                    <button
                        onClick={() => {
                            setEditData({
                                name: userData.name || '',
                                email: userData.email || '',
                                dni: userData.dni || '',
                                phone: userData.phone || '',
                                street: userData.domicilio?.components?.calle?.split(' ').slice(0, -1).join(' ') || userData.calle?.split(' ').slice(0, -1).join(' ') || '',
                                number: userData.domicilio?.components?.numero || userData.calle?.split(' ').slice(-1)[0] || '',
                                piso: userData.piso || '',
                                depto: userData.depto || '',
                                localidad: userData.localidad || '',
                                partido: userData.partido || '',
                                provincia: userData.provincia || '',
                                cp: userData.cp || ''
                            });
                            setIsEditModalOpen(true);
                        }}
                        className="mt-4 text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition"
                    >
                        Editar Datos Personales
                    </button>
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

                {/* Permissions Toggles */}
                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 space-y-4">
                    <h3 className="text-gray-400 font-bold text-xs uppercase tracking-wider ml-2">Permisos y Privacidad</h3>

                    <div className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-purple-100 p-2 rounded-2xl text-purple-600">
                                <span className="text-xl">🔔</span>
                            </div>
                            <div>
                                <span className="font-bold text-gray-700 text-sm block">Notificaciones</span>
                                <span className="text-[10px] text-gray-400 font-medium">Alertas de puntos y premios</span>
                            </div>
                        </div>
                        <button
                            onClick={() => handleTogglePermission('notifications')}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${userData.permissions?.notifications?.status === 'granted' ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${userData.permissions?.notifications?.status === 'granted' ? 'translate-x-6' : ''}`}></div>
                        </button>
                    </div>

                    <div className="flex items-center justify-between p-2">
                        <div className="flex items-center gap-3">
                            <div className="bg-blue-100 p-2 rounded-2xl text-blue-600">
                                <MapPin size={20} />
                            </div>
                            <div>
                                <span className="font-bold text-gray-700 text-sm block">Geolocalización</span>
                                <span className="text-[10px] text-gray-400 font-medium">Búsqueda de sucursales cercanas</span>
                            </div>
                        </div>
                        <button
                            onClick={() => handleTogglePermission('geolocation')}
                            className={`w-12 h-6 rounded-full p-1 transition-colors ${userData.permissions?.geolocation?.status === 'granted' ? 'bg-green-500' : 'bg-gray-300'}`}
                        >
                            <div className={`w-4 h-4 bg-white rounded-full shadow transition-transform ${userData.permissions?.geolocation?.status === 'granted' ? 'translate-x-6' : ''}`}></div>
                        </button>
                    </div>
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
                                <div className="relative">
                                    <input
                                        type={showPass ? "text" : "password"}
                                        placeholder="Nueva contraseña (mín 6 caracteres)"
                                        className="w-full p-3 pr-12 rounded-xl border border-gray-200 text-sm outline-none focus:border-orange-300 focus:ring-2 focus:ring-orange-100"
                                        required
                                        minLength={6}
                                        value={newPass}
                                        onChange={e => setNewPass(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPass(!showPass)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-orange-600 transition"
                                    >
                                        {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                    </button>
                                </div>
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
            {
                isTermsOpen && (
                    <div className="fixed inset-0 z-50 flex flex-col bg-white animate-fade-in">
                        {/* Header */}
                        <div className="flex items-center justify-between px-4 py-4 bg-white border-b border-gray-100 shadow-sm flex-none z-10">
                            <h2 className="text-lg font-black text-gray-800">Términos y Condiciones</h2>
                            <button
                                onClick={() => setIsTermsOpen(false)}
                                className="p-2 text-gray-400 hover:text-gray-800 hover:bg-gray-100 rounded-full transition"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        {/* Content (Internal restored text) */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 text-sm text-gray-600 scrollbar-hide">
                            <div>
                                <h4 className="font-bold text-gray-800 mb-2">1. Generalidades</h4>
                                <p>El programa de fidelización "{config?.siteName || 'Club'}" es un beneficio exclusivo para nuestros clientes. La participación en el programa es gratuita e implica la aceptación total de los presentes términos y condiciones.</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 mb-2">2. Privacidad y Datos</h4>
                                <p>Tus datos (Nombre, DNI, Teléfono y Dirección) se utilizan exclusivamente para identificarte como socio, validar tus canjes en el local y enviarte avisos importantes sobre tus puntos. No vendemos ni compartimos tu información con terceros.</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 mb-2">3. Consentimiento de Comunicaciones</h4>
                                <p>Al registrarte y/o aceptar los términos en la aplicación, otorgas tu consentimiento explícito para recibir comunicaciones transaccionales y promocionales. Estas comunicaciones incluyen, entre otros, avisos sobre puntos ganados, premios canjeados y vencimiento de puntos.</p>
                            </div>
                            <div>
                                <h4 className="font-bold text-gray-800 mb-2">4. Acumulación de Puntos</h4>
                                <p>Los puntos se acumularán según la tasa de conversión vigente establecida por el comercio. Los puntos no tienen valor monetario ni son canjeables por efectivo.</p>
                            </div>
                            <p className="text-xs text-center opacity-50 pt-8 pb-12">Última actualización: 8 de Agosto de 2025</p>
                        </div>
                    </div>
                )
            }

            {/* Edit Profile Modal */}
            {
                isEditModalOpen && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white w-full max-w-sm rounded-[2rem] shadow-2xl overflow-hidden flex flex-col">
                            <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-indigo-50/50">
                                <h3 className="font-black text-indigo-900 uppercase tracking-tight">Editar Mi Perfil</h3>
                                <button onClick={() => setIsEditModalOpen(false)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
                            </div>
                            <form onSubmit={handleUpdateProfile} className="p-6 space-y-4 overflow-y-auto max-h-[70vh] scrollbar-hide">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Email (No editable)</label>
                                        <input
                                            type="email"
                                            className="w-full bg-gray-100 px-4 py-2.5 rounded-xl text-gray-400 text-sm font-bold cursor-not-allowed"
                                            value={editData.email}
                                            disabled
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">DNI (No editable)</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-100 px-4 py-2.5 rounded-xl text-gray-400 text-sm font-bold cursor-not-allowed"
                                            value={editData.dni}
                                            disabled
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Nombre Completo</label>
                                    <div className="relative">
                                        <UserIcon className="absolute left-3 top-3 text-indigo-400" size={16} />
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 pl-10 pr-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold"
                                            value={editData.name}
                                            onChange={e => setEditData({ ...editData, name: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Teléfono</label>
                                    <div className="relative">
                                        <Phone className="absolute left-3 top-3 text-indigo-400" size={16} />
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 pl-10 pr-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold"
                                            value={editData.phone}
                                            onChange={e => setEditData({ ...editData, phone: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
                                    <div className="col-span-2">
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Calle</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold"
                                            value={editData.street}
                                            onChange={e => setEditData({ ...editData, street: e.target.value })}
                                            required
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">N°</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold text-center"
                                            value={editData.number}
                                            onChange={e => setEditData({ ...editData, number: e.target.value })}
                                            required
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Piso</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold text-center"
                                            value={editData.piso}
                                            onChange={e => setEditData({ ...editData, piso: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Depto</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold text-center"
                                            value={editData.depto}
                                            onChange={e => setEditData({ ...editData, depto: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-2">
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Provincia</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold"
                                            value={editData.provincia}
                                            onChange={e => setEditData({ ...editData, provincia: e.target.value })}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Localidad</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold"
                                            value={editData.localidad}
                                            onChange={e => setEditData({ ...editData, localidad: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <button
                                    type="submit"
                                    disabled={loadingEdit}
                                    className="w-full bg-indigo-600 text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition mt-4"
                                >
                                    {loadingEdit ? 'Guardando...' : 'Guardar Cambios'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
