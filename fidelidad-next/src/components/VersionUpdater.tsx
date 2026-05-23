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

    // Función para comparar versiones tipo "V.1.4.59"
    const isNewer = (remote: string, local: string): boolean => {
        try {
            const clean = (v: string) => v.replace(/[^0-9.]/g, '').split('.').map(Number);
            const r = clean(remote);
            const l = clean(local);
            
            for (let i = 0; i < Math.max(r.length, l.length); i++) {
                const rv = r[i] || 0;
                const lv = l[i] || 0;
                if (rv > lv) return true;
                if (rv < lv) return false;
            }
            return false;
        } catch (e) {
            return remote !== local; // Fallback
        }
    };

    // AGGRESSIVE CHECK: Compare local APP_VERSION with Firestore version
    useEffect(() => {
        const checkVersion = async () => {
            try {
                const config = await ConfigService.get();
                const latest = (config as any).latestVersion || APP_VERSION;
                
                if (isNewer(latest, APP_VERSION)) {
                    console.log(`[PWA] Nueva versión disponible: Local=${APP_VERSION}, Remote=${latest}`);
                    setRemoteVersion(latest);
                } else {
                    // Si la remota es igual o vieja, limpiar el estado de remoteVersion
                    if (remoteVersion) setRemoteVersion(null);
                }
            } catch (err) {
                console.error('[PWA] Error verificando versión remota:', err);
            }
        };

        checkVersion();
        const interval = setInterval(checkVersion, 2 * 60 * 1000); // Cada 2 minutos
        return () => clearInterval(interval);
    }, [remoteVersion]);

    const handleUpdate = async (toastId: string) => {
        toast.dismiss(toastId);
        console.log('[PWA] Iniciando Hard Reset programático de PWA...');
        
        // 1. Desregistrar todos los Service Workers activos
        if ('serviceWorker' in navigator) {
            try {
                const registrations = await navigator.serviceWorker.getRegistrations();
                for (const registration of registrations) {
                    await registration.unregister();
                }
                console.log('[PWA] Service Workers desregistrados con éxito.');
            } catch (e) {
                console.error('[PWA] Error desregistrando SW:', e);
            }
        }
        
        // 2. Eliminar todas las memorias Caché físicas (Cache Storage API)
        if ('caches' in window) {
            try {
                const keys = await caches.keys();
                for (const key of keys) {
                    await caches.delete(key);
                }
                console.log('[PWA] Memoria Caché eliminada con éxito.');
            } catch (e) {
                console.error('[PWA] Error eliminando Caché:', e);
            }
        }
        
        // 3. Forzar la recarga completa salteando la caché del navegador
        window.location.reload();
    };

    useEffect(() => {
        if (needRefresh || (remoteVersion && isNewer(remoteVersion, APP_VERSION))) {
            console.log('[PWA] Mostrando aviso de actualización programática');
            
            // Si ya hay un toast, no duplicar
            if (toast.hasOwnProperty('pwa-update-toast')) return;

            toast((t) => (
                <div className="flex flex-col gap-2">
                    <span className="font-bold text-sm">
                        ⚠️ ¡Nueva versión disponible! {remoteVersion || ''}
                    </span>
                    <p className="text-xs opacity-80">
                        Hay cambios importantes. Actualiza para ver las mejoras.
                    </p>
                    <div className="flex gap-2 mt-1">
                        <button
                            onClick={() => handleUpdate(t.id)}
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

    return null; // Este componente no renderiza nada visual directamente al DOM
};

export default VersionUpdater;
