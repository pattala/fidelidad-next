import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Palette, Calculator, Monitor, Settings, Home, Gift, MessageCircle } from 'lucide-react';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import { EmailService } from '../../../services/emailService';
import { toast } from 'react-hot-toast';
import { PointValueCalculatorModal } from '../components/PointValueCalculatorModal';
// import { ChannelSelector } from '../components/ChannelSelector';
import type { AppConfig, MessagingChannel } from '../../../types';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNavigate } from 'react-router-dom';

const ChannelSelector = ({
    label,
    channels,
    onChange
}: {
    label?: string;
    channels: MessagingChannel[];
    onChange: (channels: MessagingChannel[]) => void;
}) => {
    const toggle = (ch: MessagingChannel) => {
        if (channels.includes(ch)) onChange(channels.filter(c => c !== ch));
        else onChange([...channels, ch]);
    };

    return (
        <div className="mt-3 bg-gray-50/50 p-3 rounded-lg border border-gray-100">
            <span className="text-xs font-bold text-gray-500 uppercase tracking-wider block mb-2">{label || 'Canales de Envío:'}</span>
            <div className="flex gap-4">
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-white p-1 rounded transition">
                    <input type="checkbox" checked={channels.includes('whatsapp')} onChange={() => toggle('whatsapp')}
                        className="rounded border-gray-300 text-green-600 focus:ring-green-500" />
                    WhatsApp
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-white p-1 rounded transition">
                    <input type="checkbox" checked={channels.includes('email')} onChange={() => toggle('email')}
                        className="rounded border-gray-300 text-blue-600 focus:ring-blue-500" />
                    Email
                </label>
                <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-white p-1 rounded transition">
                    <input type="checkbox" checked={channels.includes('push')} onChange={() => toggle('push')}
                        className="rounded border-gray-300 text-purple-600 focus:ring-purple-500" />
                    Push
                </label>
            </div>
        </div>
    );
};

const VariableChips = ({ vars, onSelect }: { vars: string[], onSelect: (v: string) => void }) => (
    <div className="mt-2 flex flex-wrap gap-1">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mr-1 mt-1">Insertar:</span>
        {vars.map(v => (
            <button
                key={v}
                type="button"
                onClick={() => onSelect(v)}
                className="px-2 py-0.5 bg-gray-100 hover:bg-gray-200 text-gray-600 rounded text-[10px] font-bold transition-colors"
            >
                {`{${v}}`}
            </button>
        ))}
    </div>
);

