import { useEffect, useState } from 'react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { CampaignService, type BonusRule } from '../../../services/campaignService';
import { Calendar, Tag, Clock, ChevronLeft, Sparkles } from 'lucide-react';
import toast from 'react-hot-toast';
import type { AppConfig } from '../../../types';

export const ClientPromosPage = () => {
    const { config, setHeaderTitle } = useOutletContext<{
        config: AppConfig,
        setHeaderTitle: (title: string | null) => void
    }>();
    const [campaigns, setCampaigns] = useState<BonusRule[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    // Set Header State
    useEffect(() => {
        setHeaderTitle('Promociones');

        return () => {
            setHeaderTitle(null);
        };
    }, [setHeaderTitle]);

    useEffect(() => {
        const loadPromos = async () => {
            try {
                // Fetch ALL active campaigns in date range
                const data = await CampaignService.getActiveCampaignsInDateRange();
                setCampaigns(data);
            } catch (error) {
                console.error("Error loading all promos", error);
                toast.error("Error al cargar promociones");
            } finally {
                setLoading(false);
            }
        };
        loadPromos();
    }, []);

    const getDayLabel = (days: number[]) => {
        if (!days || days.length === 0 || days.length === 7) return "Todos los días";
        const map = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
        return days.map(d => map[d]).join(", ");
    };

    return (
        <div className="bg-white font-sans pb-28 animate-fade-in">

            {/* List - Follows scroll */}
            <div
                className="px-4 pb-4 space-y-3 transition-all"
            >
                {loading ? (
                    <div className="space-y-4 animate-pulse">
                        <div className="h-32 bg-gray-200 rounded-2xl w-full"></div>
                        <div className="h-32 bg-gray-200 rounded-2xl w-full"></div>
                    </div>
                ) : campaigns.length === 0 ? (
                    <div className="text-center py-10 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Tag className="mx-auto text-gray-300 mb-2" size={32} />
                        <p className="text-sm font-bold text-gray-400">No hay promociones vigentes.</p>
                    </div>
                ) : (
                    campaigns.map(camp => (
                        <div key={camp.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden flex flex-col relative group active:scale-[0.99] transition">
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
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};
