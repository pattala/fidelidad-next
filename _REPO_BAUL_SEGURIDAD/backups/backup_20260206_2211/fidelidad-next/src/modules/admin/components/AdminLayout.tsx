import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, User, Gift, Settings, LogOut, MessageCircle, BarChart3, ChevronDown, ChevronRight, Clock, Menu, X } from 'lucide-react';
import { auth, db } from '../../../lib/firebase';
import { signOut } from 'firebase/auth';
import { onSnapshot, doc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';
import { useAdminAuth } from '../contexts/AdminAuthContext';

export const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const { role } = useAdminAuth();
    const [isMessagingOpen, setIsMessagingOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [config, setConfig] = useState<any>(null);
    const [simulatedOffset, setSimulatedOffset] = useState(0);

    // Mobile Sidebar State
    const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

    // Favicon & Config Sync
    useEffect(() => {
        setSimulatedOffset(TimeService.getOffsetInDays());
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

    // Auto-open messaging if active
    useEffect(() => {
        if (location.pathname.includes('/admin/whatsapp') || location.pathname.includes('/admin/push')) {
            setIsMessagingOpen(true);
        }
        setIsMobileMenuOpen(false);
    }, [location.pathname]);

    // Role Label Mapping
    const getRoleLabel = () => {
        switch (role) {
            case 'admin': return 'Admin';
            case 'editor': return 'Editor';
            case 'viewer': return 'Solo Ver';
            default: return 'Usuario';
        }
    };

    // Clock
    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        return () => clearInterval(timer);
    }, []);

    const handleLogout = async () => {
        await signOut(auth);
        toast.success('Sesión cerrada');
        navigate('/admin');
    };

    const updateSimulation = (days: number) => {
        const newOffset = simulatedOffset + days;
        TimeService.setOffsetInDays(newOffset);
        setSimulatedOffset(newOffset);
        window.location.reload();
    };

    const resetSimulation = () => {
        TimeService.reset();
        setSimulatedOffset(0);
        window.location.reload();
    };

    const simulatedDate = TimeService.now();

    const navItemClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${isActive ? 'bg-blue-50 text-blue-600 font-medium' : 'text-gray-600 hover:bg-gray-50'
        }`;

    const subNavItemClass = ({ isActive }: { isActive: boolean }) =>
        `flex items-center gap-3 px-4 py-2 rounded-lg transition-colors text-sm ${isActive ? 'text-blue-600 font-medium bg-blue-50/50' : 'text-gray-500 hover:bg-gray-50'
        }`;

    return (
        <div className="flex h-screen bg-gray-100 relative overflow-hidden">
            {/* Mobile Overlay */}
            {isMobileMenuOpen && (
                <div
                    className="fixed inset-0 bg-black/50 z-40 md:hidden animate-fade-in backdrop-blur-sm"
                    onClick={() => setIsMobileMenuOpen(false)}
                />
            )}

            {/* Sidebar */}
            <aside
                className={`fixed inset-y-0 left-0 z-50 w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 md:translate-x-0 md:static ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}
            >
                <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 md:bg-white">
                    <div>
                        <div className="flex items-center gap-2 text-blue-600 font-bold text-xl uppercase tracking-tighter">
                            {config?.logoUrl ? (
                                <img src={config.logoUrl} alt="Logo" className="w-8 h-8 object-contain rounded-lg" />
                            ) : (
                                <span>🛡️</span>
                            )}
                            {getRoleLabel()}
                        </div>
                        {/* Live Date/Time */}
                        <div className="mt-2 text-xs text-gray-400 font-medium flex items-center gap-1">
                            <Clock size={12} />
                            {currentTime.toLocaleString('es-AR', {
                                day: '2-digit', month: '2-digit', year: 'numeric',
                                hour: '2-digit', minute: '2-digit'
                            })}
                        </div>
                    </div>
                    {/* Close Button Mobile */}
                    <button
                        onClick={() => setIsMobileMenuOpen(false)}
                        className="md:hidden text-gray-400 hover:text-gray-600 bg-white p-2 rounded-full shadow-sm"
                    >
                        <X size={20} />
                    </button>
                </div>

                <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
                    <NavLink to="/admin/dashboard" className={navItemClass}>
                        <Home size={20} /> Dashboard
                    </NavLink>
                    <NavLink to="/admin/clients" className={navItemClass}>
                        <Users size={20} /> Clientes
                    </NavLink>
                    <NavLink to="/admin/metrics" className={navItemClass}>
                        <BarChart3 size={20} /> Métricas
                    </NavLink>
                    <NavLink to="/admin/prizes" className={navItemClass}>
                        <Gift size={20} /> Catálogo
                    </NavLink>
                    <NavLink to="/admin/campaigns" className={navItemClass}>
                        <MessageCircle size={20} /> Campañas
                    </NavLink>

                    {/* Messaging Group */}
                    <div>
                        <button
                            onClick={() => setIsMessagingOpen(!isMessagingOpen)}
                            className={`w-full flex items-center justify-between px-4 py-3 rounded-lg transition-colors text-gray-600 hover:bg-gray-50 ${isMessagingOpen ? 'bg-gray-50' : ''}`}
                        >
                            <div className="flex items-center gap-3">
                                <span className="text-xl">💬</span>
                                <span>Mensajería</span>
                            </div>
                            {isMessagingOpen ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
                        </button>

                        {isMessagingOpen && (
                            <div className="ml-8 mt-1 space-y-1 border-l-2 border-gray-100 pl-2">
                                <NavLink to="/admin/whatsapp" className={subNavItemClass}>
                                    WhatsApp
                                </NavLink>
                                <NavLink to="/admin/push" className={subNavItemClass}>
                                    Push
                                </NavLink>
                            </div>
                        )}
                    </div>

                    <NavLink to="/admin/profile" className={navItemClass}>
                        <User size={20} /> Mi Perfil
                    </NavLink>

                    {role === 'admin' && (
                        <NavLink to="/admin/config" className={navItemClass}>
                            <Settings size={20} /> Configuración
                        </NavLink>
                    )}
                </nav>

                {role === 'admin' && (
                    <div className="p-4 border-t border-gray-200 bg-purple-50">
                        <p className="text-[10px] font-bold text-purple-800 uppercase tracking-wider mb-2">Simulador de Fecha</p>
                        <div className="text-xs text-gray-600 mb-2">
                            <div className="flex justify-between">
                                <span>Hoy Real:</span>
                                <span>{new Date().toLocaleDateString()}</span>
                            </div>
                            <div className="flex justify-between font-bold text-purple-700">
                                <span>Simulado:</span>
                                <span>{simulatedDate.toLocaleDateString()}</span>
                            </div>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={() => updateSimulation(-1)} className="flex-1 bg-white border border-purple-200 text-purple-700 rounded px-2 py-1 text-xs hover:bg-purple-100">-1 Día</button>
                            <button onClick={() => updateSimulation(1)} className="flex-1 bg-white border border-purple-200 text-purple-700 rounded px-2 py-1 text-xs hover:bg-purple-100">+1 Día</button>
                        </div>
                        {simulatedOffset !== 0 && (
                            <button onClick={resetSimulation} className="w-full mt-2 bg-purple-200 text-purple-800 rounded px-2 py-1 text-[10px] uppercase font-bold hover:bg-purple-300">
                                Resetear Fecha
                            </button>
                        )}
                    </div>
                )}

                <div className="p-4 border-t border-gray-100 bg-white">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                        <LogOut size={20} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col w-full min-w-0 bg-gray-50">
                <header className="bg-white shadow-sm p-4 flex items-center justify-between px-4 md:px-8 shrink-0 z-30 relative">
                    <div className="flex items-center gap-4">
                        <button
                            onClick={() => setIsMobileMenuOpen(true)}
                            className="md:hidden text-gray-600 hover:text-blue-600 transition bg-gray-100 p-2 rounded-lg"
                        >
                            <Menu size={24} />
                        </button>
                        <h2 className="text-gray-800 font-bold text-lg md:text-xl truncate">
                            {config?.siteName || 'Panel de Control'}
                        </h2>
                    </div>

                    <div className="text-sm text-gray-500 hidden md:block">
                        {auth.currentUser?.email}
                    </div>
                </header>

                <div className="flex-1 overflow-auto p-4 md:p-8">
                    <div className="max-w-7xl mx-auto w-full">
                        <Outlet />
                    </div>
                </div>
            </main>
        </div>
    );
};
