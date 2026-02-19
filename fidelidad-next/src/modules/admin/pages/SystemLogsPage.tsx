import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, getDocs, where, startAfter, Timestamp } from 'firebase/firestore';
import { Clock, CheckCircle, AlertTriangle, User, MessageCircle, ArrowRight, ChevronDown, ChevronUp, History, Search, Calendar, Filter, Loader2, Play } from 'lucide-react';
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
            const res = await fetch('/api/check-expirations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || ''
                },
                body: JSON.stringify({
                    simulatedDate: TimeService.now().toISOString()
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
            case 'points_assignment': return 'Asignación de Puntos';
            case 'prizes_redemption': return 'Canje de Premio';
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
                            <option value="prizes_redemption">Canje Premios</option>
                            <option value="birthday_engine">Cumpleaños</option>
                            <option value="whatsapp_notification">WhatsApp Auto</option>
                            <option value="whatsapp_manual">WhatsApp Manual</option>
                            <option value="push_notification">Push</option>
                            <option value="inbox_message">Inbox</option>
                            <option value="email_notification">Email</option>
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
                        {logs.map((log) => (
                            <div key={log.id} className="hover:bg-gray-50/50 transition-colors">
                                <div
                                    className="p-4 flex items-center gap-4 cursor-pointer"
                                    onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
                                >
                                    {getStatusIcon(log.status, log.type)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-700 text-sm">{getTypeLabel(log.type)}</span>
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
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest ml-auto">
                                                {log.executor}
                                            </span>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-0.5">{log.summary}</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-[10px] font-bold text-gray-400 uppercase">
                                            {log.timestamp?.toDate ? log.timestamp.toDate().toLocaleString('es-AR') : 'Reciente'}
                                        </p>
                                        <div className="flex justify-end mt-1">
                                            {expandedLog === log.id ? <ChevronUp size={16} className="text-gray-300" /> : <ChevronDown size={16} className="text-gray-300" />}
                                        </div>
                                    </div>
                                </div>

                                {expandedLog === log.id && (
                                    <div className="px-4 pb-4 animate-in fade-in slide-in-from-top-1">
                                        <div className="bg-gray-50 rounded-lg p-4 space-y-2 border border-blue-50">
                                            <h4 className="text-[10px] font-black text-blue-600 uppercase tracking-widest mb-2 flex items-center gap-1">
                                                <ArrowRight size={10} /> Socios Afectados ({log.details?.length || 0})
                                            </h4>

                                            {log.details && log.details.length > 0 ? (
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-2 scrollbar-thin">
                                                    {log.details.map((detail, idx) => (
                                                        <div key={idx} className="bg-white p-2 rounded border border-gray-100 flex flex-col gap-1 text-[11px]">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-2 min-w-0">
                                                                    <User size={12} className="text-gray-400 shrink-0" />
                                                                    <span className="font-bold text-gray-700 truncate">{detail.userName || 'Socio'}</span>
                                                                    <span className="text-gray-400 text-[9px] shrink-0">#{detail.userId?.slice(-4)}</span>
                                                                </div>
                                                                <div className="flex flex-col gap-1 shrink-0 ml-2 items-end">
                                                                    <div className="flex items-center gap-2">
                                                                        {detail.channels?.map(ch => (
                                                                            <span key={ch} className="bg-blue-50 text-blue-600 text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase ring-1 ring-blue-100">
                                                                                {ch}
                                                                            </span>
                                                                        ))}
                                                                        <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[8px] ${detail.action.includes('error') || detail.status === 'failed' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                                                                            }`}>
                                                                            {detail.action}
                                                                        </span>
                                                                    </div>
                                                                    {detail.info && <span className="text-gray-400 italic text-[10px]">({detail.info})</span>}
                                                                </div>
                                                            </div>
                                                            {detail.messageSent && (
                                                                <div className="mt-1 p-2 bg-gray-50/50 border border-dashed border-gray-200 rounded text-[10px] text-gray-600 italic">
                                                                    "{detail.messageSent}"
                                                                </div>
                                                            )}
                                                            {detail.breakdown && (
                                                                <div className="mt-0.5 text-[9px] text-blue-500 font-medium px-2">
                                                                    Detalle: {detail.breakdown}
                                                                </div>
                                                            )}
                                                        </div>
                                                    ))}
                                                </div>
                                            ) : (
                                                <p className="text-[10px] text-gray-400">No hay detalles específicos registrados.</p>
                                            )}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
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
