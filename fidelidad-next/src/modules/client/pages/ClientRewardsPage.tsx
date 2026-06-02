import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { Gift, Lock, CheckCircle, Search, Filter, Clock } from 'lucide-react';
import { useOutletContext } from 'react-router-dom';
import { useClientAuth } from '../contexts/ClientAuthContext';
import type { AppConfig } from '../../../types';
import { TimeService } from '../../../services/timeService';


export const ClientRewardsPage = () => {
    const { config, setHeaderTitle, setHeaderActions } = useOutletContext<{
        config: AppConfig,
        setHeaderTitle: (title: string | null) => void,
        setHeaderActions: (actions: React.ReactNode | null) => void
    }>();
    const { user, userData } = useClientAuth();
    const [prizes, setPrizes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const userPoints = Number(userData?.points) || 0;

    // Set Header State
    useEffect(() => {
        setHeaderTitle('Premios');

        const actions = (
            <div className="bg-purple-50 px-3 py-2 rounded-2xl flex items-center gap-1.5 border border-purple-100 shadow-sm">
                <span className="text-[10px] font-black text-purple-400 uppercase tracking-tighter">Puntos:</span>
                <span className="text-sm font-black text-purple-700">{userPoints}</span>
            </div>
        );

        setHeaderActions(actions);

        return () => {
            setHeaderTitle(null);
            setHeaderActions(null);
        };
    }, [userPoints, setHeaderTitle, setHeaderActions]);

    useEffect(() => {
        // 1. Fetch Prizes
        const fetchPrizes = async () => {
            try {
                const q = query(
                    collection(db, 'prizes'),
                    where('active', '==', true)
                );
                const snap = await getDocs(q);
                const data = snap.docs
                    .map(d => ({ id: d.id, ...d.data() as any }))
                    .filter(p => {
                        // 1. Stock check
                        if (p.stock <= 0) return false;
                        // 2. Expiration check
                        if (p.expirationDate) {
                            if (TimeService.isExpired(p.expirationDate)) return false;
                        }
                        // 3. Test Mode check
                        if (p.isInternal && !userData?.isTestUser) return false;
                        return true;
                    });
                setPrizes(data);
            } catch (error) {
                console.error("Error fetching prizes", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrizes();
    }, []);

    return (
        <div className="bg-gray-50 pb-28 animate-fade-in">

            <div
                className="px-4 pt-6 pb-4 grid grid-cols-1 gap-6 transition-all"
            >
                {loading ? (
                    [...Array(4)].map((_, i) => (
                        <div key={i} className="bg-white h-60 rounded-3xl shadow-sm animate-pulse"></div>
                    ))
                ) : prizes.length === 0 ? (
                    <div className="col-span-2 text-center py-10 text-gray-400">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-3">
                            <Gift size={32} />
                        </div>
                        <p>No hay premios disponibles por ahora.</p>
                    </div>
                ) : (
                    prizes.map(prize => {
                        // FIX: Use correct field 'pointsRequired' from PrizeService
                        const cost = Number(prize.pointsRequired) || 0;
                        const canRedeem = userPoints >= cost;
                        const progress = cost > 0 ? Math.min((userPoints / cost) * 100, 100) : 0;

                        return (
                            <div
                                key={prize.id}
                                className={`bg-white rounded-3xl shadow-sm overflow-hidden flex flex-col group relative transition-all duration-300 ${canRedeem
                                    ? 'border-2 border-purple-500 shadow-md shadow-purple-200/50 scale-[1.02]'
                                    : 'border border-gray-100 opacity-90'
                                    }`}
                            >
                                {/* Image Area */}
                                <div className="h-48 bg-gray-100 relative overflow-hidden">
                                    {/* Glowing Backdrop if canRedeem */}
                                    {canRedeem && <div className="absolute inset-0 bg-purple-600/10 z-0"></div>}

                                    {prize.imageUrl ? (
                                        <img src={prize.imageUrl} alt={prize.name} className="w-full h-full object-cover relative z-10 group-hover:scale-110 transition-transform duration-700" />
                                    ) : (
                                        <div className="w-full h-full flex items-center justify-center bg-purple-50 relative z-10">
                                            <Gift className="text-purple-300" size={32} />
                                        </div>
                                    )}
                                    {/* Cost Badge */}
                                    <div className={`absolute top-2 right-2 backdrop-blur-md px-2 py-0.5 rounded-lg text-xs font-bold z-20 ${canRedeem ? 'bg-purple-600 text-white shadow-lg' : 'bg-black/60 text-white'
                                        }`}>
                                        {cost} pts
                                    </div>

                                    {/* "Available" Tag */}
                                    {canRedeem && (
                                        <div className="absolute bottom-2 left-2 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-md shadow-sm z-20 flex items-center gap-1">
                                            <CheckCircle size={10} />
                                            ¡DISPONIBLE!
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-5 flex-1 flex flex-col">
                                    <div className="flex justify-between items-start gap-4 mb-2">
                                        <div className="flex-1">
                                            <h3 className="font-black text-gray-800 text-lg leading-tight uppercase tracking-tight">{prize.name}</h3>
                                            <p className="text-[10px] text-purple-600 font-black uppercase tracking-widest mt-1 opacity-70">{prize.category || 'General'}</p>
                                        </div>
                                    </div>

                                    {prize.description && (
                                        <p className="text-sm text-gray-500 font-medium mb-4 leading-relaxed bg-gray-50/50 p-3 rounded-2xl border border-gray-100/50">
                                            {prize.description}
                                        </p>
                                    )}

                                    <div className="flex flex-wrap gap-2 mb-5">
                                        <span className="bg-gray-100 text-gray-600 text-[10px] font-black px-3 py-1 rounded-full uppercase tracking-tighter">
                                            Disponibles: {prize.stock} unidades
                                        </span>
                                        {prize.expirationDate && (
                                            <span className="bg-amber-50 text-amber-600 text-[10px] font-black px-3 py-1 rounded-full border border-amber-100 flex items-center gap-1.5 uppercase tracking-tighter">
                                                <Clock size={12} /> Canjeá hasta: {TimeService.formatDisplayDate(prize.expirationDate)}
                                            </span>
                                        )}
                                        {prize.requiresMinimumPurchase && (
                                            <span className="bg-orange-50 text-orange-700 text-[10px] font-black px-3 py-1 rounded-full border border-orange-200 flex items-center gap-1.5 uppercase tracking-tighter">
                                                <Search size={12} /> Compra Min. para Canje: ${prize.minimumPurchaseAmount?.toLocaleString('es-AR')}
                                            </span>
                                        )}
                                    </div>

                                    <div className="mt-auto">
                                        {canRedeem ? (
                                            <div className="w-full bg-green-50 text-green-700 border border-green-200 py-2 rounded-xl text-[10px] font-bold text-center flex items-center justify-center gap-1">
                                                <CheckCircle size={12} />
                                                YA TENÉS LOS PUNTOS
                                            </div>
                                        ) : (
                                            <div>
                                                <div className="flex justify-between items-end mb-1">
                                                    <span className="text-[10px] text-gray-400 font-bold">Faltan {cost - userPoints}</span>
                                                    <Lock size={12} className="text-gray-300" />
                                                </div>
                                                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-gray-300 rounded-full"
                                                        style={{ width: `${progress}%` }}
                                                    ></div>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </div>
    );
};
