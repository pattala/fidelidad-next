import { useEffect, useState, useRef, useMemo } from 'react';
import { Bell, Check, MapPin, Bug } from 'lucide-react';
import toast from 'react-hot-toast';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';

interface Props {
    user: any;
    userData: any;
    config: any;
    onNotificationGranted: () => void;
}

export const NotificationPermissionPrompt = ({ user, userData, config, onNotificationGranted }: Props) => {
    const [step, setStep] = useState<'none' | 'notifications' | 'geolocation'>('none');

    // Diagnostic state for the yellow banner
    const [diagnostics, setDiagnostics] = useState({
        isNew: false,
        geoStatus: 'pending',
        canShow: false,
        attempts: 0
    });

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

    const checkNextStep = async () => {
        if (!userData || !user || !config) return;

        const permissions = userData.permissions || {};
        const safeMessaging = config?.messaging || {};
        const isTestUser = userData.isTestUser === true;

        const browserNotitState = typeof Notification !== 'undefined' ? Notification.permission : 'denied';
        const dbNotifStatus = permissions.notifications?.status || 'pending';

        if (browserNotitState === 'granted') {
            onNotificationGranted();
            checkGeoStep(permissions, safeMessaging, isTestUser);
            return;
        }

        const isSessNotif = sessionStorage.getItem('dismissed_notif_prompt') === 'true';
        const counterKey = isMobile ? 'mobile_dismissedCount' : 'pc_dismissedCount';
        const notifAttempts = permissions.notifications?.[counterKey] || 0;
        const maxNotif = 5;

        if (browserNotitState === 'default' && (dbNotifStatus === 'pending' || dbNotifStatus === 'later') && notifAttempts < maxNotif && !isSessNotif && safeMessaging.enableLargePrompt !== false) {
            setStep('notifications');
            return;
        }

        checkGeoStep(permissions, safeMessaging, isTestUser);
    };

    const checkGeoStep = (permissions: any, safeMessaging: any, isTestUser: boolean) => {
        if (!isMobile) {
            setStep('none');
            return;
        }

        const geoStatus = permissions.geolocation?.status || 'pending';
        const geoAttempts = permissions.geolocation?.mobile_dismissedCount || 0;
        const maxGeo = 5;
        const isSessGeo = sessionStorage.getItem('dismissed_geo_prompt') === 'true';

        const userCreatedAt = userData.createdAt?.toDate ? userData.createdAt.toDate().getTime() : (userData.createdAt || 0);

        // Ventana de "Inmunidad" (Bypass)
        // Testers: 24 horas (para facilitar pruebas cruzadas)
        // Usuarios Reales: 10 minutos (para asegurar onboarding pero no ser repetitivos)
        const immunityWindow = isTestUser ? (24 * 60 * 60 * 1000) : (10 * 60 * 1000);
        const isNewRegistration = userCreatedAt > (TimeService.now().getTime() - immunityWindow);

        const canShowGeo = (geoStatus === 'pending' || geoStatus === 'later') &&
            geoAttempts < maxGeo &&
            !isSessGeo &&
            safeMessaging.enableLargePrompt !== false &&
            geoStatus !== 'granted' &&
            geoStatus !== 'blocked';

        setDiagnostics({
            isNew: isNewRegistration,
            geoStatus,
            canShow: canShowGeo,
            attempts: geoAttempts
        });

        if (canShowGeo) {
            if (!isTestUser && !isNewRegistration) {
                const lastDismissal = localStorage.getItem('last_mobile_permission_dismissal');
                if (lastDismissal) {
                    const hoursPassed = (TimeService.now().getTime() - parseInt(lastDismissal)) / (1000 * 60 * 60);
                    const cooldown = config?.messaging?.mobileCooldownHours ?? 24;
                    if (cooldown > 0 && hoursPassed < cooldown) {
                        setStep('none');
                        return;
                    }
                }
            }
            setStep('geolocation');
        } else {
            setStep('none');
        }
    };

    const hasAttemptedCheck = useRef(false);

    useEffect(() => {
        if (!user || !userData || step !== 'none' || hasAttemptedCheck.current) return;
        if (!userData.email && !userData.nombre && !userData.numeroSocio) return;
        if (!config) return;

        hasAttemptedCheck.current = true;
        const timer = setTimeout(() => {
            checkNextStep();
        }, 1500);

        return () => clearTimeout(timer);
    }, [user?.uid, !!userData, step, !!config]);

    const handleYes = async () => {
        const currentStep = step;
        setStep('none');

        if (currentStep === 'notifications') {
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
                    async () => {
                        await updatePermission('geolocation', 'later');
                    },
                    { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
                );
            }
        }
    };

    const handleLater = async () => {
        const type = step;
        setStep('none');
        sessionStorage.setItem(type === 'notifications' ? 'dismissed_notif_prompt' : 'dismissed_geo_prompt', 'true');
        await updatePermission(type as any, 'later');
        if (isMobile) {
            localStorage.setItem('last_mobile_permission_dismissal', TimeService.now().getTime().toString());
        }
        if (type === 'notifications') {
            setTimeout(() => checkNextStep(), 800);
        }
    };

    const handleNo = async () => {
        const type = step;
        setStep('none');
        await updatePermission(type as any, 'blocked');
        toast('Entendido.', { icon: '🤝' });
        if (type === 'notifications') {
            setTimeout(() => checkNextStep(), 800);
        }
    };

    if (step === 'none') {
        if ((userData?.isTestUser || diagnostics.isNew) && diagnostics.canShow) {
            return (
                <div className="fixed top-4 left-4 z-[1001] bg-yellow-400 text-black text-[10px] p-2 rounded-lg font-black flex flex-col gap-1 shadow-lg max-w-[80%] border-2 border-black pointer-events-none">
                    <div className="flex items-center gap-1 border-b border-black/20 pb-1 mb-1">
                        <Bug size={14} /> <span>MODO TEST: {diagnostics.isNew ? 'NUEVO' : 'TESTER'}</span>
                    </div>
                    <p className="opacity-80 break-all leading-tight text-[8px]">
                        UA: {navigator.userAgent.slice(0, 30)}... | Window: {diagnostics.isNew ? 'ACTIVE' : 'EXPIRED'} | {JSON.stringify(diagnostics)}
                    </p>
                </div>
            );
        }
        return null;
    }

    const isGeo = step === 'geolocation';

    return (
        <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fade-in font-sans">
            {(userData?.isTestUser || diagnostics.isNew) && (
                <div className="absolute top-4 left-4 z-[1001] bg-yellow-400 text-black text-[10px] p-2 rounded-lg font-black flex flex-col gap-1 shadow-lg max-w-[80%] border-2 border-black">
                    <div className="flex items-center gap-1 border-b border-black/20 pb-1 mb-1">
                        <Bug size={14} /> <span>DIAGNÓSTICO ACTIVADO</span>
                    </div>
                    <p className="opacity-80 break-all leading-tight">
                        Inmunidad: {diagnostics.isNew ? 'ACTIVA' : 'EXPIRADA'} |
                        Device: {isMobile ? 'MÓVIL' : 'PC'} |
                        State: {diagnostics.geoStatus}
                    </p>
                </div>
            )}

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
