import { useEffect, useState } from 'react';
import { X, Calendar, ArrowUpRight, ArrowDownLeft, Clock, History, AlertTriangle, TrendingUp, Trash2, DollarSign, Check } from 'lucide-react';
import { collection, query, orderBy, getDocs, limit, where, doc, writeBatch, increment, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';

interface PointsHistoryModalProps {
    isOpen: boolean;
    client: any;
    onClose: () => void;
    onClientUpdated?: () => void;
}

export const PointsHistoryModal = ({ isOpen, onClose, client, onClientUpdated }: PointsHistoryModalProps) => {
    // 1. Local Client State (to show updated points immediately)
    const [currentClient, setCurrentClient] = useState(client);

    const [history, setHistory] = useState<any[]>([]);
    const [nextExpirations, setNextExpirations] = useState<any[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<any>(null);

    // Fetch data wrapper
    const fetchData = async () => {
        if (!client?.id) return;
        try {
            const cfg = await ConfigService.get();
            setConfig(cfg);

            // A. Process Expirations First (to ensure data consistency)
            // Import dynamically or assume it's available if we add import at top. Let's use dynamic to match previous pattern or add top import.
            // Better to add top import but minimal change is dynamic or just adding import.
            // Let's add the import at the top in a separate edit or just use dynamic import here to be safe and quick without changing top lines context.
            // Actually, I should add the import line at the top optimally, but I have a partial view. 
            // I'll use dynamic import for safety in this replace block.
            try {
                const { ExpirationService } = await import('../../../services/expirationService');
                await ExpirationService.processExpirations(client.id);
            } catch (e) {
                console.warn('Auto-expiration check failed:', e);
            }

            // A. Fetch Latest Client Data (Real-time points)
            const userRef = doc(db, 'users', client.id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                setCurrentClient({ id: userSnap.id, ...userData });
            }

            // B. Fetch History
            const historyQuery = query(
                collection(db, `users/${client.id}/points_history`),
                orderBy('date', 'desc'),
                limit(50)
            );

            // C. Fetch ALL Expirations (Past and Future) to detect overdue points
            // Note: We use '!=' null to ensure we only get docs with this field, ordered by date
            const expirationQuery = query(
                collection(db, `users/${client.id}/points_history`),
                where('expiresAt', '!=', null),
                orderBy('expiresAt', 'asc'),
                limit(300)
            );

            const [historySnap, expirationSnap] = await Promise.all([
                getDocs(historyQuery),
                getDocs(expirationQuery)
            ]);

            let calculatedTotalSpent = 0;

            const historyData = historySnap.docs.map(doc => {
                const d = doc.data();

                // Calcular dinero de este item para el total
                let itemMoney = 0;
                if (d.type === 'credit') {
                    if (d.moneySpent !== undefined && d.moneySpent !== null) {
                        itemMoney = d.moneySpent;
                    } else {
                        // Estimación Legacy
                        const conceptLower = (d.concept || '').toLowerCase();
                        if (!conceptLower.includes('regalo') && !conceptLower.includes('bienvenida') && !conceptLower.includes('bono')) {
                            const ratio = cfg?.pointsPerPeso || 1;
                            const safeRatio = ratio > 0 ? ratio : 1;
                            itemMoney = Math.round((d.amount * 100) / safeRatio);
                        }
                    }
                }
                calculatedTotalSpent += itemMoney;

                return {
                    id: doc.id,
                    ...d,
                    date: d.date?.toDate ? d.date.toDate() : new Date(d.date),
                    expiresAt: d.expiresAt?.toDate ? d.expiresAt.toDate() : (d.expiresAt ? new Date(d.expiresAt) : null)
                };
            });

            // Group Expirations by Date
            const todayStart = TimeService.startOfToday();

            const expirationMap: Record<string, { id: string, amount: number, date: Date, status: 'overdue' | 'today' | 'future' }> = {};

            expirationSnap.docs.forEach(doc => {
                const d = doc.data();
                // Use remainingPoints if available (FIFO logic), otherwise amount (Legacy)
                const currentAmount = d.remainingPoints !== undefined ? d.remainingPoints : d.amount;

                if (currentAmount > 0 && d.expiresAt) {
                    const date = d.expiresAt?.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
                    // Normalize date for grouping to avoid hours splitting groups
                    const dateKey = date.toLocaleDateString();

                    // Determine status logic based on Start of Day
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);

                    let status: 'overdue' | 'today' | 'future' = 'future';
                    if (checkDate.getTime() < todayStart.getTime()) {
                        status = 'overdue';
                    } else if (checkDate.getTime() === todayStart.getTime()) {
                        status = 'today';
                    }

                    if (!expirationMap[dateKey]) {
                        expirationMap[dateKey] = {
                            id: doc.id,
                            amount: 0,
                            date: date,
                            status: status
                        };
                    }
                    expirationMap[dateKey].amount += currentAmount;
                }
            });

            // Convert to array and sort
            const expirationData = Object.values(expirationMap).sort((a, b) => a.date.getTime() - b.date.getTime());

            setHistory(historyData);
            setNextExpirations(expirationData);
            setTotalSpent(calculatedTotalSpent);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [client]);

    // Delete Individual Item
    const handleDeleteItem = async (item: any) => {
        if (!confirm(`¿Eliminar este movimiento de ${item.amount} pts? Se ajustará el saldo del cliente.`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'users', client.id);
            const historyRef = doc(db, `users/${client.id}/points_history`, item.id);

            // 1. Delete history doc (Subcollection)
            batch.delete(historyRef);

            // 2. Adjust User Balance
            // 'amount' is stored signed (+ for credit, - for debit).
            // To reverse any operation, we simply subtract the stored amount from the balance.
            // Example 1: Deleting a credit of +100. increment(-100). Correct.
            // Example 2: Deleting a redemption of -200. increment(-(-200)) = increment(+200). Correct.

            const adjustment = -item.amount;

            batch.update(userRef, {
                points: increment(adjustment)
            });

            await batch.commit();

            // Note: We are NOT removing from 'historialPuntos' array in 'users' doc 
            // because we lack a unique ID mapping. PWA might show stale history until logic is unified.
            // But 'points' balance will be correct.

            toast.success('Movimiento eliminado y saldo ajustado.');
            fetchData();

        } catch (e) {
            console.error("Error deleting item:", e);
            toast.error("Error al eliminar");
        } finally {
            setLoading(false);
        }
    };

    const handleDeleteAll = async () => {
        if (!confirm("⚠️ PELIGRO: ¿Estás seguro de ELIMINAR TODO el historial?\n\n- Se borrarán todos los movimientos.\n- El saldo de puntos y dinero volverá a 0.\n- Esta acción no se puede deshacer.")) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            const historyRef = collection(db, `users/${client.id}/points_history`);
            const snapshot = await getDocs(historyRef);

            // Delete all subcollection docs
            snapshot.docs.forEach(d => batch.delete(d.ref));

            // RESTORED: Reset User Doc Balance in Firestore
            const userRef = doc(db, 'users', client.id);
            batch.update(userRef, {
                points: 0,
                accumulated_balance: 0,
                historialPuntos: [],
                historialCanjes: []
            });

            await batch.commit();

            // Update local state to reflect 0 points immediately
            setCurrentClient({ ...currentClient, points: 0, accumulated_balance: 0 });
            setHistory([]);
            setNextExpirations([]);
            toast.success('Historial reseteado correctamente');

            // Trigger parent refresh
            if (onClientUpdated) onClientUpdated();

            onClose(); // Close the modal after resetting everything
        } catch (error) {
            console.error("Error wiping history:", error);
            toast.error("Error al resetear historial");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-up flex flex-col max-h-[85vh]">

                {/* Header */}
                {/* Header */}
                <div className="px-6 py-4 flex justify-between items-start bg-gray-50 border-b border-gray-100">
                    <div>
                        <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                            <History className="text-blue-500" /> Historial de Puntos
                        </h2>
                        <div className="flex items-center gap-2 mt-1">
                            <p className="text-sm text-gray-500">Movimientos de {currentClient.name}</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-gray-400 hover:text-gray-600 rounded-full p-1 hover:bg-gray-100 transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Stats Dashboard */}
                <div className="px-6 pb-6 grid grid-cols-3 gap-4">
                    {/* 1. Puntos Disponibles */}
                    <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <TrendingUp size={14} className="text-blue-500" />
                            <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Puntos Actuales</p>
                        </div>
                        <p className="text-2xl font-black text-gray-800">{currentClient.points || 0}</p>
                    </div>

                    {/* 2. Dinero Gastado Total */}
                    <div className="bg-green-50/50 rounded-xl p-3 border border-green-100 flex flex-col justify-center">
                        <div className="flex items-center gap-2 mb-1">
                            <DollarSign size={14} className="text-green-500" />
                            <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Total Gastado</p>
                        </div>
                        <p className="text-2xl font-black text-gray-800">
                            ${totalSpent.toLocaleString('es-AR')}
                        </p>
                    </div>

                    {/* 3. Vencimientos */}
                    <div className="bg-orange-50/50 rounded-xl p-3 border border-orange-100 relative overflow-hidden flex flex-col">
                        <div className="flex items-center gap-2 text-orange-700 mb-2">
                            <AlertTriangle size={14} />
                            <p className="text-[10px] font-bold uppercase tracking-wide">Vencimientos</p>
                        </div>
                        {nextExpirations.length === 0 ? (
                            <p className="text-xs text-gray-500 flex items-center gap-1 mt-1">
                                <Clock size={12} /> Sin datos
                            </p>
                        ) : (
                            <div className="space-y-1">
                                {nextExpirations.map((exp, idx) => {
                                    let colorClass = "text-gray-600";
                                    let bgClass = "bg-gray-100 text-gray-600";
                                    let label = "";

                                    if (exp.status === 'overdue') {
                                        colorClass = "text-red-600 font-bold";
                                        bgClass = "bg-red-100 text-red-700";
                                        label = "(VENCIDO)";
                                    } else if (exp.status === 'today') {
                                        colorClass = "text-orange-600 font-bold";
                                        bgClass = "bg-orange-100 text-orange-700";
                                        label = "(HOY)";
                                    }

                                    return (
                                        <div key={idx} className="flex justify-between items-center text-xs font-medium">
                                            <span className={colorClass}>
                                                {exp.date.toLocaleDateString()} <span className="text-[9px] opacity-75">{label}</span>
                                            </span>
                                            <span className={`${bgClass} px-1 rounded text-[10px]`}>
                                                -{exp.amount}
                                            </span>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>

                {/* Body - List */}
                <div className="flex-1 overflow-y-auto p-0 bg-gray-50/50">
                    {loading ? (
                        <div className="p-10 text-center text-gray-400">Cargando movimientos...</div>
                    ) : history.length === 0 ? (
                        <div className="p-10 text-center flex flex-col items-center text-gray-400">
                            <Clock size={48} className="mb-3 opacity-20" />
                            <p>No hay movimientos registrados.</p>
                        </div>
                    ) : (
                        <table className="w-full text-left text-sm">
                            <thead className="bg-gray-50 text-gray-500 font-semibold sticky top-0 border-b border-gray-200 shadow-sm z-10">
                                <tr>
                                    <th className="p-4 pl-6 bg-gray-50">Fecha</th>
                                    <th className="p-4 bg-gray-50">Concepto</th>
                                    <th className="p-4 text-right bg-gray-50">Dinero ($)</th>
                                    <th className="p-4 text-right bg-gray-50">Puntos</th>
                                    <th className="p-4 text-center bg-gray-50 w-10"></th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100 bg-white">
                                {history.map((item) => (
                                    <tr key={item.id} className="hover:bg-gray-50 transition-colors group">
                                        <td className="p-4 pl-6 text-gray-500 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <Calendar size={14} className="opacity-50" />
                                                {item.date.toLocaleDateString()} <span className="text-xs opacity-50">{item.date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                                            </div>
                                        </td>
                                        <td className="p-4">
                                            <div className="flex flex-col">
                                                <span className="font-medium text-gray-800 line-clamp-2" title={item.concept}>
                                                    {item.concept}
                                                </span>
                                                {/* Detalle para Canjes (Debito) */}
                                                {item.details && (
                                                    <span className="text-[10px] text-gray-500 italic mt-0.5 break-words max-w-[200px]">
                                                        {item.details}
                                                    </span>
                                                )}

                                                {/* Estado del Lote (Crédito) */}
                                                {item.type === 'credit' && (
                                                    <>
                                                        {(() => {
                                                            const usageDateRaw = item.lastUsageDate;
                                                            const usageDate = usageDateRaw?.toDate ? usageDateRaw.toDate() : (usageDateRaw ? new Date(usageDateRaw) : null);
                                                            const dateStr = usageDate ? usageDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : '';

                                                            return (
                                                                <>
                                                                    {/* Caso: Lote Agotado (Vencido o Usado) - Solo si tuvo puntos originalmente */}
                                                                    {item.remainingPoints !== undefined && item.remainingPoints === 0 && item.amount > 0 ? (
                                                                        item.status === 'expired' ? (
                                                                            <span className="text-[10px] font-bold text-red-500 bg-red-50 px-1.5 py-0.5 rounded mt-1 inline-block border border-red-100 w-fit">
                                                                                Vencido {dateStr ? `el ${dateStr}` : ''} (Perdidos: {item.expiredAmount || item.amount})
                                                                            </span>
                                                                        ) : (
                                                                            <span className="text-[10px] font-medium text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded mt-1 inline-block border border-gray-200 w-fit">
                                                                                Agotado por Canje {dateStr ? `el ${dateStr}` : ''} (Orig: {item.amount})
                                                                            </span>
                                                                        )
                                                                    ) : (
                                                                        /* Caso: Activo (Parcial o Total) */
                                                                        <>
                                                                            {item.remainingPoints !== undefined && item.remainingPoints < item.amount && (
                                                                                <span className="text-[10px] font-bold text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded mt-1 inline-block border border-amber-100 w-fit">
                                                                                    Restan: {item.remainingPoints} / {item.amount} {dateStr ? `(Uso: ${dateStr})` : ''}
                                                                                </span>
                                                                            )}
                                                                            {item.expiresAt && (
                                                                                <p className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                                                                                    Vence: {item.expiresAt.toLocaleDateString()}
                                                                                </p>
                                                                            )}
                                                                        </>
                                                                    )}
                                                                </>
                                                            );
                                                        })()}
                                                    </>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-right">
                                            {item.redeemedValue ? (
                                                // CANJE (Débito)
                                                <div className="flex flex-col items-end">
                                                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-1 rounded">
                                                        Equiv. ${item.redeemedValue}
                                                    </span>
                                                </div>
                                            ) : item.type === 'credit' ? (
                                                // CARGA (Crédito)
                                                <span className={`text-xs font-bold px-2 py-1 rounded ${item.moneySpent > 0 ? 'text-green-600 bg-green-50' : 'text-gray-400 bg-gray-50'}`}>
                                                    {(() => {
                                                        // 1. Si tenemos el dato REAL guardado (NUEVO SISTEMA)
                                                        if (item.moneySpent !== undefined && item.moneySpent !== null) return `$${item.moneySpent}`;

                                                        // 2. Si es histórico, tratamos de adivinar si fue regalo o compra
                                                        const conceptLower = (item.concept || '').toLowerCase();
                                                        const isGift = conceptLower.includes('regalo') ||
                                                            conceptLower.includes('bienvenida') ||
                                                            conceptLower.includes('bono') ||
                                                            conceptLower.includes('ajuste');

                                                        if (isGift) return '$0 (Regalo)';

                                                        // 3. Si parece compra, estimamos
                                                        const ratio = config?.pointsPerPeso || 1;
                                                        // Evitar division por 0
                                                        const safeRatio = ratio > 0 ? ratio : 1;
                                                        const estimated = Math.round((item.amount * 100) / safeRatio);
                                                        return `~$${estimated}`;
                                                    })()}
                                                </span>
                                            ) : '-'}
                                        </td>
                                        <td className="p-4 text-right">
                                            <div className="flex flex-col items-end">
                                                {item.type === 'credit' && item.remainingPoints !== undefined ? (
                                                    /* Logic for Tracked Credits: Show Current Balance of Batch */
                                                    <>
                                                        <div className={`inline-flex items-center gap-1 font-bold ${item.remainingPoints > 0 ? 'text-green-600' : 'text-gray-400'}`}>
                                                            {item.remainingPoints > 0 ? <ArrowUpRight size={14} /> : <Check size={14} />}
                                                            +{item.remainingPoints}
                                                        </div>
                                                        {item.remainingPoints !== item.amount && (
                                                            <span className="text-[10px] text-gray-400 font-medium">
                                                                de {item.amount}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    /* Logic for Debits or Legacy Credits */
                                                    <div className={`inline-flex items-center gap-1 font-bold ${item.amount > 0 ? 'text-green-600' : 'text-red-500'}`}>
                                                        {item.amount > 0 ? <ArrowUpRight size={14} /> : <ArrowDownLeft size={14} />}
                                                        {item.amount > 0 ? '+' : ''}{item.amount}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            <button
                                                onClick={() => handleDeleteItem(item)}
                                                className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition opacity-0 group-hover:opacity-100"
                                                title="Eliminar movimiento (corrige saldo)"
                                            >
                                                <Trash2 size={16} />
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                    <button
                        onClick={handleDeleteAll}
                        className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors flex items-center gap-2"
                    >
                        <Trash2 size={14} />
                        Resetear Todo
                    </button>
                    <div className="flex items-center gap-4">
                        <span className="text-xs text-gray-400 italic">
                            * Eliminar movimientos ajusta automáticamente el saldo.
                        </span>
                        <button
                            onClick={onClose}
                            className="px-6 py-2 bg-white border border-gray-200 text-gray-700 font-bold rounded-xl hover:bg-gray-50 transition-colors"
                        >
                            Cerrar
                        </button>
                    </div>
                </div>
            </div>
        </div >
    );
};
