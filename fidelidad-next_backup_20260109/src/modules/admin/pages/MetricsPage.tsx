import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Award } from 'lucide-react';
import { collection, query, where, getDocs, collectionGroup, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';

import { ConfigService } from '../../../services/configService';

export const MetricsPage = () => {
    const [timeRange, setTimeRange] = useState<'30_days' | '6_months' | 'year'>('6_months');
    const [chartData, setChartData] = useState<any[]>([]);
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [topSpenders, setTopSpenders] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<any>(null);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                // Fetch Config for Ratio
                const appConfig = await ConfigService.get();
                setConfig(appConfig);
                // Formula: Points = (Pesos / 100) * ratio  => Pesos = (Points / ratio) * 100

                // 1. Define Date Range
                const now = new Date();
                const startDate = new Date();
                if (timeRange === '30_days') startDate.setDate(now.getDate() - 30);
                if (timeRange === '6_months') startDate.setMonth(now.getMonth() - 6);
                if (timeRange === 'year') startDate.setFullYear(now.getFullYear() - 1);

                // 2. Fetch History (Global) with Collection Group
                const qHistory = query(
                    collectionGroup(db, 'points_history'),
                    where('date', '>=', startDate),
                    orderBy('date', 'asc')
                );

                const snapHistory = await getDocs(qHistory);
                const movements = snapHistory.docs.map(d => ({
                    ...d.data(),
                    date: d.data().date.toDate(),
                    // Extract userId from parent ref path: users/{userId}/points_history/{docId}
                    userId: d.ref.parent.parent?.id
                }));

                // 3. Process Data for Charts and Rankings
                const groupedData = new Map<string, { emitted: number, redeemed: number, money: number }>();
                const spendersMap = new Map<string, number>();

                movements.forEach((mov: any) => {
                    // --- Chart Data Grouping ---
                    const key = timeRange === '30_days'
                        ? mov.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                        : mov.date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });

                    const current = groupedData.get(key) || { emitted: 0, redeemed: 0, money: 0 };

                    if (mov.type === 'credit') {
                        current.emitted += (mov.amount || 0);

                        // --- Top Spenders Accumulation ---
                        if (mov.userId) {
                            let pesoValue = 0;

                            if (mov.moneySpent !== undefined) {
                                // Dato real (Nuevo sistema)
                                pesoValue = mov.moneySpent;
                            } else {
                                // Estimación (Datos viejos)
                                // Excluir regalos obvios
                                const concept = (mov.concept || '').toLowerCase();
                                const isGift = concept.includes('regalo') ||
                                    concept.includes('bienvenida') ||
                                    concept.includes('bono');

                                if (!isGift && mov.amount > 0) {
                                    const ratio = config?.pointsPerPeso || 1;
                                    // Evitar división por 0 o NaN
                                    const safeRatio = ratio > 0 ? ratio : 1;
                                    pesoValue = Math.round((mov.amount * 100) / safeRatio);
                                }
                            }

                            if (pesoValue > 0) {
                                const currentTotal = spendersMap.get(mov.userId) || 0;
                                spendersMap.set(mov.userId, currentTotal + pesoValue);
                            }
                        }

                    } else if (mov.type === 'debit') {
                        current.redeemed += Math.abs(mov.amount || 0);
                        current.money += (mov.redeemedValue || 0);
                    }
                    groupedData.set(key, current);
                });

                setChartData(Array.from(groupedData.entries()).map(([name, data]) => ({ name, ...data })));

                // 4. Fetch Top Users (Current Balance)
                // Independent of time range, shows current state
                // Independent of time range, shows current state
                // Try 'puntos' first (new schema), if empty maybe 'points'? No, unified to 'clientes'.
                const qUsers = query(collection(db, 'users'), orderBy('points', 'desc'), limit(5)); // Reverted to 'users' and 'points'
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

                // 5. Process Top Spenders Names
                const sortedSpendersIds = Array.from(spendersMap.entries())
                    .sort(([, a], [, b]) => b - a)
                    .slice(0, 5);

                const spendersData = await Promise.all(sortedSpendersIds.map(async ([uid, total]) => {
                    // Try to find in already fetched topUsers to save a read
                    const existing = snapUsers.docs.find(d => d.id === uid);
                    if (existing) {
                        const uData = existing.data();
                        return { id: uid, name: uData.name, dni: uData.dni, socioNumber: uData.socioNumber, total };
                    }

                    // If not found, fetch individual user name
                    // In a real app with many users, we might use a 'where in' query or just display ID
                    try {
                        const qUser = query(collection(db, 'users'), where(documentId(), '==', uid)); // Reverted to 'users'
                        const userSnap = await getDocs(qUser);
                        if (!userSnap.empty) {
                            const uData = userSnap.docs[0].data();
                            return {
                                id: uid,
                                name: uData.name || uData.nombre || 'Desconocido',
                                dni: uData.dni,
                                socioNumber: uData.socioNumber || uData.numeroSocio,
                                total
                            };
                        }
                    } catch (e) {
                        // ignore
                    }
                    return { id: uid, name: 'Socio sin N° asignado', total };
                }));
                setTopSpenders(spendersData);

            } catch (error) {
                console.error("Error metrics:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [timeRange]);

    if (loading) {
        return <div className="p-10 text-center text-gray-400">Cargando métricas...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in text-gray-800 pb-12">
            {/* Header */}
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="text-purple-600" /> Métricas y Reportes
                    </h1>
                    <p className="text-gray-500 mt-1">Analiza el rendimiento de tu programa de fidelidad.</p>
                </div>

                {/* Time Filter */}
                <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                    {['30_days', '6_months', 'year'].map((range) => (
                        <button
                            key={range}
                            onClick={() => setTimeRange(range as any)}
                            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${timeRange === range ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
                        >
                            {range === '30_days' ? '30 Días' : range === '6_months' ? '6 Meses' : 'Año'}
                        </button>
                    ))}
                </div>
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Points Evolution */}
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
                                <RechartsTooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Legend />
                                <Line type="monotone" dataKey="emitted" name="Emitidos" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                                <Line type="monotone" dataKey="redeemed" name="Canjeados" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Monetary Value */}
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
                                <RechartsTooltip cursor={{ fill: '#f3f4f6' }} contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                <Legend />
                                <Bar dataKey="money" name="Dinero ($)" fill="#22c55e" radius={[4, 4, 0, 0]} barSize={40} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>

            {/* Rankings Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

                {/* Top Balance (Accumulators) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Users size={18} className="text-purple-500" /> Clientes con Mayor Saldo
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">Acumulado total disponible hoy</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-semibold">
                                <tr>
                                    <th className="p-4 pl-6">Cliente</th>
                                    <th className="p-4 text-right pr-6">Saldo Puntos</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topUsers.map((user, i) => (
                                    <tr key={user.id} className="hover:bg-purple-50/30 transition">
                                        <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3">
                                            <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                                                {i + 1}
                                            </span>
                                            <div className="flex flex-col">
                                                <span>{user.name || 'Socio sin N° asignado'}</span>
                                                <span className="text-[10px] text-gray-400 font-mono">
                                                    {user.socioNumber ? `#${user.socioNumber}` : ''} {user.dni ? `| DNI: ${user.dni}` : ''}
                                                </span>
                                            </div>
                                        </td>
                                        <td className="p-4 text-right pr-6 font-bold text-purple-600">
                                            {user.points?.toLocaleString() || 0}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Top Spenders (Generated Points) */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                    <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                        <h3 className="font-bold text-gray-800 flex items-center gap-2">
                            <Award size={18} className="text-green-500" /> Top Generadores (COMPRA)
                        </h3>
                        <p className="text-xs text-gray-400 mt-1">Más puntos generados en este periodo</p>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-semibold">
                                <tr>
                                    <th className="p-4 pl-6">Cliente</th>
                                    <th className="p-4 text-right pr-6">Gasto Estimado</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {topSpenders.length === 0 ? (
                                    <tr>
                                        <td colSpan={2} className="p-8 text-center text-gray-400 italic">
                                            Sin movimientos en este periodo
                                        </td>
                                    </tr>
                                ) : (
                                    topSpenders.map((user, i) => {
                                        // Calcular Dinero Estimado: (Puntos * 100) / Ratio
                                        // Si ratio es indefinido, default a 1 para evitar division por 0 (aunque 0 daría infinity)
                                        const ratio = config?.pointsPerPeso || 1;
                                        // Evitar division por cero si ratio es 0 (user input handling)
                                        const safeRatio = ratio === 0 ? 1 : ratio;
                                        const estimatedMoney = (user.total * 100) / safeRatio;

                                        return (
                                            <tr key={user.id} className="hover:bg-green-50/30 transition">
                                                <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3">
                                                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                                                        {i + 1}
                                                    </span>
                                                    <div className="flex flex-col">
                                                        <span>{user.name}</span>
                                                        <span className="text-[10px] text-gray-400 font-mono">
                                                            {user.socioNumber ? `#${user.socioNumber}` : ''} {user.dni ? `| DNI: ${user.dni}` : ''}
                                                        </span>
                                                    </div>
                                                </td>
                                                <td className="p-4 text-right pr-6 font-bold text-green-600">
                                                    ${estimatedMoney.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

            </div>
        </div>
    );
};
