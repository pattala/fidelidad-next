import { useEffect, useState } from 'react';
import { Bell, Check, MapPin } from 'lucide-react';
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

    // Sesión
    const [sessionDismissedNotif, setSessionDismissedNotif] = useState(false);
    const [sessionDismissedGeo, setSessionDismissedGeo] = useState(false);

    const getIsMobile = () => {
        if (typeof window === 'undefined') return false;
        return (
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent)) ||
            window.innerWidth < 768
        );
    };
    const isMobile = getIsMobile();

    useEffect(() => {
        const isSessNotif = sessionStorage.getItem('dismissed_notif_prompt') === 'true';
        const isSessGeo = sessionStorage.getItem('dismissed_geo_prompt') === 'true';
        setSessionDismissedNotif(isSessNotif);
        setSessionDismissedGeo(isSessGeo);

        if (isMobile) {
            const lastDismissal = localStorage.getItem('last_mobile_permission_dismissal');
            if (lastDismissal) {
                const hoursPassed = (Date.now() - parseInt(lastDismissal)) / (1000 * 60 * 60);
                const cooldown = config?.messaging?.mobileCooldownHours ?? 24;
                if (cooldown > 0 && hoursPassed < cooldown) {
                    sessionStorage.setItem('dismissed_notif_prompt', 'true');
                    sessionStorage.setItem('dismissed_geo_prompt', 'true');
                    setSessionDismissedNotif(true);
                    setSessionDismissedGeo(true);
                }
            }
        }
    }, [isMobile, !!config]);

    useEffect(() => {
        const loadConfig = async () => {
            const { ConfigService } = await import('../../../services/configService');
            ConfigService.get().then(setConfig);
        };
        loadConfig();
    }, []);

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
            const maxPC = config?.messaging?.maxLargePromptDismissalsPC ?? config?.messaging?.maxLargePromptDismissals ?? 2;
            const maxMobile = config?.messaging?.maxLargePromptDismissalsMobile ?? config?.messaging?.maxLargePromptDismissals ?? 2;
            const maxAttempts = isMobile ? maxMobile : maxPC;

            if (dismissedCount >= maxAttempts) {
                finalStatus = 'dismissed';
                const standbyDays = config?.messaging?.notificationPromptIntervalDays || 30;
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
        if (typeof window === 'undefined' || !userData || !config) return;

        const isSessNotif = sessionStorage.getItem('dismissed_notif_prompt') === 'true';
        const isSessGeo = sessionStorage.getItem('dismissed_geo_prompt') === 'true';
        const permissions = userData?.permissions || {};

        // 1. Notificaciones
        const notifStatus = permissions.notifications?.status || 'pending';
        const notifNextPrompt = permissions.notifications?.nextPrompt || 0;
        const notifBlocked = notifStatus === 'blocked';
        const browserNotif = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const currentNotifCount = permissions.notifications?.[counterKey] || 0;
        const maxNotif = isMobile
            ? (config?.messaging?.maxLargePromptDismissalsMobile ?? config?.messaging?.maxLargePromptDismissals ?? 2)
            : (config?.messaging?.maxLargePromptDismissalsPC ?? config?.messaging?.maxLargePromptDismissals ?? 2);

        console.log('[PermissionPrompt] Check Notif:', { isMobile, status: notifStatus, browser: browserNotif, count: currentNotifCount, max: maxNotif, session: isSessNotif });

        if (browserNotif === 'granted' && notifStatus !== 'granted') {
            await updatePermission('notifications', 'granted');
        }

        const isPhase1Enabled = config?.messaging?.enableLargePrompt !== false;
        const canShowNotif = (browserNotif === 'default') && (notifStatus === 'pending' || notifStatus === 'later') && (currentNotifCount < maxNotif);

        if (isPhase1Enabled && canShowNotif && !isSessNotif && !notifBlocked) {
            console.log('[PermissionPrompt] Showing: notifications');
            setStep('notifications');
            return;
        }

        // 2. Geolocation
        if (!isMobile) {
            setStep('none');
            return;
        }

        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoNextPrompt = permissions.geolocation?.nextPrompt || 0;
        const geoBlocked = geoStatus === 'blocked';
        const currentGeoCount = permissions.geolocation?.mobile_dismissedCount || 0;
        const maxGeo = config?.messaging?.maxLargePromptDismissalsMobile ?? config?.messaging?.maxLargePromptDismissals ?? 2;

        let browserGeo = 'prompt';
        if (typeof navigator !== 'undefined' && 'permissions' in navigator) {
            try {
                const res = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
                browserGeo = res.state;
                if (res.state === 'granted' && geoStatus !== 'granted') {
                    await updatePermission('geolocation', 'granted');
                    return;
                }
            } catch (e) { }
        }

        console.log('[PermissionPrompt] Check Geo:', { status: geoStatus, browser: browserGeo, count: currentGeoCount, max: maxGeo, session: isSessGeo });

        const canShowGeo = (geoStatus === 'pending' || geoStatus === 'later') && (currentGeoCount < maxGeo);

        if (isPhase1Enabled && canShowGeo && !isSessGeo && !geoBlocked && browserGeo !== 'denied' && geoStatus !== 'granted') {
            console.log('[PermissionPrompt] Showing: geolocation');
            setStep('geolocation');
            return;
        }

        setStep('none');
    };

    useEffect(() => {
        if (!user || !userData || !config) return;
        if (step !== 'none') return;

        const timer = setTimeout(() => {
            checkNextStep();
        }, 1500);

        return () => clearTimeout(timer);
    }, [user, userData?.permissions?.notifications?.status, userData?.permissions?.geolocation?.status, !!config, step]);

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
                    async () => await updatePermission('geolocation', 'later')
                );
            }
        }
    };

    const handleLater = async () => {
        const type = step as 'notifications' | 'geolocation';
        setStep('none');
        sessionStorage.setItem(type === 'notifications' ? 'dismissed_notif_prompt' : 'dismissed_geo_prompt', 'true');
        await updatePermission(type, 'later');
        if (isMobile) localStorage.setItem('last_mobile_permission_dismissal', Date.now().toString());
        if (type === 'notifications') setTimeout(() => checkNextStep(), 800);
    };

    const handleNo = async () => {
        const type = step as 'notifications' | 'geolocation';
        setStep('none');
        const deniedCount = (userData?.permissions?.[type]?.deniedCount || 0) + 1;
        if (deniedCount >= 2) {
            await updatePermission(type, 'blocked');
        } else {
            const standbyDays = config?.messaging?.notificationPromptIntervalDays || 30;
            const nextDate = Date.now() + (standbyDays * 24 * 60 * 60 * 1000);
            await updatePermission(type, 'denied', nextDate);
        }
        if (type === 'notifications') setTimeout(() => checkNextStep(), 800);
    };

    if (step === 'none') return null;

    const isGeo = step === 'geolocation';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-md animate-fade-in font-sans">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden border border-gray-100">
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${isGeo ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>
                <div className="text-center relative z-10">
                    <div className={`w-20 h-20 mx-auto rounded-3xl shadow-xl flex items-center justify-center mb-6 transform rotate-3 ${isGeo ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'}`}>
                        {isGeo ? <MapPin size={38} className="animate-bounce-slow" /> : <Bell size={38} className="animate-bounce-slow" />}
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 leading-tight mb-3 uppercase tracking-tight">
                        {isGeo ? 'Beneficios Locales' : 'Avisos y Premios'}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 px-2">
                        {isGeo ? 'Descubre descuentos exclusivos cerca tuyo.' : 'Entérate de tus puntos y regalos sorpresa.'}
                    </p>
                    <div className="space-y-3">
                        <button onClick={handleYes} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl ${isGeo ? 'bg-emerald-600 text-white' : 'bg-purple-600 text-white'}`}>
                            Activar ahora
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
