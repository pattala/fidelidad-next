import { useState, useEffect } from 'react';

export const usePWAInstall = () => {
    const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
    const [isInstalled, setIsInstalled] = useState(false);

    useEffect(() => {
        const handler = (e: any) => {
            e.preventDefault();
            setDeferredPrompt(e);
            console.log('PWA: beforeinstallprompt event captured');
        };

        const installedHandler = () => {
            console.log('PWA: Apple/Android App installed successfully');
            setIsInstalled(true);
            setDeferredPrompt(null);
        };

        window.addEventListener('beforeinstallprompt', handler);
        window.addEventListener('appinstalled', installedHandler);

        // Check if app is already running in standalone mode (already installed)
        if (window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone) {
            setIsInstalled(true);
            setDeferredPrompt(null);
        }

        return () => {
            window.removeEventListener('beforeinstallprompt', handler);
            window.removeEventListener('appinstalled', installedHandler);
        };
    }, []);

    const handleInstall = async () => {
        if (!deferredPrompt) return;
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`PWA: User response to install prompt: ${outcome}`);
        setDeferredPrompt(null);
        if (outcome === 'accepted') {
            setIsInstalled(true);
        }
    };

    const isStandalone = isInstalled || window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone;
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !(window as any).MSStream;
    const isMobile = isIOS || /Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

    return { deferredPrompt, handleInstall, isIOS, isStandalone, isMobile, isInstalled };
};
