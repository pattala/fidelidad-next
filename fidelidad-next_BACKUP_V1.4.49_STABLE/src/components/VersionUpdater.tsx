import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import toast from 'react-hot-toast';
import { APP_VERSION } from '../lib/adminConfig';
import { ConfigService } from '../services/configService';

/**
 * VersionUpdater
 * Componente que verifica si hay una nueva versión de la aplicación disponible
 * y gestiona el refresco automático o notificado.
 */
export const VersionUpdater = () => {
    const [remoteVersion, setRemoteVersion] = useState<string | null>(null);

    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r) {
            console.log('[PWA] Service Worker registrado');
            if (r) {
                // Check SW updates every 3 minutes
                setInterval(() => {
                    console.log('[PWA] Verificando actualización de Service Worker...');
                    r.update();
                }, 3 * 60 * 1000);
            }
        },
    });

    // AGGRESSIVE CHECK: Compare local APP_VERSION with Firestore version
    useEffect(() => {
        const checkVersion = async () => {
            try {
                const config = await ConfigService.get();
                const latest = (config as any).latestVersion || APP_VERSION;
                
                if (latest !== APP_VERSION) {
                    console.log(`[PWA] Diferencia de versión detectada: Local=${APP_VERSION}, Remote=${latest}`);
                    setRemoteVersion(latest);
                }
            } catch (err) {
                console.error('[PWA] Error verificando versión remota:', err);
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, 2 * 60 * 1000); // Cada 2 minutos
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        if (needRefresh || (remoteVersion && remoteVersion !== APP_VERSION)) {
            console.log('[PWA] Nueva versión detectada (SW o Firestore)');
            
            // Si ya hay un toast, no duplicar
            if (toast.hasOwnProperty('pwa-update-toast')) return;

            toast((t) => (
                <div className="flex flex-col gap-2">
                    <span className="font-bold text-sm">
                        🚀 ¡Nueva versión disponible! {remoteVersion || ''}
                    </span>
                    <p className="text-xs opacity-80">
                        Hay cambios importantes. Actualiza para ver las mejoras.
                    </p>
                    <div className="flex gap-2 mt-1">
                        <button
                            onClick={() => {
                                if (needRefresh) {
                                    updateServiceWorker(true);
                                } else {
                                    window.location.reload();
                                }
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
    }, [needRefresh, remoteVersion, updateServiceWorker]);

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
