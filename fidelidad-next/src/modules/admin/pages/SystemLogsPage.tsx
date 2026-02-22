import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, startAfter, Timestamp } from 'firebase/firestore';
import { Clock, CheckCircle, AlertTriangle, User, MessageCircle, ArrowRight, ChevronDown, ChevronUp, History, Search, Calendar, Filter, Loader2, Play, Settings } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { TimeService } from '../../../services/timeService';

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
}

const PAGE_SIZE = 50;

export const SystemLogsPage = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    // Filters State
    const [typeFilter, setTypeFilter] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [searchQuery, setSearchQuery] = useState('');

    // Pagination State
    const [lastDoc, setLastDoc] = useState<any>(null);
    const [hasMore, setHasMore] = useState(true);
    const [isRunningExpirations, setIsRunningExpirations] = useState(false);

    const handleRunExpirations = async () => {
        if (!window.confirm("¿Deseas ejecutar ahora la revisión de vencimientos y enviar las notificaciones pendientes?")) return;

        setIsRunningExpirations(true);
        const toastId = toast.loading('Ejecutando revisión de vencimientos...');
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/check-expirations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || '',
                    'Authorization': `Bearer ${token}`,
                    'x-executor-role': (auth.currentUser as any)?.reloadUserInfo?.customAttributes?.includes('editor') ? 'editor' : 'admin'
                },
                body: JSON.stringify({
                    simulatedDate: TimeService.now().toISOString(),
                    isManual: true
                })
            });
            const data = await res.json();
            if (data.ok) {
                toast.success(`Éxito: ${data.summary?.summary || 'Revisión completada'}`, { id: toastId });
                // Refrescar los logs para ver el nuevo resultado
                fetchLogs();
            } else {
                toast.error(`Error: ${data.error}`, { id: toastId });
            }
        } catch (e) {
            toast.error('Error de conexión', { id: toastId });
        } finally {
            setIsRunningExpirations(false);
        }
    };

    const fetchLogs = async (isMore = false) => {
        if (!isMore) setLoading(true);
        else setLoadingMore(true);

        try {
            let constraints: any[] = [orderBy('timestamp', 'desc')];

            if (typeFilter) {
                constraints.push(where('type', '==', typeFilter));
            }

            if (startDate) {
                constraints.push(where('timestamp', '>=', Timestamp.fromDate(new Date(startDate + 'T00:00:00'))));
            }

            if (endDate) {
                constraints.push(where('timestamp', '<=', Timestamp.fromDate(new Date(endDate + 'T23:59:59'))));
            }

            if (isMore && lastDoc) {
                constraints.push(startAfter(lastDoc));
            }

            constraints.push(limit(PAGE_SIZE));

            const q = query(collection(db, 'audit_logs'), ...constraints);
            const snap = await getDocs(q);

            const newLogs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog));

            // Client-side search for summary/executor (since Firestore doesn't support full-text easily)
            const filteredNewLogs = searchQuery
                ? newLogs.filter(l =>
                    l.summary.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    l.executor.toLowerCase().includes(searchQuery.toLowerCase())
                )
                : newLogs;

            if (isMore) {
                setLogs(prev => [...prev, ...filteredNewLogs]);
            } else {
                setLogs(filteredNewLogs);
            }

            setLastDoc(snap.docs[snap.docs.length - 1]);
            setHasMore(snap.docs.length === PAGE_SIZE);
        } catch (err) {
            console.error("Error fetching logs:", err);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    useEffect(() => {
        fetchLogs();
    }, [typeFilter, startDate, endDate]); // Re-fetch on filter change

    const handleSearch = (e: React.FormEvent) => {
        e.preventDefault();
        fetchLogs();
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'expiration_engine': return 'Motor de Vencimientos (Auto)';
            case 'manual_expiration': return 'Revisión Manual (Admin)';
            case 'birthday_engine': return 'Proceso de Cumpleaños';
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
            case 'campaign_mgmt': return 'Campaña (Activación/Desact)';
            case 'campaign_created': return 'Campaña (Nueva)';
            case 'campaign_updated': return 'Campaña (Editada)';
            case 'campaign_deleted': return 'Campaña (Borrada)';
            case 'campaign_diffusion': return 'Campaña (Difusión Masiva)';
            case 'data_export': return 'Exportación de Datos';
            case 'config_updated': return 'Configuración Actualizada';
            case 'prize_created': return 'Premio Creado';
            case 'prize_updated': return 'Premio Actualizado';
            case 'prize_deleted': return 'Premio Eliminado';
            default: return type.replace(/_/g, ' ');
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
                    <p className="text-gray-500 text-sm">Historial de procesos automáticos y acciones del servidor</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={handleRunExpirations}
                        disabled={isRunningExpirations}
                        className="flex items-center gap-2 px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-black transition-all shadow-lg shadow-orange-100 font-bold text-sm disabled:opacity-50"
                    >
                        {isRunningExpirations ? <Loader2 size={18} className="animate-spin" /> : <Play size={18} fill="currentColor" />}
                        <span className="hidden sm:inline">Ejecutar Revisión de Vencimientos</span>
                    </button>
                    <button
                        onClick={() => fetchLogs()}
                        className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600 border border-gray-100"
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
                            <option value="points_assignment">Asignación Puntos</option>
                            <option value="birthday_engine">Cumpleaños</option>
                            <option value="whatsapp_notification">WhatsApp Auto</option>
                            <option value="whatsapp_manual">WhatsApp Manual</option>
                            <option value="push_notification">Push</option>
                            <option value="inbox_message">Inbox</option>
                            <option value="email_notification">Email</option>
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
                ) : logs.length === 0 ? (
                    <div className="p-20 text-center text-gray-400">
                        <Clock size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No hay registros de auditoría aún.</p>
                    </div>
                ) : (
                    <div className="divide-y divide-gray-50">
                        {(() => {
                            // Agrupar logs por fecha (D/M/A)
                            const groupedLogs: { [key: string]: any[] } = {};
                            logs.forEach(log => {
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
                                                                // Si es un log consolidado de un solo socio (o el primero de varios)
                                                                const first = log.details[0];
                                                                // Si todos los detalles son del mismo usuario o es un tipo de operación manual
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
                                                                        log.role === 'admin' ? 'ADMIN' :
                                                                            log.role === 'editor' ? 'OPERADOR' :
                                                                                log.role === 'viewer' ? 'VISOR' :
                                                                                    (log.executor?.includes('@') || log.executor?.length > 15) ? 'ADMIN / OPERADOR' :
                                                                                        (log.executor || 'DESCONOCIDO')}
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
                                                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }) : 'Reciente'}
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

                                                                    const actualUserCount = Object.keys(groupedByUser).filter(uid => uid !== 'system').length;

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
                                                                                                                    {detail.action.replace(/_/g, ' ')}
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
                        {hasMore && (
                            <div className="p-4 border-t border-gray-50 bg-gray-50/30">
                                <button
                                    onClick={() => fetchLogs(true)}
                                    disabled={loadingMore}
                                    className="w-full py-3 flex items-center justify-center gap-2 text-sm font-bold text-blue-600 hover:text-blue-800 transition"
                                >
                                    {loadingMore ? <Loader2 className="animate-spin" size={18} /> : 'Cargar más registros'}
                                </button>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div >
    );
};
