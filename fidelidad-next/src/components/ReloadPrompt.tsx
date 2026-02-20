import React from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { RefreshCw, X } from 'lucide-react';

export const ReloadPrompt = () => {
    const {
        offlineReady: [offlineReady, setOfflineReady],
        needRefresh: [needRefresh, setNeedRefresh],
        updateServiceWorker,
    } = useRegisterSW({
        onRegistered(r: ServiceWorkerRegistration | undefined) {
            console.log('SW Registered:', r);
        },
        onRegisterError(error: any) {
            console.log('SW registration error', error);
        },
    });

    const close = () => {
        setOfflineReady(false);
        setNeedRefresh(false);
    };

    if (!offlineReady && !needRefresh) return null;

    return (
        <div className="fixed bottom-4 right-4 z-[9999] animate-bounce-in">
            <div className="bg-white rounded-3xl p-6 shadow-2xl border border-gray-100 flex flex-col gap-4 max-w-sm">
                <div className="flex items-start justify-between gap-4">
                    <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                        <RefreshCw size={24} className={needRefresh ? 'animate-spin-slow' : ''} />
                    </div>
                    <button onClick={close} className="p-1 hover:bg-gray-100 rounded-full transition-colors">
                        <X size={20} className="text-gray-400" />
                    </button>
                </div>

                <div>
                    <h3 className="font-black text-gray-800 text-lg leading-tight">
                        {needRefresh ? '¡Nueva versión disponible!' : 'App lista para usar offline'}
                    </h3>
                    <p className="text-sm text-gray-500 font-medium mt-1">
                        {needRefresh
                            ? 'Hay cambios importantes. Actualiza para disfrutar de las últimas mejoras y correcciones.'
                            : 'La aplicación ha sido cacheada y ahora puedes usarla sin conexión.'}
                    </p>
                </div>

                {needRefresh && (
                    <button
                        onClick={() => updateServiceWorker(true)}
                        className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black py-4 rounded-2xl shadow-lg shadow-blue-200 transition-all active:scale-95 flex items-center justify-center gap-2 uppercase tracking-widest text-xs"
                    >
                        Actualizar ahora
                    </button>
                )}
            </div>
        </div>
    );
};
