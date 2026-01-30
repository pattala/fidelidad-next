
import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Gift, Ticket, Edit, Package, X, Save, Image as ImageIcon } from 'lucide-react';
import toast from 'react-hot-toast';
import { PrizeService } from '../../../services/prizeService';
import type { Prize } from '../../../types';

export const PrizesPage = () => {
    const [prizes, setPrizes] = useState<Prize[]>([]);
    const [loading, setLoading] = useState(false);

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
        cashValue: 0
    };
    const [formData, setFormData] = useState(INITIAL_FORM);

    const fetchPrizes = async () => {
        setLoading(true);
        try {
            const data = await PrizeService.getAll();
            setPrizes(data);
        } catch (error) {
            toast.error("Error cargando premios");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPrizes();
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

    const handleDelete = async (id: string, name: string) => {
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
        setEditingPrize(null);
        setFormData(INITIAL_FORM);
        setIsModalOpen(true);
    };

    const openEditModal = (prize: Prize) => {
        setEditingPrize(prize);
        setFormData({
            name: prize.name,
            pointsRequired: prize.pointsRequired,
            stock: prize.stock,
            description: prize.description || '',
            active: prize.active,
            imageUrl: prize.imageUrl || '',
            cashValue: prize.cashValue || 0
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
                <button
                    onClick={openCreateModal}
                    className="bg-pink-500 hover:bg-pink-600 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-pink-200 transition flex items-center gap-2 active:scale-95"
                >
                    <Plus size={20} /> Nuevo Premio
                </button>
            </div>

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
                                            <p className="font-bold text-gray-800">{prize.name}</p>
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
                                        <span className={`inline - flex items - center gap - 1 font - bold px - 2 py - 1 rounded - md ${prize.stock > 0 ? 'text-gray-700 bg-gray-100' : 'text-red-600 bg-red-50'} `}>
                                            <Package size={14} /> {prize.stock}
                                        </span>
                                    </td>
                                    <td className="p-4 text-center">
                                        <div className={`inline - block w - 3 h - 3 rounded - full ${prize.active ? 'bg-green-500 shadow-sm shadow-green-300' : 'bg-gray-300'} `} title={prize.active ? 'Activo' : 'Inactivo'} />
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
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
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
                        <div className="px-6 py-4 bg-pink-50 border-b border-pink-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-pink-900">
                                {editingPrize ? 'Editar Premio' : 'Nuevo Premio'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 rounded-full p-1"><X size={20} /></button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6 space-y-6">

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
                                        onChange={e => setFormData({ ...formData, cashValue: parseInt(e.target.value) || 0 })}
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

                            {/* Active Toggle */}
                            <div className="flex items-center gap-3 bg-gray-50 p-3 rounded-lg cursor-pointer" onClick={() => setFormData({ ...formData, active: !formData.active })}>
                                <div className={`w - 10 h - 6 rounded - full p - 1 transition - colors ${formData.active ? 'bg-green-500' : 'bg-gray-300'} `}>
                                    <div className={`w - 4 h - 4 bg - white rounded - full transition - transform ${formData.active ? 'translate-x-4' : ''} `} />
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