export const ConfigPage = () => {
    const { role, loading: authLoading } = useAdminAuth();
    const navigate = useNavigate();

    // Redirección si no es admin
    useEffect(() => {
        if (!authLoading && role && role !== 'admin') {
            toast.error('No tienes permisos para acceder a esta configuración.');
            navigate('/admin/dashboard');
        }
    }, [role, authLoading, navigate]);

    // Estado inicial
    const [config, setConfig] = useState<AppConfig>({
        siteName: 'Club Fidelidad',
        primaryColor: '#2563eb',
        secondaryColor: '#1e3a8a',
        backgroundColor: '#f9fafb',
        sectionTitleColor: '#9ca3af', // Default gray-400
        linkColor: '#4a148c', // Default purple-900 like
        logoUrl: '',
        pointsPerPeso: 1,
        pointsMoneyBase: 100, // Default 100
        welcomePoints: 100,
        expirationRules: [], // Iniciar vacío
        messaging: {
            emailEnabled: true,
            whatsappEnabled: false,
            pushEnabled: true,
            whatsappPhoneNumber: '',
            whatsappDefaultMessage: '',
            eventConfigs: {
                welcome: { channels: ['email', 'push'] },
                pointsAdded: { channels: ['whatsapp', 'push', 'email'] },
                redemption: { channels: ['whatsapp', 'push', 'email'] },
                campaign: { channels: ['push', 'email'] },
                offer: { channels: ['push', 'email'] }
            }
        },
        enableExternalIntegration: true
    });

    const [activeTab, setActiveTab] = useState<'branding' | 'rules' | 'messaging'>('rules'); // Empezar en Reglas por petición del usuario
    const [loading, setLoading] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [autoPointValue, setAutoPointValue] = useState<number>(0);

    // Updated type definition in insertVar to include 'birthday'
    const insertVar = (field: 'pointsAdded' | 'redemption' | 'welcome' | 'campaign' | 'offer' | 'birthday', variable: string) => {
        const currentTemplates = config.messaging?.templates || {};
        const currentValue = currentTemplates[field] || '';
        setConfig({
            ...config,
            messaging: {
                ...config.messaging!,
                templates: {
                    ...currentTemplates,
                    [field]: `${currentValue} {${variable}} `
                }
            }
        });
    };

    // Calcular valor automático para mostrarlo
    useEffect(() => {
        const fetchAutoValue = async () => {
            if (activeTab === 'rules') {
                try {
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
                    if (validPrizesCount > 0) {
                        setAutoPointValue(totalRatio / validPrizesCount);
                    }
                } catch (e) {
                    console.error("Error calculating auto value", e);
                }
            }
        };
        fetchAutoValue();
    }, [activeTab]);

    const handleTestEmail = () => {
        if (!config) return;
        const html = EmailService.generateBrandedTemplate(config, 'Prueba de Identidad Visual', 'Este es un correo de prueba para verificar que el logo y los colores se aplican correctamente en tus notificaciones por email.\n\nSi ves esto correctamente, ¡tu configuración de marca está lista!');
        const win = window.open('', '_blank');
        if (win) {
            win.document.write(html);
            win.document.close();
        } else {
            toast.error('Por favor permite ventanas emergentes para ver la previsualización');
        }
    };

    // Cargar config al montar
    useEffect(() => {
        const load = async () => {
            const saved = await ConfigService.get();
            if (saved) {
                setConfig({
                    ...config, // defaults
                    ...saved  // overwrite with saved
                });
                applyColors(saved);
            }
        };
        load();
    }, []);

    useEffect(() => {
        applyColors(config);
    }, [config.primaryColor, config.secondaryColor, config.backgroundColor]);

    const applyColors = (cfg: AppConfig) => {
        document.documentElement.style.setProperty('--color-primary', cfg.primaryColor);
        document.documentElement.style.setProperty('--color-secondary', cfg.secondaryColor || '#1e3a8a');
        document.documentElement.style.setProperty('--color-background', cfg.backgroundColor || '#f9fafb');
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (role !== 'admin') {
            toast.error('No tienes permisos para guardar cambios.');
            return;
        }
        setLoading(true);
        try {
            await ConfigService.save(config);
            toast.success('¡Configuración guardada correctamente!');
        } catch (error) {
            toast.error('Error al guardar la configuración');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex flex-col md:flex-row justify-between items-end border-b border-gray-100 pb-6 gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Configuración</h1>
                    <p className="text-gray-500 mt-1">Personaliza el funcionamiento y la apariencia de tu programa de fidelidad.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        onClick={() => setActiveTab('rules')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'rules' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calculator size={18} />
                        Reglas del Juego
                    </button>
                    <button
                        onClick={() => setActiveTab('branding')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'branding' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Palette size={18} />
                        Identidad Visual
                    </button>
                    <button
                        onClick={() => setActiveTab('messaging')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'messaging' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <span className="text-green-500 text-lg">💬</span>
                        Mensajería
                    </button>
                </div>
            </div>

            <form onSubmit={handleSave} className="animate-fade-in">

                <PointValueCalculatorModal
                    isOpen={showCalculator}
                    onClose={() => setShowCalculator(false)}
                    config={config}
                    onSave={(newConfig) => setConfig({ ...config, ...newConfig })}
                />

                {/* Pestaña: REGLAS DEL JUEGO (Lo que pidió el usuario) */}
                {activeTab === 'rules' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            {/* Tarjeta de Conversión */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden group hover:shadow-md transition">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition group-hover:bg-blue-100"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 relative z-10">
                                    <span className="bg-blue-100 text-blue-600 p-2 rounded-lg"><Calculator size={20} /></span>
                                    Valor del Punto
                                </h3>

                                <div className="space-y-6 relative z-10">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Equivalencia de Puntos</label>
                                        <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-200">
                                            <div className="flex-1">
                                                <span className="block text-xs text-gray-500 uppercase font-bold mb-1">Por cada Gasto de ($)</span>
                                                <div className="relative">
                                                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500 font-bold">$</span>
                                                    <input
                                                        type="number" min="1"
                                                        placeholder="100"
                                                        value={config.pointsMoneyBase || 100}
                                                        onChange={e => setConfig({ ...config, pointsMoneyBase: parseInt(e.target.value) || 0 })}
                                                        className="w-full pl-8 pr-4 py-3 bg-white rounded-lg border-gray-300 border text-gray-700 font-bold text-lg text-center outline-none focus:ring-2 focus:ring-blue-100"
                                                    />
                                                </div>
                                            </div>
                                            <div className="text-gray-400 flex flex-col items-center">
                                                <span className="text-sm font-bold">se otorgan</span>
                                                <span className="text-2xl font-bold">➜</span>
                                            </div>
                                            <div className="flex-1">
                                                <span className="block text-xs text-blue-600 uppercase font-bold mb-1">Puntos Generados</span>
                                                <div className="relative">
                                                    <input
                                                        type="number" min="0.1" step="0.1"
                                                        value={config.pointsPerPeso}
                                                        onChange={e => setConfig({ ...config, pointsPerPeso: parseFloat(e.target.value) || 0 })}
                                                        className="w-full pl-4 pr-12 py-3 bg-white rounded-lg border-blue-200 border-2 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 text-blue-700 font-mono font-bold text-xl text-center outline-none transition"
                                                    />
                                                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-600 text-xs font-bold uppercase">Pts</span>
                                                </div>
                                            </div>
                                        </div>
                                        <p className="text-xs text-gray-500 mt-2">
                                            Define cuántos puntos recibe un cliente por cada compra. <br />
                                            Ejemplo: Si pones <strong>10 Pts</strong> arriba, por cada <strong>$100</strong> de compra el cliente recibirá <strong>10 puntos</strong>.
                                        </p>

                                        <div className="mt-6 pt-6 border-t border-gray-100">
                                            <div className="flex items-center justify-between mb-4">
                                                <div>
                                                    <label className="block text-sm font-semibold text-gray-700">Valor Monetario del Punto (Pasivo)</label>
                                                    <p className="text-xs text-gray-400 mt-1">Cómo se calcula tu deuda en puntos.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCalculator(true)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-lg text-xs font-bold hover:bg-blue-100 transition"
                                                >
                                                    <Calculator size={14} />
                                                    Configurar Cálculo
                                                </button>
                                            </div>

                                            {/* Summary Card */}
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200">
                                                <div className="flex justify-between items-center mb-2">
                                                    <span className="text-xs font-bold text-gray-500 uppercase tracking-wider">Método Actual</span>
                                                    <span className={`text-xs font-bold px-2 py-1 rounded badge ${(config.pointCalculationMethod === 'manual' || (!config.pointCalculationMethod && !config.useAutomaticPointValue)) ? 'bg-green-100 text-green-700' :
                                                        (config.pointCalculationMethod === 'average' || config.useAutomaticPointValue) ? 'bg-purple-100 text-purple-700' :
                                                            'bg-orange-100 text-orange-700'
                                                        }`}>
                                                        {(config.pointCalculationMethod === 'manual' || (!config.pointCalculationMethod && !config.useAutomaticPointValue)) ? 'MANUAL' :
                                                            (config.pointCalculationMethod === 'average' || config.useAutomaticPointValue) ? 'PROMEDIO PREMIOS' :
                                                                'PRESUPUESTO'}
                                                    </span>
                                                </div>

                                                <div className="flex items-end gap-2">
                                                    <span className="text-2xl font-black text-gray-800">
                                                        $ {
                                                            (config.pointCalculationMethod === 'budget' && config.pointValueBudget) ? 'Varía (Dinámico)' : // Dynamic logic is complex to show here without fetching stats
                                                                (config.pointCalculationMethod === 'average' || config.useAutomaticPointValue) ? autoPointValue.toFixed(2) :
                                                                    (config.pointValue || 10)
                                                        }
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-400 mb-1">/ punto</span>
                                                </div>

                                                {/* Extra info for Budget mode */}
                                                {config.pointCalculationMethod === 'budget' && (
                                                    <p className="text-xs text-orange-600 mt-2 font-medium">
                                                        Controlado por presupuesto mensual de: <strong>${config.pointValueBudget?.toLocaleString()}</strong>
                                                    </p>
                                                )}

                                                {/* Extra info for Auto/Average mode */}
                                                {(config.pointCalculationMethod === 'average' || config.useAutomaticPointValue) && (
                                                    <p className="text-xs text-purple-600 mt-2 font-medium">
                                                        Calculado automáticamente según tus premios activos.
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="space-y-6">
                            {/* Tarjeta de Ajustes Generales */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 h-full">
                                <h3 className="text-lg font-bold text-gray-800 mb-6">Políticas del Programa</h3>
                                <div className="space-y-6">
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-semibold text-gray-700">🎁 Bienvenida (Nuevo Cliente)</label>
                                        </div>

                                        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-200 space-y-4">
                                            {/* 1. Automatic Points */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <span className="text-sm font-bold text-gray-800">Regalar Puntos al Registrarse</span>
                                                    <p className="text-xs text-gray-500">El cliente recibe puntos automáticamente tras validar su cuenta.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfig({ ...config, enableWelcomeBonus: !config.enableWelcomeBonus })}
                                                    className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableWelcomeBonus ? 'bg-blue-600' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableWelcomeBonus ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {config.enableWelcomeBonus && (
                                                <div className="flex items-center gap-3 animate-fade-in pl-2 border-l-2 border-blue-200">
                                                    <input
                                                        type="number"
                                                        value={config.welcomePoints}
                                                        onChange={e => setConfig({ ...config, welcomePoints: parseInt(e.target.value) || 0 })}
                                                        className="w-24 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 font-bold text-gray-700 text-center"
                                                    />
                                                    <span className="text-gray-500 text-sm font-medium">puntos de bienvenida.</span>
                                                </div>
                                            )}

                                            {/* 2. Automatic Message */}
                                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                                <div className="flex-1">
                                                    <span className="text-sm font-bold text-gray-800">Enviar Mensaje de Bienvenida</span>
                                                    <p className="text-xs text-gray-500">Enviar Email y notificación Push al completar registro.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfig({ ...config, enableWelcomeMessage: config.enableWelcomeMessage === undefined ? true : !config.enableWelcomeMessage })}
                                                    className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableWelcomeMessage !== false ? 'bg-indigo-500' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableWelcomeMessage !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="block text-sm font-semibold text-gray-700">🎂 Cumpleaños</label>
                                        </div>

                                        <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-200 space-y-4">
                                            {/* 1. Automatic Points */}
                                            <div className="flex items-center justify-between">
                                                <div className="flex-1">
                                                    <span className="text-sm font-bold text-gray-800">Regalar Puntos Automáticamente</span>
                                                    <p className="text-xs text-gray-500">El cliente recibe puntos al iniciar sesión en su cumple.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfig({ ...config, enableBirthdayBonus: !config.enableBirthdayBonus })}
                                                    className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableBirthdayBonus ? 'bg-pink-500' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableBirthdayBonus ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>

                                            {config.enableBirthdayBonus && (
                                                <div className="flex items-center gap-3 animate-fade-in pl-2 border-l-2 border-pink-200">
                                                    <input
                                                        type="number"
                                                        value={config.birthdayPoints}
                                                        onChange={e => setConfig({ ...config, birthdayPoints: parseInt(e.target.value) || 0 })}
                                                        className="w-24 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-pink-100 font-bold text-gray-700 text-center"
                                                    />
                                                    <span className="text-gray-500 text-sm font-medium">puntos de regalo.</span>
                                                </div>
                                            )}

                                            {/* 2. Automatic Message */}
                                            <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                                <div className="flex-1">
                                                    <span className="text-sm font-bold text-gray-800">Enviar Saludo Automático</span>
                                                    <p className="text-xs text-gray-500">Enviar Push/Email/WhatsApp automáticamente.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfig({ ...config, enableBirthdayMessage: config.enableBirthdayMessage === undefined ? true : !config.enableBirthdayMessage })}
                                                    className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableBirthdayMessage !== false ? 'bg-blue-500' : 'bg-gray-200'}`}
                                                >
                                                    <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableBirthdayMessage !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                                </button>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="pt-6 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-4">
                                            <div>
                                                <label className="block text-sm font-semibold text-gray-700">📅 Vencimiento por Escalas</label>
                                                <p className="text-xs text-gray-400 mt-1">Define cuánto duran los puntos según la cantidad obtenida.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({
                                                    ...config,
                                                    expirationRules: [
                                                        ...(config.expirationRules || []),
                                                        { minPoints: 0, maxPoints: null, validityDays: 30 }
                                                    ]
                                                })}
                                                className="text-xs bg-blue-50 text-blue-600 px-3 py-1.5 rounded-lg font-bold hover:bg-blue-100 transition flex items-center gap-1"
                                            >
                                                <Plus size={14} /> Agregar Regla
                                            </button>
                                        </div>

                                        <div className="bg-gray-50 rounded-xl border border-gray-200 overflow-hidden">
                                            <table className="w-full text-sm text-left">
                                                <thead className="bg-gray-100 text-xs text-gray-500 uppercase font-bold">
                                                    <tr>
                                                        <th className="p-3 pl-4">Desde (Pts)</th>
                                                        <th className="p-3">Hasta (Pts)</th>
                                                        <th className="p-3">Validez (Días)</th>
                                                        <th className="p-3 w-10"></th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-gray-200">
                                                    {(config.expirationRules || []).map((rule, idx) => (
                                                        <tr key={idx} className="bg-white">
                                                            <td className="p-2 pl-4">
                                                                <input
                                                                    type="number" min="0"
                                                                    className="w-full bg-transparent outline-none font-bold text-gray-700 placeholder-gray-300"
                                                                    placeholder="0"
                                                                    value={rule.minPoints}
                                                                    onChange={e => {
                                                                        const newRules = [...(config.expirationRules || [])];
                                                                        newRules[idx].minPoints = parseInt(e.target.value) || 0;
                                                                        setConfig({ ...config, expirationRules: newRules });
                                                                    }}
                                                                />
                                                            </td>
                                                            <td className="p-2">
                                                                <div className="flex items-center gap-2">
                                                                    <input
                                                                        type="number" min="0"
                                                                        className="w-full bg-transparent outline-none font-bold text-gray-700 placeholder-gray-300 disabled:opacity-50"
                                                                        placeholder="Infinito"
                                                                        value={rule.maxPoints === null ? '' : rule.maxPoints}
                                                                        onChange={e => {
                                                                            const val = e.target.value === '' ? null : parseInt(e.target.value);
                                                                            const newRules = [...(config.expirationRules || [])];
                                                                            newRules[idx].maxPoints = val;
                                                                            setConfig({ ...config, expirationRules: newRules });
                                                                        }}
                                                                    />
                                                                    {rule.maxPoints === null && <span className="text-xs text-gray-400 font-mono">∞</span>}
                                                                </div>
                                                            </td>
                                                            <td className="p-2">
                                                                <div className="flex items-center gap-1">
                                                                    <input
                                                                        type="number" min="1"
                                                                        className="w-16 bg-transparent outline-none font-bold text-blue-600"
                                                                        value={rule.validityDays}
                                                                        onChange={e => {
                                                                            const newRules = [...(config.expirationRules || [])];
                                                                            newRules[idx].validityDays = parseInt(e.target.value) || 0;
                                                                            setConfig({ ...config, expirationRules: newRules });
                                                                        }}
                                                                    />
                                                                    <span className="text-xs text-gray-400">días</span>
                                                                </div>
                                                            </td>
                                                            <td className="p-2 pr-4 text-right">
                                                                <button
                                                                    type="button"
                                                                    onClick={() => {
                                                                        const newRules = [...(config.expirationRules || [])];
                                                                        newRules.splice(idx, 1);
                                                                        setConfig({ ...config, expirationRules: newRules });
                                                                    }}
                                                                    className="text-gray-400 hover:text-red-500 transition"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </button>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                    {(!config.expirationRules || config.expirationRules.length === 0) && (
                                                        <tr>
                                                            <td colSpan={4} className="p-4 text-center text-xs text-gray-400 italic">
                                                                No hay reglas definidas. Los puntos no tendrán vencimiento específico (o usarán default).
                                                            </td>
                                                        </tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tarjeta de Integraciones Externas */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mt-6">
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <span className="bg-purple-100 text-purple-600 p-2 rounded-lg"><Monitor size={20} /></span>
                                    Integraciones Externas
                                </h3>

                                <div className="bg-purple-50/50 p-4 rounded-xl border border-purple-100">
                                    <div className="flex items-center justify-between">
                                        <div className="flex-1">
                                            <span className="text-sm font-bold text-gray-800">Habilitar Extensión de Navegador</span>
                                            <p className="text-xs text-gray-500">Permitir que la extensión de Chrome capture montos de tu sistema de facturación.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({ ...config, enableExternalIntegration: !config.enableExternalIntegration })}
                                            className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableExternalIntegration !== false ? 'bg-purple-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableExternalIntegration !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>
                                    <p className="text-[10px] text-purple-400 mt-3 italic">
                                        * Esta opción controla si el servidor procesa puntos enviados desde herramientas externas como el facturador.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )
                }

                {
                    activeTab === 'branding' && (
                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-fade-in">
                            {/* ... (Existing Branding Content) ... */}
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100">
                                {/* ... (Existing Form) ... */}
                                <h2 className="text-lg font-semibold mb-6 text-gray-800">Personalización de Marca</h2>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Nombre del Club</label>
                                        <input
                                            type="text"
                                            value={config.siteName}
                                            onChange={e => setConfig({ ...config, siteName: e.target.value })}
                                            className="w-full rounded-lg border-gray-200 border p-3 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                        />
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Color Primario</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={config.primaryColor}
                                                    onChange={e => setConfig({ ...config, primaryColor: e.target.value })}
                                                    className="h-12 w-full rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                                />
                                                <span className="text-xs font-mono text-gray-500">{config.primaryColor}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Color Secundario</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={config.secondaryColor}
                                                    onChange={e => setConfig({ ...config, secondaryColor: e.target.value })}
                                                    className="h-12 w-full rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                                />
                                                <span className="text-xs font-mono text-gray-500">{config.secondaryColor}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Color de Fondo</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={config.backgroundColor || '#f9fafb'}
                                                    onChange={e => setConfig({ ...config, backgroundColor: e.target.value })}
                                                    className="h-12 w-full rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                                />
                                                <span className="text-xs font-mono text-gray-500">{config.backgroundColor || '#f9fafb'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Color de Títulos</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={config.sectionTitleColor || '#9ca3af'}
                                                    onChange={e => setConfig({ ...config, sectionTitleColor: e.target.value })}
                                                    className="h-12 w-full rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                                />
                                                <span className="text-xs font-mono text-gray-500">{config.sectionTitleColor || '#9ca3af'}</span>
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Color de Enlaces</label>
                                            <div className="flex items-center gap-3">
                                                <input
                                                    type="color"
                                                    value={config.linkColor || '#4a148c'}
                                                    onChange={e => setConfig({ ...config, linkColor: e.target.value })}
                                                    className="h-12 w-full rounded-lg cursor-pointer border-0 bg-transparent p-0"
                                                />
                                                <span className="text-xs font-mono text-gray-500">{config.linkColor || '#4a148c'}</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-sm font-medium text-gray-700 mb-2">Logo URL</label>
                                        <input
                                            type="text"
                                            placeholder="https://..."
                                            value={config.logoUrl}
                                            onChange={e => setConfig({ ...config, logoUrl: e.target.value })}
                                            className="w-full rounded-lg border-gray-200 border p-3 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                        />
                                        <p className="text-xs text-gray-400 mt-2">Recomendado: PNG transparente de 200x200px</p>
                                    </div>

                                    {/* SECTION: Contact & Social */}
                                    <div className="pt-6 border-t border-gray-100 space-y-4">
                                        <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                            📱 Contacto y Redes
                                        </h4>

                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <div className="col-span-full">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Dirección del Local</label>
                                                <input
                                                    type="text"
                                                    placeholder="Av. Principal 123..."
                                                    value={config.contact?.address || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, address: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-full">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Horarios de Atención</label>
                                                <input
                                                    type="text"
                                                    placeholder="Lun a Vie 9 a 18 hs..."
                                                    value={config.contact?.openingHours || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, openingHours: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">WhatsApp (Soporte)</label>
                                                <input
                                                    type="text"
                                                    placeholder="549..."
                                                    value={config.contact?.whatsapp || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, whatsapp: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-green-100 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Email Público</label>
                                                <input
                                                    type="email"
                                                    placeholder="contacto@..."
                                                    value={config.contact?.email || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, email: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Instagram</label>
                                                <input
                                                    type="text"
                                                    placeholder="@usuario"
                                                    value={config.contact?.instagram || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, instagram: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-pink-100 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Facebook</label>
                                                <input
                                                    type="text"
                                                    placeholder="/pagina"
                                                    value={config.contact?.facebook || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, facebook: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-blue-100 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-full">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Sitio Web</label>
                                                <input
                                                    type="text"
                                                    placeholder="https://..."
                                                    value={config.contact?.website || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, website: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-gray-100 outline-none"
                                                />
                                            </div>
                                            <div className="col-span-full">
                                                <label className="block text-xs font-semibold text-gray-600 mb-1">Link Términos y Condiciones</label>
                                                <input
                                                    type="text"
                                                    placeholder="https://..."
                                                    value={config.contact?.termsAndConditions || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        contact: { ...config.contact!, termsAndConditions: e.target.value }
                                                    })}
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm focus:ring-2 focus:ring-gray-100 outline-none"
                                                />
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Vista Previa Móvil */}
                            <div className="flex flex-col items-center justify-start pt-8">
                                <div
                                    className="border-[8px] border-gray-900 rounded-[3rem] overflow-hidden w-80 shadow-2xl relative h-[600px] transition-colors duration-500"
                                    style={{ backgroundColor: config.backgroundColor || '#f9fafb' }}
                                >
                                    {/* Notch */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-xl z-20"></div>

                                    {/* Header Mock */}
                                    <div className="p-6 pt-12 text-white flex justify-between items-center transition-colors duration-500" style={{ backgroundColor: config.primaryColor }}>
                                        <div className="flex items-center gap-2">
                                            {config.logoUrl ? (
                                                <img src={config.logoUrl} alt="Logo" className="w-8 h-8 rounded-full object-contain bg-white" />
                                            ) : (
                                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-[10px]">Logo</div>
                                            )}
                                            <span className="font-bold">{config.siteName}</span>
                                        </div>
                                    </div>

                                    {/* Hero Mock */}
                                    <div className="p-6 m-4 rounded-2xl text-white shadow-lg text-center transition-colors duration-500" style={{ backgroundColor: config.secondaryColor }}>
                                        <p className="text-sm opacity-80 mb-1">Tu Saldo</p>
                                        <p className="text-4xl font-black tracking-tight">1.250</p>
                                        <span className="text-xs uppercase tracking-widest opacity-70">Puntos Disponibles</span>
                                    </div>

                                    {/* Saldo Mock */}
                                    <div className="mx-4 mb-4 p-4 rounded-2xl bg-white shadow-lg border border-gray-50 flex items-center justify-between animate-fade-in">
                                        <div className="flex items-center gap-2">
                                            <div className="w-8 h-8 rounded-lg bg-green-50 flex items-center justify-center text-sm shadow-inner">💵</div>
                                            <div>
                                                <h3 className="text-gray-900 font-black text-base">$ 1.250</h3>
                                                <p className="text-[8px] text-gray-500 font-bold uppercase tracking-tighter leading-none">Saldo a favor</p>
                                            </div>
                                        </div>
                                        <div className="text-right">
                                            <div className="inline-block px-1.5 py-0.5 rounded bg-red-50 text-red-600 font-bold text-[8px]">
                                                Faltan $ {Math.round((config.pointsMoneyBase || 100) * 0.7)}
                                            </div>
                                        </div>
                                    </div>

                                    {/* Bottom Nav Mock */}
                                    <div className="absolute bottom-0 left-0 w-full bg-white border-t border-gray-100 flex justify-center items-center gap-6 py-3 pb-8 z-10 rounded-b-[2.8rem] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
                                        <div className="flex flex-col items-center gap-0.5" style={{ color: config.primaryColor }}>
                                            <div className="w-6 h-6 flex items-center justify-center"><Home size={18} strokeWidth={2.5} /></div>
                                            <span className="text-[8px] font-black uppercase tracking-tighter bg-clip-text text-transparent" style={{ backgroundImage: `linear-gradient(to right, ${config.primaryColor}, ${config.secondaryColor})` }}>Inicio</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-0.5 opacity-50 grayscale">
                                            <div className="w-6 h-6 flex items-center justify-center text-gray-400"><Gift size={18} /></div>
                                            <span className="text-[8px] font-bold uppercase tracking-tighter text-gray-600">Premios</span>
                                        </div>
                                        <div className="flex flex-col items-center gap-0.5 opacity-50 grayscale">
                                            <div className="w-6 h-6 flex items-center justify-center text-gray-400"><MessageCircle size={18} /></div>
                                            <span className="text-[8px] font-bold uppercase tracking-tighter text-gray-600">Contacto</span>
                                        </div>
                                    </div>

                                    <div className="px-6 text-center">
                                        <p className="text-xs text-gray-400">Vista previa en tiempo real de la App del Cliente</p>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                primaryColor: '#4a148c',
                                                secondaryColor: '#880e4f',
                                                backgroundColor: '#f5f3f7',
                                                sectionTitleColor: '#9ca3af',
                                                linkColor: '#4a148c'
                                            })}
                                            className="mt-4 text-xs font-bold text-gray-400 hover:text-gray-600 underline"
                                        >
                                            Restaurar Predeterminado (Original)
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* ZONA DE PELIGRO */}
                            <div className="col-span-1 lg:col-span-2 bg-red-50 border border-red-100 mt-8 p-6 rounded-xl">
                                <h3 className="text-red-700 font-bold text-lg flex items-center gap-2 mb-2">
                                    <Trash2 /> Zona de Peligro
                                </h3>
                                <p className="text-red-600/80 text-sm mb-4">
                                    Estas acciones son destructivas y no se pueden deshacer. Ten mucho cuidado.
                                </p>
                                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-red-100">
                                    <div>
                                        <h4 className="font-bold text-gray-800">Reiniciar Sistema Completo</h4>
                                        <p className="text-xs text-gray-500">Pone en 0 los puntos de TODOS los clientes y borra todos los historiales.</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            const confirm1 = window.prompt("Escribe 'ELIMINAR TODO' para confirmar. ESTO BORRARÁ EL HISTORIAL DE TODOS LOS CLIENTES.");
                                            if (confirm1 !== 'ELIMINAR TODO') return;

                                            setLoading(true);
                                            try {
                                                const { collection, getDocs, writeBatch, collectionGroup, query } = await import('firebase/firestore');
                                                const { db } = await import('../../../lib/firebase');

                                                // 1. Resetear Puntos de Usuarios
                                                const usersSnap = await getDocs(collection(db, 'users'));
                                                let currentBatch = writeBatch(db);
                                                let count = 0;

                                                // Función helper para procesar batches
                                                const addToBatch = async (op: (b: any) => void) => {
                                                    op(currentBatch);
                                                    count++;
                                                    if (count >= 400) {
                                                        await currentBatch.commit();
                                                        currentBatch = writeBatch(db);
                                                        count = 0;
                                                    }
                                                };

                                                // A. Resetear usuarios (Puntos a 0)
                                                for (const userDoc of usersSnap.docs) {
                                                    await addToBatch((b) => b.update(userDoc.ref, { points: 0, accumulated_balance: 0 }));
                                                }

                                                // B. Borrar TODO el historial (Incluyendo huérfanos)
                                                // Usamos collectionGroup para encontrar todas las subcolecciones 'points_history'
                                                const historyQuery = query(collectionGroup(db, 'points_history'));
                                                const historySnap = await getDocs(historyQuery);

                                                for (const hDoc of historySnap.docs) {
                                                    await addToBatch((b) => b.delete(hDoc.ref));
                                                }

                                                // Commit final si quedó algo pendiente
                                                if (count > 0) {
                                                    await currentBatch.commit();
                                                }

                                                toast.success('Sistema reiniciado a CERO (Huérfanos eliminados).');
                                                window.location.reload();
                                            } catch (e) {
                                                console.error(e);
                                                toast.error('Error al reiniciar sistema: ' + (e as any).message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="px-4 py-2 bg-red-600 text-white font-bold rounded-lg hover:bg-red-700 transition shadow-lg shadow-red-200"
                                    >
                                        ⚠️ EJECUTAR RESET
                                    </button>
                                </div>

                                {/* FACTORY RESET: Delete Admins */}
                                <div className="flex items-center justify-between bg-white p-4 rounded-lg border border-red-100 mt-4">
                                    <div>
                                        <h4 className="font-bold text-gray-800">Restablecer Instalación (Factory Reset)</h4>
                                        <p className="text-xs text-gray-500">Borra TODOS los administradores para volver a la pantalla de "Setup Inicial".</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={async () => {
                                            if (!window.confirm("¿Seguro? Esto borrará TODOS los accesos admin y te cerrará la sesión. Tendrás que crear la cuenta maestra de nuevo.")) return;

                                            setLoading(true);
                                            try {
                                                const { collection, getDocs, writeBatch } = await import('firebase/firestore');
                                                const { db, auth } = await import('../../../lib/firebase');

                                                // 1. Borrar Admins
                                                const snap = await getDocs(collection(db, 'admins'));
                                                const batch = writeBatch(db);
                                                snap.docs.forEach(d => batch.delete(d.ref));
                                                await batch.commit();

                                                // 2. Logout
                                                await auth.signOut();

                                                toast.success('¡Sistema restablecido de fábrica!');
                                                setTimeout(() => window.location.href = '/admin/login', 1000);

                                            } catch (e: any) {
                                                console.error(e);
                                                toast.error("Error: " + e.message);
                                            } finally {
                                                setLoading(false);
                                            }
                                        }}
                                        className="px-4 py-2 bg-red-100 text-red-700 font-bold rounded-lg hover:bg-red-200 transition text-sm"
                                    >
                                        🧨 RESET FÁBRICA
                                    </button>
                                </div>
                            </div>
                        </div>
                    )
                }

                {
                    activeTab === 'messaging' && (
                        <div className="max-w-3xl mx-auto space-y-8 animate-fade-in">

                            {/* 1. MASTER SWITCHES (Global Control) */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <Settings size={20} /> Control Maestro de Canales
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    {/* WhatsApp Switch */}
                                    <div className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${config.messaging?.whatsappEnabled ? 'bg-green-50 border-green-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-2 font-bold text-gray-700">
                                            <span className="text-green-500 text-xl">💬</span> WhatsApp
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                messaging: { ...config.messaging!, whatsappEnabled: !config.messaging?.whatsappEnabled }
                                            })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.messaging?.whatsappEnabled ? 'bg-green-500' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.messaging?.whatsappEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Email Switch */}
                                    <div className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${config.messaging?.emailEnabled ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-2 font-bold text-gray-700">
                                            <span className="text-blue-500 text-xl">📧</span> Email
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                messaging: { ...config.messaging!, emailEnabled: !config.messaging?.emailEnabled }
                                            })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.messaging?.emailEnabled ? 'bg-blue-500' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.messaging?.emailEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Push Switch */}
                                    <div className={`p-4 rounded-xl border flex flex-col items-center gap-3 transition-colors ${config.messaging?.pushEnabled ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-200'}`}>
                                        <div className="flex items-center gap-2 font-bold text-gray-700">
                                            <span className="text-purple-500 text-xl">🔔</span> Push
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                messaging: { ...config.messaging!, pushEnabled: !config.messaging?.pushEnabled }
                                            })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.messaging?.pushEnabled ? 'bg-purple-500' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.messaging?.pushEnabled ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-xs text-center text-gray-400 mt-4">
                                    Estos interruptores son globales. Si apagas uno aquí, ningún mensaje saldrá por ese canal, sin importar las reglas de abajo.
                                </p>
                            </div>

                            {/* 2. SPECIFIC SETTINGS (WhatsApp Number) */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-xl font-bold text-gray-800 mb-6">⚙️ Configuración de WhatsApp</h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Tu Número (Business)</label>
                                        <input
                                            type="tel"
                                            placeholder="54911..."
                                            value={config.messaging?.whatsappPhoneNumber || ''}
                                            onChange={e => setConfig({
                                                ...config,
                                                messaging: { ...config.messaging!, whatsappPhoneNumber: e.target.value }
                                            })}
                                            className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none"
                                        />
                                        <p className="text-[10px] text-gray-400 mt-1">Formato: 54911xxxxxxxx (Sin 0 ni 15)</p>
                                    </div>
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Mensaje Manual por Defecto</label>
                                        <p className="text-xs text-gray-500 mb-2">
                                            Este es el texto que aparecerá precargado cuando hagas clic en el botón de WhatsApp manualmente desde la lista de clientes.
                                        </p>
                                        <div className="flex gap-2">
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.whatsappDefaultMessage || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: { ...config.messaging!, whatsappDefaultMessage: e.target.value }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.whatsappDefaultMessage}
                                                className="w-full p-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* 3. AUTOMATIC EVENTS */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-8 animate-fade-in-up">
                                <h3 className="text-xl font-bold text-gray-800 border-b pb-4">🤖 Mensajes Automáticos (Reglas)</h3>

                                {/* Points Added */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Al Sumar Puntos (Compra)</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">🎉</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.pointsAdded || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, pointsAdded: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.pointsAdded}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded: DEFAULT_TEMPLATES.pointsAdded } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition">↺</button>
                                    </div>
                                    <VariableChips vars={['nombre', 'nombre_completo', 'puntos', 'saldo']} onSelect={v => insertVar('pointsAdded', v)} />
                                    <ChannelSelector
                                        channels={config.messaging?.eventConfigs?.pointsAdded?.channels || []}
                                        onChange={(newChannels) => setConfig({
                                            ...config,
                                            messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, pointsAdded: { channels: newChannels } } }
                                        })}
                                    />
                                </div>

                                {/* Redemption */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Al Canjear Premio</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">🎁</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.redemption || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, redemption: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.redemption}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption: DEFAULT_TEMPLATES.redemption } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition">↺</button>
                                    </div>
                                    <VariableChips vars={['nombre', 'nombre_completo', 'premio', 'codigo']} onSelect={v => insertVar('redemption', v)} />
                                    <ChannelSelector
                                        channels={config.messaging?.eventConfigs?.redemption?.channels || []}
                                        onChange={(newChannels) => setConfig({
                                            ...config,
                                            messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, redemption: { channels: newChannels } } }
                                        })}
                                    />
                                </div>

                                {/* Welcome */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Bienvenida (Nuevo Cliente)</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">👋</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.welcome || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, welcome: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.welcome}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome: DEFAULT_TEMPLATES.welcome } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition">↺</button>
                                    </div>
                                    <VariableChips vars={['nombre', 'nombre_completo', 'puntos', 'socio', 'dni']} onSelect={v => insertVar('welcome', v)} />
                                    <ChannelSelector
                                        channels={config.messaging?.eventConfigs?.welcome?.channels || []}
                                        onChange={(newChannels) => setConfig({
                                            ...config,
                                            messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, welcome: { channels: newChannels } } }
                                        })}
                                    />
                                </div>

                                {/* Campaign Template */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Promo Manual (Campaña)</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">🚀</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.campaign || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, campaign: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.campaign}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign: DEFAULT_TEMPLATES.campaign } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition">↺</button>
                                    </div>
                                    <VariableChips vars={['titulo', 'descripcion']} onSelect={v => insertVar('campaign', v)} />
                                    <ChannelSelector
                                        channels={config.messaging?.eventConfigs?.campaign?.channels || []}
                                        onChange={(newChannels) => setConfig({
                                            ...config,
                                            messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, campaign: { channels: newChannels } } }
                                        })}
                                    />
                                </div>

                                {/* Offer Template */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Oferta Especial</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">🔥</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.offer || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, offer: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.offer}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer: DEFAULT_TEMPLATES.offer } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition">↺</button>
                                    </div>
                                    <VariableChips vars={['titulo', 'detalle', 'vencimiento']} onSelect={v => insertVar('offer', v)} />
                                    <ChannelSelector
                                        channels={config.messaging?.eventConfigs?.offer?.channels || []}
                                        onChange={(newChannels) => setConfig({
                                            ...config,
                                            messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, offer: { channels: newChannels } } }
                                        })}
                                    />
                                </div>

                                {/* Birthday Template */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Saludo de Cumpleaños</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">🎂</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.birthday || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, birthday: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.birthday}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday: DEFAULT_TEMPLATES.birthday } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition">↺</button>
                                    </div>
                                    <VariableChips vars={['nombre', 'nombre_completo', 'puntos']} onSelect={v => insertVar('birthday', v)} />
                                    <ChannelSelector
                                        channels={config.messaging?.eventConfigs?.birthday?.channels || []}
                                        onChange={(newChannels) => setConfig({
                                            ...config,
                                            messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, birthday: { channels: newChannels } } }
                                        })}
                                    />
                                </div>
                            </div>

                            {/* Email Preview Button (kept separate as useful tool) */}
                            {config.messaging?.emailEnabled && (
                                <div className="flex justify-end">
                                    <button
                                        type="button"
                                        onClick={handleTestEmail}
                                        className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition flex items-center gap-2"
                                    >
                                        <Monitor size={16} /> Ver Previsualización de Email
                                    </button>
                                </div>
                            )}
                        </div>
                    )
                }


                {/* Botón flotante de Guardar */}
                <div className="fixed bottom-6 right-6 z-40">
                    <button
                        disabled={loading}
                        className="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-full font-bold shadow-2xl flex items-center gap-3 transition-transform hover:-translate-y-1 active:scale-95"
                    >
                        {loading ? 'Guardando...' : <><Save size={20} /> Guardar Todo</>}
                    </button>
                </div>
            </form >
        </div >
    );
};

