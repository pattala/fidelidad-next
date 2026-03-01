import React, { useState, useEffect } from 'react';
import { Save, Plus, Trash2, Palette, Calculator, Monitor, Settings, Home, Gift, MessageCircle, FileText, AlertTriangle, RefreshCw, ShieldAlert, Shield, Users, Clock, Eye, Sparkles, Cake, Zap, UserPlus, Megaphone } from 'lucide-react';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import { EmailPreviewModal } from '../components/EmailPreviewModal';
import { EmailService } from '../../../services/emailService';
import { NotificationService } from '../../../services/notificationService';
import { toast } from 'react-hot-toast';
import { PointValueCalculatorModal } from '../components/PointValueCalculatorModal';
// import { ChannelSelector } from '../components/ChannelSelector';
import type { AppConfig, MessagingChannel } from '../../../types';
import { collection, query, where, getDocs, orderBy, limit } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { useNavigate } from 'react-router-dom';
import { TimeService } from '../../../services/timeService';
import { auth } from '../../../lib/firebase';

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
        enableExternalIntegration: true,
        referrals: {
            enabled: true,
            pointsForReferrer: 200,
            pointsForReferee: 0,
            rewardCriteria: 'first_transaction'
        }
    });

    const { isReadOnly, user } = useAdminAuth();
    const [activeTab, setActiveTab] = useState<'rules' | 'branding' | 'messaging' | 'legales' | 'advanced'>('rules');
    const [resetOptions, setResetOptions] = useState({
        socios_total: false,
        socios_historial: false,
        socios_mensajes: false,
        geo_total: false,
        transacciones_total: false,
        marca_total: false,
        prizes_total: false,
        campaigns_total: false,
        gamification_total: false,
        team_total: false,
        contact_total: false,
        legales_total: false,
        audit_total: false
    });
    // Empezar en Reglas por petición del usuario
    const [loading, setLoading] = useState(false);
    const [showCalculator, setShowCalculator] = useState(false);
    const [autoPointValue, setAutoPointValue] = useState<number>(0);
    const [lastAuditLog, setLastAuditLog] = useState<any>(null);
    const [challengeChannels, setChallengeChannels] = useState<MessagingChannel[]>(['push', 'email']);

    // Email Preview State
    const [previewModal, setPreviewModal] = useState({
        isOpen: false,
        templateId: '',
        title: '',
        content: ''
    });

    const openPreview = (templateId: string, title?: string) => {
        const content = config.messaging?.templates?.[templateId as keyof typeof config.messaging.templates] || DEFAULT_TEMPLATES[templateId as keyof typeof DEFAULT_TEMPLATES] || '';

        // Subject logic: some templates don't have a separate subject field in the DB yet,
        // so we use descriptive titles for the preview.
        const subjects: Record<string, string> = {
            welcome: `¡Bienvenido a ${config.siteName}!`,
            pointsAdded: `Suma de Puntos - ${config.siteName}`,
            redemption: `Canje Confirmado - ${config.siteName}`,
            campaign: `Novedades en ${config.siteName}`,
            offer: `Oferta Especial - ${config.siteName}`,
            flashOffer: `OFERTA FLASH ⚡`,
            birthday: `¡Feliz Cumpleaños! 🎂`,
            birthdaySimple: `¡Muy Feliz Cumpleaños! 🎈`,
            referralReward: `Premio por Invitación 🎁`,
            referralPoints: `Puntos por Referido 🚀`,
            expirationWarning: `Aviso de Vencimiento de Puntos 📢`,
            referralChallenge: `¡NUEVO DESAFÍO ACTIVO! 🚀`
        };

        setPreviewModal({
            isOpen: true,
            templateId,
            title: title || subjects[templateId] || 'Notificación',
            content
        });
    };

    const fetchLastAuditLog = async () => {
        try {
            const q = query(
                collection(db, 'audit_logs'),
                orderBy('timestamp', 'desc'),
                limit(10)
            );
            const snap = await getDocs(q);
            // Buscar el primero que sea de vencimientos
            const log = snap.docs.find(d => ['expiration_engine', 'manual_expiration'].includes(d.data().type));
            if (log) setLastAuditLog(log.data());
        } catch (e) {
            console.error("Error fetching last audit log", e);
        }
    };

    // Cargar log cuando estemos en mensajería
    useEffect(() => {
        if (activeTab === 'messaging') {
            fetchLastAuditLog();
        }
    }, [activeTab]);

    // Updated type definition in insertVar to include 'birthday' and 'referralChallenge'
    const insertVar = (field: 'pointsAdded' | 'redemption' | 'welcome' | 'campaign' | 'offer' | 'flashOffer' | 'birthday' | 'birthdaySimple' | 'referralReward' | 'referralPoints' | 'expirationWarning' | 'referralChallenge', variable: string) => {
        const currentTemplates = config.messaging?.templates || {};
        const currentValue = currentTemplates[field] || '';
        setConfig({
            ...config,
            messaging: {
                ...config.messaging!,
                templates: {
                    ...currentTemplates,
                    [field]: `${currentValue}{${variable}}`
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

    const handleTestEmail = async () => {
        if (!config.messaging?.emailEnabled) return;
        const toastId = toast.loading('Enviando previsualización...');
        try {
            const html = EmailService.generateBrandedTemplate(config, 'Prueba de Diseño', 'Este es un mensaje de prueba para verificar cómo se ve tu marca en los correos electrónicos.');
            const res = await EmailService.sendEmail(config.messaging.whatsappPhoneNumber || 'test@test.com', 'Previsualización de Email', html);
            if (res.success) toast.success('Email enviado. Revisa tu bandeja de entrada.', { id: toastId });
            else toast.error('Error al enviar. Verifica la configuración.', { id: toastId });
        } catch (e) {
            toast.error('Error de conexión', { id: toastId });
        }
    };

    const handleResetAction = async (action: 'reset' | 'backup' | 'restore') => {
        if (isReadOnly) return;

        if (action === 'reset') {
            const selectedCount = Object.values(resetOptions).filter(v => v).length;
            if (selectedCount === 0) {
                toast.error("Debes seleccionar al menos un ítem para resetear.");
                return;
            }

            const confirm = window.prompt(`⚠️ ¡PELIGRO! Se ejecutarán ${selectedCount} acciones de borrado irrreversible. Escriba 'RESET' para confirmar:`);
            if (confirm !== 'RESET') {
                if (confirm !== null) toast.error("Confirmación incorrecta.");
                return;
            }
        } else if (action === 'restore') {
            if (!window.confirm("¿Seguro que quieres restaurar la configuración anterior? Esto sobreescribirá tus reglas y diseño actuales.")) return;
        }

        const toastId = toast.loading(`${action === 'backup' ? 'Creando respaldo' : action === 'restore' ? 'Restaurando' : 'Reseteando'}...`);
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/reset-factory', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    action,
                    options: resetOptions,
                    confirmText: 'RESET',
                    adminUid: user?.uid
                })
            });
            const data = await res.json();
            if (data.ok) {
                toast.success(data.message || 'Operación completada.', { id: toastId });
                if (action === 'reset' || action === 'restore') {
                    // Recargar despues de un reset/restore
                    setTimeout(() => window.location.reload(), 2000);
                }
            } else {
                toast.error(`Error: ${data.error}`, { id: toastId });
            }
        } catch (e) {
            toast.error('Error de conexión', { id: toastId });
        }
    };

    const handleRunExpirations = async () => {
        if (!window.confirm("¿Deseas ejecutar ahora la revisión de vencimientos y enviar las notificaciones pendientes?")) return;

        const toastId = toast.loading('Ejecutando revisión de vencimientos...');
        try {
            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/expirations?action=check', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || '',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    simulatedDate: TimeService.now().toISOString()
                })
            });
            const data = await res.json();
            if (data.ok) {
                toast.success(`Éxito: ${data.summary?.summary || 'Revisión completada'}`, { id: toastId });
                // Refrescar el estado local del log
                fetchLastAuditLog();
            } else {
                toast.error(`Error: ${data.error}`, { id: toastId });
            }
        } catch (e) {
            toast.error('Error de conexión', { id: toastId });
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
                    <button
                        onClick={() => setActiveTab('legales')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'legales' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileText size={18} />
                        Legales
                    </button>
                    <button
                        onClick={() => setActiveTab('advanced')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'advanced' ? 'bg-white text-red-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Settings size={18} />
                        Avanzado
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

                                {/* Tarjeta de Referidos */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 mt-6">
                                    <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                        <span className="bg-orange-100 text-orange-600 p-2 rounded-lg"><Gift size={20} /></span>
                                        Programa de Referidos
                                    </h3>

                                    <div className="bg-orange-50/50 p-6 rounded-xl border border-orange-100 space-y-6">
                                        <div className="flex items-center justify-between">
                                            <div className="flex-1">
                                                <span className="text-sm font-bold text-gray-800">Activar Sistema de Invitación</span>
                                                <p className="text-xs text-gray-500">Permite que los socios inviten amigos y ganen puntos por ello.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({
                                                    ...config,
                                                    referrals: { ...config.referrals!, enabled: !config.referrals?.enabled }
                                                })}
                                                className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.referrals?.enabled ? 'bg-orange-600' : 'bg-gray-200'}`}
                                            >
                                                <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.referrals?.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        {config.referrals?.enabled && (
                                            <div className="space-y-6 animate-fade-in pl-2 border-l-2 border-orange-200">
                                                <div>
                                                    <label className="block text-xs font-bold text-orange-700 uppercase mb-2">Puntos para el Referidor (Quien invita)</label>
                                                    <div className="flex items-center gap-3">
                                                        <input
                                                            type="number"
                                                            value={config.referrals.pointsForReferrer}
                                                            onChange={e => setConfig({
                                                                ...config,
                                                                referrals: { ...config.referrals!, pointsForReferrer: parseInt(e.target.value) || 0 }
                                                            })}
                                                            className="w-24 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-orange-100 font-bold text-gray-700 text-center"
                                                        />
                                                        <span className="text-gray-500 text-sm font-medium">puntos por cada amigo que realice su primera compra.</span>
                                                    </div>
                                                </div>

                                                <div className="pt-2">
                                                    <label className="block text-xs font-bold text-orange-700 uppercase mb-2">Criterio de Recompensa</label>
                                                    <select
                                                        value={config.referrals.rewardCriteria}
                                                        onChange={e => setConfig({
                                                            ...config,
                                                            referrals: { ...config.referrals!, rewardCriteria: e.target.value as any }
                                                        })}
                                                        className="w-full p-2.5 rounded-lg border border-gray-200 text-sm font-bold text-gray-700 outline-none focus:ring-2 focus:ring-orange-100"
                                                    >
                                                        <option value="first_transaction">Tras el primer consumo en el local</option>
                                                        <option value="registration" disabled>Al registrarse (Deshabilitado por fraude)</option>
                                                    </select>
                                                    <p className="text-[10px] text-gray-400 mt-2 italic">
                                                        * Recomendamos 'Primer Consumo' para evitar cuentas falsas. El bono se asigna automáticamente cuando el invitado suma sus primeros puntos desde el facturador.
                                                    </p>
                                                </div>

                                                {/* NUEVO: Configuración de Desafío */}
                                                <div className="pt-6 border-t border-orange-100">
                                                    <div className="flex items-center justify-between mb-4">
                                                        <div className="flex items-center gap-2">
                                                            <div className="bg-orange-600 text-white p-1 rounded">
                                                                <Zap size={14} />
                                                            </div>
                                                            <span className="text-sm font-bold text-gray-800">Desafío con Fecha Límite</span>
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfig({
                                                                ...config,
                                                                referrals: {
                                                                    ...config.referrals!,
                                                                    challenge: {
                                                                        enabled: !config.referrals?.challenge?.enabled,
                                                                        startDate: config.referrals?.challenge?.startDate || new Date().toISOString().split('T')[0],
                                                                        endDate: config.referrals?.challenge?.endDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
                                                                        tiers: config.referrals?.challenge?.tiers || [{ count: 1, bonus: 100 }],
                                                                        isInternal: config.referrals?.challenge?.isInternal || false
                                                                    }
                                                                }
                                                            })}
                                                            className={`relative w-10 h-6 transition-colors rounded-full shadow-inner ${config.referrals?.challenge?.enabled ? 'bg-orange-500' : 'bg-gray-200'}`}
                                                        >
                                                            <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${config.referrals?.challenge?.enabled ? 'translate-x-4' : 'translate-x-0'}`} />
                                                        </button>
                                                    </div>

                                                    {config.referrals?.challenge?.enabled && (
                                                        <div className="space-y-4 animate-fade-in pl-2 border-l-2 border-orange-400">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fecha Inicio</label>
                                                                    <input
                                                                        type="date"
                                                                        value={config.referrals.challenge?.startDate}
                                                                        onChange={e => setConfig({
                                                                            ...config,
                                                                            referrals: {
                                                                                ...config.referrals!,
                                                                                challenge: { ...config.referrals!.challenge!, startDate: e.target.value }
                                                                            }
                                                                        })}
                                                                        className="w-full p-2 border border-orange-100 rounded-lg text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-orange-50"
                                                                    />
                                                                </div>
                                                                <div>
                                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Fecha Final</label>
                                                                    <input
                                                                        type="date"
                                                                        value={config.referrals.challenge?.endDate}
                                                                        onChange={e => setConfig({
                                                                            ...config,
                                                                            referrals: {
                                                                                ...config.referrals!,
                                                                                challenge: { ...config.referrals!.challenge!, endDate: e.target.value }
                                                                            }
                                                                        })}
                                                                        className="w-full p-2 border border-orange-100 rounded-lg text-xs font-bold text-gray-700 outline-none focus:ring-2 focus:ring-orange-50"
                                                                    />
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <div className="flex justify-between items-center mb-2">
                                                                    <label className="block text-[10px] font-bold text-orange-700 uppercase">Metas Progresivas (Tiers)</label>
                                                                    <button
                                                                        type="button"
                                                                        onClick={() => {
                                                                            const tiers = [...(config.referrals!.challenge!.tiers || [])];
                                                                            tiers.push({ count: (tiers[tiers.length - 1]?.count || 0) + 1, bonus: 0 });
                                                                            setConfig({
                                                                                ...config,
                                                                                referrals: {
                                                                                    ...config.referrals!,
                                                                                    challenge: { ...config.referrals!.challenge!, tiers }
                                                                                }
                                                                            });
                                                                        }}
                                                                        className="text-[10px] bg-orange-100 text-orange-600 px-2 py-1 rounded font-bold hover:bg-orange-200 transition"
                                                                    >
                                                                        + Agregar Nivel
                                                                    </button>
                                                                </div>
                                                                <div className="space-y-2">
                                                                    {(config.referrals.challenge?.tiers || []).sort((a, b) => a.count - b.count).map((tier, idx) => (
                                                                        <div key={idx} className="flex items-center gap-2 bg-white/50 p-2 rounded-lg border border-orange-100">
                                                                            <span className="text-xs font-bold text-gray-400 w-4">{idx + 1}º</span>
                                                                            <div className="flex flex-1 items-center gap-2">
                                                                                <input
                                                                                    type="number"
                                                                                    placeholder="Cant"
                                                                                    value={tier.count}
                                                                                    onChange={e => {
                                                                                        const tiers = [...(config.referrals!.challenge!.tiers || [])];
                                                                                        tiers[idx].count = parseInt(e.target.value) || 0;
                                                                                        setConfig({
                                                                                            ...config,
                                                                                            referrals: {
                                                                                                ...config.referrals!,
                                                                                                challenge: { ...config.referrals!.challenge!, tiers }
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                    className="w-14 p-1.5 border border-gray-100 rounded text-xs font-black text-center text-gray-700"
                                                                                />
                                                                                <span className="text-[10px] font-bold text-gray-400">Amigos</span>
                                                                                <div className="h-4 w-px bg-gray-100" />
                                                                                <span className="text-[10px] font-bold text-orange-600">Bono +</span>
                                                                                <input
                                                                                    type="number"
                                                                                    placeholder="Puntos"
                                                                                    value={tier.bonus}
                                                                                    onChange={e => {
                                                                                        const tiers = [...(config.referrals!.challenge!.tiers || [])];
                                                                                        tiers[idx].bonus = parseInt(e.target.value) || 0;
                                                                                        setConfig({
                                                                                            ...config,
                                                                                            referrals: {
                                                                                                ...config.referrals!,
                                                                                                challenge: { ...config.referrals!.challenge!, tiers }
                                                                                            }
                                                                                        });
                                                                                    }}
                                                                                    className="w-16 p-1.5 border border-orange-200 rounded text-xs font-black text-center text-orange-700"
                                                                                />
                                                                                <span className="text-[10px] font-bold text-gray-400 italic">pts extra</span>
                                                                            </div>
                                                                            <button
                                                                                type="button"
                                                                                onClick={() => {
                                                                                    const tiers = [...(config.referrals!.challenge!.tiers || [])];
                                                                                    tiers.splice(idx, 1);
                                                                                    setConfig({
                                                                                        ...config,
                                                                                        referrals: {
                                                                                            ...config.referrals!,
                                                                                            challenge: { ...config.referrals!.challenge!, tiers }
                                                                                        }
                                                                                    });
                                                                                }}
                                                                                className="text-gray-300 hover:text-red-500 p-1"
                                                                            >
                                                                                <Trash2 size={12} />
                                                                            </button>
                                                                        </div>
                                                                    ))}
                                                                </div>
                                                            </div>

                                                            {/* NUEVO: Selección de Canales y Botón de Difusión */}
                                                            <section className="pt-4 border-t border-orange-100 flex items-center justify-between bg-blue-50/50 p-4 rounded-xl">
                                                                <div className="flex items-center gap-3">
                                                                    <div className="p-2 bg-blue-100 text-blue-600 rounded-xl">
                                                                        <Shield size={20} />
                                                                    </div>
                                                                    <div>
                                                                        <label className="text-[10px] font-black text-blue-900 uppercase block">Desafío Interno (Modo Test)</label>
                                                                        <p className="text-[8px] text-blue-600 font-bold uppercase mt-0.5 italic">Sólo visible para "Usuarios de Prueba"</p>
                                                                    </div>
                                                                </div>
                                                                <label className="relative inline-flex items-center cursor-pointer">
                                                                    <input
                                                                        type="checkbox"
                                                                        className="sr-only peer"
                                                                        checked={config.referrals?.challenge?.isInternal || false}
                                                                        onChange={e => setConfig({
                                                                            ...config,
                                                                            referrals: {
                                                                                ...config.referrals!,
                                                                                challenge: { ...config.referrals!.challenge!, isInternal: e.target.checked }
                                                                            }
                                                                        })}
                                                                    />
                                                                    <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-blue-600"></div>
                                                                </label>
                                                            </section>


                                                            {/* Referral Challenge Channels & Broadcast has been moved to Mensajes Automáticos */}
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'legales' && (
                    <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 animate-in fade-in slide-in-from-bottom-4">
                        <div className="max-w-4xl">
                            <div className="flex items-center gap-3 mb-6">
                                <div className="bg-blue-50 p-3 rounded-2xl text-blue-600">
                                    <FileText size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight">Términos y Condiciones</h3>
                                    <p className="text-gray-500 text-sm">Este texto aparecerá en el perfil de usuario de la PWA. Puedes usar formato simple.</p>
                                </div>
                            </div>

                            <div className="space-y-6">
                                <div className="flex flex-col gap-2">
                                    <div className="flex justify-between items-end">
                                        <label className="text-xs font-bold text-gray-400 uppercase tracking-widest ml-1">Contenido de los Términos</label>
                                        <div className="text-[10px] text-gray-400 bg-gray-50 px-2 py-1 rounded">Soporta Markdown Básico</div>
                                    </div>
                                    <textarea
                                        rows={20}
                                        className="w-full p-4 rounded-2xl border-2 border-gray-100 focus:border-blue-500 focus:ring-4 focus:ring-blue-50 outline-none transition text-sm font-medium leading-relaxed bg-gray-50/30"
                                        placeholder="Escribe aquí los términos..."
                                        value={config.contact?.termsContent || ''}
                                        onChange={e => setConfig({
                                            ...config,
                                            contact: { ...config.contact!, termsContent: e.target.value }
                                        })}
                                    />
                                </div>

                                <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 flex gap-3">
                                    <div className="text-xl">💡</div>
                                    <div className="text-xs text-blue-700 leading-relaxed pt-1">
                                        <strong>Tip:</strong> Puedes usar variables como <code className="bg-white px-1 rounded">{"{siteName}"}</code> que se reemplazarán automáticamente por <strong>{config.siteName}</strong> en la PWA.
                                    </div>
                                </div>

                                <div className="pt-4 border-t border-gray-100">
                                    <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Link Externo (Opcional)</label>
                                    <input
                                        type="text"
                                        placeholder="https://..."
                                        value={config.contact?.termsAndConditions || ''}
                                        onChange={e => setConfig({
                                            ...config,
                                            contact: { ...config.contact!, termsAndConditions: e.target.value }
                                        })}
                                        className="w-full rounded-xl border-gray-200 border p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none bg-gray-50/50"
                                    />
                                    <p className="text-[10px] text-gray-400 mt-2 px-1">
                                        <strong>⚠️ Prioridad:</strong> Si este link está presente, el botón de Términos redirigirá aquí. Si queda vacío, se mostrará el contenido de arriba en un cuadro interno.
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeTab === 'branding' && (
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
                                            <label className="block text-xs font-semibold text-gray-600 mb-1">URL de la App (para Botón de Email)</label>
                                            <input
                                                type="url"
                                                placeholder="https://fidelidad-next.vercel.app/login"
                                                value={config.contact?.pwaUrl || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    contact: { ...config.contact!, pwaUrl: e.target.value }
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
                                <div
                                    className="p-6 m-4 rounded-2xl text-white shadow-lg text-center transition-all duration-500"
                                    style={{
                                        backgroundColor: config.secondaryColor,
                                        marginTop: '16px'
                                    }}
                                >
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
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded: DEFAULT_TEMPLATES.pointsAdded } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('pointsAdded')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
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
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption: DEFAULT_TEMPLATES.redemption } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('redemption')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
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
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome: DEFAULT_TEMPLATES.welcome } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('welcome')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
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
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign: DEFAULT_TEMPLATES.campaign } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('campaign')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
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
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer: DEFAULT_TEMPLATES.offer } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('offer')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
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

                                {/* Flash Offer Template */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 font-mono flex items-center gap-2">
                                        ⚡ Oferta Flash <span className="text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full uppercase">Crítico / Urgente</span>
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">⚡</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.flashOffer || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, flashOffer: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.flashOffer}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-yellow-200 focus:ring-2 focus:ring-yellow-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer: DEFAULT_TEMPLATES.flashOffer } } })} className="px-3 py-2 text-gray-400 hover:text-yellow-600 rounded-lg hover:bg-yellow-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('flashOffer')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </div>
                                    <VariableChips vars={['titulo', 'detalle', 'horario']} onSelect={v => insertVar('flashOffer', v)} />
                                    <p className="text-[10px] text-gray-400 mt-1 italic">
                                        * Se usa automáticamente para campañas marcadas como "Flash".
                                    </p>
                                </div>

                                {/* Birthday Template */}
                                <div className="space-y-6">
                                    <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <h4 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
                                            🎂 Cumpleaños
                                        </h4>

                                        <div className="space-y-4">
                                            {/* Full Gift Greeting */}
                                            <div>
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mensaje CON Regalo (Puntos)</label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <span className="absolute top-3 left-3 text-xl">🎁</span>
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
                                                            className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-sm"
                                                        />
                                                    </div>
                                                    <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday: DEFAULT_TEMPLATES.birthday } } })} className="px-3 py-2 text-gray-300 hover:text-pink-600 transition" title="Restaurar predeterminado">↺</button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openPreview('birthday')}
                                                        className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                                        title="Previsualizar Email"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </div>
                                                <VariableChips vars={['nombre', 'nombre_completo', 'puntos']} onSelect={v => insertVar('birthday', v)} />
                                            </div>

                                            {/* Simple Greeting */}
                                            <div className="pt-4 border-t border-gray-100">
                                                <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mensaje SIN Regalo (Solo Saludo)</label>
                                                <div className="flex gap-2">
                                                    <div className="relative flex-1">
                                                        <span className="absolute top-3 left-3 text-xl">👋</span>
                                                        <textarea
                                                            rows={2}
                                                            value={config.messaging?.templates?.birthdaySimple || ''}
                                                            onChange={e => setConfig({
                                                                ...config,
                                                                messaging: {
                                                                    ...config.messaging!,
                                                                    templates: { ...config.messaging?.templates, birthdaySimple: e.target.value }
                                                                }
                                                            })}
                                                            placeholder={DEFAULT_TEMPLATES.birthdaySimple}
                                                            className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm"
                                                        />
                                                    </div>
                                                    <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthdaySimple: DEFAULT_TEMPLATES.birthdaySimple } } })} className="px-3 py-2 text-gray-300 hover:text-blue-600 transition" title="Restaurar predeterminado">↺</button>
                                                    <button
                                                        type="button"
                                                        onClick={() => openPreview('birthdaySimple')}
                                                        className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                                        title="Previsualizar Email"
                                                    >
                                                        <Eye size={18} />
                                                    </button>
                                                </div>
                                                <VariableChips vars={['nombre', 'nombre_completo']} onSelect={v => insertVar('birthdaySimple', v)} />
                                            </div>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío Automático</label>
                                            <ChannelSelector
                                                channels={config.messaging?.eventConfigs?.birthday?.channels || []}
                                                onChange={(newChannels) => setConfig({
                                                    ...config,
                                                    messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, birthday: { channels: newChannels } } }
                                                })}
                                            />
                                            <p className="text-[10px] text-gray-400 mt-2 italic">
                                                * El sistema detecta automáticamente si enviar el mensaje con o sin puntos según la configuración de "Reglas de Juego".
                                            </p>
                                        </div>
                                    </div>
                                </div>
                                <hr className="border-gray-50" />

                                {/* Referral Reward Template */}
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Recompensa por Referido</label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">💎</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.referralReward || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, referralReward: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.referralReward}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward: DEFAULT_TEMPLATES.referralReward } } })} className="px-3 py-2 text-gray-400 hover:text-green-600 rounded-lg hover:bg-green-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('referralReward')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </div>
                                    <VariableChips vars={['nombre', 'amigo', 'puntos']} onSelect={v => insertVar('referralReward', v)} />
                                    <ChannelSelector
                                        channels={config.messaging?.eventConfigs?.referralReward?.channels || []}
                                        onChange={(newChannels) => setConfig({
                                            ...config,
                                            messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, referralReward: { channels: newChannels } } }
                                        })}
                                    />
                                </div>

                                {/* Referral Points Template (Puntos por referir) */}
                                <div className="p-4 bg-orange-50/30 rounded-xl border border-orange-100">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">🎁 Puntos a Favor (Referidor)</label>
                                    <p className="text-[10px] text-gray-500 mb-2 leading-tight">Mismo evento que el anterior, pero enfocado en avisar los puntos ganados.</p>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">🚀</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.referralPoints || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, referralPoints: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.referralPoints}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints: DEFAULT_TEMPLATES.referralPoints } } })} className="px-3 py-2 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('referralPoints')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </div>
                                    <VariableChips vars={['nombre', 'nombre_referido', 'puntos']} onSelect={v => insertVar('referralPoints', v)} />
                                </div>

                                {/* Referral Challenge Template */}
                                <div className="p-4 bg-orange-50/50 rounded-xl border border-orange-200">
                                    <label className="block text-sm font-semibold text-gray-700 mb-2 font-mono flex items-center gap-2">
                                        ⚡ Desafío de Referidos <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full uppercase">Difusión Manual</span>
                                    </label>
                                    <p className="text-[10px] text-gray-500 mb-2 leading-tight">Envía este mensaje de forma manual para motivar a los usuarios durante un desafío activo.</p>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">🚀</span>
                                            <textarea
                                                rows={2}
                                                value={config.messaging?.templates?.referralChallenge || ''}
                                                onChange={e => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        templates: { ...config.messaging?.templates, referralChallenge: e.target.value }
                                                    }
                                                })}
                                                placeholder={DEFAULT_TEMPLATES.referralChallenge || '¡Tenemos un nuevo desafío!'}
                                                className="w-full pl-10 pr-3 py-3 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none"
                                            />
                                        </div>
                                        <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge: DEFAULT_TEMPLATES.referralChallenge } } })} className="px-3 py-2 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition" title="Restaurar predeterminado">↺</button>
                                        <button
                                            type="button"
                                            onClick={() => openPreview('referralChallenge', '¡NUEVO DESAFÍO ACTIVO! 🚀')}
                                            className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                            title="Previsualizar Email"
                                        >
                                            <Eye size={18} />
                                        </button>
                                    </div>
                                    <VariableChips vars={['nombre', 'nombre_completo', 'fecha_limite', 'puntos', 'meta']} onSelect={v => insertVar('referralChallenge', v)} />

                                    <div className="mt-4 flex flex-col sm:flex-row items-center gap-4 justify-between bg-white p-3 rounded-lg border border-orange-100">
                                        <div className="w-full sm:w-auto">
                                            <ChannelSelector
                                                channels={challengeChannels}
                                                onChange={setChallengeChannels}
                                            />
                                        </div>
                                        <button
                                            type="button"
                                            onClick={async () => {
                                                const channelsStr = challengeChannels.join(', ') || 'Ninguno';
                                                if (challengeChannels.length === 0) {
                                                    toast.error("Selecciona al menos un canal");
                                                    return;
                                                }
                                                if (!window.confirm(`¿Deseas difundir el desafío a todos los clientes a través de: ${channelsStr}?`)) return;

                                                const toastId = toast.loading('Iniciando difusión...');
                                                const title = '¡NUEVO DESAFÍO ACTIVO! 🚀';
                                                const templateText = config.messaging?.templates?.referralChallenge || DEFAULT_TEMPLATES.referralChallenge || 'Desafío Activo';

                                                try {
                                                    // Get challenge end date from config for {fecha_limite} replacement
                                                    const challengeEndDateRaw = config.referrals?.challenge?.endDate;
                                                    let expirationDateFormatted = 'pronto';
                                                    if (challengeEndDateRaw) {
                                                        const [year, month, day] = challengeEndDateRaw.split('-');
                                                        expirationDateFormatted = `${day}/${month}/${year}`;
                                                    }

                                                    const q = query(collection(db, 'users'));
                                                    const snap = await getDocs(q);

                                                    if (challengeChannels.includes('push')) {
                                                        const pushPromises = snap.docs.map(doc => {
                                                            const d = doc.data();
                                                            const userName = d.name || '';
                                                            let personalizedMsg = templateText
                                                                .replace(/{nombre}/g, userName.split(' ')[0])
                                                                .replace(/{nombre_completo}/g, userName)
                                                                .replace(/{fecha_limite}/g, expirationDateFormatted)
                                                                .replace(/{vencimiento}/g, expirationDateFormatted)
                                                                .replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0')
                                                                .replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');

                                                            return NotificationService.sendToClient(doc.id, {
                                                                title: title,
                                                                body: personalizedMsg,
                                                                type: 'campaign',
                                                                icon: config.logoUrl || '/pwa-192x192.png'
                                                            });
                                                        });
                                                        await Promise.allSettled(pushPromises);
                                                    }

                                                    if (challengeChannels.includes('email')) {
                                                        const emailPromises = snap.docs.map(doc => {
                                                            const d = doc.data();
                                                            if (d.email) {
                                                                const userName = d.name || '';
                                                                let personalizedMsg = templateText
                                                                    .replace(/{nombre}/g, userName.split(' ')[0])
                                                                    .replace(/{nombre_completo}/g, userName)
                                                                    .replace(/{fecha_limite}/g, expirationDateFormatted)
                                                                    .replace(/{vencimiento}/g, expirationDateFormatted)
                                                                    .replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0')
                                                                    .replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');

                                                                const htmlContent = EmailService.generateBrandedTemplate(config, title, personalizedMsg);
                                                                return EmailService.sendEmail(d.email, title, htmlContent);
                                                            }
                                                            return null;
                                                        }).filter(Boolean);
                                                        await Promise.allSettled(emailPromises);
                                                    }

                                                    if (challengeChannels.includes('whatsapp')) {
                                                        let waMsg = templateText
                                                            .replace(/{fecha_limite}/g, expirationDateFormatted)
                                                            .replace(/{vencimiento}/g, expirationDateFormatted)
                                                            .replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0')
                                                            .replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');
                                                        navigate('/admin/whatsapp', { state: { message: waMsg } });
                                                    }

                                                    toast.success('¡Difusión completada!', { id: toastId });
                                                } catch (e) {
                                                    toast.error('Error en la difusión', { id: toastId });
                                                }
                                            }}
                                            className="flex items-center gap-2 px-6 py-3 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl text-sm font-black shadow-lg shadow-orange-200 hover:scale-105 transition active:scale-95 whitespace-nowrap"
                                        >
                                            <Megaphone size={18} />
                                            ¡Difundir Desafío a Todos!
                                        </button>
                                    </div>
                                </div>

                                {/* Points Expiration Warning Configuration */}
                                <div className="pt-6 mt-6 border-t border-gray-100">
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xl">📢</span>
                                            <div>
                                                <h3 className="text-sm font-bold text-gray-800 uppercase tracking-tight">Aviso de Vencimiento de Puntos</h3>
                                                <div className="flex items-center gap-1 text-[10px] text-gray-400">
                                                    <span>Notifica a los socios</span>
                                                    <input
                                                        type="number"
                                                        min="1" max="90"
                                                        value={config.messaging?.expirationWarningDays || 7}
                                                        onChange={e => setConfig({
                                                            ...config,
                                                            messaging: { ...config.messaging!, expirationWarningDays: parseInt(e.target.value) || 7 }
                                                        })}
                                                        className="w-10 bg-transparent border-b border-gray-300 text-center font-bold focus:border-orange-500 outline-none text-orange-600"
                                                    />
                                                    <span>días antes de que pierdan sus puntos.</span>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                messaging: { ...config.messaging!, enableExpirationWarnings: !config.messaging?.enableExpirationWarnings }
                                            })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.messaging?.enableExpirationWarnings ? 'bg-orange-500' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.messaging?.enableExpirationWarnings ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>

                                    {/* Itinerancy / Repeat Notifications Toggle */}
                                    <div className="mt-4 p-4 bg-orange-50/50 rounded-xl border border-orange-100 flex items-center justify-between mb-6">
                                        <div className="flex items-start gap-3">
                                            <div className="p-2 bg-white rounded-lg shadow-sm">
                                                <div className="w-5 h-5 flex items-center justify-center text-orange-600">🔁</div>
                                            </div>
                                            <div>
                                                <h4 className="text-sm font-bold text-orange-900">Itinerancia de Avisos</h4>
                                                <p className="text-[11px] text-orange-800/70 leading-tight mt-1">
                                                    Si está activo, el sistema volverá a enviar notificaciones aunque no haya cambios en los puntos.<br />
                                                    Ideal para recordar periódicamente los vencimientos.
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                messaging: { ...config.messaging!, repeatExpirationWarnings: !config.messaging?.repeatExpirationWarnings }
                                            })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${config.messaging?.repeatExpirationWarnings ? 'bg-orange-500' : 'bg-gray-300'}`}
                                        >
                                            <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition ${config.messaging?.repeatExpirationWarnings ? 'translate-x-6' : 'translate-x-1'}`} />
                                        </button>
                                    </div>
                                    {/* Interval days input - visible when itinerancy is ON */}
                                    {config.messaging?.repeatExpirationWarnings && (
                                        <div className="mt-3 ml-10 p-3 bg-white rounded-lg border border-orange-100 animate-fade-in">
                                            <label className="flex items-center gap-3">
                                                <span className="text-xs font-bold text-orange-800 whitespace-nowrap">Recordar cada</span>
                                                <input
                                                    type="number"
                                                    min={0}
                                                    max={30}
                                                    value={config.messaging?.expirationReminderIntervalDays ?? 5}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        messaging: { ...config.messaging!, expirationReminderIntervalDays: parseInt(e.target.value) || 0 }
                                                    })}
                                                    className="w-16 px-2 py-1 text-center text-sm font-bold border border-orange-200 rounded-lg focus:ring-2 focus:ring-orange-300 focus:outline-none"
                                                />
                                                <span className="text-xs text-orange-700">días después del primer aviso</span>
                                            </label>
                                            <p className="text-[10px] text-orange-600/60 mt-1.5 ml-0">
                                                0 = reenviar siempre. Ej: con ventana de 10 días y recordatorio cada 5, se envía al día 1 y al día 6.
                                            </p>
                                        </div>
                                    )}
                                    {config.messaging?.enableExpirationWarnings && (
                                        <div className="space-y-4 animate-fade-in text-left border-l-2 border-orange-100 pl-4">
                                            <div className="flex gap-2">
                                                <div className="relative flex-1">
                                                    <span className="absolute top-3 left-3 text-xl pointer-events-none select-none">⏳</span>
                                                    <textarea
                                                        rows={2}
                                                        value={config.messaging?.templates?.expirationWarning || ''}
                                                        onChange={e => setConfig({
                                                            ...config,
                                                            messaging: {
                                                                ...config.messaging!,
                                                                templates: { ...config.messaging?.templates, expirationWarning: e.target.value }
                                                            }
                                                        })}
                                                        placeholder={DEFAULT_TEMPLATES.expirationWarning}
                                                        className="w-full pl-10 pr-3 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                    />
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning: DEFAULT_TEMPLATES.expirationWarning } } })}
                                                    className="px-3 py-2 text-gray-400 hover:text-orange-600 rounded-lg hover:bg-orange-50 transition"
                                                    title="Restaurar predeterminado"
                                                >
                                                    ↺
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={() => openPreview('expirationWarning')}
                                                    className="px-3 py-2 text-blue-500 hover:text-blue-700 rounded-lg hover:bg-blue-50 transition border border-blue-100"
                                                    title="Previsualizar Email"
                                                >
                                                    <Eye size={18} />
                                                </button>
                                            </div>
                                            <VariableChips vars={['nombre', 'puntos', 'fecha']} onSelect={v => insertVar('expirationWarning', v)} />

                                            <div className="bg-gray-50/50 p-4 rounded-xl border border-gray-100">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector
                                                    channels={config.messaging?.eventConfigs?.expirationWarning?.channels || []}
                                                    onChange={(newChannels) => setConfig({
                                                        ...config,
                                                        messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, expirationWarning: { channels: newChannels } } }
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>

                            {/* Email Preview Button */}
                            {config.messaging?.emailEnabled && (
                                <div className="flex justify-end pt-4">
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

                {
                    activeTab === 'advanced' && (
                        <div className="max-w-4xl mx-auto py-12 space-y-8">
                            {/* SECCIÓN HERRAMIENTAS DE TRABAJO */}
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <Clock size={22} className="text-purple-500" /> Herramientas de Trabajo
                                </h3>
                                <div className="space-y-6">
                                    <div className="flex items-center justify-between p-6 bg-purple-50/50 rounded-2xl border border-purple-100">
                                        <div className="flex-1">
                                            <span className="text-sm font-bold text-gray-800 flex items-center gap-2">
                                                Simulador de Fecha y Hora
                                                <span className="text-[10px] bg-purple-100 text-purple-600 px-2 py-0.5 rounded-full uppercase tracking-tighter">Dev Tool</span>
                                            </span>
                                            <p className="text-xs text-gray-500 mt-1">Activa un controlador en el menú lateral para adelantar o retrasar el tiempo del sistema. Útil para probar vencimientos de puntos y campañas.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({ ...config, enableDateSimulator: !config.enableDateSimulator })}
                                            className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableDateSimulator ? 'bg-purple-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableDateSimulator ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {/* Motor Automático Diario */}
                                    <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 space-y-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center font-bold shadow-md shadow-blue-200">
                                                <Settings size={20} />
                                            </div>
                                            <div>
                                                <h4 className="text-md font-black text-gray-800 tracking-tight">Motor Automático Diario</h4>
                                                <p className="text-xs text-gray-500 uppercase tracking-widest font-bold">Ventana de Ejecución</p>
                                            </div>
                                        </div>
                                        <p className="text-sm text-gray-600 leading-relaxed">
                                            Define el rango horario en el que el sistema tiene permitido revisar vencimientos y enviar felicitaciones de cumpleaños u ofertas automáticas (Ej: de 9 a 22 hs). Esto evita molestar a tus clientes con notificaciones de madrugada.
                                        </p>

                                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-blue-50">
                                            <label className="flex flex-col flex-1">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Empieza a las</span>
                                                <div className="relative">
                                                    <input
                                                        type="number" min="0" max="23"
                                                        value={config.messaging?.engineAllowedStartHour ?? 9}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, engineAllowedStartHour: parseInt(e.target.value) || 0 } })}
                                                        className="w-full pl-3 pr-8 py-2 text-xl font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="absolute right-3 top-2.5 font-bold text-gray-400">hs</span>
                                                </div>
                                            </label>
                                            <span className="text-gray-300 font-black">—</span>
                                            <label className="flex flex-col flex-1">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Corta a las</span>
                                                <div className="relative">
                                                    <input
                                                        type="number" min="0" max="23"
                                                        value={config.messaging?.engineAllowedEndHour ?? 22}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, engineAllowedEndHour: parseInt(e.target.value) || 0 } })}
                                                        className="w-full pl-3 pr-8 py-2 text-xl font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="absolute right-3 top-2.5 font-bold text-gray-400">hs</span>
                                                </div>
                                            </label>
                                        </div>

                                        <div className="mt-4 pt-4 border-t border-blue-100 flex flex-col gap-3">
                                            <p className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-1">Gatillos (Triggers) de Ejecución</p>
                                            <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-50 hover:bg-blue-50/50 transition-colors cursor-pointer">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-700 block">Ejecución en Dashboard</span>
                                                    <span className="text-[10px] text-gray-500">Intenta arrancar en segundo plano al abrir este panel de Admin.</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-blue-600 rounded"
                                                    checked={config.messaging?.enableDashboardTrigger !== false}
                                                    onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, enableDashboardTrigger: e.target.checked } })}
                                                />
                                            </label>
                                            <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-50 hover:bg-blue-50/50 transition-colors cursor-pointer">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-700 block">Ejecución en PWA (Clientes)</span>
                                                    <span className="text-[10px] text-gray-500">Un cliente real puede despabilar el motor de forma silenciosa.</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-blue-600 rounded"
                                                    checked={config.messaging?.enableClientTrigger !== false}
                                                    onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, enableClientTrigger: e.target.checked } })}
                                                />
                                            </label>
                                            <label className="flex items-center justify-between p-3 bg-white rounded-lg border border-blue-50 hover:bg-blue-50/50 transition-colors cursor-pointer">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-700 block">Ejecución en Extensión</span>
                                                    <span className="text-[10px] text-gray-500">El plugin de Chrome del mostrador arranca el motor si no se usó hoy.</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-blue-600 rounded"
                                                    checked={config.messaging?.enableExtensionTrigger !== false}
                                                    onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, enableExtensionTrigger: e.target.checked } })}
                                                />
                                            </label>

                                            <label className="flex items-center justify-between p-3 bg-purple-50 rounded-lg border border-purple-100 hover:bg-purple-100/50 transition-colors cursor-pointer">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-700 block">Ejecución vía QStash (Cron Externo)</span>
                                                    <span className="text-[10px] text-gray-500">Habilita las llamadas que vienen desde el servicio Upstash.</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-purple-600 rounded"
                                                    checked={config.messaging?.enableQStashTrigger !== false}
                                                    onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, enableQStashTrigger: e.target.checked } })}
                                                />
                                            </label>

                                            {/* Guía de QStash */}
                                            <div className="mt-4 p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-white shadow-xl">
                                                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-[0.2em]">Configuración QStash</span>
                                                </div>
                                                <p className="text-xs text-gray-400 mb-4 leading-relaxed">
                                                    Para automatizar el motor, configurá un <b>Schedule</b> en Upstash con estos datos:
                                                </p>
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase">Destination URL</span>
                                                        <div className="flex gap-2">
                                                            <code className="text-[10px] bg-white/10 p-2 rounded-lg flex-1 break-all flex items-center">
                                                                {`https://fidelidad-next.vercel.app/api/engine-daily?mode=daily&trigger=qstash`}
                                                            </code>
                                                            <button
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(`https://fidelidad-next.vercel.app/api/engine-daily?mode=daily&trigger=qstash`);
                                                                    alert("URL Copiada");
                                                                }}
                                                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                                                            >
                                                                <Settings size={14} />
                                                            </button>
                                                        </div>
                                                    </div>
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase">Headers</span>
                                                        <code className="text-[10px] bg-white/10 p-2 rounded-lg block border border-white/5">
                                                            Upstash-Forward-x-api-key: [Tu API_SECRET_KEY]
                                                        </code>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN RESPALDOS */}
                            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                                <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <ShieldAlert size={22} className="text-blue-500" /> Puntos de Restauración (Backups)
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <div className="space-y-4">
                                        <p className="text-sm text-gray-500">Guarda una copia de seguridad de tu marca, reglas y catálogo para estar seguro antes de un reset.</p>
                                        <button
                                            type="button"
                                            onClick={() => handleResetAction('backup')}
                                            className="w-full flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white py-3 rounded-xl font-bold transition-all"
                                        >
                                            <Save size={18} /> Crear Punto de Respaldo
                                        </button>
                                    </div>
                                    <div className="space-y-4 border-l border-gray-100 pl-6">
                                        <p className="text-sm text-gray-500">¿Algo salió mal? Vuelve a la configuración estructural guardada anteriormente.</p>
                                        <button
                                            type="button"
                                            onClick={() => handleResetAction('restore')}
                                            className="w-full flex items-center justify-center gap-2 bg-gray-50 text-gray-600 hover:bg-black hover:text-white py-3 rounded-xl font-bold transition-all"
                                        >
                                            <RefreshCw size={18} /> Restaurar Configuración Anterior
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* SECCIÓN RESET MAESTRO */}
                            <div className="bg-red-50/30 border-2 border-red-100 rounded-3xl p-10 space-y-8">
                                <div className="text-center space-y-2">
                                    <h3 className="text-2xl font-black text-gray-800">Reset Maestro Granular</h3>
                                    <p className="text-gray-500">Selecciona los elementos que deseas limpiar. Las acciones en rojo son irreversibles.</p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Grupo 1: Socios */}
                                    <div className="bg-white p-6 rounded-2xl border border-red-50 space-y-4">
                                        <h4 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2 mb-4">
                                            <Users size={18} className="text-red-500" /> Socios y Actividad
                                        </h4>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.socios_total} onChange={e => setResetOptions({ ...resetOptions, socios_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Borrar Socios por Completo</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Elimina cuentas y acceso PWA</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.socios_historial} onChange={e => setResetOptions({ ...resetOptions, socios_historial: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Vaciar Historial y Puntos</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Resetea saldos a 0 manteniendo socios</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.socios_mensajes} onChange={e => setResetOptions({ ...resetOptions, socios_mensajes: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Limpiar Mensajes Enviados</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Borra el buzón de entrada de los clientes</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.geo_total} onChange={e => setResetOptions({ ...resetOptions, geo_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Borrar Datos Geográficos</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Historial de GPS (Geo_Raw)</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.transacciones_total} onChange={e => setResetOptions({ ...resetOptions, transacciones_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Limpiar Transacciones Globales</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Reset de Métricas (Transactions)</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>

                                    {/* Grupo 2: Estructura */}
                                    <div className="bg-white p-6 rounded-2xl border border-red-50 space-y-4">
                                        <h4 className="font-bold text-gray-800 flex items-center gap-2 border-b pb-2 mb-4">
                                            <Settings size={18} className="text-gray-600" /> Estructura y Configuración
                                        </h4>
                                        <div className="space-y-3">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.marca_total} onChange={e => setResetOptions({ ...resetOptions, marca_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-blue-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-blue-600">Reset de Identidad Visual</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Vuelve a colores y logo de fábrica</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.gamification_total} onChange={e => setResetOptions({ ...resetOptions, gamification_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-blue-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-blue-600">Reset de Reglas de Juego</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Valor de punto y bonos default</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.prizes_total} onChange={e => setResetOptions({ ...resetOptions, prizes_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Borrar Catálogo de Premios</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Elimina todos los beneficios creados</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.campaigns_total} onChange={e => setResetOptions({ ...resetOptions, campaigns_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Borrar Campañas y Promos</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Elimina multiplicadores y bonos</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.team_total} onChange={e => setResetOptions({ ...resetOptions, team_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Borrar Equipo (Admins)</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Mantiene solo tu acceso actual</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.legales_total} onChange={e => setResetOptions({ ...resetOptions, legales_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-gray-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-gray-950">Reset de Términos Legales</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Vuelve al texto legal estándar</span>
                                                </div>
                                            </label>
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input type="checkbox" checked={resetOptions.audit_total} onChange={e => setResetOptions({ ...resetOptions, audit_total: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                <div>
                                                    <span className="block text-sm font-bold text-gray-700 group-hover:text-red-600">Limpiar Logs de Auditoría</span>
                                                    <span className="text-[10px] text-gray-400 uppercase">Borra TODO el historial de acciones y errores</span>
                                                </div>
                                            </label>
                                        </div>
                                    </div>
                                </div>

                                <div className="flex flex-col items-center gap-4 pt-6 border-t border-red-100">
                                    <button
                                        type="button"
                                        onClick={() => handleResetAction('reset')}
                                        disabled={isReadOnly}
                                        className="w-full md:w-2/3 bg-red-600 hover:bg-black text-white py-4 rounded-2xl font-black text-xl transition-all shadow-xl shadow-red-200 flex items-center justify-center gap-3 active:scale-95 disabled:opacity-50"
                                    >
                                        <Trash2 size={24} /> Ejecutar Reset de Selección
                                    </button>
                                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">⚠️ Esta acción puede ser permanente según tu selección</p>
                                </div>
                            </div>
                        </div>
                    )
                }

                <div className="fixed bottom-6 right-6 z-40">
                    <button
                        disabled={loading}
                        className="bg-gray-900 hover:bg-black text-white px-8 py-4 rounded-full font-bold shadow-2xl flex items-center gap-3 transition-transform hover:-translate-y-1 active:scale-95"
                    >
                        {loading ? 'Guardando...' : <><Save size={20} /> Guardar Todo</>}
                    </button>
                </div>
            </form >

            <EmailPreviewModal
                isOpen={previewModal.isOpen}
                onClose={() => setPreviewModal({ ...previewModal, isOpen: false })}
                config={config}
                templateId={previewModal.templateId}
                templateTitle={previewModal.title}
                templateContent={previewModal.content}
            />
        </div >
    );
};
