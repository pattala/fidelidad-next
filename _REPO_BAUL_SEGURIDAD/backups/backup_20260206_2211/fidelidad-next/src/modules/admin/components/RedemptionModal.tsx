import { useState, useEffect } from 'react';
import { X, Gift, CheckCircle } from 'lucide-react';
import { PrizeService } from '../../../services/prizeService';
import type { Prize } from '../../../types';
import { collection, addDoc, updateDoc, doc, increment, arrayUnion, query, where, orderBy, getDocs, writeBatch } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { NotificationService } from '../../../services/notificationService';
import { TimeService } from '../../../services/timeService';
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

        if (!confirm(`¿Confirmar canje de ${selectedPrize.name} por ${selectedPrize.pointsRequired} pts?`)) return;

        setLoading(true);
        try {
            const cleanClientId = client.id.trim();
            if (!cleanClientId) throw new Error("ID de cliente inválido");

            const now = new Date();
            const pointsNeeded = selectedPrize.pointsRequired;
            let pointsToDeduct = pointsNeeded;
            const batchesUsed: string[] = [];
            const writeBatchOps = import('firebase/firestore').then(mod => mod.writeBatch(db)).then(batch => batch);
            const batch = await writeBatchOps;

            // 1. FIFO Strategy: Fetch active credits sorted by expiration
            const creditsQ = query(
                collection(db, `users/${cleanClientId}/points_history`),
                where('type', '==', 'credit'),
                where('expiresAt', '>', now), // Only valid points
                orderBy('expiresAt', 'asc') // Oldest expiration first
            );
            const creditsSnap = await getDocs(creditsQ);

            // In-memory FIFO processing
            for (const docSnap of creditsSnap.docs) {
                if (pointsToDeduct <= 0) break;

                const data = docSnap.data();
                // Determine available points in this batch
                // If 'remainingPoints' exists, use it. If not, fallback to 'amount' (Legacy migration)
                const currentRemaining = data.remainingPoints !== undefined ? data.remainingPoints : data.amount;

                if (currentRemaining <= 0) continue;

                let deduction = 0;
                if (currentRemaining >= pointsToDeduct) {
                    // This batch covers the rest
                    deduction = pointsToDeduct;
                    pointsToDeduct = 0;
                } else {
                    // Consume this batch entirely
                    deduction = currentRemaining;
                    pointsToDeduct -= deduction;
                }

                // Update this batch doc
                const newRemaining = currentRemaining - deduction;
                batch.update(docSnap.ref, {
                    remainingPoints: newRemaining,
                    lastUsageDate: new Date() // Audit: When was this batch touched?
                });

                // Log for history
                const dateStr = data.date?.toDate ? data.date.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'Fecha Desc.';
                // Enhanced FIFO Log: Deducted / Original from Date
                batchesUsed.push(`${deduction} pts del ${dateStr} (Orig: ${data.amount})`);
            }

            if (pointsToDeduct > 0) {
                // Should not happen if validations pass, but safety check
                console.warn("FIFO didn't find enough specific batches, forcing global deduction.");
                // We proceed anyway because the global 'points' is the authority, FIFO is just for tracking.
            }

            // 2. Main History Record (Debit)
            const debitRef = doc(collection(db, `users/${cleanClientId}/points_history`));
            const historyDescription = batchesUsed.length > 0
                ? `(Tomados: ${batchesUsed.join(', ')})`
                : '';

            batch.set(debitRef, {
                amount: -pointsNeeded,
                concept: `Canje: ${selectedPrize.name}`,
                details: historyDescription, // New field for detailed breakdown
                date: TimeService.now(),
                type: 'debit',
                prizeId: selectedPrize.id,
                redeemedValue: selectedPrize.cashValue || 0
            });

            // 3. User Updates (Global Balance & Arrays)
            const userRef = doc(db, 'users', cleanClientId);

            batch.update(userRef, {
                points: increment(-pointsNeeded),
                // Array for "Mis Canjes" / Rewards
                historialCanjes: arrayUnion({
                    fechaCanje: now,
                    nombrePremio: selectedPrize.name,
                    puntosCoste: pointsNeeded,
                    prizeId: selectedPrize.id
                }),
                // Array for "Mi Actividad" (PWA Feed)
                historialPuntos: arrayUnion({
                    fechaObtencion: now, // field name is legacy 'fechaObtencion' but acts as date
                    puntosObtenidos: -pointsNeeded,
                    puntosDisponibles: 0,
                    diasCaducidad: 0,
                    origen: `Canje: ${selectedPrize.name}`,
                    estado: 'Canjeado'
                })
            });

            // 4. Prize Stock Update
            const prizeRef = doc(db, 'prizes', selectedPrize.id);
            batch.update(prizeRef, {
                stock: increment(-1)
            });

            await batch.commit();

            // 5. Notifications
            // ... (Keep existing notification logic)
            // Re-trigger notifications safely
            try {
                const { ConfigService, DEFAULT_TEMPLATES } = await import('../../../services/configService');
                const config = await ConfigService.get();

                if (NotificationService.isChannelEnabled(config, 'redemption', 'whatsapp') && client.phone) {
                    const phone = client.phone.replace(/\D/g, '');
                    if (phone) {
                        const template = config?.messaging?.templates?.redemption || DEFAULT_TEMPLATES.redemption;
                        const msg = template
                            .replace(/{nombre}/g, client.name.split(' ')[0])
                            .replace(/{nombre_completo}/g, client.name)
                            .replace(/{premio}/g, selectedPrize.name)
                            .replace(/{codigo}/g, selectedPrize.id.substring(0, 4).toUpperCase()); // Short code

                        const waUrl = `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg.trim())}`;
                        const newWindow = window.open(waUrl, '_blank');

                        if (!newWindow || newWindow.closed || typeof newWindow.closed === 'undefined') {
                            toast((t) => (
                                <span className="flex items-center gap-2">
                                    WhatsApp bloqueado por el navegador
                                    <button
                                        onClick={() => {
                                            window.open(waUrl, '_blank');
                                            toast.dismiss(t.id);
                                        }}
                                        className="bg-green-500 text-white px-2 py-1 rounded text-xs font-bold"
                                    >
                                        REINTENTAR
                                    </button>
                                </span>
                            ), { duration: 6000, icon: '📱' });
                        }
                    }
                }

                if (NotificationService.isChannelEnabled(config, 'redemption', 'push')) {
                    const template = config?.messaging?.templates?.redemption || DEFAULT_TEMPLATES.redemption;
                    const msg = template
                        .replace(/{nombre}/g, client.name.split(' ')[0])
                        .replace(/{nombre_completo}/g, client.name)
                        .replace(/{premio}/g, selectedPrize.name)
                        .replace(/{codigo}/g, selectedPrize.id.substring(0, 4).toUpperCase());

                    await NotificationService.sendToClient(cleanClientId, {
                        title: '¡Canje Exitoso!',
                        body: msg,
                        type: 'redemption',
                        icon: config?.logoUrl
                    });
                }

                // NOTIFICAR EMAIL (Granular Config)
                if (client.email && NotificationService.isChannelEnabled(config, 'redemption', 'email')) {
                    const template = config?.messaging?.templates?.redemption || DEFAULT_TEMPLATES.redemption;
                    const msg = template
                        .replace(/{nombre}/g, client.name.split(' ')[0])
                        .replace(/{nombre_completo}/g, client.name)
                        .replace(/{premio}/g, selectedPrize.name)
                        .replace(/{codigo}/g, selectedPrize.id.substring(0, 4).toUpperCase());

                    const { EmailService } = await import('../../../services/emailService');
                    const htmlContent = EmailService.generateBrandedTemplate(config, '¡Canje Exitoso!', msg);
                    EmailService.sendEmail(client.email, '¡Canje Exitoso!', htmlContent)
                        .catch(e => console.error("Error enviando email de canje:", e));
                }
            } catch (e) {
                console.error("Notif error", e);
            }

            toast.success("¡Canje realizado con éxito!");
            onRedeemSuccess();
            onClose();

        } catch (error) {
            console.error(error);
            toast.error("Error al procesar canje");
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
                            const isSelected = selectedPrize?.id === prize.id;

                            return (
                                <div
                                    key={prize.id}
                                    onClick={() => (canAfford && hasStock) && setSelectedPrize(prize)}
                                    className={`
                                        relative rounded-xl border-2 p-4 cursor-pointer transition-all flex flex-col justify-between min-h-[160px]
                                        ${isSelected ? 'border-pink-500 bg-pink-50 ring-2 ring-pink-200' : 'bg-white border-gray-200 hover:border-pink-300'}
                                        ${(!canAfford || !hasStock) ? 'opacity-50 grayscale cursor-not-allowed' : ''}
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
