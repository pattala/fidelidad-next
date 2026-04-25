import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, collectionGroup, orderBy, limit, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Gift, User, Clock, RefreshCw, Cake, X, ChevronDown, CheckCircle, MessageCircle, AlertTriangle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BirthdayService } from '../../../services/birthdayService';
import toast from 'react-hot-toast';

export const DashboardPage = () => {
    const [stats, setStats] = useState({
        usersCount: 0,
        totalPoints: 0,
        todayPointsEmitted: 0,
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
    const [refreshing, setRefreshing] = useState(false);
    const [fetchingForecast, setFetchingForecast] = useState(false);
    const [activityLimit, setActivityLimit] = useState(10);
    const [config, setConfig] = useState<any>(null);
    const navigate = useNavigate();


    useEffect(() => {
        setLoading(true);

        // 1. Listen for Config
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
            if (docSnap.exists()) {
                const updatedConfig = docSnap.data();
                setConfig(updatedConfig);
            }
        });

        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
            let points = 0;
            let clientCount = 0;
            let totalAccumulatedBalance = 0;
            let pushEnabledCount = 0;
            const clientsFound: string[] = [];
            snap.forEach(d => {
                const data = d.data();
                if (data.role !== 'admin') {
                    clientCount++;
                    clientsFound.push(`${data.name || 'Sin Nombre'} (${d.id})`);
                    points += Number(data.points ?? data.puntos ?? 0);
                    totalAccumulatedBalance += Number(data.accumulated_balance || 0);
                    if ((data.fcmTokens?.length || 0) > 0) pushEnabledCount++;
                }
            });
            console.log(`[Dashboard Debug] Usuarios contados (${clientCount}):`, clientsFound);
            setStats(prev => ({ ...prev, usersCount: clientCount, totalPoints: points, totalAccumulatedBalance, pushEnabledCount }));
            setLoading(false);
        });

        // 3. Listen for Debits (Redeemed)
        const unsubDebits = onSnapshot(query(collectionGroup(db, 'points_history'), where('type', '==', 'debit')), (snap) => {
            let redeemedPoints = 0;
            let redeemedMoney = 0;
            snap.forEach(d => {
                const data = d.data();
                const concept = (data.concept || '').toLowerCase();
                const isEx = data.isExpirationAdjustment === true ||
                    ['vencimiento', 'vencidos', 'expirados', 'vencieron'].some(w => concept.includes(w));
                if (!isEx) {
                    redeemedPoints += Math.abs(data.amount || 0);
                    redeemedMoney += (data.redeemedValue || 0);
                }
            });
            setStats(prev => ({ ...prev, redeemedPoints, redeemedMoney }));
        });

        // 4. Listen for Credits (Generated Today & Total)
        const startOfToday = new Date(TimeService.now());
        startOfToday.setHours(0, 0, 0, 0);

        const unsubCredits = onSnapshot(query(collectionGroup(db, 'points_history'), where('type', '==', 'credit')), (snap) => {
            let totalMoneyGenerated = 0;
            let todayMoneyGenerated = 0;
            let todayPointsEmitted = 0;
            let referralCount = 0;

            snap.forEach(d => {
                const data = d.data();
                const money = (data.moneySpent || 0);
                totalMoneyGenerated += money;

                if (data.reason === 'referral_bonus') {
                    referralCount++;
                }

                const date = data.date?.toDate ? data.date.toDate() : new Date();
                if (date >= startOfToday) {
                    todayMoneyGenerated += money;
                    todayPointsEmitted += (data.amount || 0);
                }
            });
            setStats(prev => ({ ...prev, totalMoneyGenerated, todayMoneyGenerated, todayPointsEmitted, referralCount }));
        });

        // 5. Listen for Prizes (Real Point Value)
        const unsubPrizes = onSnapshot(query(collection(db, 'prizes'), where('active', '==', true)), (snap) => {
            let totalRatio = 0, count = 0;
            snap.forEach(d => {
                const p = d.data();
                if (p.cashValue && p.pointsRequired >= 1) {
                    totalRatio += (p.cashValue / p.pointsRequired);
                    count++;
                }
            });
            const avg = count > 0 ? (totalRatio / count) : 0;
            setStats(prev => ({ ...prev, pointValueReal: avg }));
        });

        // 6. Activity Feed
        const userCache = new Map();
        const getUserName = async (uid: string) => {
            if (userCache.has(uid)) return userCache.get(uid);
            try {
                const userDoc = await getDoc(doc(db, 'users', uid));
                const d = userDoc.exists() ? userDoc.data() : null;
                const name = d ? (d.name || d.nombre || 'Usuario Desconocido') : 'Usuario Desconocido';
                userCache.set(uid, name);
                return name;
            } catch (e) { return 'Usuario'; }
        };

        const unsubActivity = onSnapshot(query(collectionGroup(db, 'points_history'), orderBy('date', 'desc'), limit(activityLimit)), async (snap) => {
            const activities = await Promise.all(snap.docs.map(async (d) => {
                const data = d.data();
                const userId = d.ref.parent.parent?.id;
                const userName = userId ? await getUserName(userId) : 'Sistema';
                return {
                    id: d.id, ...data,
                    date: data.date?.toDate ? data.date.toDate() : new Date(),
                    userName
                };
            }));
            setRecentActivity(activities);
        });

        return () => {
            unsubConfig();
            unsubUsers();
            unsubDebits();
            unsubCredits();
            unsubPrizes();
            unsubActivity();
        };
    }, [activityLimit]);


    // --- DAILY CHECK: cumpleaños + vencimientos (1x/día, silencioso) ---
    useEffect(() => {
        if (!config) return;
        const runDailyCheck = async () => {
            try {
                const SECRET = import.meta.env.VITE_API_KEY || '';
                if (!SECRET) return;

                // Solo pasar simulatedDate si REALMENTE hay un offset activo
                // De lo contrario, activamos la deduplicación del motor (/api/engine-daily)
                // y que el backend resuelva si ya se ejecutó hoy o no.

                if (config.messaging?.enableDashboardTrigger === false) {
                    console.log('[Dashboard] Engine trigger disabled by config.');
                    return;
                }

                console.log('[Dashboard] Executing backend engine...');

                const hasOffset = TimeService.getOffsetInDays() !== 0;
                const body: any = {};
                if (hasOffset) body.simulatedDate = TimeService.now().toISOString();

                const res = await fetch(`/api/engine-daily?mode=daily&trigger=dashboard`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET },
                    body: JSON.stringify(body)
                });
                const data = await res.json();
                if (!data.skipped && data.ok) {
                    console.log("✅ [Dashboard] Daily check ejecutado:", data.date);
                }
            } catch (e) {
                console.warn("⚠️ [Dashboard] Daily/Campaign check falló (no crítico):", e);
            }
        };

        const fetchForecast = async () => {
            setFetchingForecast(true);
            try {
                const SECRET = import.meta.env.VITE_API_KEY || '';
                const fRes = await fetch('/api/expirations?action=forecast', {
                    headers: { 'x-api-key': SECRET }
                });
                const fData = await fRes.json();
                if (fData.ok) setForecastSummary(fData.summary);
            } catch (e) {
                console.error("Error fetching forecast:", e);
            } finally {
                setFetchingForecast(false);
            }
        };

        runDailyCheck();
        fetchForecast();
    }, [!!config]);

    // Handle derived stats update when dependencies change
    useEffect(() => {
        if (!config) return;

        const method = config.pointCalculationMethod || (config.useAutomaticPointValue ? 'average' : 'manual');
        let finalPointValue = config.pointValue || 10;

        if (method === 'manual') {
            finalPointValue = config.pointValue || 10;
        } else if (method === 'budget') {
            const totalBudget = config.pointValueBudget || 0;
            finalPointValue = stats.totalPoints > 0 ? (totalBudget / stats.totalPoints) : 0;
        } else {
            finalPointValue = stats.pointValueReal;
        }

        const totalBudget = config.pointValueBudget || 0;
        const remainingBudget = Math.max(0, totalBudget - stats.redeemedMoney);

        setStats(prev => ({
            ...prev,
            circulatingValue: prev.totalPoints * finalPointValue,
            budgetLimit: remainingBudget,
            isBudgetMode: method === 'budget',
            realLiability: prev.totalPoints * prev.pointValueReal,
            calculationMethod: method,
            pointValueConfigured: finalPointValue
        }));
    }, [config, stats.totalPoints, stats.pointValueReal, stats.redeemedMoney]);

    // --- Helpers para burbuja de WhatsApp de vencimientos ---
    const generateExpirationWaLink = (user: any): string | null => {
        if (!user.phone) return null;
        let phone = user.phone.replace(/\D/g, '');
        if (!phone.startsWith('54') && phone.length === 10) phone = '549' + phone;
        const template = config?.messaging?.templates?.expirationWarning ||
            '¡Hola {nombre}! 📢 Tienes {puntos} puntos próximos a vencer. ⏳ Entrá a la App para ver el detalle y aprovecharlos antes de que se venzan. 🎁';
        const [y, m, d] = (user.nextExpirationDate || '').split('-');
        const msg = template
            .replace(/{nombre}/g, user.name.split(' ')[0])
            .replace(/{puntos}/g, user.points.toString())
            .replace(/{fecha}/g, d && m && y ? `${d}/${m}/${y}` : '');
        return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg.trim())}`;
    };

    const markExpirationHandled = async (user: any, action: 'sent' | 'cancelled') => {
        try {
            const arTodayDate = TimeService.now();
            const todayAR = `${arTodayDate.getFullYear()}-${String(arTodayDate.getMonth() + 1).padStart(2, '0')}-${String(arTodayDate.getDate()).padStart(2, '0')}`;

            await updateDoc(doc(db, 'users', user.id), {
                lastWhatsAppManualDate: todayAR,
                lastExpirationNotice: todayAR
            });
            // Optimistic UI update
            setExpiringUsers(prev => prev.filter(u => u.id !== user.id));
            // Audit log
            const token = await auth.currentUser?.getIdToken();
            fetch('/api/log-audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || '',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    type: action === 'sent' ? 'whatsapp_expiracion_enviado' : 'whatsapp_expiracion_anulado',
                    status: 'success',
                    summary: action === 'sent'
                        ? `WhatsApp de vencimiento enviado a ${user.name}`
                        : `Aviso de vencimiento anulado para ${user.name}`,
                    details: [{
                        userId: user.id,
                        userName: user.name,
                        action: action === 'sent' ? 'whatsapp_sent' : 'whatsapp_cancelled',
                        info: `${user.points} pts · Vence: ${user.nextExpirationDate}`
                    }]
                })
            }).catch(e => console.error('[Audit] log-audit failed:', e));
        } catch (e) {
            console.error('Error al marcar vencimiento gestionado:', e);
            toast.error('Error al actualizar');
        }
    };

    // Helper para abrir WhatsApp de forma segura (evita bloqueadores de popups)
    const openWhatsAppSafely = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    return (
        <div className="animate-fade-in pb-10">
            <div className="flex items-center justify-between mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Tablero Principal</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-6 mb-8">
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
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Referidos</h3>
                        <p className="text-3xl font-bold text-purple-600">
                            {loading ? '...' : stats.referralCount}
                        </p>
                    </div>
                    <div className="bg-purple-50 p-3 rounded-xl text-purple-600">
                        <Gift size={24} />
                    </div>
                </div>

                {/* v6.0 - KPI DE NOTIFICACIONES PUSH */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md cursor-pointer group" onClick={() => navigate('/admin/clients')}>
                    <div className="flex-1">
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Salud Push</h3>
                        {loading ? <p className="text-lg font-bold">...</p> : (
                            <div className="flex flex-col">
                                <div className="flex items-center gap-2">
                                    <p className="text-2xl font-black text-gray-800">
                                        {stats.usersCount > 0 ? Math.round((stats.pushEnabledCount / stats.usersCount) * 100) : 0}%
                                    </p>
                                    <span className="text-[10px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full font-black">ACTIVOS</span>
                                </div>
                                <div className="mt-1 w-full bg-gray-100 h-1 rounded-full overflow-hidden">
                                     <div 
                                        className="bg-green-500 h-full transition-all duration-1000" 
                                        style={{ width: `${stats.usersCount > 0 ? (stats.pushEnabledCount / stats.usersCount) * 100 : 0}%` }} 
                                    />
                                </div>
                            </div>
                        )}
                    </div>
                    <div className="bg-orange-50 p-3 rounded-xl text-orange-600 group-hover:scale-110 transition-transform">
                        <CheckCircle size={24} />
                    </div>
                </div>

                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Puntos en Circulación</h3>
                        <div className="flex flex-col">
                            <p className="text-3xl font-bold text-indigo-600">
                                {loading ? '...' : stats.totalPoints.toLocaleString()}
                            </p>
                            <span className="text-[10px] font-bold text-indigo-400 mt-1 uppercase tracking-tight">
                                Hoy: +{stats.todayPointsEmitted.toLocaleString()}
                            </span>
                        </div>
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
                        <div className="flex flex-col">
                            <p className="text-3xl font-bold text-green-600">
                                {loading ? '...' : `$${stats.totalMoneyGenerated.toLocaleString()}`}
                            </p>
                            <span className="text-[10px] font-bold text-green-500 mt-1 uppercase tracking-tight">
                                Hoy: ${stats.todayMoneyGenerated.toLocaleString()}
                            </span>
                        </div>
                    </div>
                    <div className="bg-green-50 p-3 rounded-xl text-green-600">
                        <TrendingUp size={24} />
                    </div>
                </div>

                {/* KPI 7: Saldo a Favor Total */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-center justify-between transition hover:shadow-md">
                    <div>
                        <h3 className="text-gray-500 text-sm font-medium mb-1">Saldo a Favor Total</h3>
                        <p className="text-3xl font-bold text-emerald-600">
                            {loading ? '...' : `$${stats.totalAccumulatedBalance.toLocaleString()}`}
                        </p>
                        <p className="text-[10px] text-gray-400 font-bold mt-1 uppercase tracking-tight">Monto remanente</p>
                    </div>
                    <div className="bg-emerald-50 p-3 rounded-xl text-emerald-600">
                        <TrendingUp size={24} />
                    </div>
                </div>

            </div>

            {/* QUICK FORECAST BAR (CASH FLOW) */}
            {fetchingForecast ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden relative animate-pulse">
                    <div className="flex items-center gap-4">
                        <div className="bg-gray-100 p-3 rounded-2xl w-12 h-12"></div>
                        <div className="space-y-2">
                            <div className="bg-gray-100 h-4 w-48 rounded"></div>
                            <div className="bg-gray-50 h-3 w-32 rounded"></div>
                        </div>
                    </div>
                </div>
            ) : forecastSummary ? (
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 mb-8 overflow-hidden relative transition hover:shadow-md">
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6 relative z-10">
                        <div className="flex items-center gap-4">
                            <div className="bg-orange-500 text-white p-3 rounded-2xl shadow-lg shadow-orange-100">
                                <Clock size={24} />
                            </div>
                            <div>
                                <h3 className="text-gray-800 font-black text-lg flex items-center gap-2">
                                    Pronóstico de Salida de Puntos
                                </h3>
                                <p className="text-xs text-gray-400 font-bold uppercase tracking-wider">Flujo de Caja (Pasivo por Periodo)</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-8 w-full md:w-auto">
                            {(!forecastSummary || !forecastSummary.intervals || forecastSummary.intervals.length === 0) ? (
                                <div className="col-span-full py-4 text-gray-400 italic text-sm">
                                    Sin vencimientos programados próximamente.
                                </div>
                            ) : (
                                forecastSummary.intervals.slice(0, 4).map((interval: any) => (
                                    <div key={interval.key} className="relative group cursor-pointer" onClick={() => navigate('/admin/metrics')}>
                                        <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1 group-hover:text-orange-500 transition-colors">
                                            {interval.label}
                                        </p>
                                        <p className="text-lg font-black text-gray-800 leading-none">
                                            {(interval.points || 0).toLocaleString()} <span className="text-[10px] font-bold text-gray-300">pts</span>
                                        </p>
                                        <p className={`text-xs font-bold mt-1 ${interval.key === 'short' ? 'text-red-500' : 'text-orange-500'}`}>
                                            ≈ ${Math.round(interval.money || 0).toLocaleString('es-AR')}
                                        </p>
                                        <div className={`absolute -left-3 top-0 bottom-0 w-1 rounded-full opacity-20 ${interval.key === 'short' ? 'bg-red-500' : 'bg-orange-400'}`}></div>
                                    </div>
                                ))
                            )}
                        </div>

                        <button
                            onClick={() => navigate('/admin/metrics')}
                            className="bg-gray-50 hover:bg-gray-100 text-gray-500 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition flex items-center gap-2"
                        >
                            Ver detalle <ArrowUpRight size={14} />
                        </button>
                    </div>
                    {/* Background decoration */}
                    <div className="absolute top-0 right-0 bottom-0 w-1/3 bg-gradient-to-l from-orange-50/50 to-transparent pointer-events-none" />
                </div>
            ) : null}

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
                                                ? <ArrowDownLeft size={20} />
                                                : <Gift size={20} />
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
                                                    ? 'text-red-500'
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
                                    {item.redemptionCode && (
                                        <div className="flex justify-end mt-0.5">
                                            <span className="text-[8px] font-black bg-pink-50 text-pink-600 px-1 rounded border border-pink-100 uppercase">
                                                Cód: {item.redemptionCode}
                                            </span>
                                        </div>
                                    )}
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
        </div >
    );
};
