import { useState, useEffect } from 'react';
import { Bell, MapPin, X, BellOff } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';
import { TimeService } from '../../../services/timeService';

interface Props {
    user: any;
    userData: any;
    type: 'notifications' | 'geolocation';
    triggerMessage?: string;
    config?: any;
    onGranted?: () => void;
    onDismiss?: () => void;
    onNeverAsk?: () => void;
}

const SESSION_KEYS = {
    notifications: 'contextual_notif_shown',
    geolocation: 'contextual_geo_shown',
};

export const ContextualPermissionBanner = ({
    user, userData, type, triggerMessage, config, onGranted, onDismiss, onNeverAsk
}: Props) => {
    const [visible, setVisible] = useState(false);

    const isMobile = typeof window !== 'undefined' && /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    useEffect(() => {
        if (!user || !userData) return;

        // 1. Check session/storage-based dismissal
        if (sessionStorage.getItem(SESSION_KEYS[type]) === 'true') return;

        // 2. Geolocation is ONLY for mobile
        if (type === 'geolocation' && !isMobile) return;

        if (isMobile) {
            const globalDismissal = userData.permissions?.global_lastMobileDismissal;
            const lastContextualDismissal = userData.permissions?.[type]?.lastContextualDismissal;

            const checkCooldown = (ts: any) => {
                if (!ts) return false;
                const timestamp = typeof ts === 'string' ? parseInt(ts) : ts;
                const hoursPassed = (TimeService.now().getTime() - timestamp) / (1000 * 60 * 60);
                const cooldown = config?.messaging?.mobileCooldownHours ?? 24;
                return hoursPassed < cooldown;
            };

            if (checkCooldown(lastContextualDismissal) || checkCooldown(globalDismissal)) return;
        }

        const status = userData.permissions?.[type]?.status;
        const nextPrompt = userData.permissions?.[type]?.nextPrompt || 0;

        if (status === 'granted' || status === 'blocked') return;

        // Si está en 'dismissed' o 'denied', solo mostrar si ya pasó el tiempo de espera
        const nowSim = TimeService.now().getTime();
        if ((status === 'dismissed' || status === 'denied') && nowSim < nextPrompt) return;

        const counterKey = isMobile ? 'mobile_contextualDismissCount' : 'pc_contextualDismissCount';
        const currentCount = userData?.permissions?.[type]?.[counterKey] || 0;
        const maxPC = config?.messaging?.maxContextualDismissalsPC ?? config?.messaging?.maxContextualDismissals ?? 2;
        const maxMobile = config?.messaging?.maxContextualDismissalsMobile ?? config?.messaging?.maxContextualDismissals ?? 2;
        const maxDismissals = isMobile ? maxMobile : maxPC;

        if (currentCount >= maxDismissals) return;

        const configKey = 'enableContextualNotifPrompt';
        if (config?.messaging?.[configKey] === false) return;

        if (type === 'notifications' && (Notification.permission === 'granted' || Notification.permission === 'denied')) return;

        const t = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(t);
    }, [user, userData, type, config, isMobile]);

    const handleAccept = async () => {
        sessionStorage.setItem(SESSION_KEYS[type], 'true');
        setVisible(false);

        if (type === 'notifications') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                const counterKey = isMobile ? 'mobile_contextualDismissCount' : 'pc_contextualDismissCount';
                await updateDoc(doc(db, 'users', user.uid), {
                    [`permissions.notifications.status`]: 'granted',
                    [`permissions.notifications.updatedAt`]: TimeService.now().getTime(),
                    [`permissions.notifications.${counterKey}`]: 0,
                    [`permissions.notifications.nextPrompt`]: 0
                });
                toast.success('¡Listo! Te avisaremos de tus premios 🎉');
                onGranted?.();
            }
        } else if (type === 'geolocation') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        await updateDoc(doc(db, 'users', user.uid), {
                            [`permissions.geolocation.status`]: 'granted',
                            [`permissions.geolocation.updatedAt`]: Date.now(),
                            [`permissions.geolocation.mobile_contextualDismissCount`]: 0,
                            [`permissions.geolocation.nextPrompt`]: 0,
                            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date() }
                        });
                        toast.success('¡Listo! Ahora podemos mostrarte beneficios cerca 📍');
                        onGranted?.();
                    },
                    async () => {
                        // Usuario rechazó el popup nativo del browser
                        await updateDoc(doc(db, 'users', user.uid), {
                            [`permissions.${type}.status`]: 'blocked',
                            [`permissions.${type}.updatedAt`]: TimeService.now().getTime(),
                        });
                    }
                );
            }
        }
    };

    // "Ahora no" — bloquea solo la sesión, pero incrementa el contador
    const handleDismiss = async () => {
        sessionStorage.setItem(SESSION_KEYS[type], 'true');
        setVisible(false);

        const counterKey = isMobile ? 'mobile_contextualDismissCount' : 'pc_contextualDismissCount';
        const currentCount = userData?.permissions?.[type]?.[counterKey] || 0;
        const newCount = currentCount + 1;

        const updateData: any = {
            [`permissions.${type}.${counterKey}`]: newCount,
            [`permissions.${type}.updatedAt`]: Date.now(),
        };

        if (isMobile) {
            updateData[`permissions.${type}.lastContextualDismissal`] = TimeService.now().getTime();
        }

        await updateDoc(doc(db, 'users', user.uid), updateData);

        const maxPC = config?.messaging?.maxContextualDismissalsPC ?? config?.messaging?.maxContextualDismissals ?? 2;
        const maxMobile = config?.messaging?.maxContextualDismissalsMobile ?? config?.messaging?.maxContextualDismissals ?? 2;
        const maxDismissals = isMobile ? maxMobile : maxPC;

        if (newCount >= maxDismissals) {
            // Entrar en standby real
            const days = config?.messaging?.notificationPromptIntervalDays || 30;
            const nextPrompt = TimeService.now().getTime() + (days * 24 * 60 * 60 * 1000);

            const updateFinal: any = {
                [`permissions.${type}.status`]: 'later_max_reached',
                [`permissions.${type}.updatedAt`]: TimeService.now().getTime(),
                [`permissions.${type}.${counterKey}`]: newCount,
                [`permissions.${type}.nextPrompt`]: nextPrompt
            };

            await updateDoc(doc(db, 'users', user.uid), updateFinal);

            const daysLabel = days === 1 ? '1 día' : `${days} días`;
            toast(`Entendido. No te molestaremos más. Te volveremos a consultar en ${daysLabel} o podés activarlo desde tu perfil.`, {
                icon: '🤝',
                duration: 5000,
                style: { borderRadius: '10px', background: '#333', color: '#fff' }
            });
            onNeverAsk?.();
        } else {
            // Solo incrementar contador, no entra en standby todavía
            await updateDoc(doc(db, 'users', user.uid), {
                [`permissions.${type}.${counterKey}`]: newCount,
                [`permissions.${type}.updatedAt`]: Date.now(),
            });
            onDismiss?.();
        }
    };

    // "No molestar" — standby inmediato sin esperar al contador
    const handleNeverAsk = async () => {
        sessionStorage.setItem(SESSION_KEYS[type], 'true');
        if (isMobile) {
            localStorage.setItem(`contextual_${type}_mobile_dismissal`, Date.now().toString());
        }
        setVisible(false);
        const days = config?.messaging?.notificationPromptIntervalDays || 30;
        const nextPrompt = Date.now() + (days * 24 * 60 * 60 * 1000);
        await updateDoc(doc(db, 'users', user.uid), {
            [`permissions.${type}.status`]: 'dismissed',
            [`permissions.${type}.updatedAt`]: Date.now(),
            [`permissions.${type}.nextPrompt`]: nextPrompt
        });
        const daysLabel = days === 1 ? '1 día' : `${days} días`;
        toast(`Entendido. Te volveremos a consultar en ${daysLabel}. (O cámbialo en tu Perfil en cualquier momento)`, {
            icon: '⏳',
            style: { borderRadius: '10px', background: '#333', color: '#fff' }
        });
        onNeverAsk?.();
    };

    if (!visible) return null;

    const isGeo = type === 'geolocation';

    return (
        <div className="fixed bottom-20 left-0 right-0 z-[150] flex justify-center px-4 animate-slide-up">
            <div className={`
                w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden
                ${isGeo ? 'bg-emerald-50 border-emerald-200' : 'bg-purple-50 border-purple-200'}
            `}>
                <div className="flex items-center gap-3 p-4">
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center flex-none
                        ${isGeo ? 'bg-emerald-500 text-white' : 'bg-purple-600 text-white'}
                    `}>
                        {isGeo ? <MapPin size={20} /> : <Bell size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        {(() => {
                            const counterKey = isMobile ? 'mobile_contextualDismissCount' : 'pc_contextualDismissCount';
                            const currentCount = userData?.permissions?.[type]?.[counterKey] || 0;
                            const maxPC = config?.messaging?.maxContextualDismissalsPC ?? config?.messaging?.maxContextualDismissals ?? 2;
                            const maxMobile = config?.messaging?.maxContextualDismissalsMobile ?? config?.messaging?.maxContextualDismissals ?? 2;
                            const maxDismissals = isMobile ? maxMobile : maxPC;

                            let label = triggerMessage;
                            if (maxDismissals > 0) {
                                if (currentCount === maxDismissals - 1) {
                                    label = "Última oportunidad para activar premios";
                                } else if (currentCount === maxDismissals - 2) {
                                    label = "Esta es la anteúltima vez que te preguntamos";
                                }
                            }

                            if (!label) return null;

                            return (
                                <p className={`text-xs font-black uppercase tracking-widest mb-0.5 ${isGeo ? 'text-emerald-600' : 'text-purple-600'}`}>
                                    {label}
                                </p>
                            );
                        })()}
                        <p className="text-sm font-semibold text-gray-800 leading-tight">
                            {isGeo
                                ? '¿Querés ver beneficios exclusivos cerca tuyo?'
                                : '¿Querés que te avisemos cuando ganás premios?'}
                        </p>
                    </div>
                    <button onClick={handleDismiss} className="p-1 text-gray-400 hover:text-gray-600 flex-none">
                        <X size={18} />
                    </button>
                </div>
                <div className={`flex border-t ${isGeo ? 'border-emerald-200' : 'border-purple-200'}`}>
                    <button
                        onClick={handleNeverAsk}
                        className="flex-1 py-2.5 text-xs font-bold text-gray-300 hover:text-gray-500 transition flex items-center justify-center gap-1"
                    >
                        <BellOff size={11} /> No molestar
                    </button>
                    <button
                        onClick={handleDismiss}
                        className="flex-1 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition border-x border-gray-200"
                    >
                        Ahora no
                    </button>
                    <button
                        onClick={handleAccept}
                        className={`flex-1 py-2.5 text-xs font-black transition
                            ${isGeo ? 'text-emerald-600 hover:text-emerald-700' : 'text-purple-600 hover:text-purple-700'}`}
                    >
                        {isGeo ? '✅ Ver beneficios' : '🔔 Activar avisos'}
                    </button>
                </div>
            </div>
        </div>
    );
};
