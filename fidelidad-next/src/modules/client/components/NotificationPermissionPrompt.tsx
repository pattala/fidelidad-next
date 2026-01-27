import { useEffect, useState } from 'react';
import { Bell, X, Check, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface Props {
    user: any;
    userData: any;
    onNotificationGranted: () => void; // Callback cuando acepta notificaciones
}

export const NotificationPermissionPrompt = ({ user, userData, onNotificationGranted }: Props) => {
    const [step, setStep] = useState<'none' | 'terms' | 'notifications' | 'geolocation'>('none');
    const [isClosing, setIsClosing] = useState(false);

    useEffect(() => {
        if (!user || !userData) return;
        checkNextStep();
    }, [user, userData]); // Re-evaluar cuando cambie la data del usuario

    const checkNextStep = () => {
        // 0. Check Terms & Conditions (Strict First)
        if (!userData.termsAccepted) {
            setStep('terms');
            return;
        }

        // Estructura en DB: userData.permissions = { notifications: { status, ... }, geolocation: { status, ... } }
        const permissions = userData.permissions || {};

        // 1. Check Notifications
        const notifStatus = permissions.notifications?.status || 'pending';
        const notifNextPrompt = permissions.notifications?.nextPrompt || 0;
        const notifBlocked = notifStatus === 'blocked';
        const notifDenied = notifStatus === 'denied';

        // Validar si debemos mostrar prompt de notificaciones
        let showNotif = false;
        if (notifStatus === 'pending') showNotif = true;
        else if (notifStatus === 'later') showNotif = true; // "Ahora no" se resetea en cada sesión/carga
        else if (notifDenied && Date.now() > notifNextPrompt) showNotif = true;

        // Si el navegador ya tiene permiso, forzamos update en DB si no coincide
        if (Notification.permission === 'granted' && notifStatus !== 'granted') {
            updatePermission('notifications', 'granted');
            showNotif = false;
        } else if (Notification.permission === 'denied') {
            showNotif = false; // El navegador manda
        }

        if (showNotif && !notifBlocked && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            setStep('notifications');
            return;
        }

        // 2. Check Geolocation (Solo si ya pasamos notificaciones)
        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoNextPrompt = permissions.geolocation?.nextPrompt || 0;
        const geoBlocked = geoStatus === 'blocked';
        const geoDenied = geoStatus === 'denied';

        let showGeo = false;
        if (geoStatus === 'pending') showGeo = true;
        else if (geoStatus === 'later') showGeo = true;
        else if (geoDenied && Date.now() > geoNextPrompt) showGeo = true;

        if (showGeo && !geoBlocked) {
            // Verificar permiso nativo de geo es asíncrono, asumimos pending si no está guardado
            // Podríamos usar navigator.permissions.query pero para simplificar confiamos en el flujo
            setStep('geolocation');
            return;
        }

        setStep('none');
    };

    const updatePermission = async (type: 'notifications' | 'geolocation', status: string, nextPrompt: number = 0) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);

        // Calcular denied count si es necesario
        let deniedCount = 0;
        if (status === 'denied' || status === 'blocked') {
            const currentCount = userData?.permissions?.[type]?.deniedCount || 0;
            deniedCount = currentCount + 1;
        }

        const updateData = {
            [`permissions.${type}`]: {
                status,
                updatedAt: Date.now(),
                deniedCount: status === 'denied' || status === 'blocked' ? deniedCount : (userData?.permissions?.[type]?.deniedCount || 0),
                nextPrompt
            }
        };

        try {
            await updateDoc(ref, updateData);
        } catch (e) {
            console.error("Error updating permission:", e);
        }
    };

    const handleYes = async () => {
        if (step === 'terms') {
            try {
                // Registrar Aceptación
                await updateDoc(doc(db, 'users', user.uid), {
                    termsAccepted: true,
                    termsAcceptedAt: new Date(),
                    termsVersion: '1.0'
                });
                toast.success('¡Bienvenido a bordo!');
                // checkNextStep se disparará solo al actualizarse userData
            } catch (e) {
                console.error("Error accepting terms:", e);
                toast.error("Error de conexión");
            }
        } else if (step === 'notifications') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await updatePermission('notifications', 'granted');
                toast.success('¡Genial! Te avisaremos de ofertas.');
                onNotificationGranted();
                // El useEffect detectará el cambio en userData y pasará al siguiente step
            } else {
                // Usuario canceló en el browser
                await updatePermission('notifications', 'later');
            }
        } else if (step === 'geolocation') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (position) => {
                        await updatePermission('geolocation', 'granted');
                        await updateDoc(doc(db, 'users', user.uid), {
                            'lastLocation': {
                                lat: position.coords.latitude,
                                lng: position.coords.longitude,
                                timestamp: new Date()
                            }
                        });
                        toast.success('Ubicación activada.');
                    },
                    async (error) => {
                        console.error("Geo error:", error);
                        await updatePermission('geolocation', 'later'); // Tratamos error como 'later'
                    }
                );
            } else {
                await updatePermission('geolocation', 'blocked'); // No soportado
            }
        }
        // setIsClosing(true); setTimeout(() => { setStep('none'); setIsClosing(false); }, 300); // Animación opcional
    };

    const handleLater = async () => {
        if (step === 'notifications') await updatePermission('notifications', 'later');
        if (step === 'geolocation') await updatePermission('geolocation', 'later');
    };

    const handleNo = async () => {
        if (step === 'none') return;
        const type = step as 'notifications' | 'geolocation'; // Cast simple
        const currentCount = userData?.permissions?.[type]?.deniedCount || 0;
        const nextCount = currentCount + 1;

        if (nextCount >= 2) {
            await updatePermission(type, 'blocked');
            toast('Entendido. No te volveremos a molestar con esto.', { icon: 'silence' });
        } else {
            // 7 días de bloqueo
            const DAYS_TO_WAIT = 7;
            const nextDate = Date.now() + (DAYS_TO_WAIT * 24 * 60 * 60 * 1000);
            await updatePermission(type, 'denied', nextDate);
        }
    };

    if (step === 'none') return null;

    const isGeo = step === 'geolocation';
    const isTerms = step === 'terms';

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-scale-up relative overflow-hidden">

                {/* Decorative Background */}
                <div className={`absolute top-0 left-0 w-full h-24 bg-gradient-to-br ${isGeo ? 'from-green-100 to-emerald-50' : isTerms ? 'from-blue-100 to-blue-50' : 'from-purple-100 to-indigo-50'} -z-10`}></div>
                <div className={`w-24 h-24 ${isGeo ? 'bg-green-200' : isTerms ? 'bg-blue-200' : 'bg-purple-200'} rounded-full blur-2xl absolute -top-10 -right-10 opacity-50`}></div>

                <div className="text-center mb-6 pt-4">
                    <div className={`w-16 h-16 bg-white rounded-2xl shadow-lg mx-auto flex items-center justify-center mb-4 ${isGeo ? 'text-green-600' : isTerms ? 'text-blue-600' : 'text-purple-600'} relative`}>
                        {isGeo ? <MapPin size={32} className="animate-bounce-slow" /> : isTerms ? <Check size={32} /> : <Bell size={32} className="animate-bounce-slow" />}
                        {!isGeo && !isTerms && <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>}
                    </div>
                    <h3 className="text-xl font-black text-gray-800 leading-tight mb-2">
                        {isTerms ? 'Términos y Condiciones' : isGeo ? 'Mejora tu experiencia' : '¡No te pierdas nada!'}
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed px-2">
                        {isTerms
                            ? 'Para continuar usando la aplicación y disfrutar de los beneficios, debes aceptar nuestros términos y condiciones de uso.'
                            : isGeo
                                ? 'Activa la ubicación para ver las ofertas más cercanas a ti.'
                                : 'Activa las notificaciones para saber al instante cuando ganes premios o recibas promos exclusivas.'
                        }
                    </p>
                    {isTerms && (
                        <div className="mt-4 p-3 bg-gray-50 rounded-xl text-xs text-left h-32 overflow-y-auto border border-gray-100 text-gray-600">
                            <p className="font-bold mb-1">Resumen:</p>
                            <ul className="list-disc pl-4 space-y-1">
                                <li>Tus datos son privados y seguros.</li>
                                <li>Acumulas puntos por tus compras.</li>
                                <li>Los puntos tienen fecha de vencimiento.</li>
                                <li>Nos reservamos el derecho de admisión.</li>
                            </ul>
                        </div>
                    )}
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleYes}
                        className={`w-full py-3.5 bg-gradient-to-r ${isGeo ? 'from-green-600 to-emerald-600 shadow-green-200' : isTerms ? 'from-blue-600 to-blue-700 shadow-blue-200' : 'from-purple-600 to-indigo-600 shadow-purple-200'} text-white rounded-xl font-bold shadow-lg active:scale-[0.98] transition flex items-center justify-center gap-2`}
                    >
                        <Check size={20} />
                        {isTerms ? 'Aceptar y Continuar' : isGeo ? 'Activar Ubicación' : '¡Sí, activar ahora!'}
                    </button>

                    {!isTerms && (
                        <>
                            <button
                                onClick={handleLater}
                                className="w-full py-3 bg-white border-2 border-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition active:scale-[0.98]"
                            >
                                Ahora no (Próxima vez)
                            </button>

                            <button
                                onClick={handleNo}
                                className="w-full py-2 text-xs font-bold text-gray-400 hover:text-red-400 transition"
                            >
                                No me interesa
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
