import React, { useState, useEffect, useRef } from 'react';
import { Save, Plus, Trash2, Palette, Calculator, Monitor, Smartphone, Settings, Home, Gift, MessageCircle, FileText, AlertTriangle, RefreshCw, ShieldAlert, Shield, Users, Clock, Eye, Sparkles, Cake, Zap, UserPlus, Megaphone, Bell, MapPin, Download, QrCode, KeyRound, Copy, Dog, Rocket, Search, CheckCircle2 } from 'lucide-react';
import QRCode from 'react-qr-code';

console.log('RAMPET_BUILD_V2: Key fix re-applied');
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import { EmailPreviewModal } from '../components/EmailPreviewModal';
import { EmailService } from '../../../services/emailService';
import { NotificationService } from '../../../services/notificationService';
import { toast } from 'react-hot-toast';
import { GlobalAlerts } from '../components/GlobalAlerts';
import { MasterCalculatorModal } from '../components/MasterCalculatorModal';
import { MysteryBoxConfig } from '../components/MysteryBoxConfig';
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

    const resetDescriptions: Record<string, string> = {
        socios_total: "⚠️ PELIGRO: Borra a todos los usuarios, sus historiales completos y sus cuentas de acceso.",
        socios_historial: "Mantiene a los usuarios pero borra su historial de visitas, transacciones y ubicaciones.",
        socios_mensajes: "Vacia la bandeja de entrada y notificaciones push de todos los usuarios.",
        puntos_total: "Pone los puntos y saldos de todos los usuarios a 0 y borra el historial de puntos.",
        geo_total: "Borra todo el historial de ubicaciones geográficas de los usuarios.",
        transacciones_total: "Borra el registro de todas las transacciones (canjes, cargas) del sistema.",
        marca_total: "Restaura los colores y el logo a los valores por defecto.",
        gamification_total: "Restaura los valores de puntos por peso, base de dinero y bono de bienvenida.",
        prizes_total: "Borra todo el catálogo de premios.",
        campaigns_total: "Borra todas las campañas automáticas configuradas.",
        sorteos_total: "Borra todo el historial y configuración activa de las Cajas Misteriosas (Sorteos).",
        team_total: "⚠️ PELIGRO: Borra a todos los administradores y restaura la cuenta admin@admin.com por defecto.",
        contact_total: "Borra todas las redes sociales y links de contacto configurados.",
        legales_total: "Restaura los términos y condiciones al texto original.",
        audit_total: "Borra el registro de auditoría (logs de quién hizo qué)."
    };

    const { isReadOnly, user } = useAdminAuth();
    const [activeTab, setActiveTab] = useState<'rules' | 'branding' | 'messaging' | 'sorteos' | 'legales' | 'advanced'>('rules');
    const [resetOptions, setResetOptions] = useState({
        socios_total: false,
        socios_historial: false,
        socios_mensajes: false,
        puntos_total: false,
        geo_total: false,
        transacciones_total: false,
        marca_total: false,
        prizes_total: false,
        campaigns_total: false,
        sorteos_total: false,
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


    // WhatsApp Preview State
    
    
    // Efecto para vincular el click del usuario de prueba desde el HTML crudo
    useEffect(() => {
        (window as any)._selectTestUser = (idx: number) => {
            const users = (window as any)._testUsers || [];
            const user = users[idx];
            if (user) {
                (window as any)._selectedUserForTest = user;
                const resultsDiv = document.getElementById('testUserResults');
                const selectedDiv = document.getElementById('selectedTestUser');
                const selName = document.getElementById('selUserName');
                const selData = document.getElementById('selUserData');
                
                if (resultsDiv) resultsDiv.innerHTML = '';
                if (selectedDiv) selectedDiv.classList.remove('hidden');
                if (selName) selName.innerText = user.name || 'Usuario';
                if (selData) selData.innerText = (user.email || user.phone || '') + ' - ' + (user.points || 0) + ' pts';
            }
        };
    }, []);

    const [testMessageModal,
 setTestMessageModal] = useState({
        isOpen: false,
        templateKey: '',
        title: '',
        body: '',
        waBody: '',
        channels: [] as string[]
    });

    const openTestModal = (key: string, customTitle?: string) => {
        const templates = config.messaging?.templates as any;
        const events = config.messaging?.eventConfigs as any;
        const t = templates?.[key] || '';
        const title = templates?.[key + '_title'] || customTitle || '';
        const wa = templates?.[key + '_whatsapp'] || '';
        const ch = events?.[key]?.channels || [];
        setTestMessageModal({
            isOpen: true,
            templateKey: key,
            title: title,
            body: t,
            waBody: wa,
            channels: ch
        });
    };


    const [waPreview, setWaPreview] = useState({
        isOpen: false,
        content: ''
    });

    const openWaPreview = (text: string) => {
        setWaPreview({ isOpen: true, content: text });
    };

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
                    <h1 className="text-3xl font-bold text-gray-800">Configuración</h1>
                    <p className="text-gray-500 mt-1">Personaliza el funcionamiento y la apariencia de tu programa de fidelidad.</p>
                </div>
                <div className="flex bg-gray-100 p-1 rounded-xl">
                    <button
                        type="button"
                        onClick={() => setActiveTab('rules')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'rules' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Calculator size={18} />
                        Reglas del Juego
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('branding')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'branding' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Palette size={18} />
                        Identidad Visual
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('messaging')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'messaging' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <span className="text-green-500 text-lg">💬</span>
                        Mensajería
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('sorteos')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'sorteos' ? 'bg-white text-orange-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <Gift size={18} />
                        Sorteos
                    </button>
                    <button
                        type="button"
                        onClick={() => setActiveTab('legales')}
                        className={`px-5 py-2.5 rounded-lg text-sm font-bold transition flex items-center gap-2 ${activeTab === 'legales' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        <FileText size={18} />
                        Legales
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

                <MasterCalculatorModal
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
                                                    <label className="block text-sm font-semibold text-gray-700">Valor de Canje Fijo del Punto</label>
                                                    <p className="text-xs text-gray-400 mt-1">Dinero que el cliente percibe que le regalás por punto.</p>
                                                </div>
                                                <button
                                                    type="button"
                                                    onClick={() => setShowCalculator(true)}
                                                    className="flex items-center gap-2 px-3 py-1.5 bg-indigo-50 text-indigo-600 rounded-lg text-xs font-bold hover:bg-indigo-100 transition shadow-sm border border-indigo-100"
                                                >
                                                    <Calculator size={14} />
                                                    Abrir Master Calculator
                                                </button>
                                            </div>

                                            {/* Summary Card */}
                                            <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 flex justify-between items-center">
                                                <div className="flex items-end gap-2">
                                                    <span className="text-2xl font-black text-gray-800">
                                                        $ {(config.pointValue || 10).toFixed(2)}
                                                    </span>
                                                    <span className="text-sm font-bold text-gray-400 mb-1">/ punto</span>
                                                </div>
                                                <span className="text-xs font-bold px-3 py-1.5 rounded-lg bg-green-100 text-green-700 shadow-inner">
                                                    VALOR FIJO SEGURO
                                                </span>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Tarjeta de Salud de la Base - MOVILIZADA AQUÍ PARA MAYOR VISIBILIDAD */}
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
                                                    className="w-full pl-4 pr-16 py-3 bg-white rounded-xl border-orange-200 border-2 focus:border-orange-500 focus:ring-4 focus:ring-orange-50 text-orange-700 font-black text-xl text-center outline-none transition shadow-sm"
                                                />
                                                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-orange-600 text-xs font-black uppercase tracking-tighter">Días</span>
                                            </div>
                                        </div>
                                    </div>
                                    <p className="text-[10px] text-orange-400 italic px-1">
                                        * Este ajuste afecta directamente al gráfico de "Salud de la Base" en la página de métricas.
                                    </p>
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




                                                {/* NUEVO: Bono por Domicilio */}
                                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                                    <div className="flex-1">
                                                        <span className="text-sm font-bold text-gray-800">Bono por Domicilio Completo</span>
                                                        <p className="text-xs text-gray-500">Regalar puntos si el socio completa su dirección al registrarse.</p>
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => setConfig({ ...config, enableAddressBonus: !config.enableAddressBonus })}
                                                        className={`relative w-12 h-7 transition-colors rounded-full shadow-inner ${config.enableAddressBonus ? 'bg-emerald-600' : 'bg-gray-200'}`}
                                                    >
                                                        <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.enableAddressBonus ? 'translate-x-5' : 'translate-x-0'}`} />
                                                    </button>
                                                </div>

                                                {config.enableAddressBonus && (
                                                    <div className="flex items-center gap-3 animate-fade-in pl-2 border-l-2 border-emerald-200">
                                                        <input
                                                            type="number"
                                                            value={config.pointsForAddress || 50}
                                                            onChange={e => setConfig({ ...config, pointsForAddress: parseInt(e.target.value) || 0 })}
                                                            className="w-24 p-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-emerald-100 font-bold text-gray-700 text-center"
                                                        />
                                                        <span className="text-gray-500 text-sm font-medium">puntos por dirección.</span>
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

                                        {/* NUEVO: Intervalo de Refresco de la Extensión */}
                                        <div className="mt-4 pt-4 border-t border-purple-100 flex items-center justify-between">
                                            <div className="flex-1">
                                                <span className="text-sm font-bold text-gray-800">Intervalo de Sincronización</span>
                                                <p className="text-xs text-gray-500">Tiempo de espera entre actualizaciones mientras el operador trabaja.</p>
                                            </div>
                                            <div className="relative flex items-center gap-2">
                                                <input
                                                    type="number"
                                                    min="1"
                                                    max="60"
                                                    value={config.extensionRefreshInterval || 2}
                                                    onChange={e => setConfig({ ...config, extensionRefreshInterval: parseInt(e.target.value) || 1 })}
                                                    className="w-20 p-2 bg-white rounded-lg border-purple-200 border-2 focus:border-purple-500 text-purple-700 font-bold text-center outline-none transition"
                                                />
                                                <span className="text-xs font-bold text-purple-600 uppercase">Min.</span>
                                            </div>
                                        </div>

                                        <p className="text-[10px] text-purple-400 mt-3 italic">
                                            * Esta opción controla si el servidor procesa puntos enviados desde herramientas externas como el facturador.
                                        </p>

                                        <div className="mt-6 pt-6 border-t border-purple-100">
                                            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                                                <div>
                                                    <span className="text-sm font-bold text-gray-800 block">Extensión para Navegador</span>
                                                    <p className="text-xs text-gray-500 max-w-md mt-1">
                                                        Usa nuestro <b>Integrador de Beneficios</b> para capturar montos de Rappi, UberEats y otros facturadores automáticamente.
                                                    </p>
                                                </div>
                                                <a 
                                                    href="/download/Integrador_Beneficios_V1.89.zip" 
                                                    download 
                                                    className="flex items-center gap-2 px-6 py-3 bg-purple-600 text-white rounded-xl font-bold shadow-lg shadow-purple-200 hover:bg-purple-700 hover:scale-105 transition-all active:scale-95 shrink-0"
                                                >
                                                    <Download size={20} />
                                                    Descargar Extensión
                                                </a>
                                            </div>

                                            <div className="mt-4 bg-white/50 p-4 rounded-xl border border-purple-100">
                                                <h4 className="text-[10px] font-black text-purple-600 uppercase tracking-widest mb-3">Guía de Instalación Rápida:</h4>
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="flex gap-3">
                                                        <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">1</span>
                                                        <p className="text-[11px] text-gray-600 leading-tight"><b>Descargá y descomprimí</b> el archivo .ZIP en una carpeta de tu PC (ej: Documentos).</p>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">2</span>
                                                        <p className="text-[11px] text-gray-600 leading-tight">En Chrome, entrá a <b>chrome://extensions</b> y activá el <b>Modo desarrollador</b> (arriba-derecha).</p>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">3</span>
                                                        <p className="text-[11px] text-gray-600 leading-tight">Tocá en <b>Cargar descomprimida</b> y seleccioná la carpeta que acabas de extraer.</p>
                                                    </div>
                                                    <div className="flex gap-3">
                                                        <span className="w-5 h-5 bg-purple-100 text-purple-600 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0">4</span>
                                                        <p className="text-[11px] text-gray-600 leading-tight">Abrí la extensión y configurá la <b>API URL</b> con la dirección de este sitio.</p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="mt-8 pt-6 border-t border-purple-100">
                                                <div className="flex items-center gap-2 mb-4">
                                                    <div className="bg-purple-100 p-1.5 rounded-lg text-purple-600">
                                                        <KeyRound size={16} />
                                                    </div>
                                                    <h4 className="text-sm font-black text-gray-800 uppercase tracking-tight">Credenciales de Conexión</h4>
                                                </div>
                                                
                                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                                    <div className="bg-white/50 p-4 rounded-xl border border-purple-100">
                                                        <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest block mb-2">Paso 1: Configurar API URL</label>
                                                        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-50 group">
                                                            <code className="text-[11px] text-gray-600 flex-1 truncate font-mono">
                                                                {window.location.origin}
                                                            </code>
                                                            <button 
                                                                onClick={() => {
                                                                    navigator.clipboard.writeText(window.location.origin);
                                                                    toast.success("URL de API copiada", { icon: '🔗' });
                                                                }}
                                                                className="p-2 hover:bg-purple-50 rounded-lg text-purple-600 transition-all active:scale-90"
                                                                title="Copiar URL"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                        </div>
                                                        <p className="text-[9px] text-gray-400 mt-2 italic">Pegar este valor en "API URL" dentro de la extensión.</p>
                                                    </div>

                                                    <div className="bg-white/50 p-4 rounded-xl border border-purple-100">
                                                        <label className="text-[10px] font-black text-purple-600 uppercase tracking-widest block mb-2">Paso 2: Configurar API Key</label>
                                                        <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-purple-50 group">
                                                            <code className="text-[11px] text-gray-600 flex-1 truncate font-mono">
                                                                {import.meta.env.VITE_API_KEY || "Llave Secreta no encontrada"}
                                                            </code>
                                                            <button 
                                                                onClick={() => {
                                                                    const apiKey = import.meta.env.VITE_API_KEY || "";
                                                                    navigator.clipboard.writeText(apiKey);
                                                                    toast.success("API Key copiada", { icon: '🔑' });
                                                                }}
                                                                className="p-2 hover:bg-purple-50 rounded-lg text-purple-600 transition-all active:scale-90"
                                                                title="Copiar API Key"
                                                            >
                                                                <Copy size={14} />
                                                            </button>
                                                        </div>
                                                        <p className="text-[9px] text-gray-400 mt-2 italic">Pegar este valor en "API Key" dentro de la extensión.</p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
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

                {
                    activeTab === 'sorteos' && (
                        <MysteryBoxConfig config={config} setConfig={setConfig} />
                    )
                }

                {
                    activeTab === 'legales' && (
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

                                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-2">
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Tipografía</label>
                                            <select
                                                value={config.siteNameFont || 'Inter'}
                                                onChange={e => setConfig({ ...config, siteNameFont: e.target.value })}
                                                className="w-full rounded-lg border-gray-200 border p-3 focus:ring-2 focus:ring-blue-100 outline-none transition"
                                            >
                                                <option value="Inter">Inter (Sanz)</option>
                                                <option value="Roboto">Roboto</option>
                                                <option value="Montserrat">Montserrat</option>
                                                <option value="Playfair Display">Playfair Display (Serif)</option>
                                                <option value="Outfit">Outfit</option>
                                                <option value="system-ui">Sistema</option>
                                            </select>
                                        </div>

                                        <div>
                                            <div className="flex justify-between items-center mb-2">
                                                <label className="block text-sm font-medium text-gray-700">Tamaño de Letra</label>
                                                <span className="text-xs font-black bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{config.siteNameSize || 14}px</span>
                                            </div>
                                            <input
                                                type="range"
                                                min="10"
                                                max="24"
                                                step="1"
                                                value={config.siteNameSize || 14}
                                                onChange={e => setConfig({ ...config, siteNameSize: parseInt(e.target.value) })}
                                                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600 mt-4"
                                            />
                                            <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase mt-2">
                                                <span>Chica</span>
                                                <span>Grande</span>
                                            </div>
                                        </div>

                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-2">Alineación</label>
                                            <div className="flex p-1 bg-gray-100 rounded-xl">
                                                {(['left', 'center', 'right'] as const).map((align) => (
                                                    <button
                                                        key={align}
                                                        type="button"
                                                        onClick={() => setConfig({ ...config, siteNameAlignment: align })}
                                                        className={`flex-1 py-2 rounded-lg text-xs font-bold uppercase tracking-widest transition-all ${config.siteNameAlignment === align ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400 hover:text-gray-600'
                                                            }`}
                                                    >
                                                        {align === 'left' ? 'Izq' : align === 'center' ? 'Centro' : 'Der'}
                                                    </button>
                                                ))}
                                            </div>
                                        </div>
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

                                    <div className="pt-4 border-t border-gray-100">
                                        <div className="flex justify-between items-center mb-2">
                                            <label className="block text-sm font-bold text-gray-700">Velocidad del Carrusel</label>
                                            <span className="text-xs font-black bg-blue-50 text-blue-600 px-2.5 py-1 rounded-full">{config.carouselSpeedSeconds || 6} segundos</span>
                                        </div>
                                        <p className="text-[10px] text-gray-400 mb-3 italic">Controla qué tan rápido rotan las campañas en la página principal del cliente.</p>
                                        <input
                                            type="range"
                                            min="2"
                                            max="15"
                                            step="1"
                                            value={config.carouselSpeedSeconds || 6}
                                            onChange={e => setConfig({ ...config, carouselSpeedSeconds: parseInt(e.target.value) })}
                                            className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                        />
                                        <div className="flex justify-between text-[9px] text-gray-400 font-bold uppercase mt-1.5 px-1">
                                            <span>🔥 Rápido (2s)</span>
                                            <span>🧘 Lento (15s)</span>
                                        </div>
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
                                            <div className="col-span-full bg-blue-50/30 p-4 rounded-xl border border-blue-100/50">
                                                <div className="flex flex-col md:flex-row gap-6 items-start">
                                                    <div className="flex-1 w-full">
                                                        <label className="block text-xs font-black text-blue-900 uppercase tracking-tighter mb-2">URL de la App (Bandera Blanca)</label>
                                                        <input
                                                            type="url"
                                                            placeholder="https://tu-dominio.com"
                                                            value={config.contact?.pwaUrl || ''}
                                                            onChange={e => setConfig({
                                                                ...config,
                                                                contact: { ...config.contact!, pwaUrl: e.target.value }
                                                            })}
                                                            className="w-full rounded-lg border-blue-200 border p-3 text-sm focus:ring-2 focus:ring-blue-100 outline-none bg-white font-bold"
                                                        />
                                                        <p className="text-[10px] text-blue-600 mt-2 font-medium italic">
                                                            ⚠️ Esta URL es la que se usará para generar el QR de auto-registro y los links en los correos.
                                                        </p>
                                                    </div>
                                                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex flex-col items-center gap-4 self-center md:self-start">
                                                        <div id="qr-code-container" className="bg-white p-3 rounded-xl">
                                                              <QRCode 
                                                                value={`${config.contact?.pwaUrl || window.location.origin}/register`} 
                                                                size={140}
                                                                style={{ height: "auto", maxWidth: "100%" }}
                                                                viewBox={`0 0 140 140`}
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => {
                                                                const svg = document.querySelector("#qr-code-container svg") as SVGGraphicsElement;
                                                                if (!svg) return;
                                                                const svgData = new XMLSerializer().serializeToString(svg);
                                                                const canvas = document.createElement("canvas");
                                                                const ctx = canvas.getContext("2d");
                                                                const img = new Image();
                                                                img.onload = () => {
                                                                    canvas.width = 600;
                                                                    canvas.height = 600;
                                                                    if (ctx) {
                                                                        ctx.fillStyle = "white";
                                                                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                                                                        ctx.drawImage(img, 0, 0, 600, 600);
                                                                    }
                                                                    const pngFile = canvas.toDataURL("image/png");
                                                                    const downloadLink = document.createElement("a");
                                                                    downloadLink.download = `QR-${config.siteName}.png`;
                                                                    downloadLink.href = pngFile;
                                                                    downloadLink.click();
                                                                };
                                                                img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
                                                            }}
                                                            className="flex items-center gap-2 px-3 py-1.5 bg-gray-900 text-white rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-black transition-colors"
                                                        >
                                                            <Download size={14} /> Descargar QR
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                </div>

                             {/* Vista Previa Móvil (Columna 2) */}
                            <div className="flex flex-col items-center justify-start pt-8">
                                <div
                                    className="border-[8px] border-gray-900 rounded-[3rem] overflow-hidden w-80 shadow-2xl relative h-[600px] transition-colors duration-500"
                                    style={{ backgroundColor: config.backgroundColor || '#f9fafb' }}
                                >
                                    {/* Notch */}
                                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-gray-900 rounded-b-xl z-20"></div>

                                    {/* Header Mock */}
                                    <div
                                        className="px-4 pt-12 h-24 text-white flex items-center gap-2 transition-all duration-500 overflow-hidden"
                                        style={{ backgroundColor: config.primaryColor }}
                                    >
                                        <div className="w-12 shrink-0 flex items-center justify-center">
                                            {config.logoUrl ? (
                                                <img
                                                    src={config.logoUrl}
                                                    alt="Logo"
                                                    className="rounded-full object-contain bg-white shrink-0 shadow-sm"
                                                    style={{ width: `${config.logoSize || 32}px`, height: `${config.logoSize || 32}px` }}
                                                />
                                            ) : (
                                                <div
                                                    className="bg-white/20 rounded-full flex items-center justify-center text-[10px] shrink-0"
                                                    style={{ width: `${config.logoSize || 32}px`, height: `${config.logoSize || 32}px` }}
                                                >
                                                    Logo
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex-1 min-w-0">
                                            <span
                                                style={{
                                                    fontFamily: config.siteNameFont,
                                                    fontSize: `${config.siteNameSize || 14}px`,
                                                    textAlign: config.siteNameAlignment || 'center',
                                                    fontWeight: '800',
                                                    textTransform: 'uppercase',
                                                    letterSpacing: '0.05em',
                                                    display: 'block'
                                                }}
                                                className="w-full"
                                            >
                                                {config.siteName}
                                            </span>
                                        </div>

                                        <div className="w-12 shrink-0"></div> {/* Spacer to maintain center/balance */}
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

                                    {/* Simulated Content / Carousel Preview */}
                                    <div className="flex-1 overflow-y-auto px-4 py-6 space-y-6 scrollbar-hide">
                                        <div className="space-y-2">
                                            <div className="flex justify-between items-center px-1">
                                                <div className="w-20 h-2 bg-gray-200 rounded-full"></div>
                                                <div className="w-8 h-2 bg-indigo-200 rounded-full"></div>
                                            </div>

                                            {/* PREVIEW CAROUSEL */}
                                            <div className="relative group">
                                                <div className="aspect-[16/9] rounded-2xl overflow-hidden bg-gray-100 relative shadow-inner border border-gray-50">
                                                    <div className="absolute inset-0 flex items-center justify-center">
                                                        <div className="flex flex-col items-center gap-2">
                                                            <div className="w-8 h-8 rounded-full bg-indigo-50 flex items-center justify-center text-indigo-400">
                                                                <Sparkles size={16} className="animate-pulse" />
                                                            </div>
                                                            <span className="text-[10px] font-black text-indigo-400 uppercase tracking-widest">Vista Previa Carrusel</span>
                                                        </div>
                                                    </div>

                                                    {/* Animated Bar representing the cycle */}
                                                    <div className="absolute bottom-0 left-0 h-1 bg-indigo-500 shadow-[0_0_10px_rgba(99,102,241,0.5)]"
                                                        style={{
                                                            width: '100%',
                                                            animation: `carousel-progress ${config.carouselSpeedSeconds || 5}s linear infinite`
                                                        }}
                                                    ></div>
                                                </div>
                                                <div className="flex justify-center gap-1 mt-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-indigo-500"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-gray-200"></div>
                                                </div>
                                            </div>
                                        </div>

                                        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-50 flex gap-4 items-center">
                                            <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center text-indigo-400 shrink-0">
                                                <Sparkles size={24} />
                                            </div>
                                            <div className="flex-1 space-y-2">
                                                <div className="w-2/3 h-2 bg-gray-100 rounded-full"></div>
                                                <div className="w-full h-2 bg-gray-50 rounded-full"></div>
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

                            {/* 2. PWA PERMISSIONS & CONTEXTUAL REINFORCEMENT */}
                            <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
                                <h3 className="text-lg font-bold text-gray-800 mb-6 flex items-center gap-2">
                                    <Bell size={20} className="text-purple-600" /> Permisos y Refuerzo Contextual (PWA)
                                </h3>

                                <div className="space-y-6">
                                    {/* 1. RE-INTENTO (Standby) */}
                                    <div className="bg-purple-50/30 p-6 rounded-2xl border border-purple-100/50">
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-full bg-purple-100 flex items-center justify-center text-purple-600">
                                                    <Bell size={20} />
                                                </div>
                                                <div>
                                                    <h4 className="font-black text-gray-800 uppercase tracking-tighter">RE-INTENTO DE PERMISOS PWA</h4>
                                                    <p className="text-xs text-gray-500">Volver a mostrar carteles si el cliente eligió "Quizás Luego".</p>
                                                </div>
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => setConfig({
                                                    ...config,
                                                    messaging: {
                                                        ...config.messaging!,
                                                        enablePermissionPromptRepetition: !config.messaging?.enablePermissionPromptRepetition
                                                    }
                                                })}
                                                className={`relative w-12 h-7 transition-colors rounded-full ${config.messaging?.enablePermissionPromptRepetition ? 'bg-purple-600' : 'bg-gray-200'}`}
                                            >
                                                <span className={`absolute top-1 left-1 bg-white w-5 h-5 rounded-full shadow-sm transition-transform ${config.messaging?.enablePermissionPromptRepetition ? 'translate-x-5' : 'translate-x-0'}`} />
                                            </button>
                                        </div>

                                        <div className="bg-white p-4 rounded-xl border border-purple-100 flex items-center gap-6">
                                            <div className="w-24 h-16 bg-purple-50/50 rounded-lg border border-purple-100 flex items-center justify-center">
                                                <input
                                                    type="number"
                                                    min="1" max="365"
                                                    value={config.messaging?.notificationPromptIntervalDays || 30}
                                                    onChange={e => setConfig({
                                                        ...config,
                                                        messaging: { ...config.messaging!, notificationPromptIntervalDays: parseInt(e.target.value) || 30 }
                                                    })}
                                                    className="w-full bg-transparent text-center font-black text-2xl text-purple-600 outline-none"
                                                />
                                            </div>
                                            <div>
                                                <span className="font-bold text-gray-800 block">Días para volver a preguntar.</span>
                                                <p className="text-[10px] text-gray-400 leading-tight">Días de silencio antes de volver a molestar con el cartel de Notificaciones o Beneficios Locales.</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 2. LARGE PROMPT (Phase 1) */}
                                    <div className="bg-white p-6 rounded-2xl border border-gray-100 shadow-sm space-y-4">
                                        <div className="flex items-center gap-3 mb-2">
                                            <div className="w-10 h-10 rounded-full bg-purple-50 flex items-center justify-center text-purple-500">
                                                <Bell size={20} />
                                            </div>
                                            <div>
                                                <h4 className="font-black text-gray-800 uppercase tracking-tighter">CONFIGURACIÓN DE CARTELES PWA</h4>
                                                <p className="text-xs text-gray-500">Límites y tiempos para mostrar los avisos a los clientes.</p>
                                            </div>
                                        </div>

                                        {/* Card 3: Limits & Mobile Cooldown */}
                                        <div className="p-4 bg-blue-50/50 rounded-xl border border-dashed border-blue-200 space-y-4">
                                            <div className="grid grid-cols-2 gap-4">
                                                <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Máx. Intentos PC</label>
                                                    <input
                                                        type="number" min="1" max="10"
                                                        value={config.messaging?.maxLargePromptDismissalsPC || 2}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, maxLargePromptDismissalsPC: parseInt(e.target.value) || 2 } })}
                                                        className="w-full px-2 py-1 text-center font-bold bg-gray-50 border border-gray-100 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>
                                                <div className="bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Máx. Intentos Celular</label>
                                                    <input
                                                        type="number" min="1" max="10"
                                                        value={config.messaging?.maxLargePromptDismissalsMobile || 2}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, maxLargePromptDismissalsMobile: parseInt(e.target.value) || 2 } })}
                                                        className="w-full px-2 py-1 text-center font-bold bg-gray-50 border border-gray-100 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                    />
                                                </div>
                                            </div>

                                            <div className="pt-2 border-t border-blue-100/50">
                                                <div className="flex items-center gap-3 mb-3">
                                                    <Clock size={16} className="text-blue-400" />
                                                    <div>
                                                        <span className="text-xs font-bold text-gray-600 block leading-tight">Cooldown para Celulares (Programado)</span>
                                                        <span className="text-[9px] text-gray-400 uppercase tracking-tighter text-balance leading-none">Tiempo de espera tras elegir "Quizás luego"</span>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-4 bg-white p-3 rounded-lg border border-blue-100 shadow-sm">
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Horas</label>
                                                        <input
                                                            type="number" min="0" max="720"
                                                            value={Math.floor(config.messaging?.mobileCooldownHours || 0)}
                                                            onChange={e => {
                                                                const h = parseInt(e.target.value) || 0;
                                                                const current = config.messaging?.mobileCooldownHours || 0;
                                                                const m = (current - Math.floor(current)) * 60;
                                                                setConfig({ ...config, messaging: { ...config.messaging!, mobileCooldownHours: h + (m / 60) } });
                                                            }}
                                                            className="w-full px-2 py-1 text-center font-bold bg-gray-50 border border-gray-100 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Minutos</label>
                                                        <input
                                                            type="number" min="0" max="59"
                                                            value={Math.floor(((config.messaging?.mobileCooldownHours || 0) - Math.floor(config.messaging?.mobileCooldownHours || 0)) * 60)}
                                                            onChange={e => {
                                                                const m = parseInt(e.target.value) || 0;
                                                                const h = Math.floor(config.messaging?.mobileCooldownHours || 0);
                                                                setConfig({ ...config, messaging: { ...config.messaging!, mobileCooldownHours: h + (m / 60) } });
                                                            }}
                                                            className="w-full px-2 py-1 text-center font-bold bg-gray-50 border border-gray-100 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                        />
                                                    </div>
                                                    <div className="flex-1">
                                                        <label className="block text-[10px] font-bold text-gray-400 uppercase mb-1">Segundos</label>
                                                        <input
                                                            type="number" min="0" max="59"
                                                            value={Math.round(((((config.messaging?.mobileCooldownHours || 0) - Math.floor(config.messaging?.mobileCooldownHours || 0)) * 60) - Math.floor(((config.messaging?.mobileCooldownHours || 0) - Math.floor(config.messaging?.mobileCooldownHours || 0)) * 60)) * 60)}
                                                            onChange={e => {
                                                                const s = parseInt(e.target.value) || 0;
                                                                const current = config.messaging?.mobileCooldownHours || 0;
                                                                const h = Math.floor(current);
                                                                const m = Math.floor((current - h) * 60);
                                                                setConfig({ ...config, messaging: { ...config.messaging!, mobileCooldownHours: h + (m / 60) + (s / 3600) } });
                                                            }}
                                                            className="w-full px-2 py-1 text-center font-bold bg-gray-50 border border-gray-100 rounded outline-none focus:ring-1 focus:ring-blue-500 text-sm"
                                                        />
                                                    </div>
                                                </div>
                                                <p className="text-[10px] text-blue-600 mt-2 font-medium italic">
                                                    Si el cliente elige "Quizás luego", esta configuración determina cuánto tiempo debe pasar para volver a preguntar.
                                                    Total decimal: {(config.messaging?.mobileCooldownHours || 0).toFixed(4)} hs.
                                                </p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* 3. PWA INSTALLATION MOMENTS (Removed) */}

                                </div>
                            </div>


                            {/* 3. SPECIFIC SETTINGS (WhatsApp Number) */}
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

                            {/* WhatsApp Preview Modal */}
                            {waPreview.isOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setWaPreview({ ...waPreview, isOpen: false })}>
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                                    <div className="relative bg-[#0a1929] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="bg-[#128C7E] px-5 py-4 flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-lg">&#128100;</div>
                                            <div>
                                                <div className="text-white font-bold text-sm">Vista Previa WhatsApp</div>
                                                <div className="text-green-200 text-xs">En línea</div>
                                            </div>
                                            <button onClick={() => setWaPreview({ ...waPreview, isOpen: false })} className="ml-auto text-white/70 hover:text-white text-xl">✕</button>
                                        </div>
                                        <div className="p-5 min-h-[120px] bg-[#0d2137]">
                                            <div className="bg-[#1a3a2a] rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] shadow-md">
                                                <p className="text-[#e8f5e9] text-sm whitespace-pre-wrap leading-relaxed">
                                                    {waPreview.content
                                                        .replace(/{nombre}/g, 'María')
                                                        .replace(/{nombre_completo}/g, 'María García')
                                                        .replace(/{puntos}/g, '350')
                                                        .replace(/{saldo}/g, '350')
                                                        .replace(/{siteName}/g, config.siteName || 'El Club')
                                                        .replace(/{premio}/g, 'Café Gratis')
                                                        .replace(/{codigo}/g, 'ABC-123')
                                                        .replace(/{fecha}/g, '31/12/2025')
                                                        .replace(/{amigo}/g, 'Luis')
                                                        .replace(/{mascota}/g, 'Lola')
                                                        .replace(/{marca}/g, 'Royal Canin')
                                                        .replace(/{titulo}/g, 'Gran Promo')
                                                        .replace(/{descripcion}/g, 'Doble puntos')
                                                        .replace(/{detalle}/g, '2x1 en todo')
                                                        .replace(/{vencimiento}/g, '31/12/2025')
                                                        .replace(/{horario}/g, '20:00')
                                                    }
                                                </p>
                                                <div className="text-right text-[10px] text-green-300/60 mt-1">✓✓ 10:30</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* GESTOR DE MENSAJES */}
                            <div className="mt-8 space-y-6">

                                {/* SECCIÓN A: CAMPAÑAS MASIVAS */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4">
                                        <h3 className="text-white font-black text-base flex items-center gap-2">⚡ Campañas Masivas</h3>
                                        <p className="text-orange-100 text-xs mt-1">Mensajes de difusión manual para promociones y eventos especiales.</p>
                                    </div>
                                    <div className="divide-y divide-gray-50">

                                        {/* FLASH OFFER */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">⚡</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Oferta Flash</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Para campañas urgentes. Se usa automáticamente en campañas marcadas como "Flash".</p>
                                                </div>
                                                <span className="ml-auto text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold uppercase">Urgente</span>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título (Asunto Email / Título Push)</label>
                                                    <input type="text"
                                                        value={config.messaging?.templates?.flashOffer_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer_title: e.target.value } } })}
                                                        placeholder="⚡ ¡OFERTA FLASH! {titulo}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-yellow-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal (Email / Push)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.flashOffer || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.flashOffer}
                                                            className="w-full px-3 py-2 rounded-lg border border-yellow-200 focus:ring-2 focus:ring-yellow-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer: DEFAULT_TEMPLATES.flashOffer } } })} className="px-2 py-1.5 text-gray-400 hover:text-yellow-600 rounded hover:bg-yellow-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('flashOffer')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('flashOffer')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'titulo', 'detalle', 'hora_inicio', 'horario']} onSelect={v => insertVar('flashOffer', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional, si difiere)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.flashOffer_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal. Aprovechá *negritas* y _cursivas_."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.flashOffer_whatsapp || config.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.offer?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, offer: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* OFERTA ESPECIAL */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🏷️</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Oferta Especial</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Promociones con vencimiento. Se usa para campañas tipo "Oferta".</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.offer_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer_title: e.target.value } } })}
                                                        placeholder="🔥 ¡Oferta Especial! {titulo}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.offer || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.offer}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer: DEFAULT_TEMPLATES.offer } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('offer')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('offer')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'titulo', 'detalle', 'vencimiento']} onSelect={v => insertVar('offer', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.offer_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.offer_whatsapp || config.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.offer?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, offer: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* CAMPAÑA */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🚀</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Nueva Campaña (Promo Manual)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Mensaje de difusión general para campañas sin urgencia.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.campaign_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign_title: e.target.value } } })}
                                                        placeholder="🚀 ¡Nueva Campaña! {titulo}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.campaign || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.campaign}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign: DEFAULT_TEMPLATES.campaign } } })} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('campaign')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('campaign')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'titulo', 'descripcion']} onSelect={v => insertVar('campaign', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.campaign_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.campaign_whatsapp || config.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.campaign?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, campaign: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                {/* SECCIÓN B: EVENTOS AUTOMÁTICOS */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
                                        <h3 className="text-white font-black text-base flex items-center gap-2">🤖 Eventos Automáticos</h3>
                                        <p className="text-blue-100 text-xs mt-1">Mensajes disparados automáticamente por el sistema según reglas configuradas.</p>
                                    </div>
                                    <div className="divide-y divide-gray-50">

                                        {/* SUMA DE PUNTOS */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🌟</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Suma de Puntos (Compra)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al cliente cada vez que acumula puntos por una compra.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.pointsAdded_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded_title: e.target.value } } })}
                                                        placeholder="🎉 ¡Sumaste puntos en {siteName}!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.pointsAdded || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.pointsAdded}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded: DEFAULT_TEMPLATES.pointsAdded } } })} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('pointsAdded')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('pointsAdded')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'puntos', 'saldo']} onSelect={v => insertVar('pointsAdded', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.pointsAdded_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.pointsAdded_whatsapp || config.messaging?.templates?.pointsAdded || DEFAULT_TEMPLATES.pointsAdded)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.pointsAdded?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, pointsAdded: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* CANJE */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🎁</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Canje de Premio</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Confirmación automática cuando un cliente canjea un premio.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.redemption_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption_title: e.target.value } } })}
                                                        placeholder="🎁 ¡Canje confirmado!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.redemption || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.redemption}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption: DEFAULT_TEMPLATES.redemption } } })} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('redemption')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('redemption')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'premio', 'codigo']} onSelect={v => insertVar('redemption', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.redemption_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.redemption_whatsapp || config.messaging?.templates?.redemption || DEFAULT_TEMPLATES.redemption)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.redemption?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, redemption: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* CUMPLEAÑOS */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🎂</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Cumpleaños</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía el día del cumpleaños. El sistema elige con o sin puntos según configuración.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.birthday_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday_title: e.target.value } } })}
                                                        placeholder="🎂 ¡Feliz Cumpleaños {nombre}!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo CON Regalo (Puntos)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.birthday || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.birthday}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday: DEFAULT_TEMPLATES.birthday } } })} className="px-2 py-1.5 text-gray-400 hover:text-pink-600 rounded hover:bg-pink-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('birthday')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('birthday')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'puntos']} onSelect={v => insertVar('birthday', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B2. Cuerpo SIN Regalo (Solo Saludo)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.birthdaySimple || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthdaySimple: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.birthdaySimple}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthdaySimple: DEFAULT_TEMPLATES.birthdaySimple } } })} className="px-2 py-1.5 text-gray-400 hover:text-pink-600 rounded hover:bg-pink-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('birthdaySimple')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('birthdaySimple')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo']} onSelect={v => insertVar('birthdaySimple', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.birthday_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal. Ej: ¡Feliz cumple *{nombre}*! 🎂"
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.birthday_whatsapp || config.messaging?.templates?.birthday || DEFAULT_TEMPLATES.birthday)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.birthday?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, birthday: { channels: ch } } } })} />
                                                <p className="text-[10px] text-gray-400 mt-2 italic">* El sistema detecta automáticamente si enviar el mensaje con o sin puntos según la configuración de "Reglas del Juego".</p>
                                            </div>
                                        </div>

                                        {/* BIENVENIDA */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">👋</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Bienvenida (Nuevo Cliente)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al completar el registro en la PWA.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.welcome_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome_title: e.target.value } } })}
                                                        placeholder="👋 ¡Bienvenido a {siteName}!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.welcome || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.welcome}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome: DEFAULT_TEMPLATES.welcome } } })} className="px-2 py-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('welcome')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('welcome')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'puntos', 'socio', 'dni']} onSelect={v => insertVar('welcome', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.welcome_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.welcome_whatsapp || config.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.welcome?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, welcome: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* VENCIMIENTO */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">⚠️</span>
                                                    <div>
                                                        <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Aviso de Vencimiento</h4>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">Alerta enviada antes del vencimiento de puntos.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                        <span>Avisar</span>
                                                        <input type="number" min="1" max="90" value={config.messaging?.expirationWarningDays || 7}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, expirationWarningDays: parseInt(e.target.value) || 7 } })}
                                                            className="w-12 bg-transparent border-b border-gray-300 text-center font-bold focus:border-orange-500 outline-none text-orange-600"
                                                        />
                                                        <span>días antes</span>
                                                    </div>
                                                    <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, enableExpirationWarnings: !config.messaging?.enableExpirationWarnings } })}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.messaging?.enableExpirationWarnings ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${config.messaging?.enableExpirationWarnings ? 'translate-x-5' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                            {config.messaging?.enableExpirationWarnings && (
                                            <div className="grid gap-3 animate-fade-in">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.expirationWarning_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning_title: e.target.value } } })}
                                                        placeholder="⏳ Tus puntos están por vencer"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.expirationWarning || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.expirationWarning}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning: DEFAULT_TEMPLATES.expirationWarning } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('expirationWarning')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('expirationWarning')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'puntos', 'fecha']} onSelect={v => insertVar('expirationWarning', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.expirationWarning_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.expirationWarning_whatsapp || config.messaging?.templates?.expirationWarning || DEFAULT_TEMPLATES.expirationWarning)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                                <div className="pt-2">
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                    <ChannelSelector channels={config.messaging?.eventConfigs?.expirationWarning?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, expirationWarning: { channels: ch } } } })} />
                                                </div>
                                                <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-orange-900">🔁 Itinerancia de Avisos</h4>
                                                        <p className="text-[10px] text-orange-700/70 leading-tight mt-0.5">Repetir notificaciones aunque no haya cambios en puntos.</p>
                                                    </div>
                                                    <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, repeatExpirationWarnings: !config.messaging?.repeatExpirationWarnings } })}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.messaging?.repeatExpirationWarnings ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${config.messaging?.repeatExpirationWarnings ? 'translate-x-5' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                                {config.messaging?.repeatExpirationWarnings && (
                                                    <div className="ml-4 p-3 bg-white rounded-lg border border-orange-100 animate-fade-in">
                                                        <label className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-orange-800 whitespace-nowrap">Recordar cada</span>
                                                            <input type="number" min={0} max={30} value={config.messaging?.expirationReminderIntervalDays ?? 5}
                                                                onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, expirationReminderIntervalDays: parseInt(e.target.value) || 0 } })}
                                                                className="w-14 px-2 py-1 text-center text-xs font-bold border border-orange-200 rounded focus:outline-none"
                                                            />
                                                            <span className="text-xs text-orange-700">días</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                            )}
                                        </div>

                                        {/* ALIMENTO (Pet Module) */}
                                        {config.enablePetModule && (
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🐶</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Aviso de Alimento (Módulo Mascotas)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Recordatorio automático cuando le queda poco alimento a la mascota.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.petFoodAlert_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert_title: e.target.value } } })}
                                                        placeholder="🐾 Recordatorio de alimento para {mascota}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petFoodAlert || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.petFoodAlert}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert: DEFAULT_TEMPLATES.petFoodAlert } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('petFoodAlert')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('petFoodAlert')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('petFoodAlert')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'mascota', 'marca']} onSelect={v => insertVar('petFoodAlert', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petFoodAlert_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.petFoodAlert_whatsapp || config.messaging?.templates?.petFoodAlert || DEFAULT_TEMPLATES.petFoodAlert)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                    <ChannelSelector channels={config.messaging?.eventConfigs?.petFoodAlert?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, petFoodAlert: { channels: ch } } } })} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-orange-700 uppercase tracking-widest mb-1">Anticipación de Aviso</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="number" value={config.petFoodAlertLeadDays || 0} onChange={e => setConfig({ ...config, petFoodAlertLeadDays: parseInt(e.target.value) || 0 })} className="w-16 p-2 bg-white rounded-lg border border-orange-100 text-sm font-bold outline-none" min="0" max="15" />
                                                        <span className="text-xs text-gray-500">días antes de agotarse</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        )}

                                        {/* PIEDRAS SANITARIAS (Pet Module) */}
                                        {config.enablePetModule && (
                                        <div className="p-6 space-y-4 border-t border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">💨</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Aviso de Piedras Sanitarias (Solo Gatos)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Recordatorio automático cuando deben estar por terminarse las piedras.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.petLitterAlert_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert_title: e.target.value } } })}
                                                        placeholder="💨 Reposición de piedras para {mascota}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petLitterAlert ?? DEFAULT_TEMPLATES.petLitterAlert}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.petLitterAlert}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert: DEFAULT_TEMPLATES.petLitterAlert } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'mascota']} onSelect={v => insertVar('petLitterAlert', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petLitterAlert_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.petLitterAlert_whatsapp || config.messaging?.templates?.petLitterAlert || DEFAULT_TEMPLATES.petLitterAlert)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                    <ChannelSelector channels={config.messaging?.eventConfigs?.petLitterAlert?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, petLitterAlert: { channels: ch } } } })} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-orange-700 uppercase tracking-widest mb-1">Anticipación de Aviso</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="number" value={config.petLitterAlertLeadDays ?? config.petFoodAlertLeadDays ?? 0} onChange={e => setConfig({ ...config, petLitterAlertLeadDays: parseInt(e.target.value) || 0 })} className="w-16 p-2 bg-white rounded-lg border border-orange-100 text-sm font-bold outline-none" min="0" max="15" />
                                                        <span className="text-xs text-gray-500">días antes de agotarse</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        )}

                                    </div>
                                </div>

                                {/* SECCIÓN C: REFERIDOS */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                                        <h3 className="text-white font-black text-base flex items-center gap-2">🤝 Sistema de Referidos</h3>
                                        <p className="text-purple-100 text-xs mt-1">Mensajes del programa de referidos y desafíos.</p>
                                    </div>
                                    <div className="divide-y divide-gray-50">

                                        {/* DESAFÍO */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🎯</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Desafío de Referidos</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Difusión manual para motivar durante un desafío activo.</p>
                                                </div>
                                                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase">Difusión Manual</span>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.referralChallenge_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge_title: e.target.value } } })}
                                                        placeholder="🚀 ¡NUEVO DESAFÍO ACTIVO!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralChallenge || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.referralChallenge || '¡Tenemos un nuevo desafío!'}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge: DEFAULT_TEMPLATES.referralChallenge } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('referralChallenge', '¡NUEVO DESAFÍO ACTIVO! 🚀')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('referralChallenge')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'fecha_limite', 'puntos', 'meta']} onSelect={v => insertVar('referralChallenge', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralChallenge_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.referralChallenge_whatsapp || config.messaging?.templates?.referralChallenge || DEFAULT_TEMPLATES.referralChallenge || '¡Tenemos un desafío!')} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                                                <div className="w-full sm:w-auto">
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Difusión</label>
                                                    <ChannelSelector channels={challengeChannels} onChange={setChallengeChannels} />
                                                </div>
                                                <button type="button" onClick={async () => {
                                                    const channelsStr = challengeChannels.join(', ') || 'Ninguno';
                                                    if (challengeChannels.length === 0) { toast.error('Selecciona al menos un canal'); return; }
                                                    if (!window.confirm(`¿Deseas difundir el desafío a todos los clientes a través de: ${channelsStr}?`)) return;
                                                    const toastId = toast.loading('Iniciando difusión...');
                                                    const title = '¡NUEVO DESAFÍO ACTIVO! 🚀';
                                                    const templateText = config.messaging?.templates?.referralChallenge || DEFAULT_TEMPLATES.referralChallenge || 'Desafío Activo';
                                                    try {
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
                                                                const d = doc.data(); const userName = d.name || '';
                                                                let personalizedMsg = templateText.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName).replace(/{fecha_limite}/g, expirationDateFormatted).replace(/{vencimiento}/g, expirationDateFormatted).replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0').replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');
                                                                return NotificationService.sendToClient(doc.id, { title, body: personalizedMsg, type: 'campaign', icon: config.logoUrl || '/pwa-192x192.png' });
                                                            });
                                                            await Promise.allSettled(pushPromises);
                                                        }
                                                        if (challengeChannels.includes('email')) {
                                                            const emailPromises = snap.docs.map(doc => {
                                                                const d = doc.data();
                                                                if (d.email) {
                                                                    const userName = d.name || '';
                                                                    let personalizedMsg = templateText.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName).replace(/{fecha_limite}/g, expirationDateFormatted).replace(/{vencimiento}/g, expirationDateFormatted).replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0').replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');
                                                                    const htmlContent = EmailService.generateBrandedTemplate(config, title, personalizedMsg);
                                                                    return EmailService.sendEmail(d.email, title, htmlContent);
                                                                }
                                                                return null;
                                                            }).filter(Boolean);
                                                            await Promise.allSettled(emailPromises);
                                                        }
                                                        if (challengeChannels.includes('whatsapp')) {
                                                            let waMsg = templateText.replace(/{fecha_limite}/g, expirationDateFormatted).replace(/{vencimiento}/g, expirationDateFormatted).replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0').replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');
                                                            navigate('/admin/whatsapp', { state: { message: waMsg } });
                                                        }
                                                        toast.success('¡Difusión completada!', { id: toastId });
                                                    } catch (e) { toast.error('Error en la difusión', { id: toastId }); }
                                                }} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl text-sm font-black shadow-lg hover:scale-105 transition whitespace-nowrap">
                                                    <Megaphone size={16} /> ¡Difundir a Todos!
                                                </button>
                                            </div>
                                        </div>

                                        {/* RECOMPENSA POR REFERIDO */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🤝</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Premio por Referido (al Nuevo Socio)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al nuevo cliente cuando completa el ciclo de referido.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.referralReward_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward_title: e.target.value } } })}
                                                        placeholder="🎁 ¡Tu amigo te regaló puntos!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralReward || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.referralReward}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward: DEFAULT_TEMPLATES.referralReward } } })} className="px-2 py-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('referralReward')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('referralReward')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'amigo', 'puntos']} onSelect={v => insertVar('referralReward', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralReward_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.referralReward_whatsapp || config.messaging?.templates?.referralReward || DEFAULT_TEMPLATES.referralReward)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.referralReward?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, referralReward: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* PUNTOS POR REFERIR */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🏆</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Puntos por Referir (al Anfitrión)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al socio que invitó cuando su referido completa el ciclo.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.referralPoints_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints_title: e.target.value } } })}
                                                        placeholder="🏆 ¡Ganaste puntos por tu invitación!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralPoints || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.referralPoints}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints: DEFAULT_TEMPLATES.referralPoints } } })} className="px-2 py-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('referralPoints')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                            <button type="button" onClick={() => openTestModal('referralPoints')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_referido', 'puntos']} onSelect={v => insertVar('referralPoints', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralPoints_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.referralPoints_whatsapp || config.messaging?.templates?.referralPoints || DEFAULT_TEMPLATES.referralPoints)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.referralPoints?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, referralPoints: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                    </div>
                                </div>
                            </div>
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
                                                        type="time"
                                                        value={config.messaging?.engineAllowedStartHour ?? "09:00"}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, engineAllowedStartHour: e.target.value || "00:00" } })}
                                                        className="w-full pl-3 pr-3 py-2 text-xl font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
                                                </div>
                                            </label>
                                            <span className="text-gray-300 font-black">—</span>
                                            <label className="flex flex-col flex-1">
                                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Corta a las</span>
                                                <div className="relative">
                                                    <input
                                                        type="time"
                                                        value={config.messaging?.engineAllowedEndHour ?? "22:00"}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, engineAllowedEndHour: e.target.value || "00:00" } })}
                                                        className="w-full pl-3 pr-3 py-2 text-xl font-black text-gray-800 bg-gray-50 border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
                                                    />
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
                                            {(['socios_total', 'socios_historial', 'socios_mensajes', 'puntos_total', 'geo_total', 'transacciones_total'] as const).map(opt => (
                                                <label key={opt} title={resetDescriptions[opt]} className="flex items-center gap-3 cursor-pointer group">
                                                    <input type="checkbox" checked={(resetOptions as any)[opt]} onChange={e => setResetOptions({ ...resetOptions, [opt]: e.target.checked })} className="w-5 h-5 rounded border-gray-300 text-red-600" />
                                                    <span className="text-sm font-bold text-gray-700 group-hover:text-red-600 uppercase">{opt.replace('_', ' ')}</span>
                                                </label>
                                            ))}
                                        </div>
                                    </div>
                                    <div className="bg-white p-6 rounded-2xl border border-red-50 space-y-4">
                                        <h4 className="font-bold text-gray-800 border-b pb-2 mb-4 flex items-center gap-2"><Settings size={18} className="text-gray-600" /> Estructura</h4>
                                        <div className="space-y-3">
                                            {(['marca_total', 'gamification_total', 'prizes_total', 'campaigns_total', 'sorteos_total', 'team_total', 'contact_total', 'legales_total', 'audit_total'] as const).map(opt => (
                                                <label key={opt} title={resetDescriptions[opt]} className="flex items-center gap-3 cursor-pointer group">
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

            
            {/* Modal de Prueba de Envío */}
            {testMessageModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTestMessageModal({ ...testMessageModal, isOpen: false })} />
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-purple-50">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                                    <Rocket size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-purple-900">Probar Envío: {testMessageModal.templateKey}</h3>
                                    <p className="text-sm text-purple-700/70">Enviá un mensaje real a un usuario para verificar variables.</p>
                                </div>
                            </div>
                            <button onClick={() => setTestMessageModal({ ...testMessageModal, isOpen: false })} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white transition">
                                ✕
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Búsqueda de Usuario */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-gray-700">1. Buscar Usuario de Prueba</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por nombre, email o DNI..." 
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                        id="testUserSearchInput"
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            const resultsDiv = document.getElementById('testUserResults');
                                            if (!resultsDiv) return;
                                            if (val.length < 3) {
                                                resultsDiv.innerHTML = '';
                                                return;
                                            }
                                            resultsDiv.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">Buscando...</div>';
                                            
                                            // Buscar en Firebase
                                            const q = query(collection(db, 'users'), orderBy('name'), limit(5));
                                            const snap = await getDocs(q);
                                            let results: any[] = [];
                                            snap.forEach(doc => {
                                                const d = doc.data();
                                                if (d.name?.toLowerCase().includes(val.toLowerCase()) || d.email?.toLowerCase().includes(val.toLowerCase()) || d.dni?.includes(val)) {
                                                    results.push({ id: doc.id, ...d });
                                                }
                                            });
                                            
                                            if (results.length === 0) {
                                                resultsDiv.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">No se encontraron usuarios.</div>';
                                                return;
                                            }
                                            
                                            (window as any)._testUsers = results; // Guardar temporalmente
                                            
                                            resultsDiv.innerHTML = results.map((u, idx) => `
                                                <div class="p-3 hover:bg-purple-50 cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-0 transition" onclick="window._selectTestUser(${idx})">
                                                    <div>
                                                        <div class="font-bold text-gray-800 text-sm">${u.name || 'Sin nombre'}</div>
                                                        <div class="text-xs text-gray-500">${u.email || u.phone || 'Sin datos de contacto'}</div>
                                                    </div>
                                                    <div class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">${u.points || 0} pts</div>
                                                </div>
                                            `).join('');
                                        }}
                                    />
                                </div>
                                <div id="testUserResults" className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm empty:hidden"></div>
                                
                                <div id="selectedTestUser" className="hidden bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="text-green-500" size={20} />
                                        <div>
                                            <div id="selUserName" className="font-bold text-green-900 text-sm">Usuario</div>
                                            <div id="selUserData" className="text-xs text-green-700">Datos</div>
                                        </div>
                                    </div>
                                    <button onClick={() => {
                                        document.getElementById('selectedTestUser')?.classList.add('hidden');
                                        (document.getElementById('testUserSearchInput') as HTMLInputElement).value = '';
                                        (window as any)._selectedUserForTest = null;
                                    }} className="text-xs text-green-700 font-bold hover:text-green-900 underline">Cambiar</button>
                                </div>
                            </div>
                            
                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-gray-200"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">O ingresar datos manuales</span>
                                <div className="flex-grow border-t border-gray-200"></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Email Manual</label>
                                    <input type="email" id="manualTestEmail" placeholder="test@test.com" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">WhatsApp Manual</label>
                                    <input type="text" id="manualTestPhone" placeholder="5491122334455" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                                </div>
                            </div>

                            {/* Canales */}
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <label className="block text-sm font-bold text-gray-700">2. Seleccionar Canales a Probar</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-purple-50 p-3 rounded-xl transition flex-1 border border-gray-200 hover:border-purple-200">
                                        <input type="checkbox" id="testChEmail" defaultChecked={testMessageModal.channels.includes('email')} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                        <span className="text-sm font-bold text-gray-700">Email</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-purple-50 p-3 rounded-xl transition flex-1 border border-gray-200 hover:border-purple-200">
                                        <input type="checkbox" id="testChWa" defaultChecked={testMessageModal.channels.includes('whatsapp')} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                        <span className="text-sm font-bold text-gray-700">WhatsApp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-purple-50 p-3 rounded-xl transition flex-1 border border-gray-200 hover:border-purple-200">
                                        <input type="checkbox" id="testChPush" defaultChecked={testMessageModal.channels.includes('push')} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                        <span className="text-sm font-bold text-gray-700">Push</span>
                                    </label>
                                </div>
                            </div>

                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setTestMessageModal({ ...testMessageModal, isOpen: false })} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition">
                                Cancelar
                            </button>
                            <button onClick={async () => {
                                const user = (window as any)._selectedUserForTest;
                                const manualEmail = (document.getElementById('manualTestEmail') as HTMLInputElement)?.value;
                                const manualPhone = (document.getElementById('manualTestPhone') as HTMLInputElement)?.value;
                                
                                const chEmail = (document.getElementById('testChEmail') as HTMLInputElement)?.checked;
                                const chWa = (document.getElementById('testChWa') as HTMLInputElement)?.checked;
                                const chPush = (document.getElementById('testChPush') as HTMLInputElement)?.checked;
                                
                                if (!user && !manualEmail && !manualPhone) {
                                    toast.error('Selecciona un usuario o ingresá datos manuales');
                                    return;
                                }
                                if (!chEmail && !chWa && !chPush) {
                                    toast.error('Selecciona al menos un canal para probar');
                                    return;
                                }

                                const toastId = toast.loading('Enviando pruebas...');
                                
                                // Funciones de reemplazo
                                const processText = (text: string) => {
                                    return text
                                        .replace(/{nombre}/g, user ? (user.name || '').split(' ')[0] : 'UsuarioPrueba')
                                        .replace(/{nombre_completo}/g, user ? user.name || '' : 'Usuario Prueba Completo')
                                        .replace(/{puntos}/g, user ? String(user.points || 0) : '150')
                                        .replace(/{saldo}/g, user ? String(user.points || 0) : '150')
                                        .replace(/{siteName}/g, config.siteName || 'El Club')
                                        .replace(/{premio}/g, 'Premio de Prueba')
                                        .replace(/{codigo}/g, 'TEST-123')
                                        .replace(/{fecha}/g, '31/12/2025')
                                        .replace(/{vencimiento}/g, '31/12/2025')
                                        .replace(/{fecha_limite}/g, '31/12/2025')
                                        .replace(/{amigo}/g, 'AmigoPrueba')
                                        .replace(/{nombre_referido}/g, 'AmigoPrueba')
                                        .replace(/{mascota}/g, user?.pets?.[0]?.name || 'Firulais')
                                        .replace(/{marca}/g, 'MarcaPrueba')
                                        .replace(/{titulo}/g, 'Titulo de Promoción')
                                        .replace(/{descripcion}/g, 'Descripción de campaña de prueba')
                                        .replace(/{detalle}/g, 'Detalle de oferta')
                                        .replace(/{horario}/g, '20:00');
                                };

                                const finalTitle = processText(testMessageModal.title || 'Mensaje de Prueba');
                                const finalBody = processText(testMessageModal.body);
                                const finalWaBody = processText(testMessageModal.waBody || testMessageModal.body);

                                try {
                                    const emailToSend = manualEmail || user?.email;
                                    const phoneToSend = manualPhone || user?.phone;

                                    if (chEmail) {
                                        if (!emailToSend) toast.error('No hay email para enviar');
                                        else {
                                            const html = EmailService.generateBrandedTemplate(config, finalTitle, finalBody);
                                            await EmailService.sendEmail(emailToSend, finalTitle, html);
                                            toast.success('Email de prueba enviado', { id: toastId });
                                        }
                                    }
                                    if (chPush) {
                                        if (!user?.id) toast.error('Se requiere un usuario de la BD para probar Push');
                                        else {
                                            await NotificationService.sendToClient(user.id, { title: finalTitle, body: finalBody, type: 'campaign', icon: config.logoUrl || '/pwa-192x192.png' });
                                            toast.success('Push de prueba enviado', { id: toastId });
                                        }
                                    }
                                    if (chWa) {
                                        if (!phoneToSend) toast.error('No hay teléfono para WhatsApp');
                                        else {
                                            const url = `https://api.whatsapp.com/send?phone=${phoneToSend}&text=${encodeURIComponent(finalWaBody)}`;
                                            window.open(url, '_blank');
                                            toast.success('Abriendo WhatsApp...', { id: toastId });
                                        }
                                    }
                                } catch (error) {
                                    console.error(error);
                                    toast.error('Hubo un error al enviar las pruebas', { id: toastId });
                                }
                            }} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition active:scale-95">
                                <Rocket size={18} /> ¡Enviar Prueba!
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
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
