import React from 'react';
import { Gift, AlertTriangle, Plus, Trash2 } from 'lucide-react';
import type { AppConfig } from '../../../types';

export const MysteryBoxConfig = ({ config, setConfig }: { config: AppConfig, setConfig: (config: AppConfig) => void }) => {
    const mb = config.mysteryBox || {
        enabled: false,
        minAmount: 15000,
        pointsExpirationDays: 15,
        chanceDeadlineMinutes: 60,
        resendDeadlineMinutes: 60,
        enableCashierAlert: true,
        cashierMessage: "Avisar al cliente de la Caja Sorpresa",
        prizeScales: []
    };

    const updateMb = (updates: Partial<typeof mb>) => {
        setConfig({
            ...config,
            mysteryBox: { ...mb, ...updates }
        });
    };

    const addScale = () => {
        const newScale = {
            id: 'sc_' + Date.now(),
            minPoints: 1,
            maxPoints: 5,
            probabilityPct: 10
        };
        updateMb({ prizeScales: [...mb.prizeScales, newScale] });
    };

    const updateScale = (id: string, updates: any) => {
        const newScales = mb.prizeScales.map(s => s.id === id ? { ...s, ...updates } : s);
        updateMb({ prizeScales: newScales });
    };

    const removeScale = (id: string) => {
        updateMb({ prizeScales: mb.prizeScales.filter(s => s.id !== id) });
    };

    const totalProb = mb.prizeScales.reduce((acc, s) => acc + s.probabilityPct, 0);

    return (
        <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4">
            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                <div className="flex items-center justify-between mb-8 pb-6 border-b border-gray-100">
                    <div className="flex items-center gap-4">
                        <div className="bg-orange-50 p-4 rounded-2xl text-orange-600">
                            <Gift size={32} />
                        </div>
                        <div>
                            <h2 className="text-2xl font-black text-gray-800 tracking-tight">Motor de Sorteos (Cajas Sorpresa)</h2>
                            <p className="text-gray-500 mt-1">Configuración del juego instantáneo para premiar compras.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input type="checkbox" className="sr-only peer" checked={mb.enabled} onChange={(e) => updateMb({ enabled: e.target.checked })} />
                        <div className="w-14 h-7 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-orange-500"></div>
                        <span className="ml-3 text-sm font-bold text-gray-700">
                            {mb.enabled ? 'ACTIVADO' : 'APAGADO'}
                        </span>
                    </label>
                </div>

                {mb.enabled && (
                    <div className="space-y-8">
                        {/* REGLAS GENERALES */}
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Monto Mínimo de Compra ($)</label>
                                <input
                                    type="number"
                                    value={mb.minAmount}
                                    onChange={e => updateMb({ minAmount: Number(e.target.value) })}
                                    className="w-full border-gray-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 text-lg p-3"
                                />
                                <p className="text-xs text-gray-500 mt-2">Compras por encima de este valor generarán un QR de sorteo.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Vencimiento Corto (Días)</label>
                                <input
                                    type="number"
                                    value={mb.pointsExpirationDays}
                                    onChange={e => updateMb({ pointsExpirationDays: Number(e.target.value) })}
                                    className="w-full border-gray-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 text-lg p-3"
                                />
                                <p className="text-xs text-gray-500 mt-2">Los puntos ganados en el sorteo vencerán rápido para generar retorno.</p>
                            </div>
                        </div>

                        {/* DEADLINES */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Deadline para Jugar (Minutos)</label>
                                <input
                                    type="number"
                                    value={mb.chanceDeadlineMinutes || 60}
                                    onChange={e => updateMb({ chanceDeadlineMinutes: Number(e.target.value) })}
                                    className="w-full border-gray-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 p-3"
                                />
                                <p className="text-xs text-gray-500 mt-2">Tiempo máximo que tiene el cliente para escanear y abrir la caja.</p>
                            </div>
                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Deadline de Reenvío del Cajero (Minutos)</label>
                                <input
                                    type="number"
                                    value={mb.resendDeadlineMinutes || 60}
                                    onChange={e => updateMb({ resendDeadlineMinutes: Number(e.target.value) })}
                                    className="w-full border-gray-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 p-3"
                                />
                                <p className="text-xs text-gray-500 mt-2">Tiempo que el QR estará disponible en la solapa del panel de control.</p>
                            </div>
                        </div>

                        {/* MENSAJE CAJERO */}
                        <div className="bg-gray-50 p-6 rounded-2xl border border-gray-100 space-y-4">
                            <div className="flex items-center justify-between">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700">Aviso de Refuerzo para el Cajero</h3>
                                    <p className="text-xs text-gray-500">Activa si querés que salte una notificación extra en la extensión.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={mb.enableCashierAlert ?? true} onChange={(e) => updateMb({ enableCashierAlert: e.target.checked })} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>
                            
                            {mb.enableCashierAlert && (
                                <div>
                                    <label className="block text-xs font-bold text-gray-500 mb-2">Mensaje del Aviso</label>
                                    <input
                                        type="text"
                                        value={mb.cashierMessage}
                                        onChange={e => updateMb({ cashierMessage: e.target.value })}
                                        className="w-full border-gray-200 rounded-xl focus:ring-orange-500 focus:border-orange-500 p-3"
                                    />
                                    <p className="text-xs text-gray-400 mt-2">Este texto aparece en la alerta visual del punto de venta.</p>
                                </div>
                            )}
                        </div>

                        {/* ESCALAS DE PREMIOS */}
                        <div className="pt-6 border-t border-gray-100">
                            <div className="flex items-center justify-between mb-4">
                                <div>
                                    <h3 className="text-lg font-bold text-gray-800">Escalas de Premios y Probabilidades</h3>
                                    <p className="text-sm text-gray-500">Configurá los rangos de puntos y qué tan probable es que salgan.</p>
                                </div>
                                <button
                                    type="button"
                                    onClick={addScale}
                                    className="px-4 py-2 bg-orange-100 text-orange-600 rounded-lg font-bold text-sm hover:bg-orange-200 transition flex items-center gap-2"
                                >
                                    <Plus size={16} />
                                    Añadir Rango
                                </button>
                            </div>

                            {totalProb !== 100 && mb.prizeScales.length > 0 && (
                                <div className="mb-4 bg-red-50 text-red-600 p-3 rounded-lg flex items-center gap-2 text-sm font-bold">
                                    <AlertTriangle size={16} />
                                    ¡Atención! La suma de probabilidades es {totalProb}%. Debe ser exactamente 100%.
                                </div>
                            )}

                            <div className="space-y-3">
                                {mb.prizeScales.map((scale, index) => (
                                    <div key={scale.id} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                                        <div className="w-8 h-8 bg-gray-100 rounded-lg flex items-center justify-center font-black text-gray-400">
                                            {index + 1}
                                        </div>
                                        <div className="flex-1 grid grid-cols-3 gap-4">
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Puntos Mínimos</label>
                                                <input
                                                    type="number"
                                                    value={scale.minPoints}
                                                    onChange={e => updateScale(scale.id, { minPoints: Number(e.target.value) })}
                                                    className="w-full border-gray-200 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Puntos Máximos</label>
                                                <input
                                                    type="number"
                                                    value={scale.maxPoints}
                                                    onChange={e => updateScale(scale.id, { maxPoints: Number(e.target.value) })}
                                                    className="w-full border-gray-200 rounded-lg text-sm"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">Probabilidad (%)</label>
                                                <input
                                                    type="number"
                                                    value={scale.probabilityPct}
                                                    onChange={e => updateScale(scale.id, { probabilityPct: Number(e.target.value) })}
                                                    className={`w-full border-gray-200 rounded-lg text-sm ${scale.probabilityPct <= 0 ? 'bg-red-50' : ''}`}
                                                />
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => removeScale(scale.id)}
                                            className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                        >
                                            <Trash2 size={20} />
                                        </button>
                                    </div>
                                ))}
                                {mb.prizeScales.length === 0 && (
                                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200 border-dashed">
                                        <p className="text-gray-500 font-medium">No hay rangos configurados. Agregá uno para empezar.</p>
                                    </div>
                                )}
                            </div>
                        </div>

                    </div>
                )}
            </div>
        </div>
    );
};
