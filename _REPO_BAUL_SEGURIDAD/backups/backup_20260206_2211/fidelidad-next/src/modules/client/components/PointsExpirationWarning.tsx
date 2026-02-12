import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, orderBy, limit, getDocs } from 'firebase/firestore';
import { Calendar, AlertTriangle } from 'lucide-react';
import { TimeService } from '../../../services/timeService';

interface Props {
    userId?: string;
    compact?: boolean;
}

export const PointsExpirationWarning = ({ userId, compact }: Props) => {
    const [nextExpirations, setNextExpirations] = useState<{ amount: number, date: Date }[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchExpirations = async () => {
            if (!userId) {
                setLoading(false);
                return;
            }

            try {
                // Remove date filter to show OVERDUE points that haven't been deducted
                const q = query(
                    collection(db, `users/${userId}/points_history`),
                    where('expiresAt', '!=', null), // Ensure field exists
                    orderBy('expiresAt', 'asc'),
                    limit(300)
                );

                const snapshot = await getDocs(q);

                // Helper to format date key for grouping
                const formatDateKey = (d: Date) => d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });

                // ... (in useEffect)
                const rawExpirations: { amount: number, date: Date }[] = [];
                // Use simulated time for "now"
                const now = TimeService.now();
                now.setHours(0, 0, 0, 0);

                snapshot.forEach(doc => {
                    const data = doc.data();
                    // Include if positive amount AND definitely has expiration AND is not already processed
                    if (data.amount > 0 && data.expiresAt && data.status !== 'expired') {
                        const date = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                        rawExpirations.push({ amount: data.amount, date });
                    }
                });

                // Group by Date
                const groupedMap = rawExpirations.reduce((acc, curr) => {
                    const key = formatDateKey(curr.date);
                    if (!acc[key]) {
                        acc[key] = { amount: 0, date: curr.date };
                    }
                    acc[key].amount += curr.amount;
                    return acc;
                }, {} as Record<string, { amount: number, date: Date }>);

                const sortedExpirations = Object.values(groupedMap).sort((a, b) => a.date.getTime() - b.date.getTime());

                const todayStart = TimeService.startOfToday();

                let overdueSum = 0;
                const relevantExpirations: { amount: number, date: Date, isOverdue?: boolean, isUnifiedOverdue?: boolean }[] = [];

                const futureOrTodayItems: typeof sortedExpirations = [];

                sortedExpirations.forEach(item => {
                    // Check if the item is already processed in the database
                    // But wait, 'sortedExpirations' comes from 'rawExpirations' which ALREADY filters out 'status === expired'.
                    // So we are good on that front. All items here are ACTIVE.

                    const itemDateInfo = new Date(item.date);
                    itemDateInfo.setHours(0, 0, 0, 0);

                    // Strictly Less Than Today = Overdue
                    if (itemDateInfo.getTime() < todayStart.getTime()) {
                        overdueSum += item.amount;
                    } else {
                        // Today or Future
                        futureOrTodayItems.push(item);
                    }
                });

                // Construct final display list (Max 2 items usually)
                // Priority 1: Unified Overdue Line (if any)
                if (overdueSum > 0) {
                    relevantExpirations.push({
                        amount: overdueSum,
                        date: new Date(todayStart.getTime() - 86400000), // Visual fake date (yesterday) for sorting if needed, but we use a flag
                        isOverdue: true,
                        isUnifiedOverdue: true
                    });
                }

                // Priority 2: Today and Future (Take up to 2 slots total, minus the one used by overdue)
                const slotsLeft = 2 - relevantExpirations.length;
                if (slotsLeft > 0) {
                    relevantExpirations.push(...futureOrTodayItems.slice(0, slotsLeft));
                }

                setNextExpirations(relevantExpirations);
            } catch (error) {
                console.error("Error fetching expirations:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchExpirations();

        // Listen for time jumps
        const handleTimeChange = () => fetchExpirations();
        window.addEventListener('time-simulation-change', handleTimeChange);
        return () => window.removeEventListener('time-simulation-change', handleTimeChange);
    }, [userId]);

    if (loading || nextExpirations.length === 0) return null;

    const isOverdue = (date: Date) => {
        const today = TimeService.startOfToday();
        return date < today;
    };

    if (compact) {
        return (
            <div className="space-y-3">
                {nextExpirations.map((exp: any, idx) => {
                    const isUnifiedOverdue = exp.isUnifiedOverdue;
                    const dateObj = new Date(exp.date);
                    dateObj.setHours(0, 0, 0, 0);
                    const todayStart = TimeService.startOfToday();

                    const isOverdueItem = isUnifiedOverdue || (dateObj.getTime() < todayStart.getTime());

                    return (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-black uppercase tracking-tight text-gray-600">
                            <div className="flex items-center gap-2">
                                <div className={`p-1 rounded ${isOverdueItem ? 'bg-red-50 text-red-600' : 'bg-purple-50 text-purple-600'}`}>
                                    {isOverdueItem ? <AlertTriangle size={14} /> : <Calendar size={14} />}
                                </div>
                                <span className={isOverdueItem ? 'text-red-600' : ''}>
                                    {isUnifiedOverdue ? 'VENCIDO' : (
                                        <>
                                            {isOverdueItem ? 'VENCIDO ' : ''}
                                            {exp.date.toLocaleDateString('es-AR', { day: '2-digit', month: 'short', year: 'numeric' })}
                                        </>
                                    )}
                                </span>
                            </div>
                            <span className={isOverdueItem ? 'text-red-600' : 'text-pink-600'}>
                                {exp.amount} pts
                            </span>
                        </div>
                    );
                })}
            </div>
        );
    }

    return (
        <div className={`rounded-2xl p-4 shadow-sm border ${nextExpirations.some(e => isOverdue(e.date)) ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100'}`}>
            <h4 className={`font-black text-[10px] uppercase tracking-widest mb-3 ${nextExpirations.some(e => isOverdue(e.date)) ? 'text-red-500' : 'text-gray-400'}`}>
                {nextExpirations.some(e => isOverdue(e.date)) ? 'Puntos Vencidos / Por Vencer' : 'Próximos Vencimientos'}
            </h4>
            <div className="space-y-3">
                {nextExpirations.map((exp: any, idx) => {
                    // Use flag from our new logic, fall back to date check for future items
                    const isUnifiedOverdue = exp.isUnifiedOverdue;
                    const dateObj = new Date(exp.date);
                    dateObj.setHours(0, 0, 0, 0);
                    const todayStart = TimeService.startOfToday();

                    // If it's the unified item, it's overdue. Else check date.
                    const isOverdueItem = isUnifiedOverdue || (dateObj.getTime() < todayStart.getTime());
                    const isToday = !isUnifiedOverdue && (dateObj.getTime() === todayStart.getTime());

                    return (
                        <div key={idx} className="flex justify-between items-center text-xs font-bold">
                            <div className="flex items-center gap-2">
                                {isOverdueItem ?
                                    <AlertTriangle size={14} className="text-red-500" /> :
                                    <Calendar size={14} className={isToday ? "text-orange-500" : "text-purple-600"} />
                                }
                                <span className={isOverdueItem ? 'text-red-600' : (isToday ? 'text-orange-600' : 'text-gray-500')}>
                                    {isUnifiedOverdue ? 'VENCIDO (Acumulado)' : (
                                        <>
                                            {isOverdueItem ? 'YA VENCIDO: ' : (isToday ? 'VENCE HOY: ' : '')}
                                            {exp.date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short' })}
                                        </>
                                    )}
                                </span>
                            </div>
                            <span className={isOverdueItem ? 'text-red-600' : (isToday ? 'text-orange-600' : 'text-pink-600')}>
                                {exp.amount} pts
                            </span>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
