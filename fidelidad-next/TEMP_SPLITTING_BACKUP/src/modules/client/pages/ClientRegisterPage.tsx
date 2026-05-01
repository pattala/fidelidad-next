import React, { useState, useEffect } from 'react';
import { ConfigService } from '../../../services/configService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, getDocs, collection, onSnapshot, limit } from 'firebase/firestore';
import { Mail, Lock, User, Phone, ArrowLeft, ArrowRight, MapPin, Building, Home, Eye, EyeOff, Check, Heart, ShieldCheck, Cake, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { ARGENTINA_LOCATIONS } from '../../../data/locations';
import { EmailService } from '../../../services/emailService';
import { DEFAULT_TEMPLATES } from '../../../services/configService';
import { NotificationService } from '../../../services/notificationService';
import type { AppConfig } from '../../../types';

export const ClientRegisterPage = () => {
    // Step 1: Personal Data
    const [name, setName] = useState('');
    const [dni, setDni] = useState('');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [showPass, setShowPass] = useState(false);

    // Step 2: Address Data
    const [step, setStep] = useState(1);
    const [province, setProvince] = useState('Buenos Aires');
    const [partido, setPartido] = useState(''); // This acts as "Department/City"
    const [localidad, setLocalidad] = useState(''); // This acts as "Town/Neighborhood"
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [floor, setFloor] = useState('');
    const [apt, setApt] = useState('');
    const [cp, setCp] = useState(''); // Added ZIP Code
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const refCode = searchParams.get('ref');

    useEffect(() => {
        ConfigService.get().then(setConfig);

        // Update Favicon dynamically
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
        return () => unsubConfig();
    }, []);

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (pass.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        setStep(2);
    };

    // Helper: Formatear teléfono para WhatsApp (Argentina)
    const formatPhone = (val: string) => {
        // Eliminar todo lo que no sea número
        let num = val.replace(/\D/g, '');
        // Si empieza con 549, dejarlo, si empieza con 11 o 15, ajustar...
        // Estrategia simple: Guardar solo números limpios para búsqueda, pero visualmente...
        // Mejor strategy: Pedir al usuario sin 0 ni 15, y agregar +549.
        return num;
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!termsAccepted) {
            toast.error('Debes aceptar los términos y condiciones');
            return;
        }

        setLoading(true);

        try {
            // 0. Validaciones Previas de Unicidad (Teléfono)
            // Esto evita problemas antes de siquiera tocar Auth
            const cleanPhone = phone.replace(/\D/g, '');
            const qPhone = query(collection(db, 'users'), where('phone_raw', '==', cleanPhone), limit(1)); // Usar versión limpia para búsqueda

            // Verificación asíncrona paralela
            const snapPhone = await getDocs(qPhone);

            if (!snapPhone.empty) {
                toast.error('Ese número de teléfono ya está registrado.');
                setLoading(false);
                return;
            }

            // 0.5. Validación de DNI
            const qDni = query(collection(db, 'users'), where('dni', '==', dni), limit(1));
            const snapDni = await getDocs(qDni);
            if (!snapDni.empty) {
                toast.error('Este DNI ya se encuentra registrado.');
                setLoading(false);
                return;
            }

            // 0.6. Buscar Inviter si hay refCode
            let inviterUid = null;
            if (refCode) {
                const qRef = query(collection(db, 'users'), where('referralCode', '==', refCode.toUpperCase()), limit(1));
                const snapRef = await getDocs(qRef);
                if (!snapRef.empty) {
                    inviterUid = snapRef.docs[0].id;
                }
            }

            // 0.7. Generar ReferralCode propio (ej: PABLO-A1B2)
            const myRefCode = `${name.split(' ')[0].toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

            // 1. Intentar crear usuario en Auth (Estricto)
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;

            // 2. Actualizar perfil
            await updateProfile(user, { displayName: name });

            // Formatear teléfono a estándar intl para guardarlo
            // Asumiendo input local (ej 11 1234 5678) transformamos a +54 9 11...
            // O guardamos limpio si prefieres. Estándar: +549 + numero_sin_0_ni_15
            const finalPhone = `+549${cleanPhone}`;

            // 3. Crear documento en Firestore (Base + Dirección)
            const fullCalle = `${street} ${number}`.trim();
            const fullAddress = `${fullCalle} ${floor ? 'Piso ' + floor : ''} ${apt ? 'Dpto ' + apt : ''}, ${localidad}, ${partido}, ${province}`;

            // Sync structure with Admin Panel (using 'components' nesting)
            await setDoc(doc(db, 'users', user.uid), {
                name: name,
                nombre: name, // Duplicate for compatibility with some older APIs/functions
                dni: dni,
                email: email,
                phone: finalPhone,
                birthDate: birthDate,
                phone_raw: cleanPhone,
                authUID: user.uid,
                domicilio: {
                    status: 'complete',
                    addressLine: fullAddress,
                    components: {
                        calle: fullCalle, // Combined here too for the Admin Panel Edit modal
                        numero: number,
                        piso: floor,
                        depto: apt,
                        localidad: localidad,
                        partido: partido,
                        provincia: province,
                        zipCode: cp
                    }
                },
                // Flattened for easy access if needed
                localidad,
                partido,
                provincia: province,
                calle: fullCalle,
                numero: number,
                piso: floor,
                depto: apt,
                cp,

                role: 'client',
                createdAt: new Date(),
                fechaInscripcion: new Date().toISOString(),

                points: 0,
                puntos: 0,
                accumulated_balance: 0,

                permissions: {
                    notifications: { status: 'pending' },
                    geolocation: { status: 'pending' }
                },
                termsAccepted: true,
                termsAcceptedAt: new Date().toISOString(),
                source: 'pwa',
                socioNumber: null,
                numeroSocio: null,

                // Referrals
                referralCode: myRefCode,
                referredBy: inviterUid,
                referralStats: { count: 0, pointsEarned: 0 },

                metadata: { createdFrom: 'pwa', version: '2.5-fixed-address', refCodeUsed: refCode }
            });

            // 4. Llamadas al Backend (Serverless APIs) para finalización robusta
            // Obtener token para autenticar con el backend
            const token = await user.getIdToken();
            const apiKey = import.meta.env.VITE_API_KEY;

            // Prepare for sequential steps with informative toast/loading
            // A. Asignar N° Socio (Secuencial seguro) - SILENCIADO
            const shouldSendWelcome = config?.enableWelcomeMessage !== false;

            let assignedSocioNumber = '';
            try {
                const socioRes = await fetch('/api/users?action=assign-socio', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                    body: JSON.stringify({ docId: user.uid, sendWelcome: false }) // Email unificado se hace al final
                });
                if (socioRes.ok) {
                    const socioData = await socioRes.json();
                    assignedSocioNumber = socioData.numeroSocio || '';
                }
            } catch (e) {
                console.warn('Error asignando socio:', e);
            }

            let totalBonusPoints = 0;
            let earnedWelcomeBonus = false;
            let earnedAddressBonus = false;

            // B. Asignar Puntos de Bienvenida - SILENCIADO
            if (config?.enableWelcomeBonus !== false) {
                const welcomePts = Number(config?.welcomePoints || 0);
                if (welcomePts > 0) {
                    await fetch('/api/assign-points', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                        body: JSON.stringify({
                            uid: user.uid,
                            reason: 'welcome_signup',
                            amount: welcomePts,
                            skipNotifications: true
                        })
                    }).then(res => {
                        if (res.ok) { totalBonusPoints += welcomePts; earnedWelcomeBonus = true; }
                    }).catch(e => console.warn('Error asignando puntos:', e));
                }
            }

            // C. Asignar Bono por Domicilio (Opcional) - SILENCIADO
            const hasAddress = street.trim() !== '' && number.trim() !== '';
            if (hasAddress && config?.enableAddressBonus !== false) {
                const addressPts = Number(config?.pointsForAddress || 50);
                if (addressPts > 0) {
                    await fetch('/api/assign-points', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                        body: JSON.stringify({
                            uid: user.uid,
                            reason: 'profile_address',
                            amount: addressPts,
                            skipNotifications: true
                        })
                    }).then(res => {
                        if (res.ok) { totalBonusPoints += addressPts; earnedAddressBonus = true; }
                    }).catch(e => console.warn('Error asignando puntos de domicilio:', e));
                }
            }

            // D. Enviar Notificación Inbox/Push y EMAIL UNIFICADO
            if (shouldSendWelcome) {
                try {
                    const welcomeTemplate = config?.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome;

                    const welcomeMsg = welcomeTemplate
                        .replace(/{nombre}/g, name.split(' ')[0])
                        .replace(/{nombre_completo}/g, name)
                        .replace(/{puntos}/g, totalBonusPoints.toString())
                        .replace(/{dni}/g, dni)
                        .replace(/{email}/g, email)
                        .replace(/{socio}/g, assignedSocioNumber.toString())
                        .replace(/{numero_socio}/g, assignedSocioNumber.toString())
                        .replace(/{telefono}/g, phone)
                        .replace(/{siteName}/g, config?.siteName || 'nuestro Club');

                    const welcomeSubject = `¡Bienvenido a ${config?.siteName || 'nuestro Club'}! 🎉`;

                    // 1. Inbox / Push (Siempre ocurre)
                    await NotificationService.sendToClient(user.uid, {
                        title: welcomeSubject,
                        body: welcomeMsg,
                        type: 'welcome',
                        icon: config?.logoUrl || '/logo.png'
                    });

                    // 2. Correo de Bienvenida (con formato lindo HTML unificado)
                    const htmlContent = EmailService.generateBrandedTemplate((config as AppConfig) || {}, welcomeSubject.replace(' 🎉', ''), welcomeMsg);

                    await fetch('/api/notifications?action=email', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`,
                            'x-api-key': apiKey
                        },
                        body: JSON.stringify({
                            to: email,
                            templateId: 'manual_override', // Le dice a la API que confíe en htmlContent
                            templateData: {
                                subject: welcomeSubject,
                                htmlContent: htmlContent
                            }
                        })
                    }).catch(err => console.error("Error enviando email unificado de bienvenida:", err));

                } catch (notiError) {
                    console.warn("No se pudo enviar notificaciones iniciales:", notiError);
                }
            }

            toast.success('¡Registro completo! Bienvenido.');
            navigate('/');

        } catch (error: any) {
            console.error(error);
            if (error.code === 'auth/email-already-in-use') {
                toast.error('El email ya está registrado.');
            } else {
                toast.error('Error al registrar: ' + error.message);
            }
        } finally {
            setLoading(false);
        }
    };

    // Derived lists for dropdowns
    const provinces = Object.keys(ARGENTINA_LOCATIONS);
    const availablePartidos = province ? Object.keys(ARGENTINA_LOCATIONS[province] || {}) : [];
    const availableLocalidades = (province && partido) ? (ARGENTINA_LOCATIONS[province][partido] || []) : [];

    return (
        <div className="min-h-[100dvh] w-full relative flex items-center justify-center overflow-hidden bg-gray-50">
            {/* Loading Overlay */}
            {loading && (
                <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-purple-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
                    </div>
                    <h3 className="text-xl font-black text-gray-800 animate-pulse">Procesando Registro...</h3>
                    <p className="text-sm text-gray-500 font-medium mt-2">Estamos preparando tu cuenta y tus puntos</p>
                </div>
            )}

            {/* Desktop Decorative Background Elements (From Layout) */}
            <div className="hidden sm:block absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse"></div>
            <div className="hidden sm:block absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-pink-600/10 blur-[100px] rounded-full"></div>

            <div
                className="flex flex-col h-[100dvh] w-full max-w-md mx-auto sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-[3rem] sm:shadow-[0_0_80px_rgba(0,0,0,0.5)] relative font-sans transition-all duration-500 overflow-hidden border-x border-gray-100/5 sm:border-t sm:border-white/10 z-10 bg-gray-50/90 backdrop-blur-3xl"
            >
                {/* Background Decoration Inner */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-3xl -mr-20 -mt-20 pointer-events-none"></div>
                <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-200/50 rounded-full blur-3xl -ml-16 -mb-16 pointer-events-none"></div>

                {/* Header Fijo con botón Atrás */}
                <header className="flex-none p-4 flex items-center z-20 relative bg-transparent">
                    <button
                        onClick={() => step === 2 ? setStep(1) : navigate('/login')}
                        className="flex items-center justify-center gap-1.5 text-gray-700 font-bold text-sm hover:text-gray-900 transition bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-gray-200/50"
                    >
                        <ArrowLeft size={16} /> Atrás
                    </button>
                    <div className="flex-1"></div>
                </header>

                {/* Main Content Area (Scrollable) */}
                <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24 scrollbar-hide relative z-10 w-full animate-fade-in flex flex-col items-center">
                    <div className="w-full max-w-sm shrink-0 transition-all mx-auto pb-8">

                        {/* Logo / Brand - Homologado con Login */}
                        <div className="mb-6 sm:mb-10 text-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-3xl mx-auto shadow-xl shadow-purple-500/10 flex items-center justify-center mb-2 sm:mb-4 transform -rotate-3 overflow-hidden p-2">
                                {config?.logoUrl ? (
                                    <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                                ) : (
                                    <span className="text-3xl sm:text-4xl">🚀</span>
                                )}
                            </div>
                            <h1 className="text-2xl sm:text-3xl font-black text-gray-800 tracking-tight">
                                {config?.siteName || import.meta.env.VITE_APP_NAME || 'Sistema de Beneficios'}
                            </h1>
                            <p className="text-xs sm:text-sm text-gray-500 font-medium mt-1">Crea tu cuenta gratis</p>
                        </div>

                        <div className="bg-white p-5 sm:p-8 rounded-[1.5rem] sm:rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 backdrop-blur-sm animate-fade-in">
                            <div className="mb-4 sm:mb-6 text-center">
                                {refCode && (
                                    <div className="mb-3 sm:mb-4 p-2 sm:p-3 bg-purple-50 rounded-2xl border border-purple-100 animate-bounce-subtle">
                                        <p className="text-[9px] sm:text-[10px] font-black uppercase text-purple-400 tracking-widest mb-0.5 sm:mb-1">¡Invitación Especial!</p>
                                        <p className="text-xs font-bold text-purple-700 flex items-center justify-center gap-1">
                                            <Gift size={14} /> Te han invitado a sumarte
                                        </p>
                                    </div>
                                )}
                                <h2 className="text-lg sm:text-xl font-bold text-gray-800 mb-4 sm:mb-6">
                                    {step === 1 ? 'Datos Personales' : 'Tu Dirección'}
                                </h2>
                                <div className="flex justify-center gap-2 mt-2">
                                    <div className={`h-1.5 w-8 rounded-full ${step === 1 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
                                    <div className={`h-1.5 w-8 rounded-full ${step === 2 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
                                </div>
                            </div>

                            {/* Banner Dinámico de Marketing (Upfront Value Proposition) */}
                            {((config?.enableWelcomeBonus !== false && Number(config?.welcomePoints || 0) > 0) ||
                                (config?.enableAddressBonus !== false && Number(config?.pointsForAddress || 0) > 0)) && step === 1 && (
                                    <div className="mb-6 p-4 sm:p-5 bg-gradient-to-br from-indigo-50 to-purple-50 rounded-2xl border border-indigo-100/50 shadow-inner flex items-center gap-4 animate-fade-in relative overflow-hidden">
                                        <div className="absolute -right-4 -top-4 text-purple-100/40 transform rotate-12">
                                            <Gift size={80} />
                                        </div>
                                        <div className="bg-white p-3 rounded-full shadow-sm text-indigo-600 shrink-0 relative z-10">
                                            <Gift size={24} className="animate-pulse" />
                                        </div>
                                        <div className="relative z-10">
                                            <h3 className="text-sm sm:text-base text-indigo-900 font-extrabold leading-tight">
                                                ¡Gana {
                                                    (config?.enableWelcomeBonus !== false && config?.enableAddressBonus !== false)
                                                        ? `hasta ${(Number(config?.welcomePoints || 0) + Number(config?.pointsForAddress || 50))} Puntos`
                                                        : `${Number(config?.welcomePoints || 0)} Puntos`
                                                } de regalo hoy!
                                            </h3>
                                            <p className="text-xs sm:text-sm text-indigo-700 font-medium mt-0.5">
                                                Completa tu cuenta y obtén tu premio al instante.
                                            </p>
                                        </div>
                                    </div>
                                )}

                            {step === 1 ? (
                                <form onSubmit={handleNextStep} className="space-y-3 sm:space-y-4">
                                    <div className="relative">
                                        <User className="absolute left-4 top-3 sm:top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            required
                                            placeholder="Nombre Completo"
                                            className="w-full bg-gray-50 pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                            value={name}
                                            onChange={e => setName(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-3 sm:top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="tel"
                                            required
                                            placeholder="Celular"
                                            className="w-full bg-gray-50 pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                            value={phone}
                                            onChange={e => setPhone(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Building className="absolute left-4 top-3 sm:top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="text"
                                            required
                                            placeholder="DNI (Sin puntos)"
                                            className="w-full bg-gray-50 pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                            value={dni}
                                            onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                                        />
                                    </div>
                                    <div className="relative hidden">
                                        <Cake className="absolute left-4 top-3 sm:top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="date"
                                            required={false}
                                            className="w-full bg-gray-50 pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                            value={birthDate}
                                            onChange={e => setBirthDate(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-3 sm:top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="email"
                                            required
                                            placeholder="Email"
                                            className="w-full bg-gray-50 pl-11 pr-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                            value={email}
                                            onChange={e => setEmail(e.target.value)}
                                        />
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-3 sm:top-3.5 text-gray-400" size={18} />
                                        <input
                                            type={showPass ? "text" : "password"}
                                            required
                                            placeholder="Contraseña (min 6 chars)"
                                            className="w-full bg-gray-50 pl-11 pr-11 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                            value={pass}
                                            onChange={e => setPass(e.target.value)}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPass(!showPass)}
                                            className="absolute right-4 top-3 sm:top-3.5 text-gray-400 hover:text-purple-600 transition"
                                        >
                                            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <button type="submit" className="w-full bg-gray-900 text-white py-3 sm:py-4 rounded-2xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4">
                                        Continuar <ArrowRight size={18} />
                                    </button>
                                </form>
                            ) : (
                                <form onSubmit={handleRegister} className="space-y-3 sm:space-y-4">

                                    {config?.enableAddressBonus !== false && (
                                        <div className="mb-2 p-3 bg-teal-50 rounded-2xl border border-teal-100/50 flex items-start gap-3 shadow-sm">
                                            <div className="bg-teal-100 p-2 rounded-full text-teal-600 shrink-0">
                                                <Gift size={16} />
                                            </div>
                                            <div>
                                                <p className="text-xs font-bold text-teal-800">¡Obtén puntos extra! 🎁</p>
                                                <p className="text-[10px] text-teal-600 mt-0.5 leading-tight">Completa tu dirección (Calle y N°) ahora y suma puntos extra al terminar tu registro.</p>
                                            </div>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <label className="text-[10px] sm:text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Zona</label>
                                        <select
                                            value={province}
                                            onChange={e => { setProvince(e.target.value); setPartido(''); setLocalidad(''); }}
                                            className="w-full bg-gray-50 px-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                        >
                                            <option value="">Provincia</option>
                                            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <select
                                            value={partido}
                                            onChange={e => { setPartido(e.target.value); setLocalidad(''); }}
                                            disabled={!province}
                                            className="w-full bg-gray-50 px-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none disabled:opacity-50"
                                        >
                                            <option value="">Partido/Departamento</option>
                                            {availablePartidos.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <select
                                            value={localidad}
                                            onChange={e => setLocalidad(e.target.value)}
                                            disabled={!partido}
                                            className="w-full bg-gray-50 px-4 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none disabled:opacity-50"
                                        >
                                            <option value="">Localidad/Barrio</option>
                                            {availableLocalidades.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <MapPin className="absolute left-3 top-3 sm:top-3.5 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Calle"
                                                className="w-full bg-gray-50 pl-9 pr-3 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                                value={street}
                                                onChange={e => setStreet(e.target.value)}
                                                required={number.length > 0} // Requerido si carga numero
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="N°"
                                            className="w-16 sm:w-20 bg-gray-50 px-2 sm:px-3 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center"
                                            value={number}
                                            onChange={e => setNumber(e.target.value)}
                                            required={street.length > 0} // Requerido si carga calle
                                        />
                                    </div>

                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Building className="absolute left-3 top-3 sm:top-3.5 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Piso"
                                                className="w-full bg-gray-50 pl-9 pr-2 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                                value={floor}
                                                onChange={e => setFloor(e.target.value)}
                                            />
                                        </div>
                                        <div className="relative flex-1">
                                            <Home className="absolute left-3 top-3 sm:top-3.5 text-gray-400" size={16} />
                                            <input
                                                type="text"
                                                placeholder="Depto"
                                                className="w-full bg-gray-50 pl-9 pr-2 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                                value={apt}
                                                onChange={e => setApt(e.target.value)}
                                            />
                                        </div>
                                        <input
                                            type="text"
                                            placeholder="CP"
                                            className="w-16 sm:w-20 bg-gray-50 px-2 sm:px-3 py-3 sm:py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center"
                                            value={cp}
                                            onChange={e => setCp(e.target.value)}
                                        />
                                    </div>

                                    <div className="flex items-center gap-3 pt-2">
                                        <input
                                            type="checkbox"
                                            id="terms"
                                            required
                                            checked={termsAccepted}
                                            onChange={(e) => setTermsAccepted(e.target.checked)}
                                            className="w-5 h-5 rounded border-gray-300 text-purple-600 focus:ring-purple-500 transition cursor-pointer"
                                        />
                                        <label htmlFor="terms" className="text-xs text-gray-600">
                                            Acepto los <button
                                                type="button"
                                                onClick={() => {
                                                    if (config?.contact?.termsAndConditions) {
                                                        window.open(config.contact.termsAndConditions, '_blank');
                                                    } else {
                                                        setShowTermsModal(true);
                                                    }
                                                }}
                                                className="font-bold text-purple-600 hover:underline"
                                            >Términos y Condiciones y Política de Privacidad</button>
                                        </label>
                                    </div>

                                    <div className="flex flex-col gap-3 mt-4 sm:mt-6">
                                        <button
                                            type="submit"
                                            disabled={loading || !termsAccepted}
                                            className="w-full bg-purple-600 text-white py-3 sm:py-4 rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center gap-2 group disabled:opacity-70 disabled:grayscale"
                                        >
                                            {loading ? 'Registrando...' : 'Finalizar y Ganar Puntos'}
                                            {!loading && config?.enableAddressBonus !== false && <Gift size={18} className="group-hover:rotate-12 transition-transform" />}
                                        </button>

                                        <button
                                            type="button"
                                            onClick={(e) => {
                                                if (!termsAccepted) {
                                                    toast.error('Debes aceptar los términos y condiciones para finalizar');
                                                    return;
                                                }
                                                // Limpiamos los datos para no generar bonificaciones engañosas si saltan
                                                setStreet('');
                                                setNumber('');
                                                setProvince('');
                                                setPartido('');
                                                setLocalidad('');
                                                handleRegister(e);
                                            }}
                                            disabled={loading}
                                            className="w-full text-center text-[11px] sm:text-xs font-medium text-gray-400 hover:text-gray-600 transition-colors mt-1 underline decoration-gray-300 underline-offset-2"
                                        >
                                            No gracias, prefiero perder estos {config?.pointsForAddress || 50} puntos extra y continuar sin cargar el domicilio
                                        </button>
                                    </div>
                                </form>
                            )}
                        </div>
                    </div>

                    {/* Terms & Conditions Modal */}
                    {showTermsModal && (
                        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
                            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden flex flex-col max-h-[90vh]">
                                <div className="flex justify-between items-center mb-6">
                                    <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight">Reglas de Juego</h3>
                                    <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition">
                                        <ArrowLeft size={20} className="text-gray-400" />
                                    </button>
                                </div>

                                <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide text-[11px] leading-relaxed text-gray-600 font-medium">
                                    {config?.contact?.termsContent ? (
                                        <div className="space-y-4 whitespace-pre-wrap">
                                            {(config.contact.termsContent || '')
                                                .replace(/\{siteName\}/g, config?.siteName || 'Club')
                                                .split('\n\n')
                                                .map((block: string, idx: number) => {
                                                    if (block.startsWith('## ')) {
                                                        return <h4 key={idx} className="font-extrabold text-gray-900 mt-4 mb-1 uppercase tracking-widest text-[9px]">{block.replace('## ', '')}</h4>;
                                                    }
                                                    if (block.startsWith('# ')) {
                                                        return <h3 key={idx} className="text-sm font-black text-gray-800 mb-3">{block.replace('# ', '')}</h3>;
                                                    }
                                                    if (block.startsWith('***')) {
                                                        return <hr key={idx} className="my-4 border-gray-100" />;
                                                    }
                                                    return <p key={idx} className="mb-2">{block}</p>;
                                                })
                                            }
                                        </div>
                                    ) : (
                                        <p className="text-center py-10 text-gray-400 italic">No se han definido términos y condiciones.</p>
                                    )}
                                </div>

                                <button
                                    onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }}
                                    className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 mt-6 active:scale-95 transition"
                                >
                                    Aceptar y Cerrar
                                </button>
                            </div>
                        </div>
                    )}

                    {/* Spacer inferior adaptativo */}
                    <div className="hidden sm:block flex-grow pointer-events-none"></div>
                </main>
            </div>
        </div>
    );
};
