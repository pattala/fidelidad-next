import { useEffect, useState, useRef, useMemo } from 'react';
import { Bell, MapPin } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';

const PC_PROMPT_SESSION_KEY = 'rampet_pc_prompt_shown';

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
    const [alreadyHandledInSession, setAlreadyHandledInSession] = useState(false);
    const [simTrigger, setSimTrigger] = useState(0);
    const [loading, setLoading] = useState(false);
    const [isRepairMode, setIsRepairMode] = useState(false);

    // Listen for simulation changes (Date Simulator)
    useEffect(() => {
        const handler = () => setSimTrigger(p => p + 1);
        window.addEventListener('time-simulation-change', handler);
        return () => window.removeEventListener('time-simulation-change', handler);
    }, []);

    const isMobileDevice = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const ua = navigator.userAgent;
        const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
        const isIPadOS = (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
        return isMobileUA || isIPadOS;
    }, []);
    const isMobile = isMobileDevice;

    useEffect(() => {
        if (!isMobile) {
            const isHandled = sessionStorage.getItem(PC_PROMPT_SESSION_KEY) === 'true';
            if (isHandled) setAlreadyHandledInSession(true);
        }
    }, [isMobile]);

    const markAsHandledInSession = () => {
        if (!isMobile) {
            sessionStorage.setItem(PC_PROMPT_SESSION_KEY, 'true');
            setAlreadyHandledInSession(true);
        }
    };

    const updatePermission = async (type: 'notifications' | 'geolocation', status: string, nextPrompt: number = 0, dismissedCount: number = 0) => {
        if (!user) return;
        const ref = doc(db, 'users', user.uid);
        const prefix = isMobile ? 'mobile_' : 'pc_';
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';

        const updateData: any = {
            [`permissions.${type}.${prefix}status`]: status,
            [`permissions.${type}.status`]: status,
            [`permissions.${type}.updatedAt`]: TimeService.now().getTime(),
            [`permissions.${type}.${counterKey}`]: dismissedCount,
            [`permissions.${type}.${prefix}nextPrompt`]: nextPrompt
        };

        try {
            await updateDoc(ref, updateData);
        } catch (e) {
            console.error("Error updating permission:", e);
        }
    };

    const checkNextStep = (currentHandled: string[]) => {
        const isSimulated = TimeService.getOffsetInDays() > 0;
        if (!userData || !config || (alreadyHandledInSession && !isSimulated)) return 'none';
        const permissions = userData.permissions || {};
        const safeMessaging = config?.messaging || {};
        const prefix = isMobile ? 'mobile_' : 'pc_';
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';

        const browserNotifState = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
        const notifStatus = permissions.notifications?.[`${prefix}status`] || 'pending';
        const notifAttempts = permissions.notifications?.[counterKey] || 0;
        const maxNotif = isMobile ? (safeMessaging.maxLargePromptDismissalsMobile) : (safeMessaging.maxLargePromptDismissalsPC);
        const notifNextPrompt = permissions.notifications?.[`${prefix}nextPrompt`] || 0;
        const isNotifCooldown = notifNextPrompt > TimeService.now().getTime();
        
        // --- 🛡️ ROBUST SYNC CHECK v6.1 ---
        // If browser says "granted" but DB has no token for this prefix, it's a desync.
        const tokenInDb = userData[`fcmToken_${isMobile ? 'mobile' : 'pc'}`];
        const isDesynced = browserNotifState === 'granted' && !tokenInDb;

        const canShowNotif = (notifStatus === 'pending' || notifStatus === 'later' || notifStatus === 'later_phase1_complete' || notifStatus === 'blocked' || isDesynced) &&
            notifAttempts < (Number(maxNotif) || 2) &&
            !isNotifCooldown &&
            (browserNotifState === 'default' || isDesynced) &&
            !currentHandled.includes('notifications');

        if (canShowNotif) {
            if (isDesynced) setIsRepairMode(true);
            return 'notifications';
        }

        const geoStatus = permissions.geolocation?.[`${prefix}status`] || 'pending';
        const geoAttempts = permissions.geolocation?.[counterKey] || 0;
        const geoNextPrompt = permissions.geolocation?.[`${prefix}nextPrompt`] || 0;
        const isGeoCooldown = geoNextPrompt > TimeService.now().getTime();
        const maxGeo = safeMessaging.maxLargePromptDismissalsMobile;
        
        // DECOUPLED GEO: No longer requires Notification.permission === 'granted'
        const canShowGeo = isMobile &&
            (geoStatus === 'pending' || geoStatus === 'later') &&
            geoAttempts < (Number(maxGeo) || 2) &&
            !isGeoCooldown &&
            !currentHandled.includes('geolocation');

        if (canShowGeo) return 'geolocation';

        return 'none';
    };

    useEffect(() => {
        const isSimulated = TimeService.getOffsetInDays() > 0;
        if (!userData || !user || !config || step !== 'none' || (alreadyHandledInSession && !isSimulated)) return;
        const next = checkNextStep(handledSteps);
        if (next !== 'none') {
            setStep(next as any);
        } else {
            onPhaseEnd(false);
        }
    }, [userData?.permissions, config, alreadyHandledInSession, simTrigger]);

    const moveToNextOrEnd = (justHandled: string) => {
        const newHandled = [...handledSteps, justHandled];
        setHandledSteps(newHandled);
        const next = checkNextStep(newHandled);
        if (next !== 'none') {
            setStep(next as any);
        } else {
            setStep('none');
            onPhaseEnd(true);
        }
    };

    const handleYes = async () => {
        const currentStep = step;
        if (currentStep === 'notifications') {
            setLoading(true);
            try {
                if (typeof Notification === 'undefined') {
                    console.warn("Notifications API not available.");
                    moveToNextOrEnd('notifications');
                    return;
                }
                
                let permission = Notification.permission;
                if (permission !== 'granted') {
                    permission = await Notification.requestPermission();
                }

                if (permission === 'granted') {
                    await updatePermission('notifications', 'granted');
                    
                    // --- 🔄 WAIT FOR TOKEN LOGIC ---
                    const resultToken = await (onNotificationGranted() as any);
                    
                    if (resultToken) {
                        toast.success('¡Conectado correctamente!');
                    } else {
                        toast.error('Permiso OK, pero no se pudo sincronizar el dispositivo. Intenta instalando la App.', { duration: 5000 });
                        // If it fails, we still move on to Geo so we don't block the onboarding
                    }
                    moveToNextOrEnd('notifications');
                } else {
                    // SI ES DENIED O BLOCKED: Triggereamos el handler de fallo de Home
                    if (typeof (window as any).handlePushAttemptResult === 'function') {
                        (window as any).handlePushAttemptResult(permission);
                    }
                    moveToNextOrEnd('notifications');
                }
            } catch (e) {
                console.error("Error requesting notification permission:", e);
                moveToNextOrEnd('notifications');
            } finally {
                setLoading(false);
            }
        } else if (currentStep === 'geolocation') {
            setLoading(true);
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        const ts = TimeService.now().getTime();
                        const prefix = isMobile ? 'mobile_' : 'pc_';
                        await updateDoc(doc(db, 'users', user.uid), {
                            [`permissions.geolocation.${prefix}status`]: 'granted',
                            [`permissions.geolocation.status`]: 'granted',
                            [`permissions.geolocation.updatedAt`]: ts,
                            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date(ts) }
                        });
                        toast.success('Ofertas locales activadas');
                        setLoading(false);
                        moveToNextOrEnd('geolocation');
                    },
                    async () => {
                        setLoading(false);
                        handleLater();
                    },
                    { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
                );
            } else {
                setLoading(false);
                moveToNextOrEnd('geolocation');
            }
        }
    };

    const handleLater = async () => {
        const type = step;
        const messaging = config?.messaging || {};
        const rawMax = isMobile ? messaging.maxLargePromptDismissalsMobile : messaging.maxLargePromptDismissalsPC;
        const maxAttempts = Number(rawMax) || 2;
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const currentCount = Number(userData?.permissions?.[type]?.[counterKey]) || 0;
        const newCount = currentCount + 1;

        if (newCount >= maxAttempts) {
            // Ya no bloqueamos de por vida. Marcamos fase 1 completa y aplicamos el intervalo de días configurado.
            const intervalDays = messaging.notificationPromptIntervalDays || 30;
            const nextPrompt = TimeService.now().getTime() + (intervalDays * 24 * 3600 * 1000);
            
            await updatePermission(type as any, 'later_phase1_complete', nextPrompt, 0);
            
            if (intervalDays > 0) {
                toast(`Volveremos a consultar en ${intervalDays} días, o lo podes cambiar desde tu perfil !!!`, { icon: '🤝', duration: 6000 });
            }
            onPhaseEnd(true);
        } else {
            const rawCooldown = isMobile ? messaging.mobileCooldownHours : 0;
            const cooldownHours = isMobile ? (Number(rawCooldown) || 24) : 0;
            const nextPrompt = isMobile ? (TimeService.now().getTime() + (cooldownHours * 3600 * 1000)) : 0;
            await updatePermission(type as any, 'later', nextPrompt, newCount);
            moveToNextOrEnd(type as any);
        }
        markAsHandledInSession();
    };

    const handleNo = async () => {
        const type = step;
        const messaging = config?.messaging || {};
        const intervalDays = messaging.notificationPromptIntervalDays || 30;
        const nextPrompt = TimeService.now().getTime() + (intervalDays * 24 * 3600 * 1000);
        await updatePermission(type as any, 'blocked', nextPrompt);
        
        if (intervalDays > 0) {
            toast(`Volveremos a consultar en ${intervalDays} días, o lo podes cambiar desde tu perfil !!!`, { icon: '🤝', duration: 6000 });
        } else {
            toast('Entendido.', { icon: '🤝' });
        }
        markAsHandledInSession();
        onPhaseEnd(true);
    };

    if (step === 'none') return null;

    const isGeo = step === 'geolocation';

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden border border-gray-100">
                <div className={`absolute -top-12 -right-12 w-32 h-32 rounded-full blur-3xl opacity-20 ${isGeo ? 'bg-emerald-500' : 'bg-purple-500'}`}></div>
                <div className="text-center relative z-10">
                    <div className={`w-20 h-20 mx-auto rounded-3xl shadow-xl flex items-center justify-center mb-6 transition-transform transform rotate-3 ${isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : (isRepairMode ? 'bg-amber-500 text-white shadow-amber-200' : 'bg-purple-600 text-white shadow-purple-200')}`}>
                        {loading ? (
                            <div className="w-10 h-10 border-4 border-white/30 border-t-white rounded-full animate-spin"></div>
                        ) : (
                            isGeo ? <MapPin size={38} className="animate-bounce-slow" /> : <Bell size={38} className="animate-bounce-slow" />
                        )}
                    </div>
                    
                    <h3 className="text-2xl font-black text-gray-800 leading-tight mb-3 uppercase tracking-tight">
                        {isGeo ? 'Ofertas en tu zona' : (isRepairMode ? 'Sincronizar avisos' : 'Avisos de Premios')}
                    </h3>
                    
                    <p className="text-sm text-gray-500 font-medium leading-relaxed mb-6 px-2">
                        {loading ? 'Procesando, espera un momento...' : (
                            isGeo 
                                ? 'Descubrí beneficios exclusivos y novedades cerca tuyo.' 
                                : (isRepairMode 
                                    ? 'Detectamos que tu dispositivo no está recibiendo los avisos correctamente. Vamos a re-conectarlo.'
                                    : 'Entérate al instante cuando ganes puntos o premios exclusivos.')
                        )}
                        <br />
                        {!loading && <span className="text-[10px] opacity-70 mt-1 block italic font-bold">También podés activarlo desde tu Perfil.</span>}
                    </p>

                    <div className="space-y-3">
                        <button 
                            disabled={loading}
                            onClick={handleYes} 
                            className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${loading ? 'bg-gray-300 text-white shadow-none' : (isGeo ? 'bg-emerald-600 text-white shadow-emerald-200' : (isRepairMode ? 'bg-amber-600 text-white shadow-amber-200' : 'bg-purple-600 text-white shadow-purple-200'))}`}
                        >
                            {loading ? 'Cargando...' : (isGeo ? 'Ver beneficios cercanos' : (isRepairMode ? 'Sincronizar ahora' : 'Sí, activar avisos'))}
                        </button>
                        
                        {!loading && (
                            <>
                                <button onClick={handleLater} className="w-full py-4 text-xs font-black text-gray-400 border border-gray-100 rounded-2xl uppercase tracking-widest bg-gray-50/30">
                                    Quizás luego
                                </button>
                                <button onClick={handleNo} className="w-full py-2 text-[10px] font-bold text-gray-300 uppercase tracking-[0.2em] hover:text-red-400 transition">
                                    No me interesa
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
