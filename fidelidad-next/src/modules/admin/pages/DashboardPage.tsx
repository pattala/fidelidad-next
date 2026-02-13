import { useState, useEffect } from 'react';
import { collection, getDocs, query, where, collectionGroup, orderBy, limit, doc, getDoc, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';
import { ArrowUpRight, ArrowDownLeft, TrendingUp, Gift, User, Clock, RefreshCw, Cake, X } from 'lucide-react';

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
        referralCount: 0
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activityLimit, setActivityLimit] = useState(10);
    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const [isBirthdayAlertVisible, setIsBirthdayAlertVisible] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('hideBirthdayAlert') !== 'true';
        }
        return true;
    });
    const [whatsappMentionsGift, setWhatsappMentionsGift] = useState<{ [key: string]: boolean }>({});

    useEffect(() => {
        setLoading(true);

        // 1. Listen for Config
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
            if (docSnap.exists()) {
                const updatedConfig = docSnap.data();
                setConfig(updatedConfig);
            }
        });

        // 2. Listen for Users (Total Points, Client Count, Birthdays)
        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
            let points = 0;
            let clientCount = 0;
            const today = TimeService.now();
            const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const todaysSelectedBirthdays: any[] = [];

            snap.forEach(d => {
                const data = d.data();
                // Filter: skip admins AND skip 'ghost' users (no name or no DNI)
                const isGhost = !data.name && !data.nombre && !data.dni;
                if (data.role !== 'admin' && !isGhost) {
                    clientCount++;
                    points += (data.points ?? data.puntos ?? 0);
                    if (data.birthDate?.endsWith(todayMD)) {
                        todaysSelectedBirthdays.push({ id: d.id, ...data });
                    }
                }
            });

            setBirthdaysOfToday(todaysSelectedBirthdays);
            setStats(prev => ({ ...prev, usersCount: clientCount, totalPoints: points }));
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

        // listener para el simulador de tiempo
        const handleSimChange = () => {
            window.location.reload();
        };
        window.addEventListener('time-simulation-change', handleSimChange);

        return () => {
            unsubConfig();
            unsubUsers();
            unsubDebits();
            unsubCredits();
            unsubPrizes();
            unsubActivity();
            window.removeEventListener('time-simulation-change', handleSimChange);
        };
    }, [activityLimit]);

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
            </div>

            {/* Birthday Alert Section */}
            {isBirthdayAlertVisible && birthdaysOfToday.length > 0 && (
                <div className="mb-8 animate-bounce-subtle relative group">
                    <button
                        onClick={() => {
                            setIsBirthdayAlertVisible(false);
                            sessionStorage.setItem('hideBirthdayAlert', 'true');
                        }}
                        className="absolute -top-2 -right-2 z-10 bg-white text-gray-400 hover:text-rose-500 p-1.5 rounded-full shadow-lg border border-gray-100 transition-all hover:scale-110 active:scale-95"
                        title="Cerrar hasta la próxima sesión"
                    >
                        <X size={16} strokeWidth={3} />
                    </button>
                    <div className="bg-gradient-to-r from-pink-500 to-rose-500 p-1 rounded-2xl shadow-lg shadow-pink-100">
                        <div className="bg-white p-6 rounded-[calc(1rem-1px)]">
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-black text-xl text-transparent bg-clip-text bg-gradient-to-r from-pink-600 to-rose-600 flex items-center gap-2">
                                    <Cake className="text-pink-500" size={24} />
                                    ¡Cumpleaños de Hoy! 🎂
                                </h3>
                                <div className="flex items-center gap-2">
                                    <span className="bg-pink-100 text-pink-600 px-3 py-1 rounded-full text-xs font-black uppercase tracking-wider">
                                        {birthdaysOfToday.length} {birthdaysOfToday.length === 1 ? 'Socio' : 'Socios'}
                                    </span>
                                </div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                                {birthdaysOfToday.map(client => {
                                    const currentYear = TimeService.now().getFullYear().toString();
                                    const alreadyGifted = client.lastBirthdayPointsYear === currentYear;
                                    const alreadyGreeted = client.lastBirthdayGreetingYear === currentYear;

                                    return (
                                        <div key={client.id} className="flex flex-col gap-3 p-3 bg-pink-50/50 rounded-xl border border-pink-100 hover:bg-pink-50 transition-colors group">
                                            <div className="flex items-center gap-3">
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

                                            <div className="flex flex-col gap-2 mt-2">
                                                {!alreadyGreeted ? (
                                                    <div className="flex flex-col gap-2">
                                                        {!alreadyGifted ? (
                                                            <div className="flex gap-2">
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!config) return;
                                                                        const res: any = await BirthdayService.sendBirthdayGreeting(client.id, client, config, { mode: 'clean' });
                                                                        if (res?.success) {
                                                                            setBirthdaysOfToday(prev => prev.map(p => p.id === client.id ? { ...p, lastBirthdayGreetingYear: currentYear } : p));
                                                                            toast.success("Saludo enviado por Email y Push.");
                                                                        }
                                                                    }}
                                                                    className="flex-1 bg-white border border-yellow-400 text-yellow-600 text-[10px] font-bold py-2 rounded-lg hover:bg-yellow-50 transition shadow-sm"
                                                                >
                                                                    👋 Solo Saludar
                                                                </button>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!config) return;
                                                                        if (!confirm("¿Confirmas Regalar Puntos + Enviar Notificaciones?")) return;
                                                                        const giftSuccess = await BirthdayService.giveBirthdayPoints(client.id, client, config);
                                                                        if (giftSuccess) {
                                                                            const updatedClient = { ...client, lastBirthdayPointsYear: currentYear };
                                                                            const res: any = await BirthdayService.sendBirthdayGreeting(client.id, updatedClient, config, { mode: 'full' });
                                                                            setBirthdaysOfToday(prev => prev.map(p => p.id === client.id ? { ...p, lastBirthdayPointsYear: currentYear, lastBirthdayGreetingYear: currentYear } : p));
                                                                            toast.success("Puntos acreditados y notificados.");
                                                                        }
                                                                    }}
                                                                    className="flex-1 bg-gradient-to-r from-pink-500 to-rose-500 text-white text-[10px] font-bold py-2 rounded-lg hover:shadow-md transition shadow-sm"
                                                                >
                                                                    🎁 Regalar y Saludar
                                                                </button>
                                                            </div>
                                                        ) : (
                                                            <div className="flex flex-col gap-2">
                                                                <div className="text-[9px] font-bold text-green-600 bg-green-50 px-2 py-1 rounded text-center border border-green-100">
                                                                    ✅ Puntos ya acreditados (Auto)
                                                                </div>
                                                                <button
                                                                    onClick={async () => {
                                                                        if (!config) return;
                                                                        const res: any = await BirthdayService.sendBirthdayGreeting(client.id, client, config, { mode: 'full' });
                                                                        if (res?.success) {
                                                                            setBirthdaysOfToday(prev => prev.map(p => p.id === client.id ? { ...p, lastBirthdayGreetingYear: currentYear } : p));
                                                                            toast.success("Aviso de regalo enviado.");
                                                                        }
                                                                    }}
                                                                    className="w-full bg-pink-500 text-white text-[10px] font-bold py-2 rounded-lg hover:bg-pink-600 transition"
                                                                >
                                                                    📩 Avisar Regalo + Saludo
                                                                </button>
                                                            </div>
                                                        )}
                                                    </div>
                                                ) : (
                                                    <div className="flex flex-col gap-2 animate-fade-in">
                                                        <div className="flex flex-col items-center justify-center gap-1 py-2 text-[10px] font-black text-blue-600 bg-blue-50 border border-blue-200 rounded-xl">
                                                            <div className="flex items-center gap-1">
                                                                <span>✅</span>
                                                                <span className="uppercase tracking-tight">Saludo Enviado</span>
                                                            </div>
                                                            <span className="text-[8px] opacity-70 font-bold uppercase">(Email y Push / Inbox)</span>
                                                        </div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <label className="flex items-center gap-2 cursor-pointer select-none">
                                                                <input
                                                                    type="checkbox"
                                                                    checked={whatsappMentionsGift[client.id] ?? alreadyGifted}
                                                                    onChange={(e) => setWhatsappMentionsGift(prev => ({ ...prev, [client.id]: e.target.checked }))}
                                                                    className="w-3.5 h-3.5 rounded border-gray-300 text-pink-500 focus:ring-pink-200"
                                                                />
                                                                <span className="text-[10px] font-bold text-gray-500 uppercase tracking-tight">Incluir aviso de regalo</span>
                                                            </label>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                if (!config) return;
                                                                const mentionsGift = whatsappMentionsGift[client.id] ?? alreadyGifted;
                                                                const mode = mentionsGift ? 'full' : 'clean';
                                                                const res: any = await BirthdayService.sendBirthdayGreeting(client.id, client, config, { mode, whatsappOnly: true });
                                                                if (res?.whatsappLink) {
                                                                    window.open(res.whatsappLink, '_blank');
                                                                } else {
                                                                    toast.error("No se pudo generar el link de WhatsApp");
                                                                }
                                                            }}
                                                            className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-[11px] font-black py-2.5 rounded-xl transition-all shadow-lg flex items-center justify-center gap-2"
                                                        >
                                                            <span className="text-lg">💬</span> ABRIR WHATSAPP
                                                        </button>
                                                        <p className="text-[8px] text-gray-400 text-center italic">WhatsApp requiere apertura manual.</p>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </div>
            )
            }

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
