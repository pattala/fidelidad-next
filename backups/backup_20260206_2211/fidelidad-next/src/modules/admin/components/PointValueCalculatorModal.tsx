import React, { useState, useEffect } from 'react';
import { X, Calculator, DollarSign, TrendingUp, AlertCircle, CheckCircle } from 'lucide-react';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import type { AppConfig } from '../../../types';

interface PointValueCalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: AppConfig;
    onSave: (newConfig: Partial<AppConfig>) => void;
}

export const PointValueCalculatorModal = ({ isOpen, onClose, config, onSave }: PointValueCalculatorModalProps) => {
    const [method, setMethod] = useState<'manual' | 'average' | 'budget'>(
        config.pointCalculationMethod || (config.useAutomaticPointValue ? 'average' : 'manual')
    );

    // Values
    const [manualVal, setManualVal] = useState<number>(config.pointValue || 10);
    const [budgetVal, setBudgetVal] = useState<number>(config.pointValueBudget || 20000);

    // Calculated Stats
    const [avgPrizeValue, setAvgPrizeValue] = useState<number>(0);
    const [totalPoints, setTotalPoints] = useState<number>(0);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchData();
        }
    }, [isOpen]);

    const fetchData = async () => {
        setLoading(true);
        try {
            // 1. Calculate Average Prize Value
            const qPrizes = query(collection(db, 'prizes'), where('active', '==', true));
            const snapPrizes = await getDocs(qPrizes);
            let totalRatio = 0;
            let validPrizesCount = 0;
            snapPrizes.forEach(doc => {
                const p = doc.data();
                if (p.cashValue && p.pointsRequired > 0) {
                    totalRatio += (p.cashValue / p.pointsRequired);
                    validPrizesCount++;
                }
            });
            setAvgPrizeValue(validPrizesCount > 0 ? (totalRatio / validPrizesCount) : 0);

            // 2. Calculate Total Points (Approximate for Calculator)
            // Fetch users to sum points. Ideally use an aggregation query if available/scalable
            const qUsers = collection(db, 'users');
            const snapUsers = await getDocs(qUsers);
            let pts = 0;
            snapUsers.forEach(doc => {
                pts += (doc.data().points || 0);
            });
            setTotalPoints(pts);

        } catch (error) {
            console.error("Error fetching calculator data", error);
        } finally {
            setLoading(false);
        }
    };

    const handleSave = () => {
        onSave({
            pointCalculationMethod: method,
            pointValue: manualVal,
            pointValueBudget: budgetVal,
            useAutomaticPointValue: method === 'average' // Keep for legacy compat if needed
        });
        onClose();
    };

    const calculatedBudgetPointValue = totalPoints > 0 ? (budgetVal / totalPoints) : 0;

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
                {/* Header */}
                <div className="bg-blue-600 p-6 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="bg-white/20 p-2 rounded-lg">
                            <Calculator size={24} />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold">Calculadora de Valor del Punto</h2>
                            <p className="text-blue-100 text-sm">Define cómo quieres evaluar tu deuda en puntos.</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="text-white/70 hover:text-white transition">
                        <X size={24} />
                    </button>
                </div>

                {/* Body */}
                <div className="p-8 overflow-y-auto">
                    {loading ? (
                        <div className="flex flex-col items-center justify-center h-48 space-y-4">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                            <p className="text-gray-500">Analizando datos del sistema...</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                            {/* Option 1: Manual */}
                            <div
                                onClick={() => setMethod('manual')}
                                className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${method === 'manual' ? 'border-blue-500 bg-blue-50/50' : 'border-gray-100 hover:border-blue-200'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-green-100 text-green-700 p-2 rounded-lg"><DollarSign size={20} /></div>
                                    {method === 'manual' && <CheckCircle className="text-blue-500" size={24} />}
                                </div>
                                <h3 className="font-bold text-gray-800 mb-2">Valor Manual</h3>
                                <p className="text-xs text-gray-500 mb-4 h-10">Tú defines un valor fijo arbitrario. Útil si tienes un estándar contable interno.</p>

                                <div className="mt-4">
                                    <label className="text-xs font-bold text-gray-400 uppercase">Valor por Punto</label>
                                    <div className="relative mt-1">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                        <input
                                            type="number"
                                            value={manualVal}
                                            onChange={(e) => setManualVal(parseFloat(e.target.value) || 0)}
                                            className="w-full pl-6 py-2 border rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-blue-500 outline-none"
                                            disabled={method !== 'manual'}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Option 2: Average */}
                            <div
                                onClick={() => setMethod('average')}
                                className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${method === 'average' ? 'border-purple-500 bg-purple-50/50' : 'border-gray-100 hover:border-purple-200'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-purple-100 text-purple-700 p-2 rounded-lg"><TrendingUp size={20} /></div>
                                    {method === 'average' && <CheckCircle className="text-purple-500" size={24} />}
                                </div>
                                <h3 className="font-bold text-gray-800 mb-2">Promedio de Premios</h3>
                                <p className="text-xs text-gray-500 mb-4 h-10">Calculado automáticamente según el valor de venta de tus premios activos.</p>

                                <div className="mt-4 bg-white p-3 rounded-lg border border-purple-100 text-center">
                                    <span className="block text-xs text-purple-400 font-bold uppercase mb-1">Cálculo Actual</span>
                                    <span className="text-2xl font-black text-purple-600">${avgPrizeValue.toFixed(2)}</span>
                                </div>
                            </div>

                            {/* Option 3: Budget */}
                            <div
                                onClick={() => setMethod('budget')}
                                className={`relative p-6 rounded-xl border-2 cursor-pointer transition-all hover:shadow-md ${method === 'budget' ? 'border-orange-500 bg-orange-50/50' : 'border-gray-100 hover:border-orange-200'}`}
                            >
                                <div className="flex justify-between items-start mb-4">
                                    <div className="bg-orange-100 text-orange-700 p-2 rounded-lg"><AlertCircle size={20} /></div>
                                    {method === 'budget' && <CheckCircle className="text-orange-500" size={24} />}
                                </div>
                                <h3 className="font-bold text-gray-800 mb-2">Presupuesto Mensual</h3>
                                <p className="text-xs text-gray-500 mb-4 h-10">Calcula cuánto debe valer el punto para ajustarse a tu límite de gasto.</p>

                                <div className="space-y-3 mt-2">
                                    <div>
                                        <label className="text-xs font-bold text-gray-400 uppercase">Presupuesto ($)</label>
                                        <input
                                            type="number"
                                            value={budgetVal}
                                            onChange={(e) => setBudgetVal(parseFloat(e.target.value) || 0)}
                                            className="w-full mt-1 px-3 py-2 border rounded-lg font-bold text-gray-800 focus:ring-2 focus:ring-orange-500 outline-none text-right"
                                            disabled={method !== 'budget'}
                                        />
                                    </div>
                                    <div className={`text-right ${totalPoints === 0 ? 'opacity-50' : ''}`}>
                                        <span className="text-xs text-gray-400 mr-2">Puntos Circulantes: <strong>{totalPoints.toLocaleString()}</strong></span>
                                        <div className="text-orange-600 font-black text-xl">
                                            = ${calculatedBudgetPointValue.toFixed(4)} <span className="text-xs font-normal text-gray-500">/pt</span>
                                        </div>
                                    </div>
                                </div>
                            </div>

                        </div>
                    )}

                    {/* Simulation / Info Footer */}
                    {!loading && (
                        <div className={`mt-8 p-4 rounded-xl border flex items-center justify-between ${method === 'budget' && (totalPoints * avgPrizeValue) > budgetVal
                                ? 'bg-red-50 border-red-200'
                                : 'bg-gray-50 border-gray-200'
                            }`}>
                            <div>
                                <h4 className="font-bold text-gray-700">Resumen del Impacto</h4>
                                <p className="text-sm text-gray-500">
                                    {method === 'budget' ? (
                                        <span>Comparando tu <strong>Presupuesto</strong> vs <strong>Realidad de Premios</strong>:</span>
                                    ) : (
                                        <span>
                                            Con el método <strong>{method === 'manual' ? 'Manual' : 'Promedio'}</strong> seleccionado,
                                            tu pasivo total estimado es:
                                        </span>
                                    )}
                                </p>
                            </div>

                            <div className="text-right">
                                {method === 'budget' ? (
                                    <div className="flex flex-col items-end">
                                        <div className="mb-1 text-xs text-gray-500">
                                            Pasivo Real (según premios): <strong className="text-gray-700">${(totalPoints * avgPrizeValue).toLocaleString()}</strong>
                                        </div>
                                        <div className={`text-2xl font-black ${(totalPoints * avgPrizeValue) > budgetVal ? 'text-red-600' : 'text-green-600'}`}>
                                            {((totalPoints * avgPrizeValue) - budgetVal) > 0 ? '+' : ''}
                                            $ {((totalPoints * avgPrizeValue) - budgetVal).toLocaleString()}
                                        </div>
                                        <span className={`text-xs font-bold uppercase tracking-wider ${(totalPoints * avgPrizeValue) > budgetVal ? 'text-red-400' : 'text-green-500'}`}>
                                            {(totalPoints * avgPrizeValue) > budgetVal ? 'Sobre Presupuesto' : 'Dentro del Presupuesto'}
                                        </span>
                                    </div>
                                ) : (
                                    <>
                                        <span className="block text-3xl font-black text-gray-800">
                                            $ {
                                                (method === 'manual' ? (totalPoints * manualVal) :
                                                    (totalPoints * avgPrizeValue)).toLocaleString()
                                            }
                                        </span>
                                        <span className="text-xs text-gray-400 uppercase font-bold tracking-wider">Deuda Total Estimada</span>
                                    </>
                                )}
                            </div>
                        </div>
                    )}
                </div>

                {/* Footer Actions */}
                <div className="p-6 border-t border-gray-100 flex justify-end gap-3 shrink-0">
                    <button
                        onClick={onClose}
                        className="px-5 py-2.5 text-gray-500 hover:text-gray-700 font-bold transition"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        className="px-6 py-2.5 bg-blue-600 text-white rounded-lg font-bold hover:bg-blue-700 shadow-lg shadow-blue-200 transition"
                    >
                        Aplicar Configuración
                    </button>
                </div>
            </div>
        </div>
    );
};
