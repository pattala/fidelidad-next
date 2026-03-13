import { useEffect, useState, useRef, useMemo } from 'react';
import { Bell, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';

interface Props {
    user: any;
    userData: any;
    config: any;
    onNotificationGranted: () => void;
    onPhaseEnd: (triggerCooldown: boolean) => void;
}

export const NotificationPermissionPrompt = ({ user, userData, config, onNotificationGranted, onPhaseEnd }: Props) => {
    const [step, setStep] = useState<'none' | 'notifications' | 'geolocation'>('none');
    const [handledSteps, setHandledSteps] = useState<string[]>([]);
    const syncInProgress = useRef(false);

    const isMobileDevice = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return (
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent))
        );
    }, []);
    const isMobile = isMobileDevice; // For this component, we care about the device type for permissions

    const updatePermission = async (type: 'notifications' | 'geolocation', status: string, options?: { nextPrompt?: number }) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const prefix = isMobile ? 'mobile_' : 'pc_';
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        let dismissedCount = userData?.permissions?.[type]?.[counterKey] || 0;

        if (status === 'later') {
            dismissedCount++;
        }

        const updateData: any = {
            [`permissions.${type}.${prefix}status`]: status,
            [`permissions.${type}.updatedAt`]: TimeService.now().getTime(),
            [`permissions.${type}.${counterKey}`]: dismissedCount,
            [`permissions.${type}.${prefix}nextPrompt`]: options?.nextPrompt || 0
        };

        // If it's a "phase 1 complete" (reached max attempts), we can also set a long-term nextPrompt or just leave it
        if (status === 'later_phase1_complete') {
            const intervalDays = config?.messaging?.notificationPromptIntervalDays;
            if (intervalDays) {
                updateData[`permissions.${type}.${prefix}nextPrompt`] = TimeService.now().getTime() + (intervalDays * 24 * 60 * 60 * 1000);
            }
            // Reset counter for the next cycle
            updateData[`permissions.${type}.${counterKey}`] = 0;
        }

        try {
            await updateDoc(ref, updateData);
        } catch (e) {
            console.error("Error updating permission:", e);
        }
    };

    // 0. Initial Logic: Decide whether to start with Notif or Geo
    useEffect(() => {
        if (!userData || !user || !config) return;

        const permissions = userData.permissions || {};
        const safeMessaging = config?.messaging || {};
        const prefix = isMobile ? 'mobile_' : 'pc_';

        const browserNotifState = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
        const notifStatus = permissions.notifications?.[`${prefix}status`] || 'pending';
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const notifAttempts = permissions.notifications?.[counterKey] || 0;
        const maxAttempts = isMobile ? (safeMessaging.maxLargePromptDismissalsMobile) : (safeMessaging.maxLargePromptDismissalsPC);
        const notifNextPrompt = permissions.notifications?.[`${prefix}nextPrompt`] || 0;

        const isCooldownActive = notifNextPrompt > TimeService.now().getTime();

        const canShowNotif = (notifStatus === 'pending' || notifStatus === 'later' || notifStatus === 'later_phase1_complete') &&
            (notifStatus === 'later_phase1_complete' ? true : notifAttempts < (maxAttempts ?? 2)) &&
            !isCooldownActive &&
            browserNotifState === 'default' &&
            !handledSteps.includes('notifications');

        if (canShowNotif) {
            setStep('notifications');
        } else {
            // Check Geo
            const geoStatus = permissions.geolocation?.[`${prefix}status`] || 'pending';
            const geoAttempts = permissions.geolocation?.[counterKey] || 0;
            const geoNextPrompt = permissions.geolocation?.[`${prefix}nextPrompt`] || 0;
            const isGeoCooldown = geoNextPrompt > TimeService.now().getTime();
            
            const canShowGeo = isMobile &&
                (geoStatus === 'pending' || geoStatus === 'later' || geoStatus === 'later_phase1_complete') &&
                (geoStatus === 'later_phase1_complete' ? true : geoAttempts < (safeMessaging.maxLargePromptDismissalsMobile || 0)) &&
                !isGeoCooldown &&
                !handledSteps.includes('geolocation');

            if (canShowGeo) {
                setStep('geolocation');
            } else {
                setStep('none');
                onPhaseEnd(false);
            }
        }
    }, [userData?.permissions, handledSteps]);

    const handleYes = async () => {
        const currentStep = step;

        if (currentStep === 'notifications') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await updatePermission('notifications', 'granted');
                toast.success('¡Activado!');
                onNotificationGranted();
            } else {
                await updatePermission('notifications', 'later');
            }
            onPhaseEnd(true);
        } else if (currentStep === 'geolocation') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const ts = TimeService.now().getTime();
                        await updateDoc(doc(db, 'users', user.uid), {
                            [`permissions.geolocation.status`]: 'granted',
                            [`permissions.geolocation.updatedAt`]: ts,
                            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date(ts) }
                        });
                        toast.success('Ubicación activada');
                        onPhaseEnd(true);
                    },
                    async () => {
                        await updatePermission('geolocation', 'later');
                        onPhaseEnd(true);
                    },
                    { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
                );
            }
        }
    };

    const checkGeoInternal = () => {
        const permissions = userData?.permissions || {};
        const safeMessaging = config?.messaging || {};
        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoAttempts = permissions.geolocation?.mobile_dismissedCount || 0;
        const maxMobile = safeMessaging.maxLargePromptDismissalsMobile;

        if (isMobileDevice && (geoStatus === 'pending' || geoStatus === 'later' || geoStatus === 'later_phase1_complete') && 
           (geoStatus === 'later_phase1_complete' ? true : geoAttempts < (maxMobile || 0)) &&
           !handledSteps.includes('geolocation')) {
            setStep('geolocation');
        } else {
            onPhaseEnd(true);
        }
    };

    const handleLater = async () => {
        const type = step;
        setHandledSteps(prev => [...prev, type]);
        setStep('none');

        const maxAttempts = isMobile
            ? (config?.messaging?.maxLargePromptDismissalsMobile)
            : (config?.messaging?.maxLargePromptDismissalsPC);

        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const currentCount = userData?.permissions?.[type]?.[counterKey] || 0;
        const newCount = currentCount + 1;

        if (maxAttempts && newCount >= maxAttempts) {
            const intervalDays = config?.messaging?.notificationPromptIntervalDays;
            await updatePermission(type as any, 'later_phase1_complete');
            if (intervalDays) {
                toast(`Entendido. Te consultaremos en ${intervalDays} días o puedes activarlo desde tu perfil.`, { icon: '🤝', duration: 5000 });
            } else {
                toast(`Entendido. Puedes activarlo desde tu perfil.`, { icon: '🤝', duration: 5000 });
            }
        } else {
            const cooldownHours = isMobile ? (config?.messaging?.mobileCooldownHours) : 0;
            const nextPrompt = TimeService.now().getTime() + ((cooldownHours || 0) * 60 * 60 * 1000);
            await updatePermission(type as any, 'later', { nextPrompt });
            if (isMobileDevice && cooldownHours && cooldownHours > 0) {
                toast(`Entendido. Te consultaremos en ${Math.floor(cooldownHours)}hs.`, { icon: '🤝' });
            }
        }

        onPhaseEnd(true);
    };

    const handleNo = async () => {
        const type = step;
        setHandledSteps(prev => [...prev, type]);
        setStep('none');
        await updatePermission(type as any, 'blocked');
        toast('Entendido.', { icon: '🤝' });

        onPhaseEnd(true);
    };

    if (step === 'none') return null;

    const isGeo = step === 'geolocation';

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden border border-gray-100">
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${isGeo ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>
                <div className="text-center relative z-10">
                    <div className={`w-20 h-20 mx-auto rounded-3xl shadow-xl flex items-center justify-center mb-6 transition-transform transform rotate-3 ${isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-purple-600 text-white shadow-purple-200'}`}>
                        {isGeo ? <MapPin size={38} className="animate-bounce-slow" /> : <Bell size={38} className="animate-bounce-slow" />}
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 leading-tight mb-3 uppercase tracking-tight">
                        {isGeo ? 'Ubicación' : 'Avisos de Premios'}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6 px-2">
                        {isGeo ? 'Descubre beneficios exclusivos cerca tuyo.' : 'Entérate al instante cuando ganes puntos o premios exclusivos.'}
                    </p>

                    <div className="mb-6">
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-gray-400 bg-gray-50 px-3 py-1.5 rounded-full border border-gray-100">
                            {(() => {
                                const permissions = userData?.permissions || {};
                                const safeMessaging = config?.messaging || {};
                                const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
                                const type = step === 'geolocation' ? 'geolocation' : 'notifications';
                                const current = (permissions[type]?.[counterKey] || 0) + 1;
                                const max = isMobile ? (safeMessaging.maxLargePromptDismissalsMobile) : (safeMessaging.maxLargePromptDismissalsPC);
                                return `Oportunidad ${current} de ${max || '-'}`;
                            })()}
                        </span>
                    </div>

                    <div className="space-y-3">
                        <button onClick={handleYes} className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : 'bg-purple-600 text-white shadow-purple-200'}`}>
                            {isGeo ? 'Activar ahora' : 'Sí, activar avisos'}
                        </button>
                        <button onClick={handleLater} className="w-full py-4 text-xs font-black text-gray-400 border border-gray-100 rounded-2xl uppercase tracking-widest bg-gray-50/30">
                            Quizás luego
                        </button>
                        <button onClick={handleNo} className="w-full py-2 text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] hover:text-red-400 transition">
                            No me interesa
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};
