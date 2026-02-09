import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Award, Sparkles, Download, Clock, Calendar } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import toast from 'react-hot-toast';

import { ConfigService } from '../../../services/configService';

export const MetricsPage = () => {
    const [timeRange, setTimeRange] = useState<'30_days' | '6_months' | 'year'>('6_months');
    const [chartData, setChartData] = useState<any[]>([]);
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [topSpenders, setTopSpenders] = useState<any[]>([]);
    const [topVisitors, setTopVisitors] = useState<any[]>([]);
    const [registrationSources, setRegistrationSources] = useState<{ pwa: number, local: number }>({ pwa: 0, local: 0 });
    const [totalStats, setTotalStats] = useState({ emitted: 0, redeemed: 0, expired: 0 });
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<any>(null);
    const [movementsData, setMovementsData] = useState<any[]>([]);
    const [advancedStats, setAdvancedStats] = useState({
        averageTicket: 0,
        frequency: 0,
        activeCustomers: 0,
        potentialRevenue: 0
    });
    const [heatmapData, setHeatmapData] = useState<number[][]>(Array(7).fill(0).map(() => Array(24).fill(0)));

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const appConfig = await ConfigService.get();
                setConfig(appConfig);

                const now = new Date();
                const startDate = new Date();
                if (timeRange === '30_days') startDate.setDate(now.getDate() - 30);
                if (timeRange === '6_months') startDate.setMonth(now.getMonth() - 6);
                if (timeRange === 'year') startDate.setFullYear(now.getFullYear() - 1);

                const qTrans = query(
                    collection(db, 'transactions'),
                    where('date', '>=', startDate),
                    orderBy('date', 'asc')
                );

                const snapTrans = await getDocs(qTrans);
                const movements = snapTrans.docs.map(d => {
                    const data = d.data();
                    return {
                        ...data,
                        id: d.id,
                        date: data.date?.toDate ? data.date.toDate() : new Date(),
                        amount: data.points || data.amount || 0,
                        moneySpent: data.amount || 0
                    };
                });
                setMovementsData(movements);

                const groupedData = new Map<string, { emitted: number, redeemed: number, expired: number, money: number }>();
                const spendersMap = new Map<string, number>();

                movements.forEach((mov: any) => {
                    const key = timeRange === '30_days'
                        ? mov.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                        : mov.date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });

                    const current = groupedData.get(key) || { emitted: 0, redeemed: 0, expired: 0, money: 0 };

                    if (mov.type === 'credit') {
                        current.emitted += Number(mov.points || mov.amount || 0);
                        const userId = mov.uid || mov.userId;
                        if (userId) {
                            const pesoValue = Number(mov.amount || 0);
                            if (pesoValue > 0) {
                                const currentTotal = spendersMap.get(userId) || 0;
                                spendersMap.set(userId, currentTotal + pesoValue);
                            }
                        }
                    } else if (mov.type === 'debit' || mov.type === 'adjustment') {
                        const concept = (mov.concept || '').toLowerCase();
                        const isExpiration = concept.includes('vencimiento') || concept.includes('vencidos') || concept.includes('expirados');

                        if (isExpiration) {
                            current.expired += Math.abs(Number(mov.points || mov.amount || 0));
                        } else {
                            current.redeemed += Math.abs(Number(mov.points || mov.amount || 0));
                            current.money += (mov.redeemedValue || 0);
                        }
                    }
                    groupedData.set(key, current);
                });

                let tEmitted = 0, tRedeemed = 0, tExpired = 0;
                groupedData.forEach(d => {
                    tEmitted += d.emitted;
                    tRedeemed += d.redeemed;
                    tExpired += d.expired;
                });

                setTotalStats({ emitted: tEmitted, redeemed: tRedeemed, expired: tExpired });
                setChartData(Array.from(groupedData.entries()).map(([name, data]) => ({ name, ...data })));

                // --- PROCESAMIENTO AVANZADO ---
                const heatmap = Array(7).fill(0).map(() => Array(24).fill(0));
                let totalAmount = 0;
                let creditCount = 0;
                const activeUids = new Set<string>();

                movements.forEach((mov: any) => {
                    if (mov.type === 'credit') {
                        const d = mov.date;
                        heatmap[d.getDay()][d.getHours()]++;
                        if (mov.moneySpent > 0) {
                            totalAmount += mov.moneySpent;
                            creditCount++;
                        }
                        if (mov.uid) activeUids.add(mov.uid);
                    }
                });

                // Calcular Valor Real del Punto basado en premios ACTIVOS (Reality Check)
                const qPrizes = query(collection(db, 'prizes'), where('active', '==', true));
                const snapPrizes = await getDocs(qPrizes);
                let totalPrizeRatio = 0;
                let validPrizesCount = 0;
                snapPrizes.forEach(doc => {
                    const p = doc.data();
                    if (p.cashValue && p.pointsRequired > 0) {
                        totalPrizeRatio += (p.cashValue / p.pointsRequired);
                        validPrizesCount++;
                    }
                });
                const realPointValue = validPrizesCount > 0 ? (totalPrizeRatio / validPrizesCount) : (appConfig.pointValue || 10);

                setHeatmapData(heatmap);
                setAdvancedStats({
                    averageTicket: creditCount > 0 ? totalAmount / creditCount : 0,
                    frequency: activeUids.size > 0 ? creditCount / activeUids.size : 0,
                    activeCustomers: activeUids.size,
                    potentialRevenue: tEmitted * realPointValue // Inversión en puntos EMITIDOS en el PERIODO
                });

                const qFullUsers = query(collection(db, 'users'), where('createdAt', '>=', startDate));
                const snapFullUsers = await getDocs(qFullUsers);
                const sources = { pwa: 0, local: 0 };
                snapFullUsers.docs.forEach(d => {
                    const data = d.data();
                    if (data.source === 'pwa') sources.pwa++;
                    else sources.local++;
                });
                setRegistrationSources(sources);

                const qUsers = query(collection(db, 'users'), orderBy('points', 'desc'), limit(5));
                const snapUsers = await getDocs(qUsers);
                setTopUsers(snapUsers.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        name: data.name || data.nombre || '',
                        points: data.points || data.puntos || 0,
                        socioNumber: data.socioNumber || data.numeroSocio || ''
                    };
                }));

                const sortedSpendersIds = Array.from(spendersMap.entries()).sort(([, a], [, b]) => b - a).slice(0, 10);
                const spendersData = await Promise.all(sortedSpendersIds.map(async ([uid, total]) => {
                    const existing = snapUsers.docs.find(d => d.id === uid);
                    if (existing) {
                        const uData = existing.data();
                        return { id: uid, name: uData.name || uData.nombre, dni: uData.dni, socioNumber: uData.socioNumber || uData.numeroSocio, total };
                    }
                    try {
                        const qUser = query(collection(db, 'users'), where(documentId(), '==', uid));
                        const userSnap = await getDocs(qUser);
                        if (!userSnap.empty) {
                            const uData = userSnap.docs[0].data();
                            return { id: uid, name: uData.name || uData.nombre || 'Desconocido', dni: uData.dni, socioNumber: uData.socioNumber || uData.numeroSocio, total };
                        }
                    } catch (e) { }
                    return { id: uid, name: 'Socio #' + uid.substring(0, 5), total };
                }));
                setTopSpenders(spendersData);

                const qVisitors = query(collection(db, 'users'), orderBy('visitCount', 'desc'), limit(5));
                const snapVisitors = await getDocs(qVisitors);
                setTopVisitors(snapVisitors.docs.map(d => {
                    const data = d.data();
                    return { id: d.id, ...data, name: data.name || data.nombre || '', count: data.visitCount || 0, socioNumber: data.socioNumber || data.numeroSocio || '' };
                }));

            } catch (error) {
                console.error("Error metrics:", error);
                toast.error("Error al cargar las métricas");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [timeRange]);

    const handleCSVExport = () => {
        if (movementsData.length === 0) {
            toast.error("No hay datos para exportar en este periodo.");
            return;
        }
        const headers = ["Fecha", "Cliente", "Socio #", "Tipo", "Concepto", "Puntos", "Monto $"];
        const rows = movementsData.map(m => [
            m.date.toLocaleString(),
            m.clientName || 'N/A',
            m.socioNumber || 'N/A',
            m.type,
            m.concept || '',
            m.points || m.amount || 0,
            m.amount || 0
        ]);
        const csvContent = [headers, ...rows].map(e => e.join(",")).join("\n");
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `transacciones_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV exportado correctamente");
    };

    if (loading) {
        return <div className="p-10 text-center text-gray-400">Cargando métricas...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in text-gray-800 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="text-purple-600" /> Métricas y Reportes
                    </h1>
                    <p className="text-gray-500 mt-1">Analiza el rendimiento de tu programa de fidelidad.</p>
                </div>
                <div className="flex items-center gap-4">
                    <button onClick={handleCSVExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold hover:bg-emerald-100 transition shadow-sm">
                        <Download size={18} /> Exportar CSV
                    </button>
                    <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                        {['30_days', '6_months', 'year'].map((range) => (
                            <button key={range} onClick={() => setTimeRange(range as any)} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${timeRange === range ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}>
                                {range === '30_days' ? '30 Días' : range === '6_months' ? '6 Meses' : 'Año'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {movementsData.length === 0 ? (
                <div className="bg-white p-16 rounded-2xl shadow-sm border border-gray-100 text-center space-y-4">
                    <div className="w-20 h-20 bg-purple-50 rounded-full flex items-center justify-center mx-auto">
                        <BarChart3 size={40} className="text-purple-300" />
                    </div>
                    <h3 className="text-xl font-bold text-gray-700">No hay datos suficientes</h3>
                    <p className="text-gray-500 max-w-md mx-auto">
                        Aún no se han registrado transacciones en la nueva colección global para este periodo.
                        Comience a sumar puntos a sus clientes para ver las estadísticas aquí.
                    </p>
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Emitidos</p>
                                <p className="text-2xl font-black text-blue-600">{totalStats.emitted.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24} /></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Canjeados</p>
                                <p className="text-2xl font-black text-orange-600">{totalStats.redeemed.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Award size={24} /></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Vencidos</p>
                                <p className="text-2xl font-black text-red-600">{totalStats.expired.toLocaleString()}</p>
                            </div>
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><TrendingUp size={24} className="rotate-180" /></div>
                        </div>
                    </div>

                    {/* KPIs AVANZADOS */}
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Ticket Promedio</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-gray-800">${Math.round(advancedStats.averageTicket).toLocaleString('es-AR')}</span>
                                <span className="text-xs text-green-500 font-bold">por compra</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Frecuencia</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-gray-800">{advancedStats.frequency.toFixed(1)}</span>
                                <span className="text-xs text-blue-500 font-bold">visitas/periodo</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">Tasa de Canje</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-gray-800">
                                    {totalStats.emitted > 0 ? Math.round((totalStats.redeemed / totalStats.emitted) * 100) : 0}%
                                </span>
                                <span className="text-xs text-purple-500 font-bold">interés (%)</span>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1" title="Costo estimado de los puntos otorgados en este periodo">Inversión en Puntos (Coste)</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-2xl font-black text-red-500">${Math.round(advancedStats.potentialRevenue).toLocaleString('es-AR')}</span>
                                <span title="Basado en el valor real de tus premios activos. Este es el coste de lo que emitiste en las fechas seleccionadas." className="text-[10px] text-gray-400 cursor-help">ℹ️</span>
                            </div>
                        </div>
                    </div>

                    {/* MAPA DE CALOR */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <Clock className="text-purple-600" /> Mapa de Calor: Actividad por Día y Hora
                                </h3>
                                <p className="text-sm text-gray-500">Detecta tus momentos de mayor tráfico de ventas.</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                <span>Menos</span>
                                <div className="flex gap-1">
                                    <div className="w-3 h-3 rounded bg-purple-50"></div>
                                    <div className="w-3 h-3 rounded bg-purple-200"></div>
                                    <div className="w-3 h-3 rounded bg-purple-400"></div>
                                    <div className="w-3 h-3 rounded bg-purple-600"></div>
                                </div>
                                <span>Más</span>
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <div className="min-w-[800px]">
                                <div className="grid grid-cols-[100px_repeat(24,1fr)] gap-1">
                                    {/* Header Horas */}
                                    <div className="h-8"></div>
                                    {Array.from({ length: 24 }).map((_, h) => (
                                        <div key={h} className="text-[10px] font-bold text-gray-400 text-center">{h}h</div>
                                    ))}

                                    {/* Filas Días */}
                                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, dIdx) => (
                                        <>
                                            <div key={day} className="flex items-center text-sm font-bold text-gray-500 h-8">{day}</div>
                                            {heatmapData[dIdx].map((val, hIdx) => {
                                                const max = Math.max(...heatmapData.flat()) || 1;
                                                const opacity = val === 0 ? 0.05 : (val / max);
                                                return (
                                                    <div
                                                        key={`${dIdx}-${hIdx}`}
                                                        title={`${day} ${hIdx}hs: ${val} transacciones`}
                                                        className="h-8 rounded-sm transition-all hover:ring-2 ring-purple-400 cursor-help"
                                                        style={{
                                                            backgroundColor: `rgba(147, 51, 234, ${opacity})`,
                                                            border: val > 0 ? '1px solid rgba(147, 51, 234, 0.1)' : '1px solid transparent'
                                                        }}
                                                    />
                                                );
                                            })}
                                        </>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
                            <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
                                <TrendingUp size={20} className="text-blue-500" /> Puntos Emitidos vs Canjeados
                            </h3>
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                        <XAxis dataKey="name" fontSize={12} tickMargin={10} />
                                        <YAxis fontSize={12} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Legend />
                                        <Line type="monotone" dataKey="emitted" name="Emitidos" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                        <Line type="monotone" dataKey="redeemed" name="Canjeados" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="expired" name="Vencidos" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
                            <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
                                <DollarSign size={20} className="text-green-500" /> Dinero Devuelto (Estimado)
                            </h3>
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <BarChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                        <XAxis dataKey="name" fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Legend />
                                        <Bar dataKey="money" name="Dinero ($)" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2">
                            <Users size={20} className="text-purple-500" /> Origen de Registros (Nuevos)
                        </h3>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-8">
                            <div className="space-y-4">
                                <div className="flex justify-between items-end"><span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Altas vía PWA</span><span className="text-2xl font-black text-purple-600">{registrationSources.pwa}</span></div>
                                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                                    <div className="bg-purple-500 h-full transition-all duration-1000" style={{ width: `${(registrationSources.pwa / (registrationSources.pwa + registrationSources.local || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                            <div className="space-y-4">
                                <div className="flex justify-between items-end"><span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Altas en el Local</span><span className="text-2xl font-black text-emerald-600">{registrationSources.local}</span></div>
                                <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                                    <div className="bg-emerald-500 h-full transition-all duration-1000" style={{ width: `${(registrationSources.local / (registrationSources.pwa + registrationSources.local || 1)) * 100}%` }}></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={18} className="text-purple-500" /> Clientes con Mayor Saldo</h3>
                                <p className="text-xs text-gray-400 mt-1">Acumulado total disponible hoy</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold"><tr><th className="p-4 pl-6">Cliente</th><th className="p-4 text-right pr-6">Saldo Puntos</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {topUsers.map((user: any, i: number) => (
                                            <tr key={user.id} className="hover:bg-purple-50/30 transition">
                                                <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                                                    <div className="flex flex-col"><span>{user.name || 'Socio sin N° asignado'}</span><span className="text-[10px] text-gray-400 font-mono">{user.socioNumber ? `#${user.socioNumber}` : ''} {user.dni ? `| DNI: ${user.dni}` : ''}</span></div>
                                                </td>
                                                <td className="p-4 text-right pr-6 font-bold text-purple-600">{user.points?.toLocaleString() || 0}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Award size={18} className="text-green-500" /> Top Generadores (COMPRA)</h3>
                                <p className="text-xs text-gray-400 mt-1">Más puntos generados en este periodo</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold"><tr><th className="p-4 pl-6">Cliente</th><th className="p-4 text-right pr-6">Gasto Estimado</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {topSpenders.length === 0 ? (<tr><td colSpan={2} className="p-8 text-center text-gray-400 italic">Sin movimientos en este periodo</td></tr>) : (
                                            topSpenders.map((user: any, i: number) => (
                                                <tr key={user.id} className="hover:bg-green-50/30 transition">
                                                    <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                                                        <div className="flex flex-col"><span>{user.name}</span><span className="text-[10px] text-gray-400 font-mono">{user.socioNumber ? `#${user.socioNumber}` : ''} {user.dni ? `| DNI: ${user.dni}` : ''}</span></div>
                                                    </td>
                                                    <td className="p-4 text-right pr-6 font-bold text-green-600">${user.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-orange-500" /> Clientes más Fieles (APP)</h3>
                                <p className="text-xs text-gray-400 mt-1">Socios con más aperturas de la app</p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-gray-50 text-gray-500 font-semibold"><tr><th className="p-4 pl-6">Cliente</th><th className="p-4 text-right pr-6">Visitas</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {topVisitors.map((user: any, i: number) => (
                                            <tr key={user.id} className="hover:bg-orange-50/30 transition">
                                                <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                                                    <div className="flex flex-col"><span>{user.name}</span><span className="text-[10px] text-gray-400 font-mono">{user.socioNumber ? `#${user.socioNumber}` : ''}</span></div>
                                                </td>
                                                <td className="p-4 text-right pr-6 font-bold text-orange-600 text-lg">{user.count}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )
            }
        </div >
    );
};
