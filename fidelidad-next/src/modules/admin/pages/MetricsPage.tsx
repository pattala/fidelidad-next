import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Award, Sparkles, Download, Clock, Calendar, RefreshCw } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, documentId } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import toast from 'react-hot-toast';

import { ConfigService } from '../../../services/configService';

export const MetricsPage = () => {
    const [timeRange, setTimeRange] = useState<'today' | '30_days' | '6_months' | 'year' | 'total' | 'custom'>('30_days');
    const [customDates, setCustomDates] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });

    const [chartData, setChartData] = useState<any[]>([]);
    const [prevChartData, setPrevChartData] = useState<any[]>([]); // Para comparativas
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [topSpenders, setTopSpenders] = useState<any[]>([]);
    const [topVisitors, setTopVisitors] = useState<any[]>([]);
    const [topReferrers, setTopReferrers] = useState<any[]>([]);
    const [registrationSources, setRegistrationSources] = useState<{ pwa: number, local: number }>({ pwa: 0, local: 0 });
    const [totalStats, setTotalStats] = useState({ emitted: 0, redeemed: 0, expired: 0 });
    const [prevTotalStats, setPrevTotalStats] = useState({ emitted: 0, redeemed: 0, expired: 0 });
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<any>(null);
    const [movementsData, setMovementsData] = useState<any[]>([]);
    const [forecastData, setForecastData] = useState<any>(null);
    const [forecastDates, setForecastDates] = useState({
        start: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
        end: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
    });
    const [fetchingForecast, setFetchingForecast] = useState(false);

    const [advancedStats, setAdvancedStats] = useState({
        averageTicket: 0,
        frequency: 0,
        activeCustomers: 0,
        totalCustomers: 0,
        potentialRevenue: 0,
        creditCount: 0,
        referralCount: 0
    });
    const [prevAdvancedStats, setPrevAdvancedStats] = useState({
        averageTicket: 0,
        frequency: 0,
        activeCustomers: 0,
        totalCustomers: 0,
        potentialRevenue: 0,
        creditCount: 0,
        referralCount: 0
    });
    const [heatmapData, setHeatmapData] = useState<number[][]>(Array(7).fill(0).map(() => Array(24).fill(0)));

    const fetchForecast = async () => {
        setFetchingForecast(true);
        try {
            const SECRET = import.meta.env.VITE_API_KEY || '';
            const fRes = await fetch(`/api/expirations?action=forecast&startDate=${forecastDates.start}&endDate=${forecastDates.end}`, {
                headers: { 'x-api-key': SECRET }
            });
            const fData = await fRes.json();
            if (fData.ok) setForecastData(fData.summary);
        } catch (e) {
            console.error("Error fetching forecast:", e);
        } finally {
            setFetchingForecast(false);
        }
    };

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            try {
                const appConfig = await ConfigService.get();
                setConfig(appConfig);

                const now = new Date();
                let startDate = new Date();
                let endDate = new Date();

                if (timeRange === '30_days') startDate.setDate(now.getDate() - 30);
                else if (timeRange === '6_months') startDate.setMonth(now.getMonth() - 6);
                else if (timeRange === 'year') startDate.setFullYear(now.getFullYear() - 1);
                if (timeRange === 'today') {
                    startDate.setHours(0, 0, 0, 0);
                    endDate.setHours(23, 59, 59, 999);
                } else if (timeRange === '30_days') {
                    startDate.setDate(now.getDate() - 30);
                } else if (timeRange === '6_months') {
                    startDate.setMonth(now.getMonth() - 6);
                } else if (timeRange === 'year') {
                    startDate.setFullYear(now.getFullYear() - 1);
                } else if (timeRange === 'custom') {
                    startDate = new Date(customDates.start + 'T00:00:00');
                    endDate = new Date(customDates.end + 'T23:59:59');
                } else if (timeRange === 'total') {
                    startDate = new Date(2020, 0, 1);
                }

                const isTotal = timeRange === 'total';
                const duration = endDate.getTime() - startDate.getTime();
                const prevEndDate = new Date(startDate.getTime() - 1000);
                const prevStartDate = new Date(prevEndDate.getTime() - duration);

                const fetchRangeData = async (start: Date, end: Date, isTotalMode = false) => {
                    const constraints: any[] = [orderBy('date', 'asc')];
                    if (!isTotalMode) {
                        constraints.push(where('date', '>=', start), where('date', '<=', end));
                    }
                    const q = query(collection(db, 'transactions'), ...constraints);
                    const snap = await getDocs(q);
                    return snap.docs.map(d => {
                        const data = d.data();
                        return {
                            ...data,
                            id: d.id,
                            date: data.date?.toDate ? data.date.toDate() : new Date(),
                            points: data.points || 0,
                            moneySpent: data.moneySpent || (data.type === 'credit' ? data.amount : 0) || 0
                        };
                    });
                };

                const [currentMovements, prevMovements] = await Promise.all([
                    fetchRangeData(startDate, endDate, isTotal),
                    isTotal ? Promise.resolve([]) : fetchRangeData(prevStartDate, prevEndDate)
                ]);

                setMovementsData(currentMovements);

                const processStats = (movements: any[]) => {
                    const grouped = new Map<string, { emitted: number, redeemed: number, expired: number, money: number, referrals: number }>();
                    const spenders = new Map<string, number>();
                    let tEmitted = 0, tRedeemed = 0, tExpired = 0, tMoneyRedeemed = 0;
                    let totalMoneySpent = 0, creditCount = 0, referralCount = 0;
                    const activeUids = new Set<string>();
                    const heatmap = Array(7).fill(0).map(() => Array(24).fill(0));

                    movements.forEach((mov: any) => {
                        const key = (timeRange === 'today' || timeRange === '30_days' || timeRange === 'custom')
                            ? mov.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                            : mov.date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });

                        const current = grouped.get(key) || { emitted: 0, redeemed: 0, expired: 0, money: 0, referrals: 0 };

                        if (mov.type === 'credit') {
                            const pts = Number(mov.points || 0);
                            current.emitted += pts;
                            tEmitted += pts;

                            if (mov.reason === 'referral_bonus') {
                                referralCount++;
                                current.referrals = (current.referrals || 0) + 1;
                            }

                            const money = Number(mov.moneySpent || 0);
                            if (money > 0) {
                                totalMoneySpent += money;
                                creditCount++;
                                const userId = mov.uid || mov.userId;
                                if (userId) spenders.set(userId, (spenders.get(userId) || 0) + money);
                                heatmap[mov.date.getDay()][mov.date.getHours()]++;
                            }
                            activeUids.add(mov.uid || mov.userId);
                        } else {
                            const pts = Math.abs(Number(mov.points || 0));
                            const concept = (mov.concept || '').toLowerCase();
                            const isEx = concept.includes('vencimiento') || concept.includes('vencidos') || concept.includes('expirados');

                            if (isEx) { current.expired += pts; tExpired += pts; }
                            else {
                                current.redeemed += pts; tRedeemed += pts;
                                const val = (mov.redeemedValue || 0);
                                current.money += val; tMoneyRedeemed += val;
                            }
                        }
                        grouped.set(key, current);
                    });

                    return { grouped, spenders, tEmitted, tRedeemed, tExpired, tMoneyRedeemed, totalMoneySpent, creditCount, activeUids, heatmap, referralCount };
                };

                const currentResults = processStats(currentMovements);
                const prevResults = processStats(prevMovements);

                // Calcular Valor Real del Punto (Reality Check) sin bloqueos
                const realPV = (appConfig.pointValue || 10);

                setTotalStats({ emitted: currentResults.tEmitted, redeemed: currentResults.tRedeemed, expired: currentResults.tExpired });
                setPrevTotalStats({ emitted: prevResults.tEmitted, redeemed: prevResults.tRedeemed, expired: prevResults.tExpired });
                setChartData(Array.from(currentResults.grouped.entries()).map(([name, data]) => ({ name, ...data })));
                setHeatmapData(currentResults.heatmap);

                setAdvancedStats({
                    averageTicket: currentResults.creditCount > 0 ? currentResults.totalMoneySpent / currentResults.creditCount : 0,
                    frequency: currentResults.activeUids.size > 0 ? currentResults.creditCount / currentResults.activeUids.size : 0,
                    activeCustomers: currentResults.activeUids.size,
                    totalCustomers: currentResults.activeUids.size, // Simplificado sin censo lento
                    potentialRevenue: currentResults.tEmitted * realPV,
                    creditCount: currentResults.creditCount,
                    referralCount: currentResults.referralCount
                });

                // Conteo liviano de orígenes (PWA vs Local)
                const [pwaSnap, localSnap] = await Promise.all([
                    getDocs(query(collection(db, 'users'), where('source', '==', 'pwa'))),
                    getDocs(query(collection(db, 'users'), where('source', '==', 'local')))
                ]);
                setRegistrationSources({ 
                    pwa: pwaSnap.size, 
                    local: localSnap.size 
                });

                setPrevAdvancedStats({
                    averageTicket: prevResults.creditCount > 0 ? prevResults.totalMoneySpent / prevResults.creditCount : 0,
                    frequency: prevResults.activeUids.size > 0 ? prevResults.creditCount / prevResults.activeUids.size : 0,
                    activeCustomers: prevResults.activeUids.size,
                    totalCustomers: prevResults.activeUids.size,
                    potentialRevenue: prevResults.tEmitted * realPV,
                    creditCount: prevResults.creditCount,
                    referralCount: prevResults.referralCount
                });

                // 1. Clientes con Mayor Saldo
                const qTopBalance = query(collection(db, 'users'), orderBy('points', 'desc'), limit(15)); // Fetch more to filter ghosts
                const snapTopBalance = await getDocs(qTopBalance);
                const filteredTopBalance = snapTopBalance.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter(u => u.name || u.nombre || u.dni)
                    ?.slice(0, 5);

                setTopUsers(filteredTopBalance.map(user => {
                    return { id: user.id, ...user, name: user.name || user.nombre || 'Socio sin nombre', points: user.points || 0, socioNumber: user.socioNumber || user.numeroSocio || '' };
                }));

                // 2. Top Generadores (COMPRA) - Procesar spenders del periodo
                const sortedSpenders = Array.from(currentResults.spenders.entries())
                    .sort((a, b) => b[1] - a[1])
                    ?.slice(0, 5);

                if (sortedSpenders.length > 0) {
                    const uids = sortedSpenders.map(s => s[0]);
                    const usersSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', uids)));
                    const usersMap = new Map();
                    usersSnap.forEach(d => usersMap.set(d.id, d.data()));

                    const spenderDetails = sortedSpenders.map(([uid, total]) => {
                        const uData = usersMap.get(uid);
                        if (uData) {
                            return { id: uid, name: uData.name || uData.nombre || 'Socio', total, socioNumber: uData.socioNumber || uData.numeroSocio || '', dni: uData.dni || '' };
                        }
                        return { id: uid, name: 'Socio Desconocido', total, socioNumber: '', dni: '' };
                    });
                    setTopSpenders(spenderDetails);
                } else {
                    setTopSpenders([]);
                }

                // 3. Clientes m├ís Fieles (APP)
                const qVisitors = query(collection(db, 'users'), orderBy('visitCount', 'desc'), limit(15));
                const snapVisitors = await getDocs(qVisitors);
                const filteredVisitors = snapVisitors.docs
                    .map(d => ({ id: d.id, ...d.data() } as any))
                    .filter(u => u.name || u.nombre || u.dni)
                    ?.slice(0, 5);

                setTopVisitors(filteredVisitors.map(user => {
                    return { id: user.id, ...user, name: user.name || user.nombre || 'Socio', count: user.visitCount || 0, socioNumber: user.socioNumber || user.numeroSocio || '' };
                }));

                // 4. Ranking de Referidores (Desaf├¡o)
                const challenge = appConfig?.referrals?.challenge;
                if (challenge?.enabled) {
                    const start = new Date(challenge.startDate);
                    const end = new Date(challenge.endDate);
                    end.setHours(23, 59, 59, 999);

                    // Buscamos usuarios creados en este periodo
                    const qReferrals = query(
                        collection(db, 'users'),
                        where('createdAt', '>=', start),
                        where('createdAt', '<=', end)
                    );
                    const snapReferrals = await getDocs(qReferrals);

                    const refCounts = new Map<string, number>();
                    snapReferrals.docs.forEach(d => {
                        const data = d.data();
                        const refUid = data.referrerUid;
                        if (refUid) refCounts.set(refUid, (refCounts.get(refUid) || 0) + 1);
                    });

                    const sortedRefs = Array.from(refCounts.entries())
                        .sort((a, b) => b[1] - a[1])
                        ?.slice(0, 5);

                    if (sortedRefs.length > 0) {
                        const uids = sortedRefs.map(s => s[0]);
                        const usersSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', uids)));
                        const usersMap = new Map();
                        usersSnap.forEach(d => usersMap.set(d.id, d.data()));

                        setTopReferrers(sortedRefs.map(([uid, count]) => {
                            const uData = usersMap.get(uid);
                            return {
                                id: uid,
                                name: uData?.name || uData?.nombre || 'Socio',
                                count,
                                socioNumber: uData?.socioNumber || uData?.numeroSocio || ''
                            };
                        }));
                    } else {
                        setTopReferrers([]);
                    }
                } else {
                    // Si no hay desaf├¡o, mostrar top hist├│ricos
                    const qTopHistory = query(collection(db, 'users'), orderBy('referralStats.count', 'desc'), limit(5));
                    const snapTopHistory = await getDocs(qTopHistory);
                    setTopReferrers(snapTopHistory.docs.map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            name: data.name || data.nombre || 'Socio',
                            count: data.referralStats?.count || 0,
                            socioNumber: data.socioNumber || data.numeroSocio || ''
                        };
                    }));
                }

                if (currentMovements.length > 0) {
                    fetchForecast();
                }

            } catch (error) {
                console.error("Error metrics:", error);
                toast.error("Error al cargar las m├®tricas");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, [timeRange, customDates]);

    const handleCSVExport = () => {
        if (movementsData.length === 0) {
            toast.error("No hay datos para exportar en este periodo.");
            return;
        }

        const headers = ["Fecha", "Cliente", "Socio #", "Tipo", "Concepto", "Puntos", "Monto $"];

        // Formateador para n├║meros en espa├▒ol (Argentina)
        const numFormat = new Intl.NumberFormat('es-AR', {
            minimumFractionDigits: 0,
            maximumFractionDigits: 2
        });

        const rows = movementsData.map(m => [
            m.date.toLocaleString('es-AR'),
            m.clientName || 'N/A',
            m.socioNumber || 'N/A',
            m.type === 'credit' ? 'Suma' : 'Canje/Baja',
            m.concept || '',
            m.points || 0,
            numFormat.format(m.amount || 0)
        ]);

        // Usamos punto y coma (;) para compatibilidad con Excel en espa├▒ol
        const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");

        // Agregar BOM para que Excel reconozca UTF-8 correctamente
        const BOM = "\ufeff";
        const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });

        const link = document.createElement("a");
        const url = URL.createObjectURL(blob);
        link.setAttribute("href", url);
        link.setAttribute("download", `metricas_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("CSV exportado correctamente");
    };

    if (loading) {
        return <div className="p-10 text-center text-gray-400">Cargando m├®tricas...</div>;
    }

    return (
        <div className="space-y-8 animate-fade-in text-gray-800 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="text-purple-600" /> M├®tricas y Reportes
                    </h1>
                    <p className="text-gray-500 mt-1">Analiza el rendimiento de tu programa de fidelidad.</p>
                </div>
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleCSVExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold hover:bg-emerald-100 transition shadow-sm">
                        <Download size={18} /> Exportar
                    </button>
                    <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: '30_days', label: '30 D├¡as' },
                            { id: '6_months', label: '6 Meses' },
                            { id: 'total', label: 'Acumulado' },
                            { id: 'custom', label: 'Personalizado' }
                        ].map((range) => (
                            <button
                                key={range.id}
                                onClick={() => setTimeRange(range.id as any)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition ${timeRange === range.id ? 'bg-purple-100 text-purple-700' : 'text-gray-500 hover:bg-gray-50'}`}
                            >
                                {range.label}
                            </button>
                        ))}
                    </div>
                    {timeRange === 'custom' && (
                        <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-200 p-2 animate-fade-in">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase ml-1">Desde</label>
                                <input
                                    type="date"
                                    className="px-2 py-1 text-sm border-none focus:ring-0 outline-none font-medium text-gray-700"
                                    value={customDates.start}
                                    onChange={e => setCustomDates({ ...customDates, start: e.target.value })}
                                />
                            </div>
                            <div className="w-px h-4 bg-gray-200"></div>
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-bold text-gray-400 uppercase">Hasta</label>
                                <input
                                    type="date"
                                    className="px-2 py-1 text-sm border-none focus:ring-0 outline-none font-medium text-gray-700"
                                    value={customDates.end}
                                    onChange={e => setCustomDates({ ...customDates, end: e.target.value })}
                                />
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {false ? (
                null
            ) : (
                <>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {(() => {
                            const TrendIndicator = ({ current, prev, isRed = false }: { current: number, prev: number, isRed?: boolean }) => {
                                if (prev === 0) return null;
                                const diff = ((current - prev) / prev) * 100;
                                const isPositive = diff > 0;
                                const colorClass = isRed ? (isPositive ? 'text-red-500' : 'text-green-500') : (isPositive ? 'text-green-500' : 'text-red-500');
                                return (
                                    <div className={`flex items-center gap-1 text-[11px] font-bold ${colorClass} mt-1`}>
                                        {isPositive ? 'Ôåæ' : 'Ôåô'} {Math.abs(Math.round(diff))}% <span className="text-gray-400 font-normal">vs anterior</span>
                                    </div>
                                );
                            };

                            return (
                                <>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Emitidos</p>
                                            <p className="text-2xl font-black text-blue-600">{totalStats.emitted.toLocaleString()}</p>
                                            <TrendIndicator current={totalStats.emitted} prev={prevTotalStats.emitted} />
                                        </div>
                                        <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24} /></div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Canjeados</p>
                                            <p className="text-2xl font-black text-orange-600">{totalStats.redeemed.toLocaleString()}</p>
                                            <TrendIndicator current={totalStats.redeemed} prev={prevTotalStats.redeemed} />
                                        </div>
                                        <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Award size={24} /></div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
                                        <div>
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Vencidos</p>
                                            <p className="text-2xl font-black text-red-600">{totalStats.expired.toLocaleString()}</p>
                                            <TrendIndicator current={totalStats.expired} prev={prevTotalStats.expired} isRed />
                                        </div>
                                        <div className="p-3 bg-red-50 text-red-600 rounded-xl"><TrendingUp size={24} className="rotate-180" /></div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* KPIs AVANZADOS */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-6">
                        {(() => {
                            const TrendIndicator = ({ current, prev }: { current: number, prev: number }) => {
                                if (prev === 0) return null;
                                const diff = ((current - prev) / prev) * 100;
                                const isPositive = diff > 0;
                                return (
                                    <div className={`flex items-center gap-1 text-[10px] font-bold ${isPositive ? 'text-green-500' : 'text-red-500'}`}>
                                        {isPositive ? 'Ôåæ' : 'Ôåô'} {Math.abs(Math.round(diff))}%
                                    </div>
                                );
                            };

                            return (
                                <>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ticket Promedio</p>
                                            <TrendIndicator current={advancedStats.averageTicket} prev={prevAdvancedStats.averageTicket} />
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-gray-800">${Math.round(advancedStats.averageTicket).toLocaleString('es-AR')}</span>
                                            <span className="text-xs text-green-500 font-bold">compra</span>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Ventas Totales</p>
                                            <TrendIndicator current={advancedStats.creditCount} prev={prevAdvancedStats.creditCount} />
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-gray-800">{advancedStats.creditCount}</span>
                                            <span className="text-xs text-blue-500 font-bold">visitas</span>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Referidos Exitosos</p>
                                            <TrendIndicator current={advancedStats.referralCount} prev={prevAdvancedStats.referralCount} />
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-purple-600">{advancedStats.referralCount}</span>
                                            <span className="text-xs text-purple-500 font-bold">socios</span>
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Clientes Activos</p>
                                            <TrendIndicator current={advancedStats.activeCustomers} prev={prevAdvancedStats.activeCustomers} />
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-gray-800">{advancedStats.activeCustomers}</span>
                                            <span className="text-xs text-emerald-500 font-bold">de {advancedStats.totalCustomers}</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-1 uppercase tracking-tighter font-bold">Socios con actividad hoy</p>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 transition hover:shadow-md">
                                        <div className="flex justify-between items-start mb-1">
                                            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Costo de Emisi├│n</p>
                                            <TrendIndicator current={advancedStats.potentialRevenue} prev={prevAdvancedStats.potentialRevenue} />
                                        </div>
                                        <div className="flex items-baseline gap-2">
                                            <span className="text-2xl font-black text-red-500">${Math.round(advancedStats.potentialRevenue).toLocaleString('es-AR')}</span>
                                            <span title="Costo te├│rico basado en el valor real de tus premios activos." className="text-[10px] text-gray-400 cursor-help">Ôä╣´©Å</span>
                                        </div>
                                    </div>
                                </>
                            );
                        })()}
                    </div>

                    {/* PRON├ôSTICO DE VENCIMIENTOS (CASH FLOW) */}
                    <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-3xl border border-gray-100 shadow-sm mb-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-8">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <Clock className="text-orange-500" /> Pron├│stico de Vencimientos (Cash Flow)
                                </h3>
                                <p className="text-sm text-gray-500 mt-1">Estimaci├│n de puntos por vencer y su impacto financiero en el corto, mediano y largo plazo.</p>
                            </div>
                            <div className="flex items-center gap-3">
                                <div className="flex items-center gap-2 bg-white rounded-xl shadow-sm border border-gray-200 p-2">
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase ml-1">An├ílisis Desde</label>
                                        <input
                                            type="date"
                                            className="px-1 py-0.5 text-xs border-none focus:ring-0 outline-none font-bold text-gray-700"
                                            value={forecastDates.start}
                                            onChange={e => setForecastDates({ ...forecastDates, start: e.target.value })}
                                        />
                                    </div>
                                    <div className="w-px h-3 bg-gray-200"></div>
                                    <div className="flex items-center gap-2">
                                        <label className="text-[9px] font-black text-gray-400 uppercase">Hasta</label>
                                        <input
                                            type="date"
                                            className="px-1 py-0.5 text-xs border-none focus:ring-0 outline-none font-bold text-gray-700"
                                            value={forecastDates.end}
                                            onChange={e => setForecastDates({ ...forecastDates, end: e.target.value })}
                                        />
                                    </div>
                                    <button
                                        onClick={fetchForecast}
                                        disabled={fetchingForecast}
                                        className="ml-2 bg-orange-100 text-orange-600 p-1.5 rounded-lg hover:bg-orange-200 transition disabled:opacity-50"
                                        title="Recalcular an├ílisis"
                                    >
                                        {fetchingForecast ? <RefreshCw className="animate-spin" size={14} /> : <Calendar size={14} />}
                                    </button>
                                </div>
                                <div className="bg-orange-50 px-4 py-2 rounded-2xl border border-orange-100">
                                    <span className="text-[10px] font-black text-orange-600 uppercase tracking-widest block mb-0.5">Pasivo Potencial Total</span>
                                    <span className="text-xl font-black text-orange-700">
                                        ${forecastData?.totalMoney ? Math.round(forecastData.totalMoney).toLocaleString('es-AR') : '...'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
                            {/* Bucket Personalizado */}
                            {forecastData?.customRange && (
                                <div className="bg-gradient-to-br from-orange-500 to-rose-600 p-5 rounded-2xl shadow-lg shadow-orange-100 text-white transform hover:scale-[1.02] transition pointer-events-none">
                                    <p className="text-[10px] font-black opacity-80 uppercase tracking-widest mb-3">
                                        Rango Seleccionado
                                    </p>
                                    <div className="space-y-1">
                                        <p className="text-2xl font-black">
                                            {forecastData.customRange.points.toLocaleString()} <span className="text-xs font-bold opacity-70">pts</span>
                                        </p>
                                        <p className="text-sm font-bold opacity-90">
                                            Ôëê ${Math.round(forecastData.customRange.money).toLocaleString('es-AR')}
                                        </p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-white/20 flex items-center justify-between">
                                        <span className="text-[10px] font-bold opacity-70">{forecastData.customRange.count} Transacciones</span>
                                        <div className="w-2 h-2 rounded-full bg-white animate-pulse"></div>
                                    </div>
                                </div>
                            )}

                            {forecastData?.intervals?.map((interval: any) => (
                                <div key={interval.key} className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm hover:shadow-md transition group">
                                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-3 group-hover:text-orange-500 transition-colors">
                                        {interval.label}
                                    </p>
                                    <div className="space-y-1">
                                        <p className="text-2xl font-black text-gray-800">
                                            {interval.points.toLocaleString()} <span className="text-xs font-bold text-gray-400">pts</span>
                                        </p>
                                        <p className="text-sm font-bold text-orange-600">
                                            Ôëê ${Math.round(interval.money).toLocaleString('es-AR')}
                                        </p>
                                    </div>
                                    <div className="mt-4 pt-4 border-t border-gray-50 flex items-center justify-between">
                                        <span className="text-[10px] font-bold text-gray-400">{interval.count} Transacciones</span>
                                        <div className={`w-2 h-2 rounded-full ${interval.key === 'short' ? 'bg-red-500 animate-pulse' :
                                            interval.key === 'medium' ? 'bg-orange-400' :
                                                interval.key === 'long' ? 'bg-amber-300' : 'bg-green-200'
                                            }`}></div>
                                    </div>
                                </div>
                            ))}
                            {!forecastData && [1, 2, 3, 4].map(i => (
                                <div key={i} className="bg-gray-50 h-32 rounded-2xl animate-pulse"></div>
                            ))}
                        </div>

                        <div className="mt-6 p-4 bg-blue-50/50 rounded-2xl border border-blue-100/50">
                            <p className="text-xs text-blue-700 leading-relaxed">
                                ­ƒÆí <b>Consejo:</b> Si notas un volumen alto en "Pr├│ximos 7 d├¡as", considera lanzar una campa├▒a de canje flash para que los socios aprovechen sus puntos antes de perderlos.
                                El valor monetario est├í calculado a un ratio de <b>${Math.round(forecastData?.pointValue || config?.pointValue || 10)} por punto</b> (promedio de tus premios actuales).
                            </p>
                        </div>
                    </div>

                    {/* MAPA DE CALOR */}
                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex justify-between items-center mb-8">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2">
                                    <Clock className="text-purple-600" /> Mapa de Calor: Actividad por D├¡a y Hora
                                </h3>
                                <p className="text-sm text-gray-500">Detecta tus momentos de mayor tr├ífico de ventas.</p>
                            </div>
                            <div className="flex items-center gap-2 text-xs font-bold text-gray-400">
                                <span>Menos</span>
                                <div className="flex gap-1">
                                    <div className="w-3 h-3 rounded bg-purple-600 opacity-20"></div>
                                    <div className="w-3 h-3 rounded bg-purple-600 opacity-50"></div>
                                    <div className="w-3 h-3 rounded bg-purple-600 opacity-80"></div>
                                    <div className="w-3 h-3 rounded bg-purple-600 opacity-100"></div>
                                </div>
                                <span>M├ís ({Math.max(...heatmapData.flat()) || 0} m├íx)</span>
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

                                    {/* Filas D├¡as */}
                                    {['Dom', 'Lun', 'Mar', 'Mi├®', 'Jue', 'Vie', 'S├íb'].map((day, dIdx) => (
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
                                <div className="flex justify-between items-end"><span className="text-sm font-bold text-gray-500 uppercase tracking-wider">Altas v├¡a PWA</span><span className="text-2xl font-black text-purple-600">{registrationSources.pwa}</span></div>
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-orange-50 bg-orange-50/30">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                                    <Sparkles size={18} className="text-orange-500" /> Ranking de Referidores (Desaf├¡o)
                                </h3>
                                <p className="text-xs text-orange-600 font-medium mt-1">
                                    {config?.referrals?.challenge?.enabled ? `Contando amigos del ${new Date(config.referrals.challenge.startDate).toLocaleDateString()} al ${new Date(config.referrals.challenge.endDate).toLocaleDateString()}` : 'Top hist├│rico de invitaciones'}
                                </p>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left text-sm">
                                    <thead className="bg-orange-50/50 text-gray-500 font-semibold"><tr><th className="p-4 pl-6">Socio</th><th className="p-4 text-right pr-6">Invitados</th></tr></thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {topReferrers.length === 0 ? (<tr><td colSpan={2} className="p-8 text-center text-gray-400 italic">No hay invitaciones registradas a├║n</td></tr>) : (
                                            topReferrers.map((user: any, i: number) => (
                                                <tr key={user.id} className="hover:bg-orange-50/30 transition">
                                                    <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3">
                                                        <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-orange-100 text-orange-700 shadow-sm' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span>
                                                        <div className="flex flex-col"><span>{user.name}</span><span className="text-[10px] text-gray-400 font-mono">{user.socioNumber ? `#${user.socioNumber}` : ''}</span></div>
                                                    </td>
                                                    <td className="p-4 text-right pr-6 font-black text-orange-600 text-lg">{user.count}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>

                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-orange-500" /> Clientes m├ís Fieles (APP)</h3>
                                <p className="text-xs text-gray-400 mt-1">Socios con m├ís aperturas de la app</p>
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

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
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
                                                    <div className="flex flex-col"><span>{user.name}</span><span className="text-[10px] text-gray-400 font-mono">{user.socioNumber ? `#${user.socioNumber}` : ''}</span></div>
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
                                <p className="text-xs text-gray-400 mt-1">M├ís puntos generados en este periodo</p>
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
                                                        <div className="flex flex-col"><span>{user.name}</span><span className="text-[10px] text-gray-400 font-mono">{user.socioNumber ? `#${user.socioNumber}` : ''}</span></div>
                                                    </td>
                                                    <td className="p-4 text-right pr-6 font-bold text-green-600">${user.total.toLocaleString('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
