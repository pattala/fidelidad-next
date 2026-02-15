import { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, orderBy, limit, onSnapshot } from 'firebase/firestore';
import { Calendar, AlertTriangle } from 'lucide-react';
import { TimeService } from '../../../services/timeService';

interface Props {
    userId?: string;
    compact?: boolean;
}

export const PointsExpirationWarning = ({ userId, compact }: Props) => {
    const [nextExpirations, setNextExpirations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!userId) {
            setLoading(false);
            return;
        }

        let unsubscribe: (() => void) | undefined;

        const setupListener = () => {
            try {
                const q = query(
                    collection(db, `users/${userId}/points_history`),
                    where('expiresAt', '!=', null),
                    orderBy('expiresAt', 'asc'),
                    limit(300)
                );

                unsubscribe = onSnapshot(q, (snapshot) => {
                    const rawExpirations: { amount: number, date: Date }[] = [];
                    const now = TimeService.now();
                    const todayStart = new Date(now);
                    todayStart.setHours(0, 0, 0, 0);

                    snapshot.forEach(doc => {
                        const data = doc.data();
                        const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;

                        // Solo procesar si tiene puntos y no está marcado como expirado
                        if (currentRemaining > 0 && data.expiresAt && data.status !== 'expired') {
                            const date = data.expiresAt?.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                            rawExpirations.push({ amount: currentRemaining, date });
                        }
                    });

                    // Agrupar por fecha formateada (DD/MM/YYYY) para evitar colisiones
                    const groupedMap = rawExpirations.reduce((acc, curr) => {
                        const key = curr.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                        if (!acc[key]) acc[key] = { amount: 0, date: curr.date };
                        acc[key].amount += curr.amount;
                        return acc;
                    }, {} as Record<string, { amount: number, date: Date }>);

                    const sortedGroups = Object.values(groupedMap).sort((a, b) => a.date.getTime() - b.date.getTime());

                    let overdueSum = 0;
                    const futureOrTodayItems: any[] = [];

                    sortedGroups.forEach(item => {
                        const itemDate = new Date(item.date);
                        itemDate.setHours(0, 0, 0, 0);

                        if (itemDate.getTime() < todayStart.getTime()) {
                            overdueSum += item.amount;
                        } else {
                            futureOrTodayItems.push(item);
                        }
                    });

                    const finalItems: any[] = [];
                    // Item 1: El acumulado de vencidos
                    if (overdueSum > 0) {
                        finalItems.push({
                            amount: overdueSum,
                            date: new Date(todayStart.getTime() - 86400000),
                            isUnifiedOverdue: true
                        });
                    }

                    // Siguientes: Los que vencen pronto (completar hasta 2 items totales)
                    const slotsLeft = 2 - finalItems.length;
                    if (slotsLeft > 0) {
                        finalItems.push(...futureOrTodayItems.slice(0, slotsLeft));
                    }

                    setNextExpirations(finalItems);
                    setLoading(false);
                }, (error) => {
                    console.error("Error in expiration listener:", error);
                    setLoading(false);
                });
            } catch (e) {
                console.error("Error setting up listener:", e);
                setLoading(false);
            }
        };

        setupListener();

        // Re-sincronizar cuando cambia la simulación de tiempo
        const handleTimeChange = () => {
            if (unsubscribe) unsubscribe();
            setupListener();
        };
        window.addEventListener('time-simulation-change', handleTimeChange);

        return () => {
            window.removeEventListener('time-simulation-change', handleTimeChange);
            if (unsubscribe) unsubscribe();
        };
    }, [userId]);

    if (loading || nextExpirations.length === 0) return null;

    const todayStart = TimeService.startOfToday();

    if (compact) {
        return (
            <div className="space-y-3">
                {nextExpirations.map((exp: any, idx) => {
                    const isUnifiedOverdue = exp.isUnifiedOverdue;
                    const dateObj = new Date(exp.date);
                    dateObj.setHours(0, 0, 0, 0);

                    const isOverdueItem = isUnifiedOverdue || (dateObj.getTime() < todayStart.getTime());
                    const isToday = !isUnifiedOverdue && (dateObj.getTime() === todayStart.getTime());

                    return (
                        <div key={idx} className="flex items-center justify-between text-[11px] font-black uppercase tracking-tight">
                            <div className="flex items-center gap-2">
                                <div className={`p-1 rounded ${isOverdueItem ? 'bg-red-50 text-red-600' : (isToday ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600')}`}>
                                    {isOverdueItem ? <AlertTriangle size={14} /> : <Calendar size={14} />}
                                </div>
                                <span className={isOverdueItem ? 'text-red-600' : (isToday ? 'text-orange-600' : 'text-gray-600')}>
                                    {isUnifiedOverdue ? 'YA VENCIDO' : (
                                        <>
                                            {isOverdueItem ? 'VENCE ' : (isToday ? 'VENCE HOY ' : 'VENCE ')}
                                            {exp.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}
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
        );
    }

    return (
        <div className={`rounded-2xl p-4 shadow-sm border ${nextExpirations.some(e => e.isUnifiedOverdue || new Date(e.date).setHours(0, 0, 0, 0) < todayStart.getTime()) ? 'bg-red-50/50 border-red-100' : 'bg-white border-gray-100'}`}>
            <h4 className={`font-black text-[10px] uppercase tracking-widest mb-3 ${nextExpirations.some(e => e.isUnifiedOverdue || new Date(e.date).setHours(0, 0, 0, 0) < todayStart.getTime()) ? 'text-red-500' : 'text-gray-400'}`}>
                Puntos por Vencer
            </h4>
            <div className="space-y-3">
                {nextExpirations.map((exp: any, idx) => {
                    const isUnifiedOverdue = exp.isUnifiedOverdue;
                    const dateObj = new Date(exp.date);
                    dateObj.setHours(0, 0, 0, 0);

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
                                            {isOverdueItem ? 'YA VENCIDO: ' : (isToday ? 'VENCE HOY: ' : 'VENCE: ')}
                                            {exp.date.toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' })}
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
