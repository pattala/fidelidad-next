import React, { useRef, useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';

interface Campaign {
  id: string;
  title: string;
  description: string;
  color: string;
  image?: string;
  buttonText: string;
}

const CAMPAIGNS: Campaign[] = [
  {
    id: '1',
    title: '¡Doble Puntaje!',
    description: 'En todas tus compras durante el fin de semana.',
    color: 'from-accent to-rose-400',
    buttonText: 'Ver Locales'
  },
  {
    id: '2',
    title: 'Mes del Amigo',
    description: 'Refiere a un amigo y ambos ganan 500 Puntos Extra.',
    color: 'from-secondary to-blue-400',
    buttonText: 'Invitar Amigos'
  },
  {
    id: '3',
    title: 'Sorteo Exclusivo',
    description: 'Participa por un viaje canjeando sólo 50 Puntos.',
    color: 'from-primary to-teal-400',
    buttonText: 'Participar'
  }
];

export const CampaignCarousel: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(0);

  useEffect(() => {
    if (containerRef.current) {
      setWidth(containerRef.current.scrollWidth - containerRef.current.offsetWidth);
    }
  }, []);

  return (
    <div className="w-full overflow-hidden" ref={containerRef}>
      <motion.div 
        drag="x" 
        dragConstraints={{ right: 0, left: -width }}
        dragElastic={0.2}
        className="flex gap-4 px-6 pb-4"
        style={{ cursor: 'grab' }}
      >
        {CAMPAIGNS.map((campaign) => (
          <motion.div 
            key={campaign.id}
            whileTap={{ scale: 0.95 }}
            className={`min-w-[280px] sm:min-w-[300px] h-40 rounded-[28px] bg-gradient-to-br ${campaign.color} p-5 text-white shadow-lg relative overflow-hidden flex flex-col justify-between`}
          >
            {/* Background Decoration */}
            <div className="absolute top-[-20px] right-[-20px] w-24 h-24 bg-white/20 rounded-full blur-xl" />
            
            <div className="relative z-10">
              <h3 className="text-xl font-black mb-1">{campaign.title}</h3>
              <p className="text-sm text-white/90 leading-tight font-medium w-4/5">
                {campaign.description}
              </p>
            </div>
            
            <div className="relative z-10 flex items-center gap-1 font-bold text-sm bg-white/20 w-fit px-3 py-1.5 rounded-full backdrop-blur-sm mt-2">
              {campaign.buttonText}
              <ChevronRight size={16} />
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  );
};
