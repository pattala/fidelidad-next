import { useState, useEffect } from 'react';
import { Bell, MapPin, X } from 'lucide-react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

interface Props {
    user: any;
    userData: any;
    type: 'notifications' | 'geolocation';
    triggerMessage?: string; // ej: "¡Ganaste 150 puntos!"
    config?: any;
    onGranted?: () => void;
    onDismiss?: () => void;
}

const SESSION_KEYS = {
    notifications: 'contextual_notif_shown',
    geolocation: 'contextual_geo_shown',
};

export const ContextualPermissionBanner = ({
    user, userData, type, triggerMessage, config, onGranted, onDismiss
}: Props) => {
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        if (!user || !userData) return;

        // No mostrar si ya fue mostrado en esta sesión
        if (sessionStorage.getItem(SESSION_KEYS[type]) === 'true') return;

        // No mostrar si ya está concedido o bloqueado
        const status = userData.permissions?.[type]?.status;
        if (status === 'granted' || status === 'blocked') return;

        // Respetar toggle de configuración del panel
        const configKey = type === 'notifications'
            ? 'enableContextualNotifPrompt'
            : 'enableContextualGeoPrompt';
        if (config?.messaging?.[configKey] === false) return;

        // Verificar el navegador para notificaciones
        if (type === 'notifications' && Notification.permission === 'granted') return;
        if (type === 'notifications' && Notification.permission === 'denied') return;

        // Mostrar con animación
        const t = setTimeout(() => setVisible(true), 400);
        return () => clearTimeout(t);
    }, [user, userData, type, config]);

    const handleAccept = async () => {
        sessionStorage.setItem(SESSION_KEYS[type], 'true');
        setVisible(false);

        if (type === 'notifications') {
            const permission = await Notification.requestPermission();
            if (permission === 'granted') {
                await updateDoc(doc(db, 'users', user.uid), {
                    'permissions.notifications': {
                        status: 'granted',
                        updatedAt: Date.now(),
                        deniedCount: userData?.permissions?.notifications?.deniedCount || 0,
                        nextPrompt: 0
                    }
                });
                toast.success('¡Listo! Te avisaremos de tus premios 🎉');
                onGranted?.();
            }
        } else if (type === 'geolocation') {
            if ('geolocation' in navigator) {
                navigator.geolocation.getCurrentPosition(
                    async (pos) => {
                        await updateDoc(doc(db, 'users', user.uid), {
                            'permissions.geolocation': { status: 'granted', updatedAt: Date.now(), deniedCount: 0, nextPrompt: 0 },
                            lastLocation: { lat: pos.coords.latitude, lng: pos.coords.longitude, timestamp: new Date() }
                        });
                        toast.success('¡Ubicación activada! Ahora podés ver beneficios cerca 📍');
                        onGranted?.();
                    },
                    async () => {
                        await updateDoc(doc(db, 'users', user.uid), {
                            'permissions.geolocation': { status: 'dismissed', updatedAt: Date.now(), deniedCount: 0, nextPrompt: Date.now() + (30 * 24 * 3600 * 1000) }
                        });
                    }
                );
            }
        }
    };

    const handleDismiss = async () => {
        sessionStorage.setItem(SESSION_KEYS[type], 'true');
        setVisible(false);
        onDismiss?.();
    };

    if (!visible) return null;

    const isGeo = type === 'geolocation';

    return (
        <div className={`
            fixed bottom-20 left-0 right-0 z-[150] flex justify-center px-4 
            animate-slide-up
        `}>
            <div className={`
                w-full max-w-md rounded-2xl shadow-2xl border overflow-hidden
                ${isGeo
                    ? 'bg-emerald-50 border-emerald-200'
                    : 'bg-purple-50 border-purple-200'}
            `}>
                <div className="flex items-center gap-3 p-4">
                    <div className={`
                        w-10 h-10 rounded-xl flex items-center justify-center flex-none
                        ${isGeo ? 'bg-emerald-500 text-white' : 'bg-purple-600 text-white'}
                    `}>
                        {isGeo ? <MapPin size={20} /> : <Bell size={20} />}
                    </div>
                    <div className="flex-1 min-w-0">
                        {triggerMessage && (
                            <p className={`text-xs font-black uppercase tracking-widest mb-0.5 ${isGeo ? 'text-emerald-600' : 'text-purple-600'}`}>
                                {triggerMessage}
                            </p>
                        )}
                        <p className="text-sm font-semibold text-gray-800 leading-tight">
                            {isGeo
                                ? '¿Activás la ubicación para ver beneficios cerca tuyo?'
                                : '¿Querés que te avisemos cuando ganás premios?'}
                        </p>
                    </div>
                    <button
                        onClick={handleDismiss}
                        className="p-1 text-gray-400 hover:text-gray-600 flex-none"
                    >
                        <X size={18} />
                    </button>
                </div>
                <div className={`flex border-t ${isGeo ? 'border-emerald-200' : 'border-purple-200'}`}>
                    <button
                        onClick={handleDismiss}
                        className="flex-1 py-2.5 text-xs font-bold text-gray-400 hover:text-gray-600 transition"
                    >
                        Ahora no
                    </button>
                    <button
                        onClick={handleAccept}
                        className={`flex-1 py-2.5 text-xs font-black transition
                            ${isGeo ? 'text-emerald-600 hover:text-emerald-700' : 'text-purple-600 hover:text-purple-700'}`}
                    >
                        {isGeo ? '✅ Activar ubicación' : '🔔 Activar avisos'}
                    </button>
                </div>
            </div>
        </div>
    );
};
