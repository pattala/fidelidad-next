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
        referralCount: 0
    });
    const [recentActivity, setRecentActivity] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [activityLimit, setActivityLimit] = useState(10);
    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);
    const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const navigate = useNavigate();
    const [isBirthdayAlertVisible, setIsBirthdayAlertVisible] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('hideBirthdayAlert') !== 'true';
        }
        return true;
    });
    const [whatsappMentionsGift, setWhatsappMentionsGift] = useState<{ [key: string]: boolean }>({});
    const [isBirthdayMinimized, setIsBirthdayMinimized] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('birthdayMinimized') === 'true';
        }
        return false;
    });

    // Dragging state for WhatsApp FAB
    const [isDraggingFab, setIsDraggingFab] = useState(false);
    const [fabPos, setFabPos] = useState({ x: 32, y: 32 }); // bottom-8 left-8 approx
    const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
    const [hasMovedFab, setHasMovedFab] = useState(false);
    const [isFabExpanded, setIsFabExpanded] = useState(false);

    useEffect(() => {
        const handleGlobalMouseMove = (e: MouseEvent) => {
            if (!isDraggingFab) return;
            setHasMovedFab(true);
            setFabPos({ x: e.clientX - (64 / 2), y: window.innerHeight - e.clientY - (64 / 2) });
        };
        const handleGlobalMouseUp = () => {
            setIsDraggingFab(false);
            setTimeout(() => setHasMovedFab(false), 100);
        };

        if (isDraggingFab) {
            window.addEventListener('mousemove', handleGlobalMouseMove);
            window.addEventListener('mouseup', handleGlobalMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleGlobalMouseMove);
            window.removeEventListener('mouseup', handleGlobalMouseUp);
        };
    }, [isDraggingFab, dragOffset]);

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
            const usersExpiring: any[] = [];

            // Calculate warning window date (30 days ahead as broad detection)
            const todayStr = today.toISOString().split('T')[0];
            const windowEnd = new Date(today);
            windowEnd.setDate(windowEnd.getDate() + 30);
            const windowEndStr = windowEnd.toISOString().split('T')[0];

            const itinerancyDays = config?.messaging?.expirationReminderIntervalDays ?? config?.expirationItinerancyDays ?? 0;
            const currentYear = today.getFullYear().toString();

            snap.forEach(d => {
                const data = d.data();
                // Filter: skip admins AND skip 'ghost' users (no name or no DNI)
                const isGhost = !data.name && !data.nombre && !data.dni;
                if (data.role !== 'admin' && !isGhost) {
                    clientCount++;
                    const userPoints = data.points ?? data.puntos ?? 0;
                    points += userPoints;

                    // 1. Birthdays (Only if not already greeted this year)
                    if (data.birthDate?.endsWith(todayMD)) {
                        if (data.lastBirthdayGreetingYear !== currentYear) {
                            todaysSelectedBirthdays.push({ id: d.id, ...data });
                        }
                    }

                    // 2. Upcoming expirations (Respecting itinerancy)
                    const hasPoints = userPoints > 0 || (data.nextExpirationAmount || 0) > 0;
                    if (data.nextExpirationDate && data.nextExpirationDate > todayStr && data.nextExpirationDate <= windowEndStr && hasPoints) {
                        // Ocultar burbuja solo si el admin ya gestionó WhatsApp manualmente hoy
                        let shouldNotify = true;
                        if (data.lastWhatsAppManualDate === todayStr) {
                            shouldNotify = false;
                        }

                        if (shouldNotify) {
                            usersExpiring.push({
                                id: d.id,
                                name: data.name || data.nombre || 'Socio',
                                points: userPoints > 0 ? userPoints : (data.nextExpirationAmount || 0),
                                nextExpirationDate: data.nextExpirationDate,
                                phone: data.phone || data.telefono || ''
                            });
                        }
                    }
                }
            });

            setBirthdaysOfToday(todaysSelectedBirthdays);
            setExpiringUsers(usersExpiring);
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

    // --- DAILY CHECK: cumpleaños + vencimientos (1x/día, silencioso) ---
    useEffect(() => {
        if (!config) return;
        const runDailyCheck = async () => {
            try {
                const SECRET = (import.meta as any).env?.VITE_API_KEY || '';
                if (!SECRET) return;
                const res = await fetch('/api/check-birthdays?mode=daily', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': SECRET }
                });
                const data = await res.json();
                if (!data.skipped && data.ok) {
                    console.log("✅ [Dashboard] Daily check ejecutado:", data.date);
                }
            } catch (e) {
                console.warn("⚠️ [Dashboard] Daily check falló (no crítico):", e);
            }
        };
        runDailyCheck();
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
            const today = new Date().toISOString().split('T')[0];
            // Campo separado del engine automático — solo el admin lo setea al manejar WhatsApp
            await updateDoc(doc(db, 'users', user.id), { lastWhatsAppManualDate: today });
            // Optimistic UI update
            setExpiringUsers(prev => prev.filter(u => u.id !== user.id));
            // Audit log
            const token = await auth.currentUser?.getIdToken();
            fetch('/api/log-audit', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': (import.meta as any).env?.VITE_API_KEY || '',
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
            });
        } catch (e) {
            console.error('Error al marcar vencimiento gestionado:', e);
            toast.error('Error al actualizar');
        }
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

                {/* KPI: Puntos por Vencer */}
                {expiringUsers.length > 0 && (
                    <div className="bg-gradient-to-br from-amber-50 to-orange-50 p-6 rounded-2xl shadow-sm border border-amber-200 flex items-center justify-between transition hover:shadow-md relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-20 h-20 bg-amber-100/50 rounded-full -translate-y-1/2 translate-x-1/2" />
                        <div className="relative z-10">
                            <h3 className="text-amber-700 text-sm font-medium mb-1">⏳ Próximos a Vencer</h3>
                            <div className="flex flex-col">
                                <p className="text-3xl font-bold text-amber-800">
                                    {expiringUsers.reduce((acc, u) => acc + u.points, 0).toLocaleString()} pts
                                </p>
                                <span className="text-[10px] font-bold text-amber-600 mt-1 uppercase tracking-tight">
                                    {expiringUsers.length} socio{expiringUsers.length > 1 ? 's' : ''} · ≈ ${(expiringUsers.reduce((acc, u) => acc + u.points, 0) * (stats.pointValueConfigured || 1)).toLocaleString()}
                                </span>
                            </div>
                        </div>
                        <div className="bg-amber-100 p-3 rounded-xl text-amber-600 relative z-10">
                            <AlertTriangle size={24} />
                        </div>
                    </div>
                )}
            </div>

            {/* WhatsApp FAB for Expirations - Panel Expandible */}
            {expiringUsers.length > 0 && (
                <div
                    className="fixed z-50 animate-in slide-in-from-left-10"
                    style={{ bottom: fabPos.y, left: fabPos.x, cursor: isDraggingFab ? 'grabbing' : 'default' }}
                >
                    {isFabExpanded ? (
                        /* ---- PANEL EXPANDIDO ---- */
                        <div className="bg-white rounded-2xl shadow-2xl border border-green-100 w-80 overflow-hidden">
                            {/* Header */}
                            <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
                                <span className="font-bold text-sm flex items-center gap-2">
                                    <MessageCircle size={16} />
                                    Avisos de Vencimiento ({expiringUsers.length})
                                </span>
                                <button onClick={() => setIsFabExpanded(false)} className="hover:bg-white/20 p-1 rounded-lg transition" title="Cerrar panel">
                                    <X size={16} />
                                </button>
                            </div>
                            {/* Lista de usuarios */}
                            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                                {expiringUsers.map(user => {
                                    const waLink = generateExpirationWaLink(user);
                                    const [y2, m2, d2] = (user.nextExpirationDate || '--').split('-');
                                    return (
                                        <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-bold text-gray-800 truncate">{user.name}</p>
                                                <p className="text-xs text-amber-600 font-medium">
                                                    {user.points} pts · Vence {d2 ? `${d2}/${m2}/${y2}` : '—'}
                                                </p>
                                            </div>
                                            <div className="flex items-center gap-1 shrink-0">
                                                {/* Enviar → abre WA + marca gestionado */}
                                                <button
                                                    onClick={async () => {
                                                        if (waLink) window.open(waLink, '_blank');
                                                        else toast.error('Sin teléfono registrado');
                                                        await markExpirationHandled(user, 'sent');
                                                    }}
                                                    title="Abrir WhatsApp y marcar como enviado"
                                                    className="p-1.5 bg-green-100 hover:bg-green-200 text-green-700 rounded-lg transition"
                                                >
                                                    <MessageCircle size={15} />
                                                </button>
                                                {/* Anular → marca gestionado sin WA */}
                                                <button
                                                    onClick={() => markExpirationHandled(user, 'cancelled')}
                                                    title="Anular aviso (sin enviar WhatsApp)"
                                                    className="p-1.5 bg-gray-100 hover:bg-red-100 text-gray-400 hover:text-red-500 rounded-lg transition"
                                                >
                                                    <X size={15} />
                                                </button>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                            {/* Footer */}
                            <div className="p-3 bg-gray-50 border-t border-gray-100 flex gap-2">
                                <button
                                    onClick={() => {
                                        setIsFabExpanded(false);
                                        const defaultMsg = config?.messaging?.templates?.expirationWarning ||
                                            '¡Hola {nombre}! 📢 Tienes {puntos} puntos próximos a vencer. ⏳ Entrá a la App para ver el detalle y aprovecharlos antes de que se venzan. 🎁';
                                        navigate('/admin/whatsapp', {
                                            state: { message: defaultMsg, clientIds: expiringUsers.map(u => u.id), notificationType: 'expiration' }
                                        });
                                    }}
                                    className="flex-1 bg-green-600 hover:bg-green-700 text-white text-xs font-bold py-2 rounded-xl transition flex items-center justify-center gap-1"
                                >
                                    <MessageCircle size={13} /> Gestionar todos
                                </button>
                                <button
                                    onClick={() => setIsFabExpanded(false)}
                                    className="px-3 text-xs font-bold text-gray-400 hover:text-gray-600 hover:bg-gray-200 rounded-xl transition"
                                    title="Más tarde"
                                >
                                    🕐
                                </button>
                            </div>
                        </div>
                    ) : (
                        /* ---- FAB COLAPSADO ---- */
                        <div
                            onMouseDown={(e) => { setIsDraggingFab(true); setDragOffset({ x: e.clientX, y: e.clientY }); }}
                            className="bg-green-500 hover:bg-green-600 text-white font-bold rounded-full shadow-2xl flex items-center justify-center p-4 cursor-grab active:cursor-grabbing hover:scale-105 transition-transform relative"
                        >
                            <button
                                onClick={() => { if (!hasMovedFab) setIsFabExpanded(true); }}
                                className="flex items-center gap-2"
                            >
                                <MessageCircle size={24} />
                                <span className="hidden md:inline">WhatsApp Vencimientos ({expiringUsers.length})</span>
                                <span className="md:hidden">{expiringUsers.length}</span>
                                <span className="absolute -top-2 -right-2 bg-white text-green-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center shadow-md border border-green-100">
                                    {expiringUsers.length}
                                </span>
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Birthday Alert Section - Floating Widget */}
            {isBirthdayAlertVisible && birthdaysOfToday.length > 0 && (
                <div className={`fixed bottom-6 right-6 z-50 transition-all duration-300 transform ${isBirthdayMinimized ? 'w-14 h-14' : 'w-80 md:w-[400px]'}`}>
                    {isBirthdayMinimized ? (
                        <button
                            onClick={() => {
                                setIsBirthdayMinimized(false);
                                sessionStorage.setItem('birthdayMinimized', 'false');
                            }}
                            className="w-14 h-14 bg-gradient-to-br from-pink-500 to-rose-600 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 active:scale-95 transition-all animate-bounce-subtle"
                            title="Ver cumpleañeros"
                        >
                            <Cake size={28} />
                            <span className="absolute -top-1 -right-1 bg-white text-pink-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm border border-pink-100">
                                {birthdaysOfToday.length}
                            </span>
                        </button>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-[0_20px_50px_rgba(219,39,119,0.3)] border border-pink-100 overflow-hidden flex flex-col max-h-[80vh] animate-in slide-in-from-bottom-5">
                            {/* Header */}
                            <div className="bg-gradient-to-r from-pink-500 to-rose-600 p-4 flex items-center justify-between shrink-0">
                                <div className="flex items-center gap-2 text-white">
                                    <Cake size={20} className="animate-pulse" />
                                    <div>
                                        <h3 className="font-black text-sm uppercase tracking-tight leading-none">¡Cumples de Hoy!</h3>
                                        <p className="text-[10px] opacity-80 font-bold uppercase tracking-widest mt-0.5">
                                            {birthdaysOfToday.length} {birthdaysOfToday.length === 1 ? 'Socio' : 'Socios'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-1">
                                    <button
                                        onClick={() => {
                                            setIsBirthdayMinimized(true);
                                            sessionStorage.setItem('birthdayMinimized', 'true');
                                        }}
                                        className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
                                        title="Minimizar"
                                    >
                                        <ChevronDown size={18} />
                                    </button>
                                    <button
                                        onClick={() => {
                                            setIsBirthdayAlertVisible(false);
                                            sessionStorage.setItem('hideBirthdayAlert', 'true');
                                        }}
                                        className="p-1.5 hover:bg-white/20 rounded-lg text-white transition-colors"
                                        title="Cerrar permanentemente"
                                    >
                                        <X size={18} />
                                    </button>
                                </div>
                            </div>

                            {/* List Content */}
                            <div className="overflow-y-auto p-4 space-y-4 scrollbar-thin max-h-[60vh] bg-pink-50/20">
                                {birthdaysOfToday.map(client => {
                                    const currentYear = TimeService.now().getFullYear().toString();
                                    const alreadyGifted = client.lastBirthdayPointsYear === currentYear;
                                    const alreadyGreeted = client.lastBirthdayGreetingYear === currentYear;

                                    return (
                                        <div key={client.id} className="p-4 bg-white rounded-xl border border-pink-100 shadow-sm hover:shadow-md transition-all group">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex items-center gap-3">
                                                    <div className="w-10 h-10 bg-pink-100 rounded-full flex items-center justify-center text-pink-600 shadow-inner group-hover:scale-110 transition-transform">
                                                        <User size={20} />
                                                    </div>
                                                    <div className="min-w-0">
                                                        <p className="font-black text-gray-800 text-sm truncate uppercase tracking-tight">{client.name}</p>
                                                        <p className="text-[9px] text-pink-600 font-bold uppercase tracking-widest">
                                                            Socio #{client.socioNumber}
                                                        </p>
                                                    </div>
                                                </div>
                                                {alreadyGreeted && (
                                                    <span className="bg-green-100 text-green-700 p-1 rounded-full border border-green-200" title="Saludo enviado">
                                                        <CheckCircle size={14} />
                                                    </span>
                                                )}
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                {/* Estado de Notificación */}
                                                <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-tighter mb-1">
                                                    <span className="text-gray-400">Estado:</span>
                                                    {alreadyGreeted ? (
                                                        <span className="text-blue-600 flex items-center gap-1">
                                                            ✓ Saludado {alreadyGifted && <span className="text-green-600">+ Regalo</span>}
                                                        </span>
                                                    ) : (
                                                        <span className="text-orange-500">Pendiente de saludo</span>
                                                    )}
                                                </div>

                                                {/* Acciones principales */}
                                                {!alreadyGreeted ? (
                                                    <div className="grid grid-cols-2 gap-2">
                                                        <button
                                                            onClick={async () => {
                                                                if (!config) return;
                                                                const res: any = await BirthdayService.sendBirthdayGreeting(client.id, client, config, { mode: 'clean' });
                                                                if (res?.success) {
                                                                    setBirthdaysOfToday(prev => prev.map(p => p.id === client.id ? { ...p, lastBirthdayGreetingYear: currentYear } : p));
                                                                    toast.success("Saludo enviado por Email y Push.");
                                                                }
                                                            }}
                                                            className="bg-white border-2 border-pink-200 text-pink-600 text-[10px] font-black py-2 rounded-xl hover:bg-pink-50 transition uppercase tracking-tight"
                                                        >
                                                            👋 Saludar
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
                                                            className="bg-pink-600 text-white text-[10px] font-black py-2 rounded-xl hover:bg-pink-700 transition shadow-lg shadow-pink-100 uppercase tracking-tight"
                                                        >
                                                            🎁 Regalar
                                                        </button>
                                                    </div>
                                                ) : (
                                                    alreadyGifted ? (
                                                        <div className="bg-green-50 text-green-700 py-2 rounded-xl border border-green-100 text-center text-[10px] font-black uppercase tracking-tight">
                                                            ✨ ¡Regalo ya otorgado!
                                                        </div>
                                                    ) : (
                                                        <button
                                                            onClick={async () => {
                                                                if (!config) return;
                                                                if (!confirm("¿Confirmas regalar los puntos ahora? Se enviará Email y Push informando del regalo.")) return;
                                                                const giftSuccess = await BirthdayService.giveBirthdayPoints(client.id, client, config);
                                                                if (giftSuccess) {
                                                                    const updatedClient = { ...client, lastBirthdayPointsYear: currentYear };
                                                                    // Forzamos modo 'full' (con regalo) y avisamos por canales auto
                                                                    await BirthdayService.sendBirthdayGreeting(client.id, updatedClient, config, { mode: 'full' });
                                                                    setBirthdaysOfToday(prev => prev.map(p => p.id === client.id ? { ...p, lastBirthdayPointsYear: currentYear } : p));
                                                                    toast.success("Regalo enviado con éxito.");
                                                                }
                                                            }}
                                                            className="w-full bg-pink-100 text-pink-700 text-[10px] font-black py-2 rounded-xl border-2 border-dashed border-pink-300 hover:bg-pink-200 transition uppercase tracking-tight flex items-center justify-center gap-2"
                                                        >
                                                            <Gift size={14} /> 🎁 MEJORAR A REGALO
                                                        </button>
                                                    )
                                                )}

                                                {/* WhatsApp Section */}
                                                <div className="mt-2 pt-2 border-t border-pink-100/50">
                                                    <div className="flex items-center justify-between mb-2 px-1">
                                                        <label className="flex items-center gap-2 cursor-pointer select-none group/toggle">
                                                            <input
                                                                type="checkbox"
                                                                checked={whatsappMentionsGift[client.id] ?? alreadyGifted}
                                                                onChange={(e) => setWhatsappMentionsGift(prev => ({ ...prev, [client.id]: e.target.checked }))}
                                                                className="w-3.5 h-3.5 rounded border-pink-300 text-pink-600 focus:ring-pink-200"
                                                            />
                                                            <span className="text-[10px] font-bold text-gray-400 group-hover/toggle:text-pink-600 transition-colors uppercase tracking-tight">Incluir aviso de regalo</span>
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
                                                        className="w-full bg-[#25D366] hover:bg-[#128C7E] text-white text-[11px] font-black py-2.5 rounded-xl transition-all shadow-md flex items-center justify-center gap-2 group-hover:scale-[1.02]"
                                                    >
                                                        <MessageCircle size={18} /> ABRIR WHATSAPP
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            {/* Footer */}
                            <div className="p-3 bg-white border-t border-pink-100 shrink-0">
                                <p className="text-[8px] text-gray-400 text-center font-bold uppercase tracking-widest italic leading-tight">
                                    El proceso automático se encarga del saludo {config?.enableBirthdayBonus ? '+ regalo' : ''}. WhatsApp es manual.
                                </p>
                            </div>
                        </div>
                    )}
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
