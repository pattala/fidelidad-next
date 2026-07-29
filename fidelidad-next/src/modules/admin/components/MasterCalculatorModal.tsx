import React, { useState, useEffect, useMemo } from 'react';
import { Calculator, DollarSign, Gift, X, CheckCircle, HelpCircle, Star, TrendingUp, AlertCircle, Activity, Ticket, Sliders } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppConfig } from '../../../types';

interface MasterCalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: AppConfig;
    onSave: (newConfig: Partial<AppConfig>) => void;
}

interface PhysicalReward {
    id: string;
    name: string;
    publicPrice: number;
    perceivedReturn: number;
    internalCost: number;
    manualPointsOverride?: number;
}

interface VoucherReward {
    id: string;
    value: number;
    manualPointsOverride?: number;
}

export const MasterCalculatorModal = ({ isOpen, onClose, config, onSave }: MasterCalculatorModalProps) => {
    // --- GLOBAL VARIABLES ---
    const [presupuestoMode, setPresupuestoMode] = useState<'pct' | 'fixed'>('pct');
    const [facturacionBruta, setFacturacionBruta] = useState<number>(8000000);
    const [porcentajeCeder, setPorcentajeCeder] = useState<number>(3);
    const [presupuestoFijo, setPresupuestoFijo] = useState<number>(150000);
    
    const [tasaCanje, setTasaCanje] = useState<number>(80);
    const [moneyPerPoint, setMoneyPerPoint] = useState<number>(1000);

    // --- PHYSICAL REWARDS ---
    const [physicalRewards, setPhysicalRewards] = useState<PhysicalReward[]>([
        { id: 'p1', name: 'Café Especialidad', publicPrice: 3500, perceivedReturn: 10, internalCost: 800 },
        { id: 'p2', name: 'Taza Merch', publicPrice: 15000, perceivedReturn: 8, internalCost: 5000 }
    ]);
    const [newPhysicalName, setNewPhysicalName] = useState('');

    // --- VOUCHERS ---
    const [margenBruto, setMargenBruto] = useState<number>(30);
    const [umbralMultiplicador, setUmbralMultiplicador] = useState<number>(7);
    const [vouchers, setVouchers] = useState<VoucherReward[]>([
        { id: 'v1', value: 1000 },
        { id: 'v2', value: 5000 }
    ]);
    const [newVoucherValue, setNewVoucherValue] = useState('');

    // --- DISTRIBUTION (EQUALIZER) ---
    const [distributionPct, setDistributionPct] = useState<Record<string, number>>({
        'p1': 40,
        'p2': 20,
        'v1': 30,
        'v2': 10
    });

    // --- CALCULATIONS ---
    const presupuestoMensual = presupuestoMode === 'pct' ? facturacionBruta * (porcentajeCeder / 100) : presupuestoFijo;
    const puntosEmitidos = facturacionBruta / (moneyPerPoint || 1);
    const bolsaPuntosMensual = puntosEmitidos * (tasaCanje / 100);
    const valorPuntoReal = bolsaPuntosMensual > 0 ? presupuestoMensual / bolsaPuntosMensual : 0;
    const costoMercaderia = 100 - margenBruto;

    useEffect(() => {
        if (isOpen && config) {
            setMoneyPerPoint(config.pointsMoneyBase || 1000);
            if (config.budgetMode) setPresupuestoMode(config.budgetMode);
            if (config.budgetPercentage) setPorcentajeCeder(config.budgetPercentage);
            if (config.budgetFixedAmount) setPresupuestoFijo(config.budgetFixedAmount);
            if (config.masterCalculatorSettings) {
                if (config.masterCalculatorSettings.facturacionEstimada) setFacturacionBruta(config.masterCalculatorSettings.facturacionEstimada);
                if (config.masterCalculatorSettings.umbralMultiplicador) setUmbralMultiplicador(config.masterCalculatorSettings.umbralMultiplicador);
                
                const niveles = config.masterCalculatorSettings.distribucionNiveles;
                if (niveles && niveles.length > 0) {
                    const newPhysical: PhysicalReward[] = [];
                    const newVouchers: VoucherReward[] = [];
                    const newDist: Record<string, number> = {};

                    niveles.forEach((n: any) => {
                        newDist[n.id] = n.pct ?? 0;
                        const isVoucher = n.type === 'voucher' || (typeof n.nombre === 'string' && n.nombre.toLowerCase().includes('voucher')) || n.voucherValue !== undefined;
                        if (isVoucher) {
                            const val = n.voucherValue || Number((n.nombre || '').replace(/[^0-9]/g, '')) || 1000;
                            newVouchers.push({
                                id: n.id,
                                value: val,
                                manualPointsOverride: n.manualPointsOverride
                            });
                        } else {
                            newPhysical.push({
                                id: n.id,
                                name: n.nombre,
                                publicPrice: n.publicPrice || 1000,
                                perceivedReturn: n.perceivedReturn || 10,
                                internalCost: n.internalCost || 300,
                                manualPointsOverride: n.manualPointsOverride
                            });
                        }
                    });

                    setPhysicalRewards(newPhysical);
                    setVouchers(newVouchers);
                    setDistributionPct(newDist);
                }
            }
        }
    }, [isOpen, config]);

    // Combinar todos los items para el Ecualizador
    const allItems = useMemo(() => {
        const items = [];
        for (const p of physicalRewards) {
            const isOverridden = p.manualPointsOverride !== undefined;
            const autoPoints = moneyPerPoint > 0 && p.perceivedReturn > 0 ? Math.ceil((p.publicPrice / (p.perceivedReturn / 100)) / moneyPerPoint) : 0;
            const requiredPoints = isOverridden ? p.manualPointsOverride! : autoPoints;
            items.push({ id: p.id, name: p.name, type: 'physical' as const, pointsCost: requiredPoints });
        }
        for (const v of vouchers) {
            const isOverridden = v.manualPointsOverride !== undefined;
            const autoPoints = valorPuntoReal > 0 ? Math.ceil(v.value / valorPuntoReal) : 0;
            const requiredPoints = isOverridden ? v.manualPointsOverride! : autoPoints;
            items.push({ id: v.id, name: `Voucher $${v.value}`, type: 'voucher' as const, pointsCost: requiredPoints });
        }
        return items;
    }, [physicalRewards, vouchers, moneyPerPoint, valorPuntoReal]);

    // Total % usado
    const totalPctUsed = allItems.reduce((acc, item) => acc + (distributionPct[item.id] || 0), 0);

    const handleAutoEqualize = () => {
        if (allItems.length === 0) return;
        const eq = Number((100 / allItems.length).toFixed(1));
        const newDist: Record<string, number> = {};
        allItems.forEach(item => {
            newDist[item.id] = eq;
        });
        setDistributionPct(newDist);
    };

    const handleSave = () => {
        const distribucionFinal = allItems.map(item => {
            const isPhysical = item.type === 'physical';
            const phys = isPhysical ? physicalRewards.find(p => p.id === item.id) : null;
            const vouch = !isPhysical ? vouchers.find(v => v.id === item.id) : null;

            const res: any = {
                id: item.id,
                nombre: item.name,
                costo: item.pointsCost || 0,
                pct: distributionPct[item.id] || 0,
                type: item.type
            };

            if (isPhysical && phys) {
                if (phys.publicPrice !== undefined) res.publicPrice = phys.publicPrice;
                if (phys.perceivedReturn !== undefined) res.perceivedReturn = phys.perceivedReturn;
                if (phys.internalCost !== undefined) res.internalCost = phys.internalCost;
                if (phys.manualPointsOverride !== undefined) res.manualPointsOverride = phys.manualPointsOverride;
            } else if (!isPhysical && vouch) {
                if (vouch.value !== undefined) res.voucherValue = vouch.value;
                if (vouch.manualPointsOverride !== undefined) res.manualPointsOverride = vouch.manualPointsOverride;
            }

            return res;
        });

        onSave({
            pointCalculationMethod: 'manual',
            pointsMoneyBase: moneyPerPoint,
            useAutomaticPointValue: false,
            pointValue: valorPuntoReal, 
            budgetMode: presupuestoMode,
            budgetPercentage: porcentajeCeder,
            budgetFixedAmount: presupuestoFijo,
            masterCalculatorSettings: {
                baseCalculo: 'dashboard_unified',
                bolsaMensualPuntos: bolsaPuntosMensual,
                presupuestoEstimado: presupuestoMensual,
                facturacionEstimada: facturacionBruta,
                umbralMultiplicador: umbralMultiplicador,
                distribucionNiveles: distribucionFinal
            }
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-2 sm:p-4 animate-fade-in font-sans">
            <div className="w-full max-w-[1600px] h-[95vh] bg-slate-50 rounded-3xl overflow-hidden shadow-2xl flex flex-col border border-slate-700/20">
                
                {/* HEADER / KPIs */}
                <div className="bg-slate-900 text-white shrink-0">
                    <div className="p-4 flex justify-between items-center border-b border-slate-800">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-500/20 text-indigo-400 rounded-xl flex items-center justify-center">
                                <Activity size={24} />
                            </div>
                            <div>
                                <h2 className="text-xl font-black tracking-tight">Dashboard de Gamificación Financiera</h2>
                                <p className="text-slate-400 text-xs font-medium">Modelá tus reglas, premios y presupuesto "de un vistazo".</p>
                            </div>
                        </div>
                        <button type="button" onClick={onClose} className="w-10 h-10 flex items-center justify-center bg-slate-800 hover:bg-slate-700 rounded-xl transition-colors text-slate-300">
                            <X size={20} />
                        </button>
                    </div>

                    {/* KPI STRIP */}
                    <div className="grid grid-cols-2 md:grid-cols-4 divide-y md:divide-y-0 md:divide-x divide-slate-800 bg-slate-800/50">
                        <div className="p-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1 flex items-center gap-2">
                                Presupuesto Mensual
                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${presupuestoMode==='pct' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-blue-500/20 text-blue-400'}`}>
                                    {presupuestoMode === 'pct' ? 'Automático' : 'Fijo'}
                                </span>
                            </p>
                            <p className={`text-2xl font-black ${presupuestoMode==='pct' ? 'text-emerald-400' : 'text-blue-400'}`}>${Math.floor(presupuestoMensual).toLocaleString()}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Límite de dinero a repartir en premios</p>
                        </div>
                        <div className="p-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Bolsa de Puntos (Canjeable)</p>
                            <p className="text-2xl font-black text-indigo-400">{Math.floor(bolsaPuntosMensual).toLocaleString()} <span className="text-sm font-bold">pts</span></p>
                            <p className="text-[10px] text-slate-500 mt-1">Asumiendo {tasaCanje}% de tasa de canje real</p>
                        </div>
                        <div className="p-4">
                            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">Valor Teórico del Punto</p>
                            <p className="text-2xl font-black text-white">${valorPuntoReal.toFixed(2)}</p>
                            <p className="text-[10px] text-slate-500 mt-1">Lo que te cuesta cada punto emitido</p>
                        </div>
                        <div className="p-4 bg-indigo-600/20 flex flex-col justify-center">
                            <button onClick={handleSave} className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded-xl transition-colors flex items-center justify-center gap-2 shadow-lg shadow-indigo-900/20">
                                <CheckCircle size={18} /> Aplicar al Sistema
                            </button>
                        </div>
                    </div>
                </div>

                {/* 3-COLUMN DASHBOARD */}
                <div className="flex-1 overflow-x-auto overflow-y-hidden">
                    <div className="flex h-full min-w-[1200px]">
                        
                        {/* COLUMN 1: GLOBAL RULES */}
                        <div className="w-[350px] shrink-0 border-r border-slate-200 bg-white p-6 overflow-y-auto">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <TrendingUp className="text-indigo-500" size={18} /> 1. Base del Negocio
                            </h3>

                            <div className="space-y-6">
                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                    <div className="flex justify-between items-center mb-4">
                                        <label className="text-xs font-bold text-slate-500 uppercase">Presupuesto</label>
                                        <div className="flex bg-slate-200 p-1 rounded-lg">
                                            <button onClick={() => setPresupuestoMode('pct')} className={`px-2 py-1 text-[10px] font-bold rounded ${presupuestoMode === 'pct' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>% Venta</button>
                                            <button onClick={() => setPresupuestoMode('fixed')} className={`px-2 py-1 text-[10px] font-bold rounded ${presupuestoMode === 'fixed' ? 'bg-white shadow text-slate-800' : 'text-slate-500'}`}>Fijo</button>
                                        </div>
                                    </div>
                                    
                                    <div className="space-y-4">
                                        <div>
                                            <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                                <span>Facturación Bruta (Mensual)</span>
                                            </div>
                                            <div className="relative">
                                                <DollarSign size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                                <input type="number" value={facturacionBruta} onChange={e => setFacturacionBruta(Number(e.target.value))} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-slate-800 outline-none focus:border-indigo-500" />
                                            </div>
                                            <p className="text-[10px] text-slate-400 mt-1">Usada para calcular los puntos que emitirás.</p>
                                        </div>
                                        
                                        {presupuestoMode === 'pct' ? (
                                            <div className="animate-fade-in">
                                                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 pt-2 border-t border-slate-200 mt-2">
                                                    <span>% a Ceder en Premios</span>
                                                    <span className="text-emerald-600 font-black">{porcentajeCeder}%</span>
                                                </div>
                                                <input type="range" min="1" max="15" step="0.5" value={porcentajeCeder} onChange={e => setPorcentajeCeder(Number(e.target.value))} className="w-full accent-emerald-500" />
                                            </div>
                                        ) : (
                                            <div className="animate-fade-in">
                                                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1 pt-2 border-t border-slate-200 mt-2">
                                                    <span>Presupuesto Fijo Mensual</span>
                                                </div>
                                                <div className="relative">
                                                    <DollarSign size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                                    <input type="number" value={presupuestoFijo} onChange={e => setPresupuestoFijo(Number(e.target.value))} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-xl font-black text-blue-600 outline-none focus:border-blue-500" />
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="p-4 bg-indigo-50 border border-indigo-100 rounded-2xl shadow-inner">
                                    <label className="text-xs font-bold text-indigo-800 uppercase block mb-3">Regla de Emisión</label>
                                    <div className="flex items-center gap-3">
                                        <div className="flex-1 relative">
                                            <DollarSign size={14} className="absolute left-3 top-3 text-indigo-400" />
                                            <input type="number" value={moneyPerPoint} onChange={e => setMoneyPerPoint(Number(e.target.value))} className="w-full pl-8 pr-3 py-2 bg-white border border-indigo-200 rounded-xl font-black text-xl text-indigo-700 outline-none focus:border-indigo-500" />
                                        </div>
                                        <div className="text-sm font-bold text-indigo-800">= 1 Pt</div>
                                    </div>
                                    <p className="text-[10px] text-indigo-600 mt-2">Cuántos pesos debe gastar el cliente para sumar 1 punto a su cuenta.</p>
                                </div>

                                <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
                                    <div className="flex justify-between text-xs font-bold text-slate-700 mb-1">
                                        <span>Tasa de Canje (Uso Real)</span>
                                        <span className="text-indigo-600">{tasaCanje}%</span>
                                    </div>
                                    <input type="range" min="10" max="100" step="5" value={tasaCanje} onChange={e => setTasaCanje(Number(e.target.value))} className="w-full accent-indigo-500" />
                                    <p className="text-[10px] text-slate-500 mt-1">El {100-tasaCanje}% de los puntos vencen sin usarse (Breakage).</p>
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 2: REWARDS & VOUCHERS SETUP */}
                        <div className="flex-1 border-r border-slate-200 bg-slate-50/50 p-6 overflow-y-auto">
                            <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2 mb-6">
                                <Gift className="text-pink-500" size={18} /> 2. Crear Catálogo de Premios
                            </h3>

                            {/* PHYSICAL REWARDS */}
                            <div className="mb-8">
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Star size={14} /> Premios del Local</h4>
                                <div className="space-y-4">
                                    {physicalRewards.map(reward => {
                                        const isOverridden = reward.manualPointsOverride !== undefined;
                                        const autoPoints = moneyPerPoint > 0 && reward.perceivedReturn > 0 ? Math.ceil((reward.publicPrice / (reward.perceivedReturn / 100)) / moneyPerPoint) : 0;
                                        const requiredPoints = isOverridden ? reward.manualPointsOverride! : autoPoints;
                                        
                                        const requiredSpend = requiredPoints * (moneyPerPoint || 1);
                                        const effectivePerceivedReturn = requiredSpend > 0 ? (reward.publicPrice / requiredSpend) * 100 : 0;
                                        const realImpact = requiredSpend > 0 ? (reward.internalCost / requiredSpend) * 100 : 0;

                                        return (
                                            <div key={reward.id} className="bg-white border border-slate-200 p-4 rounded-2xl shadow-sm hover:border-pink-200 transition-colors">
                                                <div className="flex justify-between items-start mb-4">
                                                    <input 
                                                        type="text" 
                                                        value={reward.name} 
                                                        onChange={e => {
                                                            const newArr = [...physicalRewards];
                                                            const idx = newArr.findIndex(r => r.id === reward.id);
                                                            newArr[idx].name = e.target.value;
                                                            setPhysicalRewards(newArr);
                                                        }} 
                                                        className="font-black text-base text-slate-800 bg-transparent border-none outline-none focus:ring-2 focus:ring-pink-100 rounded px-1 -ml-1 w-full" 
                                                    />
                                                    <button onClick={() => setPhysicalRewards(physicalRewards.filter(r => r.id !== reward.id))} className="text-slate-400 hover:text-red-500 transition-colors ml-2"><X size={16}/></button>
                                                </div>

                                                <div className="grid grid-cols-3 gap-3 mb-4">
                                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Precio Público</label>
                                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg pl-2 focus-within:border-pink-500">
                                                            <span className="text-xs font-bold text-slate-400">$</span>
                                                            <input type="number" value={reward.publicPrice} onChange={e => {
                                                                const newArr = [...physicalRewards];
                                                                const idx = newArr.findIndex(r => r.id === reward.id);
                                                                newArr[idx].publicPrice = Number(e.target.value);
                                                                if (isOverridden) { delete newArr[idx].manualPointsOverride; }
                                                                setPhysicalRewards(newArr);
                                                            }} className="w-full bg-transparent p-1.5 font-bold text-sm outline-none" />
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-50 p-2 rounded-xl border border-slate-100">
                                                        <label className="text-[10px] font-bold text-slate-500 block mb-1">Retorno Percibido</label>
                                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg pr-2 focus-within:border-pink-500">
                                                            <input type="number" value={isOverridden ? Number(effectivePerceivedReturn.toFixed(1)) : reward.perceivedReturn} onChange={e => {
                                                                const newArr = [...physicalRewards];
                                                                const idx = newArr.findIndex(r => r.id === reward.id);
                                                                newArr[idx].perceivedReturn = Number(e.target.value);
                                                                if (isOverridden) { delete newArr[idx].manualPointsOverride; }
                                                                setPhysicalRewards(newArr);
                                                            }} className={`w-full bg-transparent p-1.5 font-bold text-sm outline-none text-right ${isOverridden ? 'text-amber-600' : ''}`} />
                                                            <span className="text-xs font-bold text-slate-400">%</span>
                                                        </div>
                                                    </div>
                                                    <div className="bg-slate-900 p-2 rounded-xl border border-slate-800">
                                                        <label className="text-[10px] font-bold text-slate-400 block mb-1">Costo Real Interno</label>
                                                        <div className="flex items-center gap-1 bg-slate-800 border border-slate-700 rounded-lg pl-2 focus-within:border-pink-500">
                                                            <span className="text-xs font-bold text-slate-500">$</span>
                                                            <input type="number" value={reward.internalCost} onChange={e => {
                                                                const newArr = [...physicalRewards];
                                                                const idx = newArr.findIndex(r => r.id === reward.id);
                                                                newArr[idx].internalCost = Number(e.target.value);
                                                                setPhysicalRewards(newArr);
                                                            }} className="w-full bg-transparent p-1.5 font-bold text-white text-sm outline-none" />
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                                                    <div className="flex items-center gap-4">
                                                        <div className="text-center group relative">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center justify-center gap-1">
                                                                Precio App
                                                                {isOverridden && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            const newArr = [...physicalRewards];
                                                                            const idx = newArr.findIndex(r => r.id === reward.id);
                                                                            delete newArr[idx].manualPointsOverride;
                                                                            setPhysicalRewards(newArr);
                                                                        }} 
                                                                        className="text-amber-500 hover:text-amber-600" 
                                                                        title="Resetear al cálculo original"
                                                                    >
                                                                        (Reset)
                                                                    </button>
                                                                )}
                                                            </p>
                                                            <div className="flex items-baseline gap-1 mt-0.5 justify-center">
                                                                <input 
                                                                    type="number" 
                                                                    value={requiredPoints} 
                                                                    onChange={e => {
                                                                        const newArr = [...physicalRewards];
                                                                        const idx = newArr.findIndex(r => r.id === reward.id);
                                                                        newArr[idx].manualPointsOverride = Number(e.target.value);
                                                                        setPhysicalRewards(newArr);
                                                                    }} 
                                                                    className={`w-16 font-black text-lg outline-none text-center bg-transparent border-b border-transparent hover:border-pink-200 focus:border-pink-500 ${isOverridden ? 'text-amber-600' : 'text-pink-600'}`} 
                                                                />
                                                                <span className="text-xs text-pink-600 font-bold">pts</span>
                                                            </div>
                                                        </div>
                                                        <div className="w-[1px] h-8 bg-slate-200"></div>
                                                        <div className="text-center">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Gasto Cliente</p>
                                                            <p className="text-xs font-black text-slate-700">${Math.floor(requiredSpend).toLocaleString()}</p>
                                                        </div>
                                                    </div>
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Costo s/Facturación</p>
                                                            <p className={`text-xs font-black ${realImpact <= 5 ? 'text-emerald-500' : realImpact <= 10 ? 'text-amber-500' : 'text-red-500'}`}>
                                                                {realImpact.toFixed(1)}% 
                                                            </p>
                                                        </div>
                                                    </div>

                                                    {/* Compra Mínima Opcional Sugerida (Basada en Costo e Insumos) */}
                                                    {(() => {
                                                        const suggestedMin = reward.internalCost > 0 ? Math.ceil((reward.internalCost / 0.70) / 100) * 100 : (reward.publicPrice || 0);
                                                        return (
                                                            <div className="mt-3 pt-2 border-t border-slate-100 flex items-center justify-between bg-orange-50/70 px-3 py-1.5 rounded-xl border border-orange-100">
                                                                <span className="text-[10px] font-bold text-orange-800">
                                                                    🛒 Compra Mínima Opcional (Sugerida):
                                                                </span>
                                                                <span className="text-xs font-black text-orange-700">
                                                                    ${suggestedMin.toLocaleString('es-AR')}
                                                                </span>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            )
                                        })}

                                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-3 flex items-center gap-3">
                                        <input 
                                            type="text" 
                                            value={newPhysicalName} 
                                            onChange={e => setNewPhysicalName(e.target.value)} 
                                            placeholder="Nuevo premio del local..."
                                            className="flex-1 bg-white border border-slate-200 rounded-lg p-2 font-bold text-sm outline-none focus:border-pink-500"
                                        />
                                        <button 
                                            onClick={() => {
                                                if (newPhysicalName.trim()) {
                                                    const newId = `p${Date.now()}`;
                                                    setPhysicalRewards([...physicalRewards, { id: newId, name: newPhysicalName, publicPrice: 1000, perceivedReturn: 10, internalCost: 300 }]);
                                                    setDistributionPct(prev => ({ ...prev, [newId]: 0 }));
                                                    setNewPhysicalName('');
                                                }
                                            }}
                                            className="bg-slate-800 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors"
                                        >
                                            Añadir
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* VOUCHERS */}
                            <div>
                                <h4 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Ticket size={14} /> Vouchers Monetarios</h4>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                            <span>Tu Margen Bruto</span>
                                            <span className="text-amber-600">{margenBruto}%</span>
                                        </div>
                                        <input type="range" min="10" max="80" step="5" value={margenBruto} onChange={e => setMargenBruto(Number(e.target.value))} className="w-full accent-amber-500" />
                                    </div>
                                    <div className="bg-slate-50 p-3 rounded-xl border border-slate-200">
                                        <div className="flex justify-between text-[10px] font-bold text-slate-500 mb-1">
                                            <span>Umbral Compra Mín.</span>
                                            <span className="text-amber-600">x{umbralMultiplicador}</span>
                                        </div>
                                        <input type="range" min="2" max="15" step="1" value={umbralMultiplicador} onChange={e => setUmbralMultiplicador(Number(e.target.value))} className="w-full accent-amber-500" />
                                    </div>
                                </div>

                                <div className="space-y-3">
                                    {vouchers.map(v => {
                                        const isOverridden = v.manualPointsOverride !== undefined;
                                        const autoPoints = valorPuntoReal > 0 ? Math.ceil(v.value / valorPuntoReal) : 0;
                                        const reqPointsFixed = isOverridden ? v.manualPointsOverride! : autoPoints;

                                        const minSpend = v.value * umbralMultiplicador;
                                        const roi = (minSpend - v.value) - (minSpend * (costoMercaderia/100));

                                        return (
                                            <div key={v.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm hover:border-amber-200 transition-colors flex flex-col gap-3">
                                                <div className="flex items-center justify-between">
                                                    <div className="flex items-center gap-4">
                                                        <div className="bg-amber-100 text-amber-700 font-black px-3 py-2 rounded-lg text-lg flex items-center gap-1">
                                                            <DollarSign size={16}/>{v.value}
                                                        </div>
                                                        <div>
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                                                                Precio App
                                                                {isOverridden && (
                                                                    <button 
                                                                        onClick={() => {
                                                                            const newArr = [...vouchers];
                                                                            const idx = newArr.findIndex(x => x.id === v.id);
                                                                            delete newArr[idx].manualPointsOverride;
                                                                            setVouchers(newArr);
                                                                        }} 
                                                                        className="text-amber-500 hover:text-amber-600 ml-1" 
                                                                        title="Resetear al cálculo original"
                                                                    >
                                                                        (Reset)
                                                                    </button>
                                                                )}
                                                            </p>
                                                            <div className="flex items-baseline gap-1 mt-0.5">
                                                                <input 
                                                                    type="number" 
                                                                    value={reqPointsFixed} 
                                                                    onChange={e => {
                                                                        const newArr = [...vouchers];
                                                                        const idx = newArr.findIndex(x => x.id === v.id);
                                                                        newArr[idx].manualPointsOverride = Number(e.target.value);
                                                                        setVouchers(newArr);
                                                                    }} 
                                                                    className={`w-16 font-black text-sm outline-none bg-transparent border-b border-transparent hover:border-slate-300 focus:border-amber-500 ${isOverridden ? 'text-amber-600' : 'text-slate-800'}`} 
                                                                />
                                                                <span className="text-[10px] text-slate-500 font-bold">pts</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="text-right flex items-center gap-4">
                                                        <div className="text-right">
                                                            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Ganancia (ROI)</p>
                                                            <p className={`text-sm font-black ${roi > 0 ? 'text-emerald-500' : 'text-red-500'}`}>
                                                                {roi > 0 ? '+' : ''}${Math.floor(roi).toLocaleString()}
                                                            </p>
                                                        </div>
                                                        <button onClick={() => setVouchers(vouchers.filter(x => x.id !== v.id))} className="text-slate-300 hover:text-red-500 ml-2"><X size={16}/></button>
                                                    </div>
                                                </div>
                                                <div className="bg-slate-50 border border-slate-100 rounded-lg p-2 text-center">
                                                    <p className="text-[10px] text-slate-500 font-bold uppercase">Compra Mínima Requerida: <span className="text-amber-600">${minSpend.toLocaleString()}</span></p>
                                                </div>
                                            </div>
                                        )
                                    })}

                                    <div className="bg-slate-50 border-2 border-dashed border-slate-300 rounded-2xl p-3 flex items-center gap-3">
                                        <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-lg pl-2 focus-within:border-amber-500 flex-1">
                                            <span className="text-xs font-bold text-slate-400">$</span>
                                            <input 
                                                type="number" 
                                                value={newVoucherValue} 
                                                onChange={e => setNewVoucherValue(e.target.value)} 
                                                placeholder="Monto del voucher..."
                                                className="w-full bg-transparent p-2 font-bold text-sm outline-none"
                                            />
                                        </div>
                                        <button 
                                            onClick={() => {
                                                if (Number(newVoucherValue) > 0) {
                                                    const newId = `v${Date.now()}`;
                                                    setVouchers([...vouchers, { id: newId, value: Number(newVoucherValue) }]);
                                                    setDistributionPct(prev => ({ ...prev, [newId]: 0 }));
                                                    setNewVoucherValue('');
                                                }
                                            }}
                                            className="bg-slate-800 text-white font-bold px-4 py-2 rounded-lg text-sm hover:bg-slate-700 transition-colors"
                                        >
                                            Añadir
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* COLUMN 3: GLOBAL EQUALIZER */}
                        <div className="w-[450px] shrink-0 bg-white p-6 overflow-y-auto flex flex-col border-l border-slate-200">
                            <div className="flex justify-between items-end mb-6">
                                <h3 className="text-sm font-black text-slate-800 uppercase tracking-widest flex items-center gap-2">
                                    <Sliders className="text-emerald-500" size={18} /> 3. Ecualizador Global
                                </h3>
                                <button onClick={handleAutoEqualize} className="text-[10px] font-bold bg-slate-100 text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-200 transition-colors">
                                    Repartir en partes iguales
                                </button>
                            </div>

                            <p className="text-xs text-slate-500 mb-6">Repartí tu presupuesto mensual entre todos los premios y descubrí cuántas unidades podés regalar al mes para no perder dinero.</p>

                            <div className="space-y-4">
                                {allItems.map(item => {
                                    const pct = distributionPct[item.id] || 0;
                                    const pointsBudgetForThis = bolsaPuntosMensual * (pct / 100);
                                    const qtyCanGive = item.pointsCost > 0 ? Math.floor(pointsBudgetForThis / item.pointsCost) : 0;

                                    return (
                                        <div key={item.id} className="bg-slate-50 border border-slate-200 p-4 rounded-xl shadow-sm">
                                            <div className="flex justify-between items-center mb-3">
                                                <h4 className="font-bold text-sm text-slate-800 flex items-center gap-2">
                                                    {item.type === 'physical' ? <Star size={14} className="text-pink-500"/> : <Ticket size={14} className="text-amber-500"/>}
                                                    {item.name}
                                                </h4>
                                                <span className="text-[10px] font-bold bg-white border border-slate-200 px-2 py-0.5 rounded-full text-slate-500">
                                                    Costo: {item.pointsCost} pts
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-4">
                                                <div className="flex-1">
                                                    <input type="range" min="0" max="100" value={pct} onChange={e => {
                                                        setDistributionPct(prev => ({ ...prev, [item.id]: Number(e.target.value) }));
                                                    }} className="w-full accent-emerald-500" />
                                                    <div className="flex justify-between items-center mt-1">
                                                        <span className="text-[10px] text-slate-400 font-bold uppercase">Asignado</span>
                                                        <div className="flex items-center gap-1">
                                                            <input type="number" value={pct} onChange={e => {
                                                                setDistributionPct(prev => ({ ...prev, [item.id]: Number(e.target.value) }));
                                                            }} className="w-12 text-right p-0.5 border border-slate-200 rounded text-xs font-bold outline-none focus:border-emerald-500" />
                                                            <span className="text-[10px] font-bold text-slate-500">%</span>
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="w-[1px] h-10 bg-slate-200"></div>
                                                <div className="text-right min-w-[70px]">
                                                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Podés dar</p>
                                                    <p className="text-2xl font-black text-slate-800">{qtyCanGive} <span className="text-xs font-bold text-slate-500">unid.</span></p>
                                                </div>
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>

                            {/* WARNING FOOTER */}
                            <div className={`mt-6 p-4 rounded-xl border flex items-start gap-3 ${totalPctUsed > 100 ? 'bg-red-50 border-red-200' : totalPctUsed < 100 ? 'bg-amber-50 border-amber-200' : 'bg-emerald-50 border-emerald-200'}`}>
                                <AlertCircle size={20} className={totalPctUsed > 100 ? 'text-red-500' : totalPctUsed < 100 ? 'text-amber-500' : 'text-emerald-500'} />
                                <div>
                                    <p className={`text-sm font-black ${totalPctUsed > 100 ? 'text-red-700' : totalPctUsed < 100 ? 'text-amber-700' : 'text-emerald-700'}`}>
                                        Total Asignado: {totalPctUsed.toFixed(1)}%
                                    </p>
                                    <p className={`text-xs mt-1 ${totalPctUsed > 100 ? 'text-red-600' : totalPctUsed < 100 ? 'text-amber-600' : 'text-emerald-600'}`}>
                                        {totalPctUsed > 100 ? 'Te pasaste del 100%. Reducí los porcentajes para no exceder tu presupuesto.' : totalPctUsed < 100 ? 'Aún tenés presupuesto sin asignar. Podés regalar más!' : '¡Perfecto! Tu presupuesto está distribuido al 100% exacto.'}
                                    </p>
                                </div>
                            </div>

                        </div>

                    </div>
                </div>
            </div>
        </div>
    );
};
