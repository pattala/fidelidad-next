import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../lib/firebase';
import { doc, onSnapshot } from 'firebase/firestore';
import { signOut, updatePassword } from 'firebase/auth';
import { LogOut, Key, ChevronRight, QrCode, FileText, X, ExternalLink, Eye, EyeOff, MapPin, Phone, User as UserIcon, Building, Plus, Trash2, Camera, Bell as BellIcon, PenLine } from 'lucide-react';
import QRCode from "react-qr-code";
import { PET_BRANDS, PET_BREEDS, DOG_BREEDS, CAT_BREEDS } from '../../../data/petshop_constants';
import { updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { Pet } from '../../../types';
import toast from 'react-hot-toast';
import { useNavigate, useOutletContext, useSearchParams } from 'react-router-dom';
import { useFcmToken } from '../../../hooks/useFcmToken';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { ARGENTINA_LOCATIONS } from '../../../data/locations';
import { TimeService } from '../../../services/timeService';
import { APP_VERSION } from '../../../lib/adminConfig';

// Assuming AppConfig is defined elsewhere or is a type alias for the config object
// For the purpose of this edit, we'll assume it's a valid type.
type AppConfig = any; // Placeholder if not defined, adjust as per actual project structure

export const ClientProfilePage = () => {
    // Generate simple ID for pets to avoid dependency on global crypto.randomUUID
    // Helper for dynamic pet age
    const getPetAge = (pet: any) => {
        if (!pet.birthDate) return pet.age ? `${pet.age} años` : '';
        try {
            const birth = pet.birthDate.toDate ? pet.birthDate.toDate() : new Date(pet.birthDate);
            const now = TimeService.now();
            let age = now.getFullYear() - birth.getFullYear();
            const m = now.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
                age--;
            }
            if (age < 1) {
                const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                return months > 0 ? `${months} m` : 'Recién nacido';
            }
            return `${age} años`;
        } catch (e) {
            return pet.age ? `${pet.age} años` : '';
        }
    };

    const generateSafeId = () => {
        return Math.random().toString(36).substring(2, 11) + Date.now().toString(36);
    };

    const { user: userAuth, userData, loading: authLoading } = useClientAuth();
    const navigate = useNavigate();
    const { config, setHeaderTitle } = useOutletContext<{
        config: AppConfig,
        setHeaderTitle: (title: string | null) => void
    }>();
    const [searchParams] = useSearchParams();

    // Auto-open Pet Modal if coming from registration
    useEffect(() => {
        if (searchParams.get('addPet') === 'true' && userData && config) {
            setEditingPet(null);
            setPetFormData({ name: '', type: 'perro', breed: 'Mestizo / Sin Raza', age: '', brand: 'Royal Canin', variant: '', frequencyDays: 30, litterFrequencyDays: 15, receiveAlerts: true, enableFoodAlerts: true, enableLitterAlerts: true });
            setPetPhotoBase64(null);
            setIsPetModalOpen(true);
            
            // Clear param to avoid re-opening on manual refreshes
            navigate('/perfil', { replace: true });
        }
    }, [searchParams, userData, config, navigate]);

    // Set Header State
    useEffect(() => {
        setHeaderTitle('Perfil');

        return () => {
            setHeaderTitle(null);
        };
    }, [setHeaderTitle]);

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
    const [isPetModalOpen, setIsPetModalOpen] = useState(false);
    const [editingPet, setEditingPet] = useState<Pet | null>(null);
    const [petFormData, setPetFormData] = useState<Partial<Pet>>({
        name: '', type: 'perro', breed: 'Mestizo / Sin Raza', age: '', brand: 'Royal Canin', variant: '', frequencyDays: 30, receiveAlerts: true, enableFoodAlerts: true, enableLitterAlerts: true
    });
    const [petPhotoBase64, setPetPhotoBase64] = useState<string | null>(null);
    const [userPhotoBase64, setUserPhotoBase64] = useState<string | null>(null);
    const [loadingPet, setLoadingPet] = useState(false);
    const [loadingPhoto, setLoadingPhoto] = useState(false);
    const [isCustomBreed, setIsCustomBreed] = useState(false);
    const [isCustomBrand, setIsCustomBrand] = useState(false);

    // Address Cascade State
    const [selectedProv, setSelectedProv] = useState('');
    const [selectedPart, setSelectedPart] = useState('');
    const [selectedLoc, setSelectedLoc] = useState('');

    // No longer need manual auth/db effect, ClientAuthContext handles it

    const handleLogout = async () => {
        localStorage.removeItem('client_master_bypass_uid');
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

            const wasAddressComplete = userData.domicilio?.status === 'complete';
            const isAddressNowComplete = !!(editData.provincia && editData.localidad && editData.street && editData.number);
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
                birthDate: editData.birthDate || '',
                'domicilio.components.calle': fullCalle,
                'domicilio.components.numero': editData.number || '',
                'domicilio.components.piso': editData.piso || '',
                'domicilio.components.depto': editData.depto || '',
                'domicilio.components.localidad': editData.localidad || '',
                'domicilio.components.partido': editData.partido || '',
                'domicilio.components.provincia': editData.provincia || '',
                'domicilio.components.zipCode': editData.cp || '',
                'domicilio.status': isAddressNowComplete ? 'complete' : (userData.domicilio?.status || 'pending')
            };

            await updateDoc(userRef, updates);
            toast.success("Perfil actualizado");

            // --- NUEVO: Otorgar puntos si el domicilio se completó ahora ---
            if (!wasAddressComplete && isAddressNowComplete && config.enableAddressBonus) {
                const token = await userAuth.getIdToken();
                const apiKey = config.apiKey || ''; // Intentar obtener del config o usar el secreto si es admin
                
                fetch('/api/assign-points', {
                    method: 'POST',
                    headers: { 
                        'Content-Type': 'application/json', 
                        'Authorization': `Bearer ${token}`
                    },
                    body: JSON.stringify({ 
                        uid: userAuth.uid,
                        reason: 'profile_address',
                        metadata: { source: 'pwa_profile_update' }
                    })
                }).then(res => res.json()).then(data => {
                    if (data.ok) {
                        toast.success(`¡Ganaste ${config.pointsForAddress || 50} puntos por completar tu dirección! 🏠`, { duration: 5000 });
                    }
                }).catch(err => console.error("Error asignando bono domicilio:", err));
            }

            setIsEditModalOpen(false);
        } catch (error: any) {
            console.error(error);
            toast.error("Error al actualizar");
        } finally {
            setLoadingEdit(false);
        }
    };

    const handlePetPhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            if (file.size > 2 * 1024 * 1024) {
                toast.error("La foto es muy pesada (máx 2MB)");
                return;
            }
            const reader = new FileReader();
            reader.onloadend = () => setPetPhotoBase64(reader.result as string);
            reader.readAsDataURL(file);
        }
    };

    const handleUserPhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !userAuth) return;

        setLoadingPhoto(true);
        try {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const base64 = reader.result as string;
                const userRef = doc(db, 'users', userAuth.uid);
                await updateDoc(userRef, { photoUrl: base64 });
                toast.success("Foto de perfil actualizada");
                setUserPhotoBase64(null); // Reset local temp
            };
            reader.readAsDataURL(file);
        } catch (error) {
            toast.error("Error al subir foto");
        } finally {
            setLoadingPhoto(false);
        }
    };

    const handleSavePet = async (e: React.FormEvent, addAnother: boolean = false) => {
        if (e && e.preventDefault) e.preventDefault();
        if (!userAuth || !userData) return;
        setLoadingPet(true);

        try {
            // Logic to calculate birthDate from age (auto-aging)
            let calculatedBirthDate = editingPet?.birthDate || null;
            if (petFormData.age && (!editingPet || petFormData.age !== editingPet.age)) {
                const ageNum = parseInt(petFormData.age.toString());
                if (!isNaN(ageNum)) {
                    const now = TimeService.now();
                    // Store the approximate date of birth
                    calculatedBirthDate = new Date(now.getFullYear() - ageNum, now.getMonth(), now.getDate());
                }
            }

            const petPayload: Pet = {
                id: editingPet?.id || generateSafeId(),
                name: petFormData.name || '',
                type: (petFormData.type as any) || 'perro',
                breed: petFormData.breed || 'Mestizo / Sin Raza',
                age: petFormData.age || '',
                birthDate: calculatedBirthDate || null,
                brand: petFormData.brand || '',
                variant: petFormData.variant || '',
                frequencyDays: Math.max(1, Number(petFormData.frequencyDays) || 30),
                enableFoodAlerts: petFormData.enableFoodAlerts ?? true,
                receiveAlerts: !!petFormData.receiveAlerts,
                photoUrl: petPhotoBase64 || editingPet?.photoUrl || '',
                createdAt: editingPet?.createdAt || TimeService.now(),
                lastPurchaseDate: editingPet?.lastPurchaseDate || null
            };

            if (petFormData.type === 'gato') {
                petPayload.litterFrequencyDays = Math.max(1, Number(petFormData.litterFrequencyDays) || 15);
                petPayload.enableLitterAlerts = petFormData.enableLitterAlerts ?? true;
                petPayload.lastLitterPurchaseDate = editingPet?.lastLitterPurchaseDate || null;
            }

            const userRef = doc(db, 'users', userAuth.uid);
            
            if (editingPet) {
                const updatedPets = (userData.pets || []).map((p: Pet) => p.id === editingPet.id ? petPayload : p);
                await updateDoc(userRef, { pets: updatedPets });
                toast.success("Mascota actualizada");
                setIsPetModalOpen(false);
            } else {
                await updateDoc(userRef, { pets: arrayUnion(petPayload) });
                toast.success("¡Mascota registrada! 🐾");
                
                if (!addAnother) {
                    setIsPetModalOpen(false);
                    navigate('/');
                }
            }

            setEditingPet(null);
            setPetFormData({ name: '', type: 'perro', breed: 'Mestizo / Sin Raza', age: '', brand: 'Royal Canin', variant: '', frequencyDays: 30, receiveAlerts: true, enableFoodAlerts: true, enableLitterAlerts: true });
            setPetPhotoBase64(null);
            setIsCustomBreed(false);
            setIsCustomBrand(false);
        } catch (error) {
            console.error("Error saving pet:", error);
            toast.error("Error al guardar mascota");
        } finally {
            setLoadingPet(false);
        }
    };

    const handleDeletePet = async (pet: Pet) => {
        if (!userAuth || !userData) return;
        if (!window.confirm(`¿Seguro que quieres eliminar a ${pet.name}?`)) return;

        try {
            const userRef = doc(db, 'users', userAuth.uid);
            await updateDoc(userRef, { pets: arrayRemove(pet) });
            toast.success("Mascota eliminada");
        } catch (error) {
            toast.error("Error al eliminar");
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

    const { retrieveToken } = useFcmToken();

    const handleTogglePermission = async (type: 'notifications' | 'geolocation') => {
        if (!userAuth || !userData) return;

        const isMobileDevice = () => {
            if (typeof window === 'undefined') return false;
            const ua = navigator.userAgent;
            return /iPhone|iPad|iPod|Android/i.test(ua) || (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
        };
        const deviceKey = isMobileDevice() ? 'mobile' : 'pc';
        const prefix = `${deviceKey}_`;

        const currentStatus = userData.permissions?.[type]?.status;
        const newStatus = currentStatus === 'granted' ? 'denied' : 'granted';

        // If trying to grant, we should probably ask browser again
        if (newStatus === 'granted') {
            if (type === 'notifications') {
                if (typeof Notification === 'undefined') {
                    toast.error("Notificaciones no soportadas");
                    return;
                }
                const p = await Notification.requestPermission();
                if (p !== 'granted') {
                    toast.error("Permiso bloqueado en el navegador");
                    return;
                }
                // Register token immediately
                await retrieveToken();
            } else {
                // simple check for geo
                const p = await new Promise((resolve) => {
                    navigator.geolocation.getCurrentPosition(() => resolve('granted'), () => resolve('denied'));
                });
                if (p !== 'granted') {
                    toast.error("No pudimos activar los beneficios locales");
                    return;
                }
            }
        }

        try {
            await updateDoc(doc(db, 'users', userAuth.uid), {
                [`permissions.${type}.status`]: newStatus,
                [`permissions.${type}.${prefix}status`]: newStatus,
                [`permissions.${type}.updatedAt`]: TimeService.now().getTime()
            });
            const label = type === 'notifications' ? 'Notificaciones' : 'Ofertas locales';
            toast.success(`${label} ${newStatus === 'granted' ? 'activadas' : 'desactivadas'}`);
        } catch (e) {
            console.error(e);
        }
    };

    if (!userData || !config) return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-10 animate-fade-in">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-gray-500 font-medium animate-pulse">Cargando perfil...</p>
        </div>
    );

    const qrValue = String(userData.socioNumber || userData.dni || userAuth?.uid || 'no-id');

    return (
        <div className="bg-white pb-24 relative">

            {/* Header / Cover */}
            <div className="bg-gradient-to-br from-indigo-600 to-purple-700 h-42 relative rounded-b-[3rem] shadow-lg">
                <div className="absolute inset-0 bg-black/10"></div>
            </div>

            {/* Profile Card Overlay */}
            <div
                className="-mt-26 px-4 relative z-10 animate-fade-in"
            >
                <div className="bg-white rounded-3xl shadow-xl p-6 text-center border border-gray-100">
                    <div className="relative w-24 h-24 mx-auto mb-3">
                        <div className="w-24 h-24 bg-indigo-50 rounded-full border-4 border-white shadow-md flex items-center justify-center text-indigo-400 overflow-hidden">
                            {userData.photoUrl ? (
                                <img src={userData.photoUrl} alt="Perfil" className="w-full h-full object-cover" />
                            ) : (
                                <UserIcon size={48} strokeWidth={2} />
                            )}
                        </div>
                        <label className="absolute bottom-0 right-0 bg-white p-2 rounded-full shadow-lg border border-gray-100 cursor-pointer hover:bg-gray-50 transition transform hover:scale-110 active:scale-90">
                            <Camera size={14} className="text-indigo-600" />
                            <input type="file" className="hidden" accept="image/*" onChange={handleUserPhotoChange} />
                        </label>
                        {loadingPhoto && (
                            <div className="absolute inset-0 bg-white/60 rounded-full flex items-center justify-center">
                                <div className="w-6 h-6 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin"></div>
                            </div>
                        )}
                    </div>
                    <h2 className="text-xl font-black text-gray-800">{userData.name || userData.nombre || 'Usuario'}</h2>
                    <p className="text-gray-500 font-medium text-sm">{userData.email}</p>
                    {userData.birthDate && (
                        <p className="text-[10px] font-bold text-indigo-500 mt-1 uppercase tracking-wider flex items-center gap-1 justify-center">
                            <span>🎂</span> Cumpleaños: {new Date(userData.birthDate + 'T12:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: 'long' })}
                        </p>
                    )}

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

                    <div className="flex flex-col gap-2 mt-4 items-center">
                        <button
                            onClick={() => {
                                setEditData({
                                    name: userData.name || userData.nombre || '',
                                    email: userData.email || '',
                                    dni: userData.dni || '',
                                    phone: userData.phone || userData.telefono || userData.phone_number || '',
                                    street: userData.domicilio?.components?.calle?.split(' ').slice(0, -1).join(' ') || userData.calle?.split(' ').slice(0, -1).join(' ') || userData.domicilio?.calle || '',
                                    number: userData.domicilio?.components?.numero || userData.calle?.split(' ').slice(-1)[0] || userData.domicilio?.numero || '',
                                    piso: userData.piso || userData.domicilio?.components?.piso || '',
                                    depto: userData.depto || userData.domicilio?.components?.depto || '',
                                    localidad: userData.localidad || userData.domicilio?.components?.localidad || '',
                                    partido: userData.partido || userData.domicilio?.components?.partido || '',
                                    provincia: userData.provincia || userData.domicilio?.components?.provincia || '',
                                    cp: userData.cp || userData.domicilio?.components?.zipCode || '',
                                    birthDate: userData.birthDate || ''
                                });
                                setSelectedProv(userData.provincia || userData.domicilio?.components?.provincia || '');
                                setSelectedPart(userData.partido || userData.domicilio?.components?.partido || '');
                                setSelectedLoc(userData.localidad || userData.domicilio?.components?.localidad || '');
                                setIsEditModalOpen(true);
                            }}
                            className="text-xs font-bold text-indigo-600 bg-indigo-50 px-4 py-2 rounded-full hover:bg-indigo-100 transition w-fit"
                        >
                            Editar Datos Personales
                        </button>

                        <button
                            onClick={() => navigate('/referrals')}
                            className="text-xs font-black text-white bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-2.5 rounded-full hover:shadow-lg active:scale-95 transition-all flex items-center gap-2"
                        >
                            <span className="animate-pulse">🎁</span> Invitar Amigos y Ganar Puntos
                        </button>

                        {/* BANNER DE INCENTIVO: BONO DOMICILIO (Se oculta si ya está completo o si el bono está desactivado) */}
                        {config.enableAddressBonus && userData.domicilio?.status !== 'complete' && (
                            <button
                                onClick={() => {
                                    setEditData({
                                        name: userData.name || userData.nombre || '',
                                        email: userData.email || '',
                                        dni: userData.dni || '',
                                        phone: userData.phone || userData.telefono || userData.phone_number || '',
                                        street: userData.domicilio?.components?.calle?.split(' ').slice(0, -1).join(' ') || userData.calle?.split(' ').slice(0, -1).join(' ') || userData.domicilio?.calle || '',
                                        number: userData.domicilio?.components?.numero || userData.calle?.split(' ').slice(-1)[0] || userData.domicilio?.numero || '',
                                        piso: userData.piso || userData.domicilio?.components?.piso || '',
                                        depto: userData.depto || userData.domicilio?.components?.depto || '',
                                        localidad: userData.localidad || userData.domicilio?.components?.localidad || '',
                                        partido: userData.partido || userData.domicilio?.components?.partido || '',
                                        provincia: userData.provincia || userData.domicilio?.components?.provincia || '',
                                        cp: userData.cp || userData.domicilio?.components?.zipCode || '',
                                        birthDate: userData.birthDate || ''
                                    });
                                    setSelectedProv(userData.provincia || userData.domicilio?.components?.provincia || '');
                                    setSelectedPart(userData.partido || userData.domicilio?.components?.partido || '');
                                    setSelectedLoc(userData.localidad || userData.domicilio?.components?.localidad || '');
                                    setIsEditModalOpen(true);
                                }}
                                className="mt-2 w-full bg-indigo-50 border-2 border-dashed border-indigo-200 rounded-2xl p-4 flex items-center gap-4 group hover:border-indigo-400 transition-all animate-pulse"
                            >
                                <div className="bg-white p-2 rounded-xl shadow-sm text-2xl group-hover:scale-110 transition-transform">🏠</div>
                                <div className="text-left">
                                    <p className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">¡Oportunidad!</p>
                                    <p className="text-sm font-bold text-indigo-900 leading-tight">
                                        Cargá tu domicilio y ganá <span className="text-purple-600">{config.pointsForAddress || 50} puntos</span> extra.
                                    </p>
                                </div>
                                <ChevronRight size={16} className="text-indigo-300 ml-auto" />
                            </button>
                        )}
                    </div>
                </div>
            </div>


                {/* MODULO PETSHOP: Mis Mascotas */}
                {config?.enablePetModule && (
                    <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden mt-6 mx-4">
                        <div className="p-5 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-orange-50/30 to-transparent">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg text-orange-600 flex items-center justify-center">
                                    <span className="text-xl">🐾</span>
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800">Mis Mascotas</h3>
                                    <p className="text-[10px] text-gray-500 font-medium uppercase tracking-wider">Gestión de Perfiles</p>
                                </div>
                            </div>
                            <button
                                onClick={() => {
                                    setPetFormData({ name: '', type: 'perro', breed: 'Mestizo / Sin Raza', age: '', brand: 'Royal Canin', variant: '', frequencyDays: 30, litterFrequencyDays: 15, receiveAlerts: true, enableFoodAlerts: true, enableLitterAlerts: true });
                                    setPetPhotoBase64(null);
                                    setIsCustomBreed(false);
                                    setIsCustomBrand(false);
                                    setIsPetModalOpen(true);
                                }}
                                className="p-2 bg-orange-600 text-white rounded-full hover:bg-orange-700 transition-colors shadow-sm"
                            >
                                <Plus size={18} />
                            </button>
                        </div>

                        <div className="p-4">
                            {userData.pets && userData.pets.length > 0 ? (
                                <div className="grid grid-cols-1 gap-4">
                                    {userData.pets.map((pet: Pet) => (
                                        <div key={pet.id} className="flex items-center gap-4 bg-gray-50/50 p-3 rounded-xl border border-gray-100 relative group">
                                            <div className="w-16 h-16 rounded-full overflow-hidden bg-white border-2 border-white shadow-sm flex-shrink-0 flex items-center justify-center text-gray-400 relative">
                                                {pet.photoUrl ? (
                                                    <img src={pet.photoUrl} alt={pet.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-400">
                                                        {(pet.type || '').toLowerCase().trim() === 'gato' ? <span className="text-2xl">🐱</span> : (pet.type || '').toLowerCase().trim() === 'perro' ? <span className="text-2xl">🐶</span> : <span className="text-2xl">🐾</span>}
                                                    </div>
                                                )}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-bold text-gray-800 truncate">{pet.name}</h4>
                                                    {pet.receiveAlerts && (
                                                        <BellIcon size={12} className="text-orange-500" />
                                                    )}
                                                </div>
                                                <p className="text-xs text-gray-500 truncate">{pet.breed} • {getPetAge(pet)}</p>
                                                <div className="mt-1 flex flex-wrap items-center gap-2">
                                                    <span className="px-2 py-0.5 bg-white border border-gray-200 rounded text-[9px] font-bold text-gray-600">
                                                        {pet.brand || pet.foodBrand}
                                                    </span>
                                                    {pet.lastPurchaseDate && pet.enableFoodAlerts !== false && (
                                                        <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            ⏳ Alimento: {(() => {
                                                                const last = pet.lastPurchaseDate.toDate ? pet.lastPurchaseDate.toDate() : new Date(pet.lastPurchaseDate);
                                                                const next = new Date(last);
                                                                next.setDate(last.getDate() + Number(pet.frequencyDays));
                                                                return next.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                                            })()}
                                                        </span>
                                                    )}
                                                    {(pet.type || '').toLowerCase().trim() === 'gato' && pet.lastLitterPurchaseDate && pet.enableLitterAlerts !== false && (
                                                        <span className="text-[9px] font-black text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            🧹 Piedras: {(() => {
                                                                const last = pet.lastLitterPurchaseDate.toDate ? pet.lastLitterPurchaseDate.toDate() : new Date(pet.lastLitterPurchaseDate);
                                                                const next = new Date(last);
                                                                next.setDate(last.getDate() + Number(pet.litterFrequencyDays));
                                                                return next.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="flex flex-col gap-2">
                                                <button
                                                    onClick={() => {
                                                        setEditingPet(pet);
                                                        setPetFormData({ ...pet });
                                                        setPetPhotoBase64(pet.photoUrl || null);
                                                        setIsCustomBreed(pet.breed ? !PET_BREEDS.includes(pet.breed) : false);
                                                        setIsCustomBrand(pet.brand ? !PET_BRANDS.includes(pet.brand) : false);
                                                        setIsPetModalOpen(true);
                                                    }}
                                                    className="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                                                >
                                                    <PenLine size={16} />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="text-center py-8">
                                    <div className="w-16 h-16 bg-orange-50/50 rounded-full flex items-center justify-center mx-auto mb-3 text-orange-400">
                                        <span className="text-3xl">🐶</span>
                                    </div>
                                    <p className="text-sm text-gray-500">¿Aún no cargaste a tus mascotas?</p>
                                    <p className="text-[10px] text-gray-400 mt-1">Hacé clic en el botón + para empezar.</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

            {/* SETTINGS GROUP */}
            <div className="px-4 mt-6 space-y-3">

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
                                <span className="font-bold text-gray-700 text-sm block">Noticias y Beneficios Cercanos</span>
                                <span className="text-[10px] text-gray-400 font-medium">Alertas de ofertas y novedades locales</span>
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
                {(config?.contact?.termsAndConditions || config?.contact?.termsContent) && (
                    <button
                        onClick={() => {
                            if (config?.contact?.termsAndConditions) {
                                window.open(config.contact.termsAndConditions, '_blank');
                            } else {
                                setIsTermsOpen(true);
                            }
                        }}
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

                    {/* DIGITAL CREDENTIAL (QR) - MOVED TO BOTTOM */}
                    <div className="px-4 py-6 border-t border-gray-50">
                        <div className="bg-white rounded-3xl shadow-sm p-6 flex flex-col items-center gap-4 border border-gray-100">
                            <div className="flex items-center gap-2 text-gray-800 font-bold">
                                <QrCode className="text-indigo-500" />
                                <h3>Tu Credencial Digital</h3>
                            </div>
                            <div className="bg-orange-50/30 p-4 rounded-3xl border-2 border-dashed border-orange-200">
                                <div style={{ padding: "10px", background: 'white' }} className="rounded-2xl shadow-inner">
                                    <QRCode
                                        value={qrValue}
                                        size={180}
                                        style={{ height: "auto", maxWidth: "100%", width: "100%" }}
                                        viewBox={`0 0 256 256`}
                                    />
                                </div>
                            </div>
                            <p className="text-[10px] text-gray-400 text-center max-w-[200px] font-bold uppercase tracking-widest leading-relaxed">
                                Muestra este código en caja para sumar puntos o canjear premios.
                            </p>
                        </div>
                    </div>

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
                
                {/* App Version Info */}
                <div className="mt-8 text-center flex flex-col items-center justify-center">
                    <p className="text-[10px] font-bold text-gray-400 tracking-widest uppercase">
                        Sistema Club Fidelidad
                    </p>
                    <p className="text-[9px] font-medium text-gray-300 tracking-wider mt-0.5">
                        Versión {APP_VERSION}
                    </p>
                </div>
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
                        {/* Content (Dynamic Render) */}
                        <div className="flex-1 overflow-y-auto p-6 text-sm text-gray-600 scrollbar-hide">
                            {config?.contact?.termsContent ? (
                                <div className="space-y-4 whitespace-pre-wrap leading-relaxed">
                                    {(config.contact.termsContent || '')
                                        .replace(/\{siteName\}/g, config?.siteName || 'Club')
                                        .split('\n\n')
                                        .map((block: string, idx: number) => {
                                            if (block.startsWith('## ')) {
                                                return <h4 key={idx} className="font-extrabold text-gray-900 mt-6 mb-2 uppercase tracking-widest text-[10px]">{block.replace('## ', '')}</h4>;
                                            }
                                            if (block.startsWith('# ')) {
                                                return <h3 key={idx} className="text-lg font-black text-gray-800 mb-4">{block.replace('# ', '')}</h3>;
                                            }
                                            if (block.startsWith('***')) {
                                                return <hr key={idx} className="my-6 border-gray-100" />;
                                            }
                                            return <p key={idx} className="mb-2">{block}</p>;
                                        })
                                    }
                                </div>
                            ) : (
                                <p className="text-center py-10 text-gray-400 italic">No se han definido términos y condiciones.</p>
                            )}
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
                                <div>
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Cumpleaños</label>
                                    <input
                                        type="date"
                                        className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold"
                                        value={editData.birthDate}
                                        onChange={e => setEditData({ ...editData, birthDate: e.target.value })}
                                        required
                                    />
                                </div>

                                <div className="space-y-3">
                                    <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">Zona de Alertas y Beneficios Locales</label>
                                    <div className="grid grid-cols-1 gap-2">
                                        <select
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold"
                                            value={selectedProv}
                                            onChange={(e) => { 
                                                const p = e.target.value;
                                                setSelectedProv(p); 
                                                setSelectedPart(''); 
                                                setSelectedLoc('');
                                                setEditData({...editData, provincia: p, partido: '', localidad: ''});
                                            }}
                                        >
                                            <option value="">Provincia</option>
                                            {Object.keys(ARGENTINA_LOCATIONS).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <select
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold disabled:opacity-50"
                                            value={selectedPart}
                                            disabled={!selectedProv}
                                            onChange={(e) => {
                                                const p = e.target.value;
                                                setSelectedPart(p);
                                                setSelectedLoc('');
                                                setEditData({...editData, partido: p, localidad: ''});
                                            }}
                                        >
                                            <option value="">Partido/Departamento</option>
                                            {selectedProv && Object.keys(ARGENTINA_LOCATIONS[selectedProv] || {}).map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <select
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold disabled:opacity-50"
                                            value={selectedLoc}
                                            disabled={!selectedPart}
                                            onChange={(e) => {
                                                const l = e.target.value;
                                                setSelectedLoc(l);
                                                setEditData({...editData, localidad: l});
                                            }}
                                        >
                                            <option value="">Localidad/Barrio</option>
                                            {selectedProv && selectedPart && (ARGENTINA_LOCATIONS[selectedProv][selectedPart] || []).map((l: string) => <option key={l} value={l}>{l}</option>)}
                                        </select>
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
                                            required={editData.number?.length > 0}
                                        />
                                    </div>
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">N°</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold text-center"
                                            value={editData.number}
                                            onChange={e => setEditData({ ...editData, number: e.target.value })}
                                            required={editData.street?.length > 0}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-3 gap-2">
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
                                    <div>
                                        <label className="block text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 ml-1">CP</label>
                                        <input
                                            type="text"
                                            className="w-full bg-gray-50 px-4 py-2.5 rounded-xl border border-transparent focus:bg-white focus:border-indigo-200 outline-none text-sm font-bold text-center"
                                            value={editData.cp}
                                            onChange={e => setEditData({ ...editData, cp: e.target.value })}
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

            {/* Modal de Mascota */}
            {isPetModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-white w-full max-w-md rounded-3xl overflow-hidden shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-orange-50/50">
                            <div className="flex items-center gap-3">
                                <div className="p-2 bg-orange-100 rounded-lg text-orange-600">
                                    <span className="text-xl">🐾</span>
                                </div>
                                <h3 className="font-bold text-gray-800">
                                    {editingPet ? 'Editar Mascota' : 'Nueva Mascota'}
                                </h3>
                            </div>
                            <button type="button" onClick={() => setIsPetModalOpen(false)} className="text-xs font-bold text-gray-500 bg-white border border-gray-200 px-3 py-1.5 rounded-lg shadow-sm hover:bg-gray-50 flex items-center gap-1">
                                <X size={14} /> Cancelar
                            </button>
                        </div>

                        <form onSubmit={handleSavePet} className="p-6 space-y-4 max-h-[70vh] overflow-y-auto">
                            {/* Subida de foto */}
                            <div className="flex flex-col items-center gap-3 mb-4">
                                <div className="relative group">
                                    <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-100 border-4 border-white shadow-md">
                                        {petPhotoBase64 ? (
                                            <img src={petPhotoBase64} alt="Preview" className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-orange-50 text-orange-400">
                                                {(petFormData.type || '').toLowerCase().trim() === 'perro' ? <span className="text-4xl">🐶</span> : 
                                                 (petFormData.type || '').toLowerCase().trim() === 'gato' ? <span className="text-4xl">🐱</span> : 
                                                 <span className="text-4xl">🐾</span>}
                                            </div>
                                        )}
                                    </div>
                                    <label className="absolute bottom-0 right-0 p-2 bg-orange-600 text-white rounded-full cursor-pointer shadow-lg hover:bg-orange-700 transition-colors">
                                        <Camera size={16} />
                                        <input type="file" accept="image/*" className="hidden" onChange={handlePetPhotoChange} />
                                    </label>
                                </div>
                                <p className="text-[10px] text-gray-400 uppercase font-bold tracking-widest">Foto de tu mascota</p>
                            </div>

                            <div className="space-y-3">
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">Nombre</label>
                                        <input
                                            required
                                            type="text"
                                            value={petFormData.name}
                                            onChange={(e) => setPetFormData({ ...petFormData, name: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                            placeholder="Ej: Toby"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">¿Qué es?</label>
                                        <select
                                            value={petFormData.type || 'perro'}
                                            onChange={(e) => setPetFormData({ ...petFormData, type: e.target.value as any })}
                                            className="w-full px-4 py-3 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-bold"
                                        >
                                            <option value="perro">🐶 Perro</option>
                                            <option value="gato">🐱 Gato</option>
                                            <option value="otro">🐾 Otro</option>
                                        </select>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">Raza</label>
                                        {!isCustomBreed ? (
                                            <select
                                                value={(petFormData.type === 'gato' ? CAT_BREEDS : petFormData.type === 'perro' ? DOG_BREEDS : PET_BREEDS).includes(petFormData.breed || '') ? petFormData.breed : 'Otro'}
                                                onChange={(e) => {
                                                    if (e.target.value === 'Otro') {
                                                        setIsCustomBreed(true);
                                                        setPetFormData({ ...petFormData, breed: '' });
                                                    } else {
                                                        setPetFormData({ ...petFormData, breed: e.target.value });
                                                    }
                                                }}
                                                className="w-full px-4 py-3 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                            >
                                                {(petFormData.type === 'gato' ? CAT_BREEDS : petFormData.type === 'perro' ? DOG_BREEDS : PET_BREEDS).map(breed => (
                                                    <option key={breed} value={breed}>{breed}</option>
                                                ))}
                                                <option value="Otro">✎ Otro (Escribir...)</option>
                                            </select>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={petFormData.breed}
                                                    onChange={(e) => setPetFormData({ ...petFormData, breed: e.target.value })}
                                                    className="w-full px-4 py-3 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                                    placeholder="Escribe la raza..."
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setIsCustomBreed(false)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-600 uppercase"
                                                >
                                                    Lista
                                                </button>
                                            </div>
                                        )}
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">Edad (aprox)</label>
                                        <input
                                            type="number"
                                            value={petFormData.age}
                                            onChange={(e) => setPetFormData({ ...petFormData, age: e.target.value })}
                                            className="w-full px-4 py-3 bg-gray-50 border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                            placeholder="Años"
                                        />
                                    </div>
                                </div>

                                <div className="p-4 bg-orange-50/30 rounded-2xl border border-orange-100/50 space-y-3">
                                    <p className="text-[10px] font-black text-orange-600 uppercase tracking-widest">Configuración de Alimento</p>
                                    
                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">Marca</label>
                                        {!isCustomBrand ? (
                                            <select
                                                value={PET_BRANDS.includes(petFormData.brand || '') ? petFormData.brand : 'Otro'}
                                                onChange={(e) => {
                                                    if (e.target.value === 'Otro') {
                                                        setIsCustomBrand(true);
                                                        setPetFormData({ ...petFormData, brand: '' });
                                                    } else {
                                                        setPetFormData({ ...petFormData, brand: e.target.value });
                                                    }
                                                }}
                                                className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                            >
                                                {PET_BRANDS.map(brand => (
                                                    <option key={brand} value={brand}>{brand}</option>
                                                ))}
                                                <option value="Otro">✎ Otro (Escribir...)</option>
                                            </select>
                                        ) : (
                                            <div className="relative">
                                                <input
                                                    type="text"
                                                    autoFocus
                                                    value={petFormData.brand}
                                                    onChange={(e) => setPetFormData({ ...petFormData, brand: e.target.value })}
                                                    className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                                    placeholder="Escribe la marca..."
                                                />
                                                <button 
                                                    type="button"
                                                    onClick={() => setIsCustomBrand(false)}
                                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-bold text-orange-600 uppercase"
                                                >
                                                    Lista
                                                </button>
                                            </div>
                                        )}
                                    </div>

                                    <div>
                                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">Variedad</label>
                                        <input
                                            type="text"
                                            value={petFormData.variant}
                                            onChange={(e) => setPetFormData({ ...petFormData, variant: e.target.value })}
                                            className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                            placeholder="Ej: Adulto Mordida Pequeña"
                                        />
                                    </div>

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">
                                                {(petFormData.type || '').toLowerCase().trim() === 'gato' ? 'Alimento (días)' : 'Dura (días)'}
                                            </label>
                                            <input
                                                type="number"
                                                value={petFormData.frequencyDays}
                                                onChange={(e) => setPetFormData({ ...petFormData, frequencyDays: Number(e.target.value) })}
                                                className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                                placeholder="Ej: 30"
                                                min="1"
                                            />
                                            <div className="flex items-center gap-2 mt-2 ml-1">
                                                <input 
                                                    type="checkbox" 
                                                    checked={petFormData.enableFoodAlerts ?? true}
                                                    onChange={(e) => setPetFormData({ ...petFormData, enableFoodAlerts: e.target.checked })}
                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                />
                                                <label className="text-[10px] text-gray-500 font-medium cursor-pointer" onClick={() => setPetFormData({ ...petFormData, enableFoodAlerts: !(petFormData.enableFoodAlerts ?? true) })}>
                                                    Recibir alertas de alimento
                                                </label>
                                            </div>
                                        </div>
                                        {(petFormData.type || '').toLowerCase().trim() === 'gato' && (
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">Piedras (días)</label>
                                                <input
                                                    type="number"
                                                    value={petFormData.litterFrequencyDays}
                                                    onChange={(e) => setPetFormData({ ...petFormData, litterFrequencyDays: Number(e.target.value) })}
                                                    className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                                    placeholder="Ej: 15"
                                                    min="1"
                                                />
                                                <div className="flex items-center gap-2 mt-2 ml-1">
                                                    <input 
                                                        type="checkbox" 
                                                        checked={petFormData.enableLitterAlerts ?? true}
                                                        onChange={(e) => setPetFormData({ ...petFormData, enableLitterAlerts: e.target.checked })}
                                                        className="w-3.5 h-3.5 rounded border-gray-300 text-orange-600 focus:ring-orange-500"
                                                    />
                                                    <label className="text-[10px] text-gray-500 font-medium cursor-pointer" onClick={() => setPetFormData({ ...petFormData, enableLitterAlerts: !(petFormData.enableLitterAlerts ?? true) })}>
                                                        Recibir alertas de piedras
                                                    </label>
                                                </div>
                                            </div>
                                        )}
                                        <div className={`flex items-end pb-3 ${(petFormData.type || '').toLowerCase().trim() === 'gato' ? 'col-span-2' : ''}`}>
                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                <input
                                                    type="checkbox"
                                                    checked={petFormData.receiveAlerts}
                                                    onChange={(e) => setPetFormData({ ...petFormData, receiveAlerts: e.target.checked })}
                                                    className="w-5 h-5 rounded border-gray-300 text-orange-600 focus:ring-orange-500 transition-all"
                                                />
                                                <span className="text-[11px] font-bold text-gray-600 uppercase">Activar Alertas</span>
                                            </label>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {!editingPet ? (
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button
                                        type="submit"
                                        disabled={loadingPet}
                                        className="w-full py-4 bg-orange-100 text-orange-700 border border-orange-200 rounded-2xl font-bold hover:bg-orange-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        Guardar y Salir
                                    </button>
                                    <button
                                        type="button"
                                        disabled={loadingPet}
                                        onClick={(e) => handleSavePet(e, true)}
                                        className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-600/20 hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loadingPet ? (
                                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                        ) : 'Guardar y Otra'}
                                    </button>
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-3 mt-4">
                                    <button
                                        type="button"
                                        disabled={loadingPet}
                                        onClick={() => setIsPetModalOpen(false)}
                                        className="w-full py-4 bg-gray-100 text-gray-600 border border-gray-200 rounded-2xl font-bold hover:bg-gray-200 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        Cancelar
                                    </button>
                                    <button
                                        type="submit"
                                        disabled={loadingPet}
                                        className="w-full py-4 bg-orange-600 text-white rounded-2xl font-bold shadow-lg shadow-orange-600/20 hover:bg-orange-700 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {loadingPet ? (
                                            <>
                                                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                                Guardando...
                                            </>
                                        ) : 'Actualizar Mascota'}
                                    </button>
                                </div>
                            )}

                            {editingPet && (
                                <button
                                    type="button"
                                    onClick={() => {
                                        handleDeletePet(editingPet);
                                        setIsPetModalOpen(false);
                                    }}
                                    className="w-full py-3 mt-4 text-red-500 font-bold text-xs uppercase tracking-widest hover:bg-red-50 rounded-xl transition-colors flex items-center justify-center gap-2"
                                >
                                    <Trash2 size={14} /> Eliminar Mascota
                                </button>
                            )}
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
};
