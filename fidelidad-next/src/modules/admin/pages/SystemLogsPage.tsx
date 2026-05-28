import React, { useEffect, useState, useMemo } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { Clock, CheckCircle, AlertTriangle, User, MessageCircle, ArrowRight, ChevronDown, ChevronUp, History, Search, Calendar, Filter, Loader2, Play, Settings, Cake, Eraser, Trash2, Activity } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TimeService } from '../../../services/timeService';
import { useNavigate } from 'react-router-dom';
import { ConfigService } from '../../../services/configService';

interface AuditDetail {
    userId?: string;
    userName?: string;
    action: string;
    status: string;
    info?: string;
    channels?: string[];
    messageSent?: string;
    breakdown?: string;
    isItinerancy?: boolean;
}

interface AuditLog {
    id: string;
    timestamp: any;
    type: string;
    status: string;
    summary: string;
    details: AuditDetail[];
    executor: string;
    role?: string;
}

export const SystemLogsPage = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    // Filters State
    const [typeFilter, setTypeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');
    const [isCleared, setIsCleared] = useState(false);

    // Engine & Configuration State
    const [isRunningExpirations, setIsRunningExpirations] = useState(false);
    const [ignoreDeduplication, setIgnoreDeduplication] = useState(false);
    const [isSavingConfig, setIsSavingConfig] = useState(false);
    const [config, setConfig] = useState<any>(null);
    const [lastHeartbeat, setLastHeartbeat] = useState<Date | null>(null);

    useEffect(() => {
        const hbRef = doc(db, 'config', 'engineCheck');
        const unsub = onSnapshot(hbRef, snap => {
            if (snap.exists() && snap.data().lastRunTimestamp) {
                setLastHeartbeat(snap.data().lastRunTimestamp.toDate());
            }
        });
        return () => unsub();
    }, []);

    const handleRunEngine = async () => {
        if (!window.confirm("¿Deseas ejecutar ahora el Motor Unificado? Esto procesará Cumpleaños, Vencimientos, Campañas y Alertas de Mascotas en un solo paso.")) return;

        setIsRunningExpirations(true);
        const toastId = toast.loading('Ejecutando Motor Unificado...');
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/engine-daily?mode=daily&trigger=dashboard', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || '',
                    'Authorization': `Bearer ${token}`,
                    'x-executor-role': (auth.currentUser as any)?.reloadUserInfo?.customAttributes?.includes('editor') ? 'editor' : 'admin'
                },
                body: JSON.stringify({
                    simulatedDate: TimeService.now().toLocaleDateString('en-CA'),
                    isManual: true,
                    ignoreDeduplication: ignoreDeduplication
                })
            });
            const data = await res.json();
            if (data.ok) {
                toast.success('Motor ejecutado con éxito.', { id: toastId });
                setTimeout(fetchLogs, 1500);
            } else {
                toast.error(`Error: ${data.error}`, { id: toastId });
            }
        } catch (e) {
            toast.error('Error de conexión', { id: toastId });
        } finally {
            setIsRunningExpirations(false);
        }
    };

    useEffect(() => {
        const loadConfig = async () => {
            const cfg = await ConfigService.get();
            setConfig(cfg);
            setIgnoreDeduplication(cfg.enableDuplicateControl === false);
        };
        loadConfig();
    }, []);

    const toggleDeduplication = async () => {
        const newValue = !ignoreDeduplication;
        setIgnoreDeduplication(newValue);
        setIsSavingConfig(true);
        try {
            const config = await ConfigService.get();
            await ConfigService.save({
                ...config,
                enableDuplicateControl: !newValue // enableDuplicateControl es lo opuesto a ignoreDeduplication
            });
            toast.success(newValue ? 'Control de duplicidad desactivado GLOBALMENTE' : 'Control de duplicidad activado');
        } catch (e) {
            toast.error('Error al guardar configuración');
            setIgnoreDeduplication(!newValue);
        } finally {
            setIsSavingConfig(false);
        }
    };

    const handleCleanFutureSimulations = async () => {
        if (!window.confirm("¿Deseas borrar los registros de simulaciones futuras? Esto desbloqueará el motor para esos días y limpiará la vista.")) return;
        
        setIsSavingConfig(true);
        const toastId = toast.loading('Buscando simulaciones futuras...');
        try {
            const n = TimeService.now();
            const todayStr = `${n.getFullYear()}-${String(n.getMonth() + 1).padStart(2, '0')}-${String(n.getDate()).padStart(2, '0')}`;
            
            // Limitamos a los últimos 5000 para no sobrecargar el navegador
            const q = query(collection(db, 'audit_logs'), orderBy('timestamp', 'desc'), limit(5000));
            const snap = await getDocs(q);
            
            let count = 0;
            let checked = 0;
            const promises: any[] = [];
            snap.forEach(d => {
                checked++;
                const id = d.id;
                // Borrar daily_alerts futuros
                if (id.startsWith('daily_alerts_')) {
                    const datePart = id.replace('daily_alerts_', '');
                    if (datePart > todayStr) {
                        promises.push(deleteDoc(d.ref));
                        count++;
                    }
                } else {
                    const data = d.data();
                    
                    // 1. Borrar si el timestamp de la base de datos está en el futuro (usado por engine-campaigns)
                    if (data.timestamp && data.timestamp.toDate) {
                        const logDate = data.timestamp.toDate();
                        const logDateStr = `${logDate.getFullYear()}-${String(logDate.getMonth() + 1).padStart(2, '0')}-${String(logDate.getDate()).padStart(2, '0')}`;
                        if (logDateStr > todayStr) {
                            promises.push(deleteDoc(d.ref));
                            count++;
                            return; // Return temprano para no procesar el mismo documento dos veces
                        }
                    }

                    // 2. Borrar logs del historial que sean de un simulador futuro (usado por engine-daily)
                    if (data.simulated && data.executor?.includes('SIMULADOR')) {
                        const matchLatino = data.executor.match(/\((\d{2})\/(\d{2})\/(\d{4})\)/);
                        const matchIso = data.executor.match(/\((\d{4})-(\d{2})-(\d{2})\)/);
                        
                        let simDate = '';
                        if (matchLatino) {
                            simDate = `${matchLatino[3]}-${matchLatino[2]}-${matchLatino[1]}`;
                        } else if (matchIso) {
                            simDate = `${matchIso[1]}-${matchIso[2]}-${matchIso[3]}`;
                        }
                        
                        if (simDate && simDate > todayStr) {
                            promises.push(deleteDoc(d.ref));
                            count++;
                        }
                    }
                }
            });
            
            await Promise.all(promises);
            toast.success(`Se revisaron ${checked} registros y se borraron ${count} del futuro.`, { id: toastId, duration: 5000 });
            setIsCleared(false);
            // Pequeña pausa para que Firebase procese y la vista se refresque
            setTimeout(() => fetchLogs(), 1500);
        } catch(e) {
            console.error(e);
            toast.error('Error al limpiar simulaciones', { id: toastId });
        } finally {
            setIsSavingConfig(false);
        }
    };

    useEffect(() => {
        let isInitialLoad = true;
        setLoading(true);
        const q = query(
            collection(db, 'audit_logs'),
            orderBy('timestamp', 'desc'),
            limit(500) // Reduced limit slightly for better real-time performance
        );

        const unsubscribe = onSnapshot(q, (snap) => {
            const data = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));
            setLogs(data);
            
            if (!isInitialLoad) {
                const hasNew = snap.docChanges().some(change => change.type === 'added');
                if (hasNew) {
                    setIsCleared(false); // Auto-revelar la pantalla si entra un log nuevo
                }
            }
            isInitialLoad = false;
            setLoading(false);
        }, (err) => {
            console.error("Error listening to logs:", err);
            toast.error('Error al conectar con la auditoría en tiempo vivo');
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const fetchLogs = () => {
        setIsCleared(false);
        toast.success('Auditoría sincronizada en tiempo real');
    };

    // Filtrado local (JS) - "Itemización" en tiempo real
    const filteredLogs = useMemo(() => {
        if (isCleared) return [];
        return logs.filter(log => {
            // 1. Filtro por Tipo
            if (typeFilter && log.type !== typeFilter) return false;

            // 2. Filtro por Búsqueda (Summary o Executor)
            if (searchQuery) {
                const search = searchQuery.toLowerCase();
                const inSummary = log.summary?.toLowerCase().includes(search);
                const inExecutor = log.executor?.toLowerCase().includes(search);
                if (!inSummary && !inExecutor) return false;
            }

            // 3. Filtro por Fecha
            if (startDate || endDate) {
                const logDate = log.timestamp?.toDate ? log.timestamp.toDate() : new Date();
                logDate.setHours(0, 0, 0, 0);

                if (startDate) {
                    const start = new Date(startDate + 'T00:00:00');
                    start.setHours(0, 0, 0, 0);
                    if (logDate < start) return false;
                }
                if (endDate) {
                    const end = new Date(endDate + 'T00:00:00');
                    end.setHours(0, 0, 0, 0);
                    if (logDate > end) return false;
                }
            }

            return true;
        });
    }, [logs, typeFilter, searchQuery, startDate, endDate, isCleared]);

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        // El handleSearch ahora es redundante porque useMemo ya filtra en vivo,
        // pero lo dejamos por compatibilidad con el botón de la lupa.
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'expiration_engine': return 'Motor de Vencimientos (Auto)';
            case 'manual_expiration': return 'Revisión Simulada (Auto)';
            case 'session_refresh_check': return 'Revisión Automática (Sesión)';
            case 'birthday_engine': return 'Proceso de Cumpleaños (Auto)';
            case 'manual_birthday': return 'Saludador Manual (Admin)';
            case 'manual_birthday_gift': return 'Regalo de Cumpleaños Manual';
            case 'push_notification': return 'Notificación Push';
            case 'inbox_message': return 'Mensaje en Inbox';
            case 'email_notification': return 'Correo Electrónico';
            case 'whatsapp_notification': return 'WhatsApp (Auto)';
            case 'whatsapp_manual': return 'WhatsApp (Manual)';
            case 'user_mgmt': return 'Usuarios / Historial';
            case 'user_updated_profile': return 'Perfil de Usuario Editado';
            case 'client_deleted': return 'Cliente Borrado Definitivamente';
            case 'points_history_deleted': return 'Ajuste Manual: Ítem de Historial Borrado';
            case 'points_history_reset': return 'Ajuste Manual: Historial Reseteado';
            case 'points_assignment': return 'Asignación de Puntos';
            case 'prizes_redemption': return 'Canje de Premio';
            case 'daily_check_info': return 'Motor al día (Check)';
            case 'daily_engine_run': return 'Motor Diario (Ejecutado)';
            case 'campaign_broadcast': return 'Difusión Masiva (Campaña)';
            case 'campaign_mgmt': return 'Campaña (Activación/Desact)';
            case 'campaign_created': return 'Campaña (Nueva)';
            case 'campaign_updated': return 'Campaña (Editada)';
            case 'campaign_deleted': return 'Campaña (Borrada)';
            case 'campaign_diffusion': return 'Campaña (Difusión Manual)';
            case 'data_export': return 'Exportación de Datos';
            case 'config_updated': return 'Configuración Actualizada';
            case 'prize_created': return 'Premio Creado';
            case 'prize_updated': return 'Premio Actualizado';
            case 'prize_deleted': return 'Premio Eliminado';
            default: return (type || 'Acción').replace(/_/g, ' ');
        }
    };

    const getStatusIcon = (status: string, type?: string) => {
        if (status === 'skipped') return <Clock size={18} className="text-slate-400" />;
        if (status === 'disabled') return <AlertTriangle size={18} className="text-orange-400" />;
        if (status === 'failed') return <AlertTriangle size={18} className="text-red-500" />;
        if (status === 'link_ready') return <MessageCircle size={18} className="text-blue-500" />;

        if (type === 'push_notification') return <MessageCircle size={18} className="text-blue-500" />;
        if (type === 'inbox_message') return <MessageCircle size={18} className="text-purple-500" />;
        if (status === 'success') return <CheckCircle size={18} className="text-green-500" />;
        if (status === 'partial') return <AlertTriangle size={18} className="text-amber-500" />;
        return <AlertTriangle size={18} className="text-red-500" />;
    };

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Auditoría del Sistema</h1>
                    <div className="flex items-center gap-2 mt-1">
                        <p className="text-gray-500 text-sm">Historial de procesos y acciones del servidor</p>
                        {lastHeartbeat && (
                            <div className="flex items-center gap-1.5 ml-4 px-2 py-0.5 bg-green-50 border border-green-100 rounded-md" title="Indica la última vez que QStash verificó el estado (Watchdog)">
                                <Activity size={14} className="text-green-500 animate-pulse" />
                                <span className="text-[11px] font-bold text-green-700">
                                    Motor Activo (Último latido: {lastHeartbeat.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })})
                                </span>
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRunEngine}
                        disabled={isRunningExpirations}
                        className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-black transition-all shadow-lg shadow-purple-100 font-bold text-sm disabled:opacity-50"
                        title="Ejecutar Cumpleaños, Vencimientos, Campañas y Mascotas"
                    >
                        {isRunningExpirations ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                        <span className="hidden sm:inline">Ejecutar Motor Unificado</span>
                    </button>

                    <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg">
                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Duplicidad</span>
                        <button
                            onClick={toggleDeduplication}
                            disabled={isSavingConfig}
                            className={`relative inline-flex h-5 w-10 items-center rounded-full transition-colors focus:outline-none ${ignoreDeduplication ? 'bg-red-500' : 'bg-green-500'} ${isSavingConfig ? 'opacity-50' : ''}`}
                        >
                            <span
                                className={`${ignoreDeduplication ? 'translate-x-5' : 'translate-x-1'
                                    } inline-block h-3 w-3 transform rounded-full bg-white transition-transform`}
                            />
                        </button>
                        <span className={`text-[10px] font-bold uppercase ${ignoreDeduplication ? 'text-red-500' : 'text-green-500'}`}>
                            {ignoreDeduplication ? 'Ignorada (Global)' : 'Activa (Seguro)'}
                        </span>
                    </div>
                    <button
                        onClick={handleCleanFutureSimulations}
                        disabled={isSavingConfig}
                        className={`p-2 hover:bg-orange-50 text-orange-500 rounded-lg transition border border-orange-100 bg-white ${isSavingConfig ? 'opacity-50' : ''}`}
                        title="Borrar simulaciones del futuro (Desbloquear motor)"
                    >
                        <Trash2 size={20} />
                    </button>
                    <button
                        onClick={() => {
                            setIsCleared(true);
                            toast.success('Pantalla limpiada. Usa "Refrescar" para volver a cargar los datos.');
                        }}
                        className="p-2 hover:bg-red-50 text-red-500 rounded-lg transition border border-red-100 bg-white"
                        title="Limpiar pantalla localmente"
                    >
                        <Eraser size={20} />
                    </button>
                    <button
                        onClick={() => fetchLogs()}
                        className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 border border-gray-100 bg-white"
                        title="Refrescar logs"
                    >
                        <History size={20} />
                    </button>
                </div>
            </div>

            {/* Filters UI */}
            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
                <form onSubmit={handleSearch} className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 space-y-1 w-full">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Buscar en Resumen</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Escribe para buscar..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                            />
                        </div>
                    </div>

                    <div className="w-full md:w-48 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Tipo de Evento</label>
                        <select
                            value={typeFilter}
                            onChange={e => setTypeFilter(e.target.value)}
                            className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm font-medium text-gray-700"
                        >
                            <option value="">Todos los tipos</option>
                            <option value="expiration_engine">Vencimientos Auto</option>
                            <option value="points_assignment">Asignación de Puntos</option>
                            <option value="prizes_redemption">Canjes de Premios</option>
                            <option value="campaign_mgmt">Campañas (Act/Des)</option>
                            <option value="campaign_created">Campañas (Nuevas)</option>
                            <option value="campaign_updated">Campañas (Editadas)</option>
                            <option value="campaign_deleted">Campañas (Borradas)</option>
                            <option value="campaign_diffusion">Campañas (Difusión)</option>
                            <option value="user_mgmt">Usuarios / Historial (General)</option>
                            <option value="user_updated_profile">Usuarios (Edición Perfil)</option>
                            <option value="points_history_deleted">Historial (Ajustes/Borrados)</option>
                            <option value="client_deleted">Clientes (Borrado Permanente)</option>
                            <option value="data_export">Exportación Excel</option>
                            <option value="config_updated">Ajustes / Config</option>
                            <option value="prize_created">Premios</option>
                        </select>
                    </div>

                    <div className="flex gap-2 w-full md:w-auto">
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Desde</label>
                            <input
                                type="date"
                                value={startDate}
                                onChange={e => setStartDate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                            />
                        </div>
                        <div className="flex-1 space-y-1">
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Hasta</label>
                            <input
                                type="date"
                                value={endDate}
                                onChange={e => setEndDate(e.target.value)}
                                className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        className="p-2.5 bg-blue-600 text-white rounded-lg hover:bg-black transition-colors shadow-lg shadow-blue-100"
                    >
                        <Search size={18} />
                    </button>
                    {(typeFilter || startDate || endDate || searchQuery) && (
                        <button
                            type="button"
                            onClick={() => {
                                setTypeFilter('');
                                setStartDate('');
                                setEndDate('');
                                setSearchQuery('');
                            }}
                            className="p-2.5 bg-gray-100 text-gray-500 rounded-lg hover:bg-gray-200 transition-colors"
                            title="Limpiar filtros"
                        >
                            <Filter size={18} />
                        </button>
                    )}
                </form>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center animate-pulse text-gray-400">Cargando registros...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-20 text-center text-gray-400">
                        <Clock size={48} className="mx-auto mb-4 opacity-20" />
                        <p>{logs.length > 0 ? 'No hay registros que coincidan con los filtros.' : 'No hay registros de auditoría aún.'}</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {(() => {
                            // Agrupar logs por fecha (D/M/A)
                            const groupedLogs: { [key: string]: AuditLog[] } = {};
                            filteredLogs.forEach(log => {
                                const dateStr = log.timestamp?.toDate
                                    ? log.timestamp.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' })
                                    : 'Reciente';
                                if (!groupedLogs[dateStr]) groupedLogs[dateStr] = [];
                                groupedLogs[dateStr].push(log);
                            });

                            return Object.keys(groupedLogs).map(dateKey => (
                                <div key={dateKey}>
                                    <div className="bg-gray-50/80 px-4 py-2 border-y border-gray-100 flex items-center gap-2">
                                        <Calendar size={12} className="text-gray-400" />
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{dateKey}</span>
                                    </div>
                                    <div className="divide-y divide-gray-50">
                                        {groupedLogs[dateKey].map((log) => (
                                            <div key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                                <div
                                                    className="p-4 flex items-center gap-4 cursor-pointer"
                                                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                                >
                                                    {getStatusIcon(log.status, log.type)}
                                                    <div className="flex-1">
                                                        <div className="flex items-center gap-2">
                                                            <span className="font-bold text-gray-700 text-sm">{getTypeLabel(log.type)}</span>

                                                            {/* Identificadores rápidos (si es log de un solo socio) */}
                                                            {(() => {
                                                                if (!log.details || log.details.length === 0) return null;
                                                                const first = log.details[0] as any;
                                                                const isManualOp = log.type === 'points_assignment' || log.type === 'prize_redemption' || log.type === 'whatsapp_manual';

                                                                if (isManualOp && first.userId && first.userId !== 'system') {
                                                                    return (
                                                                        <div className="flex items-center gap-1">
                                                                            {first.socioNumber && (
                                                                                <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded font-black border border-blue-100">
                                                                                    #{first.socioNumber}
                                                                                </span>
                                                                            )}
                                                                            {first.dni && (
                                                                                <span className="text-[10px] text-gray-400 font-bold ml-1">
                                                                                    DNI: {first.dni}
                                                                                </span>
                                                                            )}
                                                                        </div>
                                                                    );
                                                                }
                                                                return null;
                                                            })()}

                                                            {log.status !== 'success' && (
                                                                <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${log.status === 'skipped' ? 'bg-slate-100 text-slate-500' :
                                                                    log.status === 'disabled' ? 'bg-orange-100 text-orange-600' :
                                                                        log.status === 'failed' ? 'bg-red-100 text-red-600' :
                                                                            log.status === 'link_ready' ? 'bg-blue-100 text-blue-600' :
                                                                                'bg-gray-100 text-gray-500'
                                                                    }`}>
                                                                    {log.status}
                                                                </span>
                                                            )}
                                                            <div className="flex flex-col items-end ml-auto">
                                                                <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
                                                                    {log.executor === 'system' ? 'SISTEMA' :
                                                                        log.executor?.startsWith('Ejecución') ? log.executor?.toUpperCase() :
                                                                            log.role === 'admin' ? 'ADMIN' :
                                                                                log.role === 'editor' ? 'OPERADOR' :
                                                                                    log.role === 'viewer' ? 'VISOR' :
                                                                                        (log.executor?.includes('@') || (log.executor?.length || 0) > 15) ? 'ADMIN / OPERADOR' :
                                                                                            (log.executor?.toUpperCase() || 'DESCONOCIDO')}
                                                                </span>
                                                                {(log.executor && log.executor !== 'system' && (log.executor.includes('@') || log.executor.length > 15)) && (
                                                                    <span className="text-[9px] text-gray-400 font-bold mt-0.5 px-1 truncate max-w-[150px] bg-gray-50/50 rounded" title={log.executor}>
                                                                        {log.executor}
                                                                    </span>
                                                                )}
                                                            </div>
                                                        </div>
                                                        <p className="text-xs text-gray-500 mt-0.5">{log.summary}</p>
                                                    </div>
                                                    <div className="text-right">
                                                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                                                            {log.timestamp?.toDate ? `${log.timestamp.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })} ${log.timestamp.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}` : 'Reciente'}
                                                        </p>
                                                        <div className="flex justify-end mt-1">
                                                            {expandedLog === log.id ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                                                        </div>
                                                    </div>
                                                </div>

                                                {expandedLog === log.id && (
                                                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1">
                                                        <div className="bg-gray-50 rounded-lg p-4 space-y-4 border border-blue-50">
                                                            {log.details && log.details.length > 0 ? (
                                                                (() => {
                                                                    const groupedByUser: { [key: string]: { info: any, actions: any[] } } = {};

                                                                    log.details.forEach((d: any) => {
                                                                          if (d.affectedUsers && Array.isArray(d.affectedUsers)) {
                                                                              d.affectedUsers.forEach((u: any) => {
                                                                                  const uid = u.id || 'unknown';
                                                                                  if (!groupedByUser[uid]) {
                                                                                      groupedByUser[uid] = {
                                                                                          info: { name: u.name || 'Socio', email: u.email || '' },
                                                                                          actions: []
                                                                                      };
                                                                                  }
                                                                                  groupedByUser[uid].actions.push({...d, affectedUsers: undefined});
                                                                              });
                                                                              return;
                                                                          }
                                                                        const uid = d.userId || 'system';
                                                                        if (!groupedByUser[uid]) {
                                                                            groupedByUser[uid] = {
                                                                                info: {
                                                                                    name: d.userName || 'Socio',
                                                                                    dni: d.dni || '',
                                                                                    socioNumber: d.socioNumber || ''
                                                                                },
                                                                                actions: []
                                                                            };
                                                                        }
                                                                        groupedByUser[uid].actions.push(d);
                                                                    });

                                                                    let actualUserCount = Object.keys(groupedByUser).filter(uid => uid !== 'system').length;
                                                                    if (log.type === 'campaign_broadcast') {
                                                                        const firstDetail = log.details?.[0];
                                                                        if (firstDetail) {
                                                                            actualUserCount = firstDetail.userCount ?? firstDetail.notifiedCount ?? 0;
                                                                        }
                                                                    }

                                                                    return (
                                                                        <div className="space-y-4">
                                                                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-1 flex items-center gap-1">
                                                                                <ArrowRight size={10} /> Socios Afectados ({actualUserCount})
                                                                            </h4>

                                                                            <div className="space-y-4 max-h-80 overflow-y-auto pr-2 scrollbar-thin">
                                                                                {Object.keys(groupedByUser).map(uid => (
                                                                                    <div key={uid} className="bg-white rounded-lg border border-gray-100 overflow-hidden shadow-sm">
                                                                                        <div className={`px-3 py-2 border-b flex flex-wrap items-center gap-x-3 gap-y-1 ${uid === 'system' ? 'bg-blue-600/5 border-blue-100' : 'bg-gray-50/50 border-gray-100'}`}>
                                                                                            <div className="flex items-center gap-2">
                                                                                                {uid === 'system' ? (
                                                                                                    <Settings size={14} className="text-blue-600 animate-spin-slow" />
                                                                                                ) : (
                                                                                                    <User size={14} className="text-blue-500" />
                                                                                                )}
                                                                                                <span className={`font-bold text-xs ${uid === 'system' ? 'text-blue-700' : 'text-gray-800'}`}>
                                                                                                    {uid === 'system' ? '⚙️ PROCESO DE SISTEMA' : groupedByUser[uid].info.name}
                                                                                                </span>
                                                                                            </div>
                                                                                            {uid !== 'system' && groupedByUser[uid].info.socioNumber && (
                                                                                                <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-black tracking-tight">
                                                                                                    SOCIO: {groupedByUser[uid].info.socioNumber}
                                                                                                </span>
                                                                                            )}
                                                                                            {uid !== 'system' && groupedByUser[uid].info.dni && (
                                                                                                <span className="text-[10px] text-gray-400 font-bold">
                                                                                                    DNI: {groupedByUser[uid].info.dni}
                                                                                                </span>
                                                                                            )}
                                                                                            <span className="text-[9px] text-gray-300 ml-auto uppercase font-bold tracking-tighter">
                                                                                                {uid === 'system' ? 'Kernell' : `ID: ${uid.slice(-6)}`}
                                                                                            </span>
                                                                                        </div>
                                                                                        <div className="p-2 space-y-2">
                                                                                            {groupedByUser[uid].actions.map((detail, idx) => (
                                                                                                <div key={idx} className="flex flex-col gap-1 pl-2 border-l-2 border-blue-100 py-1">
                                                                                                    <div className="flex items-center justify-between gap-2">
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            {detail.action === 'notified_expiration' ? (
                                                                                                                <span className={`px-2 py-0.5 rounded uppercase font-black text-[8px] shadow-sm border ${(detail.isItinerancy || detail.info?.includes('[ITINERANCIA]'))
                                                                                                                    ? 'bg-red-100 text-red-700 border-red-200'
                                                                                                                    : 'bg-green-100 text-green-700 border-green-200'
                                                                                                                    }`}>
                                                                                                                    {(detail.isItinerancy || detail.info?.includes('[ITINERANCIA]')) ? '⚠️ ITINERANCIA' : '✅ PRIMER ENVÍO'}
                                                                                                                </span>
                                                                                                            ) : (
                                                                                                                <span className={`px-1.5 py-0.5 rounded-full uppercase font-black text-[8px] border shadow-sm ${detail.status === 'success' ? 'bg-green-100 text-green-700 border-green-200' :
                                                                                                                    detail.status === 'failed' || detail.status === 'error' ? 'bg-red-100 text-red-700 border-red-200' :
                                                                                                                        detail.status === 'skipped' ? 'bg-slate-100 text-slate-500 border-slate-200' :
                                                                                                                            detail.status === 'disabled' ? 'bg-orange-100 text-orange-600 border-orange-200' :
                                                                                                                                detail.status === 'link_ready' ? 'bg-blue-100 text-blue-700 border-blue-200' :
                                                                                                                                    'bg-gray-100 text-gray-600 border-gray-200'
                                                                                                                    }`}>
                                                                                                                    {detail.action ? String(detail.action).replace(/_/g, ' ') : 'Proceso'}
                                                                                                                </span>
                                                                                                            )}
                                                                                                            <div className="flex gap-1">
                                                                                                                {detail.channels?.map((ch: string) => (
                                                                                                                    <span key={ch} className="text-[8px] font-bold text-blue-500 uppercase">
                                                                                                                        • {ch}
                                                                                                                    </span>
                                                                                                                ))}
                                                                                                            </div>
                                                                                                        </div>
                                                                                                        <div className="flex items-center gap-2">
                                                                                                            <span className={`text-[9px] font-bold uppercase ${detail.status === 'success' ? 'text-green-600' :
                                                                                                                detail.status === 'failed' || detail.status === 'error' ? 'text-red-600' :
                                                                                                                    'text-gray-400'
                                                                                                                }`}>
                                                                                                                {detail.status || ''}
                                                                                                            </span>
                                                                                                            <span className="text-gray-600 text-[10px] font-bold">
                                                                                                                {detail.info}
                                                                                                            </span>
                                                                                                        </div>
                                                                                                    </div>
                                                                                                    {detail.messageSent && (
                                                                                                        <div className="mt-1 p-2 bg-slate-50 border border-dashed border-slate-200 rounded text-[10px] text-slate-600 italic">
                                                                                                            "{detail.messageSent}"
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {detail.breakdown && (
                                                                                                        <div className="text-[9px] text-blue-600 font-bold px-1">
                                                                                                            → {detail.breakdown}
                                                                                                        </div>
                                                                                                    )}
                                                                                                    {detail.action === 'engine_parameters' && (
                                                                                                        <div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-1 text-[9px] bg-blue-50/50 p-2 rounded border border-blue-100">
                                                                                                            <div className="text-gray-400 font-bold uppercase tracking-tighter text-[8px]">Referencia</div>
                                                                                                            <div className="text-blue-700 font-black">{detail.referenceDate}</div>
                                                                                                            <div className="text-gray-400 font-bold uppercase tracking-tighter text-[8px]">Ventana de Aviso</div>
                                                                                                            <div className="text-blue-700 font-black">{detail.warningWindowDays} días</div>
                                                                                                            <div className="text-gray-400 font-bold uppercase tracking-tighter text-[8px]">Fecha Objetivo</div>
                                                                                                            <div className="text-blue-700 font-black">{detail.warningWindowTargetDate}</div>
                                                                                                        </div>
                                                                                                    )}
                                                                                                </div>
                                                                                            ))}
                                                                                        </div>
                                                                                    </div>
                                                                                ))}
                                                                            </div>
                                                                            {/* Botón WhatsApp para logs de vencimientos/cumpleaños con usuarios notificados */}
                                                                            {(() => {
                                                                                const isExpirationLog = log.type === 'expiration_engine' || log.type === 'manual_expiration';
                                                                                const isBirthdayLog = log.type === 'birthday_engine' || log.type === 'manual_birthday';
                                                                                if (!isExpirationLog && !isBirthdayLog) return null;
                                                                                const userIds = Object.keys(groupedByUser).filter(uid => uid !== 'system');
                                                                                if (userIds.length === 0) return null;
                                                                                return (
                                                                                    <button
                                                                                        onClick={(e) => {
                                                                                            e.stopPropagation();
                                                                                            const tplExp = config?.messaging?.templates?.whatsappExpiration || '¡Hola {nombre}! 📢 Tienes {puntos} puntos próximos a vencer. ⏳ Entrá a la App para ver el detalle y aprovecharlos antes de que se venzan. 🎁';
                                                                                            const tplBday = config?.messaging?.templates?.whatsappBirthday || '¡Feliz Cumpleaños {nombre}! 🎂🎉 Desde el Club te deseamos un gran día. ¡Entrá a la App para ver tu sorpresa! 🎁';
                                                                                            const defaultMsg = isExpirationLog ? tplExp : tplBday;
                                                                                            navigate('/admin/whatsapp', {
                                                                                                state: {
                                                                                                    message: defaultMsg,
                                                                                                    clientIds: userIds,
                                                                                                    notificationType: isExpirationLog ? 'expiration' : 'birthday'
                                                                                                }
                                                                                            });
                                                                                        }}
                                                                                        className="mt-3 w-full flex items-center justify-center gap-2 py-2 px-4 bg-green-500 hover:bg-green-600 text-white font-bold text-xs rounded-lg shadow-sm transition"
                                                                                    >
                                                                                        <MessageCircle size={14} />
                                                                                        Enviar por WhatsApp a {userIds.length} socio{userIds.length > 1 ? 's' : ''}
                                                                                    </button>
                                                                                );
                                                                            })()}
                                                                        </div>
                                                                    );
                                                                })()
                                                            ) : (
                                                                <p className="text-[10px] text-gray-400">No hay detalles específicos registrados.</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ));
                        })()}
                    </div>
                )}
            </div>
        </div >
    );
};
