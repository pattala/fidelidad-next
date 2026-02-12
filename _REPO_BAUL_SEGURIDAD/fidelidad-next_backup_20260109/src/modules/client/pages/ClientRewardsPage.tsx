import React, { useEffect, useState } from 'react';
import { db, auth } from '../../../lib/firebase';
import { collection, query, where, getDocs, doc, onSnapshot } from 'firebase/firestore';
import { Gift, Lock, CheckCircle, Search, Filter } from 'lucide-react';


export const ClientRewardsPage = () => {
    const [prizes, setPrizes] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [userPoints, setUserPoints] = useState(0);

    useEffect(() => {
        // 1. Listen to User Points
        const unsubAuth = auth.onAuthStateChanged(user => {
            if (user) {
                const unsubDb = onSnapshot(doc(db, 'users', user.uid), (doc) => {
                    const data = doc.data();
                    // Ensure points is a number
                    const pts = Number(data?.points);
                    setUserPoints(!isNaN(pts) ? pts : 0);
                });
                return () => unsubDb();
            } else {
                setUserPoints(0);
            }
        });

        // 2. Fetch Prizes
        const fetchPrizes = async () => {
            try {
                // We can use PrizeService or direct query depending on if we want 'active' only logic
                const q = query(
                    collection(db, 'prizes'),
                    where('active', '==', true),
                    where('stock', '>', 0)
                );
                const snap = await getDocs(q);
                const data = snap.docs.map(d => ({ id: d.id, ...d.data() }));
                setPrizes(data);
            } catch (error) {
                console.error("Error fetching prizes", error);
            } finally {
                setLoading(false);
            }
        };

        fetchPrizes();
        return () => unsubAuth();
    }, []);

    return (
        <div className="min-h-screen bg-gray-50 pb-24">

            {/* Header */}
            <div className="bg-white px-6 pt-8 pb-4 sticky top-0 z-20 shadow-sm border-b border-gray-100">
                <div className="flex justify-between items-center mb-4">
                    <h1 className="text-2xl font-bold text-gray-800">Premios</h1>
                    <div className="bg-purple-100 px-3 py-1 rounded-full flex items-center gap-1 shadow-sm border border-purple-200/50">
                        <span className="text-xs font-bold text-purple-600">Mis Puntos:</span>
                        <span className="text-sm font-black text-purple-700">{userPoints}</span>
                    </div>
                </div>

                {/* Search / Filter */}
                <div className="flex gap-2">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-2.5 text-gray-400" size={18} />
                        <input
                            type="text"
                            placeholder="Buscar premios..."
                            className="w-full bg-gray-100 pl-10 pr-4 py-2 rounded-xl text-sm border-none focus:ring-2 focus:ring-purple-200 outline-none transition"
                        />
                    </div>
                    <button className="bg-gray-100 p-2 rounded-xl text-gray-500 hover:bg-gray-200 transition">
                        <Filter size={20} />
                    </button>
                </div>
            </div>

            {/* Catalog Grid */}
            <div className="p-4 grid grid-cols-2 gap-4">
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
                                <div className="h-32 bg-gray-100 relative overflow-hidden">
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
                                <div className="p-4 flex-1 flex flex-col">
                                    <h3 className="font-bold text-gray-800 text-sm leading-tight mb-1 line-clamp-2">{prize.name}</h3>
                                    <p className="text-[10px] text-gray-400 mb-3">{prize.category || 'General'}</p>

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
