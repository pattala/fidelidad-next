import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { createUserWithEmailAndPassword, updateProfile, signInWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, getDoc, query, where, getDocs, collection } from 'firebase/firestore';
import { Mail, Lock, User, Phone, ArrowLeft, ArrowRight, MapPin, Building, Home } from 'lucide-react';
import toast from 'react-hot-toast';
import { PARTIDOS_BUENOS_AIRES, BA_LOCALIDADES_BY_PARTIDO } from '../../../lib/geoData';

export const ClientRegisterPage = () => {
    // Step 1: Personal Data
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [pass, setPass] = useState('');
    const [phone, setPhone] = useState('');

    // Step 2: Address Data
    const [step, setStep] = useState(1);
    const [province, setProvince] = useState('Buenos Aires'); // Default
    const [partido, setPartido] = useState('');
    const [localidad, setLocalidad] = useState('');
    const [street, setStreet] = useState('');
    const [number, setNumber] = useState('');
    const [floor, setFloor] = useState('');
    const [apt, setApt] = useState('');
    const [termsAccepted, setTermsAccepted] = useState(false);

    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

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
            const qPhone = query(collection(db, 'users'), where('phone_raw', '==', cleanPhone)); // Usar versión limpia para búsqueda

            // Verificación asíncrona paralela
            const snapPhone = await getDocs(qPhone);

            if (!snapPhone.empty) {
                toast.error('Ese número de teléfono ya está registrado.');
                setLoading(false);
                return;
            }

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
            const fullAddress = `${street} ${number} ${floor ? 'Piso ' + floor : ''} ${apt ? 'Dpto ' + apt : ''}, ${localidad}, ${partido}, ${province}`;

            // Datos base del sistema antiguo + nuevo
            await setDoc(doc(db, 'users', user.uid), {
                name: name,
                email: email,
                phone: finalPhone, // Guardar normalizado
                phone_raw: cleanPhone, // Guardar crudo para búsquedas fáciles
                authUID: user.uid, // Backup ID
                // Dirección estructurada
                domicilio: {
                    calle: street,
                    numero: number,
                    piso: floor,
                    depto: apt,
                    localidad: localidad,
                    partido: partido,
                    provincia: province,
                    formatted_address: fullAddress
                },
                // Campos Legacy para compatibilidad
                calle: street,
                numero: number,
                localidad: localidad,
                partido: partido,
                provincia: province,
                formatted_address: fullAddress,

                role: 'client',
                createdAt: new Date(),
                fechaInscripcion: new Date().toISOString(), // Legacy

                points: 0,
                accumulated_balance: 0,

                permissions: {
                    notifications: { status: 'pending' },
                    geolocation: { status: 'pending' }
                },
                termsAccepted: true,
                termsAcceptedAt: new Date().toISOString(),
                source: 'pwa',
                metadata: { createdFrom: 'pwa', version: '2.1-strict' }
            });

            // 4. Llamadas al Backend (Serverless APIs) para finalización robusta
            // Obtener token para autenticar con el backend
            const token = await user.getIdToken();
            const apiKey = import.meta.env.VITE_API_KEY || 'Felipe01';

            // A. Asignar N° Socio (Secuencial seguro)
            fetch('/api/assign-socio-number', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                body: JSON.stringify({ docId: user.uid })
            }).catch(e => console.warn('Error asignando socio:', e));

            // B. Asignar Puntos de Bienvenida
            fetch('/api/assign-points', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'x-api-key': apiKey },
                body: JSON.stringify({ reason: 'welcome_signup' })
            }).catch(e => console.warn('Error asignando puntos:', e));

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
    const availableLocalidades = partido ? (BA_LOCALIDADES_BY_PARTIDO[partido] || []) : [];

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-6 relative overflow-hidden">
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

                <div className="bg-white p-8 rounded-[2rem] shadow-xl shadow-gray-200/50 border border-gray-100 backdrop-blur-sm animate-fade-in">
                    <div className="mb-6 text-center">
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
                            <button type="submit" className="w-full bg-gray-900 text-white py-4 rounded-2xl font-bold text-sm shadow-lg hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 group mt-4">
                                Continuar <ArrowRight size={18} />
                            </button>
                        </form>
                    ) : (
                        <form onSubmit={handleRegister} className="space-y-4">
                            <div className="space-y-2">
                                <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Zona</label>
                                <select
                                    value={partido}
                                    onChange={e => { setPartido(e.target.value); setLocalidad(''); }}
                                    required
                                    className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none"
                                >
                                    <option value="">Selecciona Partido</option>
                                    {PARTIDOS_BUENOS_AIRES.map(p => <option key={p} value={p}>{p}</option>)}
                                </select>
                                <select
                                    value={localidad}
                                    onChange={e => setLocalidad(e.target.value)}
                                    required
                                    disabled={!partido}
                                    className="w-full bg-gray-50 px-4 py-3.5 rounded-2xl text-sm font-medium border-2 border-transparent focus:bg-white focus:border-purple-200 outline-none disabled:opacity-50"
                                >
                                    <option value="">Selecciona Localidad</option>
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
                                    Acepto los <a href="#" className="font-bold text-purple-600 hover:underline">Términos y Condiciones</a> y la <a href="#" className="font-bold text-purple-600 hover:underline">Política de Privacidad</a>
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
        </div>
    );
};
