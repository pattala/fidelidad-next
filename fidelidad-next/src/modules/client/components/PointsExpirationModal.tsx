import React, { useEffect, useState } from 'react';
import { db } from '../../../lib/firebase';
import { collection, query, where, orderBy, onSnapshot } from 'firebase/firestore';
import { X, Calendar, AlertTriangle, Clock } from 'lucide-react';
import { TimeService } from '../../../services/timeService';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    userId: string;
}

export const PointsExpirationModal = ({ isOpen, onClose, userId }: Props) => {
    const [expirations, setExpirations] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!isOpen || !userId) return;

        const q = query(
            collection(db, `users/${userId}/points_history`),
            where('expiresAt', '!=', null),
            orderBy('expiresAt', 'asc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const rawExpirations: any[] = [];
            const now = TimeService.now();
            const todayStart = new Date(now);
            todayStart.setHours(0, 0, 0, 0);

            snapshot.forEach(doc => {
                const data = doc.data();
                const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;

                if (currentRemaining > 0 && data.expiresAt && data.status !== 'expired') {
                    const date = data.expiresAt.toDate ? data.expiresAt.toDate() : new Date(data.expiresAt);
                    rawExpirations.push({
                        amount: currentRemaining,
                        date,
                        concept: data.concept || 'Carga de puntos'
                    });
                }
            });

            // Agrupar por fecha
            const groupedMap = rawExpirations.reduce((acc, curr) => {
                const key = curr.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
                if (!acc[key]) acc[key] = { amount: 0, date: curr.date, items: [] };
                acc[key].amount += curr.amount;
                acc[key].items.push(curr);
                return acc;
            }, {} as Record<string, any>);

            setExpirations(Object.values(groupedMap).sort((a: any, b: any) => a.date.getTime() - b.date.getTime()));
            setLoading(false);
        });

        return () => unsubscribe();
    }, [isOpen, userId]);

    if (!isOpen) return null;

    const todayStart = TimeService.startOfToday();

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 animate-in fade-in transition-all">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            <div className="relative bg-white w-full max-w-lg rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl flex flex-col max-h-[90vh] overflow-hidden animate-in slide-in-from-bottom-10 duration-300">
                {/* Header */}
                <div className="p-6 border-b border-gray-50 flex items-center justify-between bg-gradient-to-r from-purple-50/50 to-white">
                    <div className="flex items-center gap-3">
                        <div className="bg-purple-100 p-2.5 rounded-2xl text-purple-600">
                            <Clock size={24} strokeWidth={2.5} />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-gray-800 uppercase tracking-tight">Mis Vencimientos</h3>
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Desglose de puntos próximos</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-gray-500 hover:bg-gray-200 transition-colors"
                    >
                        <X size={20} strokeWidth={3} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4 scrollbar-hide">
                    {loading ? (
                        <div className="space-y-4">
                            {[1, 2, 3].map(i => (
                                <div key={i} className="h-20 bg-gray-50 rounded-2xl animate-pulse" />
                            ))}
                        </div>
                    ) : expirations.length > 0 ? (
                        <div className="space-y-6">
                            {expirations.map((group, idx) => {
                                const dateObj = new Date(group.date);
                                dateObj.setHours(0, 0, 0, 0);
                                const isOverdue = dateObj.getTime() < todayStart.getTime();
                                const isToday = dateObj.getTime() === todayStart.getTime();

                                return (
                                    <div key={idx} className="relative">
                                        <div className="flex items-center gap-2 mb-3">
                                            <div className={`w-2 h-2 rounded-full ${isOverdue ? 'bg-red-500' : isToday ? 'bg-orange-500' : 'bg-purple-500'}`} />
                                            <span className={`text-[11px] font-black uppercase tracking-[0.2em] ${isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-gray-400'}`}>
                                                {isOverdue ? 'YA VENCIDO' : isToday ? 'VENCE HOY' : `VENCE EL ${group.date.toLocaleDateString('es-AR')}`}
                                            </span>
                                            <div className="flex-1 h-[1px] bg-gray-100" />
                                            <span className={`text-sm font-black ${isOverdue ? 'text-red-600' : isToday ? 'text-orange-600' : 'text-purple-700'}`}>
                                                {group.amount} pts
                                            </span>
                                        </div>

                                        <div className="space-y-2">
                                            {group.items.map((item: any, i: number) => (
                                                <div key={i} className="bg-gray-50/50 rounded-2xl p-4 flex items-center justify-between border border-transparent hover:border-gray-100 transition-colors">
                                                    <div className="flex flex-col gap-0.5">
                                                        <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{item.concept}</span>
                                                        <span className="text-[11px] font-bold text-gray-600">
                                                            Cargados hace {Math.floor((todayStart.getTime() - item.date.getTime()) / (1000 * 60 * 60 * 24 * -1))} días
                                                        </span>
                                                    </div>
                                                    <span className={`font-black text-sm ${isOverdue ? 'text-red-400' : 'text-gray-400'}`}>
                                                        {item.amount}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    ) : (
                        <div className="text-center py-10">
                            <div className="bg-green-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                                <Calendar size={32} />
                            </div>
                            <h4 className="font-black text-gray-800 uppercase tracking-tight">¡Todo en orden!</h4>
                            <p className="text-xs text-gray-500 mt-1 max-w-[200px] mx-auto uppercase font-bold leading-tight">No tienes puntos próximos a vencer por el momento.</p>
                        </div>
                    )}
                </div>

                {/* Footer Tip */}
                <div className="p-6 bg-purple-50 text-center">
                    <div className="flex items-center justify-center gap-2 mb-1 text-purple-700">
                        <AlertTriangle size={14} />
                        <span className="text-[10px] font-black uppercase tracking-widest">Consejo de ahorro</span>
                    </div>
                    <p className="text-[11px] text-purple-600/80 font-bold leading-tight">
                        ¡Usa tus puntos antes de la fecha límite para no perder los beneficios!
                    </p>
                </div>
            </div>
        </div>
    );
};
