
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Gift, Ticket, Edit, Package, X, Save, Image as ImageIcon, Shield, RefreshCw, ShoppingBag } from 'lucide-react';
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
        isInternal: false,
        requiresMinimumPurchase: false,
        minimumPurchaseAmount: 0,
        expirationDate: ''
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
            isInternal: prize.isInternal || false,
            requiresMinimumPurchase: prize.requiresMinimumPurchase || false,
            minimumPurchaseAmount: prize.minimumPurchaseAmount || 0,
            expirationDate: prize.expirationDate || ''
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
                                try {
                                    const newVal = !config?.strictMinimumPurchaseBlock;
                                    await ConfigService.update({ 
                                        strictMinimumPurchaseBlock: newVal,
                                        ...(newVal ? { allowEmployeePrizeOverride: false } : {}) 
                                    });
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
                                try {
                                    const newVal = !config?.allowEmployeePrizeOverride;
                                    await ConfigService.update({ 
                                        allowEmployeePrizeOverride: newVal,
                                        ...(newVal ? { strictMinimumPurchaseBlock: false } : {}) 
                                    });
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

            {/* WIDGET DE PRESUPUESTO */}
            {(() => {
                const bolsaMensual = config?.masterCalculatorSettings?.bolsaMensualPuntos || 0;
                if (bolsaMensual <= 0) return null;
                
                const asignado = prizes.reduce((acc, p) => p.active ? acc + (p.pointsRequired * (p.stock || 0)) : acc, 0);
                const porcentaje = Math.min((asignado / bolsaMensual) * 100, 100);
                const estaPasado = asignado > bolsaMensual;

                return (
                    <div className={`p-5 rounded-2xl border ${estaPasado ? 'bg-red-50 border-red-200' : 'bg-white border-gray-100 shadow-sm'}`}>
                        <div className="flex justify-between items-end mb-2">
                            <div>
                                <h3 className={`font-bold text-sm ${estaPasado ? 'text-red-800' : 'text-gray-500 uppercase tracking-wide text-xs'}`}>Presupuesto de Catálogo (Mensual)</h3>
                                <p className={`text-2xl font-black mt-1 ${estaPasado ? 'text-red-600' : 'text-gray-800'}`}>
                                    {asignado.toLocaleString('es-AR')} <span className="text-sm font-medium opacity-50">/ {bolsaMensual.toLocaleString('es-AR')} pts</span>
                                </p>
                            </div>
                            {estaPasado && (
                                <div className="bg-red-100 text-red-700 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
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

                            {/* Grid 2Cols */}
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

                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Valor en Dinero (Estimado)</label>
                                <div className="relative">
                                    <div className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 font-bold">$</div>
                                    <input
                                        type="number"
                                        className="w-full pl-8 rounded-lg border-blue-200 border p-3 font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-100 bg-blue-50/20"
                                        value={formData.cashValue || ''}
                                        onChange={e => {
                                            const newCashValue = parseInt(e.target.value) || 0;
                                            let newMinPurchase = formData.minimumPurchaseAmount;
                                            if (formData.requiresMinimumPurchase) {
                                                const mult = config?.masterCalculatorSettings?.umbralMultiplicador || 7;
                                                newMinPurchase = newCashValue * mult;
                                            }
                                            setFormData({ ...formData, cashValue: newCashValue, minimumPurchaseAmount: newMinPurchase });
                                        }}
                                        placeholder="Ej: 5000"
                                    />
                                </div>
                                <p className="text-[10px] text-gray-400 mt-1 ml-1">Para reportes de "Dinero Devuelto".</p>
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
                                        // Sugerencia basada en el UMBRAL MULTIPLICADOR (Solapa C de la Calculadora)
                                        const mult = config?.masterCalculatorSettings?.umbralMultiplicador || 7;
                                        const newVal = newToggled ? ((formData.cashValue || 0) * mult) : 0;
                                        setFormData({ ...formData, requiresMinimumPurchase: newToggled, minimumPurchaseAmount: newVal });
                                    }}>
                                        <div className="flex-1">
                                            <h4 className="text-sm font-bold text-orange-800">Requiere Compra Mínima</h4>
                                            <p className="text-[10px] text-orange-600">Exige una compra mínima simultánea para poder canjearlo.</p>
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
                                                <p className="text-[10px] text-orange-500 mt-1">En el catálogo se mostrará: "Para canje compra mínima de ${Number(formData.minimumPurchaseAmount).toLocaleString('es-AR')}"</p>
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
