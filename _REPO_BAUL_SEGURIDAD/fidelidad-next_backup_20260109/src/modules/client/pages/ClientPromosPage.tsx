import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CampaignService, type BonusRule } from '../../../services/campaignService';
import { Calendar, ArrowLeft, Tag, Clock } from 'lucide-react';
import toast from 'react-hot-toast';

export const ClientPromosPage = () => {
    const [campaigns, setCampaigns] = useState<BonusRule[]>([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

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
        <div className="min-h-screen bg-gray-50 pb-20 font-sans">
            {/* Header */}
            <div className="bg-white px-4 pt-6 pb-4 shadow-sm sticky top-0 z-20">
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => navigate(-1)}
                        className="w-8 h-8 flex items-center justify-center bg-gray-50 rounded-full text-gray-600 active:scale-90 transition"
                    >
                        <ArrowLeft size={18} />
                    </button>
                    <h1 className="text-lg font-black uppercase tracking-tight text-[#4a148c]">Todas las Promos</h1>
                </div>
            </div>

            {/* List */}
            <div className="p-4 space-y-4">
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
                                    <span className="bg-green-50 text-green-700 border border-green-100 px-2 py-1 rounded-lg text-[10px] font-bold uppercase flex items-center gap-1">
                                        <Clock size={10} />
                                        {getDayLabel(camp.daysOfWeek)}
                                    </span>
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
