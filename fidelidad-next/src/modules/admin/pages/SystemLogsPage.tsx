import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { Clock, CheckCircle, AlertTriangle, User, MessageCircle, ArrowRight, ChevronDown, ChevronUp, History } from 'lucide-react';

interface AuditDetail {
    userId?: string;
    userName?: string;
    action: string;
    status: string;
    info?: string;
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

export const SystemLogsPage = () => {
    const [logs, setLogs] = useState<AuditLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [expandedLog, setExpandedLog] = useState<string | null>(null);

    useEffect(() => {
        const fetchLogs = async () => {
            try {
                const q = query(
                    collection(db, 'audit_logs'),
                    orderBy('timestamp', 'desc'),
                    limit(50)
                );
                const snap = await getDocs(q);
                setLogs(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as AuditLog)));
            } catch (err) {
                console.error("Error fetching logs:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchLogs();
    }, []);

    const getTypeLabel = (type: string) => {
        switch (type) {
            case 'expiration_engine': return 'Motor de Vencimientos (Auto)';
            case 'manual_expiration': return 'Revisión Manual (Admin)';
            case 'birthday_engine': return 'Proceso de Cumpleaños';
            default: return type;
        }
    };

    const getStatusIcon = (status: string) => {
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
                <button
                    onClick={() => window.location.reload()}
                    className="p-2 hover:bg-gray-100 rounded-lg transition text-gray-600"
                >
                    <History size={20} />
                </button>
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
                                    {getStatusIcon(log.status)}
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-gray-700 text-sm">{getTypeLabel(log.type)}</span>
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full font-bold uppercase tracking-widest">
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
                                                        <div key={idx} className="bg-white p-2 rounded border border-gray-100 flex items-center justify-between text-[11px]">
                                                            <div className="flex items-center gap-2 min-w-0">
                                                                <User size={12} className="text-gray-400 shrink-0" />
                                                                <span className="font-bold text-gray-700 truncate">{detail.userName || 'Socio'}</span>
                                                                <span className="text-gray-400 text-[9px] shrink-0">#{detail.userId?.slice(-4)}</span>
                                                            </div>
                                                            <div className="flex items-center gap-2 shrink-0 ml-2">
                                                                <span className={`px-1.5 py-0.5 rounded uppercase font-bold text-[8px] ${detail.action.includes('error') || detail.status === 'failed' ? 'bg-red-50 text-red-500' : 'bg-green-50 text-green-600'
                                                                    }`}>
                                                                    {detail.action}
                                                                </span>
                                                                {detail.info && <span className="text-gray-400 italic">({detail.info})</span>}
                                                            </div>
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
                    </div>
                )}
            </div>
        </div>
    );
};
