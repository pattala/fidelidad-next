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
    const [step, setStep] = useState<'none' | 'notifications' | 'geolocation'>('none');
    const [config, setConfig] = useState<any>(null);

    // Bandera de sesión para no ser insistentes en la misma visita si eligen "Quizás luego"
    const [sessionDismissedNotif, setSessionDismissedNotif] = useState(false);
    const [sessionDismissedGeo, setSessionDismissedGeo] = useState(false);

    useEffect(() => {
        setSessionDismissedNotif(sessionStorage.getItem('dismissed_notif_prompt') === 'true');
        setSessionDismissedGeo(sessionStorage.getItem('dismissed_geo_prompt') === 'true');
    }, []);

    useEffect(() => {
        const loadConfig = async () => {
            const { ConfigService } = await import('../../../services/configService');
            ConfigService.get().then(setConfig);
        };
        loadConfig();
    }, []);

    useEffect(() => {
        if (!user || !userData) return;

        // Retraso de cortesía para un "logueo limpio"
        const timer = setTimeout(() => {
            checkNextStep();
        }, 1500);

        return () => clearTimeout(timer);
    }, [user, userData]);

    const checkNextStep = () => {
        // Leer siempre directo de sessionStorage para evitar stale state
        const isDismissedNotif = sessionStorage.getItem('dismissed_notif_prompt') === 'true';
        const isDismissedGeo = sessionStorage.getItem('dismissed_geo_prompt') === 'true';

        const permissions = userData?.permissions || {};

        // 1. Check Notifications
        const notifStatus = permissions.notifications?.status || 'pending';
        const notifNextPrompt = permissions.notifications?.nextPrompt || 0;
        const notifBlocked = notifStatus === 'blocked';

        // Auto-sincronizar si el navegador ya tiene el permiso concedido o denegado
        if (Notification.permission === 'granted' && notifStatus !== 'granted') {
            updatePermission('notifications', 'granted');
            // No mostramos nada para notif, pasamos a geo
        } else if (Notification.permission === 'denied') {
            // El navegador lo bloqueó, no preguntar
        } else {
            // Lógica simple: 
            // 'pending' o 'later' → siempre mostrar (es la 1ra o 2da oportunidad)
            // 'dismissed' → solo si pasaron los días configurados
            let showNotif = false;
            if (notifStatus === 'pending' || notifStatus === 'later') {
                showNotif = true;
            } else if (notifStatus === 'dismissed' && Date.now() > notifNextPrompt) {
                showNotif = true;
            } else if (notifStatus === 'denied' && Date.now() > notifNextPrompt) {
                showNotif = true;
            }

            if (showNotif && !isDismissedNotif && !notifBlocked) {
                setStep('notifications');
                return;
            }
        }

        // 2. Check Geolocation
        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoNextPrompt = permissions.geolocation?.nextPrompt || 0;
        const geoBlocked = geoStatus === 'blocked';

        let showGeo = false;
        if (geoStatus === 'pending' || geoStatus === 'later') {
            showGeo = true;
        } else if (geoStatus === 'dismissed' && Date.now() > geoNextPrompt) {
            showGeo = true;
        } else if (geoStatus === 'denied' && Date.now() > geoNextPrompt) {
            showGeo = true;
        }

        if (showGeo && !isDismissedGeo && !geoBlocked) {
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
        if (step === 'notifications') {
            const permission = await Notification.requestPermission();
            setStep('none'); // Close immediately for better UX
            if (permission === 'granted') {
                await updatePermission('notifications', 'granted');
                toast.success('¡Genial! Te avisaremos de ofertas.');
                onNotificationGranted();
            } else {
                await updatePermission('notifications', 'later');
            }
        } else if (step === 'geolocation') {
            if ('geolocation' in navigator) {
                setStep('none'); // Close immediately for better UX
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
                        await updatePermission('geolocation', 'dismissed');
                    }
                );
            } else {
                await updatePermission('geolocation', 'blocked');
            }
        }
    };

    const handleLater = async () => {
        const type = step as 'notifications' | 'geolocation';
        setStep('none'); // Close immediately

        // Bloqueo temporal por sesión para no molestar en la misma visita
        if (type === 'notifications') {
            sessionStorage.setItem('dismissed_notif_prompt', 'true');
            setSessionDismissedNotif(true);
        } else {
            sessionStorage.setItem('dismissed_geo_prompt', 'true');
            setSessionDismissedGeo(true);
        }

        // Sistema 2-strikes:
        // - 1er "Quizás luego" → 'later' (vuelve a aparecer la próxima sesión)
        // - 2do "Quizás luego" (ya estaba en 'later') → 'dismissed' + standby real
        const currentStatus = userData?.permissions?.[type]?.status;
        if (currentStatus === 'later') {
            const days = config?.messaging?.notificationPromptIntervalDays || 30;
            const nextPrompt = Date.now() + (days * 24 * 60 * 60 * 1000);
            await updatePermission(type, 'dismissed', nextPrompt);
        } else {
            // Primer descarte → simplemente lo marcamos para reintentar la próxima sesión
            await updatePermission(type, 'later', 0);
        }

        // Si acaba de descartar notificaciones, ver si hay que mostrar geo
        if (type === 'notifications') {
            setTimeout(() => checkNextStep(), 800);
        }
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

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden border border-gray-100 italic-none">

                {/* Decoration */}
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${isGeo ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>

                <div className="text-center relative z-10">
                    <div className={`w-20 h-20 mx-auto rounded-3xl shadow-xl flex items-center justify-center mb-6 transform rotate-3 transition-transform hover:rotate-0 duration-500 ${isGeo ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white shadow-purple-200'}`}>
                        {isGeo ? <MapPin size={38} className="animate-bounce-slow" /> : <Bell size={38} className="animate-bounce-slow" />}
                    </div>

                    <h3 className="text-2xl font-black text-gray-800 leading-tight mb-3 px-2 italic-none uppercase tracking-tight">
                        {isGeo ? 'Beneficios Locales' : 'Avisos y Premios'}
                    </h3>

                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 px-2">
                        {isGeo
                            ? 'Descubre al instante promociones secretas y descuentos exclusivos cerca tuyo.'
                            : 'Entérate antes que nadie de tus puntos acumulados, regalos sorpresa y promociones pensadas para vos.'}
                    </p>

                    <div className="space-y-3">
                        <button
                            onClick={handleYes}
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-purple-600 text-white shadow-purple-200'}`}
                        >
                            <Check size={16} strokeWidth={3} />
                            {isGeo ? 'Activar ahora' : 'Sí, avisar de premios'}
                        </button>

                        <button
                            onClick={handleLater}
                            className="w-full py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition"
                        >
                            Quizás luego
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
