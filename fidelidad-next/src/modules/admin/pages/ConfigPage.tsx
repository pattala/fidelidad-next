import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, Palette, Calculator, Monitor, Smartphone, Settings, Home, Gift, MessageCircle, FileText, AlertTriangle, RefreshCw, ShieldAlert, Shield, Users, Clock, Eye, Sparkles, Cake, Zap, UserPlus, Megaphone, Bell, MapPin, Download, QrCode, KeyRound, Copy, Dog } from 'lucide-react';
import QRCode from 'react-qr-code';

console.log('REVISIÓN 2.0 - ARQUITECTURA MODULAR ACTIVA 🚀');
// Triggering build after hard reset to 6a5e4c4
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
    console.log("%c REVISIÓN 2.0 - ARQUITECTURA MODULAR ACTIVA 🚀", "color: white; background: #2563eb; padding: 5px 10px; border-radius: 5px; font-weight: bold;");
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
        siteName: import.meta.env.VITE_APP_NAME || 'Sistema de Beneficios',
        primaryColor: '#2563eb',
        secondaryColor: '#1e3a8a',
        backgroundColor: '#f9fafb',
        sectionTitleColor: '#9ca3af', // Default gray-400
        linkColor: '#4a148c', // Default purple-900 like
        logoUrl: '',
        logoSize: 32,
        siteNameFont: 'Inter',
        siteNameSize: 14,
        siteNameAlignment: 'center',
        carouselSpeedSeconds: 6,
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
                offer: { channels: ['push', 'email'] },
                referralReward: { channels: ['email', 'push'] },
                referralPoints: { channels: ['email', 'push'] },
                petFoodAlert: { channels: ['whatsapp', 'push'] }
            },
            templates: {
                welcome: '',
                pointsAdded: '',
                redemption: '',
                campaign: '',
                offer: '',
                birthday: '',
                referralReward: '',
                referralPoints: '',
                petFoodAlert: ''
            },
            mobileCooldownHours: 24,
            notificationPromptIntervalDays: 30,
            enableLargePrompt: true,
            maxLargePromptDismissalsPC: 2,
            maxLargePromptDismissalsMobile: 2
        },
        enableExternalIntegration: true,
        referrals: {
            enabled: true,
            pointsForReferrer: 200,
            pointsForReferee: 0,
            rewardCriteria: 'first_transaction'
        },
        enableDateSimulator: false,
        enableDuplicateControl: true,
        enablePetModule: import.meta.env.VITE_ENABLE_PET_MODULE === 'true',
        discountRecoveryRatio: 0,
        dormantDays: 60
    });

    const { isReadOnly, user } = useAdminAuth();
    const [activeTab, setActiveTab] = useState<'economy' | 'mechanics' | 'communication' | 'identity' | 'advanced'>('economy');
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
    const insertVar = (field: 'pointsAdded' | 'redemption' | 'welcome' | 'campaign' | 'offer' | 'flashOffer' | 'birthday' | 'birthdaySimple' | 'referralReward' | 'referralPoints' | 'expirationWarning' | 'referralChallenge' | 'petFoodAlert', variable: string) => {
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
                    // @ts-ignore
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

    // Cargar config al montar (Suscripción en Tiempo Real)
    useEffect(() => {
        const unsubscribe = ConfigService.subscribe((saved) => {
            if (saved) {
                setConfig(prev => ({
                    ...prev,
                    ...saved
                }));
                applyColors(saved);
            }
        });
        return () => unsubscribe();
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
                    <h1 className="text-3xl font-bold text-gray-800">Configuración Pro</h1>
                    <p className="text-gray-500 mt-1">Personaliza el funcionamiento y la apariencia de tu programa de fidelidad.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('economy')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'economy' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calculator size={18} />
                        Economía
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('mechanics')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'mechanics' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Zap size={18} />
                        Mecánicas
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('communication')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'communication' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <MessageCircle size={18} />
                        Comunicación
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('identity')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'identity' ? 'bg-white text-indigo-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Palette size={18} />
                        Identidad
                    </button>
                    <button
                        type="button"
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

                {/* Pilar: ECONOMÍA 💰 */}
                {activeTab === 'economy' && (
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
                                                            (config.pointCalculationMethod === 'budget' && config.pointValueBudget) ? 'Varía (Dinámico)' :
                                                                (config.pointCalculationMethod === 'average' || config.useAutomaticPointValue) ? autoPointValue.toFixed(2) :
                                                                    (config.pointValue || 10)
                                                        }
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-400 mb-1">/ punto</span>
                                                </div>

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

                            {/* Control de Duplicados (Movido de Avanzado) */}
                            <div className="flex items-center justify-between p-6 bg-red-50/50 rounded-2xl border border-red-100 group transition-all hover:bg-red-50">
                                <div className="flex-1">
                                    <span className="text-sm font-black text-red-900 uppercase flex items-center gap-2">
                                        <Shield size={16} /> Control de Ejecución Diaria
                                    </span>
                                    <p className="text-[10px] text-red-600 font-bold mt-1 leading-tight">
                                        Evita que el motor automático envíe avisos duplicados si se ejecuta varias veces el mismo día. <br />
                                        <span className="opacity-70">Altamente recomendado para cuidar la experiencia del cliente.</span>
                                    </p>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setConfig({ ...config, enableDuplicateControl: config.enableDuplicateControl === undefined ? true : !config.enableDuplicateControl })}
                                    className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableDuplicateControl !== false ? 'bg-red-600' : 'bg-gray-200'}`}
                                >
                                    <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableDuplicateControl !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                </button>
                            </div>

                            {/* Tarjeta de Salud de la Base */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-orange-100 relative overflow-hidden group hover:shadow-md transition">
                                <div className="absolute top-0 right-0 w-24 h-24 bg-orange-50 rounded-bl-full -mr-8 -mt-8 transition group-hover:bg-orange-100"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 relative z-10">
                                    <span className="bg-orange-100 text-orange-600 p-2 rounded-lg"><Clock size={20} /></span>
                                    Salud de la Base
                                </h3>

                                <div className="space-y-4 relative z-10">
                                    <div className="bg-orange-50/30 p-4 rounded-xl border border-orange-100">
                                        <div className="flex flex-col gap-3">
                                            <div className="flex-1">
                                                <span className="text-sm font-bold text-gray-800">Umbral de Inactividad</span>
                                                <p className="text-xs text-gray-500 mt-1">Días sin compras para que el sistema marque a un cliente como "Dormido" en el dashboard.</p>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="365"
                                                    value={config.dormantDays || 60}
                                                    onChange={e => setConfig({ ...config, dormantDays: parseInt(e.target.value) || 0 })}
                                                    className="w-full pl-3 pr-12 py-2 bg-white rounded-lg border-orange-200 border-2 text-orange-700 font-bold outline-none focus:ring-4 focus:ring-orange-50"
                                                />
                                                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-orange-400 text-[10px] font-bold uppercase">Días</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Columna Derecha: VENCIMIENTOS */}
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-gray-50 rounded-bl-full -mr-10 -mt-10 transition group-hover:bg-gray-100"></div>
                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <span className="bg-gray-100 text-gray-600 p-2 rounded-lg"><RefreshCw size={20} /></span>
                                        Vencimientos
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, expirationRules: [...(config.expirationRules || []), { months: 6, pointsThreshold: 0 }] })}
                                        className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-xs font-bold hover:bg-black transition shadow-lg shadow-gray-200"
                                    >
                                        <Plus size={14} /> Nueva Regla
                                    </button>
                                </div>

                                <div className="space-y-4 relative z-10">
                                    {(config.expirationRules || []).map((rule, idx) => (
                                        <div key={idx} className="flex items-center gap-4 bg-gray-50 p-4 rounded-xl border border-gray-100 group/item">
                                            <div className="flex-1">
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Los puntos vencen a los</span>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number" min="1"
                                                        value={rule.months}
                                                        onChange={e => {
                                                            const newRules = [...config.expirationRules];
                                                            newRules[idx].months = parseInt(e.target.value) || 0;
                                                            setConfig({ ...config, expirationRules: newRules });
                                                        }}
                                                        className="w-16 p-2 bg-white rounded-lg border-gray-200 text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm font-bold text-gray-500">meses</span>
                                                </div>
                                            </div>
                                            <div className="flex-1">
                                                <span className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Si el saldo supera</span>
                                                <div className="flex items-center gap-2">
                                                    <input
                                                        type="number" min="0"
                                                        value={rule.pointsThreshold}
                                                        onChange={e => {
                                                            const newRules = [...config.expirationRules];
                                                            newRules[idx].pointsThreshold = parseInt(e.target.value) || 0;
                                                            setConfig({ ...config, expirationRules: newRules });
                                                        }}
                                                        className="w-20 p-2 bg-white rounded-lg border-gray-200 text-center font-bold text-gray-700 outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                    <span className="text-sm font-bold text-gray-500">pts</span>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({ ...config, expirationRules: config.expirationRules.filter((_, i) => i !== idx) })}
                                                className="p-2 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover/item:opacity-100"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    ))}

                                    {(config.expirationRules || []).length === 0 && (
                                        <div className="text-center py-8 bg-gray-50 rounded-2xl border border-dashed border-gray-200">
                                            <p className="text-sm text-gray-400">No hay reglas de vencimiento. <br />Los puntos serán eternos.</p>
                                        </div>
                                    )}

                                    {/* Botón Acción Manual de Vencimientos */}
                                    <div className="mt-8 p-4 bg-blue-50 rounded-2xl border border-blue-100 flex items-center justify-between gap-4">
                                        <div className="flex-1">
                                            <span className="text-xs font-bold text-blue-800 block">Ejecución de Motor Manual</span>
                                            <p className="text-[10px] text-blue-600 mt-1">Revisa vencimientos y envía avisos ahora mismo.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={handleRunExpirations}
                                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-200 flex items-center gap-2"
                                        >
                                            <Zap size={14} /> Ejecutar Ahora
                                        </button>
                                    </div>
                                </div>
                            </div>

                            {/* Ratio de Recuperación (Deuda) */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 relative overflow-hidden group hover:shadow-md transition">
                                <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                                    <span className="bg-emerald-100 text-emerald-600 p-2 rounded-lg"><Monitor size={20} /></span>
                                    Control de Deuda Técnica
                                </h3>
                                <div className="space-y-4">
                                    <div>
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="text-sm font-semibold text-gray-700">Ratio de Recuperación de Descuentos</label>
                                            <span className="text-emerald-600 font-bold">{(config.discountRecoveryRatio || 0) * 100}%</span>
                                        </div>
                                        <input
                                            type="range"
                                            min="0"
                                            max="1"
                                            step="0.01"
                                            value={config.discountRecoveryRatio || 0}
                                            onChange={e => setConfig({ ...config, discountRecoveryRatio: parseFloat(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-2">
                                            Porcentaje de los puntos canjeados que se consideran "recuperados" para tus métricas de ahorro.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pilar: MECÁNICAS 🎮 */}
                {activeTab === 'mechanics' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            {/* Bienvenida */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-orange-100 relative overflow-hidden group hover:shadow-md transition">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-orange-50 rounded-bl-full -mr-10 -mt-10 transition group-hover:bg-orange-100"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 relative z-10">
                                    <span className="bg-orange-100 text-orange-600 p-2 rounded-lg"><UserPlus size={20} /></span>
                                    Bienvenida
                                </h3>
                                <div className="space-y-4 relative z-10">
                                    <div className="bg-gray-50 p-4 rounded-xl border border-gray-200">
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Puntos de Regalo al Registrarse</label>
                                        <div className="relative">
                                            <input
                                                type="number" min="0"
                                                value={config.welcomePoints}
                                                onChange={e => setConfig({ ...config, welcomePoints: parseInt(e.target.value) || 0 })}
                                                className="w-full pl-4 pr-16 py-3 bg-white rounded-xl border-orange-200 border-2 focus:border-orange-500 focus:ring-4 focus:ring-orange-50 text-orange-700 font-black text-xl text-center outline-none transition shadow-sm"
                                            />
                                            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-600 text-xs font-black uppercase tracking-tighter">Puntos</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mt-2">Estos puntos se acreditan automáticamente al momento de la creación de la cuenta.</p>
                                    </div>
                                </div>
                            </div>

                            {/* Módulo Petshop (Toggle Global) */}
                            {import.meta.env.VITE_ENABLE_PET_MODULE === 'true' && (
                                <div className="flex items-center justify-between p-6 bg-orange-50/50 rounded-2xl border border-orange-100 group transition-all hover:bg-orange-50">
                                    <div className="flex-1">
                                        <span className="text-sm font-black text-orange-900 uppercase flex items-center gap-2">
                                            <Dog size={16} /> Módulo Petshop
                                        </span>
                                        <p className="text-[10px] text-orange-600 font-bold mt-1 leading-tight">
                                            Habilita la sección "Mis Mascotas" en el perfil del cliente y el sistema de alertas de alimento.
                                        </p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, enablePetModule: !config.enablePetModule })}
                                        className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enablePetModule ? 'bg-orange-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enablePetModule ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>
                            )}

                            {/* Referidos */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-blue-100 relative overflow-hidden group hover:shadow-md transition">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 rounded-bl-full -mr-10 -mt-10 transition group-hover:bg-blue-100"></div>
                                <div className="flex items-center justify-between mb-6 relative z-10">
                                    <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                        <span className="bg-blue-100 text-blue-600 p-2 rounded-lg"><Users size={20} /></span>
                                        Sistema de Referidos
                                    </h3>
                                    <button
                                        type="button"
                                        onClick={() => setConfig({ ...config, referrals: { ...config.referrals!, enabled: !config.referrals?.enabled } })}
                                        className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.referrals?.enabled ? 'bg-blue-600' : 'bg-gray-200'}`}
                                    >
                                        <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.referrals?.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
                                    </button>
                                </div>

                                <div className={`space-y-6 relative z-10 transition-opacity ${config.referrals?.enabled ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                                    <div className="grid grid-cols-2 gap-4">
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Premio al Invitador</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={config.referrals?.pointsForReferrer || 0}
                                                    onChange={e => setConfig({ ...config, referrals: { ...config.referrals!, pointsForReferrer: parseInt(e.target.value) || 0 } })}
                                                    className="w-full p-2 bg-white rounded-lg border border-gray-200 text-center font-bold text-blue-600 outline-none focus:ring-2 focus:ring-blue-500"
                                                />
                                                <span className="absolute right-2 top-2 text-[8px] font-bold text-gray-300">PTS</span>
                                            </div>
                                        </div>
                                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Regalo al Invitado</label>
                                            <div className="relative">
                                                <input
                                                    type="number"
                                                    value={config.referrals?.pointsForReferee || 0}
                                                    onChange={e => setConfig({ ...config, referrals: { ...config.referrals!, pointsForReferee: parseInt(e.target.value) || 0 } })}
                                                    className="w-full p-2 bg-white rounded-lg border border-gray-200 text-center font-bold text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500"
                                                />
                                                <span className="absolute right-2 top-2 text-[8px] font-bold text-gray-300">PTS</span>
                                            </div>
                                        </div>
                                    </div>

                                    <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100">
                                        <label className="block text-xs font-bold text-blue-800 uppercase tracking-widest mb-3">Criterio de Recompensa</label>
                                        <div className="space-y-2">
                                            {[
                                                { id: 'registration', label: 'Al registrarse', desc: 'Los puntos se dan apenas el invitado crea su cuenta.' },
                                                { id: 'first_transaction', label: 'Tras la primera compra', desc: 'Ideal para evitar cuentas falsas. Requiere una compra real.' }
                                            ].map(opt => (
                                                <label key={opt.id} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition ${config.referrals?.rewardCriteria === opt.id ? 'bg-white border-blue-400 shadow-sm' : 'bg-transparent border-transparent hover:bg-white/50'}`}>
                                                    <input
                                                        type="radio"
                                                        name="rewardCriteria"
                                                        checked={config.referrals?.rewardCriteria === opt.id}
                                                        onChange={() => setConfig({ ...config, referrals: { ...config.referrals!, rewardCriteria: opt.id as any } })}
                                                        className="mt-1 text-blue-600"
                                                    />
                                                    <div>
                                                        <span className="text-sm font-bold text-gray-700 block">{opt.label}</span>
                                                        <span className="text-[10px] text-gray-500">{opt.desc}</span>
                                                    </div>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Cumpleaños (Columna Derecha) */}
                        <div className="space-y-6">
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-pink-100 relative overflow-hidden group hover:shadow-md transition">
                                <div className="absolute top-0 right-0 w-32 h-32 bg-pink-50 rounded-bl-full -mr-10 -mt-10 transition group-hover:bg-pink-100"></div>
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2 relative z-10">
                                    <span className="bg-pink-100 text-pink-600 p-2 rounded-lg"><Cake size={20} /></span>
                                    Reglas de Cumpleaños
                                </h3>
                                <div className="space-y-6 relative z-10">
                                    <div className="bg-gray-50 p-6 rounded-2xl border border-gray-200">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <span className="text-sm font-bold text-gray-800 block">Regalo de Puntos</span>
                                                <p className="text-[10px] text-gray-500 leading-tight">Crédito automático que recibe el socio en su día.</p>
                                            </div>
                                            <div className="relative">
                                                <input
                                                    type="number" min="0"
                                                    value={config.birthdayPoints || 0}
                                                    onChange={e => setConfig({ ...config, birthdayPoints: parseInt(e.target.value) || 0 })}
                                                    className="w-24 p-3 bg-white rounded-xl border-pink-200 border-2 text-pink-600 font-black text-lg text-center outline-none focus:ring-4 focus:ring-pink-50"
                                                />
                                                <span className="absolute -top-2 -right-1 bg-pink-600 text-white text-[8px] px-1.5 py-0.5 rounded-full font-bold">PTS</span>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 p-3 bg-white/50 rounded-xl border border-pink-100">
                                            <div className="flex-1">
                                                <span className="text-xs font-bold text-gray-600 block">Habilitar Saludo Simple</span>
                                                <p className="text-[9px] text-gray-400">Si el regalo es 0, enviar solo un mensaje de felicitación.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({ ...config, enableBirthdayGreeting: !config.enableBirthdayGreeting })}
                                                className={`relative w-10 h-6 transition-colors rounded-full ${config.enableBirthdayGreeting ? 'bg-pink-500' : 'bg-gray-200'}`}
                                            >
                                                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${config.enableBirthdayGreeting ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    </div>

                                    <div className="p-4 bg-blue-50/50 rounded-xl border border-blue-100">
                                        <h4 className="text-xs font-bold text-blue-800 uppercase tracking-widest mb-2 flex items-center gap-2">
                                            <Clock size={14} /> Ventana de Aplicación
                                        </h4>
                                        <p className="text-[10px] text-blue-600 mb-4">Los puntos de cumpleaños se entregan a las 00:00hs del día del aniversario.</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                {/* Pilar: COMUNICACIÓN 📢 */}
                {activeTab === 'communication' && (
                    <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4">
                        {/* 1. MASTER SWITCHES */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="bg-indigo-50 p-3 rounded-2xl text-indigo-600">
                                    <Settings size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight">Canales Globales</h3>
                                    <p className="text-gray-500 text-sm">Activa o desactiva la salida de mensajes por canal.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {[
                                    { id: 'whatsappEnabled', label: 'WhatsApp', icon: '💬', color: 'bg-green-500', bgColor: 'bg-green-50', borderColor: 'border-green-200', textColor: 'text-green-700' },
                                    { id: 'emailEnabled', label: 'Email', icon: '📧', color: 'bg-blue-500', bgColor: 'bg-blue-50', borderColor: 'border-blue-200', textColor: 'text-blue-700' },
                                    { id: 'pushEnabled', label: 'Notificaciones Push', icon: '🔔', color: 'bg-purple-500', bgColor: 'bg-purple-50', borderColor: 'border-purple-200', textColor: 'text-purple-700' }
                                ].map(channel => (
                                    <div key={channel.id} className={`p-6 rounded-2xl border-2 transition-all ${config.messaging?.[channel.id as keyof typeof config.messaging] ? `${channel.bgColor} ${channel.borderColor}` : 'bg-gray-50 border-gray-100'}`}>
                                        <div className="flex items-center justify-between mb-4">
                                            <span className="text-2xl">{channel.icon}</span>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({
                                                    ...config,
                                                    messaging: { ...config.messaging!, [channel.id]: !config.messaging?.[channel.id as keyof typeof config.messaging] }
                                                })}
                                                className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.messaging?.[channel.id as keyof typeof config.messaging] ? channel.color : 'bg-gray-200'}`}
                                            >
                                                <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.messaging?.[channel.id as keyof typeof config.messaging] ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        <span className={`font-bold uppercase tracking-widest text-[10px] ${channel.textColor}`}>{channel.label}</span>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* 2. PWA & PUSH PERMISSIONS */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                            <div className="flex items-center gap-3 mb-8">
                                <div className="bg-purple-50 p-3 rounded-2xl text-purple-600">
                                    <Bell size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-gray-800 tracking-tight">Experiencia PWA</h3>
                                    <p className="text-gray-500 text-sm">Configura cómo y cuándo pedir permisos a tus clientes.</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-6">
                                    <div className="bg-purple-50/50 p-6 rounded-2xl border border-purple-100">
                                        <div className="flex items-center justify-between mb-4">
                                            <div>
                                                <span className="text-sm font-bold text-gray-800 block">Re-intento de Permisos</span>
                                                <p className="text-[10px] text-gray-500">Si el cliente elige "Quizás Luego".</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({
                                                    ...config,
                                                    messaging: { ...config.messaging!, enablePermissionPromptRepetition: !config.messaging?.enablePermissionPromptRepetition }
                                                })}
                                                className={`relative w-10 h-6 transition-colors rounded-full ${config.messaging?.enablePermissionPromptRepetition ? 'bg-purple-600' : 'bg-gray-200'}`}
                                            >
                                                <span className={`absolute top-1 left-1 bg-white w-4 h-4 rounded-full shadow-sm transition-transform ${config.messaging?.enablePermissionPromptRepetition ? 'translate-x-4' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                        <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-purple-100">
                                            <input
                                                type="number"
                                                value={config.messaging?.notificationPromptIntervalDays || 30}
                                                onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, notificationPromptIntervalDays: parseInt(e.target.value) || 30 } })}
                                                className="w-16 bg-purple-50 text-center font-black text-lg text-purple-600 rounded-lg py-1 outline-none"
                                            />
                                            <span className="text-xs font-bold text-gray-600">Días de silencio entre intentos.</span>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-6 bg-blue-50/50 rounded-2xl border border-blue-100 flex flex-col justify-center">
                                    <div className="flex items-center gap-3 mb-4 text-blue-700">
                                        <Smartphone size={20} />
                                        <span className="text-sm font-bold uppercase tracking-tight">WhatsApp Business</span>
                                    </div>
                                    <input
                                        type="tel"
                                        placeholder="54911..."
                                        value={config.messaging?.whatsappPhoneNumber || ''}
                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, whatsappPhoneNumber: e.target.value } })}
                                        className="w-full p-4 rounded-xl border-2 border-white bg-white shadow-sm focus:border-blue-500 outline-none text-lg font-bold text-gray-800"
                                    />
                                    <p className="text-[10px] text-blue-400 mt-2 ml-1 italic">* Formato internacional sin símbolos (ej: 549116543210)</p>
                                </div>
                            </div>
                        </div>

                        {/* 3. AUTOMATIC TEMPLATES */}
                        <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                            <h3 className="text-xl font-black text-gray-800 mb-8 flex items-center gap-3">
                                <span className="bg-emerald-50 text-emerald-600 p-3 rounded-2xl"><MessageSquare size={24} /></span>
                                Plantillas Automáticas
                            </h3>

                            <div className="grid grid-cols-1 gap-8">
                                {[
                                    { id: 'welcome', label: 'Bienvenida', icon: '👋', vars: ['siteName', 'nombre', 'puntos'] },
                                    { id: 'pointsAdded', label: 'Suma de Puntos', icon: '💰', vars: ['siteName', 'nombre', 'puntos', 'saldo'] },
                                    { id: 'redemption', label: 'Canje de Premio', icon: '🎁', vars: ['siteName', 'nombre', 'premio', 'codigo'] },
                                    { id: 'birthday', label: 'Cumpleaños', icon: '🎂', vars: ['siteName', 'nombre', 'puntos'] },
                                    { id: 'expirationWarning', label: 'Aviso de Vencimiento', icon: '⏳', vars: ['siteName', 'nombre', 'puntos', 'fecha'] }
                                ].map(tpl => (
                                    <div key={tpl.id} className="group relative bg-gray-50/50 p-6 rounded-2xl border border-gray-100 hover:border-emerald-200 transition-all">
                                        <div className="flex flex-col md:flex-row gap-6">
                                            <div className="flex-1 space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className="text-sm font-black text-gray-800 uppercase tracking-tighter flex items-center gap-2">
                                                        <span className="text-lg">{tpl.icon}</span> {tpl.label}
                                                    </span>
                                                    <div className="flex items-center gap-2">
                                                        <button
                                                            type="button"
                                                            onClick={() => openPreview(tpl.id as any)}
                                                            className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition"
                                                            title="Previsualizar"
                                                        >
                                                            <Eye size={18} />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() => setConfig({
                                                                ...config,
                                                                messaging: {
                                                                    ...config.messaging!,
                                                                    templates: { ...config.messaging?.templates, [tpl.id]: (DEFAULT_TEMPLATES as any)[tpl.id] }
                                                                }
                                                            })}
                                                            className="p-2 text-gray-400 hover:text-orange-500 transition"
                                                            title="Restaurar"
                                                        >
                                                            <RotateCcw size={16} />
                                                        </button>
                                                    </div>
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    value={config.messaging?.templates?.[tpl.id as keyof typeof config.messaging.templates] || ''}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        messaging: {
                                                            ...config.messaging!,
                                                            templates: { ...config.messaging?.templates, [tpl.id]: e.target.value }
                                                        }
                                                    })}
                                                    placeholder={(DEFAULT_TEMPLATES as any)[tpl.id]}
                                                    className="w-full p-4 rounded-xl border border-gray-200 bg-white focus:ring-4 focus:ring-emerald-50 outline-none transition text-sm leading-relaxed"
                                                />
                                                <VariableChips vars={tpl.vars} onSelect={v => insertVar(tpl.id as any, v)} />
                                            </div>
                                            <div className="w-full md:w-64 border-l-2 border-dashed border-gray-200 pl-6">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-3">Enviar por:</label>
                                                <ChannelSelector
                                                    channels={config.messaging?.eventConfigs?.[tpl.id as keyof typeof config.messaging.eventConfigs]?.channels || []}
                                                    onChange={(newChannels) => setConfig({
                                                        ...config,
                                                        messaging: {
                                                            ...config.messaging!,
                                                            eventConfigs: {
                                                                ...config.messaging?.eventConfigs,
                                                                [tpl.id]: { channels: newChannels }
                                                            }
                                                        }
                                                    })}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}

                {/* Pilar: IDENTIDAD 🎨 */}
                {activeTab === 'identity' && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 animate-in fade-in slide-in-from-bottom-4">
                        <div className="space-y-8">
                            {/* Branding Central */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-xl font-black text-gray-800 mb-6 flex items-center gap-2">
                                    <span className="bg-blue-50 text-blue-600 p-2 rounded-lg"><Palette size={20} /></span>
                                    Branding Central
                                </h3>
                                <div className="space-y-6">
                                    <div>
                                        <label className="block text-xs font-bold text-gray-400 uppercase tracking-widest mb-2 ml-1">Nombre del Club</label>
                                        <input
                                            type="text"
                                            value={config.siteName}
                                            onChange={e => setConfig({ ...config, siteName: e.target.value })}
                                            className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-blue-500 outline-none transition font-bold text-lg"
                                        />
                                    </div>

                                    <div className="grid grid-cols-3 gap-4">
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Primario</label>
                                            <input type="color" value={config.primaryColor} onChange={e => setConfig({ ...config, primaryColor: e.target.value })} className="w-full h-12 rounded-lg cursor-pointer" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Secundario</label>
                                            <input type="color" value={config.secondaryColor} onChange={e => setConfig({ ...config, secondaryColor: e.target.value })} className="w-full h-12 rounded-lg cursor-pointer" />
                                        </div>
                                        <div>
                                            <label className="block text-[10px] font-bold text-gray-400 uppercase mb-2">Fondo</label>
                                            <input type="color" value={config.backgroundColor || '#f9fafb'} onChange={e => setConfig({ ...config, backgroundColor: e.target.value })} className="w-full h-12 rounded-lg cursor-pointer" />
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Redes Sociales y Contacto */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                                    <span className="bg-pink-50 text-pink-600 p-2 rounded-lg"><Share2 size={20} /></span>
                                    Redes y Contacto
                                </h3>
                                <div className="space-y-4">
                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <Instagram className="text-pink-500" size={20} />
                                        <input
                                            type="text"
                                            placeholder="Usuario de Instagram (ej: mipetshop)"
                                            value={config.contact?.instagram || ''}
                                            onChange={e => setConfig({ ...config, contact: { ...config.contact!, instagram: e.target.value } })}
                                            className="flex-1 bg-transparent outline-none text-sm font-medium"
                                        />
                                    </div>
                                    <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <Facebook className="text-blue-600" size={20} />
                                        <input
                                            type="text"
                                            placeholder="URL de Facebook"
                                            value={config.contact?.facebook || ''}
                                            onChange={e => setConfig({ ...config, contact: { ...config.contact!, facebook: e.target.value } })}
                                            className="flex-1 bg-transparent outline-none text-sm font-medium"
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Términos y Condiciones */}
                            <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100">
                                <h3 className="text-lg font-black text-gray-800 mb-6 flex items-center gap-2">
                                    <span className="bg-gray-100 text-gray-600 p-2 rounded-lg"><FileText size={20} /></span>
                                    Legales y Privacidad
                                </h3>
                                <textarea
                                    rows={6}
                                    className="w-full p-4 rounded-xl border-2 border-gray-100 focus:border-blue-500 outline-none transition text-xs leading-relaxed"
                                    placeholder="Escribe aquí los términos..."
                                    value={config.contact?.termsContent || ''}
                                    onChange={e => setConfig({ ...config, contact: { ...config.contact!, termsContent: e.target.value } })}
                                />
                            </div>

                                {/* Configuración de Colores Adicionales y Logo */}
                                <div className="bg-white p-8 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                                    <div className="flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
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

                                    <div className="mt-4 flex flex-wrap gap-2">
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                primaryColor: '#2563eb',
                                                secondaryColor: '#1e3a8a',
                                                backgroundColor: '#f9fafb',
                                                sectionTitleColor: '#9ca3af',
                                                linkColor: '#4a148c'
                                            })}
                                            className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-200 transition"
                                        >
                                            🎨 Reiniciar Colores por Defecto
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({
                                                ...config,
                                                carouselSpeedSeconds: 6
                                            })}
                                            className="text-[10px] font-black uppercase tracking-widest bg-gray-100 text-gray-600 px-4 py-2 rounded-xl hover:bg-gray-200 transition"
                                        >
                                            ⏱️ Resetear Velocidad Carrusel (6s)
                                        </button>
                                    </div>

                                    <div className="pt-4 border-t border-gray-100 flex flex-col md:flex-row gap-6">
                                        <div className="flex-1">
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
                                        <div className="w-full md:w-48 shrink-0">
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-medium text-gray-700">Tamaño Logo</label>
                                                <span className="text-xs font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{config.logoSize || 32}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="24"
                                                max="64"
                                                step="4"
                                                value={config.logoSize || 32}
                                                onChange={e => setConfig({ ...config, logoSize: parseInt(e.target.value) })}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-4"
                                            />
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase mt-2">
                                                <span>Chico</span>
                                                <span>Grande</span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                        </div>

                        {/* Preview Columna Derecha */}
                        <div className="sticky top-24">
                            <div className="bg-gray-900 p-4 rounded-[3rem] shadow-2xl border-[8px] border-gray-800 aspect-[9/19] max-w-[320px] mx-auto overflow-hidden relative group">
                                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-800 rounded-b-2xl z-20"></div>
                                <div className="h-full rounded-[2.2rem] overflow-hidden flex flex-col relative z-10" style={{ backgroundColor: config.backgroundColor || '#f9fafb' }}>
                                    <div className="h-16 flex items-center px-6 bg-white border-b border-gray-100">
                                        <div className="flex-1">
                                            <div className="w-20 h-3 bg-gray-100 rounded-full mb-1"></div>
                                            <span className="text-[10px] font-black uppercase tracking-tighter" style={{ color: config.primaryColor }}>{config.siteName}</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-gray-50 border border-gray-100 flex items-center justify-center text-gray-300">
                                            <User size={14} />
                                        </div>
                                    </div>
                                    <div className="p-6 space-y-4">
                                        <div className="h-24 rounded-2xl p-4 flex flex-col justify-end" style={{ backgroundImage: `linear-gradient(135deg, ${config.primaryColor}, ${config.secondaryColor})` }}>
                                            <div className="w-1/2 h-2 bg-white/20 rounded-full mb-2"></div>
                                            <div className="w-3/4 h-3 bg-white rounded-full"></div>
                                        </div>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="h-20 bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex flex-col gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center text-indigo-400"><Sparkles size={16} /></div>
                                                <div className="w-full h-2 bg-gray-100 rounded-full"></div>
                                            </div>
                                            <div className="h-20 bg-white rounded-2xl border border-gray-100 p-3 shadow-sm flex flex-col gap-2">
                                                <div className="w-8 h-8 rounded-lg bg-orange-50 flex items-center justify-center text-orange-400"><Gift size={16} /></div>
                                                <div className="w-full h-2 bg-gray-100 rounded-full"></div>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="absolute bottom-0 w-full bg-white border-t border-gray-100 flex justify-center gap-8 py-4 rounded-b-[2.2rem]">
                                        <Home size={20} style={{ color: config.primaryColor }} />
                                        <Gift size={20} className="text-gray-300" />
                                        <MessageCircle size={20} className="text-gray-300" />
                                    </div>
                                </div>
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition flex items-center justify-center z-30">
                                    <span className="text-white font-black text-xs uppercase tracking-widest bg-black/50 px-4 py-2 rounded-full border border-white/20">Vista Previa</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Pilar: CONFIGURACIÓN AVANZADA 🛠️ */}
                {activeTab === 'advanced' && (
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
                                            <p className="text-xs text-gray-500 mt-1">Activa un administrador en el menú lateral para adelantar o retrasar el tiempo. Útil para probar vencimientos.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({ ...config, enableDateSimulator: !config.enableDateSimulator })}
                                            className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableDateSimulator ? 'bg-purple-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableDateSimulator ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {/* SECCIÓN NUEVA: Control de Duplicados */}
                                    <div className="flex items-center justify-between p-6 bg-red-50/50 rounded-2xl border border-red-100">
                                        <div className="flex-1">
                                            <span className="text-sm font-black text-red-900 uppercase flex items-center gap-2">
                                                <Shield size={16} /> Control de Ejecución Diaria
                                            </span>
                                            <p className="text-[10px] text-red-600 font-bold mt-1">Evita que el motor automático envíe avisos duplicados si se ejecuta varias veces el mismo día.</p>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setConfig({ ...config, enableDuplicateControl: config.enableDuplicateControl === undefined ? true : !config.enableDuplicateControl })}
                                            className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableDuplicateControl !== false ? 'bg-red-600' : 'bg-gray-200'}`}
                                        >
                                            <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableDuplicateControl !== false ? 'translate-x-5' : 'translate-x-0'}`} />
                                        </button>
                                    </div>

                                    {/* MODULO PETSHOP: Toggle Global */}
                                    {import.meta.env.VITE_ENABLE_PET_MODULE === 'true' && (
                                        <div className="flex items-center justify-between p-6 bg-orange-50/50 rounded-2xl border border-orange-100">
                                            <div className="flex-1">
                                                <span className="text-sm font-black text-orange-900 uppercase flex items-center gap-2">
                                                    🐾 Módulo Petshop
                                                </span>
                                                <p className="text-[10px] text-orange-600 font-bold mt-1">Habilita la sección "Mis Mascotas" en el perfil del cliente y el sistema de alertas de alimento.</p>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({ ...config, enablePetModule: !config.enablePetModule })}
                                                className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enablePetModule ? 'bg-orange-600' : 'bg-gray-200'}`}
                                            >
                                                <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enablePetModule ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>
                                    )}

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
                                        <p className="text-sm text-gray-600 leading-relaxed">Define el rango horario en el que el sistema tiene permitido revisar vencimientos y enviar promociones.</p>

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
                                                    <span className="text-[10px] text-gray-500">Arranca en segundo plano al abrir este panel.</span>
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
                                                    <span className="text-sm font-bold text-gray-700 block">Ejecución en Extensión</span>
                                                    <span className="text-[10px] text-gray-500">El plugin de Chrome arranca el motor.</span>
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
                                                    <span className="text-sm font-bold text-gray-700 block">Ejecución vía QStash</span>
                                                    <span className="text-[10px] text-gray-500">Habilita llamadas externas Upstash.</span>
                                                </div>
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 text-purple-600 rounded"
                                                    checked={config.messaging?.enableQStashTrigger !== false}
                                                    onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, enableQStashTrigger: e.target.checked } })}
                                                />
                                            </label>

                                            {/* Guía QStash */}
                                            <div className="mt-4 p-5 bg-gradient-to-br from-gray-900 to-gray-800 rounded-2xl text-white">
                                                <div className="flex items-center gap-2 mb-3 text-emerald-400">
                                                    <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                                                    <span className="text-[10px] font-black uppercase tracking-widest">Configuración QStash</span>
                                                </div>
                                                <div className="space-y-3">
                                                    <div className="space-y-1">
                                                        <span className="text-[9px] text-gray-500 font-bold uppercase">Destination URL</span>
                                                        <div className="flex gap-2">
                                                            <code className="text-[10px] bg-white/10 p-2 rounded-lg flex-1 truncate">
                                                                {`${window.location.origin}/api/engine-daily?mode=daily&trigger=qstash`}
                                                            </code>
                                                            <button
                                                                onClick={() => {
                                                                    const url = `${window.location.origin}/api/engine-daily?mode=daily&trigger=qstash`;
                                                                    navigator.clipboard.writeText(url);
                                                                    toast.success("URL Copiada");
                                                                }}
                                                                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg"
                                                            >
                                                                <Settings size={14} />
                                                            </button>
                                                        </div>
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
                                    <ShieldAlert size={22} className="text-blue-500" /> Backups
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                    <button type="button" onClick={() => handleResetAction('backup')} className="flex items-center justify-center gap-2 bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white py-3 rounded-xl font-bold transition-all">
                                        <Save size={18} /> Crear Respaldo
                                    </button>
                                    <button type="button" onClick={() => handleResetAction('restore')} className="flex items-center justify-center gap-2 bg-gray-50 text-gray-600 hover:bg-black hover:text-white py-3 rounded-xl font-bold transition-all">
                                        <RefreshCw size={18} /> Restaurar Anterior
                                    </button>
                                </div>
                            </div>

                            {/* SECCIÓN RESET MAESTRO */}
                            <div className="bg-red-50/30 border-2 border-red-100 rounded-3xl p-10 space-y-8">
                                <div className="text-center space-y-2">
                                    <h3 className="text-2xl font-black text-gray-800">Reset Maestro Granular</h3>
                                    <p className="text-gray-500">Selecciona los elementos que deseas limpiar.</p>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="bg-white p-6 rounded-2xl border border-red-50 space-y-4">
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2"><Users size={18} className="text-red-500" /> Socios</h4>
                                        <div className="space-y-3">
                                            {(['socios_total', 'socios_historial', 'socios_mensajes', 'geo_total', 'transacciones_total'] as const).map(opt => (
                                                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                                    <input type="checkbox" checked={(resetOptions as any)[opt]} onChange={e => setResetOptions({ ...resetOptions, [opt]: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                    <span className="text-sm font-bold text-gray-700 group-hover:text-red-600 uppercase">{opt.replace('_', ' ')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-red-50 space-y-4">
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2"><Settings size={18} className="text-gray-600" /> Estructura</h4>
                                        <div className="space-y-3">
                                            {(['marca_total', 'gamification_total', 'prizes_total', 'campaigns_total', 'team_total', 'legales_total', 'audit_total'] as const).map(opt => (
                                                <label key={opt} className="flex items-center gap-3 cursor-pointer group">
                                                    <input type="checkbox" checked={(resetOptions as any)[opt]} onChange={e => setResetOptions({ ...resetOptions, [opt]: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-blue-600" />
                                                    <span className="text-sm font-bold text-gray-700 group-hover:text-blue-600 uppercase">{opt.replace('_', ' ')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-center gap-4 pt-6 border-t border-red-100">
                                    <button onClick={() => handleResetAction('reset')} disabled={isReadOnly} className="w-full md:w-2/3 bg-red-600 hover:bg-black text-white py-4 rounded-2xl font-black text-xl transition-all shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
                                        <Trash2 size={24} /> Ejecutar Reset
                                    </button>
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
            </form>

            <EmailPreviewModal
                isOpen={previewModal.isOpen}
                onClose={() => setPreviewModal({ ...previewModal, isOpen: false })}
                config={config}
                templateId={previewModal.templateId}
                templateTitle={previewModal.title}
                templateContent={previewModal.content}
            />
        </div>
    );
};
