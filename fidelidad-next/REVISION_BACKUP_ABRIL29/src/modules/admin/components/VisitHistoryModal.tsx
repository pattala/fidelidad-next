import { useEffect, useState } from 'react';
import { X, Calendar, Clock, MapPin, Sparkles } from 'lucide-react';
import { collection, query, orderBy, getDocs, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';

interface VisitHistoryModalProps {
    isOpen: boolean;
    client: any;
    onClose: () => void;
}

export const VisitHistoryModal = ({ isOpen, onClose, client }: VisitHistoryModalProps) => {
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            if (!client?.id || !isOpen) return;
            setLoading(true);
            try {
                const historyQuery = query(
                    collection(db, `users/${client.id}/visit_history`),
                    orderBy('date', 'desc'),
                    limit(50)
                );
                const snapshot = await getDocs(historyQuery);
                setHistory(snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    date: doc.data().date?.toDate ? doc.data().date.toDate() : new Date(doc.data().date)
                })));
            } catch (error) {
                console.error("Error fetching visits:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [client, isOpen]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[80vh]">

                {/* Header */}
                <div className="px-6 py-4 flex justify-between items-start bg-gray-50 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <Sparkles className="text-orange-500" size={20} /> Registro de Actividad
                        </h2>
                        <p className="text-sm text-gray-500 mt-1">Historial de conexiones de {client.name}</p>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Stats Summary */}
                <div className="px-6 py-4 grid grid-cols-2 gap-4 border-b border-gray-50">
                    <div className="bg-orange-50 p-3 rounded-xl border border-orange-100">
                        <p className="text-[10px] font-bold text-orange-600 uppercase">Visitas Totales</p>
                        <p className="text-2xl font-black text-gray-800">{client.visitCount || 0}</p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl border border-blue-100">
                        <p className="text-[10px] font-bold text-blue-600 uppercase">Última Conexión</p>
                        <p className="text-sm font-bold text-gray-800 mt-1">
                            {client.lastActive ? new Date(client.lastActive.toDate ? client.lastActive.toDate() : client.lastActive).toLocaleDateString() : 'N/A'}
                        </p>
                    </div>
                </div>

                {/* List */}
                <div className="flex-1 overflow-y-auto p-4 bg-gray-50/30">
                    {loading ? (
                        <div className="py-10 text-center text-gray-400 italic">Cargando historial...</div>
                    ) : history.length === 0 ? (
                        <div className="py-10 text-center flex flex-col items-center text-gray-300">
                            <Clock size={40} className="mb-2 opacity-20" />
                            <p className="text-sm">No hay registros de actividad recientes.</p>
                            <p className="text-[10px] mt-1">(El historial se empezó a grabar hoy)</p>
                        </div>
                    ) : (
                        <div className="space-y-3">
                            {history.map((visit) => (
                                <div key={visit.id} className="bg-white p-3 rounded-xl border border-gray-100 shadow-sm flex items-center justify-between hover:border-orange-200 transition-colors">
                                    <div className="flex items-center gap-3">
                                        <div className="w-8 h-8 rounded-lg bg-orange-100 flex items-center justify-center text-orange-600">
                                            <Calendar size={16} />
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-gray-700">
                                                {visit.date.toLocaleDateString('es-AR', { weekday: 'long', day: 'numeric', month: 'long' })}
                                            </p>
                                            <p className="text-xs text-gray-400 flex items-center gap-1">
                                                <Clock size={12} /> {visit.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} hs
                                            </p>
                                        </div>
                                    </div>
                                    <div className="text-[10px] font-bold px-2 py-1 bg-green-50 text-green-600 rounded-full border border-green-100 flex items-center gap-1">
                                        <div className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                                        App Abierta
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 bg-gray-50 flex justify-end">
                    <button
                        onClick={onClose}
                        className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                    >
                        Cerrar
                    </button>
                </div>
            </div>
        </div>
    );
};
