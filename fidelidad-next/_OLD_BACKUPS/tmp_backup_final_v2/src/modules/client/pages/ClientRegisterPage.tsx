import React, { useState, useEffect } from 'react';
import { ConfigService } from '../../../services/configService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, getDocs, collection, onSnapshot, limit } from 'firebase/firestore';
import { Mail, Lock, User, Phone, ArrowLeft, ArrowRight, MapPin, Building, Home, Eye, EyeOff, Check, Heart, ShieldCheck, Cake, Gift } from 'lucide-react';
import toast from 'react-hot-toast';
import { ARGENTINA_LOCATIONS } from '../../../data/locations';
import { NotificationService } from '../../../services/notificationService';

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
            // A. Asignar N° Socio (Secuencial seguro)
            const shouldSendWelcome = config?.enableWelcomeMessage !== false;

            await fetch('/api/assign-socio-number', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                body: JSON.stringify({ docId: user.uid, sendWelcome: shouldSendWelcome })
            }).catch(e => console.warn('Error asignando socio:', e));

            // B. Asignar Puntos de Bienvenida
            if (config?.enableWelcomeBonus !== false) {
                await fetch('/api/assign-points', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                    body: JSON.stringify({
                        uid: user.uid,
                        reason: 'welcome_signup'
                    })
                }).catch(e => console.warn('Error asignando puntos:', e));
            }

            // C. Enviar Notificación Inbox/Push (si mensaje está activado)
            if (shouldSendWelcome) {
                try {
                    // Si hay puntos, mencionarlos, si no, mensaje genérico o sin puntos
                    const pts = config?.enableWelcomeBonus !== false ? Number(config?.welcomePoints || 0) : 0;
                    const bodyMsg = pts > 0
                        ? `Gracias por registrarte, ${name.split(' ')[0]}. ¡Ya tienes ${pts} puntos de regalo!`
                        : `Gracias por registrarte, ${name.split(' ')[0]}. ¡Nos alegra tenerte en el Club!`;

                    await NotificationService.sendToClient(user.uid, {
                        title: '¡Bienvenido al Club! 🎉',
                        body: bodyMsg,
                        type: 'welcome',
                        icon: config?.logoUrl || '/logo.png'
                    });
                } catch (notiError) {
                    console.warn("No se pudo enviar la notificación inbox:", notiError);
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
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative">
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

            {/* Background Decoration */}
            <div className="absolute top-0 right-0 w-64 h-64 bg-purple-200/50 rounded-full blur-3xl -mr-20 -mt-20"></div>
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-teal-200/50 rounded-full blur-3xl -ml-16 -mb-16"></div>

            <div className="relative z-10 w-full max-w-sm">
                <button
                    onClick={() => step === 1 ? navigate('/login') : setStep(1)}
                    className="mb-6 flex items-center gap-2 text-gray-500 font-bold text-sm hover:text-purple-600 transition"
                >
                    <ArrowLeft size={18} /> {step === 1 ? 'Volver al Login' : 'Volver a Datos Personales'}
                </button>

                <div className="mb-8 text-center">
                    <div className="w-16 h-16 bg-white rounded-2xl mx-auto shadow-lg shadow-purple-500/5 flex items-center justify-center mb-4 overflow-hidden p-1.5">
                        {config?.logoUrl ? (
                            <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                        ) : (
                            <span className="text-3xl">🚀</span>
                        )}
                    </div>
                    <h1 className="text-xl font-black text-gray-800 tracking-tight">
                        {config?.siteName || 'Club Fidelidad'}
                    </h1>
                </div>

                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 backdrop-blur-sm animate-fade-in">
                    <div className="mb-6 text-center">
                        {refCode && (
                            <div className="mb-4 p-3 bg-purple-50 rounded-2xl border border-purple-100 animate-bounce-subtle">
                                <p className="text-[10px] font-black uppercase text-purple-400 tracking-widest mb-1">¡Invitación Especial!</p>
                                <p className="text-xs font-bold text-purple-700 flex items-center justify-center gap-1">
                                    <Gift size={14} /> Te han invitado a sumarte al club
                                </p>
                            </div>
                        )}
                        <h2 className="text-xl font-bold text-gray-800">
                            {step === 1 ? 'Crear Cuenta' : 'Tu Dirección'}
                        </h2>
                        <div className="flex justify-center gap-2 mt-2">
                            <div className={`h-1.5 w-8 rounded-full ${step === 1 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
                            <div className={`h-1.5 w-8 rounded-full ${step === 2 ? 'bg-purple-600' : 'bg-gray-200'}`}></div>
                        </div>
                    </div>

                    {step === 1 ? (
                        <form onSubmit={handleNextStep} className="space-y-4">
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
                                    placeholder="Celular"
                                    className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                    value={phone}
                                    onChange={e => setPhone(e.target.value)}
                                />
                            </div>
                            <div className="relative">
                                <Building className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                    type="text"
                                    required
                                    placeholder="DNI (Sin puntos)"
                                    className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                    value={dni}
                                    onChange={e => setDni(e.target.value.replace(/\D/g, ''))}
                                />
                            </div>
                            <div className="relative">
                                <Cake className="absolute left-4 top-3.5 text-gray-400" size={20} />
                                <input
                                    type="date"
                                    required
                                    className="w-full bg-gray-50 pl-12 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                    value={birthDate}
                                    onChange={e => setBirthDate(e.target.value)}
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
                                    type={showPass ? "text" : "password"}
                                    required
                                    placeholder="Contraseña (min 6 chars)"
                                    className="w-full bg-gray-50 pl-12 pr-12 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 focus:ring-4 focus:ring-purple-50 outline-none transition-all"
                                    value={pass}
                                    onChange={e => setPass(e.target.value)}
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPass(!showPass)}
                                    className="absolute right-4 top-3.5 text-gray-400 hover:text-purple-600 transition"
                                >
                                    {showPass ? <EyeOff size={20} /> : <Eye size={20} />}
                                </button>
                            </div>
                            <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4">
                                Continuar <ArrowRight size={18} />
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Zona</label>
                                <select
                                    value={province}
                                    onChange={e => { setProvince(e.target.value); setPartido(''); setLocalidad(''); }}
                                    required
                                    className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                >
                                    <option value="">Provincia</option>
                                    {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                    value={partido}
                                    onChange={e => { setPartido(e.target.value); setLocalidad(''); }}
                                    required
                                    disabled={!province}
                                    className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none disabled:opacity-50"
                                >
                                    <option value="">Partido/Departamento</option>
                                    {availablePartidos.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                    value={localidad}
                                    onChange={e => setLocalidad(e.target.value)}
                                    required
                                    disabled={!partido}
                                    className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none disabled:opacity-50"
                                >
                                    <option value="">Localidad/Barrio</option>
                                    {availableLocalidades.map(l => <option key={l} value={l}>{l}</option>)}
                                </select>
                            </div>

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <MapPin className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        required
                                        placeholder="Calle"
                                        className="w-full bg-gray-50 pl-10 pr-3 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                        value={street}
                                        onChange={e => setStreet(e.target.value)}
                                    />
                                </div>
                                <input
                                    type="text"
                                    required
                                    placeholder="N°"
                                    className="w-20 bg-gray-50 px-3 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center"
                                    value={number}
                                    onChange={e => setNumber(e.target.value)}
                                />
                            </div>

                            <div className="flex gap-2">
                                <div className="relative flex-1">
                                    <Building className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Piso"
                                        className="w-full bg-gray-50 pl-10 pr-3 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                        value={floor}
                                        onChange={e => setFloor(e.target.value)}
                                    />
                                </div>
                                <div className="relative flex-1">
                                    <Home className="absolute left-3 top-3.5 text-gray-400" size={18} />
                                    <input
                                        type="text"
                                        placeholder="Depto"
                                        className="w-full bg-gray-50 pl-10 pr-3 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                        value={apt}
                                        onChange={e => setApt(e.target.value)}
                                    />
                                </div>
                                <input
                                    type="text"
                                    placeholder="CP"
                                    className="w-20 bg-gray-50 px-3 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center"
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

                            <button
                                type="submit"
                                disabled={loading || !termsAccepted}
                                className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-purple-700 active:scale-95 transition-all flex items-center justify-center gap-2 group mt-6 disabled:opacity-70 disabled:grayscale"
                            >
                                {loading ? 'Registrando...' : 'Finalizar Registro'}
                            </button>
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
        </div>
    );
};
