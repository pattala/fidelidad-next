import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collectionGroup, query, where, getDocs } from 'firebase/firestore';
import { Gift, Search, Clock, ArrowRight, User } from 'lucide-react';

interface RedemptionLog {
    id: string;
    userId: string;
    userName: string;
    date: Date;
    amount: number;
    concept: string;
    redeemedValue?: number;
    purchaseAmount?: number;
}

export const RedemptionsPage = () => {
    const [logs, setLogs] = useState<RedemptionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    useEffect(() => {
        const fetchRedemptions = async () => {
            setLoading(true);
            try {
                // Fetch all debits
                const q = query(collectionGroup(db, 'points_history'), where('type', '==', 'debit'));
                const snap = await getDocs(q);
                
                // Extraer y agrupar para pedir nombres de usuario de forma eficiente
                const rawLogs: any[] = [];
                const userIds = new Set<string>();

                snap.docs.forEach(d => {
                    const data = d.data();
                    // Ignorar vencimientos, solo queremos canjes y consumos
                    if (data.concept && data.concept.toLowerCase().includes('vencimiento')) return;
                    
                    const userId = d.ref.parent.parent?.id || '';
                    if (userId) userIds.add(userId);

                    rawLogs.push({
                        id: d.id,
                        userId,
                        date: data.date?.toDate ? data.date.toDate() : new Date(),
                        amount: Math.abs(data.amount || 0),
                        concept: data.concept || 'Canje de premio',
                        redeemedValue: data.redeemedValue || 0,
                        purchaseAmount: data.purchaseAmount || 0,
                    });
                });

                // Fetch User Names en batch
                const userNames: Record<string, string> = {};
                // Como Firebase no permite 'in' con ms de 30 elementos, lo hacemos de a lotes de 30 o simplemente individual
                // Aqu lo hacemos uno por uno para asegurar que no falle, o leemos de un cache
                const usersSnap = await getDocs(collectionGroup(db, 'users'));
                usersSnap.forEach(u => {
                    if (userIds.has(u.id)) {
                        userNames[u.id] = u.data().name || 'Usuario';
                    }
                });

                const formattedLogs = rawLogs.map(log => ({
                    ...log,
                    userName: userNames[log.userId] || 'Usuario Desconocido'
                }));

                // Ordenar por fecha descendente
                formattedLogs.sort((a, b) => b.date.getTime() - a.date.getTime());

                setLogs(formattedLogs);
            } catch (error) {
                console.error("Error fetching redemptions:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchRedemptions();
    }, []);

    const filteredLogs = useMemo(() => {
        if (!searchQuery) return logs;
        const s = searchQuery.toLowerCase();
        return logs.filter(log => 
            log.userName.toLowerCase().includes(s) || 
            log.concept.toLowerCase().includes(s)
        );
    }, [logs, searchQuery]);

    const totalRedeemedPoints = useMemo(() => logs.reduce((acc, l) => acc + l.amount, 0), [logs]);
    const totalRedeemedValue = useMemo(() => logs.reduce((acc, l) => acc + (l.redeemedValue || 0), 0), [logs]);

    return (
        <div className="p-6 space-y-6">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Historial de Canjes</h1>
                    <p className="text-gray-500 text-sm mt-1">Registro histrico de premios entregados a los clientes</p>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Gift size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Canjes Totales</p>
                        <p className="text-2xl font-black text-gray-800">{logs.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Puntos Entregados</p>
                        <p className="text-2xl font-black text-gray-800">{totalRedeemedPoints.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <ArrowRight size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Costo Asumido</p>
                        <p className="text-2xl font-black text-gray-800">${totalRedeemedValue.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            <div className="bg-white p-4 rounded-xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex-1 space-y-1 w-full max-w-md">
                    <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest ml-1">Buscar Cliente o Premio</label>
                    <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                        <input
                            type="text"
                            value={searchQuery}
                            onChange={e => setSearchQuery(e.target.value)}
                            placeholder="Buscar..."
                            className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-100 outline-none text-sm transition"
                        />
                    </div>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center animate-pulse text-gray-400">Cargando historial de canjes...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-20 text-center text-gray-400">
                        <Gift size={48} className="mx-auto mb-4 opacity-20" />
                        <p>No hay canjes registrados que coincidan con la bsqueda.</p>
                    </div>
                ) : (
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50 border-b border-gray-100 text-gray-500 text-xs uppercase tracking-wider">
                                <th className="px-6 py-4 font-black">Fecha y Hora</th>
                                <th className="px-6 py-4 font-black">Cliente</th>
                                <th className="px-6 py-4 font-black">Premio / Concepto</th>
                                <th className="px-6 py-4 font-black text-right">Puntos Restados</th>
                                <th className="px-6 py-4 font-black text-right">Valor Asumido</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredLogs.map(log => (
                                <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                                    <td className="px-6 py-4 text-sm text-gray-500 whitespace-nowrap">
                                        <div className="font-bold">{log.date.toLocaleDateString('es-AR')}</div>
                                        <div className="text-[10px]">{log.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}</div>
                                    </td>
                                    <td className="px-6 py-4 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="bg-blue-100 p-1.5 rounded-full text-blue-600">
                                                <User size={14} />
                                            </div>
                                            <span className="font-bold text-gray-800">{log.userName}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-sm font-medium text-gray-700">
                                        <div>{log.concept}</div>
                                        {log.purchaseAmount ? (
                                            <div className="text-[10px] text-gray-400 mt-0.5">
                                                Monto de compra: ${log.purchaseAmount.toLocaleString()}
                                            </div>
                                        ) : null}
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right">
                                        <span className="bg-red-50 text-red-600 font-bold px-3 py-1 rounded-full inline-block">
                                            -{log.amount} pts
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-right font-bold text-gray-600">
                                        ${log.redeemedValue?.toLocaleString() || 0}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>
        </div>
    );
};
