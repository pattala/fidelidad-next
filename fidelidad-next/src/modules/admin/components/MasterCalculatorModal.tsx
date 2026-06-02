import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, AlertCircle, Activity, Clock, Target, CalendarDays, Gift, X, CheckCircle, HelpCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import type { AppConfig } from '../../../types';

interface MasterCalculatorModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: AppConfig;
    onSave: (newConfig: Partial<AppConfig>) => void;
}

export const MasterCalculatorModal = ({ isOpen, onClose, config, onSave }: MasterCalculatorModalProps) => {
    // Tabs State
    const [activeTab, setActiveTab] = useState<'A' | 'B' | 'C' | 'D'>('A');
    const [showHelp, setShowHelp] = useState(false);

    // Shared Global Inputs
    const [reglaPuntos, setReglaPuntos] = useState<number>(config.pointsMoneyBase || 100); 
    const [tasaCanje, setTasaCanje] = useState<number>(80); 
    const [ticketPromedio, setTicketPromedio] = useState<number>(15000);

    // Mode A Inputs (Facturación)
    const [facturacionBruta, setFacturacionBruta] = useState<number>(8000000);
    const [porcentajeCeder, setPorcentajeCeder] = useState<number>(3);

    // Mode B Inputs (Presupuesto)
    const [presupuestoFijo, setPresupuestoFijo] = useState<number>(100000);
    const [clientesAlMes, setClientesAlMes] = useState<number>(360);

    // Mode C Inputs (Vouchers - Ex D)
    const [margenBruto, setMargenBruto] = useState<number>(30);
    const [umbralMultiplicador, setUmbralMultiplicador] = useState<number>(7);
    const [vouchersDinamicos, setVouchersDinamicos] = useState<number[]>([1000, 3000, 5000]);
    const [nuevoVoucher, setNuevoVoucher] = useState<string>('');
    const [baseCalculoVoucher, setBaseCalculoVoucher] = useState<'A' | 'B' | 'final'>('A');

    // Módulo Frecuencia Inputs
    const [frecuenciasDinamicas, setFrecuenciasDinamicas] = useState<Array<{gancho: number, dias: number}>>([
        { gancho: 500, dias: 30 },
        { gancho: 1000, dias: 60 }
    ]);
    const [nuevoGancho, setNuevoGancho] = useState<string>('');
    const [nuevoDias, setNuevoDias] = useState<string>('');

    // Mode D Inputs (Distribución Catálogo - Ex E)
    const [baseCalculoBolsa, setBaseCalculoBolsa] = useState<'A' | 'B'>('A');
    const [distribucionNiveles, setDistribucionNiveles] = useState<Array<{id: string, nombre: string, costo: number, pct: number}>>([
        { id: '1', nombre: 'Premios Gancho', costo: 500, pct: 60 },
        { id: '2', nombre: 'Valor Medio', costo: 2000, pct: 30 },
        { id: '3', nombre: 'Aspiracionales', costo: 10000, pct: 10 },
    ]);
    const [nuevoNivelNombre, setNuevoNivelNombre] = useState('');
    const [nuevoNivelCosto, setNuevoNivelCosto] = useState('');
    const [nuevoNivelPct, setNuevoNivelPct] = useState('');

    // Final Decision
    const [decisionFuente, setDecisionFuente] = useState<'A' | 'B' | 'manual'>('manual');
    const [finalPointValue, setFinalPointValue] = useState<number>(config.pointValue || 10);

    useEffect(() => {
        if (isOpen) {
            setReglaPuntos(config.pointsMoneyBase || 100);
            setFinalPointValue(config.pointValue || 10);
        }
    }, [isOpen, config]);

    // ================= CALCULATIONS =================
    const mA_presupuestoTeorico = facturacionBruta * (porcentajeCeder / 100);
    const mA_puntosEmitidos = facturacionBruta / reglaPuntos;
    const mA_valorPuntoIdeal = (mA_presupuestoTeorico / (mA_puntosEmitidos * (tasaCanje / 100))) || 0;

    const mB_facturacionEstimada = ticketPromedio * clientesAlMes;
    const mB_puntosEmitidos = mB_facturacionEstimada / reglaPuntos;
    const mB_valorPuntoSugerido = (presupuestoFijo / (mB_puntosEmitidos * (tasaCanje / 100))) || 0;


    
    const costoMercaderia = 100 - margenBruto;
    const freq_puntosPorVisita = ticketPromedio / reglaPuntos;
    // Mode D Calculations
    const mD_puntosEmitidosBase = baseCalculoBolsa === 'A' ? mA_puntosEmitidos : mB_puntosEmitidos;
    const mD_bolsaPuntosMensual = mD_puntosEmitidosBase * (tasaCanje / 100);

    const handleEcualizarDistribucion = () => {
        if (distribucionNiveles.length === 0) return;
        const porcion = 100 / distribucionNiveles.length;
        setDistribucionNiveles(prev => prev.map(n => ({...n, pct: Number(porcion.toFixed(1))})));
    };

    const handleSave = () => {
        let valToSave = finalPointValue;
        if (decisionFuente === 'A') valToSave = mA_valorPuntoIdeal;
        if (decisionFuente === 'B') valToSave = mB_valorPuntoSugerido;
        
        const baseCalculoReal = decisionFuente === 'manual' ? baseCalculoBolsa : (decisionFuente === 'A' ? 'A' : 'B');
        const mD_puntosEmitidosReal = baseCalculoReal === 'A' ? mA_puntosEmitidos : mB_puntosEmitidos;
        const mD_bolsaReal = mD_puntosEmitidosReal * (tasaCanje / 100);

        onSave({
            pointCalculationMethod: 'manual', // Obligamos a que sea manual/fijo a partir de ahora
            pointValue: valToSave,
            pointsMoneyBase: reglaPuntos,
            useAutomaticPointValue: false,
            masterCalculatorSettings: {
                baseCalculo: baseCalculoReal,
                bolsaMensualPuntos: mD_bolsaReal,
                facturacionEstimada: baseCalculoReal === 'A' ? facturacionBruta : mB_facturacionEstimada,
                presupuestoEstimado: baseCalculoReal === 'A' ? mA_presupuestoTeorico : presupuestoFijo,
                umbralMultiplicador: umbralMultiplicador,
                distribucionNiveles: distribucionNiveles
            }
        });
        onClose();
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
            <div className="w-full max-w-5xl mx-auto bg-white rounded-3xl overflow-hidden shadow-2xl flex flex-col h-[95vh] sm:h-[90vh]">
                
                {/* HEADER */}
                <div className="bg-indigo-900 p-5 text-white flex justify-between items-center shrink-0">
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-white/10 rounded-xl flex items-center justify-center">
                            <Activity size={24} className="text-emerald-400" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black tracking-tight">Master Calculator</h2>
                            <p className="text-indigo-200 text-xs font-medium">Encontrá el Valor del Punto perfecto y exportalo a tu app.</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button type="button" onClick={() => setShowHelp(!showHelp)} className={`w-8 h-8 flex items-center justify-center rounded-full transition-colors ${showHelp ? 'bg-indigo-700 text-white' : 'bg-white/10 hover:bg-white/20 text-indigo-100'}`} title="Ayuda">
                            <HelpCircle size={18} />
                        </button>
                        <button type="button" onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {showHelp ? (
                    <div className="flex-1 overflow-y-auto p-8 bg-slate-50">
                        <div className="max-w-3xl mx-auto space-y-8">
                            <div className="text-center mb-8">
                                <h3 className="text-2xl font-black text-indigo-900 mb-2">Guía de la Master Calculator</h3>
                                <p className="text-slate-600">Entendé cómo usar cada módulo para definir el Valor de tu Punto.</p>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h4 className="text-lg font-black text-emerald-600 mb-2 flex items-center gap-2"><DollarSign size={20} /> A. Basado en Facturación (Ideal)</h4>
                                <p className="text-slate-600 text-sm mb-4">Recomendado si tenés claro cuánto facturás por mes y qué porcentaje de esa facturación estás dispuesto a "devolver" en premios a tus clientes.</p>
                                <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                                    <li>Ingresás tu facturación mensual bruta.</li>
                                    <li>Elegís qué % de esa facturación vas a destinar al programa de fidelidad (suele ser entre 1% y 3%).</li>
                                    <li>Asume una tasa de canje (no todos los puntos se canjean).</li>
                                    <li><strong>Resultado:</strong> Te dice exactamente cuánto tiene que valer tu punto para no pasarte de ese presupuesto teórico.</li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h4 className="text-lg font-black text-purple-600 mb-2 flex items-center gap-2"><Target size={20} /> B. Presupuesto Fijo (Conservador)</h4>
                                <p className="text-slate-600 text-sm mb-4">Ideal si el dueño de la empresa dice: "Tengo $100.000 fijos por mes para gastar en premios, ni un peso más".</p>
                                <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                                    <li>Ingresás tu presupuesto máximo en pesos.</li>
                                    <li>Ingresás el ticket promedio y cantidad de clientes esperados al mes.</li>
                                    <li><strong>Resultado:</strong> Ajusta el valor del punto para que la suma total de todos los canjes no supere tu presupuesto fijo.</li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h4 className="text-lg font-black text-amber-600 mb-2 flex items-center gap-2"><Target size={20} /> C. Escalas & Vouchers</h4>
                                <p className="text-slate-600 text-sm mb-4">No calcula el valor del punto, sino que te ayuda a modelar el comportamiento del cliente para que sea rentable.</p>
                                <ul className="list-disc pl-5 text-sm text-slate-500 space-y-2">
                                    <li><strong>Simulador de Vouchers:</strong> Evaluás la rentabilidad (ROI) de tus vouchers.
                                        <ul className="list-circle pl-5 mt-1 text-[13px] space-y-1">
                                            <li><strong>El Multiplicador:</strong> Define de cuánto debe ser la compra mínima para usar el voucher. Ejemplo: Si el voucher es de $1000 y el multiplicador es x7, el cliente debe gastar mínimo $7000 para usarlo.</li>
                                            <li><strong>ROI (Ganancia Neta):</strong> Te muestra cuánta plata limpia te queda en el bolsillo de esa "compra mínima" después de descontar tu costo de mercadería y el valor del voucher que le regalaste.</li>
                                        </ul>
                                    </li>
                                    <li><strong>Módulo Frecuencia:</strong> Le decís cuántos puntos sale un premio gancho, en cuántos días se vencen los puntos, y te dice cada cuántos días tendría que ir a comprar el cliente para poder llegar a canjearlo antes de que caduquen.</li>
                                </ul>
                            </div>

                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
                                <h4 className="text-lg font-black text-purple-600 mb-2 flex items-center gap-2"><CalendarDays size={20} /> D. Distribución</h4>
                                <p className="text-slate-600 text-sm mb-4">Te permite modelar cómo vas a distribuir los puntos que regalás cada mes en premios de distintas categorías.</p>
                                <ul className="list-disc pl-5 text-sm text-slate-500 space-y-1">
                                    <li>Ingresás qué porcentaje de la bolsa de puntos querés destinar a premios ganchos, medios o altos.</li>
                                    <li><strong>Resultado:</strong> Te dice exactamente cuántos premios de cada tipo vas a poder entregar al mes con tu presupuesto actual.</li>
                                </ul>
                            </div>
                            
                            <div className="text-center pt-4">
                                <button type="button" onClick={() => setShowHelp(false)} className="px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-sm">
                                    Entendido, volver a la Calculadora
                                </button>
                            </div>
                        </div>
                    </div>
                ) : (
                <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
                    
                    {/* SIDEBAR - GLOBAL SETTINGS */}
                    <div className="w-full md:w-64 bg-slate-50 border-r border-slate-200 p-5 shrink-0 overflow-y-auto">
                        <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Variables Globales</h3>
                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Regla de Puntos</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500 font-medium">$</span>
                                    <input type="number" value={reglaPuntos} onChange={(e) => setReglaPuntos(Number(e.target.value))} className="w-full p-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                                    <span className="text-xs text-slate-500 font-medium whitespace-nowrap">= 1 Pt</span>
                                </div>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 flex justify-between mb-1">Tasa de Canje <span className="text-emerald-600">{tasaCanje}%</span></label>
                                <input type="range" min="10" max="100" step="5" value={tasaCanje} onChange={(e) => setTasaCanje(Number(e.target.value))} className="w-full accent-emerald-500" />
                                <p className="text-[10px] text-slate-400 leading-tight mt-1">El {100-tasaCanje}% (Breakage) expira sin usarse.</p>
                            </div>
                            <div>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Ticket Promedio</label>
                                <div className="relative">
                                    <DollarSign size={14} className="absolute left-3 top-2.5 text-slate-400" />
                                    <input type="number" value={ticketPromedio} onChange={(e) => setTicketPromedio(Number(e.target.value))} className="w-full pl-8 pr-3 py-2 bg-white border border-slate-200 rounded-lg text-sm font-bold focus:ring-2 focus:ring-emerald-500 outline-none" />
                                </div>
                            </div>
                            
                            <div className="pt-4 border-t border-slate-200">
                                <label className="text-[10px] font-bold text-indigo-500 uppercase tracking-widest block mb-2">Decisión Final</label>
                                <label className="text-xs font-bold text-slate-700 block mb-1">Valor Fijo del Punto</label>
                                <div className="space-y-2 mb-3">
                                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${decisionFuente === 'A' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="decision" checked={decisionFuente === 'A'} onChange={() => setDecisionFuente('A')} className="text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm font-bold text-slate-700 flex-1">Solapa A (Facturación)</span>
                                        <span className="text-sm font-black text-emerald-600">${mA_valorPuntoIdeal.toFixed(2)}</span>
                                    </label>
                                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${decisionFuente === 'B' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="decision" checked={decisionFuente === 'B'} onChange={() => setDecisionFuente('B')} className="text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm font-bold text-slate-700 flex-1">Solapa B (Presupuesto)</span>
                                        <span className="text-sm font-black text-blue-600">${mB_valorPuntoSugerido.toFixed(2)}</span>
                                    </label>
                                    <label className={`flex items-center gap-2 p-2 rounded-lg border cursor-pointer transition-colors ${decisionFuente === 'manual' ? 'bg-indigo-50 border-indigo-200' : 'bg-white border-slate-200 hover:bg-slate-50'}`}>
                                        <input type="radio" name="decision" checked={decisionFuente === 'manual'} onChange={() => setDecisionFuente('manual')} className="text-indigo-600 focus:ring-indigo-500" />
                                        <span className="text-sm font-bold text-slate-700 flex-1">Valor Manual</span>
                                    </label>
                                </div>
                                {decisionFuente === 'manual' && (
                                    <div className="flex items-center gap-2 animate-fade-in">
                                        <span className="text-lg font-black text-slate-800">$</span>
                                        <input type="number" step="0.01" value={finalPointValue} onChange={(e) => setFinalPointValue(Number(e.target.value))} className="w-full p-2 text-xl font-black text-indigo-700 bg-indigo-50 border-2 border-indigo-200 focus:border-indigo-500 rounded-xl outline-none" placeholder="Ingresá el valor a mano" />
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* MAIN CONTENT */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        
                        {/* TABS */}
                        <div className="flex border-b border-slate-200 shrink-0 overflow-x-auto">
                            <button type="button" onClick={() => setActiveTab('A')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'A' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>A. Por Facturación</button>
                            <button type="button" onClick={() => setActiveTab('B')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'B' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>B. Presupuesto</button>
                            <button type="button" onClick={() => setActiveTab('C')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'C' ? 'border-amber-500 text-amber-600 bg-amber-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>C. Escalas & Vouchers</button>
                            <button type="button" onClick={() => setActiveTab('D')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'D' ? 'border-purple-500 text-purple-600 bg-purple-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>D. Distribución</button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1">
                            <AnimatePresence mode="wait">
                                {activeTab === 'A' && (
                                    <motion.div key="A" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-5">
                                        <h3 className="text-base font-black text-slate-800">Cálculo por % de Facturación</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Facturación Mensual</label>
                                                <input type="number" value={facturacionBruta} onChange={e => setFacturacionBruta(Number(e.target.value))} className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded font-bold outline-none focus:border-emerald-500 text-sm" />
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">% a Ceder en Premios</label>
                                                <input type="number" value={porcentajeCeder} onChange={e => setPorcentajeCeder(Number(e.target.value))} className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded font-bold outline-none focus:border-emerald-500 text-sm" />
                                            </div>
                                        </div>
                                        <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-emerald-800 font-bold text-sm">Valor Ideal del Punto</p>
                                                <p className="text-[10px] text-emerald-600 mt-0.5">Usá este valor abajo para aplicarlo a tu app.</p>
                                            </div>
                                            <p className="text-3xl font-black text-emerald-600 cursor-pointer hover:text-emerald-500 transition" onClick={() => { setDecisionFuente('A'); }} title="Click para usar este valor">${mA_valorPuntoIdeal.toFixed(2)}</p>
                                        </div>
                                    </motion.div>
                                )}
                                {activeTab === 'B' && (
                                    <motion.div key="B" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-5">
                                        <h3 className="text-base font-black text-slate-800">Cálculo por Presupuesto Fijo</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Presupuesto Máximo ($)</label>
                                                <input type="number" value={presupuestoFijo} onChange={e => setPresupuestoFijo(Number(e.target.value))} className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded font-bold outline-none focus:border-blue-500 text-sm" />
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Clientes al Mes</label>
                                                <input type="number" value={clientesAlMes} onChange={e => setClientesAlMes(Number(e.target.value))} className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded font-bold outline-none focus:border-blue-500 text-sm" />
                                            </div>
                                        </div>
                                        <div className="bg-blue-50 p-4 rounded-2xl border border-blue-100 flex items-center justify-between">
                                            <div>
                                                <p className="text-blue-800 font-bold text-sm">Valor Seguro del Punto</p>
                                            </div>
                                            <p className="text-3xl font-black text-blue-600 cursor-pointer hover:text-blue-500 transition" onClick={() => { setDecisionFuente('B'); }} title="Click para usar este valor">${mB_valorPuntoSugerido.toFixed(2)}</p>
                                        </div>
                                    </motion.div>
                                )}
                                {activeTab === 'C' && (
                                    <motion.div key="C" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-4">
                                        <h3 className="text-base font-black text-slate-800">Simulador de Vouchers</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-3 rounded-xl">
                                                <label className="text-xs font-bold text-slate-700 flex justify-between">Margen Bruto <span className="text-amber-600">{margenBruto}%</span></label>
                                                <input type="range" min="5" max="80" step="5" value={margenBruto} onChange={e => setMargenBruto(Number(e.target.value))} className="w-full accent-amber-500 mt-2" />
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl">
                                                <label className="text-xs font-bold text-slate-700 flex justify-between">Umbral (Multiplicador) <span className="text-amber-600">x{umbralMultiplicador}</span></label>
                                                <input type="range" min="2" max="15" step="1" value={umbralMultiplicador} onChange={e => setUmbralMultiplicador(Number(e.target.value))} className="w-full accent-amber-500 mt-2" />
                                                <p className="text-[10px] text-slate-500 mt-1">Descuento max. asumido: <span className="font-bold text-amber-600">{((1/umbralMultiplicador)*100).toFixed(1)}%</span></p>
                                            </div>
                                        </div>

                                        <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200 mt-4">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Usar base de costo:</label>
                                            <select value={baseCalculoVoucher} onChange={e => setBaseCalculoVoucher(e.target.value as any)} className="bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold outline-none flex-1 text-slate-700">
                                                <option value="A">Porcentaje de Venta (Solapa A: {porcentajeCeder}%)</option>
                                                <option value="B">Presupuesto Fijo (Solapa B)</option>
                                                <option value="final">Valor de Punto Directo (Decisión Final: ${finalPointValue})</option>
                                            </select>
                                        </div>

                                        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200 mt-4">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2">Premio (Voucher)</th>
                                                        <th className="px-3 py-2">Puntos Necesarios</th>
                                                        <th className="px-3 py-2 text-right" title="Cuánto debe gastar el cliente en esa visita para usar el voucher">Compra Mínima Req.</th>
                                                        <th className="px-3 py-2 text-right" title="Ganancia limpia descontando el costo del producto y el voucher">ROI (Ganancia Neta)</th>
                                                        <th className="px-3 py-2 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {vouchersDinamicos.map((v, i) => {
                                                        const req = baseCalculoVoucher === 'A' 
                                                            ? Math.ceil(v / (mA_valorPuntoIdeal || 1))
                                                            : baseCalculoVoucher === 'B'
                                                            ? Math.ceil(v / (mB_valorPuntoSugerido || 1))
                                                            : Math.ceil(v / (finalPointValue || 1));
                                                        const compraMinima = v * umbralMultiplicador;
                                                        const gananciaNeta = (compraMinima - v) - (compraMinima * (costoMercaderia/100));
                                                        return (
                                                            <tr key={i} className="border-t">
                                                                <td className="px-3 py-2 font-black text-indigo-600">${v}</td>
                                                                <td className="px-3 py-2">{req} pts</td>
                                                                <td className="px-3 py-2 text-right text-slate-700 font-bold">${compraMinima.toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right text-emerald-600 font-black">+${gananciaNeta.toLocaleString()}</td>
                                                                <td className="px-3 py-2 text-right">
                                                                    <button onClick={() => setVouchersDinamicos(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
                                                    <tr className="border-t bg-slate-50/50">
                                                        <td className="px-3 py-2">
                                                            <input type="number" value={nuevoVoucher} onChange={e => setNuevoVoucher(e.target.value)} placeholder="Ej: 600" className="w-20 p-1 border rounded text-xs outline-none" />
                                                        </td>
                                                        <td colSpan={3} className="px-3 py-2">
                                                            <button onClick={() => { if(Number(nuevoVoucher) > 0) { setVouchersDinamicos([...vouchersDinamicos, Number(nuevoVoucher)]); setNuevoVoucher(''); } }} className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-indigo-200">Añadir Valor</button>
                                                        </td>
                                                    </tr>
                                                </tbody>
                                            </table>
                                        </div>

                                        {/* FRECUENCIA */}
                                        <div className="mt-6 pt-5 border-t border-slate-100">
                                            <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2"><CalendarDays size={14} className="text-indigo-500" /> Modelador de Frecuencias (Pts/Visita: {freq_puntosPorVisita.toFixed(0)})</h3>
                                            <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                                                <table className="w-full text-left text-xs">
                                                    <thead className="bg-slate-50">
                                                        <tr>
                                                            <th className="px-3 py-2">Puntos Gancho</th>
                                                            <th className="px-3 py-2">Días a Caducar</th>
                                                            <th className="px-3 py-2">Visitas Req.</th>
                                                            <th className="px-3 py-2 text-indigo-700">Frecuencia Ideal</th>
                                                            <th className="px-3 py-2 w-10"></th>
                                                        </tr>
                                                    </thead>
                                                    <tbody>
                                                        {frecuenciasDinamicas.map((freq, i) => {
                                                            const freq_visitasNecesarias = freq_puntosPorVisita > 0 ? Math.ceil(freq.gancho / freq_puntosPorVisita) : 0;
                                                            const freq_diasEntreVisitas = freq_visitasNecesarias > 0 ? freq.dias / freq_visitasNecesarias : 0;
                                                            return (
                                                                <tr key={i} className="border-t">
                                                                    <td className="px-3 py-2 font-bold">{freq.gancho} pts</td>
                                                                    <td className="px-3 py-2">{freq.dias} días</td>
                                                                    <td className="px-3 py-2">{freq_visitasNecesarias}</td>
                                                                    <td className="px-3 py-2 font-black text-indigo-600 bg-indigo-50/30">1 cada {Math.floor(freq_diasEntreVisitas)} días</td>
                                                                    <td className="px-3 py-2 text-right">
                                                                        <button onClick={() => setFrecuenciasDinamicas(prev => prev.filter((_, idx) => idx !== i))} className="text-red-400 hover:text-red-600"><X size={14}/></button>
                                                                    </td>
                                                                </tr>
                                                            );
                                                        })}
                                                        <tr className="border-t bg-slate-50/50">
                                                            <td className="px-3 py-2">
                                                                <input type="number" value={nuevoGancho} onChange={e => setNuevoGancho(e.target.value)} placeholder="Ej: 1500" className="w-20 p-1 border rounded text-xs outline-none" />
                                                            </td>
                                                            <td className="px-3 py-2">
                                                                <input type="number" value={nuevoDias} onChange={e => setNuevoDias(e.target.value)} placeholder="Ej: 90" className="w-20 p-1 border rounded text-xs outline-none" />
                                                            </td>
                                                            <td colSpan={3} className="px-3 py-2">
                                                                <button onClick={() => { if(Number(nuevoGancho) > 0 && Number(nuevoDias) > 0) { setFrecuenciasDinamicas([...frecuenciasDinamicas, {gancho: Number(nuevoGancho), dias: Number(nuevoDias)}]); setNuevoGancho(''); setNuevoDias(''); } }} className="bg-indigo-100 text-indigo-700 px-3 py-1 rounded-lg text-[10px] font-bold hover:bg-indigo-200">Añadir Caso</button>
                                                            </td>
                                                        </tr>
                                                    </tbody>
                                                </table>
                                            </div>
                                        </div>
                                    </motion.div>
                                )}

                                {activeTab === 'D' && (
                                    <motion.div key="D" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-4">
                                        <h3 className="text-base font-black text-slate-800">Distribución de Premios</h3>
                                        <p className="text-sm text-slate-500">Modelá cuántos premios podés dar al mes según los puntos que emitas (bolsa mensual).</p>
                                        
                                        <div className="flex gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200 mb-4 mt-2">
                                            <label className="text-[10px] font-bold text-slate-500 uppercase">Calcular bolsa usando:</label>
                                            <select value={baseCalculoBolsa} onChange={e => setBaseCalculoBolsa(e.target.value as any)} className="bg-white border border-slate-200 p-1.5 rounded-lg text-xs font-bold outline-none flex-1 text-slate-700">
                                                <option value="A">Facturación Bruta Mensual (Solapa A)</option>
                                                <option value="B">Presupuesto Estimado (Solapa B)</option>
                                            </select>
                                        </div>

                                        <div className="bg-purple-50 p-4 rounded-xl border border-purple-200 mb-4">
                                            <div className="flex justify-between items-center mb-2">
                                                <span className="text-xs font-bold text-purple-800 uppercase tracking-wide">Bolsa Mensual de Puntos A Distribuir</span>
                                                <span className="text-xl font-black text-purple-900">{Math.floor(mD_bolsaPuntosMensual).toLocaleString()} pts</span>
                                            </div>
                                            <p className="text-[10px] text-purple-600">Calculado en base a la Solapa seleccionada, ajustado por Tasa de Canje real.</p>
                                        </div>

                                        <div className="flex justify-between items-end mb-2">
                                            <h4 className="text-xs font-bold text-slate-700 uppercase">Niveles de Premios</h4>
                                            <button onClick={handleEcualizarDistribucion} className="bg-purple-100 hover:bg-purple-200 text-purple-700 px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1 transition-colors">
                                                Ecualizar a 100%
                                            </button>
                                        </div>

                                        <div className="space-y-3">
                                            {distribucionNiveles.map((nivel, idx) => (
                                                <div key={nivel.id} className="bg-white border border-slate-200 p-4 rounded-xl shadow-sm flex items-center gap-4">
                                                    <div className="flex-1">
                                                        <label className="text-xs font-bold text-slate-700">{nivel.nombre}</label>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <input type="range" min="0" max="100" value={nivel.pct} onChange={e => {
                                                                const newArr = [...distribucionNiveles];
                                                                newArr[idx].pct = Number(e.target.value);
                                                                setDistribucionNiveles(newArr);
                                                            }} className="w-full accent-purple-500" />
                                                            <div className="flex items-center gap-1">
                                                                <input type="number" min="0" max="100" value={nivel.pct} onChange={e => {
                                                                    const newArr = [...distribucionNiveles];
                                                                    newArr[idx].pct = Number(e.target.value);
                                                                    setDistribucionNiveles(newArr);
                                                                }} className="w-12 p-1 text-xs font-black text-purple-600 bg-purple-50 border border-purple-200 rounded text-center outline-none focus:border-purple-500" />
                                                                <span className="text-xs font-bold text-purple-600">%</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="w-[1px] h-10 bg-slate-200"></div>
                                                    <div className="flex-1">
                                                        <label className="text-[10px] font-bold text-slate-400 flex justify-between">
                                                            Costo en Pts
                                                            <span className="text-emerald-600">≈ ${(nivel.costo * (baseCalculoBolsa === 'A' ? mA_valorPuntoIdeal : mB_valorPuntoSugerido)).toFixed(2)}</span>
                                                        </label>
                                                        <input type="number" value={nivel.costo} onChange={e => {
                                                                const newArr = [...distribucionNiveles];
                                                                newArr[idx].costo = Number(e.target.value);
                                                                setDistribucionNiveles(newArr);
                                                            }} className="w-full font-black text-sm outline-none border-b border-dashed border-slate-300 focus:border-purple-500 mt-1" />
                                                    </div>
                                                    <div className="w-[1px] h-10 bg-slate-200"></div>
                                                    <div className="flex-1 text-right">
                                                        <label className="text-[10px] font-bold text-slate-400">Podés dar</label>
                                                        <p className="font-black text-lg text-emerald-600">{Math.floor((mD_bolsaPuntosMensual * (nivel.pct/100)) / (nivel.costo || 1))} <span className="text-xs">premios/mes</span></p>
                                                    </div>
                                                    <button onClick={() => setDistribucionNiveles(prev => prev.filter(n => n.id !== nivel.id))} className="text-red-400 hover:text-red-600 ml-2"><X size={16}/></button>
                                                </div>
                                            ))}

                                            {/* ADD NEW ROW */}
                                            <div className="bg-slate-50 border border-slate-200 p-3 rounded-xl flex items-center gap-3">
                                                <input type="text" placeholder="Nombre Nivel" value={nuevoNivelNombre} onChange={e => setNuevoNivelNombre(e.target.value)} className="flex-1 p-2 rounded-lg border border-slate-200 text-xs font-bold outline-none" />
                                                <input type="number" placeholder="Costo Pts" value={nuevoNivelCosto} onChange={e => setNuevoNivelCosto(e.target.value)} className="w-24 p-2 rounded-lg border border-slate-200 text-xs font-bold outline-none" />
                                                <input type="number" placeholder="% Bolsa" value={nuevoNivelPct} onChange={e => setNuevoNivelPct(e.target.value)} className="w-20 p-2 rounded-lg border border-slate-200 text-xs font-bold outline-none" />
                                                <button onClick={() => {
                                                    if(nuevoNivelNombre && Number(nuevoNivelCosto) > 0) {
                                                        setDistribucionNiveles([...distribucionNiveles, {
                                                            id: Date.now().toString(),
                                                            nombre: nuevoNivelNombre,
                                                            costo: Number(nuevoNivelCosto),
                                                            pct: Number(nuevoNivelPct) || 0
                                                        }]);
                                                        setNuevoNivelNombre('');
                                                        setNuevoNivelCosto('');
                                                        setNuevoNivelPct('');
                                                    }
                                                }} className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-4 py-2 rounded-lg text-xs font-bold">Añadir</button>
                                            </div>
                                            
                                            {/* VALIDATION */}
                                            {distribucionNiveles.reduce((acc, curr) => acc + curr.pct, 0) !== 100 && (
                                                <div className="p-3 bg-red-50 text-red-600 text-xs font-bold rounded-xl border border-red-200 flex items-center gap-2">
                                                    <AlertCircle size={14} /> La suma de los porcentajes debe dar 100%. Actualmente es {distribucionNiveles.reduce((acc, curr) => acc + curr.pct, 0).toFixed(1)}%.
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}

                            </AnimatePresence>
                        </div>

                        {/* FOOTER (SAVE ACTION) */}
                        <div className="bg-slate-50 border-t border-slate-200 p-5 shrink-0 flex items-center justify-end">
                            <button type="button" onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                                <CheckCircle size={18} /> Guardar Valor del Punto
                            </button>
                        </div>
                    </div>
                </div>
                )}
            </div>
        </div>
    );
};
