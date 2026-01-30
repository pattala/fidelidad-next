import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Calendar, Target, Award, Save, X, Megaphone, Sparkles, ToggleLeft, ToggleRight, Edit, Send, Monitor } from 'lucide-react';
import toast from 'react-hot-toast';
import { CampaignService } from '../../../services/campaignService';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import type { BonusRule } from '../../../services/campaignService';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { NotificationService } from '../../../services/notificationService';
import { EmailService } from '../../../services/emailService';

export const CampaignsPage = () => {
    const navigate = useNavigate();
    const [bonuses, setBonuses] = useState<BonusRule[]>([]);
    // const [loading, setLoading] = useState(false); // Unused

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [intent, setIntent] = useState<'CAROUSEL' | 'BANNER' | 'POINTS' | null>(null);
    const [editingId, setEditingId] = useState<string | null>(null); // Track if editing
    const [formData, setFormData] = useState<Partial<BonusRule>>({
        name: '', // Internal
        title: '', // Public
        showTitle: true,
        description: '',
        showDescription: true,
        rewardType: 'FIXED',
        rewardValue: 50,
        daysOfWeek: [],
        active: true,
        startDate: '',
        endDate: '',
        imageUrl: '',
        showInCarousel: false,
        showInHomeBanner: false,
        backgroundColor: '',
        textColor: '#FFFFFF',
        fontWeight: 'normal',
        imageFit: 'contain',
        textPosition: 'bottom-left',
        fontStyle: 'sans',
        buttonText: 'Ver detalles',
        // @ts-ignore
        titleSize: '2xl', // Default
        descriptionSize: 'sm', // Default
        imageOpacity: 60, // Default
        link: ''
    });

    const DAYS = [
        { id: 0, label: 'Dom' },
        { id: 1, label: 'Lun' },
        { id: 2, label: 'Mar' },
        { id: 3, label: 'Mie' },
        { id: 4, label: 'Jue' },
        { id: 5, label: 'Vie' },
        { id: 6, label: 'Sab' }
    ];

    const fetchBonuses = async () => {
        // setLoading(true);
        const data = await CampaignService.getAll();
        setBonuses(data);
        // setLoading(false);
    };

    useEffect(() => {
        fetchBonuses();
    }, []);

    const resetForm = () => {
        setFormData({
            name: '', title: '', showTitle: true, description: '', showDescription: true,
            rewardType: 'FIXED', rewardValue: 50,
            daysOfWeek: [], active: true, startDate: '', endDate: '', imageUrl: '',
            showInCarousel: false, showInHomeBanner: false, backgroundColor: '',
            textColor: '#FFFFFF', fontWeight: 'normal',
            imageFit: 'contain', textPosition: 'bottom-left', fontStyle: 'sans',
            buttonText: 'Ver detalles',
            channels: ['push', 'email', 'whatsapp'],
            // @ts-ignore
            link: ''
        });
        setEditingId(null);
        setIntent(null);
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            // Validate: If INFO, ensure we have at least image or description
            if (formData.rewardType === 'INFO' && !formData.imageUrl && !formData.description) {
                toast.error('Un anuncio debe tener imagen o descripción');
                return;
            }

            const payload = {
                ...formData,
                // Ensure rewardValue is 0 if INFO, to avoid confusion
                rewardValue: formData.rewardType === 'INFO' ? 0 : formData.rewardValue
            };

            if (editingId) {
                await CampaignService.update(editingId, payload);
                toast.success('Campaña actualizada');
            } else {
                // @ts-ignore
                await CampaignService.create(payload);
                toast.success('Campaña creada');
            }
            setIsModalOpen(false);
            fetchBonuses();
            resetForm();
        } catch (error) {
            toast.error('Error al guardar campaña');
        }
    };

    const handleEdit = (bonus: BonusRule) => {
        setEditingId(bonus.id);
        // Map intent loosely for editing
        if (bonus.showInCarousel) setIntent('CAROUSEL');
        else if (bonus.showInHomeBanner) setIntent('BANNER');
        else setIntent('POINTS');

        setFormData({
            ...bonus,
            // Fallback for old records without 'title'
            title: bonus.title || bonus.name || '',
            name: bonus.name || '',
            description: bonus.description || '',
            startDate: bonus.startDate || '',
            endDate: bonus.endDate || '',
            imageUrl: bonus.imageUrl || '',
            showInCarousel: bonus.showInCarousel || false,
            showInHomeBanner: bonus.showInHomeBanner || false,
            backgroundColor: bonus.backgroundColor || '',
            textColor: bonus.textColor || '#FFFFFF',
            fontWeight: bonus.fontWeight || 'normal',
            imageFit: bonus.imageFit || 'contain',
            textPosition: bonus.textPosition || 'bottom-left',
            fontStyle: bonus.fontStyle || 'sans',
            showTitle: bonus.showTitle !== false,
            showDescription: bonus.showDescription !== false,
            descriptionSize: bonus.descriptionSize || 'sm',
            imageOpacity: bonus.imageOpacity !== undefined ? bonus.imageOpacity : 60,
            channels: bonus.channels || ['push', 'email', 'whatsapp'],
            // @ts-ignore
            link: bonus.link || ''
        });
        setIsModalOpen(true);
    };

    const handleToggleActive = async (bonus: BonusRule) => {
        try {
            const newStatus = !bonus.active;
            setBonuses(bonuses.map(b => b.id === bonus.id ? { ...b, active: newStatus } : b));
            await CampaignService.update(bonus.id, { active: newStatus });
            toast.success(`Campaña ${newStatus ? 'activada' : 'desactivada'}`);
        } catch (error) {
            toast.error('Error al actualizar');
            fetchBonuses();
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('¿Eliminar esta campaña permanentemente?')) return;
        try {
            await CampaignService.delete(id);
            toast.success('Campaña eliminada');
            fetchBonuses();
        } catch (error) {
            toast.error('Error al eliminar');
        }
    };

    const handleBroadcast = async (bonus: BonusRule) => {
        try {
            const config = await ConfigService.get();
            const eventType = bonus.rewardType === 'INFO' ? 'offer' : 'campaign';

            // 1. Prepare Message
            let template = "";
            let msg = "";

            if (bonus.rewardType === 'INFO') {
                template = config?.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer;
                const vencimiento = bonus.endDate
                    ? new Date(bonus.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                    : 'agotar stock';
                msg = template
                    .replace(/{titulo}/g, bonus.name)
                    .replace(/{detalle}/g, bonus.description || 'Consultanos.')
                    .replace(/{vencimiento}/g, vencimiento);
            } else {
                template = config?.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign;
                msg = template
                    .replace(/{nombre}/g, bonus.name)
                    .replace(/{descripcion}/g, bonus.description || '¡Sumá más puntos!');
            }

            // 2. CHECK PUSH ENABLEMENT & SEND
            const pushEnabledForCampaign = bonus.channels?.includes('push') ?? true;
            if (pushEnabledForCampaign && NotificationService.isChannelEnabled(config, eventType, 'push')) {
                const confirmPush = confirm(`¿Enviar notificación PUSH a todos los clientes activos?\n\n"${msg}"`);
                if (confirmPush) {
                    const loadingToast = toast.loading('Enviando Pushes...');
                    try {
                        const q = query(collection(db, 'users'));
                        const snap = await getDocs(q);
                        let sentCount = 0;
                        const pushPromises = snap.docs.map(doc => {
                            sentCount++;
                            return NotificationService.sendToClient(doc.id, {
                                title: bonus.rewardType === 'INFO' ? '¡Nueva Oferta!' : '¡Nueva Campaña!',
                                body: msg,
                                type: eventType,
                            });
                        });
                        await Promise.allSettled(pushPromises);
                        toast.success(`Push enviado a ${sentCount} clientes`, { id: loadingToast });
                    } catch (err) {
                        console.error("Push Broadcast Error", err);
                        toast.error("Error enviando Pushes", { id: loadingToast });
                    }
                }
            }

            // 3. CHECK EMAIL ENABLEMENT & SEND
            const emailEnabledForCampaign = bonus.channels?.includes('email') ?? true;
            if (emailEnabledForCampaign && NotificationService.isChannelEnabled(config, eventType, 'email')) {
                const confirmEmail = confirm(`¿Enviar EMAIL masivo a todos los clientes?\n\n"${msg}"`);
                if (confirmEmail) {
                    const loadingToast = toast.loading('Enviando Emails...');
                    try {
                        const q = query(collection(db, 'users'));
                        const snap = await getDocs(q);
                        let sentCount = 0;

                        const emailPromises = snap.docs.map(doc => {
                            const data = doc.data();
                            if (data.email) {
                                sentCount++;
                                const htmlContent = EmailService.generateBrandedTemplate(config, bonus.rewardType === 'INFO' ? '¡Oferta Especial!' : '¡Nueva Campaña!', msg);
                                return EmailService.sendEmail(data.email, bonus.rewardType === 'INFO' ? '¡Oferta Especial!' : '¡Nueva Campaña!', htmlContent);
                            }
                            return null;
                        }).filter(Boolean);

                        await Promise.allSettled(emailPromises);
                        toast.success(`Email enviado a ${sentCount} clientes`, { id: loadingToast });
                    } catch (err) {
                        console.error("Email Broadcast Error", err);
                        toast.error("Error enviando Emails", { id: loadingToast });
                    }
                }
            }

            // 4. CHECK WHATSAPP ENABLEMENT & REDIRECT
            const waEnabledForCampaign = bonus.channels?.includes('whatsapp') ?? true;
            const waGlobalEnabled = NotificationService.isChannelEnabled(config, eventType, 'whatsapp');

            if (waEnabledForCampaign && waGlobalEnabled) {
                navigate('/admin/whatsapp', { state: { message: msg } });
                toast.success('Redirigiendo a Mensajería WhatsApp...');
            } else if (!pushEnabledForCampaign && !emailEnabledForCampaign && !waEnabledForCampaign) {
                toast('Ningún canal habilitado en la campaña para difundir.', { icon: 'ℹ️' });
            }

        } catch (error) {
            console.error(error);
            toast.error('Error al preparar difusión');
        }
    };

    const toggleDay = (dayId: number) => {
        setFormData(prev => {
            const currentDays = prev.daysOfWeek || [];
            const exists = currentDays.includes(dayId);
            if (exists) return { ...prev, daysOfWeek: currentDays.filter(d => d !== dayId) };
            return { ...prev, daysOfWeek: [...currentDays, dayId].sort() };
        });
    };

    return (
        <div className="space-y-8 animate-fade-in pb-20">
            {/* Header */}
            <div className="flex justify-between items-center border-b border-gray-100 pb-6">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        <Target className="text-purple-600" /> Campañas y Anuncios
                    </h1>
                    <p className="text-gray-500 mt-1">Configura reglas de puntos, bonos y banners publicitarios.</p>
                </div>
                <button
                    onClick={() => { resetForm(); setIsModalOpen(true); }}
                    className="bg-purple-600 hover:bg-purple-700 text-white px-5 py-2.5 rounded-xl font-bold shadow-lg shadow-purple-200 transition flex items-center gap-2 active:scale-95"
                >
                    <Plus size={20} /> Crear Nuevo
                </button>
            </div>

            {/* Grid de Bonos */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bonuses.map(bonus => (
                    <div key={bonus.id} className={`bg-white rounded-2xl border-2 transition-all relative overflow-hidden group flex flex-col ${bonus.active ? 'border-purple-100 shadow-sm hover:shadow-md' : 'border-gray-100 opacity-60 grayscale-[0.8] hover:grayscale-0'}`}>

                        {/* Banner Image Preview */}
                        <div className="h-32 bg-gray-100 relative overflow-hidden">
                            {bonus.imageUrl ? (
                                <img src={bonus.imageUrl} alt={bonus.name} className="w-full h-full object-cover" />
                            ) : (
                                <div className="w-full h-full flex items-center justify-center text-gray-300">
                                    {bonus.rewardType === 'INFO' ? <Megaphone size={32} /> : <Sparkles size={32} />}
                                </div>
                            )}

                            {/* App Visibility Badge */}
                            {(bonus.showInCarousel || bonus.showInHomeBanner) && (
                                <div className="absolute top-2 left-2 flex flex-col gap-1">
                                    {bonus.showInCarousel && (
                                        <div className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-blue-400 animate-pulse"></span>
                                            Carrusel
                                        </div>
                                    )}
                                    {bonus.showInHomeBanner && (
                                        <div className="bg-black/60 backdrop-blur-sm text-white text-[9px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                                            <span className="w-1 h-1 rounded-full bg-purple-400 animate-pulse"></span>
                                            Banner Home
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Status Toggle */}
                            <div className="absolute top-2 right-2">
                                <button
                                    onClick={() => handleToggleActive(bonus)}
                                    className={`bg-white/90 backdrop-blur rounded-full p-1 transition-colors shadow-sm ${bonus.active ? 'text-green-500' : 'text-gray-400'}`}
                                    title={bonus.active ? 'Desactivar' : 'Activar'}
                                >
                                    {bonus.active ? <ToggleRight size={28} className="fill-current" /> : <ToggleLeft size={28} />}
                                </button>
                            </div>
                        </div>

                        <div className="p-5 flex-1 flex flex-col">
                            <div className="flex items-start justify-between mb-2">
                                <div>
                                    <h3 className="font-bold text-gray-800 text-lg leading-tight line-clamp-1">{bonus.name}</h3>
                                    <p className="text-xs text-gray-500 line-clamp-2 mt-1 min-h-[2.5em]">{bonus.description || 'Sin descripción'}</p>
                                </div>
                            </div>

                            <div className={`font-bold text-sm px-3 py-1.5 rounded-lg inline-flex items-center gap-2 w-fit mb-4 ${bonus.rewardType === 'INFO'
                                ? 'text-blue-600 bg-blue-50'
                                : 'text-purple-600 bg-purple-50'
                                }`}>
                                {bonus.rewardType === 'INFO' ? (
                                    <>
                                        <Megaphone size={14} /> Solo Anuncio
                                    </>
                                ) : (
                                    <>
                                        <Sparkles size={14} />
                                        {bonus.rewardType === 'MULTIPLIER' ? `Multiplica x${bonus.rewardValue}` : `+${bonus.rewardValue} Puntos`}
                                    </>
                                )}
                            </div>

                            <div className="mt-auto space-y-3">
                                {/* Date Range */}
                                {(bonus.startDate || bonus.endDate) && (
                                    <div className="text-[11px] font-medium text-gray-500 bg-gray-50 px-2 py-1 rounded border border-gray-100 flex items-center">
                                        📅 {bonus.startDate || 'Inicio'} - {bonus.endDate || 'Fin'}
                                    </div>
                                )}

                                {/* Days */}
                                <div className="flex flex-wrap gap-1">
                                    {DAYS.map(day => (
                                        <span
                                            key={day.id}
                                            className={`text-[9px] uppercase font-bold px-1.5 py-0.5 rounded ${bonus.daysOfWeek?.includes(day.id) ? 'bg-purple-100 text-purple-700' : 'bg-gray-50 text-gray-300'}`}
                                        >
                                            {day.label.slice(0, 1)}
                                        </span>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Footer Actions */}
                        <div className="px-5 py-3 border-t border-gray-50 flex justify-between items-center bg-gray-50/30">
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${bonus.active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-500'}`}>
                                {bonus.active ? 'ACTIVO' : 'PAUSADO'}
                            </span>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => handleBroadcast(bonus)}
                                    className="text-gray-400 hover:text-green-600 transition p-1.5 hover:bg-green-50 rounded-lg flex items-center gap-1"
                                    title="Difundir por WhatsApp"
                                >
                                    <Send size={16} />
                                    <span className="text-xs font-bold">Difundir</span>
                                </button>
                                <div className="w-px h-4 bg-gray-200 self-center mx-1"></div>
                                <button
                                    onClick={() => handleEdit(bonus)}
                                    className="text-gray-400 hover:text-blue-500 transition p-1.5 hover:bg-blue-50 rounded-lg"
                                    title="Editar"
                                >
                                    <Edit size={16} />
                                </button>
                                <button
                                    onClick={() => handleDelete(bonus.id)}
                                    className="text-gray-400 hover:text-red-500 transition p-1.5 hover:bg-red-50 rounded-lg"
                                    title="Eliminar"
                                >
                                    <Trash2 size={16} />
                                </button>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Modal de Creación / Edición */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in overflow-y-auto">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-scale-up my-8">
                        <div className="px-6 py-4 bg-purple-50 border-b border-purple-100 flex justify-between items-center sticky top-0 z-10">
                            <h2 className="text-lg font-bold text-purple-900">
                                {editingId ? 'Editar Elemento' : (intent ? `Nueva ${intent === 'CAROUSEL' ? 'Campaña Carrusel' : intent === 'BANNER' ? 'Campaña Banner' : 'Campaña de Puntos'}` : 'Nuevo Elemento')}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-600 rounded-full p-1"><X size={20} /></button>
                        </div>

                        {!intent && !editingId ? (
                            <div className="p-8 space-y-6">
                                <p className="text-center text-gray-500 font-medium">¿Qué deseas crear hoy?</p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <button
                                        onClick={() => {
                                            setIntent('CAROUSEL');
                                            setFormData(prev => ({ ...prev, showInCarousel: true, rewardType: 'INFO' }));
                                        }}
                                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-100 hover:border-purple-600 hover:bg-purple-50 transition-all group"
                                    >
                                        <div className="p-4 bg-gray-100 rounded-2xl text-gray-400 group-hover:bg-purple-100 group-hover:text-purple-600 transition-colors">
                                            <Monitor size={32} />
                                        </div>
                                        <div className="text-center">
                                            <span className="block font-bold text-gray-800">Carrusel Superior</span>
                                            <span className="text-[10px] text-gray-500">Slide de impacto visual</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIntent('BANNER');
                                            setFormData(prev => ({ ...prev, showInHomeBanner: true, rewardType: 'INFO' }));
                                        }}
                                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-100 hover:border-blue-600 hover:bg-blue-50 transition-all group"
                                    >
                                        <div className="p-4 bg-gray-100 rounded-2xl text-gray-400 group-hover:bg-blue-100 group-hover:text-blue-600 transition-colors">
                                            <Calendar size={32} />
                                        </div>
                                        <div className="text-center">
                                            <span className="block font-bold text-gray-800">Banner de Inicio</span>
                                            <span className="text-[10px] text-gray-500">Acción rápida en Home</span>
                                        </div>
                                    </button>

                                    <button
                                        onClick={() => {
                                            setIntent('POINTS');
                                            setFormData(prev => ({ ...prev, rewardType: 'FIXED' }));
                                        }}
                                        className="flex flex-col items-center gap-3 p-6 rounded-2xl border-2 border-gray-100 hover:border-green-600 hover:bg-green-50 transition-all group"
                                    >
                                        <div className="p-4 bg-gray-100 rounded-2xl text-gray-400 group-hover:bg-green-100 group-hover:text-green-600 transition-colors">
                                            <Sparkles size={32} />
                                        </div>
                                        <div className="text-center">
                                            <span className="block font-bold text-gray-800">Regla de Puntos</span>
                                            <span className="text-[10px] text-gray-500">Lógica de fidelización</span>
                                        </div>
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <form onSubmit={handleSave} className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto">

                                {/* Columna Izquierda: Configuración Principal */}
                                <div className="space-y-4">
                                    <h3 className="font-bold text-gray-800 border-b pb-2 mb-2 text-sm">Configuración Principal</h3>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Nombre Interno (Solo Admin)</label>
                                        <input
                                            type="text" required
                                            placeholder="Ej: Promo Verano 2026 Admin"
                                            className="w-full rounded-lg border-gray-200 border p-2 text-sm outline-none focus:ring-2 focus:ring-gray-100 bg-gray-50"
                                            value={formData.name}
                                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                                        />
                                    </div>

                                    {(formData.showInCarousel || formData.showInHomeBanner || intent !== 'POINTS') && (
                                        <>
                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-xs font-bold text-gray-500">Título Público</label>
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" className="w-3 h-3" checked={formData.showTitle} onChange={e => setFormData({ ...formData, showTitle: e.target.checked })} />
                                                        <span className="text-[10px] text-gray-400">Mostrar</span>
                                                    </label>
                                                </div>
                                                <input
                                                    type="text"
                                                    placeholder="Ej: ¡Oferta Imperdible!"
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm outline-none focus:ring-2 focus:ring-purple-100"
                                                    value={formData.title}
                                                    onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                />
                                            </div>

                                            <div>
                                                <div className="flex justify-between items-center mb-1">
                                                    <label className="block text-xs font-bold text-gray-500">Descripción Pública</label>
                                                    <label className="flex items-center gap-1 cursor-pointer">
                                                        <input type="checkbox" className="w-3 h-3" checked={formData.showDescription} onChange={e => setFormData({ ...formData, showDescription: e.target.checked })} />
                                                        <span className="text-[10px] text-gray-400">Mostrar</span>
                                                    </label>
                                                </div>
                                                <textarea
                                                    rows={2}
                                                    placeholder="Detalles de la promo..."
                                                    className="w-full rounded-lg border-gray-200 border p-2 text-sm outline-none focus:ring-2 focus:ring-purple-100 resize-none"
                                                    value={formData.description}
                                                    onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                />
                                            </div>
                                        </>
                                    )}

                                    {(intent === 'POINTS' || editingId) && (
                                        <div>
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Tipo de Bono</label>
                                            <select
                                                className="w-full rounded-lg border-gray-200 border p-2 text-sm font-semibold outline-none focus:ring-2 focus:ring-purple-100 bg-white"
                                                value={formData.rewardType}
                                                onChange={e => setFormData({ ...formData, rewardType: e.target.value as any })}
                                            >
                                                <option value="FIXED">🎁 Puntos Fijos (+)</option>
                                                <option value="MULTIPLIER">🚀 Multiplicador (x)</option>
                                                <option value="INFO">📢 Solo Informativo</option>
                                            </select>
                                        </div>
                                    )}

                                    {formData.rewardType !== 'INFO' && (
                                        <div className="animate-fade-in-down">
                                            <label className="block text-xs font-bold text-gray-500 mb-1">Valor</label>
                                            <input
                                                type="number" required min="1" step={formData.rewardType === 'MULTIPLIER' ? "0.1" : "1"}
                                                className="w-full rounded-lg border-gray-200 border p-2 text-sm font-bold text-purple-600 outline-none focus:ring-2 focus:ring-purple-100"
                                                value={formData.rewardValue}
                                                onChange={e => setFormData({ ...formData, rewardValue: parseFloat(e.target.value) || 0 })}
                                            />
                                        </div>
                                    )}

                                    <div className="pt-2 border-t mt-4">
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Ubicaciones en la App</label>
                                        <div className="space-y-2">
                                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                                    checked={formData.showInCarousel}
                                                    onChange={e => setFormData({ ...formData, showInCarousel: e.target.checked })}
                                                />
                                                <span className="text-xs font-bold text-gray-700">Mostrar en Carrusel Superior</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer p-2 rounded-lg hover:bg-gray-50 transition-colors">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-purple-600 rounded focus:ring-purple-500"
                                                    checked={formData.showInHomeBanner}
                                                    onChange={e => setFormData({ ...formData, showInHomeBanner: e.target.checked })}
                                                />
                                                <span className="text-xs font-bold text-gray-700">Mostrar en Banner de Inicio (Home)</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div className="pt-2 border-t mt-2">
                                        <label className="block text-xs font-bold text-gray-500 mb-2 uppercase tracking-wider">Canales de Difusión</label>
                                        <div className="flex gap-4">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-purple-600 rounded"
                                                    checked={formData.channels?.includes('push')}
                                                    onChange={e => {
                                                        const current = formData.channels || [];
                                                        setFormData({ ...formData, channels: e.target.checked ? [...current, 'push'] : current.filter(c => c !== 'push') });
                                                    }}
                                                />
                                                <span className="text-xs font-bold text-gray-700">Push</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-purple-600 rounded"
                                                    checked={formData.channels?.includes('email')}
                                                    onChange={e => {
                                                        const current = formData.channels || [];
                                                        setFormData({ ...formData, channels: e.target.checked ? [...current, 'email'] : current.filter(c => c !== 'email') });
                                                    }}
                                                />
                                                <span className="text-xs font-bold text-gray-700">Email</span>
                                            </label>
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 text-purple-600 rounded"
                                                    checked={formData.channels?.includes('whatsapp')}
                                                    onChange={e => {
                                                        const current = formData.channels || [];
                                                        setFormData({ ...formData, channels: e.target.checked ? [...current, 'whatsapp'] : current.filter(c => c !== 'whatsapp') });
                                                    }}
                                                />
                                                <span className="text-xs font-bold text-gray-700">WhatsApp</span>
                                            </label>
                                        </div>
                                    </div>

                                    <div>
                                        <label className="block text-xs font-bold text-gray-500 mb-1">Público y Programación</label>
                                        <div className="flex flex-wrap gap-1.5 mb-2">
                                            {DAYS.map(day => (
                                                <button
                                                    key={day.id}
                                                    type="button"
                                                    onClick={() => toggleDay(day.id)}
                                                    className={`w-8 h-8 rounded text-[10px] font-bold transition border ${formData.daysOfWeek?.includes(day.id)
                                                        ? 'bg-purple-600 text-white border-purple-600'
                                                        : 'bg-white text-gray-400 border-gray-200 hover:border-gray-300'
                                                        }`}
                                                >
                                                    {day.label.slice(0, 2)}
                                                </button>
                                            ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2 mt-2">
                                            <input
                                                type="date"
                                                title="Fecha Inicio"
                                                className="rounded-lg border-gray-200 border p-2 text-xs"
                                                value={formData.startDate}
                                                onChange={e => setFormData({ ...formData, startDate: e.target.value })}
                                            />
                                            <input
                                                type="date"
                                                title="Fecha Fin"
                                                className="rounded-lg border-gray-200 border p-2 text-xs"
                                                value={formData.endDate}
                                                onChange={e => setFormData({ ...formData, endDate: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>

                                {/* Columna Derecha: Diseño y Preview */}
                                <div className="space-y-4">
                                    {(formData.showInCarousel || formData.showInHomeBanner) ? (
                                        <>
                                            <h3 className="font-bold text-gray-800 border-b pb-2 mb-2 text-sm">Visual y Diseño</h3>

                                            <div className="bg-gray-50 p-3 rounded-xl border border-gray-200">
                                                <label className="block text-[10px] font-black text-gray-400 mb-2 uppercase text-center">Vista Previa</label>
                                                <div className="relative overflow-hidden rounded-xl shadow-md h-32 w-full transition-all">
                                                    {(() => {
                                                        const hasImg = !!formData.imageUrl;
                                                        const customStyle = {
                                                            backgroundColor: formData.backgroundColor || '#4F46E5',
                                                            color: formData.textColor || '#FFFFFF',
                                                            fontWeight: formData.fontWeight as any || 'normal'
                                                        };

                                                        let textPosClass = 'items-end justify-start'; // Default: bottom-left
                                                        if (formData.textPosition === 'bottom-center') textPosClass = 'items-end justify-center text-center';
                                                        if (formData.textPosition === 'bottom-right') textPosClass = 'items-end justify-end text-right';
                                                        if (formData.textPosition === 'center') textPosClass = 'items-center justify-center text-center';
                                                        if (formData.textPosition === 'top-left') textPosClass = 'items-start justify-start';
                                                        if (formData.textPosition === 'top-center') textPosClass = 'items-start justify-center text-center';
                                                        if (formData.textPosition === 'top-right') textPosClass = 'items-start justify-end text-right';

                                                        const titleClasses = {
                                                            'sm': 'text-sm', 'base': 'text-base', 'lg': 'text-lg', 'xl': 'text-xl', '2xl': 'text-2xl', '3xl': 'text-3xl', '4xl': 'text-4xl'
                                                        };
                                                        const descClasses = {
                                                            'xs': 'text-xs', 'sm': 'text-sm', 'base': 'text-base', 'lg': 'text-lg', 'xl': 'text-xl'
                                                        };

                                                        return (
                                                            <div className={`w-full h-full relative flex ${textPosClass} px-3 py-2`} style={customStyle}>
                                                                {hasImg && (
                                                                    <img
                                                                        src={formData.imageUrl}
                                                                        className={`absolute inset-0 w-full h-full ${formData.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                                                                        style={{ opacity: (formData.imageOpacity !== undefined ? formData.imageOpacity : 60) / 100 }}
                                                                        alt=""
                                                                    />
                                                                )}
                                                                <div className="relative z-10 w-full">
                                                                    {formData.showTitle !== false && (
                                                                        // @ts-ignore
                                                                        <h4 className={`leading-tight font-black ${titleClasses[formData.titleSize || '2xl'] || 'text-2xl'}`}>
                                                                            {formData.title || formData.name || 'Título Público'}
                                                                        </h4>
                                                                    )}
                                                                    {formData.showDescription !== false && (
                                                                        // @ts-ignore
                                                                        <p className={`opacity-80 whitespace-pre-wrap ${descClasses[formData.descriptionSize || 'sm'] || 'text-sm'}`}>
                                                                            {formData.description || 'Descripción pública...'}
                                                                        </p>
                                                                    )}
                                                                </div>
                                                            </div>
                                                        );
                                                    })()}
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Fondo</label>
                                                    <input type="color" className="w-full h-8 rounded cursor-pointer" value={formData.backgroundColor || '#4F46E5'} onChange={e => setFormData({ ...formData, backgroundColor: e.target.value })} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Texto</label>
                                                    <input type="color" className="w-full h-8 rounded cursor-pointer" value={formData.textColor || '#FFFFFF'} onChange={e => setFormData({ ...formData, textColor: e.target.value })} />
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Grosor Letra</label>
                                                    <select className="w-full rounded border p-1.5 text-xs" value={formData.fontWeight} onChange={e => setFormData({ ...formData, fontWeight: e.target.value as any })}>
                                                        <option value="normal">Común (Normal)</option>
                                                        <option value="bold">Negrita (Bold)</option>
                                                        <option value="900">Extra (Black)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Estilo Texto</label>
                                                    <select className="w-full rounded border p-1.5 text-xs" value={formData.fontStyle} onChange={e => setFormData({ ...formData, fontStyle: e.target.value as any })}>
                                                        <option value="sans">Moderna</option>
                                                        <option value="serif">Elegante</option>
                                                        <option value="mono">Mono</option>
                                                    </select>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-2 gap-3 mt-3">
                                                <div className="col-span-2">
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Posición del Texto</label>
                                                    <select className="w-full rounded border p-1.5 text-xs" value={formData.textPosition} onChange={e => setFormData({ ...formData, textPosition: e.target.value as any })}>
                                                        <option value="bottom-left">Abajo Izquierda</option>
                                                        <option value="bottom-center">Abajo Centro</option>
                                                        <option value="bottom-right">Abajo Derecha</option>
                                                        <option value="center">Centro</option>
                                                        <option value="top-left">Arriba Izquierda</option>
                                                        <option value="top-center">Arriba Centro</option>
                                                        <option value="top-right">Arriba Derecha</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-3 mt-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Tam. Título</label>
                                                    <select className="w-full rounded border p-1.5 text-xs" value={formData.titleSize || '2xl'} onChange={e => setFormData({ ...formData, titleSize: e.target.value as any })}>
                                                        <option value="sm">Pequeño</option>
                                                        <option value="base">Normal</option>
                                                        <option value="lg">Grande</option>
                                                        <option value="xl">Más Grande (XL)</option>
                                                        <option value="2xl">Titulo (2XL)</option>
                                                        <option value="3xl">Gigante (3XL)</option>
                                                        <option value="4xl">Massive (4XL)</option>
                                                    </select>
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-500 mb-1">Tam. Descripción</label>
                                                    <select className="w-full rounded border p-1.5 text-xs" value={formData.descriptionSize || 'sm'} onChange={e => setFormData({ ...formData, descriptionSize: e.target.value as any })}>
                                                        <option value="xs">Muy Pequeño</option>
                                                        <option value="sm">Pequeño (Default)</option>
                                                        <option value="base">Normal</option>
                                                        <option value="lg">Grande</option>
                                                        <option value="xl">Muy Grande</option>
                                                    </select>
                                                </div>
                                            </div>

                                            <div>
                                                <label className="block text-[10px] font-bold text-gray-500 mb-1 flex justify-between">
                                                    <span>Opacidad Imagen</span>
                                                    <span>{formData.imageOpacity || 60}%</span>
                                                </label>
                                                <input
                                                    type="range" min="0" max="100" step="10"
                                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                                                    style={{ accentColor: '#9333ea' }}
                                                    value={formData.imageOpacity !== undefined ? formData.imageOpacity : 60}
                                                    onChange={e => setFormData({ ...formData, imageOpacity: parseInt(e.target.value) })}
                                                />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">URL Imagen</label>
                                                <input type="url" placeholder="https://..." className="w-full rounded border p-2 text-xs" value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })} />
                                            </div>

                                            <div>
                                                <label className="block text-xs font-bold text-gray-500 mb-1">URL Destino / Link</label>
                                                <input type="text" placeholder="/rewards o https://..." className="w-full rounded border p-2 text-xs" value={formData.link} onChange={e => setFormData({ ...formData, link: e.target.value })} />
                                            </div>
                                        </>
                                    ) : (
                                        <div className="h-full flex items-center justify-center border-2 border-dashed border-gray-100 rounded-2xl p-8 text-center">
                                            <p className="text-gray-400 text-sm italic">Esta regla es solo de puntos.<br />No tiene visual en la App.</p>
                                        </div>
                                    )}
                                </div>

                                <div className="col-span-full pt-4 border-t border-gray-50 flex gap-3">
                                    <button type="button" onClick={() => { if (intent && !editingId) setIntent(null); else setIsModalOpen(false); }} className="flex-1 py-3 text-gray-500 font-medium hover:bg-gray-100 rounded-xl transition">
                                        {intent && !editingId ? 'Volver' : 'Cancelar'}
                                    </button>
                                    <button type="submit" className="flex-1 py-3 bg-purple-600 hover:bg-purple-700 text-white font-bold rounded-xl shadow-lg transition active:scale-95 flex items-center justify-center gap-2">
                                        <Save size={18} /> {editingId ? 'Actualizar' : 'Guardar'}
                                    </button>
                                </div>
                            </form>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
