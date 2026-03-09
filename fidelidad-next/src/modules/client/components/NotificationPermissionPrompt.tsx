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

    const updatePermission = async (type: 'notifications' | 'geolocation', status: string, nextPrompt: number = 0) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);

        let deniedCount = userData?.permissions?.[type]?.deniedCount || 0;
        if (status === 'denied' || status === 'blocked') {
            deniedCount++;
        }

        let largeDismissCount = userData?.permissions?.[type]?.largeDismissCount || 0;
        let finalStatus = status;

        if (status === 'later') {
            largeDismissCount++;
            // Transition to 'dismissed' (Phase 2 ready) once large attempts are exhausted
            const maxAttempts = config?.messaging?.maxLargePromptDismissals ?? 2;
            if (largeDismissCount >= maxAttempts) {
                finalStatus = 'dismissed';
            }
        }

        const updateData = {
            [`permissions.${type}.status`]: finalStatus,
            [`permissions.${type}.updatedAt`]: Date.now(),
            [`permissions.${type}.deniedCount`]: deniedCount,
            [`permissions.${type}.largeDismissCount`]: largeDismissCount,
            [`permissions.${type}.nextPrompt`]: nextPrompt
        };

        try {
            await updateDoc(ref, updateData);
        } catch (e) {
            console.error("Error updating permission:", e);
        }
    };

    const checkNextStep = async () => {
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
            await updatePermission('notifications', 'granted');
        }

        // Si ya pasó el standby global (30 días), reiniciamos el ciclo para volver a preguntar el grande
        if ((notifStatus === 'dismissed' || notifStatus === 'denied') && notifNextPrompt > 0 && Date.now() >= notifNextPrompt) {
            await updatePermission('notifications', 'pending', 0);
            return;
        }

        const isNotifAvailable = typeof Notification !== 'undefined' && Notification.permission === 'default';
        const largeNotifDismissCount = permissions.notifications?.largeDismissCount || 0;
        const maxLargeAttempts = config?.messaging?.maxLargePromptDismissals ?? 2;

        // Fase 1 (Grande): Solo sale si es 'pending' o 'later' (dentro de los re-intentos).
        // Una vez que pasa a 'dismissed', ya es el turno de los contextuales (Fase 2) en ClientHomePage.
        const canShowLargeNotif = (notifStatus === 'pending') || (notifStatus === 'later' && largeNotifDismissCount < maxLargeAttempts);

        if (isNotifAvailable && canShowLargeNotif && !isDismissedNotif && !notifBlocked) {
            setStep('notifications');
            return;
        }

        // 2. Check Geolocation
        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoNextPrompt = permissions.geolocation?.nextPrompt || 0;
        const geoBlocked = geoStatus === 'blocked';

        // Reinicio de ciclo standby geo
        if ((geoStatus === 'dismissed' || geoStatus === 'denied') && geoNextPrompt > 0 && Date.now() >= geoNextPrompt) {
            await updatePermission('geolocation', 'pending', 0);
            return;
        }

        const largeGeoDismissCount = permissions.geolocation?.largeDismissCount || 0;
        const maxLargeGeoAttempts = config?.messaging?.maxLargePromptDismissals ?? 2;
        const canShowLargeGeo = (geoStatus === 'pending') || (geoStatus === 'later' && largeGeoDismissCount < maxLargeGeoAttempts);

        if (canShowLargeGeo && !isDismissedGeo && !geoBlocked) {
            setStep('geolocation');
            return;
        }

        setStep('none');
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
                // Si rechaza el nativo, lo tratamos como 'later' para que no bloquee pero ya no sea 'pending'
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
                        // Si falla o rechaza nativo, lo mandamos a 'later' para intentar contextual luego
                        await updatePermission('geolocation', 'later');
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

        // Marcamos como 'later' para que el cartel grande ya no salga esta vuelta
        // y le de paso a los carteles chicos (contextuales).
        await updatePermission(type, 'later', 0);

        // Si acaba de descartar notificaciones, ver si hay que mostrar geo
        if (type === 'notifications') {
            setTimeout(() => checkNextStep(), 800);
        }
    };


    const handleNo = async () => {
        if (step === 'none') return;
        const type = step as 'notifications' | 'geolocation';
        setStep('none'); // Cerrar inmediatamente

        const currentCount = userData?.permissions?.[type]?.deniedCount || 0;
        const nextCount = currentCount + 1;
        const standbyDays = config?.messaging?.notificationPromptIntervalDays || 30;

        if (nextCount >= 2) {
            await updatePermission(type, 'blocked');
            toast('Entendido. No te volveremos a molestar con esto.', {
                icon: '🔇',
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
        } else {
            const nextDate = Date.now() + (standbyDays * 24 * 60 * 60 * 1000);
            await updatePermission(type, 'denied', nextDate);
            toast(`Entendido. Te volveremos a consultar en ${standbyDays} días.`, {
                icon: '⏳',
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
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
                            className="w-full py-4 text-xs font-black text-gray-400 border border-gray-100 rounded-2xl uppercase tracking-widest hover:text-gray-600 transition bg-gray-50/30"
                        >
                            Quizás luego
                        </button>

                        <button
                            onClick={handleNo}
                            className="w-full py-2 text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] hover:text-red-400 transition"
                        >
                            No me interesa, gracias
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
