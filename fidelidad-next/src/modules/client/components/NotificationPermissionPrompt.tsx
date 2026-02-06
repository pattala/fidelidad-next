import { useEffect, useState } from 'react';
import { Bell, X, Check, MapPin, ScrollText, ShieldCheck } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface Props {
    user: any;
    userData: any;
    onNotificationGranted: () => void;
}

export const NotificationPermissionPrompt = ({ user, userData, onNotificationGranted }: Props) => {
    const [step, setStep] = useState<'none' | 'terms' | 'notifications' | 'geolocation'>('none');

    useEffect(() => {
        if (!user || !userData) return;
        checkNextStep();
    }, [user, userData]);

    const checkNextStep = () => {
        if (!userData.termsAccepted) {
            setStep('terms');
            return;
        }

        const permissions = userData.permissions || {};

        // 1. Check Notifications
        const notifStatus = permissions.notifications?.status || 'pending';
        const notifNextPrompt = permissions.notifications?.nextPrompt || 0;
        const notifBlocked = notifStatus === 'blocked';
        const notifDenied = notifStatus === 'denied';

        let showNotif = false;
        if (notifStatus === 'pending') showNotif = true;
        else if (notifStatus === 'later') showNotif = true;
        else if (notifDenied && Date.now() > notifNextPrompt) showNotif = true;

        if (Notification.permission === 'granted' && notifStatus !== 'granted') {
            updatePermission('notifications', 'granted');
            showNotif = false;
        } else if (Notification.permission === 'denied') {
            showNotif = false;
        }

        if (showNotif && !notifBlocked && Notification.permission !== 'granted' && Notification.permission !== 'denied') {
            setStep('notifications');
            return;
        }

        // 2. Check Geolocation
        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoNextPrompt = permissions.geolocation?.nextPrompt || 0;
        const geoBlocked = geoStatus === 'blocked';
        const geoDenied = geoStatus === 'denied';

        let showGeo = false;
        if (geoStatus === 'pending') showGeo = true;
        else if (geoStatus === 'later') showGeo = true;
        else if (geoDenied && Date.now() > geoNextPrompt) showGeo = true;

        if (showGeo && !geoBlocked) {
            setStep('geolocation');
            return;
        }

        setStep('none');
    };

    const updatePermission = async (type: 'notifications' | 'geolocation', status: string, nextPrompt: number = 0) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);

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
                await updateDoc(doc(db, 'users', user.uid), {
                    termsAccepted: true,
                    termsAcceptedAt: new Date(),
                    termsVersion: '1.0'
                });
                toast.success('¡Bienvenido a bordo!');
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
            } else {
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
                        await updatePermission('geolocation', 'later');
                    }
                );
            } else {
                await updatePermission('geolocation', 'blocked');
            }
        }
    };

    const handleLater = async () => {
        if (step === 'notifications') await updatePermission('notifications', 'later');
        if (step === 'geolocation') await updatePermission('geolocation', 'later');
    };

    const handleNo = async () => {
        if (step === 'none') return;
        const type = step as 'notifications' | 'geolocation';
        const currentCount = userData?.permissions?.[type]?.deniedCount || 0;
        const nextCount = currentCount + 1;

        if (nextCount >= 2) {
            await updatePermission(type, 'blocked');
            toast('Entendido. No te volveremos a molestar con esto.', { icon: 'silence' });
        } else {
            const DAYS_TO_WAIT = 7;
            const nextDate = Date.now() + (DAYS_TO_WAIT * 24 * 60 * 60 * 1000);
            await updatePermission(type, 'denied', nextDate);
        }
    };

    if (step === 'none') return null;

    const isGeo = step === 'geolocation';
    const isTerms = step === 'terms';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden border border-gray-100 italic-none">

                {/* Decoration */}
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${isTerms ? 'bg-blue-500' : isGeo ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>

                <div className="text-center relative z-10">
                    <div className={`w-20 h-20 mx-auto rounded-3xl shadow-xl flex items-center justify-center mb-6 transform rotate-3 transition-transform hover:rotate-0 duration-500 ${isTerms ? 'bg-blue-600 text-white' : isGeo ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white shadow-purple-200'}`}>
                        {isTerms ? <ScrollText size={38} /> : isGeo ? <MapPin size={38} className="animate-bounce-slow" /> : <Bell size={38} className="animate-bounce-slow" />}
                    </div>

                    <h3 className="text-2xl font-black text-gray-800 leading-tight mb-3 px-2 italic-none uppercase tracking-tight">
                        {isTerms ? 'Términos de Uso' : isGeo ? 'Ubicación' : 'Notificaciones'}
                    </h3>

                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 px-2">
                        {isTerms
                            ? 'Antes de empezar, necesitamos que aceptes nuestras bases para proteger tu cuenta y puntos.'
                            : isGeo
                                ? 'Permítenos conocer tu zona para mostrarte beneficios y comercios más cercanos.'
                                : 'Activa los avisos para enterarte al instante cuando sumes puntos o ganes un premio.'}
                    </p>

                    {isTerms && (
                        <div className="bg-gray-50/80 rounded-3xl p-5 text-left text-[11px] h-48 overflow-y-auto border border-gray-100 mb-8 scrollbar-hide">
                            <div className="flex items-center gap-2 mb-4 text-blue-600">
                                <ShieldCheck size={16} />
                                <span className="font-black uppercase tracking-widest">Resumen de Contrato</span>
                            </div>
                            <div className="space-y-4 text-gray-600 font-medium">
                                <p><span className="font-bold text-gray-800">1. Privacidad:</span> Sus datos personales son tratados con protocolos de seguridad bancaria y no se comparten con terceros.</p>
                                <p><span className="font-bold text-gray-800">2. Puntos:</span> La acumulación de puntos está sujeta a la validación de la compra por parte del comercio.</p>
                                <p><span className="font-bold text-gray-800">3. Vencimiento:</span> Los puntos tienen una validez de 365 días desde su obtención, salvo campañas especiales.</p>
                                <p><span className="font-bold text-gray-800">4. Uso:</span> La cuenta es personal e intransferible. El uso indebido causará la baja del socio.</p>
                                <p><span className="font-bold text-gray-800">5. Modificaciones:</span> La empresa se reserva el derecho de modificar la tabla de premios avisando con 30 días.</p>
                            </div>
                        </div>
                    )}

                    <div className="space-y-3">
                        <button
                            onClick={handleYes}
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isTerms ? 'bg-blue-600 text-white shadow-blue-200' : isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-purple-600 text-white shadow-purple-200'}`}
                        >
                            <Check size={16} strokeWidth={3} />
                            {isTerms ? 'Acepto y Continuar' : isGeo ? 'Activar ahora' : 'Sí, avisar de premios'}
                        </button>

                        {!isTerms && (
                            <button
                                onClick={handleLater}
                                className="w-full py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition"
                            >
                                Quizás luego
                            </button>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
