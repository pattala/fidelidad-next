import { useState, useEffect } from 'react';
import { BarChart3, TrendingUp, Users, DollarSign, Award, Sparkles, Download, Clock, Calendar, RefreshCw, ShoppingBag, ArrowUpRight, ArrowDownRight, Eye, Settings, AlertTriangle } from 'lucide-react';
import { collection, query, where, getDocs, orderBy, limit, documentId, getCountFromServer, collectionGroup, Timestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import {
    LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer,
    BarChart, Bar
} from 'recharts';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';

const TrendIndicator = ({ current, prev, isRed = false }: { current: number, prev: number, isRed?: boolean }) => {
    if (!prev || prev === 0) return null;
    const diff = ((current - prev) / prev) * 100;
    const isPositive = diff >= 0;
    const absDiff = Math.abs(Math.round(diff));
    
    const colorClass = isRed 
        ? (isPositive ? 'text-red-600 bg-red-50' : 'text-emerald-600 bg-emerald-50')
        : (isPositive ? 'text-emerald-600 bg-emerald-50' : 'text-red-600 bg-red-50');

    return (
        <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black mt-1 ${colorClass}`}>
            {isPositive ? <ArrowUpRight size={10} /> : <ArrowDownRight size={10} />}
            {absDiff}%
        </div>
    );
};

const safeQuery = async (p: Promise<any>) => {
    try { return await p; }
    catch (e) { 
        console.error("Query error:", e); 
        return { docs: [], data: () => ({ count: 0 }), size: 0 }; 
    }
};

export const MetricsPage = () => {
    const navigate = useNavigate();
    
    // --- ESTADOS ---
    const [timeRange, setTimeRange] = useState<'today' | '30_days' | '6_months' | 'year' | 'total' | 'custom'>('30_days');
    const [customDates, setCustomDates] = useState({
        start: new Date(new Date().setDate(new Date().getDate() - 30)).toISOString().split('T')[0],
        end: new Date().toISOString().split('T')[0]
    });
    const [chartData, setChartData] = useState<any[]>([]);
    const [prevChartData, setPrevChartData] = useState<any[]>([]);
    const [topUsers, setTopUsers] = useState<any[]>([]);
    const [topSpenders, setTopSpenders] = useState<any[]>([]);
    const [topVisitors, setTopVisitors] = useState<any[]>([]);
    const [topReferrers, setTopReferrers] = useState<any[]>([]);
    const [registrationSources, setRegistrationSources] = useState<{ pwa: number, local: number }>({ pwa: 0, local: 0 });
    const [totalStats, setTotalStats] = useState({ emitted: 0, redeemed: 0, expired: 0, moneyRedeemed: 0 });
    const [prevTotalStats, setPrevTotalStats] = useState({ emitted: 0, redeemed: 0, expired: 0, moneyRedeemed: 0 });
    const [activeDateRange, setActiveDateRange] = useState<{ start: Date | null, end: Date | null }>({ start: null, end: null });
    const [heatmapLoading, setHeatmapLoading] = useState(false);
    const [heatmapMode, setHeatmapMode] = useState<'trend' | 'weekly'>('trend');
    const [heatmapMetric, setHeatmapMetric] = useState<'count' | 'revenue'>('count');
    const [heatmapSummary, setHeatmapSummary] = useState({ topDay: 'N/A', topHour: 'N/A', peakMoment: 'N/A', totalHeatmapEvents: 0 });
    const [heatmapDateRange, setHeatmapDateRange] = useState<{ start: Date, end: Date }>(() => {
        const now = new Date();
        const day = now.getDay();
        const diff = now.getDate() - day + (day === 0 ? -6 : 1);
        const start = new Date(now.setDate(diff));
        start.setHours(0,0,0,0);
        const end = new Date(start);
        end.setDate(start.getDate() + 6);
        end.setHours(23,59,59,999);
        return { start, end };
    });
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<any>(null);
    const [movementsData, setMovementsData] = useState<any[]>([]);
    const [forecastData, setForecastData] = useState<any>(null);
    const [forecastDates, setForecastDates] = useState({
        start: new Date(new Date().setDate(new Date().getDate() + 1)).toISOString().split('T')[0],
        end: new Date(new Date().setDate(new Date().getDate() + 30)).toISOString().split('T')[0]
    });
    const [fetchingForecast, setFetchingForecast] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [advancedStats, setAdvancedStats] = useState({
        averageTicket: 0,
        frequency: 0,
        activeCustomers: 0,
        totalCustomers: 0,
        potentialRevenue: 0,
        creditCount: 0,
        referralCount: 0,
        projectedExpirations: 0,
        circulatingPoints: 0,
        newCustomers: 0,
        dormantCustomers: 0
    });
    const [prevAdvancedStats, setPrevAdvancedStats] = useState({
        averageTicket: 0, frequency: 0, activeCustomers: 0, totalCustomers: 0, potentialRevenue: 0, creditCount: 0, referralCount: 0
    });
    const [heatmapData, setHeatmapData] = useState<number[][]>(Array(7).fill(0).map(() => Array(24).fill(0)));
    // dormantDays state removed - now uses config.dormantDays directly

    // --- FUNCIONES (HOISTED) ---
    async function fetchForecast() {
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
    }

    async function fetchHeatmapData() {
        if (heatmapMode === 'trend') return;
        setHeatmapLoading(true);
        try {
            const constraints: any[] = [
                where('date', '>=', Timestamp.fromDate(heatmapDateRange.start)),
                where('date', '<=', Timestamp.fromDate(heatmapDateRange.end))
            ];
            const q = query(collectionGroup(db, 'points_history'), ...constraints);
            const snap = await getDocs(q);
            const newHeatmap = Array(7).fill(0).map(() => Array(24).fill(0));
            snap.docs.forEach(d => {
                const data = d.data();
                const date = data.date?.toDate ? data.date.toDate() : (data.date ? new Date(data.date) : new Date());
                if (data.type === 'credit') {
                    const val = heatmapMetric === 'revenue' ? Number(data.moneySpent || 0) : 1;
                    newHeatmap[date.getDay()][date.getHours()] += val;
                }
            });
            setHeatmapData(newHeatmap);
            let maxVal = 0, maxDayIdx = -1, maxHourIdx = -1;
            let dayTotals = Array(7).fill(0), hourTotals = Array(24).fill(0);
            newHeatmap.forEach((dayRow, dIdx) => {
                dayRow.forEach((val, hIdx) => {
                    dayTotals[dIdx] += val; hourTotals[hIdx] += val;
                    if (val > maxVal) { maxVal = val; maxDayIdx = dIdx; maxHourIdx = hIdx; }
                });
            });
            const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
            const bestDayIdx = dayTotals.indexOf(Math.max(...dayTotals));
            const bestHourIdx = hourTotals.indexOf(Math.max(...hourTotals));
            setHeatmapSummary({
                topDay: bestDayIdx !== -1 && dayTotals[bestDayIdx] > 0 ? daysOfWeek[bestDayIdx] : 'N/A',
                topHour: bestHourIdx !== -1 && hourTotals[bestHourIdx] > 0 ? `${bestHourIdx}:00hs` : 'N/A',
                peakMoment: maxDayIdx !== -1 && maxVal > 0 ? `${daysOfWeek[maxDayIdx]} a las ${maxHourIdx}:00hs (${heatmapMetric === 'revenue' ? '$' : ''}${maxVal.toLocaleString()}${heatmapMetric === 'count' ? ' ventas' : ''})` : 'N/A',
                totalHeatmapEvents: dayTotals.reduce((a, b) => a + b, 0)
            });
        } catch (err) { console.error("Heatmap fetch error", err); }
        finally { setHeatmapLoading(false); }
    }

    function processStats(movements: any[], appConfig: any) {
        const grouped = new Map<string, { emitted: number, redeemed: number, expired: number, money: number, referrals: number }>();
        const spenders = new Map<string, number>();
        let tEmitted = 0, tRedeemed = 0, tExpired = 0, tMoneyRedeemed = 0;
        let totalMoneySpent = 0, creditCount = 0, referralCount = 0;
        const activeUids = new Set<string>();
        const heatmapCount = Array(7).fill(0).map(() => Array(24).fill(0));
        const heatmapRevenue = Array(7).fill(0).map(() => Array(24).fill(0));

        movements.forEach((mov: any) => {
            const key = (timeRange === 'today' || timeRange === '30_days' || timeRange === 'custom')
                ? mov.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                : mov.date.toLocaleDateString('es-AR', { month: 'short', year: '2-digit' });
            const current = grouped.get(key) || { emitted: 0, redeemed: 0, expired: 0, money: 0, referrals: 0 };
            if (mov.type === 'credit') {
                const pts = Number(mov.amount || mov.points || 0);
                current.emitted += pts; tEmitted += pts;
                if (mov.reason === 'referral_bonus') { referralCount++; current.referrals = (current.referrals || 0) + 1; }
                const money = Number(mov.moneySpent || 0);
                if (money > 0) {
                    totalMoneySpent += money;
                    const userId = mov.uid || mov.userId;
                    if (userId) spenders.set(userId, (spenders.get(userId) || 0) + money);
                }
                if (mov.date instanceof Date) {
                    heatmapCount[mov.date.getDay()][mov.date.getHours()]++;
                    if (money > 0) heatmapRevenue[mov.date.getDay()][mov.date.getHours()] += money;
                }
                creditCount++; activeUids.add(mov.uid || mov.userId);
            } else {
                const pts = Math.abs(Number(mov.points || 0));
                const concept = (mov.concept || '').toLowerCase();
                const isEx = mov.isExpirationAdjustment === true || concept.includes('vencimiento') || concept.includes('vencidos') || concept.includes('vencieron');
                if (isEx) { current.expired += pts; tExpired += pts; }
                else {
                    current.redeemed += pts; tRedeemed += pts;
                    const val = mov.redeemedValue || (pts * (appConfig?.pointValue || 10));
                    current.money += val; tMoneyRedeemed += val;
                }
            }
            grouped.set(key, current);
        });
        return { grouped, spenders, tEmitted, tRedeemed, tExpired, tMoneyRedeemed, totalMoneySpent, creditCount, activeUids, heatmapCount, heatmapRevenue, referralCount };
    }

    async function fetchData() {
        setIsUpdating(true);
        if (!chartData.length) setLoading(true);
        try {
            const appConfig = await ConfigService.get();
            setConfig(appConfig);
            const now = TimeService.now();
            let startDate = new Date(now), endDate = new Date(now);
            if (timeRange === '30_days') startDate.setDate(now.getDate() - 30);
            else if (timeRange === '6_months') startDate.setMonth(now.getMonth() - 6);
            else if (timeRange === 'year') startDate.setFullYear(now.getFullYear() - 1);
            if (timeRange === 'today') { startDate.setHours(0,0,0,0); endDate.setHours(23,59,59,999); }
            else if (timeRange === 'custom') { startDate = new Date(customDates.start + 'T00:00:00'); endDate = new Date(customDates.end + 'T23:59:59'); }
            else if (timeRange === 'total') { startDate = new Date(2020, 0, 1); }
            setActiveDateRange({ start: startDate, end: endDate });
            const isTotal = timeRange === 'total', duration = endDate.getTime() - startDate.getTime();
            const prevEndDate = new Date(startDate.getTime() - 1000), prevStartDate = new Date(prevEndDate.getTime() - duration);

            async function fetchRangeData(start: Date, end: Date, isTotalMode = false) {
                try {
                    const constraints: any[] = [];
                    if (!isTotalMode) constraints.push(where('date', '>=', Timestamp.fromDate(start)), where('date', '<=', Timestamp.fromDate(end)));
                    const q = query(collectionGroup(db, 'points_history'), ...constraints);
                    const snap = await getDocs(q);
                    return snap.docs.map(d => {
                        const data = d.data(), date = data.date?.toDate ? data.date.toDate() : (data.date ? new Date(data.date) : new Date());
                        return { ...data, id: d.id, uid: d.ref.parent.parent?.id, date, points: Math.abs(data.amount || 0), moneySpent: data.moneySpent || 0 };
                    });
                } catch (err) { console.error("Error in fetchRangeData:", err); return []; }
            }

            const [currentMovements, prevMovements] = await Promise.all([
                fetchRangeData(startDate, endDate, isTotal),
                isTotal ? Promise.resolve([]) : fetchRangeData(prevStartDate, prevEndDate)
            ]);
            setMovementsData(currentMovements);
            const realPV = (appConfig?.pointValue || 10);
            const currentResults = processStats(currentMovements, appConfig);
            const prevResults = processStats(prevMovements, appConfig);
            const currentNetEmitted = currentResults.tEmitted - currentResults.tExpired;
            const prevNetEmitted = prevResults.tEmitted - prevResults.tExpired;

            const allUsersSnap = await getDocs(query(collection(db, 'users'), where('role', '!=', 'admin')));
            let dormantCount = 0;
            let totalSystemPoints = 0, totalVirtualExpired = 0, totalProjectedNext30 = 0;
            const startOfToday = TimeService.startOfToday(), next30Days = new Date(startOfToday);
            next30Days.setDate(next30Days.getDate() + 30);
            const next30Str = next30Days.toISOString().split('T')[0];
            const effectiveDormantDays = config?.dormantDays || 30;
            const dormantThresholdDate = new Date(now);
            dormantThresholdDate.setDate(dormantThresholdDate.getDate() - effectiveDormantDays);
            const dormantThresholdStr = dormantThresholdDate.toISOString().split('T')[0];

            allUsersSnap.forEach(uDoc => {
                const u = uDoc.data(); if (u.role === 'admin') return;
                const uPoints = Number(u.points || 0); totalSystemPoints += uPoints;
                
                // Cálculo de clientes dormidos (V.1.1.8 - con fallback de registro)
                const lastPurchase = u.lastPurchaseDate?.toDate ? u.lastPurchaseDate.toDate() : (u.lastPurchaseDate ? new Date(u.lastPurchaseDate) : null);
                const registration = u.createdAt?.toDate ? u.createdAt.toDate() : (u.createdAt ? new Date(u.createdAt) : null);
                const lastActivity = lastPurchase || registration;
                
                if (!lastActivity || lastActivity < dormantThresholdDate) {
                    dormantCount++;
                }

                if (u.nextExpirationDate) {
                    const nextExDate = u.nextExpirationDate.toString();
                    if (nextExDate < startOfToday.toISOString().split('T')[0]) totalVirtualExpired += Math.min(uPoints, Number(u.nextExpirationAmount || 0));
                    else if (nextExDate <= next30Str) totalProjectedNext30 += Number(u.nextExpirationAmount || 0);
                }
            });

            const realCirculation = Math.max(0, totalSystemPoints - totalVirtualExpired);
            setTotalStats({ emitted: currentNetEmitted, redeemed: currentResults.tRedeemed, expired: currentResults.tExpired + (isTotal ? totalVirtualExpired : 0), moneyRedeemed: currentResults.tMoneyRedeemed });
            setPrevTotalStats({ emitted: prevNetEmitted, redeemed: prevResults.tRedeemed, expired: prevResults.tExpired, moneyRedeemed: prevResults.tMoneyRedeemed });
            setChartData(Array.from(currentResults.grouped.entries()).map(([name, data]) => ({ name, ...data })));
            setPrevChartData(Array.from(prevResults.grouped.entries()).map(([name, data]) => ({ name, ...data })));

            let pwaCountFinal = 0, localCountFinal = 0;
            if (isTotal) {
                const [pwaSnap, localSnap] = await Promise.all([safeQuery(getCountFromServer(query(collection(db, 'users'), where('source', '==', 'pwa')))), safeQuery(getCountFromServer(query(collection(db, 'users'), where('source', '==', 'local'))))]);
                pwaCountFinal = pwaSnap?.data ? pwaSnap.data().count : 0; localCountFinal = localSnap?.data ? localSnap.data().count : 0;
            } else {
                const rangeUsersSnap = await safeQuery(getDocs(query(collection(db, 'users'), where('createdAt', '>=', Timestamp.fromDate(startDate)), where('createdAt', '<=', Timestamp.fromDate(endDate)))));
                if (rangeUsersSnap?.docs) rangeUsersSnap.docs.forEach((d: any) => { const u = d.data(); if (u.source === 'pwa') pwaCountFinal++; else if (u.source === 'local') localCountFinal++; });
            }

            setAdvancedStats({
                averageTicket: currentResults.creditCount > 0 ? currentResults.totalMoneySpent / currentResults.creditCount : 0,
                frequency: currentResults.activeUids.size > 0 ? currentResults.creditCount / currentResults.activeUids.size : 0,
                activeCustomers: currentResults.activeUids.size, totalCustomers: currentResults.activeUids.size, potentialRevenue: realCirculation * realPV,
                creditCount: currentResults.creditCount, referralCount: currentResults.referralCount, projectedExpirations: totalProjectedNext30, circulatingPoints: realCirculation,
                newCustomers: pwaCountFinal + localCountFinal, dormantCustomers: dormantCount
            });
            setPrevAdvancedStats({ averageTicket: prevResults.creditCount > 0 ? prevResults.totalMoneySpent / prevResults.creditCount : 0, frequency: prevResults.activeUids.size > 0 ? prevResults.creditCount / prevResults.activeUids.size : 0, activeCustomers: prevResults.activeUids.size, totalCustomers: prevResults.activeUids.size, potentialRevenue: 0, creditCount: prevResults.creditCount, referralCount: prevResults.referralCount });

            if (heatmapMode === 'trend') {
                const targetHeatmap = heatmapMetric === 'count' ? currentResults.heatmapCount : currentResults.heatmapRevenue;
                setHeatmapData(targetHeatmap);
                let maxVal = 0, maxDayIdx = -1, maxHourIdx = -1;
                let dayTotals = Array(7).fill(0), hourTotals = Array(24).fill(0);
                targetHeatmap.forEach((dayRow: number[], dIdx: number) => { dayRow.forEach((val: number, hIdx: number) => { dayTotals[dIdx] += val; hourTotals[hIdx] += val; if (val > maxVal) { maxVal = val; maxDayIdx = dIdx; maxHourIdx = hIdx; } }); });
                const daysOfWeek = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
                const bestDayIdx = dayTotals.indexOf(Math.max(...dayTotals)), bestHourIdx = hourTotals.indexOf(Math.max(...hourTotals));
                setHeatmapSummary({ topDay: bestDayIdx !== -1 && dayTotals[bestDayIdx] > 0 ? daysOfWeek[bestDayIdx] : 'N/A', topHour: bestHourIdx !== -1 && hourTotals[bestHourIdx] > 0 ? `${bestHourIdx}:00hs` : 'N/A', peakMoment: maxDayIdx !== -1 && maxVal > 0 ? `${daysOfWeek[maxDayIdx]} a las ${maxHourIdx}:00hs (${heatmapMetric === 'revenue' ? '$' : ''}${maxVal.toLocaleString()}${heatmapMetric === 'count' ? ' ventas' : ''})` : 'N/A', totalHeatmapEvents: dayTotals.reduce((a, b) => a + b, 0) });
            }

            const [snapTopBalance, snapVisitors, snapTopHistoryOrReferrals] = await Promise.all([
                safeQuery(getDocs(query(collection(db, 'users'), orderBy('points', 'desc'), limit(15)))),
                safeQuery(getDocs(query(collection(db, 'users'), orderBy('visitCount', 'desc'), limit(15)))),
                appConfig?.referrals?.challenge?.enabled ? safeQuery(getDocs(query(collection(db, 'users'), where('createdAt', '>=', Timestamp.fromDate(new Date(appConfig.referrals.challenge.startDate))), where('createdAt', '<=', Timestamp.fromDate(new Date(new Date(appConfig.referrals.challenge.endDate).setHours(23, 59, 59, 999))))))) : safeQuery(getDocs(query(collection(db, 'users'), orderBy('referralStats.count', 'desc'), limit(5))))
            ]);

            setRegistrationSources({ pwa: pwaCountFinal, local: localCountFinal });

            const filteredTopBalance = snapTopBalance.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(u => u.name || u.nombre || u.dni)?.slice(0, 5);
            setTopUsers(filteredTopBalance.map(user => ({ id: user.id, ...user, name: user.name || user.nombre || 'Socio sin nombre', points: user.points || 0, socioNumber: user.socioNumber || user.numeroSocio || '' })));
            const filteredVisitors = snapVisitors.docs.map(d => ({ id: d.id, ...d.data() } as any)).filter(u => u.name || u.nombre || u.dni)?.slice(0, 5);
            setTopVisitors(filteredVisitors.map(user => ({ id: user.id, ...user, name: user.name || user.nombre || 'Socio', count: user.visitCount || 0, socioNumber: user.socioNumber || user.numeroSocio || '' })));

            const challenge = appConfig?.referrals?.challenge;
            if (challenge?.enabled) {
                const refCounts = new Map<string, number>(); snapTopHistoryOrReferrals.docs.forEach(d => { const data = d.data(); const refUid = data.referrerUid; if (refUid) refCounts.set(refUid, (refCounts.get(refUid) || 0) + 1); });
                const sortedRefs = Array.from(refCounts.entries()).sort((a, b) => b[1] - a[1])?.slice(0, 5);
                if (sortedRefs.length > 0) {
                    const uids = sortedRefs.map(s => s[0]); const usersSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', uids)));
                    const usersMap = new Map(); usersSnap.forEach(d => usersMap.set(d.id, d.data()));
                    setTopReferrers(sortedRefs.map(([uid, count]) => { const uData = usersMap.get(uid); return { id: uid, name: uData?.name || uData?.nombre || 'Socio', count, socioNumber: uData?.socioNumber || uData?.numeroSocio || '' }; }));
                } else setTopReferrers([]);
            } else setTopReferrers(snapTopHistoryOrReferrals.docs.map(d => { const data = d.data(); return { id: d.id, name: data.name || data.nombre || 'Socio', count: data.referralStats?.count || 0, socioNumber: data.socioNumber || data.numeroSocio || '' }; }));

            const sortedSpenders = Array.from(currentResults.spenders.entries()).sort((a, b) => b[1] - a[1])?.slice(0, 5);
            if (sortedSpenders.length > 0) {
                const uids = sortedSpenders.map(s => s[0]); const usersSnap = await getDocs(query(collection(db, 'users'), where(documentId(), 'in', uids)));
                const usersMap = new Map(); usersSnap.forEach(d => usersMap.set(d.id, d.data()));
                setTopSpenders(sortedSpenders.map(([uid, total]) => { const uData = usersMap.get(uid); return uData ? { id: uid, name: uData.name || uData.nombre || 'Socio', total, socioNumber: uData.socioNumber || uData.numeroSocio || '', dni: uData.dni || '' } : { id: uid, name: 'Socio Desconocido', total, socioNumber: '', dni: '' }; }));
            } else setTopSpenders([]);

            if (currentMovements.length > 0) fetchForecast();
        } catch (error) { console.error("Error metrics:", error); toast.error("Error al cargar las métricas"); }
        finally { setLoading(false); setIsUpdating(false); }
    }

    // --- EFFECTS ---
    useEffect(() => {
        const cached = localStorage.getItem('metrics_cache_v2');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (parsed.totalStats) setTotalStats(prev => ({ ...prev, ...parsed.totalStats }));
                if (parsed.advancedStats) setAdvancedStats(prev => ({ ...prev, ...parsed.advancedStats }));
                setChartData(parsed.chartData || []); setTopUsers(parsed.topUsers || []);
                setTopSpenders(parsed.topSpenders || []); setTopVisitors(parsed.topVisitors || []);
                setTopReferrers(parsed.topReferrers || []); setRegistrationSources(parsed.registrationSources || { pwa: 0, local: 0 });
            } catch (e) { console.error("Cache error", e); }
        }
    }, []);

    useEffect(() => { fetchHeatmapData(); }, [heatmapDateRange, heatmapMode, heatmapMetric]);
    useEffect(() => { fetchData(); }, [timeRange, customDates, heatmapMetric, heatmapMode]);

    // Escuchar cambios en el simulador de tiempo
    useEffect(() => {
        const handleTimeChange = () => fetchData();
        window.addEventListener('time-simulation-change', handleTimeChange);
        return () => window.removeEventListener('time-simulation-change', handleTimeChange);
    }, []);

    async function handleCSVExport() {
        if (movementsData.length === 0) { toast.error("No hay datos para exportar en este periodo."); return; }
        const headers = ["Fecha", "Cliente", "Socio #", "Tipo", "Concepto", "Puntos", "Monto $"];
        const numFormat = new Intl.NumberFormat('es-AR', { minimumFractionDigits: 0, maximumFractionDigits: 2 });
        const rows = movementsData.map(m => [m.date.toLocaleString('es-AR'), m.clientName || 'N/A', m.socioNumber || 'N/A', m.type === 'credit' ? 'Suma' : 'Canje/Baja', m.concept || '', m.points || 0, numFormat.format(m.amount || 0)]);
        const csvContent = [headers, ...rows].map(e => e.join(";")).join("\n");
        const BOM = "\ufeff"; const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement("a"); const url = URL.createObjectURL(blob);
        link.setAttribute("href", url); link.setAttribute("download", `metricas_${timeRange}_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden'; document.body.appendChild(link); link.click(); document.body.removeChild(link);
        toast.success("CSV exportado correctamente");
    }

    const showSkeleton = loading && !chartData.length;

    return (
        <div className="space-y-8 animate-fade-in text-gray-800 pb-12">
            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <BarChart3 className="text-purple-600" /> Métricas y Reportes
                    </h1>
                    <p className="text-gray-500 mt-1">Analiza el rendimiento de tu programa de fidelidad.</p>
                </div>

                {isUpdating && (
                    <div className="flex items-center gap-3 bg-gradient-to-r from-orange-600 to-orange-400 text-white px-8 py-4 rounded-3xl shadow-2xl shadow-orange-300/50 animate-pulse transition-all border-2 border-white/20">
                        <div className="relative flex h-3 w-3">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-3 w-3 bg-white"></span>
                        </div>
                        <span className="font-extrabold text-sm tracking-[0.2em] uppercase">Sincronizando...</span>
                    </div>
                )}
                <div className="flex flex-wrap items-center gap-4">
                    <button onClick={handleCSVExport} className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-700 rounded-xl border border-emerald-100 font-bold hover:bg-emerald-100 transition shadow-sm">
                        <Download size={18} /> Exportar
                    </button>
                    <div className="flex bg-white rounded-xl shadow-sm border border-gray-200 p-1">
                        {[
                            { id: 'today', label: 'Hoy' },
                            { id: '30_days', label: '30 Días' },
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
                </div>
            </div>

            {showSkeleton ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6">
                    {[1, 2, 3, 4, 5].map(i => <div key={i} className="bg-gray-100 h-32 rounded-2xl animate-pulse" />)}
                </div>
            ) : (
                <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Emitidos</p>
                                <p className="text-2xl font-black text-blue-600">{(totalStats?.emitted || 0).toLocaleString()}</p>
                                <TrendIndicator current={totalStats?.emitted || 0} prev={prevTotalStats?.emitted || 0} />
                            </div>
                            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl"><TrendingUp size={24} /></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-orange-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Canjeados</p>
                                <p className="text-2xl font-black text-orange-600">{(totalStats?.redeemed || 0).toLocaleString()}</p>
                                <TrendIndicator current={totalStats?.redeemed || 0} prev={prevTotalStats?.redeemed || 0} />
                            </div>
                            <div className="p-3 bg-orange-50 text-orange-600 rounded-xl"><Award size={24} /></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-emerald-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Dinero en Premios</p>
                                <p className="text-2xl font-black text-emerald-600">${Math.round(totalStats?.moneyRedeemed || 0).toLocaleString('es-AR')}</p>
                                <TrendIndicator current={totalStats?.moneyRedeemed || 0} prev={prevTotalStats?.moneyRedeemed || 0} />
                            </div>
                            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-xl"><DollarSign size={24} /></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-red-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Vencidos</p>
                                <p className="text-2xl font-black text-red-600">{(totalStats?.expired || 0).toLocaleString()}</p>
                                <TrendIndicator current={totalStats?.expired || 0} prev={prevTotalStats?.expired || 0} isRed />
                            </div>
                            <div className="p-3 bg-red-50 text-red-600 rounded-xl"><TrendingUp size={24} className="rotate-180" /></div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-indigo-100 flex items-center justify-between">
                            <div>
                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Puntos Circulando</p>
                                <p className="text-2xl font-black text-indigo-600">{(advancedStats?.circulatingPoints || 0).toLocaleString()}</p>
                                <p className="text-[10px] text-gray-400 mt-1 italic">Pasivo real descontando expirados</p>
                            </div>
                            <div className="p-3 bg-indigo-50 text-indigo-600 rounded-xl"><Sparkles size={24} /></div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
                        {[
                            { label: 'Transacciones', value: advancedStats.creditCount, prev: prevAdvancedStats.creditCount, icon: ShoppingBag, color: 'blue' },
                            { label: 'Ticket Promedio', value: `$${Math.round(advancedStats?.averageTicket || 0).toLocaleString('es-AR')}`, prev: prevAdvancedStats?.averageTicket || 0, icon: DollarSign, color: 'emerald' },
                            { label: 'Clientes Activos', value: advancedStats.activeCustomers, prev: prevAdvancedStats.activeCustomers, icon: Users, color: 'purple' },
                            { label: 'Recaudación Est.', value: `$${Math.round((advancedStats?.averageTicket || 0) * (advancedStats?.creditCount || 0)).toLocaleString('es-AR')}`, prev: (prevAdvancedStats?.averageTicket || 0) * (prevAdvancedStats?.creditCount || 0), icon: TrendingUp, color: 'orange' }
                        ].map((stat, i) => {
                            const currentVal = typeof stat.value === 'number' ? stat.value : parseFloat(String(stat.value).replace('$', '').replace(/\./g, ''));
                            const prevVal = stat.prev || 0;
                            const diff = prevVal > 0 ? ((currentVal - prevVal) / prevVal) * 100 : 0;
                            return (
                                <div key={i} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm transition hover:shadow-md">
                                    <div className="flex items-center gap-3 mb-3">
                                        <div className={`p-2 bg-${stat.color}-50 text-${stat.color}-600 rounded-lg`}><stat.icon size={20} /></div>
                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</span>
                                    </div>
                                    <div className="flex items-end justify-between">
                                        <div className="text-2xl font-black text-gray-800">{stat.value}</div>
                                        {prevVal > 0 && (
                                            <div className={`text-[10px] font-black px-2 py-1 rounded-lg flex items-center gap-1 ${diff >= 0 ? 'bg-emerald-50 text-emerald-600' : 'bg-red-50 text-red-600'}`}>
                                                {diff >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
                                                {Math.abs(Math.round(diff))}%
                                            </div>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100">
                        <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 mb-8">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2"><Clock className="text-purple-600" /> Mapa de Calor de Actividad</h3>
                                <p className="text-sm text-gray-500">Analiza tus momentos de mayor flujo según el tipo de métrica.</p>
                            </div>
                            <div className="flex flex-wrap items-center gap-4">
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button onClick={() => setHeatmapMetric('count')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${heatmapMetric === 'count' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Tráfico</button>
                                    <button onClick={() => setHeatmapMetric('revenue')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${heatmapMetric === 'revenue' ? 'bg-white text-gray-800 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Recaudación</button>
                                </div>
                                <div className="flex bg-gray-100 p-1 rounded-xl">
                                    <button onClick={() => setHeatmapMode('trend')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${heatmapMode === 'trend' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Tendencia</button>
                                    <button onClick={() => setHeatmapMode('weekly')} className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${heatmapMode === 'weekly' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'}`}>Por Semanas</button>
                                </div>
                            </div>
                        </div>
                        
                        {heatmapSummary.totalHeatmapEvents > 0 && (
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                                <div className="bg-purple-50/40 border border-purple-100 p-4 rounded-2xl"><p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Día Más Fuerte</p><p className="text-lg font-black text-purple-900">{heatmapSummary.topDay}</p></div>
                                <div className="bg-purple-50/40 border border-purple-100 p-4 rounded-2xl"><p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Hora Pico</p><p className="text-lg font-black text-purple-900">{heatmapSummary.topHour}</p></div>
                                <div className="bg-purple-50/40 border border-purple-100 p-4 rounded-2xl"><p className="text-[10px] font-bold text-purple-400 uppercase tracking-wider mb-1">Pico Máximo</p><p className="text-sm font-black text-purple-900">{heatmapSummary.peakMoment}</p></div>
                            </div>
                        )}

                        <div className="overflow-x-auto">
                            <div className="min-w-[800px]">
                                <div className="grid grid-cols-[100px_repeat(24,1fr)] gap-1">
                                    <div className="h-8"></div>
                                    {Array.from({ length: 24 }).map((_, h) => (<div key={h} className="text-[10px] font-bold text-gray-400 text-center">{h}h</div>))}
                                    {['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'].map((day, dIdx) => (
                                        <>
                                            <div key={day} className="flex items-center text-sm font-bold text-gray-500 h-8">{day}</div>
                                            {heatmapData[dIdx].map((val, hIdx) => {
                                                const max = Math.max(...heatmapData.flat()) || 1;
                                                const opacity = val === 0 ? 0.05 : (val / max);
                                                return (<div key={`${dIdx}-${hIdx}`} className="h-8 rounded-sm transition-all hover:ring-2 ring-purple-400 cursor-help" style={{ backgroundColor: `rgba(147, 51, 234, ${opacity})`, border: val > 0 ? '1px solid rgba(147, 51, 234, 0.1)' : '1px solid transparent' }} title={`${day} ${hIdx}hs: ${val}`} />);
                                            })}
                                        </>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
                            <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2"><TrendingUp size={20} className="text-blue-500" /> Puntos Emitidos vs Canjeados</h3>
                            <div style={{ width: '100%', height: 350 }}>
                                <ResponsiveContainer width="100%" height="100%">
                                    <LineChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                        <CartesianGrid strokeDasharray="3 3" opacity={0.3} />
                                        <XAxis dataKey="name" fontSize={12} />
                                        <YAxis fontSize={12} />
                                        <Tooltip contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
                                        <Legend />
                                        <Line type="monotone" dataKey="emitted" name="Emitidos" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="redeemed" name="Canjeados" stroke="#f97316" strokeWidth={3} dot={{ r: 4 }} />
                                        <Line type="monotone" dataKey="expired" name="Vencidos" stroke="#ef4444" strokeWidth={3} dot={{ r: 4 }} />
                                    </LineChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 min-w-0">
                            <h3 className="text-lg font-bold text-gray-700 mb-6 flex items-center gap-2"><DollarSign size={20} className="text-green-500" /> Dinero Devuelto (Estimado)</h3>
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

                    <div className="bg-white p-8 rounded-3xl shadow-sm border border-gray-100 mb-8">
                        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-8">
                            <div>
                                <h3 className="text-xl font-black text-gray-800 flex items-center gap-2"><Sparkles className="text-amber-500" /> Índice de Salud de la Base</h3>
                                <p className="text-sm text-gray-500">Inscripciones contra clientes dormidos.</p>
                            </div>
                            <div className="flex gap-2">
                                {advancedStats.newCustomers > advancedStats.dormantCustomers ? (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-emerald-100 text-emerald-700 rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm border-b-2 border-emerald-200"><TrendingUp size={16} /> Crecimiento Sano</div>
                                ) : (
                                    <div className="flex items-center gap-2 px-4 py-2 bg-orange-100 text-orange-700 rounded-2xl font-black text-xs uppercase tracking-wider shadow-sm border-b-2 border-orange-200"><Clock size={16} /> Atención Requerida</div>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                            <div className="bg-emerald-50/50 p-6 rounded-3xl border border-emerald-100 flex items-center gap-6">
                                <div className="p-4 bg-emerald-100 text-emerald-600 rounded-2xl"><Users size={32} /></div>
                                <div><p className="text-xs font-black text-emerald-600 uppercase tracking-widest">Nuevas Inscripciones</p><p className="text-4xl font-black text-emerald-700">+{advancedStats.newCustomers}</p></div>
                            </div>
                            <div className="bg-orange-50/50 p-6 rounded-3xl border border-orange-100 flex items-center gap-6">
                                <div className="p-4 bg-orange-100 text-orange-600 rounded-2xl"><Clock size={32} /></div>
                                <div className="flex-1">
                                    <div className="flex items-center justify-between gap-4">
                                        <div>
                                            <p className="text-xs font-black text-orange-600 uppercase tracking-widest">Clientes Dormidos</p>
                                            <p className="text-4xl font-black text-orange-700">{advancedStats.dormantCustomers}</p>
                                        </div>
                                        <button 
                                            onClick={() => navigate('/admin/clients?filter=dormant')} 
                                            className="p-3 bg-orange-100 text-orange-700 rounded-2xl hover:bg-orange-200 transition-all shadow-sm border border-orange-200"
                                        >
                                            <Eye size={16} />
                                        </button>
                                    </div>
                                    <div className="mt-4 p-3 bg-orange-100/50 rounded-2xl border border-orange-200/50">
                                        <div className="flex items-center justify-between mb-1">
                                            <div className="flex items-center gap-2">
                                                <AlertTriangle size={14} className="text-orange-600" />
                                                <p className="text-[11px] font-bold text-orange-800 uppercase tracking-tight">Umbral de Inactividad</p>
                                            </div>
                                            <button 
                                                onClick={() => navigate('/admin/config')}
                                                className="flex items-center gap-1 px-2 py-1 bg-orange-200 text-orange-700 rounded-lg text-[9px] font-black hover:bg-orange-300 transition-all uppercase"
                                            >
                                                <Settings size={10} /> Configurar
                                            </button>
                                        </div>
                                        <p className="text-[10px] text-orange-600 leading-tight">
                                            Este número muestra clientes que no compran hace <strong>{config?.dormantDays || 30} días</strong>. Puedes cambiar este umbral en la pestaña "Reglas del Juego".
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-white rounded-2xl shadow-sm border border-orange-100 overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-orange-50 bg-orange-50/30">
                                <h3 className="font-bold text-gray-800 flex items-center gap-2"><Sparkles size={18} className="text-orange-500" /> Ranking de Referidores</h3>
                                <p className="text-xs text-orange-600 font-medium mt-1">{config?.referrals?.challenge?.enabled ? `Del ${new Date(config.referrals.challenge.startDate).toLocaleDateString()} al ${new Date(config.referrals.challenge.endDate).toLocaleDateString()}` : 'Top histórico'}</p>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-orange-50/50 text-gray-500 font-semibold"><tr><th className="p-4 pl-6">Socio</th><th className="p-4 text-right pr-6">Invitados</th></tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {topReferrers.length === 0 ? (<tr><td colSpan={2} className="p-8 text-center text-gray-400 italic">No hay invitaciones registradas</td></tr>) : (
                                        topReferrers.map((user: any, i: number) => (
                                            <tr key={user.id} className="hover:bg-orange-50/30 transition">
                                                <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-orange-100 text-orange-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span><div className="flex flex-col"><span>{user.name}</span><span className="text-[10px] text-gray-400">{user.socioNumber ? `#${user.socioNumber}` : ''}</span></div></td>
                                                <td className="p-4 text-right pr-6 font-black text-orange-600 text-lg">{user.count}</td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        </div>
                        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden flex flex-col h-full">
                            <div className="p-6 border-b border-gray-100 bg-gray-50/50"><h3 className="font-bold text-gray-800 flex items-center gap-2"><Users size={18} className="text-purple-500" /> Clientes con Mayor Saldo</h3></div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 text-gray-500 font-semibold"><tr><th className="p-4 pl-6">Cliente</th><th className="p-4 text-right pr-6">Saldo Puntos</th></tr></thead>
                                <tbody className="divide-y divide-gray-50">
                                    {topUsers.map((user: any, i: number) => (
                                        <tr key={user.id} className="hover:bg-purple-50/30 transition">
                                            <td className="p-4 pl-6 font-medium text-gray-700 flex items-center gap-3"><span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${i < 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>{i + 1}</span><div className="flex flex-col"><span>{user.name}</span><span className="text-[10px] text-gray-400">{user.socioNumber ? `#${user.socioNumber}` : ''}</span></div></td>
                                            <td className="p-4 text-right pr-6 font-bold text-purple-600">{user.points?.toLocaleString() || 0}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
};
