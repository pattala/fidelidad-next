import React, { useState, useEffect } from 'react';
import { Calculator, DollarSign, AlertCircle, Activity, Clock, Target, CalendarDays, Gift, X, CheckCircle } from 'lucide-react';
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

    // Mode C Inputs (Catálogo Automático)
    const [precioPromedioPremio, setPrecioPromedioPremio] = useState<number>(5000);
    const [puntosPromedioPremio, setPuntosPromedioPremio] = useState<number>(1000);

    // Mode D Inputs (Vouchers)
    const [margenBruto, setMargenBruto] = useState<number>(30);
    const [umbralMultiplicador, setUmbralMultiplicador] = useState<number>(7);

    // Módulo Frecuencia Inputs
    const [puntosPremioGancho, setPuntosPremioGancho] = useState<number>(500);
    const [diasCaducidad, setDiasCaducidad] = useState<number>(30);

    // Final Decision
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
    const mA_costoReal = mA_presupuestoTeorico * (tasaCanje / 100);

    const mB_facturacionEstimada = ticketPromedio * clientesAlMes;
    const mB_puntosEmitidos = mB_facturacionEstimada / reglaPuntos;
    const mB_valorPuntoSugerido = (presupuestoFijo / (mB_puntosEmitidos * (tasaCanje / 100))) || 0;
    const mB_porcentajeFacturacion = mB_facturacionEstimada > 0 ? (presupuestoFijo / mB_facturacionEstimada) * 100 : 0;

    const mC_valorPuntoImplicito = puntosPromedioPremio > 0 ? (precioPromedioPremio / puntosPromedioPremio) : 0;
    const mC_costoPorPuntoAjustado = mC_valorPuntoImplicito * (tasaCanje / 100);

    const costoMercaderia = 100 - margenBruto;
    const vouchersSuggeridos = [
        ticketPromedio * 0.1, ticketPromedio * 0.2, ticketPromedio * 0.33, ticketPromedio * 0.5
    ].map(v => Math.round(v / 100) * 100);

    const freq_puntosPorVisita = ticketPromedio / reglaPuntos;
    const freq_visitasNecesarias = freq_puntosPorVisita > 0 ? Math.ceil(puntosPremioGancho / freq_puntosPorVisita) : 0;
    const freq_diasEntreVisitas = freq_visitasNecesarias > 0 ? diasCaducidad / freq_visitasNecesarias : 0;

    const handleSave = () => {
        onSave({
            pointCalculationMethod: 'manual', // Obligamos a que sea manual/fijo a partir de ahora
            pointValue: finalPointValue,
            pointsMoneyBase: reglaPuntos,
            useAutomaticPointValue: false
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
                    <button onClick={onClose} className="w-8 h-8 flex items-center justify-center bg-white/10 hover:bg-white/20 rounded-full transition-colors">
                        <X size={18} />
                    </button>
                </div>

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
                        </div>
                    </div>

                    {/* MAIN CONTENT */}
                    <div className="flex-1 flex flex-col overflow-hidden bg-white">
                        
                        {/* TABS */}
                        <div className="flex border-b border-slate-200 shrink-0 overflow-x-auto">
                            <button onClick={() => setActiveTab('A')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'A' ? 'border-emerald-500 text-emerald-600 bg-emerald-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>A. Por Facturación</button>
                            <button onClick={() => setActiveTab('B')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'B' ? 'border-blue-500 text-blue-600 bg-blue-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>B. Presupuesto</button>
                            <button onClick={() => setActiveTab('C')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'C' ? 'border-purple-500 text-purple-600 bg-purple-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}>C. Diagnóstico</button>
                            <button onClick={() => setActiveTab('D')} className={`flex-1 min-w-[120px] py-3 text-xs font-bold border-b-2 transition-colors ${activeTab === 'D' ? 'border-amber-500 text-amber-600 bg-amber-50/50' : 'border-transparent text-slate-500 hover:bg-slate-50'}`}><Gift size={14} className="inline mr-1 -mt-0.5" />D. Vouchers</button>
                        </div>

                        <div className="p-5 overflow-y-auto flex-1">
                            {/* ... Contenido de las pestañas (idéntico al MasterCalculator.tsx) ... */}
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
                                            <p className="text-3xl font-black text-emerald-600 cursor-pointer hover:text-emerald-500 transition" onClick={() => setFinalPointValue(mA_valorPuntoIdeal)} title="Click para usar este valor">${mA_valorPuntoIdeal.toFixed(2)}</p>
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
                                            <p className="text-3xl font-black text-blue-600 cursor-pointer hover:text-blue-500" onClick={() => setFinalPointValue(mB_valorPuntoSugerido)}>${mB_valorPuntoSugerido.toFixed(2)}</p>
                                        </div>
                                    </motion.div>
                                )}
                                {activeTab === 'C' && (
                                    <motion.div key="C" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-5">
                                        <h3 className="text-base font-black text-slate-800">Diagnóstico Inverso</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Precio del Premio</label>
                                                <input type="number" value={precioPromedioPremio} onChange={e => setPrecioPromedioPremio(Number(e.target.value))} className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded font-bold outline-none text-sm" />
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl border border-slate-100">
                                                <label className="text-[10px] font-bold text-slate-400 uppercase">Puntos Exigidos</label>
                                                <input type="number" value={puntosPromedioPremio} onChange={e => setPuntosPromedioPremio(Number(e.target.value))} className="w-full mt-1 p-1.5 bg-white border border-slate-200 rounded font-bold outline-none text-sm" />
                                            </div>
                                        </div>
                                        <div className="bg-purple-50 p-4 rounded-2xl border border-purple-100 flex items-center justify-between">
                                            <div><p className="text-purple-800 font-bold text-sm">Valor Implícito del Punto</p></div>
                                            <p className="text-3xl font-black text-purple-600">${mC_valorPuntoImplicito.toFixed(2)}</p>
                                        </div>
                                    </motion.div>
                                )}
                                {activeTab === 'D' && (
                                    <motion.div key="D" initial={{opacity:0, y:10}} animate={{opacity:1, y:0}} exit={{opacity:0, y:-10}} className="space-y-4">
                                        <h3 className="text-base font-black text-slate-800">Simulador de Vouchers</h3>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="bg-slate-50 p-3 rounded-xl">
                                                <label className="text-xs font-bold text-slate-700 flex justify-between">Margen Bruto <span className="text-amber-600">{margenBruto}%</span></label>
                                                <input type="range" min="5" max="80" step="5" value={margenBruto} onChange={e => setMargenBruto(Number(e.target.value))} className="w-full accent-amber-500 mt-2" />
                                            </div>
                                            <div className="bg-slate-50 p-3 rounded-xl">
                                                <label className="text-xs font-bold text-slate-700 flex justify-between">Umbral (Multiplicador) <span className="text-amber-600">x{umbralMultiplicador}</span></label>
                                                <input type="range" min="2" max="15" step="1" value={umbralMultiplicador} onChange={e => setUmbralMultiplicador(Number(e.target.value))} className="w-full accent-amber-500 mt-2" />
                                            </div>
                                        </div>
                                        <div className="overflow-x-auto bg-white rounded-xl border border-slate-200">
                                            <table className="w-full text-left text-xs">
                                                <thead className="bg-slate-50">
                                                    <tr>
                                                        <th className="px-3 py-2">Premio</th><th className="px-3 py-2">Puntos (usando {porcentajeCeder}%)</th><th className="px-3 py-2 text-right">Ganancia Neta</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {vouchersSuggeridos.map((v, i) => {
                                                        const req = Math.ceil((v / (porcentajeCeder/100)) / reglaPuntos);
                                                        const gananciaNeta = (v * umbralMultiplicador - v) - (v * umbralMultiplicador * (costoMercaderia/100));
                                                        return (
                                                            <tr key={i} className="border-t">
                                                                <td className="px-3 py-2 font-bold">${v}</td>
                                                                <td className="px-3 py-2">{req} pts</td>
                                                                <td className="px-3 py-2 text-right text-emerald-600 font-bold">+${gananciaNeta}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                </tbody>
                                            </table>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* FRECUENCIA */}
                            <div className="mt-6 pt-5 border-t border-slate-100">
                                <h3 className="text-sm font-black text-slate-800 mb-3 flex items-center gap-2"><CalendarDays size={14} className="text-indigo-500" /> Frecuencia vs Caducidad</h3>
                                <div className="grid grid-cols-4 gap-2 mb-3">
                                    <div className="p-2 border rounded-lg"><label className="text-[9px] font-bold text-slate-400">Pts Gancho</label><input type="number" value={puntosPremioGancho} onChange={e=>setPuntosPremioGancho(Number(e.target.value))} className="w-full font-bold outline-none text-xs" /></div>
                                    <div className="p-2 border rounded-lg"><label className="text-[9px] font-bold text-slate-400">Días Caduca</label><input type="number" value={diasCaducidad} onChange={e=>setDiasCaducidad(Number(e.target.value))} className="w-full font-bold outline-none text-xs" /></div>
                                    <div className="p-2 bg-slate-50 rounded-lg"><label className="text-[9px] font-bold text-slate-400">Pts/Visita</label><p className="font-bold text-xs">{freq_puntosPorVisita.toFixed(0)}</p></div>
                                    <div className="p-2 bg-slate-50 rounded-lg"><label className="text-[9px] font-bold text-slate-400">Visitas Req</label><p className="font-bold text-xs">{freq_visitasNecesarias}</p></div>
                                </div>
                                <div className="bg-indigo-50 p-3 rounded-xl"><p className="text-xs text-indigo-800 font-medium">El cliente debe visitar 1 vez cada <strong>{freq_diasEntreVisitas.toFixed(0)} días</strong> para llegar al premio antes que caduque.</p></div>
                            </div>
                        </div>

                        {/* FOOTER (SAVE ACTION) */}
                        <div className="bg-slate-50 border-t border-slate-200 p-5 shrink-0 flex items-center justify-between">
                            <div>
                                <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Decisión Final: Valor Fijo del Punto</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-black text-slate-800">$</span>
                                    <input type="number" step="0.01" value={finalPointValue} onChange={(e) => setFinalPointValue(Number(e.target.value))} className="w-32 p-2 text-xl font-black text-indigo-700 bg-white border-2 border-indigo-200 focus:border-indigo-500 rounded-xl outline-none" />
                                </div>
                            </div>
                            <button onClick={handleSave} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold py-3 px-8 rounded-xl shadow-lg shadow-indigo-200 transition-all flex items-center gap-2">
                                <CheckCircle size={18} /> Exportar y Guardar
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
