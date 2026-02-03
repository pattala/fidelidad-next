import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, collectionGroup, orderBy, limit, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ConfigService } from '../../../services/configService';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Gift, User, Clock, DollarSign } from 'lucide-react';

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

    useEffect(() => {
        const fetchStats = async () => {
            try {
                // 1. KPI Stats
                // Clientes
                // Clientes (Fetch all to include those with missing role)
                const qUsers = query(collection(db, 'users'));
                const snapUsers = await getDocs(qUsers);

                let points = 0;
                let clientCount = 0;
                snapUsers.forEach(doc => {
                    const d = doc.data();
                    // Count as client if NOT admin (handling missing role as client)
                    if (d.role !== 'admin') {
                        clientCount++;
                        points += ((d.points || d.puntos) || 0);
                    }
                });

                // Canjes Globales
                const qRedeems = query(collectionGroup(db, 'points_history'), where('type', '==', 'debit'));
                const snapRedeems = await getDocs(qRedeems);

                let redeemedPoints = 0;
                let redeemedMoney = 0;
                snapRedeems.forEach(doc => {
                    const data = doc.data();
                    redeemedPoints += Math.abs(data.amount || 0);
                    redeemedMoney += (data.redeemedValue || 0);
                });

                // Dinero Generado (Puntos Otorgados)
                const qGenerated = query(collectionGroup(db, 'points_history'), where('type', '==', 'credit'));
                const snapGenerated = await getDocs(qGenerated);
                let totalMoneyGenerated = 0;
                snapGenerated.forEach(doc => {
                    const data = doc.data();
                    totalMoneyGenerated += (data.moneySpent || 0);
                });

                // Calcular Valor del Punto (Automático o Manual)
                const config = await ConfigService.get();
                let finalPointValue = config.pointValue || 10;

                // Always calculate Average Prize Value (needed for 'average' mode AND 'budget' comparison)
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

                    if (validPrizesCount > 0) {
                        averagePrizeValue = totalRatio / validPrizesCount;
                    }
                }

                // Determine method (fallback to legacy behavior if new field is missing)
                const method = config.pointCalculationMethod || (config.useAutomaticPointValue ? 'average' : 'manual');

                if (method === 'manual') {
                    finalPointValue = config.pointValue || 10;
                } else if (method === 'average') {
                    finalPointValue = averagePrizeValue;
                } else if (method === 'budget') {
                    // In budget mode, we want to show the REAL liability based on prizes to contrast with budget
                    finalPointValue = averagePrizeValue;
                }

                // Budget Logic: Deduct already redeemed money from the total budget
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

                // 2. Recent Activity Feed
                const qActivity = query(
                    collectionGroup(db, 'points_history'),
                    orderBy('date', 'desc'),
                    limit(10)
                );
                const snapActivity = await getDocs(qActivity);

                // Helper to fetch user names
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

                const activities = await Promise.all(snapActivity.docs.map(async (d) => {
                    const data = d.data();
                    const userId = d.ref.parent.parent?.id; // users/{id}/points_history/{doc}
                    const userName = userId ? await getUserName(userId) : 'Sistema';

                    return {
                        id: d.id,
                        ...data,
                        date: data.date?.toDate ? data.date.toDate() : new Date(),
                        userName
                    };
                }));

                setRecentActivity(activities);

            } catch (error) {
                console.error("Error fetching dashboard data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchStats();
    }, []);

    // Helper formatter
    const formatTime = (date: Date) => {
        const now = new Date();
        const diffMins = Math.floor((now.getTime() - date.getTime()) / 60000);

        if (diffMins < 1) return 'Ahora';
        if (diffMins < 60) return `${diffMins} min`;
        const diffHours = Math.floor(diffMins / 60);
        if (diffHours < 24) return `${diffHours} h`;
        return date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
    };

    // --- Group Activity Logic ---
    const groupedActivity: any[] = [];
    if (recentActivity && recentActivity.length > 0) {
        recentActivity.forEach((item) => {
            // Unique Key for grouping: Date + UserId + Type
            const dateStr = item.date.toLocaleDateString();
            // const key = `${dateStr}-${item.userId || item.userName}-${item.type}`;

            const existing = groupedActivity.find(g =>
                g.date.toLocaleDateString() === dateStr &&
                (g.userId === item.userId || g.userName === item.userName) &&
                g.type === item.type
            );

            if (existing) {
                existing.amount += Math.abs(item.amount);
                // Merge concepts if different
                if (!existing.concept.includes(item.concept)) {
                    existing.concept += `, ${item.concept}`;
                }
            } else {
                groupedActivity.push({ ...item, amount: Math.abs(item.amount) });
            }
        });
    }
    // ----------------------------

    return (
        <div className="animate-fade-in pb-10">
            <h1 className="text-2xl font-bold text-gray-800 mb-6">Tablero Principal</h1>

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
            </div>
        </div>
    );
};
