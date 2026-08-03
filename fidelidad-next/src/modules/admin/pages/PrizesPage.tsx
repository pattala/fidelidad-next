
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Gift, Ticket, Edit, Package, X, Save, Image as ImageIcon, Shield, RefreshCw, ShoppingBag, Activity, Sliders } from 'lucide-react';
import toast from 'react-hot-toast';
import { PrizeService } from '../../../services/prizeService';
import { ConfigService } from '../../../services/configService';
import type { Prize, AppConfig } from '../../../types';
import { TimeService } from '../../../services/timeService';

import { useAdminAuth } from '../contexts/AdminAuthContext';

export const PrizesPage = () => {
    const { isReadOnly } = useAdminAuth();
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);

    // PERSISTENCIA DE CATÁLOGO (CARGA INSTANTÁNEA)
    useEffect(() => {
        const cached = localStorage.getItem('catalog_cache_v2');
        if (cached) {
            try {
                setPrizes(JSON.parse(cached));
            } catch (e) { console.error("Catalog cache error", e); }
        }
    }, []);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingPrize, setEditingPrize] = useState<Prize | null>(null);

    const INITIAL_FORM = {
        name: '',
        pointsRequired: 100,
        stock: 50,
        description: '',
        active: true,
        imageUrl: '',
        cashValue: 0,
        internalCost: 0,
        isInternal: false,
        requiresMinimumPurchase: false,
        minimumPurchaseAmount: 0,
        expirationDate: '',
        allowEmployeeOverride: false
    };
    const [formData, setFormData] = useState(INITIAL_FORM);

    const fetchPrizes = async () => {
        setIsUpdating(true);
        if (prizes.length === 0) setLoading(true);
        try {
            const data = await PrizeService.getAll();
            setPrizes(data);
            // Guardar en caché
            localStorage.setItem('catalog_cache_v2', JSON.stringify(data));
        } catch (error) {
            toast.error("Error cargando premios");
        } finally {
            setLoading(false);
            setIsUpdating(false);
        }
    };

    useEffect(() => {
        fetchPrizes();
        const unsubConfig = ConfigService.subscribe(setConfig);
        return () => unsubConfig();
    }, []);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (editingPrize) {
                await PrizeService.update(editingPrize.id, formData);
                toast.success('Premio actualizado');
            } else {
                await PrizeService.create(formData);
                toast.success('Premio creado correctamente');
            }
            closeModal();
            fetchPrizes();
        } catch (error) {
            toast.error('Error al guardar premio');
        }
    };

    const handleToggleActive = async (prize: Prize) => {
        if (isReadOnly) return;
        try {
            const newStatus = !prize.active;
            // Optimistic update
            setPrizes(prizes.map(p => p.id === prize.id ? { ...p, active: newStatus } : p));
            await PrizeService.update(prize.id, { active: newStatus });
            toast.success(`Premio ${newStatus ? 'activado' : 'desactivado'}`);
        } catch (error) {
            toast.error('Error al cambiar estado');
            fetchPrizes(); // Rollback
        }
    };

    const handleDelete = async (id: string, name: string) => {
        if (isReadOnly) return;
        if (!confirm(`¿Eliminar "${name}" ?\nEsta acción es irreversible.`)) return;
        try {
            await PrizeService.delete(id);
            toast.success('Premio eliminado');
            fetchPrizes();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const openCreateModal = () => {
        if (isReadOnly) return;
        setEditingPrize(null);
        setFormData(INITIAL_FORM);
        setIsModalOpen(true);
    };

    const openEditModal = (prize: Prize) => {
        if (isReadOnly) return;
        setEditingPrize(prize);
        setFormData({
            name: prize.name,
            pointsRequired: prize.pointsRequired,
            stock: prize.stock,
            description: prize.description || '',
            active: prize.active,
            imageUrl: prize.imageUrl || '',
            cashValue: prize.cashValue || 0,
            internalCost: prize.internalCost || 0,
            isInternal: prize.isInternal || false,
            requiresMinimumPurchase: prize.requiresMinimumPurchase || false,
            minimumPurchaseAmount: prize.minimumPurchaseAmount || 0,
            expirationDate: prize.expirationDate || '',
            allowEmployeeOverride: (prize as any).allowEmployeeOverride || false
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingPrize(null);
        setFormData(INITIAL_FORM);
    };

    return (
        <div className="space-y-8 animate-fade-in">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <Gift className="text-pink-500" /> Catálogo de Premios
                    </h1>
                    <p className="text-gray-500 mt-1">Administra los productos y vouchers disponibles para canje.</p>
                </div>

                {/* CARTEL DE ACTUALIZACIÓN DE STOCK */}
                {isUpdating && (
                    <div className="flex items-center gap-3 bg-pink-500 text-white px-6 py-3 rounded-2xl shadow-xl shadow-pink-200 animate-pulse transition-all">
                        <RefreshCw className="animate-spin" size={18} />
                        <span className="font-black text-sm tracking-widest uppercase">🔄 Sincronizando Stock y Premios...</span>
                    </div>
                )}

                {!isReadOnly && (
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        <div className="flex items-center gap-2 bg-white px-3 py-2 rounded-xl border border-gray-200 shadow-sm">
                            <div className="flex items-center gap-2 pr-3 border-r border-gray-100 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={async () => {
                                if (!config) return;
                                try {
                                    const newVal = !config.strictMinimumPurchaseBlock;
                                    const updatedConfig = { 
                                        ...config, 
                                        strictMinimumPurchaseBlock: newVal,
                                        ...(newVal ? { allowEmployeePrizeOverride: false } : {}) 
                                    };
                                    await ConfigService.save(updatedConfig);
                                    setConfig(updatedConfig);
                                    toast.success(newVal ? "Bloqueo General Activado" : "Bloqueo General Desactivado");
                                } catch (e) { toast.error("Error al guardar"); }
                            }}>
                                <div>
                                    <h4 className="text-[11px] font-bold text-red-600">Bloqueo Estricto</h4>
                                    <p className="text-[9px] text-gray-500">Prohíbe saltear mínimo</p>
                                </div>
                                <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${config?.strictMinimumPurchaseBlock ? 'bg-red-600' : 'bg-gray-200'}`}>
                                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${config?.strictMinimumPurchaseBlock ? 'translate-x-3.5' : 'translate-x-1'}`} />
                                </div>
                            </div>
                            
                            <div className="flex items-center gap-2 pl-1 cursor-pointer hover:bg-gray-50 p-1 rounded" onClick={async () => {
                                if (!config) return;
                                try {
                                    const newVal = !config.allowEmployeePrizeOverride;
                                    const updatedConfig = { 
                                        ...config, 
                                        allowEmployeePrizeOverride: newVal,
                                        ...(newVal ? { strictMinimumPurchaseBlock: false } : {}) 
                                    };
                                    await ConfigService.save(updatedConfig);
                                    setConfig(updatedConfig);
                                    toast.success(newVal ? "A Criterio del Empleado Activado" : "A Criterio del Empleado Desactivado");
                                } catch (e) { toast.error("Error al guardar"); }
                            }}>
                                <div>
                                    <h4 className="text-[11px] font-bold text-orange-600">A Criterio de Empleado</h4>
                                    <p className="text-[9px] text-gray-500">Permite saltear mínimo</p>
                                </div>
                                <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${config?.allowEmployeePrizeOverride ? 'bg-orange-500' : 'bg-gray-200'}`}>
                                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${config?.allowEmployeePrizeOverride ? 'translate-x-3.5' : 'translate-x-1'}`} />
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={openCreateModal}
                            className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-pink-200 transition flex items-center gap-2 active:scale-95 whitespace-nowrap"
                        >
                            <Plus size={20} /> Nuevo Premio
                        </button>
                    </div>
                )}
            </div>

            {/* WIDGET DE PRESUPUESTO Y ECUALIZACIÓN */}
            {(() => {
                const bolsaMensual = config?.masterCalculatorSettings?.bolsaMensualPuntos || 0;
                if (bolsaMensual <= 0) return null;
                
                const asignado = prizes.reduce((acc, p) => p.active ? acc + (p.pointsRequired * (p.stock || 0)) : acc, 0);
                const porcentaje = Math.min((asignado / bolsaMensual) * 100, 100);
                const estaPasado = asignado > bolsaMensual;
                const niveles = config?.masterCalculatorSettings?.distribucionNiveles || [];

                return (
                    <div className="space-y-4">
                        {/* Global Budget */}
                        <div className={`p-5 rounded-2xl border ${estaPasado ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                            <div className="flex justify-between items-end mb-2">
                                <div>
                                    <h3 className={`font-bold text-sm flex items-center gap-2 ${estaPasado ? 'text-red-800' : 'text-gray-500 uppercase tracking-wide text-xs'}`}>
                                        <Activity size={16} className={estaPasado ? "text-red-500" : "text-pink-500"}/> 
                                        Presupuesto de Catálogo (Mensual)
                                    </h3>
                                    <p className={`text-2xl font-black mt-1 ${estaPasado ? 'text-red-600' : 'text-gray-800'}`}>
                                        {asignado.toLocaleString('es-AR')} <span className="text-sm font-medium opacity-50">/ {bolsaMensual.toLocaleString('es-AR')} pts</span>
                                    </p>
                                </div>
                                {estaPasado && (
                                    <div className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm">
                                        ¡Límite excedido!
                                    </div>
                                )}
                            </div>
                            <div className="h-2 w-full bg-gray-100 rounded-full overflow-hidden mt-3">
                                <div 
                                    className={`h-full transition-all duration-1000 ${estaPasado ? 'bg-red-500' : 'bg-pink-500'}`} 
                                    style={{ width: `${porcentaje}%` }} 
                                />
                            </div>
                        </div>

                        {/* Receta de Ecualización */}
                        {niveles.length > 0 && (
                            <div className="bg-slate-900 rounded-2xl p-5 shadow-lg border border-slate-800">
                                <div className="flex items-center gap-2 mb-4">
                                    <Sliders className="text-emerald-400" size={18} />
                                    <h3 className="text-sm font-bold text-white uppercase tracking-widest">Receta de Ecualización (Objetivos)</h3>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                    {niveles.map(nivel => {
                                        const targetPoints = bolsaMensual * (nivel.pct / 100);
                                        // A heuristic to group matching prizes by point cost
                                        const assignedToLevel = prizes
                                            .filter(p => p.active && Math.abs(p.pointsRequired - nivel.costo) <= (nivel.costo * 0.1)) // 10% margin
                                            .reduce((acc, p) => acc + (p.pointsRequired * (p.stock || 0)), 0);
                                        
                                        const pctLevel = targetPoints > 0 ? Math.min((assignedToLevel / targetPoints) * 100, 100) : 0;
                                        const isDone = assignedToLevel >= targetPoints && targetPoints > 0;

                                        return (
                                            <div key={nivel.id} className="bg-slate-800/50 p-4 rounded-xl border border-slate-700">
                                                <div className="flex justify-between items-start mb-2">
                                                    <p className="text-sm font-bold text-slate-200 line-clamp-1">{nivel.nombre}</p>
                                                    <span className="text-[10px] font-black bg-slate-700 text-slate-300 px-2 py-0.5 rounded">
                                                        {nivel.pct}%
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-slate-400 mb-3 flex items-center gap-1">
                                                    <Ticket size={12} className="text-emerald-500"/>
                                                    Costo ref: {nivel.costo} pts
                                                </p>
                                                
                                                <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden mb-2">
                                                    <div 
                                                        className={`h-full transition-all duration-1000 ${isDone ? 'bg-emerald-500' : 'bg-blue-500'}`} 
                                                        style={{ width: `${pctLevel}%` }} 
                                                    />
                                                </div>
                                                
                                                <div className="flex justify-between text-[10px] font-bold">
                                                    <span className={isDone ? 'text-emerald-400' : 'text-slate-400'}>
                                                        {assignedToLevel.toLocaleString()} pts
                                                    </span>
                                                    <span className="text-slate-500">
                                                        Meta: {Math.floor(targetPoints).toLocaleString()} pts
                                                    </span>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                );
            })()}

            {/* Tabla */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                                <th className="p-4 pl-6">Premio / Producto</th>
                                <th className="p-4">Descripción</th>
                                <th className="p-4 text-center">Pts. Req.</th>
                                <th className="p-4 text-center">Stock</th>
                                <th className="p-4 text-center">Vencimiento</th>
                                <th className="p-4 text-center">Estado</th>
                                <th className="p-4 text-right pr-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {prizes.map((prize) => (
                                <tr key={prize.id} className="hover:bg-pink-50/20 transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-12 h-12 rounded-lg bg-gray-50 border border-gray-100 flex items-center justify-center overflow-hidden shrink-0">
                                                {prize.imageUrl ? (
                                                    <img src={prize.imageUrl} alt={prize.name} className="w-full h-full object-cover" />
                                                ) : (
                                                    <Gift size={20} className="text-pink-200" />
                                                )}
                                            </div>
                                            <div className="flex flex-col">
                                                <p className="font-bold text-gray-800">{prize.name}</p>
                                                {prize.isInternal && (
                                                    <span className="bg-blue-100 text-blue-700 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 uppercase mt-1 w-max">
                                                        <Shield size={10} /> Test
                                                    </span>
                                                )}
                                                {prize.requiresMinimumPurchase && (
                                                    <span className="bg-orange-100 text-orange-700 text-[10px] font-black px-2 py-0.5 rounded flex items-center gap-1 uppercase mt-1 w-max">
                                                        <ShoppingBag size={10} /> Compra Min: ${prize.minimumPurchaseAmount?.toLocaleString('es-AR')}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <p className="text-gray-500 text-xs max-w-[200px] line-clamp-2">{prize.description || '-'}</p>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex items-center gap-1 font-bold text-pink-600 bg-pink-50 px-2 py-1 rounded-md border border-pink-100">
                                            <Ticket size={14} /> {prize.pointsRequired}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`inline-flex items-center gap-1 font-bold px-2 py-1 rounded-md ${prize.stock > 0 ? 'text-gray-700 bg-gray-100' : 'text-red-600 bg-red-50'} `}>
                                            <Package size={14} /> {prize.stock}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className={`text-xs font-medium px-2 py-1 rounded-md ${prize.expirationDate ? (TimeService.isExpired(prize.expirationDate) ? 'bg-red-50 text-red-600' : 'bg-blue-50 text-blue-600') : 'text-gray-400'}`}>
                                            {prize.expirationDate ? TimeService.formatDisplayDate(prize.expirationDate) : 'Sin fecha'}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <button
                                            onClick={() => handleToggleActive(prize)}
                                            disabled={isReadOnly}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none ${prize.active ? 'bg-green-500' : 'bg-gray-200'}`}
                                            title={prize.active ? 'Desactivar' : 'Activar'}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${prize.active ? 'translate-x-6' : 'translate-x-1'}`}
                                            />
                                        </button>
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        <div className="flex justify-end gap-2">
                                            {!isReadOnly && (
                                                <>
                                                    <button
                                                        onClick={() => openEditModal(prize)}
                                                        className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                        title="Editar"
                                                    >
                                                        <Edit size={16} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(prize.id, prize.name)}
                                                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={16} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {prizes.length === 0 && !loading && (
                                <tr>
                                    <td colSpan={6} className="p-12 text-center text-gray-400">
                                        <div className="flex flex-col items-center justify-center">
                                            <Gift size={48} className="mb-4 opacity-20" />
                                            <p className="font-medium">Lista de premios vacía</p>
                                            <p className="text-xs">Crea el primer ítem para comenzar.</p>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Modal Create/Edit */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-up max-h-[90vh] flex flex-col">
                        <div className="px-6 py-4 bg-pink-50 border-b border-pink-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-pink-900">
                                {editingPrize ? 'Editar Premio' : 'Nuevo Premio'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 rounded-full p-1"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6 overflow-y-auto">

                            {/* Selector de premios de la Calculadora Maestra */}
                            {!editingPrize && (config?.masterCalculatorSettings?.distribucionNiveles?.length || 0) > 0 && (
                                <div className="bg-slate-900 text-white p-4 rounded-xl space-y-2 border border-slate-800 shadow-inner">
                                    <label className="block text-xs font-bold text-emerald-400 uppercase tracking-widest flex items-center gap-1.5">
                                        <Sliders size={14} /> Importar desde la Calculadora Maestra
                                    </label>
                                    <select
                                        className="w-full bg-slate-800 text-slate-100 border border-slate-700 rounded-lg p-2.5 text-sm font-bold outline-none focus:border-emerald-500"
                                        onChange={(e) => {
                                            const selectedId = e.target.value;
                                            if (!selectedId) return;
                                            const nivel = config?.masterCalculatorSettings?.distribucionNiveles?.find(n => n.id === selectedId);
                                            if (nivel) {
                                                const isVoucher = (nivel as any).type === 'voucher' || (typeof nivel.nombre === 'string' && nivel.nombre.toLowerCase().includes('voucher'));
                                                const cashVal = isVoucher ? ((nivel as any).voucherValue || Number(nivel.nombre.replace(/[^0-9]/g, '')) || 0) : ((nivel as any).publicPrice || 0);
                                                const costVal = isVoucher ? cashVal : ((nivel as any).internalCost || Math.round(cashVal * 0.5));
                                                const mult = config?.masterCalculatorSettings?.umbralMultiplicador || 7;
                                                const requiresMin = isVoucher && cashVal > 0;
                                                const ownMargin = (!isVoucher && cashVal > costVal && cashVal > 0) ? ((cashVal - costVal) / cashVal) : 0.50;
                                                const minAmt = isVoucher ? (cashVal * mult) : Math.ceil((costVal / Math.max(0.1, ownMargin)) / 100) * 100;
                                                const bolsa = config?.masterCalculatorSettings?.bolsaMensualPuntos || 0;
                                                const targetPts = bolsa * ((nivel.pct || 0) / 100);
                                                const suggestedStock = nivel.costo > 0 && targetPts > 0 ? Math.floor(targetPts / nivel.costo) : 50;

                                                setFormData(prev => ({
                                                    ...prev,
                                                    name: nivel.nombre,
                                                    pointsRequired: nivel.costo,
                                                    cashValue: cashVal,
                                                    internalCost: costVal,
                                                    stock: suggestedStock > 0 ? suggestedStock : 50,
                                                    requiresMinimumPurchase: requiresMin,
                                                    minimumPurchaseAmount: minAmt
                                                }));
                                                toast.success(`Cargado: ${nivel.nombre}`);
                                            }
                                        }}
                                        defaultValue=""
                                    >
                                        <option value="" disabled>-- Elegir premio preconfigurado --</option>
                                        {config?.masterCalculatorSettings?.distribucionNiveles?.map((n) => (
                                            <option key={n.id} value={n.id}>
                                                {n.nombre} ({n.costo} pts - {n.pct}% del presupuesto)
                                            </option>
                                        ))}
                                    </select>
                                    <p className="text-[10px] text-slate-400">
                                        Selecciona una opción para autocompletar el nombre, puntos, valor y compra mínima. O completa los campos abajo si deseas inventar un premio nuevo.
                                    </p>
                                </div>
                            )}

                            {/* Nombre y Desc */}
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Nombre del Premio</label>
                                    <input
                                        type="text" required
                                        placeholder="Ej: Voucher $1000"
                                        className="w-full rounded-lg border-gray-200 border p-3 outline-none focus:ring-2 focus:ring-pink-100"
                                        value={formData.name}
                                        onChange={e => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Descripción (Opcional)</label>
                                    <textarea
                                        rows={2}
                                        placeholder="Detalles del canje..."
                                        className="w-full rounded-lg border-gray-200 border p-3 outline-none focus:ring-2 focus:ring-pink-100 resize-none"
                                        value={formData.description}
                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Grid 2Cols: Puntos & Stock */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Puntos Requeridos</label>
                                    <div className="relative">
                                        <Ticket className="absolute left-3 top-1/2 -translate-y-1/2 text-pink-400" size={16} />
                                        <input
                                            type="number" required min="1"
                                            className="w-full pl-10 rounded-lg border-gray-200 border p-3 font-bold text-pink-600 outline-none focus:ring-2 focus:ring-pink-100"
                                            value={formData.pointsRequired}
                                            onChange={e => setFormData({ ...formData, pointsRequired: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Stock Disponible</label>
                                    <div className="relative">
                                        <Package className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                        <input
                                            type="number" required min="0"
                                            className="w-full pl-10 rounded-lg border-gray-200 border p-3 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-pink-100"
                                            value={formData.stock}
                                            onChange={e => setFormData({ ...formData, stock: parseInt(e.target.value) || 0 })}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Grid 2Cols: Precio Público & Costo Interno */}
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Precio Público / Valor ($)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</div>
                                        <input
                                            type="number"
                                            className="w-full pl-8 rounded-lg border-blue-200 border p-3 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 bg-blue-50/20"
                                            value={formData.cashValue || ''}
                                            onChange={e => setFormData({ ...formData, cashValue: parseInt(e.target.value) || 0 })}
                                            placeholder="Ej: 7300"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Valor percibido / Métrica comercial.</p>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Costo Real Interno ($)</label>
                                    <div className="relative">
                                        <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 font-bold">$</div>
                                        <input
                                            type="number"
                                            className="w-full pl-8 rounded-lg border-slate-200 border p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-slate-100 bg-slate-50"
                                            value={formData.internalCost || ''}
                                            onChange={e => setFormData({ ...formData, internalCost: parseInt(e.target.value) || 0 })}
                                            placeholder="Ej: 3566"
                                        />
                                    </div>
                                    <p className="text-[10px] text-gray-400 mt-1 ml-1">Costo de insumos de cocina.</p>
                                </div>
                            </div>


                            {/* URL Imagen (Simple por ahora) */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">URL Imagen (Opcional)</label>
                                <div className="relative">
                                    <ImageIcon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                                    <input
                                        type="text"
                                        placeholder="https://..."
                                        className="w-full pl-10 rounded-lg border-gray-200 border p-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-pink-100"
                                        value={formData.imageUrl}
                                        onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                    />
                                </div>
                            </div>

                            {/* Fecha de Vencimiento */}
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Fecha de Vencimiento (Opcional)</label>
                                <div className="relative">
                                    <input
                                        type="date"
                                        className="w-full rounded-lg border-gray-200 border p-3 text-sm text-gray-600 outline-none focus:ring-2 focus:ring-pink-100"
                                        value={formData.expirationDate}
                                        onChange={e => setFormData({ ...formData, expirationDate: e.target.value })}
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">El premio dejará de ser visible después de esta fecha.</p>
                            </div>

                            <div className="space-y-4">
                                <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-xl border border-blue-100 cursor-pointer" onClick={() => setFormData({ ...formData, isInternal: !formData.isInternal })}>
                                    <div className="flex-1">
                                        <h4 className="text-sm font-bold text-blue-800">Premio Interno / Modo Test</h4>
                                        <p className="text-[10px] text-blue-600">Visible solo para administradores y cajeros.</p>
                                    </div>
                                    <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.isInternal ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${formData.isInternal ? 'translate-x-5' : 'translate-x-1'}`} />
                                    </div>
                                </div>
                                
                                <div className="flex flex-col gap-2 p-3 bg-orange-50 rounded-xl border border-orange-100">
                                    <div className="flex items-center gap-3 cursor-pointer" onClick={() => {
                                        const newToggled = !formData.requiresMinimumPurchase;
                                        const isVoucher = formData.name.toLowerCase().includes('voucher');
                                        let newVal = 0;
                                        if (newToggled) {
                                            if (isVoucher) {
                                                const mult = config?.masterCalculatorSettings?.umbralMultiplicador || 7;
                                                newVal = (formData.cashValue || 0) * mult;
                                            } else {
                                                // Mantenimiento de costo en Casa de Pastas:
                                                // Compra Mínima = Costo Interno / Margen de Ganancia del Negocio (70%)
                                                const nivelPreset = config?.masterCalculatorSettings?.distribucionNiveles?.find(
                                                    n => n.nombre.toLowerCase() === formData.name.toLowerCase()
                                                );
                                                const internalCost = formData.internalCost || (nivelPreset as any)?.internalCost || ((formData.cashValue || 0) * 0.5);
                                                const ownMargin = (formData.cashValue > internalCost && formData.cashValue > 0) ? ((formData.cashValue - internalCost) / formData.cashValue) : 0.50;
                                                const rawMin = internalCost > 0 ? (internalCost / Math.max(0.1, ownMargin)) : (formData.cashValue || 0);
                                                newVal = Math.ceil(rawMin / 100) * 100;
                                            }
                                        }
                                        setFormData({ ...formData, requiresMinimumPurchase: newToggled, minimumPurchaseAmount: newVal });
                                    }}>
                                        <div className="flex-1">
                                            <div className="flex items-center gap-2">
                                                <h4 className="text-sm font-bold text-orange-800">Requiere Compra Mínima</h4>
                                                <span className="text-[9px] font-black uppercase bg-orange-200 text-orange-900 px-2 py-0.5 rounded">
                                                    {formData.name.toLowerCase().includes('voucher') ? 'Recomendado para Vouchers' : 'Opcional en Productos'}
                                                </span>
                                            </div>
                                            <p className="text-[10px] text-orange-600 mt-0.5">
                                                {formData.name.toLowerCase().includes('voucher')
                                                    ? 'Exige una compra mínima simultánea para aplicar el descuento del voucher.'
                                                    : 'Opcional: Exige una compra mínima en salsas/quesos para cubrir 100% el costo de los insumos del producto.'
                                                }
                                            </p>
                                        </div>
                                        <div className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${formData.requiresMinimumPurchase ? 'bg-orange-600' : 'bg-gray-200'}`}>
                                            <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${formData.requiresMinimumPurchase ? 'translate-x-5' : 'translate-x-1'}`} />
                                        </div>
                                    </div>
                                    {formData.requiresMinimumPurchase && (
                                        <div className="mt-2 pl-2 border-l-2 border-orange-200 animate-fade-in flex flex-col gap-3">
                                            <div>
                                                <label className="text-xs font-bold text-orange-800 block mb-1">Monto Mínimo de Compra ($)</label>
                                                <input
                                                    type="number"
                                                    required={formData.requiresMinimumPurchase}
                                                    value={formData.minimumPurchaseAmount || ''}
                                                    onChange={e => setFormData({ ...formData, minimumPurchaseAmount: Number(e.target.value) })}
                                                    className="w-full px-3 py-2 bg-white border border-orange-200 rounded-lg text-sm font-bold outline-none focus:border-orange-500"
                                                />
                                                {(() => {
                                                    const isVoucher = formData.name.toLowerCase().includes('voucher');
                                                    const internalCost = formData.internalCost || ((formData.cashValue || 0) * 0.5);
                                                    const ownMargin = (formData.cashValue > internalCost && formData.cashValue > 0) ? ((formData.cashValue - internalCost) / formData.cashValue) : 0.50;
                                                    const rawMin = internalCost > 0 ? (internalCost / Math.max(0.1, ownMargin)) : (formData.cashValue || 0);
                                                    const suggestedMin = Math.ceil(rawMin / 100) * 100;
                                                    const marginPct = (ownMargin * 100).toFixed(1);
                                                    
                                                    if (isVoucher) {
                                                        return (
                                                            <p className="text-[10px] text-orange-600 mt-1 font-medium">
                                                                💡 Sugerido para Voucher: Multiplicador x7 (${suggestedMin.toLocaleString('es-AR')}). Puedes modificar este monto manualmente.
                                                            </p>
                                                        );
                                                    }
                                                    
                                                    return (
                                                        <div className="mt-1 bg-white/80 p-2 rounded-lg border border-orange-200/60">
                                                            <p className="text-[10px] text-orange-800 font-bold">
                                                                💡 Sugerido por Calculadora: ${suggestedMin.toLocaleString('es-AR')}
                                                            </p>
                                                            {internalCost > 0 && (
                                                                <p className="text-[9px] text-orange-700/80 mt-0.5 font-medium">
                                                                    Fórmula: Costo ${internalCost.toLocaleString('es-AR')} / Margen {marginPct}% = ${Math.round(rawMin).toLocaleString('es-AR')} → Sugerido ${suggestedMin.toLocaleString('es-AR')} (Puedes cambiarlo manualmente arriba)
                                                                </p>
                                                            )}
                                                        </div>
                                                    );
                                                })()}
                                            </div>
                                            <div className="flex items-center gap-3 cursor-pointer p-2 bg-white/50 rounded-lg" onClick={() => {
                                                setFormData({ ...formData, allowEmployeeOverride: !formData.allowEmployeeOverride });
                                            }}>
                                                <div className="flex-1">
                                                    <h4 className="text-xs font-bold text-gray-700">A Criterio del Empleado</h4>
                                                    <p className="text-[10px] text-gray-500">Permite al operador destildar la exigencia y entregar el premio igual.</p>
                                                </div>
                                                <div className={`relative inline-flex h-4 w-7 items-center rounded-full transition-colors ${formData.allowEmployeeOverride ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                                    <span className={`inline-block h-2.5 w-2.5 transform rounded-full bg-white transition-transform ${formData.allowEmployeeOverride ? 'translate-x-3.5' : 'translate-x-1'}`} />
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Active Toggle */}
                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg cursor-pointer" onClick={() => setFormData({ ...formData, active: !formData.active })}>
                                <div className={`w-10 h-6 rounded-full p-1 transition-colors ${formData.active ? 'bg-green-500' : 'bg-gray-300'}`}>
                                    <div className={`w-4 h-4 bg-white rounded-full transition-transform ${formData.active ? 'translate-x-4' : ''}`} />
                                </div>
                                <span className="text-sm font-medium text-gray-700">Premio Activo (Visible para canje)</span>
                            </div>

                            <div className="flex gap-3 pt-4 border-t border-gray-50">
                                <button type="button" onClick={closeModal} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-100 rounded-xl">Cancelar</button>
                                <button type="submit" className="flex-1 py-3 bg-pink-500 hover:bg-pink-600 text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2">
                                    <Save size={18} /> Guardar
                                </button>
                            </div>
                        </form>
                    </div >
                </div >
            )}
        </div >
    );
};
