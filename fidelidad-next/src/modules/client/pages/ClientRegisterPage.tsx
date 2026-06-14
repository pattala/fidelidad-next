import React, { useState, useEffect } from 'react';
import { ConfigService } from '../../../services/configService';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, getDocs, collection, onSnapshot, limit } from 'firebase/firestore';
import { Mail, Lock, User, Phone, ArrowLeft, ArrowRight, MapPin, Building, Home, Eye, EyeOff, X, Heart, Gift, Camera } from 'lucide-react';
import toast from 'react-hot-toast';
import { ARGENTINA_LOCATIONS } from '../../../data/locations';
import { EmailService } from '../../../services/emailService';
import { DEFAULT_TEMPLATES } from '../../../services/configService';
import { NotificationService } from '../../../services/notificationService';
import { TimeService } from '../../../services/timeService';
import type { AppConfig } from '../../../types';

export const ClientRegisterPage = () => {
    // Step 1: Personal Data
    const [name, setName] = useState('');
    const [dni, setDni] = useState('');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [phone, setPhone] = useState('');
    const [birthDate, setBirthDate] = useState('');
    const [photoBase64, setPhotoBase64] = useState<string | null>(null);
    const [showPass, setShowPass] = useState(false);

    // Step 2-3: Flow Control
    const [step, setStep] = useState(1);
    const [province, setProvince] = useState('');
    const [partido, setPartido] = useState('');
    const [localidad, setLocalidad] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [floor, setFloor] = useState('');
    const [apt, setApt] = useState('');
    const [cp, setCp] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);
    const [showTermsModal, setShowTermsModal] = useState(false);

    const [loading, setLoading] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const refCode = searchParams.get('ref');

    useEffect(() => {
        ConfigService.get().then(setConfig);
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

    const handlePhotoChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const MAX_WIDTH = 400;
                    const scaleSize = MAX_WIDTH / img.width;
                    canvas.width = MAX_WIDTH;
                    canvas.height = img.height * scaleSize;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);
                    const base64 = canvas.toDataURL('image/jpeg', 0.7);
                    setPhotoBase64(base64);
                };
                img.src = event.target?.result as string;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleNextStep = (e: React.FormEvent) => {
        e.preventDefault();
        if (pass.length < 6) {
            toast.error('La contraseña debe tener al menos 6 caracteres');
            return;
        }
        setStep(2);
    };

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!termsAccepted) {
            toast.error('¡Casi listo! Solo falta aceptar las reglas del club para crear tu cuenta.');
            return;
        }
        setLoading(true);

        try {
            const cleanPhone = phone.replace(/\D/g, '');
            const qPhone = query(collection(db, 'users'), where('phone_raw', '==', cleanPhone), limit(1));
            const snapPhone = await getDocs(qPhone);
            if (!snapPhone.empty) {
                toast.error('Ese número de teléfono ya está registrado.');
                setLoading(false);
                return;
            }

            const qDni = query(collection(db, 'users'), where('dni', '==', dni), limit(1));
            const snapDni = await getDocs(qDni);
            if (!snapDni.empty) {
                toast.error('Este DNI ya se encuentra registrado.');
                setLoading(false);
                return;
            }

            let inviterUid = null;
            if (refCode) {
                const qRef = query(collection(db, 'users'), where('referralCode', '==', refCode.toUpperCase()), limit(1));
                const snapRef = await getDocs(qRef);
                if (!snapRef.empty) inviterUid = snapRef.docs[0].id;
            }

            const myRefCode = `${name.split(' ')[0].toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
            const userCredential = await createUserWithEmailAndPassword(auth, email, pass);
            const user = userCredential.user;
            await updateProfile(user, { displayName: name });

            const finalPhone = `+549${cleanPhone}`;
            const fullAddress = `${street} ${number} ${floor ? 'Piso ' + floor : ''} ${apt ? 'Dpto ' + apt : ''}, ${localidad}, ${partido}, ${province}`.trim();

            const isAddressComplete = !!(province && localidad && street && number);
            const wBonus = (config?.enableWelcomeBonus && config?.welcomePoints) ? Number(config.welcomePoints) : 0;
            const aBonus = (config?.enableAddressBonus && config?.pointsForAddress && isAddressComplete) ? Number(config.pointsForAddress) : 0;
            const totalPoints = wBonus + aBonus;

            await setDoc(doc(db, 'users', user.uid), {
                name, nombre: name, dni, email, phone: finalPhone, phone_raw: cleanPhone,
                photoUrl: photoBase64,
                birthDate, authUID: user.uid,
                domicilio: {
                    status: isAddressComplete ? 'complete' : 'pending',
                    addressLine: isAddressComplete ? fullAddress : '',
                    components: { calle: street, numero: number, piso: floor, depto: apt, localidad, partido, provincia: province, zipCode: cp }
                },
                localidad: localidad || '', partido: partido || '', provincia: province || '', calle: street || '', numero: number || '', piso: floor || '', depto: apt || '', cp: cp || '',
                role: 'client', createdAt: TimeService.now(), fechaInscripcion: TimeService.now().toISOString(),
                points: 0, puntos: 0, accumulated_balance: 0,
                permissions: { notifications: { status: 'pending' }, geolocation: { status: 'pending' } },
                termsAccepted: true, termsAcceptedAt: TimeService.now().toISOString(),
                source: 'pwa', referralCode: myRefCode, referredBy: inviterUid,
                referralStats: { count: 0, pointsEarned: 0 },
                metadata: { createdFrom: 'pwa', version: '2.6-3step', bonusDetails: { welcome: wBonus, address: aBonus } }
            });

            const token = await user.getIdToken();
            const apiKey = import.meta.env.VITE_API_KEY;

            // Optional bonuses and emails (background)
            fetch('/api/users?action=assign-socio', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                body: JSON.stringify({ docId: user.uid, sendWelcome: true })
            }).catch(e => console.warn('Error post-registro:', e));

            toast.success('¡Cuenta creada con éxito!', { duration: 4000 });
            // Si el modulo pet esta activo, ir al paso 3 (registro mascota), si no, ir al inicio
            if (config?.enablePetModule) {
                setStep(3);
            } else {
                navigate('/');
            }
        } catch (error: any) {
            console.error(error);
            toast.error('Error al registrar: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const provinces = Object.keys(ARGENTINA_LOCATIONS);
    const availablePartidos = province ? Object.keys(ARGENTINA_LOCATIONS[province] || {}) : [];
    const availableLocalidades = (province && partido) ? (ARGENTINA_LOCATIONS[province][partido] || []) : [];

    return (
        <div className="min-h-[100dvh] w-full relative flex items-center justify-center overflow-hidden bg-gray-50 font-sans">
            {loading && (
                <div className="fixed inset-0 z-[200] bg-white/80 backdrop-blur-md flex flex-col items-center justify-center animate-fade-in">
                    <div className="relative w-24 h-24 mb-6">
                        <div className="absolute inset-0 border-4 border-purple-100 rounded-full"></div>
                        <div className="absolute inset-0 border-4 border-purple-600 rounded-full border-t-transparent animate-spin"></div>
                        <div className="absolute inset-0 flex items-center justify-center text-2xl">✨</div>
                    </div>
                    <h3 className="text-xl font-black text-gray-800 animate-pulse">Creando tu cuenta...</h3>
                </div>
            )}

            <div className="hidden sm:block absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse"></div>
            
            <div className="flex flex-col h-[100dvh] w-full max-w-md mx-auto sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-[3rem] sm:shadow-[0_0_80px_rgba(0,0,0,0.5)] relative transition-all duration-500 overflow-hidden z-10 bg-gray-50/90 backdrop-blur-3xl">
                <header className="flex-none p-4 flex items-center z-20 relative">
                    <button
                        onClick={() => step === 2 ? setStep(1) : step === 3 ? navigate('/') : navigate('/login')}
                        className="flex items-center justify-center gap-1.5 text-gray-700 font-bold text-sm bg-white/80 backdrop-blur-md px-4 py-2 rounded-full shadow-sm border border-gray-200/50"
                    >
                        <ArrowLeft size={16} /> {step === 3 ? 'Saltar' : 'Atrás'}
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto px-4 sm:px-6 pb-24 scrollbar-hide relative z-10 w-full animate-fade-in flex flex-col items-center">
                    <div className="w-full max-w-sm shrink-0 transition-all mx-auto pb-8">
                        <div className="mb-6 sm:mb-10 text-center">
                            <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white rounded-3xl mx-auto shadow-xl shadow-purple-500/10 flex items-center justify-center mb-2 transform -rotate-3 overflow-hidden p-2">
                                {config?.logoUrl ? <img src={config.logoUrl} alt="Logo" className="w-full h-full object-contain" /> : <span className="text-3xl">🚀</span>}
                            </div>
                            <h1 className="text-2xl font-black text-gray-800 tracking-tight">{config?.siteName || 'Club de Beneficios'}</h1>
                        </div>

                        <div className="bg-white p-6 sm:p-8 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 backdrop-blur-sm animate-fade-in">
                            <div className="mb-6 text-center">
                                <h2 className="text-lg font-bold text-gray-800">
                                    {step === 1 ? 'Completa tus Datos' : step === 2 ? '¡Potenciá tu cuenta! (Opcional)' : '¡Ya eres parte del Club! 🐾'}
                                </h2>
                                <div className="flex justify-center gap-2 mt-4">
                                    {(config?.enablePetModule ? [1, 2, 3] : [1, 2]).map(i => <div key={i} className={`h-1.5 w-8 rounded-full ${step === i ? 'bg-purple-600' : 'bg-gray-100'}`}></div>)}
                                </div>
                            </div>

                            {step === 1 ? (
                                <form onSubmit={handleNextStep} className="space-y-4">
                                    <div className="relative">
                                        <User className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                        <input type="text" required placeholder="Nombre Completo" className="w-full bg-gray-50 pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none transition-all" value={name} onChange={e => setName(e.target.value)} />
                                    </div>
                                    <div className="relative">
                                        <Phone className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                        <input type="tel" required placeholder="Celular (Ej: 11 5555 5555)" className="w-full bg-gray-50 pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium placeholder-gray-500 border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none transition-all" value={phone} onChange={e => setPhone(e.target.value)} />
                                    </div>
                                    <div className="relative">
                                        <Building className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                        <input type="text" required placeholder="DNI" className="w-full bg-gray-50 pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none transition-all" value={dni} onChange={e => setDni(e.target.value.replace(/\D/g, ''))} />
                                    </div>
                                    <div className="relative">
                                        <Mail className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                        <input type="email" required placeholder="Email" className="w-full bg-gray-50 pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none transition-all" value={email} onChange={e => setEmail(e.target.value)} />
                                    </div>
                                    <div className="relative">
                                        <Gift className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                        <input
                                            type="date"
                                            className="w-full bg-gray-50 pl-11 pr-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none transition-all text-gray-500"
                                            value={birthDate}
                                            onChange={e => setBirthDate(e.target.value)}
                                            placeholder="Fecha de nacimiento"
                                        />
                                        {!birthDate && <span className="absolute left-11 top-3.5 text-gray-400 text-sm font-medium pointer-events-none">Fecha de nacimiento</span>}
                                    </div>
                                    <div className="relative">
                                        <Lock className="absolute left-4 top-3.5 text-gray-400" size={18} />
                                        <input type={showPass ? "text" : "password"} required placeholder="Contraseña (min 6 chars)" className="w-full bg-gray-50 pl-11 pr-11 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none transition-all" value={pass} onChange={e => setPass(e.target.value)} />
                                        <button type="button" onClick={() => setShowPass(!showPass)} className="absolute right-4 top-3.5 text-gray-400 hover:text-purple-600">
                                            {showPass ? <EyeOff size={18} /> : <Eye size={18} />}
                                        </button>
                                    </div>
                                    <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm shadow-lg active:scale-95 transition-all flex items-center justify-center gap-2">
                                        Continuar <ArrowRight size={18} />
                                    </button>
                                </form>
                            ) : step === 2 ? (
                                <form onSubmit={handleRegister} className="space-y-4">
                                    {config?.enableAddressBonus && (
                                        <div className="bg-purple-50 border border-purple-100 rounded-2xl p-4 mb-2 flex flex-col gap-2 animate-fade-in">
                                            <div className="flex items-center gap-4">
                                                <div className="bg-white p-2 rounded-xl shadow-sm text-2xl">🎁</div>
                                                <div className="text-left">
                                                    <p className="text-[10px] font-black text-purple-600 uppercase tracking-widest">¡Mejorá tu Bienvenida!</p>
                                                    <p className="text-xs font-bold text-purple-900 leading-tight">
                                                        No es obligatorio cargar tu dirección ahora. Pero si lo hacés, sumás <span className="text-indigo-600 font-black">{config.pointsForAddress || 50} puntos extra</span>, recibís ofertas en tu zona y participás de <span className="text-purple-600 font-black">sorteos de premios</span>.
                                                    </p>
                                                </div>
                                            </div>
                                            <p className="text-[10px] text-gray-400 italic text-center border-t border-purple-100 pt-2 mt-1">
                                                ¿Tenés prisa? Podés saltear este paso y completarlo luego en tu Perfil.
                                            </p>
                                        </div>
                                    )}

                                    <div className="space-y-2">
                                        <select value={province} onChange={e => { setProvince(e.target.value); setPartido(''); setLocalidad(''); }} className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none">
                                            <option value="">Provincia</option>
                                            {provinces.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <select value={partido} onChange={e => { setPartido(e.target.value); setLocalidad(''); }} disabled={!province} className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none disabled:opacity-50">
                                            <option value="">Partido/Departamento</option>
                                            {availablePartidos.map(p => <option key={p} value={p}>{p}</option>)}
                                        </select>
                                        <select value={localidad} onChange={e => setLocalidad(e.target.value)} disabled={!partido} className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none disabled:opacity-50">
                                            <option value="">Localidad/Barrio</option>
                                            {availableLocalidades.map(l => <option key={l} value={l}>{l}</option>)}
                                        </select>
                                    </div>
                                    <div className="flex gap-2">
                                        <input type="text" placeholder="Calle" className="flex-1 bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none" value={street} onChange={e => setStreet(e.target.value)} />
                                        <input type="text" placeholder="N°" className="w-20 bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center" value={number} onChange={e => setNumber(e.target.value)} />
                                    </div>
                                    <div className="grid grid-cols-3 gap-2">
                                        <input type="text" placeholder="Piso" className="bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center" value={floor} onChange={e => setFloor(e.target.value)} />
                                        <input type="text" placeholder="Depto" className="bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center" value={apt} onChange={e => setApt(e.target.value)} />
                                        <input type="text" placeholder="CP" className="bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none text-center" value={cp} onChange={e => setCp(e.target.value)} />
                                    </div>
                                    <div className="flex items-center gap-2 pt-2">
                                        <input type="checkbox" id="terms" required checked={termsAccepted} onChange={e => setTermsAccepted(e.target.checked)} className="w-5 h-5 rounded border-gray-300 text-purple-600" />
                                        <label htmlFor="terms" className="text-xs text-gray-600 font-medium">Acepto las <button type="button" onClick={() => setShowTermsModal(true)} className="font-bold text-purple-600 hover:underline">Reglas del Club (TyC)</button></label>
                                    </div>
                                    <button type="submit" disabled={loading} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg shadow-purple-200 hover:bg-purple-700 transition-all">
                                        {loading ? 'Registrando...' : 'Finalizar y ganar mis puntos'}
                                    </button>
                                    <button type="button" onClick={handleRegister} className="w-full text-center text-[10px] font-bold text-gray-400 uppercase tracking-widest hover:text-purple-600 transition pt-2">
                                        Registrarme ahora sin los puntos extra
                                    </button>
                                </form>
                            ) : (
                                <div className="text-center py-4 animate-fade-in">
                                    <div className="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-6 text-purple-600 shadow-inner">
                                        <Heart size={40} className="animate-pulse" />
                                    </div>
                                    <h2 className="text-xl font-black text-gray-800 mb-2 leading-tight">¡Genial {name.split(' ')[0]}!</h2>
                                    <p className="text-sm text-gray-600 leading-relaxed mb-8">¿Tienes mascotas? Regístralas ahora para recibir <strong>avisos de alimento</strong> y promos exclusivas.</p>
                                    <div className="space-y-3">
                                        <button onClick={() => navigate('/perfil?addPet=true')} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold hover:bg-purple-700 transition-all flex items-center justify-center gap-2">+ Registrar Mascota</button>
                                        <button onClick={() => navigate('/')} className="w-full bg-gray-100 text-gray-600 py-4 rounded-2xl font-bold hover:bg-gray-200 transition-all">Ir al Inicio</button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </main>
            </div>

            {showTermsModal && (
                <div className="fixed inset-0 z-[300] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in uppercase">
                    <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-black text-gray-800">Reglas del Club</h3>
                            <button onClick={() => setShowTermsModal(false)} className="p-2 hover:bg-gray-100 rounded-full transition"><X size={20} className="text-gray-400" /></button>
                        </div>
                        <div className="flex-1 overflow-y-auto text-[10px] leading-relaxed text-gray-500 scrollbar-hide">
                            {(config?.contact?.termsContent || 'Términos y condiciones estándar.')
                                .replace(/{siteName}/gi, config?.siteName || 'el Club')
                                .replace(/{SITENAME}/gi, config?.siteName || 'el Club')}
                        </div>
                        <button onClick={() => { setTermsAccepted(true); setShowTermsModal(false); }} className="w-full bg-purple-600 text-white py-4 rounded-2xl font-bold text-sm shadow-lg mt-6">Aceptar</button>
                    </div>
                </div>
            )}
        </div>
    );
};
