import { useState, useEffect } from 'react';
import { Outlet, NavLink, useNavigate, useLocation } from 'react-router-dom';
import { Home, Users, Gift, Settings, LogOut, MessageCircle, BarChart3, ChevronDown, ChevronRight, Clock } from 'lucide-react';
import { auth } from '../../../lib/firebase';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';

export const AdminLayout = () => {
    const navigate = useNavigate();
    const location = useLocation();
    const [isMessagingOpen, setIsMessagingOpen] = useState(false);
    const [currentTime, setCurrentTime] = useState(new Date());
    const [config, setConfig] = useState<any>(null);
    const [simulatedOffset, setSimulatedOffset] = useState(0);

    useEffect(() => {
        ConfigService.get().then(setConfig);
        setSimulatedOffset(TimeService.getOffsetInDays());
    }, []);

    // Auto-open if active
    useEffect(() => {
        if (location.pathname.includes('/admin/whatsapp') || location.pathname.includes('/admin/push')) {
            setIsMessagingOpen(true);
        }
    }, [location.pathname]);

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
        <div className="flex h-screen bg-gray-100">
            {/* Sidebar */}
            <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
                <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center gap-2 text-blue-600 font-bold text-xl">
                        {config?.logoUrl ? (
                            <img src={config.logoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                        ) : (
                            <span>🛡️</span>
                        )}
                        Admin Panel
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
                        <Gift size={20} /> Catálogo de Premios
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
                                    Notificaciones Push
                                </NavLink>
                            </div>
                        )}
                    </div>

                    <NavLink to="/admin/config" className={navItemClass}>
                        <Settings size={20} /> Configuración
                    </NavLink>
                </nav>

                {/* SIMULATION CONTROLS */}
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

                <div className="p-4 border-t border-gray-100">
                    <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-3 w-full text-left text-red-600 hover:bg-red-50 rounded-lg transition"
                    >
                        <LogOut size={20} /> Cerrar Sesión
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                <header className="bg-white shadow-sm p-4 flex justify-between items-center px-8">
                    <h2 className="text-gray-800 font-semibold">Fidelidad V2 - Gestión</h2>
                    <div className="text-sm text-gray-500">
                        {auth.currentUser?.email}
                    </div>
                </header>
                <div className="p-8">
                    <Outlet />
                </div>
            </main>
        </div>
    );
};
