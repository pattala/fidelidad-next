import React, { useEffect, useState } from 'react';
import { Bell, X, Check } from 'lucide-react';
import toast from 'react-hot-toast';

/**
 * Lógica de negocio (Local Storage):
 * - Status: 'pending' | 'granted' | 'later' (Ahora No) | 'denied' (No) | 'blocked' (Bloqueado x 2 intentos)
 * - 'notification_status': Estado actual.
 * - 'notification_denied_count': Cantidad de veces que dijo "No".
 * - 'notification_next_prompt': Fecha (timestamp) para volver a preguntar (solo para 'denied').
 */

interface Props {
    onPermissionGranted: () => void;
}

export const NotificationPermissionPrompt = ({ onPermissionGranted }: Props) => {
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        checkPermissionStatus();
    }, []);

    const checkPermissionStatus = () => {
        // 1. Si el navegador ya tiene permiso nativo, no hacemos nada (o actualizamos estado interno)
        if (Notification.permission === 'granted') {
            localStorage.setItem('notification_status', 'granted');
            return;
        }

        // 2. Si el navegador está bloqueado nativamente, no podemos hacer nada
        if (Notification.permission === 'denied') {
            return;
        }

        const status = localStorage.getItem('notification_status') || 'pending';
        const deniedCount = parseInt(localStorage.getItem('notification_denied_count') || '0');
        const nextPromptStr = localStorage.getItem('notification_next_prompt');
        const nextPrompt = nextPromptStr ? parseInt(nextPromptStr) : 0;
        const now = Date.now();

        // Lógica de visualización
        if (status === 'blocked') return; // Bloqueo definitivo (2 veces NO)

        if (status === 'later') {
            // "Ahora no": Se muestra en la próxima sesión (que es esta, si recargó la pág)
            // Para no ser tan molestos en la MISMA sesión, usamos un sessionStorage flag?
            // O asumimos que si se montó el componente es una "sesión" nueva o recarga.
            setIsOpen(true);
            return;
        }

        if (status === 'denied') {
            // "No": Verificamos si pasó el tiempo X (ej. 7 días)
            if (now > nextPrompt) {
                setIsOpen(true);
            }
            return;
        }

        if (status === 'pending') {
            // Primera vez
            setIsOpen(true);
        }
    };

    const handleYes = async () => {
        setIsOpen(false);
        // Pedir permiso nativo
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            localStorage.setItem('notification_status', 'granted');
            toast.success('¡Genial! Te avisaremos de ofertas.');
            onPermissionGranted(); // Callback para obtener token
        } else {
            // Usuario aceptó en UI pero canceló en navegador
            // Lo tratamos como un 'later' para no castigarlo
            localStorage.setItem('notification_status', 'later');
        }
    };

    const handleLater = () => {
        // "Ahora no": Guardamos estado para volver a preguntar en prox sesión
        localStorage.setItem('notification_status', 'later');
        setIsOpen(false);
    };

    const handleNo = () => {
        // "No": Incrementamos contador y seteamos fecha futura
        const currentCount = parseInt(localStorage.getItem('notification_denied_count') || '0') + 1;
        localStorage.setItem('notification_denied_count', currentCount.toString());

        if (currentCount >= 2) {
            // Bloqueo definitivo
            localStorage.setItem('notification_status', 'blocked');
            toast('Entendido. No te volveremos a preguntar.', { icon: 'silence' });
        } else {
            // Bloqueo temporal (ej. 7 días)
            const DAYS_TO_WAIT = 7;
            const nextDate = Date.now() + (DAYS_TO_WAIT * 24 * 60 * 60 * 1000);
            localStorage.setItem('notification_status', 'denied');
            localStorage.setItem('notification_next_prompt', nextDate.toString());
        }
        setIsOpen(false);
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-sm rounded-[2rem] p-6 shadow-2xl animate-scale-up relative overflow-hidden">

                {/* Decorative Background */}
                <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-br from-purple-100 to-indigo-50 -z-10"></div>
                <div className="w-24 h-24 bg-purple-200 rounded-full blur-2xl absolute -top-10 -right-10 opacity-50"></div>

                <div className="text-center mb-6 pt-4">
                    <div className="w-16 h-16 bg-white rounded-2xl shadow-lg mx-auto flex items-center justify-center mb-4 text-purple-600 relative">
                        <Bell size={32} className="animate-bounce-slow" />
                        <span className="absolute top-0 right-0 w-4 h-4 bg-red-500 rounded-full border-2 border-white"></span>
                    </div>
                    <h3 className="text-xl font-black text-gray-800 leading-tight mb-2">
                        ¡No te pierdas nada!
                    </h3>
                    <p className="text-sm text-gray-500 leading-relaxed px-2">
                        Activa las notificaciones para saber al instante cuando ganes premios o recibas promos exclusivas.
                    </p>
                </div>

                <div className="space-y-3">
                    <button
                        onClick={handleYes}
                        className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-xl font-bold shadow-lg shadow-purple-200 active:scale-[0.98] transition flex items-center justify-center gap-2"
                    >
                        <Check size={20} />
                        ¡Sí, activar ahora!
                    </button>

                    <button
                        onClick={handleLater}
                        className="w-full py-3 bg-white border-2 border-gray-100 text-gray-600 rounded-xl font-bold hover:bg-gray-50 transition active:scale-[0.98]"
                    >
                        Ahora no (Próxima vez)
                    </button>

                    <button
                        onClick={handleNo}
                        className="w-full py-2 text-xs font-bold text-gray-400 hover:text-red-400 transition"
                    >
                        No me interesa
                    </button>
                </div>
            </div>
        </div>
    );
};
