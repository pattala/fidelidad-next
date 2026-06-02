import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, collectionGroup, orderBy, limit, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Gift, User, Clock, Cake, X, ChevronDown, CheckCircle, MessageCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BirthdayService } from '../../../services/birthdayService';
import toast from 'react-hot-toast';

export const DashboardPage = () => {
    const [stats, setStats] = useState({
        usersCount: 0,
        totalPoints: 0,
        todayPointsEmitted: 0,
        monthPointsEmitted: 0,
        redeemedPoints: 0,
        redeemedMoney: 0,
        totalMoneyGenerated: 0,
        todayMoneyGenerated: 0,
        circulatingValue: 0,
        budgetLimit: 0,
        isBudgetMode: false,
        realLiability: 0,
        calculationMethod: 'manual',
        pointValueConfigured: 0,
        pointValueReal: 0,
        referralCount: 0,
        totalAccumulatedBalance: 0,
        pushEnabledCount: 0
    });
    const [forecastSummary, setForecastSummary] = useState<any>(null);
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [fetchingForecast, setFetchingForecast] = useState(false);
    const [activityLimit, setActivityLimit] = useState(10);
    const [config, setConfig] = useState<any>(null);
    const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
    const navigate = useNavigate();

    useEffect(() => {
        setLoading(true);

        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
            if (docSnap.exists()) {
                setConfig(docSnap.data());
            }
        });

        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
            let points = 0;
            let clientCount = 0;
            let totalAccumulatedBalance = 0;
            let pushEnabled = 0;
            snap.forEach(d => {
                const data = d.data();
                if (data.role !== 'admin' && (data.name || data.nombre || data.dni)) {
                    clientCount++;
                    points += Number(data.points ?? 0);
                    totalAccumulatedBalance += Number(data.accumulated_balance || 0);
                    if ((data.fcmTokens?.length || 0) > 0) pushEnabled++;
                }
            });
            setStats(prev => ({ ...prev, usersCount: clientCount, totalPoints: points, totalAccumulatedBalance, pushEnabledCount: pushEnabled }));
            setLoading(false);
        });

        const unsubDebits = onSnapshot(query(collectionGroup(db, 'points_history'), where('type', '==', 'debit')), (snap) => {
            let rp = 0, rm = 0;
            snap.forEach(d => {
                const data = d.data();
                const isEx = data.isExpirationAdjustment === true || (data.concept || '').toLowerCase().includes('vencimiento');
                if (!isEx) {
                    rp += Math.abs(data.amount || 0);
                    rm += (data.redeemedValue || 0);
                }
            });
            setStats(prev => ({ ...prev, redeemedPoints: rp, redeemedMoney: rm }));
        });

        const startOfToday = new Date(TimeService.now());
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date(startOfToday.getFullYear(), startOfToday.getMonth(), 1);

        const unsubCredits = onSnapshot(query(collectionGroup(db, 'points_history'), where('type', '==', 'credit')), (snap) => {
            let tmg = 0, dmg = 0, dpe = 0, mpe = 0, rc = 0;
            snap.forEach(d => {
                const data = d.data();
                tmg += (data.moneySpent || 0);
                if (data.reason === 'referral_bonus') rc++;
                const date = data.date?.toDate ? data.date.toDate() : TimeService.now();
                if (date >= startOfToday) {
                    dmg += (data.moneySpent || 0);
                    dpe += (data.amount || 0);
                }
                if (date >= startOfMonth) {
                    mpe += (data.amount || 0);
                }
            });
            setStats(prev => ({ ...prev, totalMoneyGenerated: tmg, todayMoneyGenerated: dmg, todayPointsEmitted: dpe, monthPointsEmitted: mpe, referralCount: rc }));
        });

        const unsubPrizes = onSnapshot(query(collection(db, 'prizes'), where('active', '==', true)), (snap) => {
            let totalRatio = 0, count = 0;
            snap.forEach(d => {
                const p = d.data();
                if (p.cashValue && p.pointsRequired >= 1) {
                    totalRatio += (p.cashValue / p.pointsRequired);
                    count++;
                }
            });
            setStats(prev => ({ ...prev, pointValueReal: (count > 0 ? (totalRatio / count) : 0) }));
        });

        const userCache = new Map();
        const getUserName = async (uid: string) => {
            if (userCache.has(uid)) return userCache.get(uid);
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const name = userDoc.exists() ? (userDoc.data().name || userDoc.data().nombre || 'Usuario') : 'Usuario';
                userCache.set(uid, name);
                return name;
            } catch (e) { return 'Usuario'; }
        };

        const unsubActivity = onSnapshot(query(collectionGroup(db, 'points_history'), orderBy('date', 'desc'), limit(activityLimit)), async (snap) => {
            const activities = await Promise.all(snap.docs.map(async (d) => {
                const data = d.data();
                const userName = await getUserName(d.ref.parent.parent?.id || '');
                return { id: d.id, ...data, date: data.date?.toDate ? data.date.toDate() : TimeService.now(), userName };
            }));
            setRecentActivity(activities);
        });

        return () => {
            unsubConfig(); unsubUsers(); unsubDebits(); unsubCredits(); unsubPrizes(); unsubActivity();
        };
    }, [activityLimit]);

    useEffect(() => {
        if (!config || stats.usersCount === 0) return;

        const fetchForecast = async () => {
            setFetchingForecast(true);
            try {
                const fRes = await fetch('/api/expirations?action=forecast', {
                    headers: { 'x-api-key': import.meta.env.VITE_API_KEY || '' }
                });
                const fData = await fRes.json();
                if (fData.ok) setForecastSummary(fData.summary);
            } catch (e) { console.error("Forecast failed:", e); }
            finally { setFetchingForecast(false); }
        };

        fetchForecast();
    }, [config?.simulatedOffsetDays, stats.usersCount]);


    useEffect(() => {
        if (!config) return;
        const method = config.pointCalculationMethod || (config.useAutomaticPointValue ? 'average' : 'manual');
        let val = config.pointValue || 10;
        if (method === 'average') val = stats.pointValueReal;
        else if (method === 'budget') val = stats.totalPoints > 0 ? (config.pointValueBudget / stats.totalPoints) : 0;
        
        setStats(prev => ({
            ...prev,
            circulatingValue: prev.totalPoints * val,
            budgetLimit: Math.max(0, (config.pointValueBudget || 0) - prev.redeemedMoney),
            isBudgetMode: method === 'budget',
            realLiability: prev.totalPoints * prev.pointValueReal,
            calculationMethod: method,
            pointValueConfigured: val
        }));
    }, [config, stats.totalPoints, stats.pointValueReal, stats.redeemedMoney]);

    const handleActionLog = async (user: any, action: string) => {
        const arTodayDate = TimeService.now();
        const todayAR = arTodayDate.toISOString().split('T')[0];
        try {
            await updateDoc(doc(db, 'users', user.id), { lastWhatsAppManualDate: todayAR, lastExpirationNotice: todayAR });
            setExpiringUsers(prev => prev.filter(u => u.id !== user.id));
            fetch('/api/log-audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY || '' },
                body: JSON.stringify({
                    type: 'whatsapp_manual',
                    status: 'success',
                    summary: `Aviso manual enviado a ${user.name}`,
                    executor: 'Admin',
                    details: [{ userId: user.id, userName: user.name, action: action === 'sent' ? 'whatsapp_sent' : 'whatsapp_cancelled', info: `${user.points} pts · Vence: ${user.nextExpirationDate}` }]
                })
            });
        } catch (e) { toast.error('Error al actualizar'); }
    };

    return (
        <div className="animate-fade-in pb-10">
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-4">
                    <h1 className="text-2xl font-bold text-gray-800">Tablero Principal</h1>
                    {config?.enableDateSimulator && (config?.simulatedOffsetDays || 0) !== 0 && (
                        <div className="flex items-center gap-2 bg-orange-50 border border-orange-100 px-3 py-1.5 rounded-xl animate-pulse">
                            <Clock size={14} className="text-orange-500" />
                            <span className="text-[10px] font-bold text-orange-600 uppercase tracking-tighter">Modo Simulación Activo</span>
                        </div>
                    )}
                </div>
            </div>

            {/* WIDGET DE PRESUPUESTO MENSUAL */}
            {config?.masterCalculatorSettings?.bolsaMensualPuntos && config.masterCalculatorSettings.bolsaMensualPuntos > 0 && (
                <div className="mb-6 bg-white p-6 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden">
                    {/* Fondo decorativo */}
                    <div className="absolute -right-10 -top-10 w-40 h-40 bg-pink-50 rounded-full opacity-50 blur-2xl pointer-events-none" />
                    
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-end mb-4 relative z-10">
                        <div>
                            <h3 className="text-gray-500 font-medium mb-1 flex items-center gap-2">
                                <AlertTriangle size={16} className={stats.monthPointsEmitted > config.masterCalculatorSettings.bolsaMensualPuntos ? "text-red-500" : "text-gray-400"} /> 
                                Presupuesto Mensual de Puntos
                            </h3>
                            <div className="flex items-baseline gap-2">
                                <p className={`text-4xl font-black ${stats.monthPointsEmitted > config.masterCalculatorSettings.bolsaMensualPuntos ? 'text-red-600' : 'text-gray-900'}`}>
                                    {stats.monthPointsEmitted.toLocaleString('es-AR')}
                                </p>
                                <p className="text-gray-400 font-medium">/ {config.masterCalculatorSettings.bolsaMensualPuntos.toLocaleString('es-AR')} emitidos este mes</p>
                            </div>
                        </div>
                        {stats.monthPointsEmitted > config.masterCalculatorSettings.bolsaMensualPuntos ? (
                            <div className="flex flex-col items-end mt-4 md:mt-0">
                                <div className="bg-red-50 text-red-700 px-4 py-2 rounded-xl text-sm font-bold animate-pulse">
                                    ¡Límite superado!
                                </div>
                                <span className="text-red-500 font-black text-sm mt-1">
                                    Balance: -{(stats.monthPointsEmitted - config.masterCalculatorSettings.bolsaMensualPuntos).toLocaleString('es-AR')} pts
                                </span>
                            </div>
                        ) : (
                            <div className="flex flex-col items-end mt-4 md:mt-0">
                                <div className="bg-emerald-50 text-emerald-700 px-4 py-2 rounded-xl text-sm font-bold">
                                    Presupuesto Saludable
                                </div>
                                <span className="text-emerald-600 font-black text-sm mt-1">
                                    Balance: +{(config.masterCalculatorSettings.bolsaMensualPuntos - stats.monthPointsEmitted).toLocaleString('es-AR')} pts disponibles
                                </span>
                            </div>
                        )}
                    </div>
                    
                    <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden relative z-10">
                        <div 
                            className={`h-full transition-all duration-1000 rounded-full ${stats.monthPointsEmitted > config.masterCalculatorSettings.bolsaMensualPuntos ? 'bg-red-500' : 'bg-pink-500'}`} 
                            style={{ width: `${Math.min((stats.monthPointsEmitted / config.masterCalculatorSettings.bolsaMensualPuntos) * 100, 100)}%` }} 
                        />
                    </div>
                </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><h3 className="text-gray-500 text-sm font-medium mb-1">Usuarios Activos</h3><p className="text-3xl font-bold text-gray-900">{loading ? '...' : stats.usersCount}</p></div>
                    <div className="bg-blue-50 p-3 rounded-xl text-blue-600"><User size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><h3 className="text-gray-500 text-sm font-medium mb-1">Referidos</h3><p className="text-3xl font-bold text-purple-600">{loading ? '...' : stats.referralCount}</p></div>
                    <div className="bg-purple-50 p-3 rounded-xl text-purple-600 font-bold"><ArrowUpRight size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><h3 className="text-gray-500 text-sm font-medium mb-1">Puntos en Circulación</h3><p className="text-3xl font-bold text-indigo-600">{loading ? '...' : stats.totalPoints.toLocaleString()}</p></div>
                    <div className="bg-indigo-50 p-3 rounded-xl text-indigo-600"><TrendingUp size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><h3 className="text-gray-500 text-sm font-medium mb-1">Total Canjeado</h3><p className="text-3xl font-bold text-orange-500">{loading ? '...' : stats.redeemedPoints.toLocaleString()}</p></div>
                    <div className="bg-orange-50 p-3 rounded-xl text-orange-600"><Gift size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between xl:grid-cols-2">
                    <div><h3 className="text-gray-500 text-sm font-medium mb-1">Dinero Generado</h3><p className="text-3xl font-bold text-green-600">${loading ? '...' : stats.totalMoneyGenerated.toLocaleString()}</p></div>
                    <div className="bg-green-50 p-3 rounded-xl text-green-600"><ArrowUpRight size={24} /></div>
                </div>
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between">
                    <div><h3 className="text-gray-500 text-sm font-medium mb-1">Valor Circulante</h3><p className="text-3xl font-bold text-gray-800">${loading ? '...' : stats.circulatingValue.toLocaleString()}</p></div>
                    <div className="bg-gray-50 p-3 rounded-xl text-gray-600"><TrendingUp size={24} /></div>
                </div>
            </div>


            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <h3 className="font-bold text-lg text-gray-800 flex items-center gap-2 mb-6"><Clock className="text-gray-400" size={20} /> Actividad Reciente</h3>
                <div className="space-y-3">
                    {loading ? <div className="text-center text-gray-400">Cargando...</div> : recentActivity.map(item => (
                        <div key={item.id} className="flex items-center justify-between p-4 bg-white rounded-xl border border-gray-100 hover:bg-gray-50 transition">
                            <div className="flex items-center gap-4">
                                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${item.type === 'credit' ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-600'}`}>
                                    {item.type === 'credit' ? <ArrowUpRight size={20} /> : <ArrowDownLeft size={20} />}
                                </div>
                                <div>
                                    <p className="text-sm font-bold text-gray-800">{item.userName}</p>
                                    <p className="text-xs text-gray-500">{item.type === 'credit' ? 'Sumó' : 'Venció/Canjeó'} <span className="font-bold">{item.amount} pts</span></p>
                                </div>
                            </div>
                            <div className="text-right">
                                <div className="text-[10px] font-bold text-gray-400">{item.date.toLocaleString()}</div>
                                <p className="text-[10px] text-gray-400">{item.concept}</p>
                            </div>
                        </div>
                    ))}
                    {recentActivity.length >= activityLimit && (
                        <button onClick={() => setActivityLimit(prev => prev + 10)} className="w-full py-4 text-xs font-bold text-blue-600 uppercase tracking-widest">Ver más</button>
                    )}
                </div>
            </div>
        </div>
    );
};
