import { useEffect, useState } from 'react';
import { type BonusRule } from '../../../services/campaignService';
import { ChevronRight } from 'lucide-react';
import { CampaignActionModal } from './CampaignActionModal';

interface MiniCampaignCarouselProps {
    campaigns?: BonusRule[];
    loading?: boolean;
}

export const MiniCampaignCarousel = ({ campaigns: propCampaigns, loading: propLoading }: MiniCampaignCarouselProps) => {
    const [internalCampaigns, setInternalCampaigns] = useState<BonusRule[]>([]);
    const [internalLoading, setInternalLoading] = useState(true);
    const [selectedCampaign, setSelectedCampaign] = useState<BonusRule | null>(null);

    const campaigns = propCampaigns !== undefined ? propCampaigns : internalCampaigns;
    const loading = propLoading !== undefined ? propLoading : internalLoading;

    useEffect(() => {
        if (propCampaigns !== undefined) return;
        const fetchCampaigns = async () => {
            try {
                const { CampaignService } = await import('../../../services/campaignService');
                const fetched = await CampaignService.getActiveBonusesForToday();
                setInternalCampaigns(fetched.filter(c => c.active));
            } catch (error) {
                console.error(error);
            } finally {
                setInternalLoading(false);
            }
        };
        fetchCampaigns();
    }, [propCampaigns]);

    if (loading || campaigns.length === 0) return null;

    return (
        <section className="animate-in-up" style={{ animationDelay: '150ms' }}>
            <div className="flex justify-between items-center mb-4 px-1">
                <h3 className="text-md font-black text-purple-950 uppercase tracking-tight">Promos vigentes</h3>
                <span className="text-[10px] font-black uppercase tracking-widest text-purple-600">Swipe ›</span>
            </div>

            <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide snap-x">
                {campaigns.map((camp) => (
                    <div
                        key={camp.id}
                        className="min-w-[280px] h-40 relative rounded-[2rem] overflow-hidden shadow-lg border border-white/20 snap-center glass-dark cursor-pointer"
                        onClick={() => {
                            if (camp.actionUrl) {
                                setSelectedCampaign(camp);
                            }
                        }}
                    >
                        {camp.imageUrl && (
                            <>
                                <img src={camp.imageUrl} alt={camp.name} className="absolute inset-0 w-full h-full object-cover opacity-40" />
                                <div className="absolute inset-0 bg-gradient-to-t from-purple-950 via-purple-900/20 to-transparent"></div>
                            </>
                        )}
                        <div className="relative z-10 p-5 h-full flex flex-col justify-end">
                            <h4 className="font-black text-white text-lg uppercase leading-none mb-1 drop-shadow-md">{camp.name}</h4>
                            <p className="text-[10px] text-white/70 font-bold uppercase tracking-wider line-clamp-1">{camp.description}</p>
                            <div className="mt-3 flex items-center text-[9px] font-black uppercase tracking-widest text-yellow-400">
                                {camp.actionText || 'Ver detalles'} <ChevronRight size={10} className="ml-1" />
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {selectedCampaign && (
                <CampaignActionModal
                    isOpen={!!selectedCampaign}
                    onClose={() => setSelectedCampaign(null)}
                    title={selectedCampaign.title || selectedCampaign.name}
                    description={selectedCampaign.description}
                    actionUrl={selectedCampaign.actionUrl}
                    actionText={selectedCampaign.actionText}
                />
            )}
        </section>
    );
};
