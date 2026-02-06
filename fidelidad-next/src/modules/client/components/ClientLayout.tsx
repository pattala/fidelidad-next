import { useEffect, useState } from 'react';
import { Home, Gift, User, X, Mail, MapPin, Clock, Bell } from 'lucide-react';
import toast from 'react-hot-toast';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { doc, onSnapshot, collection, query, where } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { useFcmToken } from '../../../hooks/useFcmToken'; // Import Hook

export const ClientLayout = () => {
    const [isContactOpen, setIsContactOpen] = useState(false);
    const [config, setConfig] = useState<any>({});
    const [unreadCount, setUnreadCount] = useState(0);
    const location = useLocation();
    const navigate = useNavigate();

    // Enable Push Notifications
    useFcmToken();

    // Geolocation Tracking (Passive)
    useEffect(() => {
        let watchId: number;
        const unsubscribeAuth = auth.onAuthStateChanged(async (user) => {
            if (user) {
                const userDoc = await onSnapshot(doc(db, 'users', user.uid), (snap) => {
                    const data = snap.data();
                    if (data?.permissions?.geolocation?.status === 'granted' && navigator.geolocation) {
                        const lastUpdate = data.lastLocation?.updatedAt?.toDate ? data.lastLocation.updatedAt.toDate() : new Date(0);
                        const now = new Date();
                        const diffMins = (now.getTime() - lastUpdate.getTime()) / 60000;

                        if (diffMins > 5) { // Only update every 5 minutes to avoid loops
                            navigator.geolocation.getCurrentPosition(async (pos) => {
                                const { updateDoc } = await import('firebase/firestore');
                                await updateDoc(doc(db, 'users', user.uid), {
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
                return () => userDoc();
            }
        });
        return () => unsubscribeAuth();
    }, []);

    // Listen for unread messages
    useEffect(() => {
        let unsubMessages: (() => void) | undefined;
        let isInitialLoad = true;

        const unsubscribeAuth = auth.onAuthStateChanged((user) => {
            if (user) {
                const q = query(
                    collection(db, `users/${user.uid}/inbox`),
                    where('read', '==', false)
                );

                unsubMessages = onSnapshot(q, (snap) => {
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
            } else {
                if (unsubMessages) unsubMessages();
                setUnreadCount(0);
                isInitialLoad = true;
            }
        });

        return () => {
            unsubscribeAuth();
            if (unsubMessages) unsubMessages();
        };
    }, [navigate]);

    // Listen for global config
    useEffect(() => {
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setConfig(data);

                // Update Favicon
                if (data.logoUrl) {
                    let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement;
                    if (!link) {
                        link = document.createElement('link');
                        link.rel = 'icon';
                        document.getElementsByTagName('head')[0].appendChild(link);
                    }
                    link.href = data.logoUrl;
                }
            }
        });
        return () => unsubConfig();
    }, []);

    const isActive = (path: string) => location.pathname === path;

    return (
        <div
            className="flex flex-col h-[100dvh] max-w-md mx-auto shadow-2xl relative font-sans transition-colors duration-500"
            style={{ backgroundColor: config.backgroundColor || '#f5f3f7' }}
        >

            {/* 1) Header / Top Bar (Fixed) */}
            {/* 1) Header / Top Bar (Fixed) */}
            <header
                className="px-4 py-5 flex-none z-20 flex items-center justify-between text-white shadow-xl transition-all duration-500"
                style={{ background: `linear-gradient(to right, ${config.primaryColor || '#4a148c'}, ${config.secondaryColor || '#880e4f'})` }}
            >
                <div className="w-10">
                    <div className="bg-white p-0.5 rounded-full shadow-lg">
                        <img
                            src={config.logoUrl || "/logo.png"}
                            alt="Logo"
                            className="h-8 w-8 object-contain rounded-full"
                            onError={(e) => e.currentTarget.src = 'https://placehold.co/100x100?text=LOGO'}
                        />
                    </div>
                </div>

                <h1 className="font-extrabold text-lg uppercase tracking-wider text-center flex-1 drop-shadow-md">
                    {config?.siteName || 'Club de Fidelidad'}
                </h1>

                <div className="w-10 flex justify-end">
                    <button
                        onClick={() => navigate('/inbox')}
                        className={`relative p-2 rounded-xl transition-all active:scale-95 ${unreadCount > 0 ? 'animate-pulse bg-white/10' : ''}`}
                    >
                        <Bell size={22} className={unreadCount > 0 ? 'text-yellow-400' : 'text-white'} />
                        {unreadCount > 0 && (
                            <span
                                className="absolute -top-1 -right-1 w-5 h-5 bg-pink-600 rounded-full border-2 flex items-center justify-center text-[10px] font-black shadow-lg animate-bounce"
                                style={{ borderColor: config.primaryColor || '#4a148c', color: 'white' }}
                            >
                                {unreadCount > 9 ? '9+' : unreadCount}
                            </span>
                        )}
                    </button>
                </div>
            </header>

            {/* 2) Main Content Area (Scrollable) */}
            <main className="flex-1 overflow-y-auto pb-6 scrollbar-hide">
                <div className="animate-fade-in">
                    <Outlet context={{ config }} />
                </div>
            </main>

            {/* 3) Bottom Navigation (Fixed) */}
            <nav className="flex-none bg-white border-t border-gray-100 flex justify-around items-center px-2 py-3 shadow-[0_-4px_20px_rgba(0,0,0,0.03)] z-40">
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
                <div className="absolute inset-0 z-50 flex items-end justify-center bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full rounded-t-[3rem] p-8 pb-12 animate-in-up shadow-2xl relative">
                        <button
                            onClick={() => setIsContactOpen(false)}
                            className="absolute top-6 right-8 text-gray-400 hover:text-gray-600 transition"
                        >
                            <X size={24} />
                        </button>

                        <h2
                            className="text-2xl font-black uppercase tracking-tight mb-2"
                            style={{ color: config.primaryColor || '#4a148c' }}
                        >
                            Canales de Atención
                        </h2>
                        <p className="text-gray-500 text-sm mb-8 font-medium">¿En qué podemos ayudarte hoy?</p>

                        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
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
        </div>
    );
};
