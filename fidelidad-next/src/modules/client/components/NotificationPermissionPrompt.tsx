import { useEffect, useState, useRef } from 'react';
import { Bell, Check, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface Props {
    user: any;
    userData: any;
    config: any;
    onNotificationGranted: () => void;
}

export const NotificationPermissionPrompt = ({ user, userData, config, onNotificationGranted }: Props) => {
    const [step, setStep] = useState<'none' | 'notifications' | 'geolocation'>('none');
    const hasCheckedInitial = useRef(false);

    const getIsMobile = () => {
        if (typeof window === 'undefined') return false;
        return (
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent)) ||
            window.innerWidth < 768
        );
    };
    const isMobile = getIsMobile();

    // 1. Sincronización Silenciosa de Tokens (Independiente del UI)
    useEffect(() => {
        if (!user || !userData) return;

        const checkSync = async () => {
            if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
                if (userData.permissions?.notifications?.status !== 'granted') {
                    await updatePermission('notifications', 'granted');
                }
                onNotificationGranted();
            }
        };
        checkSync();
    }, [user?.uid, !!userData]);

    const updatePermission = async (type: 'notifications' | 'geolocation', status: string, nextPrompt: number = 0) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);

        let deniedCount = userData?.permissions?.[type]?.deniedCount || 0;
        if (status === 'denied' || status === 'blocked') {
            deniedCount++;
        }

        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        let dismissedCount = userData?.permissions?.[type]?.[counterKey] || 0;
        let finalStatus = status;

        if (status === 'later') {
            dismissedCount++;
            const safeMessaging = config?.messaging || {};
            const maxPC = safeMessaging.maxLargePromptDismissalsPC ?? safeMessaging.maxLargePromptDismissals ?? 2;
            const maxMobile = safeMessaging.maxLargePromptDismissalsMobile ?? safeMessaging.maxLargePromptDismissals ?? 2;
            const maxAttempts = isMobile ? maxMobile : maxPC;

            if (dismissedCount >= maxAttempts) {
                finalStatus = 'dismissed';
                const standbyDays = safeMessaging.notificationPromptIntervalDays || 30;
                toast(`Entendido. Te volveremos a preguntar en ${standbyDays} días o podés activarlo desde tu perfil.`, {
                    icon: '⏳',
                    duration: 5000,
                    style: { borderRadius: '10px', background: '#333', color: '#fff' }
                });
            }
        }

        const updateData = {
            [`permissions.${type}.status`]: finalStatus,
            [`permissions.${type}.updatedAt`]: Date.now(),
            [`permissions.${type}.deniedCount`]: deniedCount,
            [`permissions.${type}.${counterKey}`]: dismissedCount,
            [`permissions.${type}.nextPrompt`]: nextPrompt
        };

        try {
            await updateDoc(ref, updateData);
        } catch (e) {
            console.error("Error updating permission:", e);
        }
    };

    const checkNextStep = async () => {
        // No corremos si la pestaña no está activa o no hay datos
        if (typeof window === 'undefined' || !userData) return;

        console.log('[PermissionPrompt] Running checkNextStep');

        const safeMessaging = config?.messaging || {};
        const isSessNotif = sessionStorage.getItem('dismissed_notif_prompt') === 'true';
        const isSessGeo = sessionStorage.getItem('dismissed_geo_prompt') === 'true';
        const permissions = userData?.permissions || {};

        // 1. Notificaciones
        const browserNotif = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
        const needsNotif = browserNotif === 'default' &&
            (permissions.notifications?.status === 'pending' || permissions.notifications?.status === 'later');

        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const notifAttempts = permissions.notifications?.[counterKey] || 0;
        const maxNotif = isMobile
            ? (safeMessaging.maxLargePromptDismissalsMobile ?? safeMessaging.maxLargePromptDismissals ?? 2)
            : (safeMessaging.maxLargePromptDismissalsPC ?? safeMessaging.maxLargePromptDismissals ?? 2);

        if (needsNotif && !isSessNotif && notifAttempts < maxNotif && safeMessaging.enableLargePrompt !== false) {
            console.log('[PermissionPrompt] Next: notifications');
            setStep('notifications');
            return;
        }

        // 2. Geolocalización (Solo Mobile)
        if (isMobile) {
            const geoStatus = permissions.geolocation?.status || 'pending';
            const geoAttempts = permissions.geolocation?.mobile_dismissedCount || 0;
            const maxGeo = safeMessaging.maxLargePromptDismissalsMobile ?? safeMessaging.maxLargePromptDismissals ?? 2;

            // En iOS, navigator.permissions.query a veces no existe. 
            // Si el estado en DB es pending/later y no lo descartamos en la sesión, preguntamos.
            const needsGeo = (geoStatus === 'pending' || geoStatus === 'later') && geoAttempts < maxGeo && geoStatus !== 'granted';

            if (needsGeo && !isSessGeo && safeMessaging.enableLargePrompt !== false) {
                console.log('[PermissionPrompt] Next: geolocation');
                setStep('geolocation');
                return;
            }
        }

        console.log('[PermissionPrompt] Next: none');
        setStep('none');
    };

    // Trigger Inicial (1.5s delay)
    useEffect(() => {
        if (!user || !userData || hasCheckedInitial.current) return;
        if (!userData.email && !userData.name) return; // Asegurar que userData está poblado

        hasCheckedInitial.current = true;
        const timer = setTimeout(() => {
            checkNextStep();
        }, 1500);

        return () => clearTimeout(timer);
    }, [user?.uid, !!userData]);

    const handleYes = async () => {
        const currentStep = step;
        setStep('none');

        if (currentStep === 'notifications') {
            if (typeof Notification === 'undefined') {
                toast.error('Gesto no soportado');
                return;
            }
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await updatePermission('notifications', 'granted');
                toast.success('¡Activado!');
                onNotificationGranted();
            } else {
                await updatePermission('notifications', 'later');
            }
            // Siguiente paso secuencial
            setTimeout(() => checkNextStep(), 800);
        } else if (currentStep === 'geolocation') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        await updatePermission('geolocation', 'granted');
                        await updateDoc(doc(db, 'users', user.uid), {
                            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date() }
                        });
                        toast.success('Ubicación activada');
                    },
                    async (err) => {
                        console.error('Geo error:', err);
                        await updatePermission('geolocation', 'later');
                    },
                    { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 }
                );
            }
        }
    };

    const handleLater = async () => {
        const type = step;
        setStep('none');
        sessionStorage.setItem(type === 'notifications' ? 'dismissed_notif_prompt' : 'dismissed_geo_prompt', 'true');
        await updatePermission(type as any, 'later');
        if (isMobile) localStorage.setItem('last_mobile_permission_dismissal', Date.now().toString());

        // Si fue notif, intentar geo después
        if (type === 'notifications') {
            setTimeout(() => checkNextStep(), 800);
        }
    };

    const handleNo = async () => {
        const type = step;
        setStep('none');
        await updatePermission(type as any, 'blocked');
        toast('Entendido. No te volveremos a molestar.', { icon: '🤝' });

        if (type === 'notifications') {
            setTimeout(() => checkNextStep(), 800);
        }
    };

    if (step === 'none') return null;

    const isGeo = step === 'geolocation';

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-md animate-fade-in font-sans">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden border border-gray-100">
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${isGeo ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>
                <div className="text-center relative z-10">
                    <div className={`w-20 h-20 mx-auto rounded-3xl shadow-xl flex items-center justify-center mb-6 transform rotate-3 ${isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-purple-600 text-white shadow-purple-200'}`}>
                        {isGeo ? <MapPin size={38} className="animate-bounce-slow" /> : <Bell size={38} className="animate-bounce-slow" />}
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 leading-tight mb-3 uppercase tracking-tight">
                        {isGeo ? 'Beneficios Locales' : 'Avisos y Premios'}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 px-2">
                        {isGeo ? 'Permítenos conocer tu zona para mostrarte beneficios y comercios más cercanos.' : 'Activa los avisos para enterarte al instante cuando sumes puntos o ganes un premio.'}
                    </p>
                    <div className="space-y-3">
                        <button onClick={handleYes} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-purple-600 text-white shadow-purple-200'}`}>
                            {isGeo ? 'Activar ahora' : 'Sí, activar avisos'}
                        </button>
                        <button onClick={handleLater} className="w-full py-4 text-xs font-black text-gray-400 border border-gray-100 rounded-2xl uppercase tracking-widest bg-gray-50/30">
                            Quizás luego
                        </button>
                        <button onClick={handleNo} className="w-full py-2 text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] hover:text-red-400 transition">
                            No me interesa, gracias
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
