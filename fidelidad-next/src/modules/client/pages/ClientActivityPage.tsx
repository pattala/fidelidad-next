import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, orderBy, getDocs, doc, getDoc, deleteDoc } from 'firebase/firestore';
import { ArrowDownLeft, ArrowUpRight, Calendar, History, Clock } from 'lucide-react';
import { ModernConfirmModal } from '../components/ModernConfirmModal';
import { useOutletContext } from 'react-router-dom';
import type { AppConfig } from '../../../types';

export const ClientActivityPage = () => {
    const { config } = useOutletContext<{ config: AppConfig }>();
    const [history, setHistory] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userBalance, setUserBalance] = useState(0);
    const [itemToDelete, setItemToDelete] = useState<string | null>(null);

    useEffect(() => {
        const fetchHistory = async () => {
            const user = auth.currentUser;
            if (!user) return;

            try {
                // 1. Get Current Balance
                const userDoc = await getDoc(doc(db, 'users', user.uid));
                if (userDoc.exists()) {
                    setUserBalance(userDoc.data().points || 0);
                }

                // 2. Get History
                const q = query(
                    collection(db, 'users', user.uid, 'points_history'),
                    orderBy('date', 'desc')
                );
                const snapshot = await getDocs(q);
                const data = snapshot.docs.map(d => {
                    const docData = d.data();
                    return {
                        id: d.id,
                        ...docData,
                        // Handle Firestore Timestamp
                        date: docData.date?.toDate ? docData.date.toDate() : new Date(docData.date),
                        expiresAt: docData.expiresAt?.toDate ? docData.expiresAt.toDate() : (docData.expiresAt ? new Date(docData.expiresAt) : null)
                    };
                });

                data.sort((a, b) => {
                    const timeA = a.date instanceof Date ? a.date.getTime() : new Date(a.date).getTime();
                    const timeB = b.date instanceof Date ? b.date.getTime() : new Date(b.date).getTime();
                    return timeB - timeA;
                });
                setHistory(data);
            } catch (error) {
                console.error("Error fetching history:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchHistory();
    }, []);

    const formatDate = (dateInput: any) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    const handleDeleteHistoryItem = async (id: string) => {
        try {
            const user = auth.currentUser;
            if (!user) return;
            await deleteDoc(doc(db, 'users', user.uid, 'points_history', id));
            setHistory(prev => prev.filter(h => h.id !== id));
            setItemToDelete(null);
        } catch (error) {
            console.error("Error deleting history item", error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 pb-28">
            {/* Header - Fixed header with sticky top */}
            <div className="bg-white px-4 pt-4 pb-2 sticky top-0 z-20 shadow-sm border-b border-gray-100 transition-all">
                <div className="flex justify-between items-end mb-4">
                    <div className="flex flex-col">
                        <h1 className="text-2xl font-bold text-gray-800 leading-none">Tu Actividad</h1>
                        <p className="text-[10px] text-gray-400 font-medium mt-1 uppercase tracking-wider">Historial de movimientos y canjes</p>
                    </div>
                    <div className="bg-purple-100 px-3 py-1 rounded-full flex items-center gap-1 shadow-sm border border-purple-200/50">
                        <span className="text-[10px] font-bold text-purple-600 uppercase tracking-tight">Puntos:</span>
                        <span className="text-sm font-black text-purple-700">{userBalance}</span>
                    </div>
                </div>
            </div>

            {/* Timeline - Follows the scroll of the main container */}
            <div
                className="px-4 pb-4 space-y-3"
                style={{ paddingTop: `var(--pwa-padding-top, ${config.pwaPaddingTop ?? 32}px)` }}
            >
                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white h-20 rounded-2xl shadow-sm animate-pulse"></div>
                    ))
                ) : history.length === 0 ? (
                    <div className="text-center py-12">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <History className="text-gray-400" size={32} />
                        </div>
                        <h3 className="text-gray-600 font-bold mb-1">Sin actividad reciente</h3>
                        <p className="text-gray-400 text-sm px-6">Tus movimientos de puntos aparecerán aquí.</p>
                    </div>
                ) : (
                    history.map((item) => (
                        <SwipeableHistoryItem key={item.id} item={item} onDelete={(id) => setItemToDelete(id)} />
                    ))
                )}
            </div>

            {/* Confirmation Modal */}
            <ModernConfirmModal
                isOpen={!!itemToDelete}
                title="Ocultar Movimiento"
                message="¿Estás seguro que deseas ocultar este movimiento de tu historial?"
                onConfirm={() => itemToDelete && handleDeleteHistoryItem(itemToDelete)}
                onCancel={() => setItemToDelete(null)}
                confirmText="Sí, ocultar"
                type="warning"
            />
        </div>
    );
};

// Internal Swipe Component for History
const SwipeableHistoryItem = ({ item, onDelete }: { item: any, onDelete: (id: string) => void }) => {
    const isPositive = item.type === 'credit' || item.amount > 0;
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const startX = React.useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!startX.current) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        if (diff < 0) setOffsetX(diff);
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);
        if (offsetX < -100) {
            onDelete(item.id);
        } else {
            setOffsetX(0);
        }
        startX.current = 0;
    };

    const formatDate = (dateInput: any) => {
        if (!dateInput) return '';
        const date = new Date(dateInput);
        return new Intl.DateTimeFormat('es-AR', {
            day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit'
        }).format(date);
    };

    return (
        <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl">
                <History className="text-white" size={24} />
            </div>

            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                style={{ transform: `translateX(${offsetX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
                className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex items-center gap-4 relative"
            >
                {/* Icon Box */}
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-500'
                    }`}>
                    {isPositive ? <ArrowDownLeft size={24} /> : <ArrowUpRight size={24} />}
                </div>

                {/* Details */}
                <div className="flex-1 min-w-0">
                    <h4 className="font-bold text-gray-800 text-sm leading-tight mb-1">
                        {item.concept || (isPositive ? 'Carga de Puntos' : 'Canje de Premio')}
                    </h4>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                        <div className="flex items-center gap-1 text-[10px] text-gray-400 font-medium bg-gray-50 px-2 py-0.5 rounded-full">
                            <Calendar size={10} />
                            {formatDate(item.date)}
                        </div>
                        {/* Money Spent Display */}
                        {isPositive && item.moneySpent > 0 && (
                            <div className="flex items-center gap-1 text-[10px] text-green-600 font-bold bg-green-50 px-2 py-0.5 rounded-full border border-green-100">
                                <span>💵 ${item.moneySpent}</span>
                            </div>
                        )}
                        {/* Expiration Date Display */}
                        {isPositive && item.expiresAt && (
                            <div className="flex items-center gap-1 text-[10px] text-orange-600 font-bold bg-orange-50 px-2 py-0.5 rounded-full border border-orange-100">
                                <Clock size={10} />
                                <span>Vence: {new Date(item.expiresAt).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
                            </div>
                        )}
                    </div>
                </div>

                {/* Amount */}
                <div className={`font-black text-lg ${isPositive ? 'text-green-600' : 'text-gray-800'
                    }`}>
                    {isPositive ? '+' : ''}{item.amount}
                </div>
            </div>
        </div>
    );
};

