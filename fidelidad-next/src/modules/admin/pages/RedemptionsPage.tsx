import React, { useEffect, useState, useMemo } from 'react';
import { db } from '../../../lib/firebase';
import { collectionGroup, collection, query, where, getDocs } from 'firebase/firestore';
import { Gift, Search, Clock, ArrowRight, User, Download, Calendar, Filter, Phone, Mail, CreditCard } from 'lucide-react';
import { TimeService } from '../../../services/timeService';
import toast from 'react-hot-toast';

interface RedemptionLog {
    id: string;
    userId: string;
    userName: string;
    userEmail: string;
    userPhone: string;
    userDni: string;
    date: Date;
    amount: number;
    concept: string;
    redeemedValue?: number;
    internalCost?: number;
    purchaseAmount?: number;
}

type PeriodType = 'this_month' | 'last_month' | 'last_30_days' | 'all' | 'custom';

export const RedemptionsPage = () => {
    const [logs, setLogs] = useState<RedemptionLog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');

    // Period Filter State
    const [periodFilter, setPeriodFilter] = useState<PeriodType>('this_month');
    const [customStartDate, setCustomStartDate] = useState('');
    const [customEndDate, setCustomEndDate] = useState('');

    useEffect(() => {
        const fetchRedemptions = async () => {
            setLoading(true);
            try {
                // Fetch all debits
                const q = query(collectionGroup(db, 'points_history'), where('type', '==', 'debit'));
                const snap = await getDocs(q);
                
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
                        internalCost: data.internalCost || 0,
                        purchaseAmount: data.purchaseAmount || 0,
                    });
                });

                // Fetch User Details en batch
                const userMap: Record<string, { name: string; email: string; phone: string; dni: string }> = {};
                const usersSnap = await getDocs(collection(db, 'users'));
                usersSnap.forEach(u => {
                    if (userIds.has(u.id)) {
                        const data = u.data();
                        userMap[u.id] = {
                            name: data.name || data.nombre || 'Usuario',
                            email: data.email || 'Sin email',
                            phone: data.phone || data.telefono || data.phone_number || 'Sin teléfono',
                            dni: String(data.socioNumber || data.numeroSocio || data.dni || 'Sin DNI')
                        };
                    }
                });

                const formattedLogs: RedemptionLog[] = rawLogs.map(log => {
                    const info = userMap[log.userId] || { name: 'Usuario Desconocido', email: '-', phone: '-', dni: '-' };
                    return {
                        ...log,
                        userName: info.name,
                        userEmail: info.email,
                        userPhone: info.phone,
                        userDni: info.dni
                    };
                });

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

    // Filter by period & search query
    const filteredLogs = useMemo(() => {
        return logs.filter(log => {
            // Period Filter
            const d = new Date(log.date);
            const now = TimeService.now();
            
            if (periodFilter === 'this_month') {
                if (d.getFullYear() !== now.getFullYear() || d.getMonth() !== now.getMonth()) return false;
            } else if (periodFilter === 'last_month') {
                const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1);
                if (d.getFullYear() !== lastMonth.getFullYear() || d.getMonth() !== lastMonth.getMonth()) return false;
            } else if (periodFilter === 'last_30_days') {
                const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
                if (d < thirtyDaysAgo) return false;
            } else if (periodFilter === 'custom') {
                if (customStartDate) {
                    const start = new Date(customStartDate + 'T00:00:00');
                    if (d < start) return false;
                }
                if (customEndDate) {
                    const end = new Date(customEndDate + 'T23:59:59');
                    if (d > end) return false;
                }
            }

            // Search Query Filter
            if (searchQuery) {
                const s = searchQuery.toLowerCase();
                const matchName = log.userName.toLowerCase().includes(s);
                const matchConcept = log.concept.toLowerCase().includes(s);
                const matchDni = log.userDni.toLowerCase().includes(s);
                const matchPhone = log.userPhone.toLowerCase().includes(s);
                const matchEmail = log.userEmail.toLowerCase().includes(s);
                if (!matchName && !matchConcept && !matchDni && !matchPhone && !matchEmail) return false;
            }

            return true;
        });
    }, [logs, periodFilter, customStartDate, customEndDate, searchQuery]);

    // Totals calculated on filtered logs
    const totalRedeemedPoints = useMemo(() => filteredLogs.reduce((acc, l) => acc + l.amount, 0), [filteredLogs]);
    const totalRedeemedValue = useMemo(() => filteredLogs.reduce((acc, l) => acc + (l.redeemedValue || 0), 0), [filteredLogs]);
    const totalInternalCost = useMemo(() => filteredLogs.reduce((acc, l) => acc + (l.internalCost || 0), 0), [filteredLogs]);

    // Export to Excel (.csv UTF-8 BOM)
    const handleExportExcel = () => {
        if (filteredLogs.length === 0) {
            toast.error('No hay canjes registrados en el período seleccionado para exportar.');
            return;
        }

        const headers = [
            'Fecha',
            'Hora',
            'Cliente (Nombre)',
            'DNI / N° Socio',
            'Teléfono',
            'Email',
            'Premio / Concepto',
            'Puntos Canjeados',
            'Valor Mostrador ($)',
            'Costo Real Interno ($)',
            'Compra Mínima ($)'
        ];

        const rows = filteredLogs.map(l => [
            l.date.toLocaleDateString('es-AR'),
            l.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' }),
            `"${(l.userName || '').replace(/"/g, '""')}"`,
            `"${(l.userDni || '').replace(/"/g, '""')}"`,
            `"${(l.userPhone || '').replace(/"/g, '""')}"`,
            `"${(l.userEmail || '').replace(/"/g, '""')}"`,
            `"${(l.concept || '').replace(/"/g, '""')}"`,
            l.amount,
            l.redeemedValue || 0,
            l.internalCost || 0,
            l.purchaseAmount || 0
        ]);

        const csvContent = '\uFEFF' + [headers.join(';'), ...rows.map(r => r.join(';'))].join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        const periodSuffix = periodFilter === 'this_month' ? 'este_mes' : periodFilter === 'last_month' ? 'mes_pasado' : 'periodo';
        link.setAttribute('download', `reporte_canjes_premios_${periodSuffix}_${new Date().toISOString().slice(0, 10)}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success(`Exportados ${filteredLogs.length} canjes a Excel (.csv)`);
    };

    return (
        <div className="p-6 space-y-6">
            {/* Header & Export Action */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Historial y Reporte de Canjes</h1>
                    <p className="text-gray-500 text-sm mt-1">Registro detallado de premios entregados a los clientes con exportación contable</p>
                </div>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold text-sm shadow-md hover:shadow-lg transition-all active:scale-95 whitespace-nowrap"
                >
                    <Download size={18} /> Exportar a Excel (.csv)
                </button>
            </div>

            {/* KPI Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                        <Gift size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Canjes en Período</p>
                        <p className="text-2xl font-black text-gray-800">{filteredLogs.length}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-orange-100 text-orange-600 flex items-center justify-center">
                        <Clock size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Puntos Canjeados</p>
                        <p className="text-2xl font-black text-gray-800">{totalRedeemedPoints.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-green-100 text-green-600 flex items-center justify-center">
                        <ArrowRight size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Valor Mostrador</p>
                        <p className="text-2xl font-black text-gray-800">${totalRedeemedValue.toLocaleString()}</p>
                    </div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4">
                    <div className="w-12 h-12 rounded-full bg-purple-100 text-purple-600 flex items-center justify-center">
                        <Gift size={24} />
                    </div>
                    <div>
                        <p className="text-sm font-bold text-gray-500">Costo Real Interno</p>
                        <p className="text-2xl font-black text-purple-900">${totalInternalCost.toLocaleString()}</p>
                    </div>
                </div>
            </div>

            {/* Filter Bar: Period Selector & Search */}
            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    {/* Period Buttons */}
                    <div className="space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1">
                            <Filter size={12} /> Seleccionar Período
                        </label>
                        <div className="flex flex-wrap items-center gap-2">
                            <button
                                onClick={() => setPeriodFilter('this_month')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${periodFilter === 'this_month' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Este Mes
                            </button>
                            <button
                                onClick={() => setPeriodFilter('last_month')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${periodFilter === 'last_month' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Mes Pasado
                            </button>
                            <button
                                onClick={() => setPeriodFilter('last_30_days')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${periodFilter === 'last_30_days' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Últimos 30 Días
                            </button>
                            <button
                                onClick={() => setPeriodFilter('all')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${periodFilter === 'all' ? 'bg-blue-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Todo el Historial
                            </button>
                            <button
                                onClick={() => setPeriodFilter('custom')}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition-all ${periodFilter === 'custom' ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                            >
                                Personalizado
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="w-full lg:w-72 space-y-1">
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Buscar en Reporte</label>
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                placeholder="Cliente, DNI, premio..."
                                className="w-full pl-10 pr-4 py-2 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-100 outline-none text-xs font-medium transition"
                            />
                        </div>
                    </div>
                </div>

                {/* Custom Date Pickers */}
                {periodFilter === 'custom' && (
                    <div className="pt-3 border-t border-gray-100 flex flex-wrap items-center gap-4 animate-fade-in">
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-xs font-bold text-gray-600">Desde:</span>
                            <input
                                type="date"
                                value={customStartDate}
                                onChange={e => setCustomStartDate(e.target.value)}
                                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none"
                            />
                        </div>
                        <div className="flex items-center gap-2">
                            <Calendar size={14} className="text-gray-400" />
                            <span className="text-xs font-bold text-gray-600">Hasta:</span>
                            <input
                                type="date"
                                value={customEndDate}
                                onChange={e => setCustomEndDate(e.target.value)}
                                className="px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs font-bold outline-none"
                            />
                        </div>
                    </div>
                )}
            </div>

            {/* Redemptions Table */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                {loading ? (
                    <div className="p-10 text-center animate-pulse text-gray-400">Cargando historial de canjes...</div>
                ) : filteredLogs.length === 0 ? (
                    <div className="p-20 text-center text-gray-400">
                        <Gift size={48} className="mx-auto mb-4 opacity-20" />
                        <p className="font-bold text-gray-600">No hay canjes registrados en el período seleccionado.</p>
                        <p className="text-xs text-gray-400 mt-1">Prueba cambiando el filtro de fecha o la búsqueda.</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse min-w-[800px]">
                            <thead>
                                <tr className="bg-gray-50/80 border-b border-gray-100 text-gray-500 text-[11px] uppercase tracking-wider">
                                    <th className="px-6 py-4 font-black">Fecha y Hora</th>
                                    <th className="px-6 py-4 font-black">Cliente y Datos</th>
                                    <th className="px-6 py-4 font-black">Premio Entregado</th>
                                    <th className="px-6 py-4 font-black text-right">Puntos</th>
                                    <th className="px-6 py-4 font-black text-right">Valor Mostrador</th>
                                    <th className="px-6 py-4 font-black text-right">Costo Interno</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {filteredLogs.map(log => (
                                    <tr key={log.id} className="hover:bg-gray-50/70 transition-colors">
                                        <td className="px-6 py-4 text-xs text-gray-500 whitespace-nowrap">
                                            <div className="font-bold text-gray-800">{log.date.toLocaleDateString('es-AR')}</div>
                                            <div className="text-[10px] font-medium text-gray-400">{log.date.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })} hs</div>
                                        </td>
                                        <td className="px-6 py-4 text-xs">
                                            <div className="flex items-start gap-2.5">
                                                <div className="bg-blue-100 p-2 rounded-full text-blue-600 mt-0.5">
                                                    <User size={14} />
                                                </div>
                                                <div className="space-y-0.5">
                                                    <span className="font-bold text-gray-900 block">{log.userName}</span>
                                                    <div className="flex flex-wrap items-center gap-2 text-[10px] text-gray-500">
                                                        {log.userDni !== 'Sin DNI' && (
                                                            <span className="flex items-center gap-1 font-semibold text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded">
                                                                <CreditCard size={10} /> Socio #{log.userDni}
                                                            </span>
                                                        )}
                                                        {log.userPhone !== 'Sin teléfono' && (
                                                            <span className="flex items-center gap-1 font-medium">
                                                                <Phone size={10} /> {log.userPhone}
                                                            </span>
                                                        )}
                                                        {log.userEmail !== 'Sin email' && (
                                                            <span className="flex items-center gap-1 font-medium text-gray-400">
                                                                <Mail size={10} /> {log.userEmail}
                                                            </span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-xs font-medium text-gray-700">
                                            <div className="font-bold text-gray-800">{log.concept}</div>
                                            {log.purchaseAmount ? (
                                                <div className="text-[10px] text-orange-600 font-bold mt-0.5">
                                                    🛒 Compra mínima registrada: ${log.purchaseAmount.toLocaleString('es-AR')}
                                                </div>
                                            ) : null}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-right whitespace-nowrap">
                                            <span className="bg-red-50 text-red-600 font-black px-2.5 py-1 rounded-full inline-block">
                                                -{log.amount} pts
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 text-xs text-right font-black text-gray-800 whitespace-nowrap">
                                            ${(log.redeemedValue || 0).toLocaleString('es-AR')}
                                        </td>
                                        <td className="px-6 py-4 text-xs text-right font-bold text-purple-700 whitespace-nowrap">
                                            ${(log.internalCost || 0).toLocaleString('es-AR')}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};
