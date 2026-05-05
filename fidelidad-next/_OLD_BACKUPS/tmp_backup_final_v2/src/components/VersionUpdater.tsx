import { useEffect } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import toast from 'react-hot-toast';

/**
 * VersionUpdater
 * Componente que verifica si hay una nueva versión de la aplicación disponible
 * y gestiona el refresco automático o notificado.
 */
export const VersionUpdater = () => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('[PWA] Service Worker registrado');
            // Verificar actualizaciones cada 5 minutos
            if (r) {
                setInterval(() => {
                    console.log('[PWA] Verificando actualizaciones...');
                    r.update();
                }, 5 * 60 * 1000);
            }
        },
        onRegisterError(error) {
            console.error('[PWA] Error en registro de SW:', error);
        },
    });

    useEffect(() => {
        if (offlineReady) {
            toast.success('Aplicación lista para usar sin conexión', {
                icon: '💾',
                duration: 4000
            });
            setOfflineReady(false);
        }
    }, [offlineReady, setOfflineReady]);

    useEffect(() => {
        if (needRefresh) {
            console.log('[PWA] Nueva versión detectada');

            // Mostrar un toast con acción para actualizar
            toast((t) => (
                <div className="flex flex-col gap-2">
                    <span className="font-bold text-sm">
                        🚀 ¡Nueva versión disponible!
                    </span>
                    <p className="text-xs opacity-80">
                        Actualiza para ver los últimos cambios y mejoras.
                    </p>
                    <div className="flex gap-2 mt-1">
                        <button
                            onClick={() => {
                                updateServiceWorker(true);
                                toast.dismiss(t.id);
                            }}
                            className="bg-purple-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold shadow-lg shadow-purple-200 active:scale-95 transition-all"
                        >
                            Actualizar ahora
                        </button>
                        <button
                            onClick={() => toast.dismiss(t.id)}
                            className="bg-gray-100 text-gray-600 px-3 py-1.5 rounded-lg text-xs font-bold active:scale-95 transition-all"
                        >
                            Más tarde
                        </button>
                    </div>
                </div>
            ), {
                duration: Infinity,
                position: 'bottom-right',
                id: 'pwa-update-toast'
            });
        }
    }, [needRefresh, updateServiceWorker]);

    return null; // Este componente no renderiza nada visual directamente al DOM
};

export default VersionUpdater;
