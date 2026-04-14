import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CampaignService, type BonusRule } from '../../../services/campaignService';
import { Calendar, Tag, Clock, ChevronLeft, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppConfig } from '../../../types';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { CampaignActionModal } from '../components/CampaignActionModal';
import { TimeService } from '../../../services/timeService';

export const ClientPromosPage = () => {
    const { config, setHeaderTitle } = useOutletContext<{
        config: AppConfig,
        setHeaderTitle: (title: string | null) => void
    }>();
    const { userData } = useClientAuth();
    const [campaigns, setCampaigns] = useState<BonusRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedPromo, setSelectedPromo] = useState<BonusRule | null>(null);
    const navigate = useNavigate();

    // Set Header State
    useEffect(() => {
        setHeaderTitle('Promociones');

        return () => {
            setHeaderTitle(null);
        };
    }, [setHeaderTitle]);

    useEffect(() => {
        // Suscripción en tiempo real a campañas
        const q = query(collection(db, 'campanas'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data() as any
            })) as BonusRule[];

            // Filtrado básico por fecha (mantenemos lógica de Catalogo completo)
            const todayStr = new Date().toLocaleDateString('en-CA'); // YYYY-MM-DD local

            const activeInRange = fetched.filter(b => {
                if (!b.active) return false;
                if (b.startDate && b.startDate > todayStr) return false;
                if (b.endDate && b.endDate < todayStr) return false;

                // Test Mode check
                if (b.isInternal && !userData?.isTestUser) return false;

                return true;
            });

            setCampaigns(activeInRange);
            setLoading(false);
        }, (error) => {
            console.error("Error loading all promos", error);
            toast.error("Error al cargar promociones");
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    // Real-time Expiration Logic
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    const visibleCampaigns = campaigns.filter(camp => {
        if (!camp.endTime) return true;
        // Check if today is the end date (or if it's a recurrent daily limit, effectively handled by service)
        // Simple check: if it has endTime, and we are past it, hide it?
        // Note: activeCampaignsInDateRange might return promos for whole week.
        // We only care about hiding "Flash" promos that just expired TODAY.

        const curHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
        const todayStr = now.toLocaleDateString('en-CA'); // YYYY-MM-DD

        // If specific date range, and today is endDate
        if (camp.endDate === todayStr && camp.endTime < curHHmm) return false;

        // If it's a recurring daily thing (no startDate/endDate but active), check time
        // But usually Flash has dates. Assuming safely:
        if (camp.endTime < curHHmm && (!camp.endDate || camp.endDate === todayStr)) return false;

        return true;
    });

    const getDayLabel = (days: number[]) => {
        if (!days || days.length === 0 || days.length === 7) return "Todos los días";
        const map = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        return days.map(d => map[d]).join(", ");
    };

    return (
        <div className="bg-white font-sans pb-28 animate-fade-in">

            {/* List - Follows scroll */}
            <div
                className="px-4 pt-6 pb-4 space-y-3 transition-all"
            >
                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-32 bg-gray-200 rounded-2xl w-full"></div>
                        <div className="h-32 bg-gray-200 rounded-2xl w-full"></div>
                    </div>
                ) : visibleCampaigns.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Tag className="mx-auto text-gray-300 mb-2" size={32} />
                        <p className="text-sm font-bold text-gray-400">No hay promociones vigentes.</p>
                    </div>
                ) : (
                    visibleCampaigns.map(camp => (
                        <div
                            key={camp.id}
                            className={`bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col relative group transition ${camp.actionUrl || camp.link ? 'cursor-pointer active:scale-[0.99]' : ''}`}
                            onClick={() => {
                                if (camp.actionUrl || camp.link) {
                                    setSelectedPromo(camp);
                                } else {
                                    toast('Solo informativo... consultanos en el local!', {
                                        icon: '📢',
                                        style: {
                                            borderRadius: '10px',
                                            background: '#333',
                                            color: '#fff',
                                        },
                                    });
                                }
                            }}
                        >
                            {/* Optional Image */}
                            {camp.imageUrl && (
                                <div className="h-32 w-full bg-gray-100 relative overflow-hidden">
                                    <img src={camp.imageUrl} className="w-full h-full object-cover" alt={camp.name} />
                                    <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"></div>
                                </div>
                            )}

                            <div className="p-4 relative">
                                {!camp.imageUrl && (
                                    <div className="absolute top-4 right-4 bg-purple-50 text-purple-600 p-2 rounded-xl">
                                        <Tag size={20} />
                                    </div>
                                )}

                                <h3 className="text-base font-black uppercase text-gray-800 leading-tight mb-1 pr-10">
                                    {camp.showTitle !== false ? (camp.title || camp.name) : (camp.title || camp.name)}
                                </h3>
                                {camp.description && (
                                    <p className="text-xs font-medium text-gray-500 mb-3 whitespace-pre-wrap leading-relaxed">
                                        {camp.description}
                                    </p>
                                )}

                                {/* Validity Badges */}
                                <div className="flex flex-wrap gap-2 mt-2">
                                    {(() => {
                                        if (!camp.startTime && !camp.endTime) return null;
                                        const now = new Date();
                                        const curHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                        const isUpcoming = camp.startTime && camp.startTime > curHHmm;
                                        const isExpiredToday = camp.endTime && camp.endTime < curHHmm;
                                        const isActiveNow = !isUpcoming && !isExpiredToday;

                                        if (isActiveNow) {
                                            return (
                                                <span className="bg-red-500 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1 animate-pulse shadow-sm shadow-red-200">
                                                    <Sparkles size={10} />
                                                    ¡ACTIVA AHORA!
                                                </span>
                                            );
                                        }
                                        if (isUpcoming) {
                                            return (
                                                <span className="bg-blue-600 text-white px-2 py-1 rounded-lg text-[10px] font-black uppercase flex items-center gap-1">
                                                    <Clock size={10} />
                                                    Próximamente: {camp.startTime} hs
                                                </span>
                                            );
                                        }
                                        return null;
                                    })()}

                                    <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Clock size={10} />
                                        {getDayLabel(camp.daysOfWeek)}
                                    </span>

                                    {(camp.startTime || camp.endTime) && (
                                        <span className="bg-purple-50 text-purple-700 border border-purple-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1">
                                            ⏰ {camp.startTime || '00:00'} a {camp.endTime || '23:59'} hs
                                        </span>
                                    )}

                                    {camp.rewardType === 'MULTIPLIER' && (
                                        <span className="bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">
                                            x{camp.rewardValue} Puntos
                                        </span>
                                    )}
                                    {camp.rewardType === 'FIXED' && (
                                        <span className="bg-yellow-50 text-yellow-700 border border-yellow-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase">
                                            +{camp.rewardValue} Puntos
                                        </span>
                                    )}
                                    {camp.endDate && (
                                        <span className="bg-amber-50 text-amber-600 border border-amber-100 px-2 py-1 rounded-full text-[10px] font-bold uppercase flex items-center gap-1">
                                            <Clock size={10} /> Vence: {TimeService.formatDisplayDate(camp.endDate)}
                                        </span>
                                    )}
                                </div>

                                {/* Action Button */}
                                <div className="mt-4 pt-4 border-t border-gray-50 flex justify-end">
                                    <button
                                        className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${camp.actionUrl || camp.link
                                            ? 'bg-purple-600 text-white shadow-lg shadow-purple-100'
                                            : 'bg-gray-50 text-gray-400 border border-gray-100'
                                            }`}
                                    >
                                        {camp.buttonText || (camp.actionUrl || camp.link ? 'Ver detalles' : 'Más info')}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {selectedPromo && (
                <CampaignActionModal
                    isOpen={!!selectedPromo}
                    onClose={() => setSelectedPromo(null)}
                    title={selectedPromo.title || selectedPromo.name}
                    description={selectedPromo.description}
                    actionUrl={selectedPromo.actionUrl || selectedPromo.link}
                    actionText={selectedPromo.actionText || selectedPromo.buttonText}
                />
            )}
        </div>
    );
};
