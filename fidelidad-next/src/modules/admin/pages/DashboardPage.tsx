import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, collectionGroup, orderBy, limit, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ConfigService } from '../../../services/configService';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Gift, User, Clock, RefreshCw, Cake } from 'lucide-react';

export const DashboardPage = () => {
    const [stats, setStats] = useState({
        usersCount: 0,
        totalPoints: 0,
        redeemedPoints: 0,
        redeemedMoney: 0,
        totalMoneyGenerated: 0,
        circulatingValue: 0,
        budgetLimit: 0,
        isBudgetMode: false,
        realLiability: 0,
        calculationMethod: 'manual',
        pointValueConfigured: 0,
        pointValueReal: 0
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activityLimit, setActivityLimit] = useState(10);
    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);

    const fetchStats = async (isManual = false) => {
        if (isManual) setRefreshing(true);
        else setLoading(true);

        try {
            // 1. KPI Stats
            const qUsers = query(collection(db, 'users'));
            const snapUsers = await getDocs(qUsers);

            let points = 0;
            let clientCount = 0;
            const today = new Date();
            const todayMonthDay = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const todaysSelectedBirthdays: any[] = [];

            snapUsers.forEach(doc => {
                const d = doc.data();
                if (d.role !== 'admin') {
                    clientCount++;
                    points += ((d.points || d.puntos) || 0);

                    if (d.birthDate) {
                        const bDate = d.birthDate; // YYYY-MM-DD
                        if (bDate.endsWith(todayMonthDay)) {
                            todaysSelectedBirthdays.push({ id: doc.id, ...d });
                        }
                    }
                }
            });
            setBirthdaysOfToday(todaysSelectedBirthdays);

            const qRedeems = query(collectionGroup(db, 'points_history'), where('type', '==', 'debit'));
            const snapRedeems = await getDocs(qRedeems);

            let redeemedPoints = 0;
            let redeemedMoney = 0;
            snapRedeems.forEach(doc => {
                const data = doc.data();
                redeemedPoints += Math.abs(data.amount || 0);
                redeemedMoney += (data.redeemedValue || 0);
            });

            const qGenerated = query(collectionGroup(db, 'points_history'), where('type', '==', 'credit'));
            const snapGenerated = await getDocs(qGenerated);
            let totalMoneyGenerated = 0;
            snapGenerated.forEach(doc => {
                const data = doc.data();
                totalMoneyGenerated += (data.moneySpent || 0);
            });

            const config = await ConfigService.get();
            let finalPointValue = config.pointValue || 10;
            let averagePrizeValue = 0;
            {
                const qPrizes = query(collection(db, 'prizes'), where('active', '==', true));
                const snapPrizes = await getDocs(qPrizes);
                let totalRatio = 0;
                let validPrizesCount = 0;
                snapPrizes.forEach(doc => {
                    const p = doc.data();
                    if (p.cashValue && p.pointsRequired > 0) {
                        totalRatio += (p.cashValue / p.pointsRequired);
                        validPrizesCount++;
                    }
                });
                if (validPrizesCount > 0) averagePrizeValue = totalRatio / validPrizesCount;
            }

            const method = config.pointCalculationMethod || (config.useAutomaticPointValue ? 'average' : 'manual');
            if (method === 'manual') finalPointValue = config.pointValue || 10;
            else finalPointValue = averagePrizeValue;

            const totalBudget = config.pointValueBudget || 0;
            const remainingBudget = Math.max(0, totalBudget - redeemedMoney);

            setStats({
                usersCount: clientCount,
                totalPoints: points,
                redeemedPoints,
                redeemedMoney,
                totalMoneyGenerated,
                circulatingValue: points * finalPointValue,
                budgetLimit: remainingBudget,
                isBudgetMode: method === 'budget',
                realLiability: points * averagePrizeValue,
                calculationMethod: method,
                pointValueConfigured: finalPointValue,
                pointValueReal: averagePrizeValue
            });
        } catch (error) {
            console.error("Error fetching dashboard stats:", error);
        } finally {
            setLoading(false);
            setRefreshing(false);
        }
    };

    useEffect(() => {
        fetchStats();

        // 2. Real-time Activity Feed (onSnapshot)
        const qActivity = query(
            collectionGroup(db, 'points_history'),
            orderBy('date', 'desc'),
            limit(activityLimit)
        );

        const userCache = new Map();
        const getUserName = async (uid: string) => {
            if (userCache.has(uid)) return userCache.get(uid);
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const d = userDoc.exists() ? userDoc.data() : null;
                const name = d ? (d.name || d.nombre || 'Usuario Desconocido') : 'Usuario Desconocido';
                userCache.set(uid, name);
                return name;
            } catch (e) {
                return 'Usuario';
            }
        };

        const unsubscribe = onSnapshot(qActivity, async (snapshot) => {
            const activities = await Promise.all(snapshot.docs.map(async (d) => {
                const data = d.data();
                const userId = d.ref.parent.parent?.id;
                const userName = userId ? await getUserName(userId) : 'Sistema';
                return {
                    id: d.id,
                    ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(),
                    userName
                };
            }));
            setRecentActivity(activities);
        }, (error) => {
            console.error("Activity stream error:", error);
        });

        return () => unsubscribe();
    }, [activityLimit]);

    return (
        <div className="animate-fade-in pb-10">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Tablero Principal</h1>
                <button
                    onClick={() => fetchStats(true)}
                    disabled={refreshing || loading}
                    className={`flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-bold text-gray-600 hover:bg-gray-50 transition shadow-sm ${refreshing ? 'opacity-50' : ''}`}
                >
                    <RefreshCw size={16} className={refreshing ? 'animate-spin' : ''} />
                    {refreshing ? 'ACTUALIZANDO...' : 'REFRESCAR'}
                </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-6 mb-8">
                {/* KPI Cards */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Usuarios Activos</h3>
                        <p className="text-3xl font-bold text-gray-900">
                            {loading ? '...' : stats.usersCount}
                        </p>
                    </div>
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600">
                        <User size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Puntos en Circulación</h3>
                        <p className="text-3xl font-bold text-indigo-600">
                            {loading ? '...' : stats.totalPoints.toLocaleString()}
                        </p>
                    </div>
                    <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600">
                        <TrendingUp size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Total Canjeado</h3>
                        <div className="flex flex-col">
                            <p className="text-3xl font-bold text-orange-500">
                                {loading ? '...' : stats.redeemedPoints.toLocaleString()}
                            </p>
                            <span className="text-xs font-semibold text-green-600 bg-green-50 px-2 py-0.5 rounded-full mt-1 w-fit">
                                ≈ ${stats.redeemedMoney.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="bg-orange-50 p-3 rounded-xl text-orange-600">
                        <Gift size={24} />
                    </div>
                </div>

                {/* KPI 4: Valor del Circulante (Liability) */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div>
                        <p className="text-gray-500 text-sm font-medium mb-1">Valor del Circulante</p>
                        <h3 className="text-3xl font-bold text-gray-800">
                            {loading ? '...' : `$${stats.circulatingValue.toLocaleString()}`}
                        </h3>
                        {stats.isBudgetMode && (
                            <div className={`text-xs font-bold mt-2 flex flex-col ${stats.circulatingValue > stats.budgetLimit ? 'text-red-500' : 'text-green-500'}`}>
                                <span>{stats.circulatingValue > stats.budgetLimit ? '⚠ Sobre Presupuesto' : '✓ En Presupuesto'}</span>
                                <span className="text-gray-400 font-normal">
                                    {stats.circulatingValue > stats.budgetLimit ? '+' : ''}
                                    ${(stats.circulatingValue - stats.budgetLimit).toLocaleString()} vs ${stats.budgetLimit.toLocaleString()}
                                </span>
                            </div>
                        )}
                        {!stats.isBudgetMode && stats.calculationMethod === 'manual' && (
                            <div className="mt-2 text-xs border-t border-gray-50 pt-2">
                                <div className="flex justify-between items-center mb-1.5 opacity-80">
                                    <span title="Valor fijo configurado">Config: <span className="font-semibold">${stats.pointValueConfigured.toFixed(2)}</span>/pt</span>
                                    <span title="Promedio real según premios">Real: <span className="font-semibold">${stats.pointValueReal.toFixed(2)}</span>/pt</span>
                                </div>
                                <span className="text-gray-400 block mb-0.5 text-[10px] uppercase tracking-wide">Deuda Real (Premios)</span>
                                <div className="font-bold text-gray-700 text-sm mb-1">${stats.realLiability.toLocaleString()}</div>
                                {(() => {
                                    const diff = stats.circulatingValue - stats.realLiability;
                                    const isSafe = diff >= 0;
                                    return (
                                        <div className={`font-bold flex items-center gap-1 text-[11px] ${isSafe ? 'text-green-600' : 'text-orange-600'}`}>
                                            {isSafe ? (
                                                <>✓ Cobertura OK (+${diff.toLocaleString()})</>
                                            ) : (
                                                <>⚠ Desfasaje (${Math.abs(diff).toLocaleString()})</>
                                            )}
                                        </div>
                                    );
                                })()}
                            </div>
                        )}
                        {!stats.isBudgetMode && stats.calculationMethod !== 'manual' && (
                            <p className="text-xs text-gray-400 mt-1">Pasivo monetario actual</p>
                        )}
                    </div>
                    <div className="bg-purple-50 p-3 rounded-full text-purple-600">
                        <TrendingUp size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Ventas Totales</h3>
                        <p className="text-3xl font-bold text-green-600">
                            {loading ? '...' : `$${stats.totalMoneyGenerated.toLocaleString()}`}
                        </p>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xl text-green-600">
                        <TrendingUp size={24} />
                    </div>
                </div>
            </div>

            {/* Birthday Alert Section */}
            {birthdaysOfToday.length > 0 && (
                <div className="mb-8 animate-bounce-subtle">
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-1 rounded-2xl shadow-lg shadow-pink-100">
                        <div className="bg-white p-6 rounded-[calc(1rem-1px)]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-600 flex items-center gap-2">
                                    <Cake className="text-pink-500" size={24} />
                                    ¡Cumpleaños de Hoy! 🎂
                                </h3>
                                <span className="bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                                    {birthdaysOfToday.length} {birthdaysOfToday.length === 1 ? 'Socio' : 'Socios'}
                                </span>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {birthdaysOfToday.map(client => (
                                    <div key={client.id} className="flex items-center gap-3 p-3 bg-pink-50/50 rounded-xl border border-pink-100 hover:bg-pink-50 transition-colors group">
                                        <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-pink-500 shadow-sm border border-pink-100 group-hover:scale-110 transition-transform">
                                            <Cake size={20} />
                                        </div>
                                        <div className="min-w-0">
                                            <p className="font-bold text-gray-800 text-sm truncate">{client.name}</p>
                                            <p className="text-[10px] text-pink-600 font-bold uppercase tracking-tight flex items-center gap-1">
                                                Socio #{client.socioNumber}
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* Recent Activity Feed */}
            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-6">
                    <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2">
                        <Clock className="text-gray-400" size={20} />
                        Actividad Reciente
                    </h3>
                </div>

                <div className="h-96 overflow-y-auto scrollbar-thin pr-2 space-y-3">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400 italic">Cargando actividad...</div>
                    ) : recentActivity.length === 0 ? (
                        <div className="p-10 text-center text-gray-400 bg-gray-50 rounded-xl">
                            No hay actividad registrada aún.
                        </div>
                    ) : (
                        recentActivity.map((item) => (
                            <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-xl shadow-sm border border-gray-100 hover:bg-gray-50 transition group">
                                <div className="flex items-center gap-4">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${item.type === 'credit'
                                        ? 'bg-green-100 text-green-600'
                                        : (item.isExpirationAdjustment || item.concept?.toLowerCase().includes('vencimiento'))
                                            ? 'bg-red-100 text-red-600'
                                            : 'bg-orange-100 text-orange-600'
                                        }`}>
                                        {item.type === 'credit'
                                            ? <ArrowUpRight size={20} />
                                            : (item.isExpirationAdjustment || item.concept?.toLowerCase().includes('vencimiento'))
                                                ? <ArrowDownLeft size={20} /> // Or maybe another icon like Clock/X? Sticking to ArrowDownLeft is fine for debit
                                                : <Gift size={20} /> // Use Gift for redemption to distinguish? Original was ArrowDownLeft. Let's keep ArrowDownLeft for consistency but maybe differentiate. Actually user just said "aparecen como vencidos".
                                        }
                                    </div>
                                    <div className="min-w-0">
                                        <p className="text-sm font-bold text-gray-800 line-clamp-1">
                                            {item.userName}
                                        </p>
                                        <p className="text-xs text-gray-500 flex items-center gap-1">
                                            {item.type === 'credit'
                                                ? 'Sumó'
                                                : (item.isExpirationAdjustment || item.concept?.toLowerCase().includes('vencimiento'))
                                                    ? 'Vencieron'
                                                    : 'Canjeó'
                                            }
                                            <span className={`font-bold ${item.type === 'credit'
                                                ? 'text-green-600'
                                                : (item.isExpirationAdjustment || item.concept?.toLowerCase().includes('vencimiento'))
                                                    ? 'text-red-500' // Red for expiration
                                                    : 'text-orange-600'
                                                }`}>
                                                {item.amount} pts
                                            </span>
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right pl-4 shrink-0">
                                    <div className="text-[11px] font-bold text-gray-500 bg-gray-50 px-2 py-1 rounded-lg inline-block whitespace-nowrap border border-gray-100 mb-1">
                                        {item.date.toLocaleString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' })}
                                    </div>
                                    <p className="text-[11px] text-gray-400 font-medium max-w-[200px] sm:max-w-xs md:max-w-md line-clamp-1" title={item.concept}>
                                        {item.concept}
                                    </p>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {recentActivity.length >= activityLimit && (
                    <div className="mt-4 flex justify-center">
                        <button
                            onClick={() => setActivityLimit(prev => prev + 10)}
                            className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-4 py-2 rounded-lg transition-colors flex items-center gap-2"
                        >
                            VER MÁS ACTIVIDAD <Clock size={14} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
