import { useEffect, useState } from 'react';
import { Home, Gift, User, X, Mail, MapPin, Clock, Bell, LogOut, ChevronLeft, Shield } from 'lucide-react';
import toast from 'react-hot-toast';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where, addDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { useFcmToken } from '../../../hooks/useFcmToken'; // Import Hook
import { usePWAInstall } from '../../../hooks/usePWAInstall'; // Added PWA Install Hook
import { signOut } from 'firebase/auth'; // Added for Logout
import { useClientAuth } from '../contexts/ClientAuthContext';
import { ConfigService } from '../../../services/configService';

export const ClientLayout = () => {
    const { user, userData, loading: authLoading, isAdmin } = useClientAuth();
    const { deferredPrompt, handleInstall, isIOS, isStandalone, isMobile } = usePWAInstall(); // PWA Install Hook
    const [showIOSHint, setShowIOSHint] = useState(false); // Install Hint Modal
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [config, setConfig] = useState<any>({});
    const [unreadCount, setUnreadCount] = useState(0);
    const [headerTitle, setHeaderTitle] = useState<string | null>(null);
    const [headerActions, setHeaderActions] = useState<React.ReactNode | null>(null);
    const location = useLocation();
    const navigate = useNavigate();

    // Enable Push Notifications
    useFcmToken();

    // Geolocation Tracking (Passive)
    useEffect(() => {
        if (user && !isAdmin) {
            const userRef = doc(db, 'users', user.uid);
            const unsubDoc = onSnapshot(userRef, (snap) => {
                const data = snap.data();
                if (data?.permissions?.geolocation?.status === 'granted' && navigator.geolocation) {
                    const lastUpdate = data.lastLocation?.updatedAt?.toDate ? data.lastLocation.updatedAt.toDate() : new Date(0);
                    const now = new Date();
                    const diffMins = (now.getTime() - lastUpdate.getTime()) / 60000;

                    if (diffMins > 5) {
                        navigator.geolocation.getCurrentPosition(async (pos) => {
                            const { updateDoc } = await import('firebase/firestore');
                            await updateDoc(userRef, {
                                lastLocation: {
                                    lat: pos.coords.latitude,
                                    lng: pos.coords.longitude,
                                    accuracy: pos.coords.accuracy,
                                    updatedAt: new Date()
                                }
                            });
                        }, (err) => console.warn('Geo error:', err), { enableHighAccuracy: true });
                    }
                }
            });
            return () => unsubDoc();
        }
    }, [user, isAdmin]);

    // Listen for unread messages
    useEffect(() => {
        if (user) {
            let isInitialLoad = true;
            const q = query(
                collection(db, `users/${user.uid}/inbox`),
                where('read', '==', false)
            );

            const unsubMessages = onSnapshot(q, (snap) => {
                setUnreadCount(snap.size);

                if (!isInitialLoad) {
                    snap.docChanges().forEach((change) => {
                        if (change.type === "added") {
                            const data = change.doc.data();
                            toast((t) => (
                                <div
                                    onClick={() => {
                                        toast.dismiss(t.id);
                                        navigate('/inbox');
                                    }}
                                    className="cursor-pointer flex items-center gap-3 w-full"
                                >
                                    <div className="bg-purple-100 p-2 rounded-full text-purple-600">
                                        <Mail size={18} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-sm text-gray-800">{data.title || 'Nuevo Mensaje'}</p>
                                        <p className="text-xs text-gray-500 line-clamp-1">{data.body}</p>
                                    </div>
                                </div>
                            ), { duration: 5000, position: 'top-center', style: { borderRadius: '1rem' } });
                        }
                    });
                }
                isInitialLoad = false;
            });
            return () => unsubMessages();
        } else {
            setUnreadCount(0);
        }
    }, [user, navigate]);

    // Listen for global config
    useEffect(() => {
        const unsubConfig = ConfigService.subscribe((fullConfig) => {
            setConfig(fullConfig);

            // Update Favicon
            if (fullConfig.logoUrl) {
                let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                if (!link) {
                    link = document.createElement('link');
                    link.rel = 'icon';
                    document.getElementsByTagName('head')[0].appendChild(link);
                }
                link.href = fullConfig.logoUrl;
            }
        });
        return () => unsubConfig();
    }, []);

    // Scroll to Top on Route Change
    useEffect(() => {
        const mainElement = document.querySelector('main');
        if (mainElement) {
            mainElement.scrollTo({ top: 0, behavior: 'auto' });
        }
    }, [location.pathname]);

    const isActive = (path: string) => location.pathname === path;

    return (
        <div className="min-h-100dvh w-full relative flex items-center justify-center overflow-hidden">
            {/* Desktop Decorative Background Elements */}
            <div className="hidden sm:block absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-purple-600/20 blur-[120px] rounded-full animate-pulse"></div>
            <div className="hidden sm:block absolute bottom-[-5%] right-[-5%] w-[30%] h-[30%] bg-pink-600/10 blur-[100px] rounded-full"></div>

            <div
                className="flex flex-col h-[100dvh] w-full max-w-md mx-auto sm:my-6 sm:h-[calc(100dvh-3rem)] sm:rounded-[3rem] sm:shadow-[0_0_80px_rgba(0,0,0,0.5)] relative font-sans transition-all duration-500 overflow-hidden border-x border-gray-100/5 sm:border-t sm:border-white/10 z-10"
                style={{ backgroundColor: config.backgroundColor || '#f5f3f7' }}
            >

                {/* 1) Header / Top Bar (Fixed) */}
                {/* 1) Header / Top Bar (Fixed) */}
                {/* 1) Fixed Top Header (Primary Color) */}
                <header
                    className="fixed top-0 sm:top-6 left-1/2 -translate-x-1/2 w-full max-w-md h-auto z-[100] px-4 flex items-center justify-between text-white shadow-md transition-all duration-500 sm:rounded-t-[3rem]"
                    style={{
                        background: `linear-gradient(to right, ${config.primaryColor || '#4a148c'}, ${config.secondaryColor || '#880e4f'})`,
                        paddingTop: 'calc(env(safe-area-inset-top) + 0.75rem)',
                        paddingBottom: '0.75rem',
                        minHeight: 'var(--header-h)'
                    }}
                >
                    <div className="flex items-center gap-1 w-[72px] shrink-0">
                        {(location.pathname !== '/' || isContactOpen) && (
                            <button
                                onClick={() => {
                                    if (isContactOpen) {
                                        setIsContactOpen(false);
                                    } else {
                                        navigate(-1);
                                    }
                                }}
                                className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 text-white"
                            >
                                <ChevronLeft size={24} strokeWidth={2.5} />
                            </button>
                        )}
                        <div className="bg-white p-0.5 rounded-full shadow-lg ml-1 shrink-0">
                            <img
                                src={config.logoUrl || "/logo.png"}
                                alt="Logo"
                                className="h-8 w-8 object-contain rounded-full"
                                onError={(e) => e.currentTarget.src = 'https://placehold.co/100x100?text=LOGO'}
                            />
                        </div>
                    </div>

                    <div className="flex flex-col items-center flex-1 min-w-0 px-2">
                        <h1
                            className="font-black uppercase tracking-widest text-center shadow-sm truncate w-full px-2 leading-none"
                            style={{
                                fontFamily: config.siteNameFont || 'inherit',
                                fontSize: `${config.siteNameSize || 14}px`,
                                textAlign: config.siteNameAlignment || 'center',
                                display: 'block'
                            }}
                        >
                            {config?.siteName || ''}
                        </h1>
                        {userData?.isTestUser && (
                            <span className="bg-blue-600 text-white text-[7px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter flex items-center gap-0.5 shadow-sm mt-1">
                                <Shield size={8} /> Test Mode
                            </span>
                        )}
                    </div>

                    <div className="flex items-center gap-1 w-[72px] justify-end shrink-0">
                        {/* PWA Install Button (Android/Chrome) */}
                        {deferredPrompt && (
                            <button
                                onClick={handleInstall}
                                className="relative p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 group/install border border-white/10"
                                title="Instalar App"
                            >
                                <div className="relative">
                                    <img
                                        src={config.logoUrl || "/logo.png"}
                                        alt="Install"
                                        className="h-6 w-6 object-contain rounded-full opacity-80"
                                    />
                                    <div className="absolute -bottom-1 -right-1 bg-white text-blue-600 rounded-full p-0.5 shadow-md border border-gray-100 flex items-center justify-center animate-bounce-slow">
                                        <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
                                            <polyline points="7 10 12 15 17 10"></polyline>
                                            <line x1="12" y1="15" x2="12" y2="3"></line>
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* PWA Install Button (Fallback for PC & Mobile) */}
                        {!isStandalone && !deferredPrompt && (
                            <button
                                onClick={() => setShowIOSHint(true)}
                                className="relative p-1.5 rounded-xl bg-white/10 hover:bg-white/20 transition-all active:scale-95 border border-white/10"
                                title="Cómo Instalar"
                            >
                                <div className="relative">
                                    <img
                                        src={config.logoUrl || "/logo.png"}
                                        alt="Install"
                                        className="h-6 w-6 object-contain rounded-full opacity-80"
                                    />
                                    <div className="absolute -bottom-1 -right-1 bg-white text-blue-600 rounded-full p-0.5 shadow-md border border-gray-100 flex items-center justify-center animate-bounce-slow">
                                        <svg viewBox="0 0 24 24" width="10" height="10" stroke="currentColor" strokeWidth="4" fill="none" strokeLinecap="round" strokeLinejoin="round">
                                            <circle cx="12" cy="12" r="10"></circle>
                                            <line x1="12" y1="16" x2="12" y2="12"></line>
                                            <line x1="12" y1="8" x2="12.01" y2="8"></line>
                                        </svg>
                                    </div>
                                </div>
                            </button>
                        )}

                        <button
                            onClick={() => navigate('/inbox')}
                            className={`relative p-2 rounded-xl transition-all active:scale-95 ${unreadCount > 0 ? 'bg-white/10' : ''}`}
                        >
                            <Bell size={22} className={unreadCount > 0 ? 'text-yellow-400' : 'text-white'} />
                            {unreadCount > 0 && (
                                <span
                                    className="absolute -top-1 -right-1 w-5 h-5 bg-pink-600 rounded-full border-2 flex items-center justify-center text-[10px] font-black shadow-lg"
                                    style={{ borderColor: config.primaryColor || '#4a148c', color: 'white' }}
                                >
                                    {unreadCount > 9 ? '9+' : unreadCount}
                                </span>
                            )}
                        </button>
                    </div>
                </header>

                {/* 2) Fixed Action Bar (White) */}
                <div
                    className={`fixed left-1/2 -translate-x-1/2 w-full max-w-md z-50 bg-white border-b border-gray-100 shadow-sm transition-all duration-500 overflow-hidden ${headerTitle ? 'h-[var(--action-bar-h)]' : 'h-0'}`}
                    style={{ top: 'calc(env(safe-area-inset-top) + var(--header-h))' }}
                >
                    <div className="h-full px-6 flex items-center justify-between gap-4">
                        <div className="flex-1 min-w-0">
                            <h2 className="text-2xl font-black text-gray-800 tracking-tight leading-none truncate">
                                {headerTitle}
                            </h2>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-1">
                                {location.pathname === '/activity' ? 'Tus movimientos recientes' :
                                    location.pathname === '/rewards' ? 'Canjeá tus puntos por beneficios' :
                                        location.pathname === '/promos' ? 'Descubrí nuevas oportunidades' :
                                            location.pathname === '/inbox' ? 'Bandeja de mensajes' :
                                                location.pathname === '/referrals' ? 'Ganá puntos invitando' : ''}
                            </p>
                        </div>
                        <div className="flex-none">
                            {headerActions}
                        </div>
                    </div>
                </div>

                {/* 3) Main Content Area (Scrollable) */}
                <main
                    className="flex-1 overflow-y-auto pb-32 scrollbar-hide bg-white relative"
                    style={{
                        paddingTop: headerTitle ? 'calc(env(safe-area-inset-top) + var(--header-h) + var(--action-bar-h) + 1rem)' : 'calc(env(safe-area-inset-top) + var(--header-h) + 0.5rem)'
                    }}
                >
                    <div className="animate-fade-in w-full">
                        <Outlet context={{ config, setHeaderTitle, setHeaderActions }} />
                    </div>
                </main>

                {/* 3) Bottom Navigation (Fixed) */}
                <nav
                    className="fixed bottom-0 sm:bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md bg-white border-t border-gray-100 flex justify-around items-center px-2 z-40 sm:rounded-b-[3rem] sm:mb-0"
                    style={{
                        paddingTop: '0.75rem',
                        paddingBottom: 'calc(env(safe-area-inset-bottom) + 0.75rem)',
                        boxShadow: '0 -4px 20px rgba(0,0,0,0.03)'
                    }}
                >
                    <button
                        onClick={() => navigate('/')}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 flex-1 ${isActive('/') ? '' : 'text-gray-400'}`}
                        style={{ color: isActive('/') ? (config.primaryColor || '#4a148c') : undefined }}
                    >
                        <Home size={20} strokeWidth={2.5} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Inicio</span>
                    </button>

                    <button
                        onClick={() => navigate('/rewards')}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 flex-1 ${isActive('/rewards') ? '' : 'text-gray-400'}`}
                        style={{ color: isActive('/rewards') ? (config.primaryColor || '#4a148c') : undefined }}
                    >
                        <Gift size={20} strokeWidth={isActive('/rewards') ? 2.5 : 2} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Premios</span>
                    </button>

                    <button
                        onClick={() => setIsContactOpen(true)}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 flex-1 ${isContactOpen ? '' : 'text-gray-400'}`}
                        style={{ color: isContactOpen ? (config.primaryColor || '#4a148c') : undefined }}
                    >
                        <div
                            className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${isContactOpen ? '' : 'border-gray-400'}`}
                            style={{ borderColor: isContactOpen ? (config.primaryColor || '#4a148c') : undefined }}
                        >
                            <div
                                className={`w-1 h-1 rounded-full ${isContactOpen ? '' : 'bg-gray-400'}`}
                                style={{ backgroundColor: isContactOpen ? (config.primaryColor || '#4a148c') : undefined }}
                            ></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter">Contacto</span>
                    </button>

                    <button
                        onClick={() => navigate('/activity')}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 flex-1 ${isActive('/activity') ? '' : 'text-gray-400'}`}
                        style={{ color: isActive('/activity') ? (config.primaryColor || '#4a148c') : undefined }}
                    >
                        <div
                            className={`grid grid-cols-2 gap-0.5 p-0.5 rounded transition-colors ${isActive('/activity') ? '' : 'bg-gray-400'}`}
                            style={{ backgroundColor: isActive('/activity') ? (config.primaryColor || '#4a148c') : undefined }}
                        >
                            <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>
                            <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>
                            <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>
                            <div className="w-1.5 h-1.5 bg-white rounded-[1px]"></div>
                        </div>
                        <span className="text-[10px] font-black uppercase tracking-tighter">Actividad</span>
                    </button>

                    <button
                        onClick={() => navigate('/profile')}
                        className={`flex flex-col items-center gap-1.5 transition-all duration-300 flex-1 ${isActive('/profile') ? '' : 'text-gray-400'}`}
                        style={{ color: isActive('/profile') ? (config.primaryColor || '#4a148c') : undefined }}
                    >
                        <User size={20} strokeWidth={isActive('/profile') ? 2.5 : 2} />
                        <span className="text-[10px] font-black uppercase tracking-tighter">Perfil</span>
                    </button>
                </nav>

                {/* Contact Modal */}
                {isContactOpen && (
                    <div className="absolute inset-0 z-[110] flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                        <div
                            className="bg-white w-full max-h-[90dvh] rounded-t-[3rem] shadow-2xl relative flex flex-col animate-in-up"
                            style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 2rem)' }}
                        >
                            {/* Modal Header */}
                            <div className="p-8 pb-4 flex-none relative">
                                <button
                                    onClick={() => setIsContactOpen(false)}
                                    className="absolute top-8 right-8 text-gray-400 hover:text-gray-600 transition"
                                >
                                    <X size={24} />
                                </button>

                                <h2
                                    className="text-2xl font-black uppercase tracking-tight mb-1"
                                    style={{ color: config.primaryColor || '#4a148c' }}
                                >
                                    Canales de Atención
                                </h2>
                                <p className="text-gray-500 text-sm font-medium">¿En qué podemos ayudarte hoy?</p>
                            </div>

                            {/* Modal Content */}
                            <div className="flex-1 overflow-y-auto px-8 space-y-4 pr-3 scrollbar-hide">
                                {/* Address & Hours (New) */}
                                {(config?.contact?.address || config?.contact?.openingHours) && (
                                    <div className="space-y-3 mb-4">
                                        {config?.contact?.address && (
                                            <a
                                                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(config.contact.address)}`}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-3xl border border-gray-100 active:scale-95 transition group hover:shadow-md cursor-pointer"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-gray-500 p-3 rounded-2xl text-white shadow-lg shadow-gray-200 group-hover:bg-gray-600 transition">
                                                        <MapPin size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Ubicación</p>
                                                        <p className="text-xs text-gray-600 font-bold max-w-[200px] line-clamp-2">{config.contact.address}</p>
                                                        <p className="text-[10px] text-blue-600 font-black mt-1 uppercase tracking-tight flex items-center gap-1">
                                                            Mira cómo llegar <span>↗</span>
                                                        </p>
                                                    </div>
                                                </div>
                                                <span className="text-gray-400 group-hover:translate-x-1 transition text-xl">›</span>
                                            </a>
                                        )}
                                        {config?.contact?.openingHours && (
                                            <div className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-3xl border border-gray-100">
                                                <div className="flex items-center gap-4">
                                                    <div className="bg-gray-500 p-3 rounded-2xl text-white shadow-lg shadow-gray-200">
                                                        <Clock size={24} />
                                                    </div>
                                                    <div className="text-left">
                                                        <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Horarios</p>
                                                        <p className="text-xs text-gray-600 font-bold max-w-[200px]">{config.contact.openingHours}</p>
                                                    </div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {/* WhatsApp */}
                                <a
                                    href={`https://api.whatsapp.com/send?phone=${config?.contact?.whatsapp?.replace(/\D/g, '') || ''}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full flex items-center justify-between p-4 bg-green-50 rounded-3xl group active:scale-95 transition border border-green-100"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-green-500 p-3 rounded-2xl text-white shadow-lg shadow-green-200">
                                            <span className="text-xl">💬</span>
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-gray-800 uppercase text-xs tracking-widest">WhatsApp</p>
                                            <p className="text-xs text-green-700 font-bold">{config?.contact?.whatsapp || 'Chat directo'}</p>
                                        </div>
                                    </div>
                                    <span className="text-green-400 group-hover:translate-x-1 transition text-xl">›</span>
                                </a>

                                {/* Email */}
                                <a
                                    href={`mailto:${config?.contact?.email || ''}`}
                                    className="w-full flex items-center justify-between p-4 bg-blue-50 rounded-3xl group active:scale-95 transition border border-blue-100"
                                >
                                    <div className="flex items-center gap-4">
                                        <div className="bg-blue-500 p-3 rounded-2xl text-white shadow-lg shadow-blue-200">
                                            <Mail size={24} />
                                        </div>
                                        <div className="text-left">
                                            <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Email</p>
                                            <p className="text-xs text-blue-700 font-bold break-all line-clamp-1">{config?.contact?.email || 'Enviar correo'}</p>
                                        </div>
                                    </div>
                                    <span className="text-blue-400 group-hover:translate-x-1 transition text-xl">›</span>
                                </a>

                                {/* Instagram */}
                                {config?.contact?.instagram && (
                                    <a
                                        href={`https://instagram.com/${config.contact.instagram.replace('@', '')}`}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-between p-4 bg-pink-50 rounded-3xl group active:scale-95 transition border border-pink-100"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-gradient-to-tr from-yellow-400 via-red-500 to-purple-500 p-3 rounded-2xl text-white shadow-lg shadow-pink-200">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="20" height="20" x="2" y="2" rx="5" ry="5" /><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" /><line x1="17.5" x2="17.51" y1="6.5" y2="6.5" /></svg>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Instagram</p>
                                                <p className="text-xs text-pink-700 font-bold">{config.contact.instagram}</p>
                                            </div>
                                        </div>
                                        <span className="text-pink-400 group-hover:translate-x-1 transition text-xl">›</span>
                                    </a>
                                )}

                                {/* Facebook */}
                                {config?.contact?.facebook && (
                                    <a
                                        href={config.contact.facebook}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-between p-4 bg-indigo-50 rounded-3xl group active:scale-95 transition border border-indigo-100"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-indigo-600 p-3 rounded-2xl text-white shadow-lg shadow-indigo-200">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" /></svg>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Facebook</p>
                                                <p className="text-xs text-indigo-700 font-bold">Seguinos</p>
                                            </div>
                                        </div>
                                        <span className="text-indigo-400 group-hover:translate-x-1 transition text-xl">›</span>
                                    </a>
                                )}

                                {/* Website */}
                                {config?.contact?.website && (
                                    <a
                                        href={config.contact.website}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="w-full flex items-center justify-between p-4 bg-gray-50 rounded-3xl group active:scale-95 transition border border-gray-100"
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className="bg-gray-500 p-3 rounded-2xl text-white shadow-lg shadow-gray-200">
                                                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><line x1="2" x2="22" y1="12" y2="12" /><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z" /></svg>
                                            </div>
                                            <div className="text-left">
                                                <p className="font-black text-gray-800 uppercase text-xs tracking-widest">Web</p>
                                                <p className="text-xs text-gray-600 font-bold">Visitar sitio</p>
                                            </div>
                                        </div>
                                        <span className="text-gray-400 group-hover:translate-x-1 transition text-xl">›</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </div>
                )}
                {/* iOS Install Guide Modal */}
                {showIOSHint && (
                    <div className="absolute inset-0 z-[150] flex items-center justify-center bg-black/60 backdrop-blur-sm px-6 animate-fade-in">
                        <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl relative animate-in-up">
                            <button
                                onClick={() => setShowIOSHint(false)}
                                className="absolute top-6 right-6 text-gray-400 hover:text-gray-600"
                            >
                                <X size={24} />
                            </button>

                            <div className="flex flex-col items-center text-center">
                                <div className="bg-blue-50 p-4 rounded-3xl mb-6">
                                    <div className="relative">
                                        <img src={config.logoUrl || "/logo.png"} alt="App" className="h-16 w-16 rounded-2xl shadow-lg" />
                                        <div className="absolute -bottom-2 -right-2 bg-blue-600 text-white rounded-full p-1.5 border-4 border-white shadow-md">
                                            <Gift size={20} />
                                        </div>
                                    </div>
                                </div>

                                <h2 className="text-xl font-black text-gray-800 mb-2 uppercase tracking-tight">Instalá la App</h2>
                                <p className="text-sm text-gray-500 font-medium mb-8">Seguí estos 3 pasos para agregarla a tu pantalla de inicio:</p>

                                <div className="w-full space-y-6 text-left">
                                    {isIOS ? (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">1</div>
                                                <p className="text-sm font-bold text-gray-700">Tocá el botón <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 font-black">Compartir <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"></path><polyline points="16 6 12 2 8 6"></polyline><line x1="12" y1="2" x2="12" y2="15"></line></svg></span></p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">2</div>
                                                <p className="text-sm font-bold text-gray-700">Buscá y tocá en <span className="text-gray-900 underline font-black">"Agregar al Inicio"</span></p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">3</div>
                                                <p className="text-sm font-bold text-gray-700">Dale a <span className="text-blue-600 font-black">"Agregar"</span> arriba a la derecha</p>
                                            </div>
                                        </>
                                    ) : isMobile ? (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">1</div>
                                                <p className="text-sm font-bold text-gray-700">Tocá los <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 font-black">3 puntos <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="1.5"></circle><circle cx="12" cy="7" r="1.5"></circle><circle cx="12" cy="17" r="1.5"></circle></svg></span> (arriba o abajo)</p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">2</div>
                                                <p className="text-sm font-bold text-gray-700">Buscá el ícono de <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 font-black">Instalar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M12 8v8"></path><path d="m8 12 4 4 4-4"></path></svg></span></p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">3</div>
                                                <p className="text-sm font-bold text-gray-700">Confirmá en <span className="text-blue-600 font-black">"Instalar"</span></p>
                                            </div>
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">1</div>
                                                <p className="text-sm font-bold text-gray-700">Buscá el ícono de <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg inline-flex items-center gap-1 font-black">Instalar <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"></rect><line x1="8" y1="21" x2="16" y2="21"></line><line x1="12" y1="17" x2="12" y2="21"></line><path d="m9 10 3 3 3-3"></path><path d="M12 7v6"></path></svg></span></p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">2</div>
                                                <p className="text-sm font-bold text-gray-700">Lo vas a ver arriba en la <span className="text-gray-900 underline font-black">barra de direcciones</span></p>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center font-black flex-shrink-0">3</div>
                                                <p className="text-sm font-bold text-gray-700">Dale a <span className="text-blue-600 font-black">"Instalar"</span> en el aviso</p>
                                            </div>
                                        </>
                                    )}
                                </div>

                                <button
                                    onClick={() => setShowIOSHint(false)}
                                    className="mt-10 w-full py-4 bg-gray-900 text-white rounded-2xl font-black uppercase tracking-widest text-xs active:scale-95 transition-all shadow-xl"
                                >
                                    ¡Entendido!
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
