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
        const ua = navigator.userAgent;
        const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
        const isIPadOS = (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
        return isMobileUA || isIPadOS;
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
            [`permissions.${type}.status`]: status, // Unified status for Dashboard compatibility
            [`permissions.${type}.updatedAt`]: TimeService.now().getTime(),
            [`permissions.${type}.${counterKey}`]: dismissedCount,
            [`permissions.${type}.${prefix}nextPrompt`]: options?.nextPrompt || 0
        };

        // If it's a "phase 1 complete" (reached max attempts) or explicit "blocked", we set a long-term nextPrompt
        if (status === 'later_phase1_complete' || status === 'blocked') {
            const rawInterval = config?.messaging?.notificationPromptIntervalDays;
            const intervalDays = typeof rawInterval === 'number' ? rawInterval : parseInt(rawInterval) || 30;
            
            // Even if it's 0, we set at least 1 day to avoid infinite loop on refresh
            const safeInterval = Math.max(1, intervalDays);
            updateData[`permissions.${type}.${prefix}nextPrompt`] = TimeService.now().getTime() + (safeInterval * 24 * 60 * 60 * 1000);
            
            // Reset counter for the next cycle
            updateData[`permissions.${type}.${counterKey}`] = 0;
            console.log(`[Permission Sync] ${type} (${status}). Next prompt in ${safeInterval} days.`);
        }

        try {
            await updateDoc(ref, updateData);
        } catch (e) {
            console.error("Error updating permission:", e);
        }
    };

    // --- HELPERS FOR FLOW ---
    const checkNextStep = (currentHandled: string[]) => {
        if (!userData || !config) return 'none';
        const permissions = userData.permissions || {};
        const safeMessaging = config?.messaging || {};
        const prefix = isMobile ? 'mobile_' : 'pc_';
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';

        // 1. Notif Check
        const browserNotifState = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
        const notifStatus = permissions.notifications?.[`${prefix}status`] || 'pending';
        const notifAttempts = permissions.notifications?.[counterKey] || 0;
        const maxNotif = isMobile ? (safeMessaging.maxLargePromptDismissalsMobile) : (safeMessaging.maxLargePromptDismissalsPC);
        const notifNextPrompt = permissions.notifications?.[`${prefix}nextPrompt`] || 0;
        const isNotifCooldown = notifNextPrompt > TimeService.now().getTime();

        const canShowNotif = (notifStatus === 'pending' || notifStatus === 'later' || notifStatus === 'later_phase1_complete' || notifStatus === 'blocked') &&
            ((notifStatus === 'later_phase1_complete' || notifStatus === 'blocked') ? true : notifAttempts < (Number(maxNotif) || 2)) &&
            !isNotifCooldown &&
            browserNotifState === 'default' &&
            !currentHandled.includes('notifications');

        if (canShowNotif) return 'notifications';

        // 2. Geo Check
        const geoStatus = permissions.geolocation?.[`${prefix}status`] || 'pending';
        const geoAttempts = permissions.geolocation?.[counterKey] || 0;
        const geoNextPrompt = permissions.geolocation?.[`${prefix}nextPrompt`] || 0;
        const isGeoCooldown = geoNextPrompt > TimeService.now().getTime();
        const maxGeo = safeMessaging.maxLargePromptDismissalsMobile;
        
        const canShowGeo = isMobile &&
            (geoStatus === 'pending' || geoStatus === 'later' || geoStatus === 'later_phase1_complete' || geoStatus === 'blocked') &&
            ((geoStatus === 'later_phase1_complete' || geoStatus === 'blocked') ? true : geoAttempts < (Number(maxGeo) || 2)) &&
            !isGeoCooldown &&
            !currentHandled.includes('geolocation');

        if (canShowGeo) return 'geolocation';

        return 'none';
    };

    // Initial Trigger
    useEffect(() => {
        if (!userData || !user || !config || step !== 'none') return;
        const next = checkNextStep(handledSteps);
        if (next !== 'none') {
            setStep(next as any);
        } else {
            onPhaseEnd(false); // Nothing for us to do
        }
    }, [userData?.permissions, config]);

    const moveToNextOrEnd = (justHandled: string) => {
        const newHandled = [...handledSteps, justHandled];
        setHandledSteps(newHandled);
        const next = checkNextStep(newHandled);
        if (next !== 'none') {
            setStep(next as any);
        } else {
            setStep('none');
            onPhaseEnd(true); // End of round, trigger global cooldown
        }
    };

    const handleYes = async () => {
        const currentStep = step;
        if (currentStep === 'notifications') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await updatePermission('notifications', 'granted');
                toast.success('¡Activado!');
                onNotificationGranted();
                // Direct call to retrieveToken for faster registration in standalone/standalone
                if (typeof (window as any).retrieveToken === 'function') {
                    (window as any).retrieveToken();
                }
                moveToNextOrEnd('notifications');
            } else {
                await updatePermission('notifications', 'later');
                moveToNextOrEnd('notifications');
            }
        } else if (currentStep === 'geolocation') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const ts = TimeService.now().getTime();
                        const prefix = isMobile ? 'mobile_' : 'pc_';
                        await updateDoc(doc(db, 'users', user.uid), {
                            [`permissions.geolocation.${prefix}status`]: 'granted',
                            [`permissions.geolocation.updatedAt`]: ts,
                            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date(ts) }
                        });
                        toast.success('Ubicación activada');
                        moveToNextOrEnd('geolocation');
                    },
                    async () => {
                        await updatePermission('geolocation', 'later');
                        moveToNextOrEnd('geolocation');
                    },
                    { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
                );
            } else {
                moveToNextOrEnd('geolocation');
            }
        }
    };

    const handleLater = async () => {
        const type = step;
        const rawMax = isMobile
            ? (config?.messaging?.maxLargePromptDismissalsMobile)
            : (config?.messaging?.maxLargePromptDismissalsPC);
        const maxAttempts = Number(rawMax) || 2;
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const currentCount = Number(userData?.permissions?.[type]?.[counterKey]) || 0;
        const newCount = currentCount + 1;

        console.log(`[Sequential Banner] ${type} - Count: ${newCount}/${maxAttempts}`);

        if (newCount >= maxAttempts) {
            const rawInterval = config?.messaging?.notificationPromptIntervalDays;
            const intervalDays = Number(rawInterval) || 30;
            await updatePermission(type as any, 'later_phase1_complete');
            if (intervalDays > 0) {
                toast(`Volveremos a consultar en ${intervalDays} días,o lo podes cambiar desde tu perfil !!!`, { icon: '🤝', duration: 6000 });
            }
        } else {
            const rawCooldown = isMobile ? (config?.messaging?.mobileCooldownHours) : 0;
            // Bug fix: If is PC, rawCooldown is 0. Number(0) || 24 would give 24.
            const cooldownHours = isMobile ? (Number(rawCooldown) || 24) : 0;
            const nextPrompt = TimeService.now().getTime() + (cooldownHours * 60 * 60 * 1000);
            if (!isMobile) {
                console.log("[PC Logic] No cooldown applied for PC (Session based)");
            }
            await updatePermission(type as any, 'later', { nextPrompt });
        }
        moveToNextOrEnd(type as any);
    };

    const handleNo = async () => {
        const type = step;
        const rawInterval = config?.messaging?.notificationPromptIntervalDays;
        const intervalDays = Number(rawInterval) || 30;
        
        await updatePermission(type as any, 'blocked');
        
        if (intervalDays > 0) {
            toast(`Volveremos a consultar en ${intervalDays} días,o lo podes cambiar desde tu perfil !!!`, { icon: '🤝', duration: 6000 });
        } else {
            toast('Entendido.', { icon: '🤝' });
        }
        
        moveToNextOrEnd(type as any);
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
                        <br />
                        <span className="text-[10px] opacity-70 mt-1 block italic font-bold">También podés activarlo desde tu Perfil.</span>
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
