import { useEffect, useState } from 'react';
import { type BonusRule } from '../../../services/campaignService';
import { Megaphone } from 'lucide-react';
import { CampaignActionModal } from './CampaignActionModal';

interface CampaignCarouselProps {
    campaigns?: BonusRule[];
    loading?: boolean;
}

export const CampaignCarousel = ({ campaigns: propCampaigns, loading: propLoading }: CampaignCarouselProps) => {
    const [internalCampaigns, setInternalCampaigns] = useState<BonusRule[]>([]);
    const [internalLoading, setInternalLoading] = useState(true);
    const [currentIndex, setCurrentIndex] = useState(0);

    const [selectedCampaign, setSelectedCampaign] = useState<BonusRule | null>(null);

    const isLoading = propLoading !== undefined ? propLoading : internalLoading;
    const allCampaigns = propCampaigns !== undefined ? propCampaigns : internalCampaigns;

    useEffect(() => {
        if (propCampaigns !== undefined) return;

        const fetchCampaigns = async () => {
            try {
                const { CampaignService } = await import('../../../services/campaignService');
                const fetchedCampaigns = await CampaignService.getActiveBonusesForToday();
                const validCampaigns = fetchedCampaigns.filter(c => c.showInCarousel && !c.isFlash);
                setInternalCampaigns(validCampaigns);
            } catch (error) {
                console.error('Error fetching campaigns:', error);
            } finally {
                setInternalLoading(false);
            }
        };

        fetchCampaigns();
    }, [propCampaigns]);

    // Real-time Expiration Logic
    const [now, setNow] = useState(new Date());

    useEffect(() => {
        const interval = setInterval(() => setNow(new Date()), 10000); // Check every 10s
        return () => clearInterval(interval);
    }, []);

    const visibleCampaigns = allCampaigns.filter(camp => {
        const curHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        // Flash timing check
        if (camp.isFlash) {
            if (camp.startTime && curHHmm < camp.startTime) return false;
            if (camp.endTime && curHHmm >= camp.endTime) return false;
        } else {
            // Regular campaign duration checks
            const todayStr = now.toLocaleDateString('en-CA');
            if (camp.endDate === todayStr && camp.endTime && camp.endTime < curHHmm) return false;
            if (!camp.endDate && camp.endTime && camp.endTime < curHHmm) return false;
        }

        return true;
    });

    // Auto-scroll logic
    useEffect(() => {
        if (visibleCampaigns.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIndex(prev => (prev + 1) % visibleCampaigns.length);
        }, 6000);
        return () => clearInterval(interval);
    }, [visibleCampaigns.length]);

    const [touchStart, setTouchStart] = useState<number | null>(null);
    const [touchEnd, setTouchEnd] = useState<number | null>(null);
    const minSwipeDistance = 50;

    const onTouchStart = (e: React.TouchEvent | React.MouseEvent) => {
        setTouchEnd(null);
        setTouchStart('targetTouches' in e ? e.targetTouches[0].clientX : e.clientX);
    };

    const onTouchMove = (e: React.TouchEvent | React.MouseEvent) => {
        setTouchEnd('targetTouches' in e ? e.targetTouches[0].clientX : e.clientX);
    };

    const onTouchEnd = () => {
        if (!touchStart || !touchEnd) return;
        const distance = touchStart - touchEnd;
        const isLeftSwipe = distance > minSwipeDistance;
        const isRightSwipe = distance < -minSwipeDistance;

        if (isLeftSwipe) {
            setCurrentIndex(prev => (prev + 1) % visibleCampaigns.length);
        } else if (isRightSwipe) {
            setCurrentIndex(prev => (prev - 1 + visibleCampaigns.length) % visibleCampaigns.length);
        }
    };

    if (isLoading) return <div className="h-40 bg-gray-100 animate-pulse rounded-2xl mx-4 mb-6"></div>;

    if (visibleCampaigns.length === 0) {
        return (
            <div className="relative mb-6 mx-0">
                <div className="flex justify-between items-center mb-4 px-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Destacados</h3>
                </div>
                <div className="relative overflow-hidden rounded-[2.5rem] shadow-sm h-48 border border-gray-100 bg-gradient-to-br from-[#4a148c] to-[#7b1fa2] flex items-center justify-center text-center p-8">
                    <div className="relative z-10">
                        <div className="bg-white/20 w-16 h-16 rounded-3xl backdrop-blur-md flex items-center justify-center mx-auto mb-4 animate-pulse">
                            <Megaphone className="text-white" size={30} />
                        </div>
                        <h3 className="font-black text-2xl uppercase tracking-tight text-white mb-1">¡Bienvenido!</h3>
                        <p className="text-white/80 text-xs font-bold uppercase tracking-wider">Pronto verás novedades y premios aquí.</p>
                    </div>
                </div>
            </div>
        );
    }

    const gradients = [
        'bg-gradient-to-br from-pink-500 to-rose-500',
        'bg-gradient-to-br from-purple-600 to-indigo-600',
        'bg-gradient-to-br from-blue-400 to-cyan-500',
        'bg-gradient-to-br from-orange-400 to-red-500'
    ];

    return (
        <div className="relative mb-6 mx-0 group">
            <div className="flex justify-between items-center mb-4 px-2">
                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Destacados</h3>
            </div>

            <div
                className="relative overflow-hidden rounded-[2.5rem] shadow-sm h-48 transition-all duration-500 border border-gray-100 bg-gray-50 cursor-grab active:cursor-grabbing"
                onTouchStart={onTouchStart}
                onTouchMove={onTouchMove}
                onTouchEnd={onTouchEnd}
                onMouseDown={onTouchStart}
                onMouseMove={(e) => touchStart && onTouchMove(e)}
                onMouseUp={onTouchEnd}
                onMouseLeave={() => touchStart && onTouchEnd()}
            >
                <div
                    className="flex transition-transform duration-700 ease-in-out h-full w-full"
                    style={{ transform: `translateX(-${currentIndex * 100}%)` }}
                >
                    {visibleCampaigns.map((camp) => {
                        const hasImg = !!camp.imageUrl && camp.imageUrl.trim() !== '';
                        const gradientBg = gradients[camp.id.charCodeAt(0) % gradients.length];
                        const customStyle = {
                            backgroundColor: camp.backgroundColor || '',
                            color: camp.textColor || '#FFFFFF',
                            fontWeight: (camp.fontWeight === 'black' ? '900' : camp.fontWeight) || 'normal'
                        };
                        const bgClass = camp.backgroundColor ? '' : (hasImg ? 'bg-white' : gradientBg);

                        const imgFitClass = camp.imageFit === 'cover' ? 'object-cover' : 'object-contain';
                        const fontClass = camp.fontStyle === 'serif' ? 'font-serif' : camp.fontStyle === 'mono' ? 'font-mono' : 'font-sans';

                        let textPosClass = 'items-end justify-start';
                        if (camp.textPosition === 'bottom-center') textPosClass = 'items-end justify-center text-center';
                        if (camp.textPosition === 'bottom-right') textPosClass = 'items-end justify-end text-right';
                        if (camp.textPosition === 'center') textPosClass = 'items-center justify-center text-center';
                        if (camp.textPosition === 'top-left') textPosClass = 'items-start justify-start';
                        if (camp.textPosition === 'top-center') textPosClass = 'items-start justify-center text-center';
                        if (camp.textPosition === 'top-right') textPosClass = 'items-start justify-end text-right';

                        const titleClasses: Record<string, string> = {
                            'sm': 'text-sm', 'base': 'text-base', 'lg': 'text-lg', 'xl': 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl', '4xl': 'text-4xl'
                        };
                        const descClasses: Record<string, string> = {
                            'xs': 'text-xs', 'sm': 'text-sm', 'base': 'text-base', 'lg': 'text-lg', 'xl': 'text-xl'
                        };

                        return (
                            <div
                                key={camp.id}
                                className={`min-w-full h-full relative flex ${textPosClass} ${bgClass} cursor-pointer pointer-events-auto`}
                                style={customStyle}
                                onClick={() => {
                                    if (camp.actionUrl) {
                                        setSelectedCampaign(camp);
                                    }
                                }}
                            >
                                {hasImg && (
                                    <>
                                        <img
                                            src={camp.imageUrl}
                                            alt={camp.name}
                                            className={`absolute inset-0 w-full h-full ${imgFitClass}`}
                                            style={{ opacity: (camp.imageOpacity !== undefined ? camp.imageOpacity : 60) / 100 }}
                                        />
                                        <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                                    </>
                                )}

                                <div className={`relative z-10 p-8 ${fontClass} w-full`}>
                                    {camp.showTitle !== false && (
                                        <h3 className={`leading-[1.1] mb-1 uppercase tracking-tight drop-shadow-md ${titleClasses[camp.titleSize || '2xl'] || 'text-2xl'}`}>
                                            {camp.title || camp.name}
                                        </h3>
                                    )}
                                    {camp.showDescription !== false && camp.description && (
                                        <p className={`opacity-90 leading-snug whitespace-pre-wrap drop-shadow-sm line-clamp-4 ${descClasses[camp.descriptionSize || 'sm'] || 'text-sm'}`}>
                                            {camp.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {visibleCampaigns.length > 1 && (
                <div className="flex justify-center gap-2 mt-4">
                    {visibleCampaigns.map((_, idx) => (
                        <button
                            key={idx}
                            onClick={() => setCurrentIndex(idx)}
                            className={`h-1 rounded-full transition-all duration-300 ${idx === currentIndex ? 'bg-[#4a148c] w-8' : 'bg-gray-200 w-3 hover:bg-gray-300'}`}
                        />
                    ))}
                </div>
            )}

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
        </div>
    );
};
