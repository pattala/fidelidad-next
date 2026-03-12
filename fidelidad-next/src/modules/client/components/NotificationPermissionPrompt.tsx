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
    onInteraction?: () => void;
}

export const NotificationPermissionPrompt = ({ user, userData, config, onNotificationGranted, onInteraction }: Props) => {
    const [step, setStep] = useState<'none' | 'notifications' | 'geolocation'>('none');
    const syncInProgress = useRef(false);
    const lastInteractionTime = useRef<number>(0);

    const isMobile = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return (
            /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) ||
            (navigator.maxTouchPoints > 0 && /Macintosh/.test(navigator.userAgent)) ||
            window.innerWidth < 768
        );
    }, []);

    const updatePermission = async (type: 'notifications' | 'geolocation', status: string, nextPrompt: number = 0) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        let dismissedCount = userData?.permissions?.[type]?.[counterKey] || 0;

        if (status === 'later') {
            dismissedCount++;
        }

        try {
            await updateDoc(ref, {
                [`permissions.${type}.status`]: status,
                [`permissions.${type}.updatedAt`]: TimeService.now().getTime(),
                [`permissions.${type}.${counterKey}`]: dismissedCount,
                [`permissions.${type}.nextPrompt`]: nextPrompt
            });
        } catch (e) {
            console.error("Error updating permission:", e);
        }
    };

    // 0. Auto-sync Permission Reality
    useEffect(() => {
        const syncReality = async () => {
            if (!userData || !user || syncInProgress.current) return;
            const browserState = typeof Notification !== 'undefined' ? Notification.permission : 'default';
            const dbStatus = userData.permissions?.notifications?.status;

            // Reality Check: If browser is granted but DB is not, or vice-versa
            if (browserState === 'granted' && dbStatus !== 'granted') {
                syncInProgress.current = true;
                await updatePermission('notifications', 'granted');
                syncInProgress.current = false;
            } else if (browserState === 'denied' && dbStatus === 'granted') {
                syncInProgress.current = true;
                await updatePermission('notifications', 'denied');
                syncInProgress.current = false;
            }
        };
        syncReality();
    }, [userData?.permissions?.notifications?.status, user]);

    const checkNextStep = async () => {
        if (!userData || !user || !config) return;

        const permissions = userData.permissions || {};
        const safeMessaging = config?.messaging || {};

        // 0. Global Cooldown Check (from DB)
        const dbNotifStatus = permissions.notifications?.status || 'pending';

        if (isMobile && dbNotifStatus !== 'pending') {
            const lastDismissal = permissions.global_lastMobileDismissal;
            const now = TimeService.now().getTime();

            // Check local interaction first (prevent instant pop)
            if (now - lastInteractionTime.current < 5000) {
                setStep('none');
                return;
            }

            if (lastDismissal) {
                const diffMs = now - lastDismissal;
                const cooldownMinutes = safeMessaging.mobileCooldownHours ? safeMessaging.mobileCooldownHours * 60 : 24 * 60;

                if (diffMs < (cooldownMinutes * 60 * 1000)) {
                    setStep('none');
                    return;
                }
            }
        }

        // 1. Notifications Step
        const browserNotitState = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

        if (browserNotitState === 'granted') {
            onNotificationGranted();
            checkGeoStep(permissions, safeMessaging);
            return;
        }

        const isSessNotif = sessionStorage.getItem('dismissed_notif_prompt') === 'true';
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const notifAttempts = permissions.notifications?.[counterKey] || 0;
        const maxPC = safeMessaging.maxLargePromptDismissalsPC ?? safeMessaging.maxLargePromptDismissals ?? 2;
        const maxMobile = safeMessaging.maxLargePromptDismissalsMobile ?? safeMessaging.maxLargePromptDismissals ?? 2;
        const maxAttempts = isMobile ? maxMobile : maxPC;

        // PC is session-based, Mobile is 100% DB-driven (ignores isSessNotif)
        const isLocalLocked = isMobile ? false : isSessNotif;

        if ((dbNotifStatus === 'pending' || dbNotifStatus === 'later') && notifAttempts < maxAttempts && !isLocalLocked && safeMessaging.enableLargePrompt !== false) {
            setStep('notifications');
            return;
        }

        // 2. Geolocation Step
        checkGeoStep(permissions, safeMessaging);
    };

    const checkGeoStep = (permissions: any, safeMessaging: any): boolean => {
        if (!isMobile) {
            setStep('none');
            return false;
        }

        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoAttempts = permissions.geolocation?.mobile_dismissedCount || 0;
        const maxPC = safeMessaging.maxLargePromptDismissalsPC ?? safeMessaging.maxLargePromptDismissals ?? 2;
        const maxMobile = safeMessaging.maxLargePromptDismissalsMobile ?? safeMessaging.maxLargePromptDismissals ?? 2;
        const maxAttempts = isMobile ? maxMobile : maxPC;

        const isSessGeo = sessionStorage.getItem('dismissed_geo_prompt') === 'true';
        const isLocalLocked = isMobile ? false : isSessGeo;

        const canShowGeo = (geoStatus === 'pending' || geoStatus === 'later') &&
            geoAttempts < maxAttempts &&
            !isLocalLocked &&
            safeMessaging.enableLargePrompt !== false &&
            geoStatus !== 'granted' &&
            geoStatus !== 'blocked';

        if (canShowGeo) {
            setStep('geolocation');
            return true;
        } else {
            setStep('none');
            return false;
        }
    };

    useEffect(() => {
        if (!user || !userData || step !== 'none' || !config) return;
        if (!userData.email && !userData.nombre && !userData.numeroSocio) return;

        const timer = setTimeout(() => {
            checkNextStep();
        }, 1500);

        // Polling loop to re-check when cooldowns expire without page refresh
        const interval = setInterval(() => {
            if (step === 'none') checkNextStep();
        }, 30000); // Check every 30s

        return () => {
            clearTimeout(timer);
            clearInterval(interval);
        };
    }, [user?.uid, !!userData, step, !!config]);

    const handleYes = async () => {
        onInteraction?.();
        const currentStep = step;
        setStep('none');

        if (currentStep === 'notifications') {
            const currentBrowserPerm = typeof Notification !== 'undefined' ? Notification.permission : 'default';
            let finalPermission = currentBrowserPerm;

            if (currentBrowserPerm !== 'granted') {
                finalPermission = await Notification.requestPermission();
            }

            if (finalPermission === 'granted') {
                await updatePermission('notifications', 'granted');
                toast.success('¡Activado!');
                onNotificationGranted();
                // If it's mobile, we handle the chain to geo.
                // Note: global_lastMobileDismissal is NOT set yet because the "unit" (sequence) is not over.
            } else {
                await updatePermission('notifications', 'later');
            }

            // CHAIN: Try next step immediately
            setTimeout(async () => {
                const perms = userData?.permissions || {};
                const msg = config?.messaging || {};
                const willShowGeo = checkGeoStep(perms, msg);

                if (!willShowGeo && isMobile) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        'permissions.global_lastMobileDismissal': TimeService.now().getTime()
                    });
                }
            }, 800);
        } else if (currentStep === 'geolocation') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        await updatePermission('geolocation', 'granted');
                        const ts = TimeService.now().getTime();
                        await updateDoc(doc(db, 'users', user.uid), {
                            'permissions.global_lastMobileDismissal': ts,
                            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date(ts) }
                        });
                        toast.success('Ubicación activada');
                    },
                    async () => {
                        await updatePermission('geolocation', 'later');
                    },
                    { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
                );
            }
        }
    };
    const handleLater = async () => {
        onInteraction?.();
        const type = step;
        lastInteractionTime.current = TimeService.now().getTime();
        setStep('none');

        // PC maintains session block, Mobile does NOT (DB cooldown only)
        if (!isMobile) {
            sessionStorage.setItem(type === 'notifications' ? 'dismissed_notif_prompt' : 'dismissed_geo_prompt', 'true');
        }

        const maxPC = config?.messaging?.maxLargePromptDismissalsPC ?? config?.messaging?.maxLargePromptDismissals ?? 2;
        const maxMobile = config?.messaging?.maxLargePromptDismissalsMobile ?? config?.messaging?.maxLargePromptDismissals ?? 2;
        const maxAttempts = isMobile ? maxMobile : maxPC;

        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const currentCount = userData?.permissions?.[type]?.[counterKey] || 0;
        const newCount = currentCount + 1;

        if (newCount >= maxAttempts) {
            await updatePermission(type as any, 'later_phase1_complete');
        } else {
            await updatePermission(type as any, 'later');
        }

        if (type === 'notifications') {
            // Sequential Chain: Show Geo immediately after Notif dismissal
            setTimeout(async () => {
                const perms = userData?.permissions || {};
                const msg = config?.messaging || {};
                const willShowGeo = checkGeoStep(perms, msg);

                if (!willShowGeo && isMobile) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        'permissions.global_lastMobileDismissal': TimeService.now().getTime()
                    });
                }
            }, 800);
        } else {
            // End of Sequence: Trigger global cooldown only after Geo (last in chain)
            if (isMobile) {
                await updateDoc(doc(db, 'users', user.uid), {
                    'permissions.global_lastMobileDismissal': TimeService.now().getTime()
                });
            }
        }
    };

    const handleNo = async () => {
        onInteraction?.();
        const type = step;
        lastInteractionTime.current = TimeService.now().getTime();
        setStep('none');
        await updatePermission(type as any, 'blocked');
        toast('Entendido.', { icon: '🤝' });

        if (type === 'notifications') {
            // Sequential Chain
            setTimeout(async () => {
                const perms = userData?.permissions || {};
                const msg = config?.messaging || {};
                const willShowGeo = checkGeoStep(perms, msg);

                if (!willShowGeo && isMobile) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        'permissions.global_lastMobileDismissal': TimeService.now().getTime()
                    });
                }
            }, 800);
        } else {
            // End of Sequence: Trigger global cooldown
            if (isMobile) {
                await updateDoc(doc(db, 'users', user.uid), {
                    'permissions.global_lastMobileDismissal': TimeService.now().getTime()
                });
            }
        }
    };

    if (step === 'none') {
        return null;
    }

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
                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 px-2">
                        {isGeo ? 'Descubre beneficios exclusivos cerca tuyo.' : 'Entérate al instante cuando ganes puntos o premios exclusivos.'}
                    </p>
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
