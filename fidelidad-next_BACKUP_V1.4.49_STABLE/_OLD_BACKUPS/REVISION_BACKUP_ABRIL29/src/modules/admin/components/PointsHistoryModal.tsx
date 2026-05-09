import { useEffect, useState } from 'react';
import { X, Calendar, ArrowUpRight, ArrowDownLeft, Clock, History, AlertTriangle, TrendingUp, Trash2, DollarSign, Check, Minus, Plus } from 'lucide-react';
import { collection, query, orderBy, getDocs, limit, where, doc, writeBatch, increment, getDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import toast from 'react-hot-toast';

import { ConfigService } from '../../../services/configService';
import { TimeService } from '../../../services/timeService';
import { ExpirationService } from '../../../services/expirationService';
import { AuditService } from '../../../services/auditService';
import { useAdminAuth } from '../contexts/AdminAuthContext';

interface PointsHistoryModalProps {
    isOpen: boolean;
    client: any;
    onClose: () => void;
    onClientUpdated?: () => void;
}

export const PointsHistoryModal = ({ isOpen, onClose, client, onClientUpdated }: PointsHistoryModalProps) => {
    const { role } = useAdminAuth();
    const isAdmin = role === 'admin';

    // 1. Local Client State (to show updated points immediately)
    const [currentClient, setCurrentClient] = useState(client);

    const [history, setHistory] = useState<any[]>([]);
    const [nextExpirations, setNextExpirations] = useState<any[]>([]);
    const [totalSpent, setTotalSpent] = useState(0);
    const [loading, setLoading] = useState(true);
    const [config, setConfig] = useState<any>(null);

    const [historyLimit, setHistoryLimit] = useState(50);
    const [stats, setStats] = useState({
        totalEarned: 0,
        totalRedeemed: 0,
        totalExpired: 0,
        totalTransactions: 0
    });

    // Fetch data wrapper
    const fetchData = async () => {
        if (!client?.id) return;
        try {
            const cfg = await ConfigService.get();
            setConfig(cfg);

            try {
                await ExpirationService.processExpirations(client.id);
            } catch (e) {
                console.warn('Auto-expiration check failed:', e);
            }

            const userRef = doc(db, 'users', client.id);
            const userSnap = await getDoc(userRef);
            if (userSnap.exists()) {
                const userData = userSnap.data();
                setCurrentClient({ id: userSnap.id, ...userData });
            }

            // B. Fetch History with NO limit for global stats (we'll slice it later for the UI)
            const globalHistoryQuery = query(
                collection(db, `users/${client.id}/points_history`),
                orderBy('date', 'desc')
            );

            // C. Fetch ALL Expirations (Past and Future) to detect overdue points
            const expirationQuery = query(
                collection(db, `users/${client.id}/points_history`),
                where('expiresAt', '!=', null),
                orderBy('expiresAt', 'asc'),
                limit(300)
            );

            const [globalHistorySnap, expirationSnap] = await Promise.all([
                getDocs(globalHistoryQuery),
                getDocs(expirationQuery)
            ]);

            let calculatedTotalSpent = 0;
            let tEarned = 0;
            let tRedeemed = 0;
            let tExpired = 0;

            const allHistoryDocs = globalHistorySnap.docs.map(doc => {
                const d = doc.data();

                // 1. Calculate Money Spent
                let itemMoney = 0;
                if (d.type === 'credit') {
                    if (d.moneySpent !== undefined && d.moneySpent !== null) {
                        itemMoney = d.moneySpent;
                    } else {
                        const conceptLower = (d.concept || '').toLowerCase();
                        if (!conceptLower.includes('regalo') && !conceptLower.includes('bienvenida') && !conceptLower.includes('bono')) {
                            const ratio = cfg?.pointsPerPeso || 1;
                            const safeRatio = ratio > 0 ? ratio : 1;
                            itemMoney = Math.round((d.amount * 100) / safeRatio);
                        }
                    }
                    calculatedTotalSpent += itemMoney;
                    tEarned += d.amount;
                } else if (d.type === 'debit') {
                    if (d.status === 'expired' || d.isExpirationAdjustment) {
                        tExpired += Math.abs(d.amount);
                    } else {
                        tRedeemed += Math.abs(d.amount);
                    }
                }

                return {
                    id: doc.id,
                    ...d,
                    date: d.date?.toDate ? d.date.toDate() : new Date(d.date),
                    expiresAt: d.expiresAt?.toDate ? d.expiresAt.toDate() : (d.expiresAt ? new Date(d.expiresAt) : null)
                };
            });

            setStats({
                totalEarned: tEarned,
                totalRedeemed: tRedeemed,
                totalExpired: tExpired,
                totalTransactions: allHistoryDocs.length
            });

            // For the UI, we only show up to the historyLimit
            const historyData = allHistoryDocs.slice(0, historyLimit);

            const todayStart = TimeService.startOfToday();
            const expirationMap: Record<string, { id: string, amount: number, date: Date, status: 'overdue' | 'today' | 'future' }> = {};

            expirationSnap.docs.forEach(doc => {
                const d = doc.data();
                const currentAmount = d.remainingPoints !== undefined ? d.remainingPoints : d.amount;
                if (currentAmount > 0 && d.expiresAt) {
                    const date = d.expiresAt?.toDate ? d.expiresAt.toDate() : new Date(d.expiresAt);
                    const dateKey = date.toLocaleDateString();
                    const checkDate = new Date(date);
                    checkDate.setHours(0, 0, 0, 0);

                    let status: 'overdue' | 'today' | 'future' = 'future';
                    if (checkDate.getTime() < todayStart.getTime()) status = 'overdue';
                    else if (checkDate.getTime() === todayStart.getTime()) status = 'today';

                    if (!expirationMap[dateKey]) {
                        expirationMap[dateKey] = { id: doc.id, amount: 0, date: date, status: status };
                    }
                    expirationMap[dateKey].amount += currentAmount;
                }
            });

            const expirationData = Object.values(expirationMap).sort((a, b) => a.date.getTime() - b.date.getTime());

            setHistory(historyData);
            // Si el cliente no tiene puntos, forzamos que no aparezcan vencimientos (prevención visual)
            if ((currentClient.points || 0) <= 0) {
                setNextExpirations([]);
            } else {
                setNextExpirations(expirationData);
            }
            setTotalSpent(calculatedTotalSpent);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [client, historyLimit]);

    // Delete Individual Item
    const handleDeleteItem = async (item: any) => {
        if (!isAdmin) return;
        if (!confirm(`¿Eliminar este movimiento de ${item.amount} pts? Se ajustará el saldo del cliente.`)) return;

        setLoading(true);
        try {
            const batch = writeBatch(db);
            const userRef = doc(db, 'users', client.id);
            const historyRef = doc(db, `users/${client.id}/points_history`, item.id);

            // 1. Delete history doc (Subcollection)
            batch.delete(historyRef);

            // 2. Adjust User Balance (with zero floor)
            const userSnap = await getDoc(userRef);
            let adjustment = -item.amount;

            if (userSnap.exists()) {
                const userData = userSnap.data();
                const currentPts = Number(userData.points || 0);
                const newPoints = Math.max(0, currentPts + adjustment);

                const updatePayload: any = {
                    points: newPoints,
                    puntos: newPoints
                };

                // 3. LEGACY SYNC: Try to remove from the arrays in the user document
                if (item.type === 'credit') {
                    const legacyHistory = userData.historialPuntos || [];
                    const filtered = legacyHistory.filter((h: any) => {
                        const hDate = h.fechaObtencion?.toDate ? h.fechaObtencion.toDate().getTime() : new Date(h.fechaObtencion).getTime();
                        const itemDate = item.date.getTime();
                        const timeDiff = Math.abs(hDate - itemDate);
                        return !(h.puntosObtenidos === item.amount && timeDiff < 60000);
                    });
                    if (filtered.length !== legacyHistory.length) {
                        updatePayload.historialPuntos = filtered;
                    }
                } else if (item.type === 'debit') {
                    const legacyRedemptions = userData.historialCanjes || [];
                    const filtered = legacyRedemptions.filter((h: any) => {
                        const hDate = h.fecha?.toDate ? h.fecha.toDate().getTime() : new Date(h.fecha).getTime();
                        const itemDate = item.date.getTime();
                        const timeDiff = Math.abs(hDate - itemDate);
                        // Debit amount is stored negative in subcollection but likely positive in legacy array
                        return !(Math.abs(h.puntosCanjeados) === Math.abs(item.amount) && timeDiff < 60000);
                    });
                    if (filtered.length !== legacyRedemptions.length) {
                        updatePayload.historialCanjes = filtered;
                    }
                }

                batch.update(userRef, updatePayload);
            }

            // --- ESCRITURA GLOBAL PARA ESTADÍSTICAS ---
            const globalTransRef = doc(collection(db, 'transactions'));
            batch.set(globalTransRef, {
                uid: client.id,
                clientName: currentClient.name,
                socioNumber: currentClient.socioNumber || currentClient.numeroSocio || 'N/A',
                points: adjustment,
                amount: item.type === 'credit' ? -(item.moneySpent || 0) : 0,
                type: 'adjustment',
                reason: 'deletion',
                concept: `Eliminación: ${item.concept}`,
                date: TimeService.now(),
                createdAt: serverTimestamp()
            });

            await batch.commit();

            // --- AUDITORIA ---
            AuditService.log('points_history_deleted', `Movimiento eliminado: ${item.concept} (${client.name})`, [
                { action: 'points_history_delete', status: 'success', info: `Socio: ${client.name}, Puntos: ${item.amount}, Concepto: ${item.concept}` }
            ]);

            toast.success('Movimiento eliminado y saldo ajustado.');

            // Actualizar cache de vencimientos despues de borrar
            ExpirationService.updateNextExpirationCache(client.id);

            fetchData();
            if (onClientUpdated) onClientUpdated();

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
                puntos: 0,
                accumulated_balance: 0,
                lastExpirationNotice: null,
                lastExpirationNoticeTargetDate: null,
                lastExpirationNoticeAmount: null,
                nextExpirationDate: null,
                nextExpirationAmount: 0,
                expiringPoints: 0,
                expirationDetails: [],
                totalSpent: 0,
                redeemedPoints: 0,
                redeemedValue: 0,
                // Legacy fields sync
                proximaExpiracion: null,
                vencimiento: null,
                historialPuntos: [],
                historialCanjes: []
            });

            // --- ESCRITURA GLOBAL PARA ESTADÍSTICAS (RESETEO) ---
            const globalResetRef = doc(collection(db, 'transactions'));
            batch.set(globalResetRef, {
                uid: client.id,
                clientName: currentClient.name,
                socioNumber: currentClient.socioNumber || currentClient.numeroSocio || 'N/A',
                points: -currentClient.points,
                amount: 0,
                type: 'adjustment',
                reason: 'reset_all',
                concept: 'RESETEO TOTAL DE HISTORIAL',
                date: TimeService.now(),
                createdAt: serverTimestamp()
            });

            await batch.commit();

            // --- AUDITORIA ---
            AuditService.log('points_history_reset', `Historial reseteado: ${currentClient.name}`, [
                { action: 'points_history_reset_all', status: 'success', info: `Se eliminaron todos los movimientos de ${currentClient.name}` }
            ]);

            // Update local state to reflect 0 points immediately
            setCurrentClient({ ...currentClient, points: 0, puntos: 0, accumulated_balance: 0 });
            setHistory([]);
            setNextExpirations([]);
            toast.success('Historial reseteado correctamente');

            // Actualizar cache de vencimientos (quedará en null)
            ExpirationService.updateNextExpirationCache(client.id);

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
                <div className="px-6 pb-6 flex flex-col gap-4">
                    {/* Fila 1: Histórico y Financiero */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* Dinero Gastado Total */}
                        <div className="bg-green-50/50 rounded-xl p-3 border border-green-100 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <DollarSign size={14} className="text-green-500" />
                                <p className="text-[10px] font-bold text-green-600 uppercase tracking-wide">Total Gastado</p>
                            </div>
                            <p className="text-2xl font-black text-gray-800">
                                ${totalSpent.toLocaleString('es-AR')}
                            </p>
                        </div>
                        {/* Saldo a Favor (Acumulado) */}
                        <div className="bg-emerald-50 rounded-xl p-3 border border-emerald-100 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <TrendingUp size={14} className="text-emerald-500" />
                                <p className="text-[10px] font-bold text-emerald-600 uppercase tracking-wide">Saldo a Favor</p>
                            </div>
                            <div className="flex flex-col">
                                <p className="text-2xl font-black text-gray-800">${(currentClient.accumulated_balance || 0).toLocaleString('es-AR')}</p>
                                {currentClient.accumulated_balance_updated_at && (
                                    <p className="text-[9px] text-emerald-600 font-bold opacity-70 leading-none mt-1">
                                        Modificado: {new Date(currentClient.accumulated_balance_updated_at.toDate ? currentClient.accumulated_balance_updated_at.toDate() : currentClient.accumulated_balance_updated_at).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}hs ({new Date(currentClient.accumulated_balance_updated_at.toDate ? currentClient.accumulated_balance_updated_at.toDate() : currentClient.accumulated_balance_updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})
                                    </p>
                                )}
                            </div>
                        </div>
                        {/* Puntos Históricos */}
                        <div className="bg-blue-50/50 rounded-xl p-3 border border-blue-100 flex flex-col justify-center">
                            <div className="flex items-center gap-2 mb-1">
                                <History size={14} className="text-blue-500" />
                                <p className="text-[10px] font-bold text-blue-600 uppercase tracking-wide">Puntos Emitidos</p>
                            </div>
                            <div className="flex gap-2 items-baseline">
                                <p className="text-2xl font-black text-gray-800">{stats.totalEarned.toLocaleString('es-AR')}</p>
                            </div>
                        </div>
                    </div>

                    {/* Fila 2: Ciclo de vida de los puntos */}
                    <div className="grid grid-cols-3 gap-4">
                        {/* 1. Puntos Actuales */}
                        <div className="bg-blue-500 rounded-xl p-3 text-white flex flex-col justify-between shadow-sm">
                            <p className="text-[10px] font-bold uppercase tracking-wide opacity-80 mb-2">Puntos Disponibles</p>
                            <p className="text-2xl font-black">{currentClient.points || 0}</p>
                        </div>

                        {/* 2. Puntos Canjeados */}
                        <div className="bg-amber-50 rounded-xl p-3 border border-amber-100 flex flex-col justify-between text-amber-800">
                            <p className="text-[10px] font-bold uppercase tracking-wide mb-2 opacity-80 text-amber-600">Total Canjeado</p>
                            <p className="text-2xl font-black">{stats.totalRedeemed.toLocaleString('es-AR')}</p>
                        </div>

                        {/* 3. Vencimientos */}
                        <div className="bg-red-50/50 rounded-xl p-3 border border-red-100 overflow-hidden flex flex-col">
                            <div className="flex items-center gap-2 text-red-600 mb-1">
                                <AlertTriangle size={14} />
                                <p className="text-[10px] font-bold uppercase tracking-wide">Vencidos: {stats.totalExpired.toLocaleString('es-AR')}</p>
                            </div>
                            {nextExpirations.length === 0 ? (
                                <p className="text-[10px] text-gray-500 flex items-center gap-1 mt-1">
                                    <Clock size={10} /> Sin riesgo visible
                                </p>
                            ) : (
                                <div className="space-y-1 mt-1 max-h-16 overflow-y-auto pr-1 custom-scrollbar">
                                    {nextExpirations.map((exp, idx) => {
                                        let colorClass = "text-gray-500";
                                        let bgClass = "bg-gray-100 text-gray-600";
                                        let label = "";

                                        if (exp.status === 'overdue') {
                                            colorClass = "text-red-600 font-bold";
                                            bgClass = "bg-red-100 text-red-700";
                                            label = "(VENC)";
                                        } else if (exp.status === 'today') {
                                            colorClass = "text-orange-600 font-bold";
                                            bgClass = "bg-orange-100 text-orange-700";
                                            label = "(HOY)";
                                        }

                                        return (
                                            <div key={idx} className="flex justify-between items-center text-[10px] font-medium">
                                                <span className={colorClass}>
                                                    {exp.date.toLocaleDateString()} <span className="text-[8px] opacity-75">{label}</span>
                                                </span>
                                                <span className={`${bgClass} px-1 rounded`}>
                                                    -{exp.amount}
                                                </span>
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
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
                                                <div className="flex flex-wrap gap-1 items-center mt-1">
                                                    {item.redemptionCode && (
                                                        <span className="text-[9px] font-black bg-pink-100 text-pink-600 px-1.5 py-0.5 rounded border border-pink-200">
                                                            CÓDIGO: {item.redemptionCode}
                                                        </span>
                                                    )}
                                                    {item.details && (
                                                        <span className="text-[10px] text-gray-400 italic break-words max-w-[200px]">
                                                            {item.details}
                                                        </span>
                                                    )}
                                                </div>

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
                                                {item.type === 'credit' ? (
                                                    <>
                                                        <div className={`inline-flex items-center gap-1 font-bold ${Number(item.remainingPoints || 0) > 0 ? 'text-emerald-600' : 'text-gray-400'}`}>
                                                            {Number(item.remainingPoints || 0) > 0 ? <Plus size={14} /> : <Check size={14} />}
                                                            +{item.remainingPoints || 0}
                                                        </div>
                                                        {item.remainingPoints !== item.amount && (
                                                            <span className="text-[10px] text-gray-400 font-medium">
                                                                de {item.amount}
                                                            </span>
                                                        )}
                                                        {item.expiresAt && (
                                                            <span className={`text-[9px] font-bold mt-0.5 ${Number(item.remainingPoints || 0) > 0 ? 'text-orange-500' : 'text-gray-300'}`}>
                                                                Vence: {new Date(item.expiresAt.toDate ? item.expiresAt.toDate() : item.expiresAt).toLocaleDateString()}
                                                            </span>
                                                        )}
                                                    </>
                                                ) : (
                                                    <div className="text-blue-600 font-bold flex items-center gap-1">
                                                        <Minus size={14} />
                                                        {Math.abs(item.amount)}
                                                    </div>
                                                )}
                                            </div>
                                        </td>
                                        <td className="p-4 text-center">
                                            {isAdmin && (
                                                <button
                                                    onClick={() => handleDeleteItem(item)}
                                                    className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-md transition opacity-0 group-hover:opacity-100"
                                                    title="Eliminar movimiento (corrige saldo)"
                                                >
                                                    <Trash2 size={16} />
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    )}
                    {history.length >= historyLimit && (
                        <div className="p-4 flex justify-center bg-white border-t border-gray-50">
                            <button
                                onClick={() => setHistoryLimit(prev => prev + 50)}
                                className="text-sm font-bold text-blue-600 hover:text-blue-700 hover:bg-blue-50 px-6 py-2 rounded-xl transition-all flex items-center gap-2 border border-blue-100 shadow-sm"
                            >
                                <History size={16} /> CARGAR MÁS MOVIMIENTOS
                            </button>
                        </div>
                    )}
                </div>

                {/* Footer */}
                <div className="p-4 border-t border-gray-100 flex justify-between items-center bg-gray-50">
                    {isAdmin ? (
                        <button
                            onClick={handleDeleteAll}
                            className="px-4 py-2 text-xs font-bold text-red-600 hover:bg-red-50 rounded-lg border border-transparent hover:border-red-100 transition-colors flex items-center gap-2"
                        >
                            <Trash2 size={14} />
                            Resetear Todo
                        </button>
                    ) : (
                        <div className="text-[10px] text-gray-400 font-medium">Solo administradores pueden resetear el historial.</div>
                    )}
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
