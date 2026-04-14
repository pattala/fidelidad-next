import { useState, useEffect } from 'react';
import { X, Gift, CheckCircle } from 'lucide-react';
import { PrizeService } from '../../../services/prizeService';
import type { Prize } from '../../../types';
import { collection, addDoc, updateDoc, doc, increment, arrayUnion, query, where, orderBy, getDocs, writeBatch, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { NotificationService } from '../../../services/notificationService';
import { TimeService } from '../../../services/timeService';
import { ExpirationService } from '../../../services/expirationService';
import toast from 'react-hot-toast';

interface RedemptionModalProps {
    client: any; // Se puede mejorar la interfaz Client
    onClose: () => void;
    onRedeemSuccess: () => void;
}

export const RedemptionModal = ({ client, onClose, onRedeemSuccess }: RedemptionModalProps) => {
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [selectedPrize, setSelectedPrize] = useState<Prize | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const loadPrizes = async () => {
            const allPrizes = await PrizeService.getActive();
            // Filtrar disponibilidad básica (los que alcanzan y tienen stock)
            // Se puede mostrar todos y deshabilitar los que no alcanzan para "incentivar"
            setPrizes(allPrizes);
        };
        loadPrizes();
    }, []);

    const handleRedeem = async () => {
        if (!selectedPrize) return;
        if (client.points < selectedPrize.pointsRequired) {
            toast.error("Puntos insuficientes");
            return;
        }
        if (selectedPrize.stock <= 0) {
            toast.error("No hay stock disponible");
            return;
        }

        // Expiration check
        if (selectedPrize.expirationDate) {
            if (TimeService.isExpired(selectedPrize.expirationDate)) {
                toast.error("El premio ha vencido");
                return;
            }
        }

        if (!confirm(`¿Confirmar canje de ${selectedPrize.name} por ${selectedPrize.pointsRequired} pts?`)) return;

        setLoading(true);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/redeem-prize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || '',
                    'Authorization': `Bearer ${token}`,
                    'x-executor-role': (auth.currentUser as any)?.reloadUserInfo?.customAttributes?.includes('editor') ? 'editor' : 'admin'
                },
                body: JSON.stringify({
                    uid: client.id,
                    prizeId: selectedPrize.id
                })
            });

            const data = await res.json();

            if (data.ok) {
                toast.success("¡Canje realizado con éxito!");

                // WhatsApp notification handling (if returned by API)
                if (data.whatsappLink) {
                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = data.whatsappLink;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }, 500);
                }

                onRedeemSuccess();

                // Actualizar cache de vencimientos
                ExpirationService.updateNextExpirationCache(client.id);

                onClose();
            } else {
                toast.error(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Error al procesar canje:", error);
            toast.error("Error de conexión al procesar canje");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[90vh]">

                {/* Header */}
                <div className="bg-gradient-to-r from-pink-500 to-rose-600 px-6 py-4 flex justify-between items-center shrink-0">
                    <div>
                        <h2 className="text-xl font-bold text-white flex items-center gap-2">
                            <Gift size={24} /> Canjear Puntos
                        </h2>
                        <p className="text-pink-100 text-sm opacity-90">
                            Cliente: <span className="font-bold">{client.name}</span> | Saldo: <span className="font-bold bg-white/20 px-2 py-0.5 rounded text-white">{client.points} pts</span>
                        </p>
                    </div>
                    <button onClick={onClose} className="text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Body - Grid de Premios */}
                <div className="p-6 overflow-y-auto bg-gray-50 flex-1">
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
                        {prizes.map(prize => {
                            const canAfford = client.points >= prize.pointsRequired;
                            const hasStock = prize.stock > 0;
                            const isExpired = TimeService.isExpired(prize.expirationDate);
                            const isSelected = selectedPrize?.id === prize.id;
                            const isDisable = !canAfford || !hasStock || isExpired;

                            return (
                                <div
                                    key={prize.id}
                                    onClick={() => !isDisable && setSelectedPrize(prize)}
                                    className={`
                                        relative rounded-xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[160px]
                                        ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'bg-white border-gray-200 hover:border-pink-300'}
                                        ${isDisable ? 'opacity-50 grayscale cursor-not-allowed' : ''}
                                    `}
                                >
                                    {/* Badge Estado */}
                                    <div className="absolute top-2 right-2">
                                        {!hasStock && <span className="bg-red-100 text-red-600 text-[10px] font-bold px-2 py-1 rounded">SIN STOCK</span>}
                                        {!canAfford && hasStock && <span className="bg-gray-100 text-gray-500 text-[10px] font-bold px-2 py-1 rounded">FALTAN PTOS</span>}
                                    </div>

                                    <div className="mb-2">
                                        <h3 className="font-bold text-gray-800 leading-tight">{prize.name}</h3>
                                        <p className="text-[10px] text-gray-400 mt-1 line-clamp-2">{prize.description}</p>
                                        
                                        <div className="mt-2 space-y-1">
                                            <div className="flex items-center gap-1">
                                                <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${hasStock ? 'bg-gray-100 text-gray-600' : 'bg-red-100 text-red-600'}`}>
                                                    Stock: {prize.stock}
                                                </span>
                                                {prize.expirationDate && (
                                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${isExpired ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-blue-600'}`}>
                                                        {isExpired ? 'VENCIDO' : `Vence: ${TimeService.formatDisplayDate(prize.expirationDate)}`}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </div>

                                    <div className="mt-auto pt-2 border-t border-gray-100 flex justify-between items-center">
                                        <span className={`font-black text-lg ${canAfford ? 'text-pink-600' : 'text-gray-400'}`}>
                                            {prize.pointsRequired} <span className="text-xs">pts</span>
                                        </span>
                                        {isSelected && <CheckCircle className="text-pink-500" size={20} />}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>

                {/* Footer */}
                <div className="p-4 bg-white border-t border-gray-100 shrink-0 flex justify-end gap-3">
                    <button onClick={onClose} className="px-6 py-3 text-gray-500 font-medium hover:bg-gray-50 rounded-xl">
                        Cancelar
                    </button>
                    <button
                        onClick={handleRedeem}
                        disabled={!selectedPrize || loading}
                        className={`
                            px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all
                            ${!selectedPrize ? 'bg-gray-300 cursor-not-allowed' : 'bg-pink-600 hover:bg-pink-700 active:scale-95 shadow-pink-200'}
                        `}
                    >
                        {loading ? 'Procesando...' : 'Confirmar Canje'}
                    </button>
                </div>
            </div>
        </div>
    );
};
