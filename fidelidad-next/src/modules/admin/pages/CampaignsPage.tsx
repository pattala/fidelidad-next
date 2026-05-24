import React, { useState, useEffect } from 'react';
import {
    Plus, Trash2, Calendar, Target, Award, Save, X, Megaphone, Sparkles,
    ToggleLeft, ToggleRight, Edit, Send, Monitor, Layout, Clock, Image as ImageIcon,
    ChevronRight, Zap, Info, MousePointer2, MessageCircle, Type, Smartphone, AlignLeft, AlignCenter, AlignRight, Bold, Play, Shield, Copy, Download, CheckCircle
} from 'lucide-react';
import toast from 'react-hot-toast';
import { CampaignService, type BonusRule } from '../../../services/campaignService';
import { AuditService } from '../../../services/auditService';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import { useNavigate } from 'react-router-dom';
import { collection, getDocs, query } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { NotificationService } from '../../../services/notificationService';
import { EmailService } from '../../../services/emailService';
import { TimeService } from '../../../services/timeService';
import { useAdminAuth } from '../contexts/AdminAuthContext';

type TabType = 'BASIC' | 'SCHEDULE' | 'RULES' | 'VISUAL' | 'CONTENT';

export const CampaignsPage = () => {
    const navigate = useNavigate();
    const { isReadOnly } = useAdminAuth();
    const [bonuses, setBonuses] = useState<BonusRule[]>([]);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('BASIC');
    const [isFlashMode, setIsFlashMode] = useState(false);
    const [isTypeSelected, setIsTypeSelected] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);

    const [formData, setFormData] = useState<Partial<BonusRule>>({
        name: '', title: '', showTitle: true, description: '', showDescription: true,
        rewardType: 'FIXED', rewardValue: 50, rewardText: '', daysOfWeek: [], active: true,
        startDate: '', endDate: '', startTime: '', endTime: '',
        imageUrl: '', showInCarousel: true, showInHomeBanner: true,
        backgroundColor: '#4F46E5', textColor: '#FFFFFF',
        titleColor: '#FFFFFF', descriptionColor: '#FFFFFF',
        imageFit: 'contain', textPosition: 'bottom-left',
        // Typography - Title
        titleFont: 'sans', titleWeight: 'bold', titleSize: '2xl',
        // Typography - Description
        descFont: 'sans', descWeight: 'normal', descriptionSize: 'sm',
        buttonText: 'Ver detalles',
        imageOpacity: 60, bannerOpacity: 100, link: '', channels: ['push', 'email', 'whatsapp'],
        // Flash independent rewards
        flashTitle: '', flashDescription: '',
        flashRewardText: '',
        flashDays: [], flashGraceMins: 15,
        isInternal: false
    });

    const [isBroadcastModalOpen, setIsBroadcastModalOpen] = useState(false);
    const [broadcastData, setBroadcastData] = useState<any>(null);
    const [selectedChannels, setSelectedChannels] = useState({ push: true, email: true, whatsapp: true });
    const [isRunningEngine, setIsRunningEngine] = useState(false);

    const DAYS = [
        { id: 1, label: 'Lun' }, { id: 2, label: 'Mar' }, { id: 3, label: 'Mie' },
        { id: 4, label: 'Jue' }, { id: 5, label: 'Vie' }, { id: 6, label: 'Sab' }, { id: 0, label: 'Dom' }
    ];

    const [now, setNow] = useState(TimeService.now());

    useEffect(() => {
        const timer = setInterval(() => {
            setNow(TimeService.now());
        }, 1000);

        const handleSimChange = () => {
            setNow(TimeService.now());
        };
        window.addEventListener('time-simulation-change', handleSimChange);

        return () => {
            clearInterval(timer);
            window.removeEventListener('time-simulation-change', handleSimChange);
        };
    }, []);

    // COMPONENTE AISLADO PARA EL RELOJ (EVITA RE-RENDER GLOBAL)
    const FlashStatusTag = ({ bonus }: { bonus: BonusRule }) => {
        const currentDay = now.getDay();
        const currentTime = now.getHours() * 100 + now.getMinutes();
        const isDayMatch = bonus.flashDays?.includes(currentDay);
        const startTimeInt = parseInt((bonus.startTime || '00:00').replace(':', ''));
        const endTimeInt = parseInt((bonus.endTime || '23:59').replace(':', ''));

        const graceMins = (bonus.flashGraceMins !== undefined && bonus.flashGraceMins !== null) ? bonus.flashGraceMins : 15;
        const endDateTime = new Date(`1970-01-01T${bonus.endTime || '23:59'}:00`);
        endDateTime.setMinutes(endDateTime.getMinutes() + graceMins);
        const extendedEndTimeInt = endDateTime.getHours() * 100 + endDateTime.getMinutes();

        const todayStr = now.getFullYear() + "-" + String(now.getMonth() + 1).padStart(2, '0') + "-" + String(now.getDate()).padStart(2, '0');
        const campStartDate = bonus.startDate || bonus.flashDate || null;
        const isFutureStartDate = campStartDate && campStartDate > todayStr;
        const isExpiredEndDate = bonus.endDate && bonus.endDate < todayStr;

        const isCurrentlyOn = !isFutureStartDate && !isExpiredEndDate && isDayMatch && currentTime >= startTimeInt && currentTime <= endTimeInt && bonus.active;
        const isGracePeriod = !isFutureStartDate && !isExpiredEndDate && isDayMatch && currentTime > endTimeInt && currentTime <= extendedEndTimeInt && bonus.active;
        const isFinishedToday = isExpiredEndDate || (isDayMatch && currentTime > extendedEndTimeInt);
        const isFutureDay = bonus.active && !isFutureStartDate && !isExpiredEndDate && !isDayMatch;
        const isFutureTime = bonus.active && !isFutureStartDate && !isExpiredEndDate && isDayMatch && currentTime < startTimeInt;

        if (isCurrentlyOn) {
            return (
                <span className="bg-green-500 text-white text-[11px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-green-200 animate-pulse border-2 border-green-400 ring-2 ring-green-500/20">
                    <Zap size={12} fill="white" className="animate-bounce" /> FLASH ACTIVA
                    <div className="w-2 h-2 bg-white rounded-full animate-ping" />
                </span>
            );
        } else if (isGracePeriod) {
            const nowSecs = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
            const endSecs = endDateTime.getHours() * 3600 + endDateTime.getMinutes() * 60;
            const diff = Math.max(0, endSecs - nowSecs);
            const mm = Math.floor(diff / 60);
            const ss = diff % 60;
            return (
                <span className="bg-orange-500 text-white text-[11px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-orange-200 border-2 border-orange-400">
                    <Clock size={12} /> EN TOLERANCIA {mm}:{ss.toString().padStart(2, '0')}
                    <div className="w-2 h-2 bg-white/50 rounded-full animate-pulse" />
                </span>
            );
        } else if (isFutureDay || isFutureTime) {
            return (
                <span className="bg-indigo-500 text-white text-[11px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-indigo-200 border-2 border-indigo-400">
                    <Calendar size={12} /> PROGRAMADA
                </span>
            );
        } else if (isFinishedToday) {
            return (
                <span className="bg-red-600 text-white text-[11px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-red-200 border-2 border-red-400">
                    <Clock size={12} /> FLASH TERMINADA
                </span>
            );
        }
        return (
            <span className="bg-gray-500 text-white text-[11px] font-black px-4 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg shadow-gray-200 border-2 border-gray-400">
                <Zap size={12} fill="white" /> FLASH PROGRAMADA
            </span>
        );
    };

    const fetchBonuses = async () => {
        const data = await CampaignService.getAll();
        setBonuses(data);
    };

    useEffect(() => { fetchBonuses(); }, []);

    const resetForm = () => {
        setFormData({
            name: '', title: '', showTitle: true, description: '', showDescription: true,
            rewardType: 'FIXED', rewardValue: 50, rewardText: '', daysOfWeek: [], active: true,
            startDate: '', endDate: '', startTime: '', endTime: '',
            imageUrl: '', showInCarousel: true, showInHomeBanner: true,
            backgroundColor: '#4F46E5', textColor: '#FFFFFF',
            titleColor: '#FFFFFF', descriptionColor: '#FFFFFF',
            imageFit: 'contain', textPosition: 'bottom-left',
            titleFont: 'sans', titleWeight: 'bold', titleSize: '2xl',
            descFont: 'sans', descWeight: 'normal', descriptionSize: 'sm',
            buttonText: 'Ver detalles',
            imageOpacity: 60, bannerOpacity: 100, link: '', channels: ['push', 'email', 'whatsapp'],
            flashTitle: '', flashDescription: '',
            flashRewardType: 'FIXED', flashRewardValue: 50, flashRewardText: '',
            flashDays: [], flashGraceMins: 15,
            isInternal: false,
            autoBroadcast: false,
            broadcastLeadMins: 15
        });
        setEditingId(null);
        setActiveTab('BASIC');
        setIsFlashMode(false);
        setIsTypeSelected(false);
    };

    const handleTypeSelection = (flashMode: boolean) => {
        setIsFlashMode(flashMode);
        setIsTypeSelected(true);
        if (flashMode) {
            setFormData(prev => ({ ...prev, active: false }));
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        try {
            if (isFlashMode) {
                // Validación estricta
                if (!formData.flashDays || formData.flashDays.length === 0) {
                    toast.error('Debes seleccionar al menos un día para la oferta flash');
                    return;
                }
                if (!formData.startTime || !formData.endTime) {
                    toast.error('Debes configurar el horario de inicio y fin');
                    return;
                }

                if (editingId) {
                    // Si estamos editando y activando una campaña en el guardado (no debería pasar por el nuevo flujo, 
                    // pero mantenemos consistencia), el check de solapamiento ya no bloquea, solo previene si se intenta guardar activa.
                    // Sin embargo, según el nuevo flujo, Flash SIEMPRE se guarda inactiva.
                    formData.active = false;
                }
            }

            if (!isFlashMode && formData.rewardType === 'INFO' && !formData.imageUrl && !formData.description) {
                toast.error('Un anuncio debe tener imagen o descripción');
                return;
            }
            // @ts-ignore
            if (formData.rewardType === 'TEXT' && !formData.rewardText) {
                toast.error('Debes ingresar el texto del beneficio (Ej: 2x1)');
                return;
            }

            const payload: any = {
                ...formData,
                name: formData.name || 'Sin Nombre',
                active: !!formData.active,
                isFlash: isFlashMode,
                // Mutua exclusión: Limpiar campos según el tipo elegido
                rewardType: isFlashMode ? 'INFO' : formData.rewardType,
                rewardValue: isFlashMode ? 0 : ((formData.rewardType === 'INFO' || formData.rewardType === 'TEXT') ? 0 : formData.rewardValue),
                rewardText: isFlashMode ? '' : (formData.rewardText || ''),
                daysOfWeek: isFlashMode ? [] : (formData.daysOfWeek || []),

                // Si NO es flash, limpiamos los campos flash
                flashTitle: isFlashMode ? (formData.flashTitle || '') : '',
                flashRewardType: isFlashMode ? formData.flashRewardType : 'FIXED',
                flashRewardValue: isFlashMode ? formData.flashRewardValue : 0,
                flashRewardText: isFlashMode ? (formData.flashRewardText || '') : '',
                flashDays: isFlashMode ? formData.flashDays : [],
                flashGraceMins: isFlashMode ? formData.flashGraceMins : 0,

                startTime: isFlashMode ? formData.startTime : '',
                endTime: isFlashMode ? (formData.endTime || '') : '',
                broadcastLeadMins: formData.autoBroadcast ? (formData.broadcastLeadMins || 15) : 0,
                autoBroadcast: !!formData.autoBroadcast,
                isInternal: !!formData.isInternal
            };
            if (editingId) {
                await CampaignService.update(editingId, payload);
                toast.success('Campaña actualizada');
                await AuditService.log('campaign_updated', `Actualización de campaña: ${payload.name}`, [
                    { action: 'campaign_update', campaignId: editingId, name: payload.name }
                ]);
            } else {
                const newId = await CampaignService.create(payload);
                toast.success('Campaña creada');
                await AuditService.log('campaign_created', `Nueva campaña: ${payload.name}`, [
                    { action: 'campaign_create', name: payload.name }
                ]);
            }
            setIsModalOpen(false);
            fetchBonuses();
            resetForm();
        } catch (error) { toast.error('Error al guardar'); }
    };

    const handleEdit = (campaign: BonusRule) => {
        setFormData({ ...campaign });
        setIsFlashMode(!!campaign.isFlash);
        setIsTypeSelected(true);
        setEditingId(campaign.id);
        setActiveTab('BASIC');
        setIsModalOpen(true);
    };

    const handleToggleActive = async (bonus: BonusRule) => {
        if (isReadOnly) return;

        if (!bonus.active && bonus.isFlash) {
            const overlapping = bonuses.find(b => {
                if (b.id === bonus.id || !b.isFlash || !b.active) return false;

                // Días
                const daysIntersect = bonus.flashDays?.some(d => (b as any).flashDays?.includes(d));
                if (!daysIntersect) return false;

                // Horarios Nominales (SIN TOLERANCIA)
                const newStart = bonus.startTime || '00:00';
                const newEnd = bonus.endTime || '23:59';
                const oldStart = b.startTime || '00:00';
                const oldEnd = b.endTime || '23:59';

                return (newStart < oldEnd && newEnd > oldStart);
            });

            if (overlapping) {
                if (confirm(`La oferta "${bonus.name}" se solapa con "${overlapping.name}", que ya está activa.\n\n¿Deseas desactivar "${overlapping.name}" y activar esta ahora?`)) {
                    try {
                        // 1. Desactivar la previa
                        await CampaignService.update(overlapping.id, { active: false });
                        await AuditService.log('campaign_mgmt', `Alternancia automática: Desactivación de "${overlapping.name}" por solapamiento con "${bonus.name}"`, [
                            { action: 'campaign_auto_toggle_off', campaignId: overlapping.id, reason: 'overlap_switching', targetCampaignId: bonus.id }
                        ]);

                        // 2. Activar la nueva
                        await CampaignService.update(bonus.id, { active: true });
                        await AuditService.log('campaign_mgmt', `Alternancia automática: Activación de "${bonus.name}" (reemplaza a "${overlapping.name}")`, [
                            { action: 'campaign_auto_toggle_on', campaignId: bonus.id, replacedId: overlapping.id }
                        ]);

                        toast.success(`Campaña "${bonus.name}" activada correctamente.`);
                        fetchBonuses();
                        return;
                    } catch (e) {
                        toast.error('Error al realizar el cambio de oferta');
                        return;
                    }
                }
                return; // User canceled
            }
        }

        try {
            const newStatus = !bonus.active;
            await CampaignService.update(bonus.id, { active: newStatus });
            toast.success(newStatus ? 'Campaña activada' : 'Campaña desactivada');
            await AuditService.log('campaign_mgmt', `${newStatus ? 'Activación' : 'Desactivación'} de campaña: ${bonus.name}`, [
                { action: 'campaign_toggle', campaignId: bonus.id, active: newStatus }
            ]);
            fetchBonuses();
        } catch (error) { toast.error('Error'); }
    };

    const handleDelete = async (id: string, name?: string) => {
        if (!confirm('¿Eliminar esta campaña?')) return;
        try {
            await CampaignService.delete(id);
            toast.success('Eliminada');
            await AuditService.log('campaign_deleted', `Campaña eliminada: ${name || id}`, [
                { action: 'campaign_delete', campaignId: id, name }
            ]);
            fetchBonuses();
        } catch (error) { toast.error('Error'); }
    };

    const handleDuplicate = async (bonus: BonusRule) => {
        if (isReadOnly) return;
        const load = toast.loading('Duplicando campaña...');
        try {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { id, ...rest } = bonus;
            const newBonus = {
                ...rest,
                name: `${bonus.name} (COPIA)`,
                active: false // Requested by user
            };
            await CampaignService.create(newBonus as Omit<BonusRule, 'id'>);
            toast.success('Campaña duplicada correctamente', { id: load });
            fetchBonuses();
        } catch (error) {
            toast.error('Error al duplicar la campaña', { id: load });
            console.error(error);
        }
    };

    const handleDownloadCSV = async (bonus: BonusRule) => {
        if (isReadOnly) return;
        const load = toast.loading('Generando CSV...');
        try {
            const config = await ConfigService.get();
            // @ts-ignore
            const eventType = bonus.rewardType === 'INFO' || bonus.rewardType === 'TEXT' ? 'offer' : 'campaign';
            
            let template = "";
            if (bonus.isFlash) {
                template = config?.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
            } else if (bonus.rewardType === 'INFO' || (bonus.rewardType as any) === 'TEXT') {
                template = config?.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer;
            } else {
                template = config?.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign;
            }

            const q = query(collection(db, 'users'));
            const snap = await getDocs(q);
            
            let csvContent = "Nombre,Telefono,Mensaje\n";
            
            snap.forEach(doc => {
                const data = doc.data();
                if (data.role === 'admin' || !data.phone) return;
                
                let phoneNum = data.phone.replace(/\D/g, '');
                if (!phoneNum.startsWith('54') && phoneNum.length === 10) phoneNum = '549' + phoneNum;

                const userName = data.name || data.nombre || '';
                const firstName = userName.split(' ')[0];
                
                let msg = template.replace(/{nombre}/g, firstName).replace(/{nombre_completo}/g, userName);
                
                if (bonus.isFlash) {
                    const horario = bonus.endTime || '23:59';
                    msg = msg.replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                             .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : 'Consultanos.'))
                             .replace(/{horario}/g, horario);
                } else if (bonus.rewardType === 'INFO' || (bonus.rewardType as any) === 'TEXT') {
                    const vencimiento = bonus.endDate ? new Date(bonus.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' }) : 'agotar stock';
                    msg = msg.replace(/{titulo}/g, bonus.title || bonus.name)
                             .replace(/{detalle}/g, bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : 'Consultanos.'))
                             .replace(/{vencimiento}/g, vencimiento);
                } else {
                    msg = msg.replace(/{titulo}/g, bonus.title || bonus.name)
                             .replace(/{descripcion}/g, bonus.description || '¡Sumá más puntos!');
                }

                const escapeCSV = (str: string) => `"${str.replace(/"/g, '""')}"`;
                csvContent += `${escapeCSV(userName)},${phoneNum},${escapeCSV(msg)}\n`;
            });

            const blob = new Blob(["\uFEFF" + csvContent], { type: 'text/csv;charset=utf-8;' });
            const link = document.createElement("a");
            const url = URL.createObjectURL(blob);
            link.setAttribute("href", url);
            link.setAttribute("download", `Campaña_${bonus.name.replace(/\s+/g, '_')}_WhatsApp.csv`);
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            toast.success('CSV descargado', { id: load });
            
            await AuditService.log('campaign_whatsapp_csv', `Descarga CSV WhatsApp: ${bonus.name}`, [
                { action: 'csv_downloaded', campaignId: bonus.id }
            ]);

        } catch (e) {
            toast.error('Error al generar CSV', { id: load });
            console.error(e);
        }
    };

    const handleBroadcast = async (bonus: BonusRule) => {
        try {
            const config = await ConfigService.get();
            // @ts-ignore
            const eventType = bonus.rewardType === 'INFO' || bonus.rewardType === 'TEXT' ? 'offer' : 'campaign';

            let template = "";
            let msg = "";

            if (bonus.isFlash) {
                template = config?.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer;
                const horario = bonus.endTime || '23:59';
                msg = template
                    .replace(/{titulo}/g, bonus.flashTitle || bonus.title || bonus.name)
                    .replace(/{detalle}/g, bonus.flashDescription || bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : 'Consultanos.'))
                    .replace(/{horario}/g, horario);
            } else if (bonus.rewardType === 'INFO' || (bonus.rewardType as any) === 'TEXT') {
                template = config?.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer;
                const vencimiento = bonus.endDate
                    ? new Date(bonus.endDate + 'T00:00:00').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })
                    : 'agotar stock';
                msg = template
                    .replace(/{titulo}/g, bonus.title || bonus.name)
                    .replace(/{detalle}/g, bonus.description || (bonus.rewardText ? `¡${bonus.rewardText}!` : 'Consultanos.'))
                    .replace(/{vencimiento}/g, vencimiento);
            } else {
                template = config?.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign;
                msg = template
                    .replace(/{titulo}/g, bonus.title || bonus.name)
                    .replace(/{descripcion}/g, bonus.description || '¡Sumá más puntos!');
            }

            setBroadcastData({ bonus, msg, eventType, config });
            setSelectedChannels({
                push: (bonus.channels?.includes('push') ?? true) && NotificationService.isChannelEnabled(config, eventType, 'push'),
                email: (bonus.channels?.includes('email') ?? true) && NotificationService.isChannelEnabled(config, eventType, 'email'),
                whatsapp: (bonus.channels?.includes('whatsapp') ?? true) && NotificationService.isChannelEnabled(config, eventType, 'whatsapp')
            });
            setIsBroadcastModalOpen(true);
        } catch (error) {
            toast.error('Error al preparar difusión');
        }
    };

    const executeBroadcast = async () => {
        if (!broadcastData) return;
        const { bonus, msg, eventType, config } = broadcastData;
        setIsBroadcastModalOpen(false);

        try {
            // Obtener usuarios no administradores una sola vez para optimizar lecturas
            const q = query(collection(db, 'users'));
            const snap = await getDocs(q);
            const clientsDocs = snap.docs.filter(doc => doc.data().role !== 'admin');
            const totalUsers = clientsDocs.length;

            if (selectedChannels.push) {
                const loadingToast = toast.loading('Enviando Pushes...');
                const pushPromises = clientsDocs.map(doc => {
                    const data = doc.data();
                    const userName = data.name || '';
                    const personalizedMsg = msg.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName);
                    return NotificationService.sendToClient(doc.id, {
                        title: bonus.rewardType === 'INFO' ? '¡Nueva Oferta!' : '¡Nueva Campaña!',
                        body: personalizedMsg,
                        type: eventType,
                        icon: config?.logoUrl
                    });
                });
                await Promise.allSettled(pushPromises);
                toast.success(`Push enviado correctamente`, { id: loadingToast });
            }

            if (selectedChannels.email) {
                const loadingToast = toast.loading('Enviando Emails...');
                const emailPromises = clientsDocs.map(doc => {
                    const data = doc.data();
                    if (data.email) {
                        const userName = data.name || '';
                        const personalizedMsg = msg.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName);
                        const htmlContent = EmailService.generateBrandedTemplate(config, bonus.rewardType === 'INFO' ? '¡Oferta Especial!' : '¡Nueva Campaña!', personalizedMsg);
                        return EmailService.sendEmail(data.email, bonus.rewardType === 'INFO' ? '¡Oferta Especial!' : '¡Nueva Campaña!', htmlContent);
                    }
                    return null;
                }).filter(Boolean);
                await Promise.allSettled(emailPromises);
                toast.success(`Emails enviados correctamente`, { id: loadingToast });
            }

            if (selectedChannels.whatsapp) {
                // 1. Descargar el CSV para uso masivo externo
                toast.success('Descargando CSV para WhatsApp...', { duration: 3000 });
                handleDownloadCSV(bonus);

                // 2. Redirigir a la cola interactiva interna precargando mensaje y clientes
                setTimeout(() => {
                    toast.success('Redirigiendo a cola de difusión de WhatsApp...');
                    navigate('/admin/whatsapp', {
                        state: {
                            message: msg,
                            clientIds: clientsDocs.map(d => d.id),
                            notificationType: 'campaign'
                        }
                    });
                }, 1500);
            }

            // --- AUDITORIA ---
            await AuditService.log('campaign_broadcast', `Difusión masiva de campaña: ${bonus.name}`, [
                {
                    campId: bonus.id,
                    campName: bonus.name,
                    action: 'campaign_broadcasted',
                    status: 'success',
                    userCount: totalUsers, // Logeado para mostrar correctamente los Socios Afectados
                    timestamp: now.toISOString(),
                    info: `Canales: ${Object.entries(selectedChannels).filter(([_, v]) => v).map(([k]) => k).join(', ')} | Tipo: ${bonus.isFlash ? 'Flash' : 'Estándar'}`
                }
            ]);} catch (error) {
            toast.error('Error durante la difusión');
            console.error(error);
        }
    };

    const toggleDay = (dayId: number, isFlash: boolean = false) => {
        const field = isFlash ? 'flashDays' : 'daysOfWeek';
        const current = (formData as any)[field] || [];
        setFormData({
            ...formData,
            [field]: current.includes(dayId) ? current.filter((d: number) => d !== dayId) : [...current, dayId].sort()
        });
    };



    // Helper for Text Position
    const getPositionClasses = (pos: string | undefined) => {
        switch (pos) {
            case 'top-left': return 'justify-start items-start text-left';
            case 'top-center': return 'justify-start items-center text-center';
            case 'top-right': return 'justify-start items-end text-right';
            case 'center': return 'justify-center items-center text-center';
            case 'bottom-right': return 'justify-end items-end text-right';
            case 'bottom-center': return 'justify-end items-center text-center';
            case 'bottom-left': return 'justify-end items-start text-left';
            default: return 'justify-end items-start text-left';
        }
    };

    const getFontFamily = (style: string | undefined) => {
        switch (style) {
            case 'serif': return 'font-serif';
            case 'mono': return 'font-mono';
            default: return 'font-sans';
        }
    };

    const getFontWeight = (w: string | number | undefined) => {
        switch (w) {
            case 'bold': case '700': return 'font-bold';
            case 'semibold': case '600': return 'font-semibold';
            case 'light': case '300': return 'font-light';
            default: return 'font-normal';
        }
    };

    // Componente de Vista Previa Reutilizable
    const PreviewCard = ({ className = "" }: { className?: string }) => (
        <div className={`relative overflow-hidden rounded-[2rem] shadow-sm h-48 border border-gray-100 bg-gray-50 flex-shrink-0 ${className}`}>
            <div className="absolute inset-0" style={{ backgroundColor: formData.backgroundColor, opacity: (formData.bannerOpacity || 100) / 100 }} />
            {formData.imageUrl ? (
                <>
                    <img
                        src={formData.imageUrl}
                        className={`absolute inset-0 w-full h-full ${formData.imageFit === 'cover' ? 'object-cover' : 'object-contain'}`}
                        style={{ opacity: (formData.imageOpacity || 0) / 100 }}
                        alt=""
                    />
                    {/* GRADIENT OVERLAY */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent"></div>
                </>
            ) : (
                <div className="absolute inset-0 flex items-center justify-center text-white/20">
                    <ImageIcon size={48} />
                </div>
            )}

            <div className={`relative z-10 w-full h-full p-6 flex flex-col pointer-events-none ${getPositionClasses(formData.textPosition)}`}>
                {formData.showTitle && (
                    <h4 className={`leading-[1.1] mb-1 uppercase tracking-tight drop-shadow-md ${getFontFamily(formData.titleFont)} ${getFontWeight(formData.titleWeight)} text-${formData.titleSize || '2xl'}`} style={{ color: formData.titleColor || formData.textColor }}>
                        {formData.title || 'Título de la Campaña'}
                    </h4>
                )}
                {formData.showDescription && (
                    <p className={`opacity-90 leading-snug whitespace-pre-wrap drop-shadow-sm line-clamp-3 ${getFontFamily(formData.descFont)} ${getFontWeight(formData.descWeight)} text-${formData.descriptionSize || 'sm'}`} style={{ color: formData.descriptionColor || formData.textColor }}>
                        {formData.description || 'Descripción breve de la promoción...'}
                    </p>
                )}
            </div>
        </div>
    );

    // PWA Simulator - NEW Component for Contextual Preview
    const PWASimulator = () => (
        <div className="mx-auto w-full max-w-[320px] bg-white border-2 border-gray-900 rounded-[2.5rem] overflow-hidden shadow-2xl relative select-none pointer-events-none transform scale-95 origin-top">
            {/* Status Bar Mock */}
            <div className="h-6 bg-gray-900 w-full flex justify-between items-center px-4">
                <div className="flex gap-1">
                    <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
                    <div className="w-1 h-1 bg-white rounded-full opacity-50"></div>
                </div>
                <div className="w-12 h-3 bg-black rounded-b-xl opacity-50"></div>
                <div className="w-3 h-3 border border-white rounded-sm opacity-50"></div>
            </div>

            {/* App Header */}
            <div className="bg-red-900 text-white p-4 flex justify-between items-center h-14">
                <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-xs font-bold">JD</div>
                <div className="text-[10px] font-black tracking-widest uppercase opacity-80">CLUB FIDELIDAD</div>
                <div className="opacity-60"><Sparkles size={14} /></div>
            </div>

            <div className="p-3 bg-gray-50 h-[500px] overflow-y-auto space-y-4 relative">
                {isFlashMode && (
                    <div className="bg-gradient-to-r from-red-600 to-orange-500 p-4 rounded-[1.5rem] shadow-lg text-white relative overflow-hidden mb-1 border-2 border-white/20 animate-pulse-slow">
                        <div className="absolute -top-4 -right-4 opacity-10"><Clock size={40} /></div>
                        <div className="relative z-10">
                            <div className="flex items-center gap-1 mb-1">
                                <Sparkles size={10} className="animate-bounce" />
                                <span className="text-[7px] font-black uppercase tracking-widest">Oferta Flash Activa</span>
                            </div>
                            <h3 className="text-xs font-black truncate leading-tight mb-2 italic">
                                {formData.flashTitle || 'Título Flash'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <div className="bg-white/20 backdrop-blur-md px-2 py-1 rounded-lg border border-white/10 shrink-0">
                                    <p className="text-[6px] font-bold opacity-80 uppercase leading-none mb-0.5 text-center">Finaliza:</p>
                                    <p className="text-[10px] font-black font-mono leading-none tracking-tighter">{formData.endTime || '00:00'}</p>
                                </div>
                                <div className="flex flex-col min-w-0">
                                    <span className="text-[10px] font-black leading-none truncate uppercase">
                                        {formData.flashRewardType === 'TEXT' ? (formData.flashRewardText || 'Promo') :
                                            formData.flashRewardType === 'MULTIPLIER' ? `x${formData.flashRewardValue} Puntos` :
                                                `+${formData.flashRewardValue} Puntos`}
                                    </span>
                                    <span className="text-[6px] font-bold opacity-80 uppercase leading-none mt-0.5 truncate tracking-tighter">¡Aprovechala ahora!</span>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* Carousel Section */}
                <div>
                    <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest mb-2 px-1">Destacados</p>
                    {formData.showInCarousel ? (
                        <PreviewCard className="animate-fade-in" />
                    ) : (
                        <div className="h-32 bg-gray-200 rounded-[1.5rem] flex items-center justify-center border-2 border-dashed border-gray-300">
                            <p className="text-[9px] text-gray-400 font-bold uppercase text-center px-4">Esta campaña NO aparecerá aquí</p>
                        </div>
                    )}
                </div>

                {/* Points Balance Mock */}
                <div className="bg-white p-4 rounded-[1.5rem] shadow-sm border border-gray-100 flex justify-between items-center">
                    <div>
                        <p className="text-[9px] font-bold text-gray-400 uppercase">Tus Puntos</p>
                        <p className="text-2xl font-black text-purple-600">1.250 PTS</p>
                    </div>
                    <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-full flex items-center justify-center">
                        <Award size={20} />
                    </div>
                </div>

                {/* List/Banner Section */}
                <div>
                    <div className="flex justify-between items-center mb-2 px-1">
                        <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Promos Vigentes</p>
                        <p className="text-[8px] font-bold text-purple-600 uppercase">Ver Todas</p>
                    </div>



                    {formData.showInHomeBanner ? (
                        <div className="bg-white p-3 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center gap-3 animate-fade-in">
                            <div className="w-16 h-16 rounded-xl bg-gray-100 overflow-hidden shrink-0 relative">
                                {formData.imageUrl ? <img src={formData.imageUrl} className="w-full h-full object-cover" alt="" /> : <ImageIcon size={24} className="text-gray-300 m-auto mt-4" />}
                            </div>
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-800 text-xs truncate leading-tight mb-1">
                                    {formData.title || 'Título'}
                                </h4>
                                <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed">
                                    {formData.description || 'Descripción...'}
                                </p>
                                <button className="mt-2 text-[9px] font-black text-purple-600 bg-purple-50 px-2 py-1 rounded inline-block">VER DETALLES</button>
                            </div>
                        </div>
                    ) : (
                        <div className="h-20 bg-gray-200 rounded-[1.5rem] flex items-center justify-center border-2 border-dashed border-gray-300">
                            <p className="text-[8px] text-gray-400 font-bold uppercase text-center px-4">No aparecerá en lista</p>
                        </div>
                    )}

                    {/* Fake Other Items */}
                    <div className="mt-2 opacity-40">
                        <div className="bg-white p-3 rounded-[1.5rem] shadow-sm border border-gray-100 flex items-center gap-3">
                            <div className="w-16 h-16 rounded-xl bg-gray-200 shrink-0"></div>
                            <div className="flex-1 space-y-2">
                                <div className="h-3 w-24 bg-gray-200 rounded-full"></div>
                                <div className="h-2 w-32 bg-gray-100 rounded-full"></div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Nav Bar Mock */}
            <div className="h-12 bg-white border-t border-gray-100 absolute bottom-0 w-full flex justify-around items-center px-4">
                <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Target size={18} /></div>
                <div className="p-2 text-gray-300"><ImageIcon size={18} /></div>
                <div className="p-2 text-gray-300"><Award size={18} /></div>
            </div>
        </div>
    );


    return (
        <div className="space-y-6 animate-fade-in pb-20">
            {/* Header Moderno */}
            <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div className="flex items-center gap-4">
                    <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                        <Target size={28} />
                    </div>
                    <div>
                        <h1 className="text-2xl font-black text-gray-800 tracking-tight">Gestión de Campañas</h1>
                        <p className="text-sm text-gray-500 font-medium italic">Gestión avanzada de beneficios y anuncios</p>
                    </div>
                </div>
                {!isReadOnly && (
                    <div className="flex items-center gap-3">
                        <button
                            onClick={async () => {
                                if (isRunningEngine) return;
                                const confirmRun = confirm("¿Deseas ejecutar el motor de campañas manualmente ahora?\n\nEsto desactivará las expiradas e intentará enviar difusiones programadas (ignorando el control de duplicidad de hoy).");
                                if (!confirmRun) return;

                                setIsRunningEngine(true);
                                const load = toast.loading("Ejecutando motor...");
                                try {
                                    const res = await CampaignService.runEngine('manual', true);
                                    toast.success(`Motor finalizado: ${res.results.notified} notificaciones, ${res.results.deactivated} desactivadas.`, { id: load });
                                    fetchBonuses();
                                } catch (e) {
                                    toast.error("Error al ejecutar el motor", { id: load });
                                } finally {
                                    setIsRunningEngine(false);
                                }
                            }}
                            disabled={isRunningEngine}
                            className={`px-4 py-3 rounded-2xl font-bold flex items-center gap-2 transition-all active:scale-95 ${isRunningEngine ? 'bg-gray-100 text-gray-400' : 'bg-blue-50 text-blue-600 hover:bg-blue-100'}`}
                            title="Mantenimiento y Difusión Manual"
                        >
                            <Play size={18} className={isRunningEngine ? 'animate-pulse' : ''} />
                            <span className="hidden md:inline">Ejecutar Motor</span>
                        </button>

                        <button
                            onClick={() => { resetForm(); setIsModalOpen(true); }}
                            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-2xl font-bold shadow-lg shadow-purple-200 transition-all active:scale-95 flex items-center gap-2"
                        >
                            <Plus size={20} /> Nueva Campaña
                        </button>
                    </div>
                )}
            </div>

            {/* Dashboard / Lista */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {bonuses.map(bonus => (
                    <div key={bonus.id} className={`bg-white rounded-[2.5rem] p-4 border border-gray-100 shadow-sm hover:shadow-2xl transition-all duration-300 group overflow-hidden relative flex flex-col h-full ${!bonus.active ? 'opacity-75 grayscale bg-gray-50/50' : ''} ${bonus.isFlash && bonus.active ? 'ring-2 ring-red-500/20 shadow-red-100' : ''}`}>
                        {/* Status Float */}
                        <div className="absolute top-6 right-6 z-10">
                            <button
                                onClick={() => handleToggleActive(bonus)}
                                className={`p-2 rounded-full backdrop-blur-md transition-all transform active:scale-95 ${bonus.active ? 'bg-green-500/10 text-green-600' : 'bg-gray-100 text-gray-400'}`}
                            >
                                {bonus.active ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                            </button>
                        </div>

                        {/* Banner Preview Area */}
                        <div className={`h-40 rounded-[2rem] overflow-hidden relative mb-4 shadow-inner ${bonus.isFlash ? 'bg-gradient-to-br from-red-50 to-orange-50' : 'bg-gray-50'}`}>
                            {bonus.imageUrl ? (
                                <img src={bonus.imageUrl} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt="" />
                            ) : (
                                <div className="w-full h-full flex flex-col items-center justify-center text-gray-300 gap-2">
                                    <div className={`p-4 rounded-full ${bonus.isFlash ? 'bg-red-100 text-red-300' : 'bg-gray-100'}`}>
                                        <ImageIcon size={32} />
                                    </div>
                                    <span className="text-[10px] font-black uppercase tracking-tighter opacity-50">Sin Imagen</span>
                                </div>
                            )}

                            {bonus.isFlash && (
                                <div className="absolute top-5 -left-12 bg-gradient-to-r from-red-600 to-red-500 text-white text-[11px] font-black py-2 w-48 text-center -rotate-45 shadow-xl z-20 uppercase tracking-[0.2em] border-b-2 border-red-400/50 backdrop-blur-sm">
                                    <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
                                </div>
                            )}

                            {bonus.isFlash && (
                                <div className="absolute top-5 -left-12 bg-gradient-to-r from-red-600 to-red-500 text-white text-[11px] font-black py-2 w-48 text-center -rotate-45 shadow-xl z-20 uppercase tracking-[0.2em] border-b-2 border-red-400/50 backdrop-blur-sm">
                                    Oferta Flash
                                    <div className="absolute inset-0 bg-gradient-to-t from-white/20 to-transparent pointer-events-none" />
                                </div>
                            )}

                            {bonus.isInternal && (
                                <div className="absolute top-4 left-4 bg-blue-600 text-white text-[9px] font-black px-2 py-0.5 rounded shadow-lg z-20 flex items-center gap-1 uppercase">
                                    <Shield size={10} /> Sólo Testers
                                </div>
                            )}

                            {/* Tags de Tipo */}
                            <div className="absolute bottom-4 left-4 flex flex-wrap gap-2">
                                {bonus.isFlash && <FlashStatusTag bonus={bonus} />}
                                {bonus.isFlash && (bonus.flashRewardType === 'TEXT' ? (
                                    <span className="bg-orange-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg shadow-orange-200">
                                        <Type size={10} fill="white" /> {bonus.flashRewardText || 'PROMO'}
                                    </span>
                                ) : (
                                    <span className="bg-red-600 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-lg shadow-red-200">
                                        {bonus.flashRewardType === 'MULTIPLIER' ? <Zap size={10} fill="white" /> : <Sparkles size={10} />}
                                        {bonus.flashRewardType === 'MULTIPLIER' ? `x${bonus.flashRewardValue}` : `+${bonus.flashRewardValue}`}
                                    </span>
                                ))}

                                {bonus.endDate && (
                                    <span className={`text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1 shadow-sm border ${
                                        TimeService.isExpired(bonus.endDate)
                                            ? 'bg-red-50 text-red-600 border-red-100'
                                            : (bonus.endDate === now.toLocaleDateString('en-CA'))
                                                ? 'bg-amber-50 text-amber-600 border-amber-100 animate-pulse'
                                                : 'bg-blue-50 text-blue-600 border-blue-100'
                                    }`}>
                                        <Clock size={10} />
                                        {TimeService.isExpired(bonus.endDate) ? 'EXPIRADA' : `VENCE: ${TimeService.formatDisplayDate(bonus.endDate)}`}
                                    </span>
                                )}

                                {(bonus.rewardType as any) === 'TEXT' ? (
                                    <span className="bg-pink-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1">
                                        <Type size={10} fill="white" /> PROMO
                                    </span>
                                ) : bonus.rewardType !== 'INFO' ? (
                                    <span className="bg-purple-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1">
                                        <Sparkles size={10} /> PUNTOS
                                    </span>
                                ) : bonus.rewardType !== 'INFO' || !bonus.isFlash ? (
                                    <span className="bg-blue-500 text-white text-[10px] font-black px-3 py-1 rounded-full flex items-center gap-1">
                                        <Info size={10} /> INFO
                                    </span>
                                ) : null}
                            </div>
                        </div>

                        {/* Content */}
                        <div className="px-2 flex-1 flex flex-col mt-2">
                            <h3 className="text-xl font-bold text-gray-800 truncate mb-1 group-hover:text-purple-600 transition-colors">
                                {bonus.isFlash ? (bonus.flashTitle || bonus.title || bonus.name) : bonus.name}
                            </h3>
                            <p className={`text-[11px] line-clamp-2 h-8 leading-relaxed mb-4 font-medium flex-1 ${bonus.active ? 'text-gray-500' : 'text-gray-400'}`}>
                                {bonus.isFlash ? (bonus.flashDescription || bonus.description || 'Sin descripción flash.') : (bonus.description || 'Sin descripción pública configurada.')}
                            </p>

                            <div className="flex items-center justify-between pt-3 border-t border-gray-50">
                                <div className="flex gap-1 items-center">
                                    {(bonus.isFlash ? (bonus as any).flashDays || [] : bonus.daysOfWeek || []).map((dayId: number) => {
                                        const d = DAYS.find(day => day.id === dayId);
                                        return (
                                            <div key={dayId} className={`w-4 h-4 rounded-full flex items-center justify-center text-[8px] font-bold ${bonus.active ? 'bg-black text-white' : 'bg-gray-200 text-white'}`}>
                                                {d?.label.charAt(0)}
                                            </div>
                                        );
                                    })}
                                    {bonus.isFlash && bonus.startTime && (
                                        <div className="ml-2 text-[9px] font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex items-center gap-1 border border-red-100">
                                            <Clock size={10} /> {bonus.startTime} - {bonus.endTime}
                                        </div>
                                    )}
                                    {!bonus.isFlash && bonus.startDate && (
                                        <div className="text-[9px] font-bold text-gray-400 flex items-center gap-1 ml-1" title="Fecha de Inicio">
                                            <Calendar size={10} /> {TimeService.formatDisplayDate(bonus.startDate)}
                                        </div>
                                    )}
                                </div>

                                <div className="flex items-center gap-1">
                                    {!isReadOnly && (
                                        <>
                                            <button
                                                onClick={() => handleEdit(bonus)}
                                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-xl transition-all transform active:scale-90"
                                                title="Editar"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDuplicate(bonus)}
                                                className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-xl transition-all transform active:scale-90"
                                                title="Duplicar"
                                            >
                                                <Copy size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDownloadCSV(bonus)}
                                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-xl transition-all transform active:scale-90"
                                                title="Descargar CSV WhatsApp"
                                            >
                                                <Download size={18} />
                                            </button>
                                            
                                            <button
                                                onClick={() => {
                                                    const todayStr = TimeService.now().toISOString().split('T')[0];
                                                    if (bonus.broadcastSentAt === todayStr) {
                                                        if(!confirm("Esta campaña ya fue enviada automáticamente hoy. ¿Estás seguro que deseas FORZAR un re-envío a todos?")) return;
                                                    }
                                                    handleBroadcast(bonus);
                                                }}
                                                className={`p-2 rounded-xl transition-all transform active:scale-90 ${bonus.broadcastSentAt === TimeService.now().toISOString().split('T')[0] ? 'text-green-500 bg-green-50/50 hover:bg-green-100 hover:text-green-700' : 'text-gray-400 hover:text-blue-600 hover:bg-blue-50'}`}
                                                title={bonus.broadcastSentAt === TimeService.now().toISOString().split('T')[0] ? "✅ Enviado Hoy (Forzar Re-envío)" : "Forzar Envío"}
                                            >
                                                {bonus.broadcastSentAt === TimeService.now().toISOString().split('T')[0] ? <CheckCircle size={18} /> : <Play size={18} />}
                                            </button>
                                            <button
                                                onClick={() => handleDelete(bonus.id, bonus.name)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all transform active:scale-90"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL REDISEÑADO */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 md:p-8">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => { setIsModalOpen(false); resetForm(); }} />

                        <div className="bg-white w-full max-w-6xl h-[90vh] rounded-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col md:flex-row animate-scale-up">

                            {!isTypeSelected && !editingId ? (
                                <div className="flex-1 flex flex-col items-center justify-center p-12 bg-gray-50 text-center">
                                    <div className="mb-8">
                                        <div className="w-20 h-20 bg-purple-100 text-purple-600 rounded-3xl mx-auto flex items-center justify-center mb-4">
                                            <Plus size={40} />
                                        </div>
                                        <h2 className="text-3xl font-black text-gray-800 tracking-tighter uppercase">Nueva Campaña</h2>
                                        <p className="text-gray-500 font-medium">¿Qué tipo de campaña deseas crear hoy?</p>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
                                        <button
                                            onClick={() => handleTypeSelection(false)}
                                            className="group bg-white p-8 rounded-[2.5rem] border-2 border-transparent hover:border-purple-500 hover:shadow-xl transition-all text-left flex flex-col gap-4 shadow-sm"
                                        >
                                            <div className="w-14 h-14 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Target size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Tradicional</h3>
                                                <p className="text-sm text-gray-500 font-medium leading-relaxed">Campaños de puntos fijos, multiplicadores semanales y anuncios de larga duración.</p>
                                            </div>
                                        </button>

                                        <button
                                            onClick={() => { handleTypeSelection(true); setActiveTab('CONTENT'); }}
                                            className="p-8 rounded-[2.5rem] bg-gradient-to-br from-red-50 to-orange-50 border-2 border-red-100 hover:border-red-300 transition-all text-left flex flex-col group active:scale-95"
                                        >
                                            <div className="w-14 h-14 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform">
                                                <Zap size={32} />
                                            </div>
                                            <div>
                                                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Oferta Flash</h3>
                                                <p className="text-sm text-gray-500 font-medium leading-relaxed">Promociones urgentes con horario específico, cronómetro y notificaciones de alta prioridad.</p>
                                            </div>
                                        </button>
                                    </div>

                                    <button onClick={() => setIsModalOpen(false)} className="mt-12 text-gray-400 font-bold uppercase tracking-widest text-xs hover:text-gray-600 transition-colors">
                                        Cancelar y Volver
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Sidebar del Modal (Tabs) */}
                                    <div className="w-full md:w-64 bg-gray-50 border-r border-gray-100 p-8 flex flex-col shrink-0">
                                        <div className="mb-8 relative">
                                            <button
                                                onClick={() => { if (!editingId) setIsTypeSelected(false); }}
                                                className={`absolute -top-4 -right-4 p-2 bg-gray-200 text-gray-500 rounded-lg hover:bg-gray-300 transition-colors ${editingId ? 'hidden' : ''}`}
                                                title="Cambiar tipo"
                                            >
                                                <ChevronRight size={14} className="rotate-180" />
                                            </button>
                                            <h2 className="text-lg font-black text-gray-800 uppercase tracking-tighter leading-tight">
                                                {editingId ? 'Editar' : 'Crear'} {isFlashMode ? 'Flash' : 'Campaña'}
                                            </h2>
                                            <div className={`text-[10px] font-black uppercase py-0.5 px-2 w-fit rounded mt-1 shadow-sm ${isFlashMode ? 'bg-red-500 text-white' : 'bg-purple-600 text-white'}`}>
                                                {isFlashMode ? 'OFERTA FLASH' : 'TRADICIONAL'}
                                            </div>
                                        </div>

                                        <nav className="space-y-2 flex-1">
                                            {[
                                                { id: 'BASIC', label: 'Básico', icon: <Target size={18} />, desc: 'Identificación' },
                                                { id: 'CONTENT', label: 'Mensajes', icon: <Type size={18} />, desc: 'Textos y Canales' },
                                                { id: 'SCHEDULE', label: 'Programación', icon: <Calendar size={18} />, desc: isFlashMode ? 'Horarios Flash' : 'Fechas' },
                                                { id: 'RULES', label: 'Beneficio', icon: <Sparkles size={18} />, desc: 'Premio de Puntos' },
                                                { id: 'VISUAL', label: 'Diseño', icon: <ImageIcon size={18} />, desc: 'Imagen y Estilo' },
                                            ].filter(tab => !isFlashMode || tab.id !== 'VISUAL').map(tab => (
                                                <button
                                                    key={tab.id}
                                                    onClick={() => setActiveTab(tab.id as TabType)}
                                                    className={`w-full flex items-center gap-3 p-4 rounded-2xl transition-all text-left group ${activeTab === tab.id ? 'bg-white shadow-md text-purple-600' : 'text-gray-500 hover:bg-gray-200/50'}`}
                                                >
                                                    <div className={`p-2 rounded-xl ${activeTab === tab.id ? 'bg-purple-100' : 'bg-gray-200/50 group-hover:bg-white'}`}>
                                                        {tab.icon}
                                                    </div>
                                                    <div>
                                                        <p className="font-bold text-sm leading-none">{tab.label}</p>
                                                        <p className="text-[10px] opacity-60 font-medium mt-1">{tab.desc}</p>
                                                    </div>
                                                </button>
                                            ))}
                                        </nav>

                                        <button onClick={handleSave} className={`mt-8 w-full py-4 rounded-2xl font-black text-sm hover:scale-[1.02] transition-transform active:scale-95 flex items-center justify-center gap-2 text-white shadow-lg ${isFlashMode ? 'bg-red-600 shadow-red-100' : 'bg-black shadow-gray-200'}`}>
                                            <Save size={20} /> {editingId ? 'Guardar' : 'Crear'}
                                        </button>
                                    </div>

                                    {/* Content del Modal + Preview Layout */}
                                    <div className="flex-1 flex overflow-hidden">
                                        <div className="flex-1 p-8 md:p-12 overflow-y-auto bg-white">
                                            <div className="max-w-xl mx-auto space-y-8">

                                                {activeTab === 'BASIC' && (
                                                    <div className="space-y-6 animate-slide-in-right">
                                                        <section>
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <Target size={14} className="text-purple-600" />
                                                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Identificación Interna</label>
                                                            </div>
                                                            <input
                                                                type="text" required placeholder="Nombre Interno (Ej: Promo Lunes Locos)"
                                                                className="w-full text-2xl font-bold border-b-2 border-gray-100 focus:border-purple-600 outline-none transition-colors py-2"
                                                                value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })}
                                                            />
                                                            <p className="text-[9px] text-gray-400 font-bold uppercase mt-2 italic">Este nombre solo lo ven los administradores</p>
                                                        </section>

                                                        {!isFlashMode && (
                                                            <section className="pt-4 border-t border-gray-100 flex items-center justify-between">
                                                                <div>
                                                                    <label className="text-xs font-black text-gray-500 uppercase block">Estado de Publicación</label>
                                                                    <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5 italic">Determina si la campaña está al aire</p>
                                                                </div>
                                                                <label className="flex items-center gap-3 cursor-pointer group">
                                                                    <span className={`text-[10px] font-black uppercase tracking-widest transition-colors ${formData.active ? 'text-green-600' : 'text-gray-400'}`}>
                                                                        {formData.active ? 'Publicada' : 'Borrador'}
                                                                    </span>
                                                                    <div
                                                                        onClick={() => setFormData({ ...formData, active: !formData.active })}
                                                                        className={`w-12 h-6 rounded-full p-1 transition-all duration-300 flex items-center ${formData.active ? 'bg-green-500 shadow-green-100' : 'bg-gray-200'}`}
                                                                    >
                                                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transform transition-transform duration-300 ${formData.active ? 'translate-x-6' : 'translate-x-0'}`} />
                                                                    </div>
                                                                </label>
                                                            </section>
                                                        )}

                                                        <section className="pt-4 border-t border-gray-100">
                                                            <div className="mb-4">
                                                                <label className="text-xs font-black text-gray-500 uppercase block">Canales de Notificación Sugeridos</label>
                                                                <p className="text-[9px] text-gray-400 font-bold uppercase mt-0.5 italic">Se proponen automáticamente al difundir</p>
                                                            </div>
                                                            <div className="flex gap-3">
                                                                {['push', 'email', 'whatsapp'].map(channel => (
                                                                    <label key={channel} className={`flex-1 flex flex-col items-center gap-2 cursor-pointer p-4 rounded-xl border-2 transition-all ${formData.channels?.includes(channel) ? (isFlashMode ? 'border-red-500 bg-red-50 text-red-700' : 'border-purple-600 bg-purple-50 text-purple-700') : 'border-gray-100 bg-white text-gray-400 hover:bg-gray-50'}`}>
                                                                        <div className={`p-2 rounded-full ${formData.channels?.includes(channel) ? (isFlashMode ? 'bg-red-200' : 'bg-purple-200') : 'bg-gray-100'}`}>
                                                                            {channel === 'push' && <Monitor size={20} />}
                                                                            {channel === 'email' && <Sparkles size={20} />}
                                                                            {channel === 'whatsapp' && <MessageCircle size={20} />}
                                                                        </div>
                                                                        <span className="text-[10px] font-black uppercase tracking-wide">
                                                                            {channel === 'push' && 'Push'}
                                                                            {channel === 'email' && 'Email'}
                                                                            {channel === 'whatsapp' && 'WApp'}
                                                                        </span>
                                                                        <input
                                                                            type="checkbox"
                                                                            className="hidden"
                                                                            checked={formData.channels?.includes(channel)}
                                                                            onChange={e => {
                                                                                const current = formData.channels || [];
                                                                                setFormData({ ...formData, channels: e.target.checked ? [...current, channel] : current.filter(c => c !== channel) });
                                                                            }}
                                                                        />
                                                                    </label>
                                                                ))}
                                                            </div>
                                                        </section>

                                                        <section className="pt-6 border-t border-gray-100 flex items-center justify-between bg-blue-50/50 p-6 rounded-[2rem]">
                                                            <div className="flex items-center gap-3">
                                                                <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
                                                                    <Shield size={24} />
                                                                </div>
                                                                <div>
                                                                    <label className="text-xs font-black text-blue-900 uppercase block">Campaña Interna (Modo Test)</label>
                                                                    <p className="text-[9px] text-blue-600 font-bold uppercase mt-0.5 italic">Sólo visible para "Usuarios de Prueba"</p>
                                                                </div>
                                                            </div>
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={formData.isInternal}
                                                                    onChange={e => setFormData({ ...formData, isInternal: e.target.checked })}
                                                                />
                                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                                            </label>
                                                        </section>
                                                    </div>
                                                )}

                                                {activeTab === 'CONTENT' && (
                                                    <div className="space-y-6 animate-slide-in-right">
                                                        {isFlashMode ? (
                                                            <div className="space-y-6">
                                                                <section className="bg-red-50 p-6 rounded-[2rem] border border-red-100 space-y-4">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Zap size={14} className="text-red-600" />
                                                                            <label className="text-xs font-black text-red-900 uppercase">Título Flash Especial</label>
                                                                        </div>
                                                                    </div>
                                                                    <textarea
                                                                        rows={2} placeholder="Ej: ¡SOLO POR HOY: DOBLE PUNTOS EN TODO EL LOCAL!"
                                                                        className="w-full p-4 rounded-xl bg-white shadow-sm border border-red-100 focus:ring-2 focus:ring-red-200 outline-none transition-all text-sm font-black text-red-700 placeholder:text-red-200 uppercase resize-none"
                                                                        value={formData.flashTitle}
                                                                        onChange={e => setFormData({ ...formData, flashTitle: e.target.value })}
                                                                    />
                                                                    <p className="text-[10px] text-red-400 font-bold uppercase tracking-tight">Este título aparecerá con el cronómetro y efectos visuales de urgencia.</p>
                                                                </section>
                                                            </div>
                                                        ) : (
                                                            <div className="space-y-6">
                                                                <section className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-4 shadow-sm">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <Type size={14} className="text-purple-600" />
                                                                            <label className="text-xs font-black text-gray-800 uppercase">Título Público Tradicional</label>
                                                                        </div>
                                                                        <label className="flex items-center gap-1 cursor-pointer">
                                                                            <input type="checkbox" className="w-3 h-3 text-purple-600" checked={formData.showTitle} onChange={e => setFormData({ ...formData, showTitle: e.target.checked })} />
                                                                            <span className="text-[9px] font-bold text-gray-400">Mostrar</span>
                                                                        </label>
                                                                    </div>
                                                                    <input
                                                                        type="text" placeholder="Ej: ¡Acumulá 500 puntos y canjeá!"
                                                                        className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm font-bold"
                                                                        value={formData.title}
                                                                        onChange={e => setFormData({ ...formData, title: e.target.value })}
                                                                    />
                                                                </section>

                                                                <section className="bg-white p-6 rounded-[2rem] border border-gray-100 space-y-4 shadow-sm">
                                                                    <div className="flex justify-between items-center mb-2">
                                                                        <div className="flex items-center gap-2">
                                                                            <AlignLeft size={14} className="text-purple-600" />
                                                                            <label className="text-xs font-black text-gray-800 uppercase">Descripción Pública</label>
                                                                        </div>
                                                                        <label className="flex items-center gap-1 cursor-pointer">
                                                                            <input type="checkbox" className="w-3 h-3 text-purple-600" checked={formData.showDescription} onChange={e => setFormData({ ...formData, showDescription: e.target.checked })} />
                                                                            <span className="text-[9px] font-bold text-gray-400">Mostrar</span>
                                                                        </label>
                                                                    </div>
                                                                    <textarea
                                                                        rows={3} placeholder="Detalles de la oferta tradicional..."
                                                                        className="w-full p-4 rounded-xl bg-gray-50 border border-gray-100 focus:bg-white focus:ring-2 focus:ring-purple-100 outline-none transition-all text-sm font-medium resize-none shadow-inner"
                                                                        value={formData.description}
                                                                        onChange={e => setFormData({ ...formData, description: e.target.value })}
                                                                    />
                                                                </section>

                                                                <section className="bg-blue-50 p-6 rounded-[2rem] border border-blue-100">
                                                                    <div className="flex justify-between items-center mb-4">
                                                                        <div>
                                                                            <label className="text-xs font-black text-blue-900 uppercase">Enlace de Acción</label>
                                                                            <p className="text-[9px] text-blue-400 font-bold uppercase mt-0.5">Exclusivo para el Banner (Promos Vigentes)</p>
                                                                        </div>
                                                                        <span className="text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-bold italic">Opcional</span>
                                                                    </div>
                                                                    <div className="flex gap-2">
                                                                        <div className="p-3 bg-white rounded-xl text-blue-400 shadow-sm">
                                                                            <MousePointer2 size={20} />
                                                                        </div>
                                                                        <input
                                                                            type="url" placeholder="https://tu-web.com/promo"
                                                                            className="flex-1 p-3 rounded-xl bg-white shadow-sm border-none focus:ring-2 focus:ring-blue-200 outline-none text-sm placeholder:text-blue-200"
                                                                            value={formData.link} onChange={e => setFormData({ ...formData, link: e.target.value })}
                                                                        />
                                                                    </div>
                                                                </section>
                                                            </div>
                                                        )}
                                                    </div>
                                                )}



                                                {activeTab === 'VISUAL' && (
                                                    <div className="space-y-8 animate-slide-in-right">
                                                        <section className="space-y-4">
                                                            <div className="flex items-center gap-2 mb-2">
                                                                <ImageIcon size={14} className="text-purple-600" />
                                                                <label className="text-xs font-black text-gray-600 uppercase tracking-widest">
                                                                    {isFlashMode ? 'Identidad Visual (Tarjeta Flash)' : 'Configuración de Imagen (Carrusel / Banner)'}
                                                                </label>
                                                            </div>
                                                            <div className="flex gap-4">
                                                                <input
                                                                    type="url" placeholder="Pega el enlace de la imagen aquí..."
                                                                    className={`flex-1 p-4 rounded-2xl bg-gray-50 border outline-none transition-all text-sm font-medium ${isFlashMode ? 'border-red-100 focus:ring-2 focus:ring-red-100' : 'border-gray-100 focus:bg-white focus:ring-2 focus:ring-purple-100'}`}
                                                                    value={formData.imageUrl} onChange={e => setFormData({ ...formData, imageUrl: e.target.value })}
                                                                />
                                                            </div>
                                                        </section>

                                                        {!isFlashMode && (
                                                            <section className="bg-gray-50 p-6 rounded-[2rem] border border-gray-100 grid grid-cols-1 md:grid-cols-2 gap-4">
                                                                <label className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2 rounded-lg ${formData.showInCarousel ? 'bg-purple-100 text-purple-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                            <Layout size={20} />
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-sm text-gray-700">Mostrar en Destacados</p>
                                                                            <p className="text-[10px] text-gray-400">Carrusel superior principal</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`w-10 h-6 shrink-0 rounded-full p-1 transition-colors duration-300 ${formData.showInCarousel ? 'bg-purple-600' : 'bg-gray-200'}`}>
                                                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${formData.showInCarousel ? 'translate-x-4' : 'translate-x-0'}`} />
                                                                    </div>
                                                                    <input
                                                                        type="checkbox" className="hidden"
                                                                        checked={formData.showInCarousel}
                                                                        onChange={e => setFormData({ ...formData, showInCarousel: e.target.checked })}
                                                                    />
                                                                </label>

                                                                <label className="flex items-center justify-between p-3 bg-white rounded-xl shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`p-2 rounded-lg ${formData.showInHomeBanner ? 'bg-blue-100 text-blue-600' : 'bg-gray-100 text-gray-400'}`}>
                                                                            <Monitor size={20} />
                                                                        </div>
                                                                        <div>
                                                                            <p className="font-bold text-sm text-gray-700">Promos Vigentes</p>
                                                                            <p className="text-[10px] text-gray-400">Lista inferior en la App</p>
                                                                        </div>
                                                                    </div>
                                                                    <div className={`w-10 h-6 shrink-0 rounded-full p-1 transition-colors duration-300 ${formData.showInHomeBanner ? 'bg-blue-600' : 'bg-gray-200'}`}>
                                                                        <div className={`w-4 h-4 rounded-full bg-white shadow-sm transition-transform duration-300 ${formData.showInHomeBanner ? 'translate-x-4' : 'translate-x-0'}`} />
                                                                    </div>
                                                                    <input
                                                                        type="checkbox" className="hidden"
                                                                        checked={formData.showInHomeBanner}
                                                                        onChange={e => setFormData({ ...formData, showInHomeBanner: e.target.checked })}
                                                                    />
                                                                </label>
                                                            </section>
                                                        )}

                                                        <section className="space-y-4">
                                                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                                                <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
                                                                    <Type size={14} className="text-purple-600" />
                                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipografía Título</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase">Fuente</label>
                                                                        <select
                                                                            className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-bold outline-none"
                                                                            value={formData.titleFont} onChange={e => setFormData({ ...formData, titleFont: e.target.value as any })}
                                                                        >
                                                                            <option value="sans">Moderna</option>
                                                                            <option value="serif">Elegante</option>
                                                                            <option value="mono">Técnica</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase">Grosor</label>
                                                                        <select
                                                                            className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-bold outline-none"
                                                                            value={formData.titleWeight} onChange={e => setFormData({ ...formData, titleWeight: e.target.value as any })}
                                                                        >
                                                                            <option value="light">Ligera</option>
                                                                            <option value="normal">Normal</option>
                                                                            <option value="bold">Negrita</option>
                                                                            <option value="black">Black</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase">Tamaño</label>
                                                                        <select
                                                                            className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-bold outline-none"
                                                                            value={formData.titleSize} onChange={e => setFormData({ ...formData, titleSize: e.target.value as any })}
                                                                        >
                                                                            <option value="lg">Pequeño</option>
                                                                            <option value="xl">Mediano</option>
                                                                            <option value="2xl">Grande</option>
                                                                            <option value="4xl">Extra</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm space-y-3">
                                                                <div className="flex items-center gap-2 border-b border-gray-50 pb-2">
                                                                    <AlignLeft size={14} className="text-gray-400" />
                                                                    <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Tipografía Descripción</span>
                                                                </div>
                                                                <div className="grid grid-cols-3 gap-3">
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase">Fuente</label>
                                                                        <select
                                                                            className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-bold outline-none"
                                                                            value={formData.descFont} onChange={e => setFormData({ ...formData, descFont: e.target.value as any })}
                                                                        >
                                                                            <option value="sans">Moderna</option>
                                                                            <option value="serif">Elegante</option>
                                                                            <option value="mono">Técnica</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase">Grosor</label>
                                                                        <select
                                                                            className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-bold outline-none"
                                                                            value={formData.descWeight} onChange={e => setFormData({ ...formData, descWeight: e.target.value as any })}
                                                                        >
                                                                            <option value="light">Ligera</option>
                                                                            <option value="normal">Normal</option>
                                                                            <option value="bold">Negrita</option>
                                                                        </select>
                                                                    </div>
                                                                    <div className="space-y-1">
                                                                        <label className="text-[9px] font-black text-gray-400 uppercase">Tamaño</label>
                                                                        <select
                                                                            className="w-full p-2.5 rounded-xl bg-gray-50 border border-gray-100 text-[11px] font-bold outline-none"
                                                                            value={formData.descriptionSize} onChange={e => setFormData({ ...formData, descriptionSize: e.target.value as any })}
                                                                        >
                                                                            <option value="xs">Mini</option>
                                                                            <option value="sm">Chico</option>
                                                                            <option value="base">Normal</option>
                                                                            <option value="lg">Grande</option>
                                                                        </select>
                                                                    </div>
                                                                </div>
                                                            </div>

                                                            <section className="space-y-4">
                                                                <div className="bg-gray-50 p-6 rounded-3xl border border-gray-100 space-y-4">
                                                                    <div className="flex items-center gap-2 mb-2">
                                                                        <Layout size={14} className="text-purple-500" />
                                                                        <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Layout y Capas</label>
                                                                    </div>

                                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                                                        <div className="space-y-4">
                                                                            <div className="space-y-1">
                                                                                <label className="text-[9px] font-black text-gray-400 uppercase">Posición del Texto</label>
                                                                                <select
                                                                                    className="w-full p-2.5 rounded-xl bg-white border border-gray-100 text-[11px] font-bold outline-none shadow-sm"
                                                                                    value={formData.textPosition} onChange={e => setFormData({ ...formData, textPosition: e.target.value as any })}
                                                                                >
                                                                                    <option value="bottom-left">Abajo Izq.</option>
                                                                                    <option value="bottom-center">Abajo Centro</option>
                                                                                    <option value="bottom-right">Abajo Der.</option>
                                                                                    <option value="top-left">Arriba Izq.</option>
                                                                                    <option value="top-center">Arriba Centro</option>
                                                                                    <option value="top-right">Arriba Der.</option>
                                                                                    <option value="center">Centro</option>
                                                                                </select>
                                                                            </div>
                                                                            <div className="grid grid-cols-2 gap-3">
                                                                                <div className="space-y-1">
                                                                                    <label className="text-[9px] font-black text-gray-400 uppercase">Fondo Banner</label>
                                                                                    <input type="color" className="w-full h-10 rounded-xl cursor-pointer border-2 border-white shadow-sm" value={formData.backgroundColor} onChange={e => setFormData({ ...formData, backgroundColor: e.target.value })} />
                                                                                </div>
                                                                                <div className="space-y-1">
                                                                                    <label className="text-[9px] font-black text-gray-400 uppercase">Color Título</label>
                                                                                    <input type="color" className="w-full h-10 rounded-xl cursor-pointer border-2 border-white shadow-sm" value={formData.titleColor || formData.textColor} onChange={e => setFormData({ ...formData, titleColor: e.target.value })} />
                                                                                </div>
                                                                                <div className="space-y-1 col-span-2">
                                                                                    <label className="text-[9px] font-black text-gray-400 uppercase">Color Descripción</label>
                                                                                    <input type="color" className="w-full h-10 rounded-xl cursor-pointer border-2 border-white shadow-sm" value={formData.descriptionColor || formData.textColor} onChange={e => setFormData({ ...formData, descriptionColor: e.target.value })} />
                                                                                </div>
                                                                            </div>
                                                                        </div>

                                                                        <div className="flex flex-col gap-5">
                                                                            <section className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                                                                                <div className="flex justify-between items-center px-1">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                                                                                            <ImageIcon size={18} />
                                                                                        </div>
                                                                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Opacidad Imagen</label>
                                                                                    </div>
                                                                                    <div className="bg-purple-600 text-white px-3 py-1 rounded-full">
                                                                                        <span className="text-[10px] font-black">{formData.imageOpacity}%</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="px-1">
                                                                                    <input
                                                                                        type="range" className="w-full accent-purple-600 cursor-pointer h-2.5 bg-gray-100 rounded-xl appearance-none"
                                                                                        min="0" max="100" value={formData.imageOpacity}
                                                                                        onChange={e => setFormData({ ...formData, imageOpacity: parseInt(e.target.value) })}
                                                                                    />
                                                                                </div>
                                                                            </section>

                                                                            <section className="bg-white p-5 rounded-3xl border border-gray-100 shadow-sm space-y-4">
                                                                                <div className="flex justify-between items-center px-1">
                                                                                    <div className="flex items-center gap-3">
                                                                                        <div className="p-2 bg-purple-50 text-purple-600 rounded-xl">
                                                                                            <Monitor size={18} />
                                                                                        </div>
                                                                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Transparencia Banner</label>
                                                                                    </div>
                                                                                    <div className="bg-purple-600 text-white px-3 py-1 rounded-full">
                                                                                        <span className="text-[10px] font-black">{formData.bannerOpacity}%</span>
                                                                                    </div>
                                                                                </div>
                                                                                <div className="px-1">
                                                                                    <input
                                                                                        type="range" className="w-full accent-purple-600 cursor-pointer h-2.5 bg-gray-100 rounded-xl appearance-none"
                                                                                        min="0" max="100" value={formData.bannerOpacity}
                                                                                        onChange={e => setFormData({ ...formData, bannerOpacity: parseInt(e.target.value) })}
                                                                                    />
                                                                                </div>
                                                                            </section>
                                                                        </div>
                                                                    </div>
                                                                </div>

                                                                {/* Preview inline para móviles/tablets (se oculta en lg donde está el sidebar) */}
                                                                <section className="lg:hidden space-y-4 pt-4 border-t border-gray-100">
                                                                    <label className="text-xs font-black text-gray-600 uppercase">Vista Previa PWA</label>
                                                                    <div className="flex justify-center bg-gray-100 p-6 rounded-[2rem]">
                                                                        <div className="w-full max-w-sm">
                                                                            <PWASimulator />
                                                                        </div>
                                                                    </div>
                                                                </section>
                                                            </section>
                                                        </section>
                                                    </div>
                                                )}

                                                {activeTab === 'RULES' && (
                                                    <div className="space-y-8 animate-slide-in-right">
                                                        {isFlashMode ? (
                                                            <section className="space-y-4">
                                                                <label className="text-xs font-black text-red-900 uppercase">Premio Flash Especial</label>
                                                                <div className="grid grid-cols-3 gap-3">
                                                                    {[
                                                                        { id: 'FIXED', label: 'Puntos', icon: <Plus size={16} /> },
                                                                        { id: 'MULTIPLIER', label: 'Mult.', icon: <Zap size={16} /> },
                                                                        { id: 'TEXT', label: 'Texto', icon: <Type size={16} /> },
                                                                    ].map(type => (
                                                                        <button
                                                                            key={type.id} type="button"
                                                                            onClick={() => setFormData({ ...formData, flashRewardType: type.id as any })}
                                                                            className={`p-3 rounded-xl border-2 transition-all flex flex-col items-center gap-1 ${formData.flashRewardType === type.id ? 'border-red-500 bg-red-500 text-white' : 'border-white bg-white text-gray-400'}`}
                                                                        >
                                                                            {type.icon}
                                                                            <span className="text-[9px] font-black uppercase">{type.label}</span>
                                                                        </button>
                                                                    ))}
                                                                </div>

                                                                <div className="bg-white p-4 rounded-xl shadow-sm border border-red-50">
                                                                    {formData.flashRewardType === 'TEXT' ? (
                                                                        <input
                                                                            type="text" placeholder="Ej: 2x1, 50% OFF"
                                                                            className="w-full text-xl font-black bg-transparent border-none text-center outline-none text-red-600 placeholder:text-red-200"
                                                                            value={formData.flashRewardText || ''}
                                                                            onChange={e => setFormData({ ...formData, flashRewardText: e.target.value })}
                                                                        />
                                                                    ) : (
                                                                        <div className="flex items-center justify-center gap-2">
                                                                            <span className="text-xl font-black text-red-300">
                                                                                {formData.flashRewardType === 'MULTIPLIER' ? 'x' : '+'}
                                                                            </span>
                                                                            <input
                                                                                type="number" step={formData.flashRewardType === 'MULTIPLIER' ? "0.1" : "1"}
                                                                                className="w-20 text-3xl font-black bg-transparent border-none text-center outline-none text-red-600"
                                                                                value={formData.flashRewardValue || 0}
                                                                                onChange={e => setFormData({ ...formData, flashRewardValue: parseFloat(e.target.value) || 0 })}
                                                                            />
                                                                        </div>
                                                                    )}
                                                                </div>
                                                            </section>
                                                        ) : (
                                                            <>
                                                                <section className="space-y-4">
                                                                    <label className="text-xs font-black text-gray-600 uppercase">Tipo de Beneficio</label>
                                                                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                                                                        {[
                                                                            { id: 'FIXED', label: 'Puntos Fijos', sub: 'Suma X puntos a la cuenta', icon: <Plus size={24} />, color: 'bg-green-500' },
                                                                            { id: 'MULTIPLIER', label: 'Multiplicador', sub: 'Multiplica los puntos de la compra', icon: <Zap size={24} />, color: 'bg-purple-600' },
                                                                            { id: 'INFO', label: 'Solo Anuncio', sub: 'Informativo sin puntos extras', icon: <Megaphone size={24} />, color: 'bg-blue-500' },
                                                                            { id: 'TEXT', label: 'Texto Libre', sub: 'Muestra un texto en lugar de puntos', icon: <Type size={24} />, color: 'bg-pink-500' },
                                                                        ].map(type => (
                                                                            <button
                                                                                key={type.id} type="button"
                                                                                onClick={() => setFormData({ ...formData, rewardType: type.id as any })}
                                                                                className={`p-5 rounded-3xl border-2 transition-all flex flex-col items-center text-center gap-2 ${formData.rewardType === type.id ? 'border-black bg-black text-white shadow-xl scale-[1.02]' : 'border-gray-100 hover:border-gray-200 bg-white'}`}
                                                                            >
                                                                                <div className={`p-3 rounded-2xl ${formData.rewardType === type.id ? 'bg-white/20' : 'bg-gray-100 text-gray-400'}`}>
                                                                                    {type.icon}
                                                                                </div>
                                                                                <div>
                                                                                    <p className="font-bold text-xs tracking-tight">{type.label}</p>
                                                                                    <p className={`text-[9px] mt-0.5 leading-tight ${formData.rewardType === type.id ? 'text-white/60' : 'text-gray-400'}`}>{type.sub}</p>
                                                                                </div>
                                                                            </button>
                                                                        ))}
                                                                    </div>
                                                                </section>

                                                                {(formData.rewardType as any) === 'TEXT' && (
                                                                    <section className="bg-pink-50 p-8 rounded-[3rem] text-center animate-fade-in border border-pink-100">
                                                                        <label className="text-xs font-black text-pink-400 uppercase mb-4 block">Texto del Beneficio</label>
                                                                        <input
                                                                            type="text" placeholder="Ej: 2x1, 50% OFF"
                                                                            className="w-full text-4xl font-black bg-transparent border-b-2 border-pink-200 focus:border-pink-500 text-center outline-none text-pink-600 placeholder:text-pink-200"
                                                                            value={formData.rewardText || ''}
                                                                            onChange={e => setFormData({ ...formData, rewardText: e.target.value })}
                                                                        />
                                                                        <p className="text-[10px] text-pink-400 mt-2 font-bold uppercase">Este texto reemplazará a los puntos en la visualización</p>
                                                                    </section>
                                                                )}

                                                                {formData.rewardType !== 'INFO' && (formData.rewardType as any) !== 'TEXT' && (
                                                                    <section className="bg-gray-50 p-8 rounded-[3rem] text-center animate-fade-in">
                                                                        <label className="text-xs font-black text-gray-400 uppercase mb-4 block">Valor del Beneficio</label>
                                                                        <div className="flex items-center justify-center gap-4">
                                                                            <span className="text-4xl font-black text-gray-300">
                                                                                {formData.rewardType === 'MULTIPLIER' ? 'x' : '+'}
                                                                            </span>
                                                                            <input
                                                                                type="number" step={formData.rewardType === 'MULTIPLIER' ? "0.1" : "1"}
                                                                                className="w-40 text-6xl font-black bg-transparent border-none focus:ring-0 text-center outline-none text-black"
                                                                                value={formData.rewardValue} onChange={e => setFormData({ ...formData, rewardValue: parseFloat(e.target.value) || 0 })}
                                                                            />
                                                                            <span className="text-xl font-bold text-gray-400 uppercase">
                                                                                {formData.rewardType === 'MULTIPLIER' ? 'Bonus' : 'Puntos'}
                                                                            </span>
                                                                        </div>
                                                                    </section>
                                                                )}
                                                            </>
                                                        )}
                                                    </div>
                                                )}

                                                {activeTab === 'SCHEDULE' && (
                                                    <div className="space-y-8 animate-slide-in-right">
                                                        <section className={`${isFlashMode ? 'bg-red-50 border-red-100' : 'bg-purple-50 border-purple-100'} p-8 rounded-[3rem] border transition-colors`}>
                                                            <div className="flex items-center gap-4 mb-6">
                                                                <div className={`p-3 ${isFlashMode ? 'bg-red-600' : 'bg-purple-600'} text-white rounded-2xl shadow-lg`}>
                                                                    <Calendar size={24} />
                                                                </div>
                                                                <div>
                                                                    <h4 className={`font-black ${isFlashMode ? 'text-red-900' : 'text-purple-900'} text-lg uppercase tracking-tight`}>Vigencia de la Campaña</h4>
                                                                    <p className={`text-[10px] ${isFlashMode ? 'text-red-600' : 'text-purple-600'} font-bold opacity-60 uppercase tracking-widest`}>Periodo total de la campaña (Vacio = Permanente)</p>
                                                                </div>
                                                            </div>
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div className="space-y-2">
                                                                    <label className={`text-[10px] font-black ${isFlashMode ? 'text-red-400' : 'text-purple-400'} uppercase block ml-2`}>Fecha Inicio</label>
                                                                    <input type="date" className="w-full p-4 rounded-2xl bg-white border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-purple-200 outline-none transition-all" value={formData.startDate} onChange={e => setFormData({ ...formData, startDate: e.target.value })} />
                                                                </div>
                                                                <div className="space-y-2">
                                                                    <label className={`text-[10px] font-black ${isFlashMode ? 'text-red-400' : 'text-purple-400'} uppercase block ml-2`}>Fecha Fin</label>
                                                                    <input type="date" className="w-full p-4 rounded-2xl bg-white border-none shadow-sm text-sm font-bold focus:ring-2 focus:ring-purple-200 outline-none transition-all" value={formData.endDate} onChange={e => setFormData({ ...formData, endDate: e.target.value })} />
                                                                </div>
                                                            </div>
                                                        </section>

                                                        {isFlashMode && (
                                                            <div className="flex flex-col gap-6 animate-fade-in">
                                                                <section className="bg-white p-8 rounded-[3rem] border border-gray-100 space-y-6 shadow-sm">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className="p-2 bg-red-50 rounded-xl text-red-600">
                                                                            <Clock size={20} />
                                                                        </div>
                                                                        <label className="text-xs font-black text-gray-500 uppercase tracking-widest">Horario de Activación</label>
                                                                    </div>
                                                                    <div className="grid grid-cols-2 gap-6">
                                                                        <div className="space-y-2">
                                                                            <label className="text-[10px] font-black text-red-400 uppercase block ml-3">Inicio de Oferta</label>
                                                                            <input
                                                                                type="time" className="w-full p-5 rounded-[2rem] bg-gray-50 border border-gray-100 focus:bg-white text-lg font-black text-red-600 outline-none transition-all focus:ring-4 focus:ring-red-50 text-center"
                                                                                value={formData.startTime} onChange={e => setFormData({ ...formData, startTime: e.target.value })}
                                                                            />
                                                                        </div>
                                                                        <div className="space-y-2">
                                                                            <label className="text-[10px] font-black text-red-400 uppercase block ml-3">Fin de Oferta</label>
                                                                            <input
                                                                                type="time" className="w-full p-5 rounded-[2rem] bg-gray-50 border border-gray-100 focus:bg-white text-lg font-black text-red-600 outline-none transition-all focus:ring-4 focus:ring-red-50 text-center"
                                                                                value={formData.endTime} onChange={e => setFormData({ ...formData, endTime: e.target.value })}
                                                                            />
                                                                        </div>
                                                                    </div>
                                                                </section>

                                                                <section className="bg-red-50/50 p-8 rounded-[3rem] border border-red-100/50 space-y-4">
                                                                    <div className="flex justify-between items-center px-2">
                                                                        <div className="flex items-center gap-3">
                                                                            <div className="p-2 bg-red-600 text-white rounded-xl">
                                                                                <ToggleRight size={20} />
                                                                            </div>
                                                                            <div>
                                                                                <label className="text-xs font-black text-red-900 uppercase block leading-none">Margen Interno</label>
                                                                                <span className="text-[9px] font-bold text-red-400 uppercase tracking-tighter italic">Tolerancia para validación externa</span>
                                                                            </div>
                                                                        </div>
                                                                        <div className="bg-white px-4 py-2 rounded-2xl shadow-sm border border-red-100">
                                                                            <span className="text-sm font-black text-red-600">{formData.flashGraceMins} Min</span>
                                                                        </div>
                                                                    </div>
                                                                    <div className="px-2">
                                                                        <input
                                                                            type="range" min="0" max="120" step="5"
                                                                            className="w-full h-3 bg-red-100 rounded-xl appearance-none cursor-pointer accent-red-600"
                                                                            value={formData.flashGraceMins} onChange={e => setFormData({ ...formData, flashGraceMins: parseInt(e.target.value) })}
                                                                        />
                                                                    </div>
                                                                    <p className="text-[10px] text-red-400 font-bold italic leading-tight text-center px-4">
                                                                        Este margen permite validar puntos unos minutos después del cierre nominal. No afecta la visibilidad en la App.
                                                                    </p>
                                                                </section>
                                                            </div>
                                                        )}

                                                        <section className="bg-blue-50 p-8 rounded-[3rem] border border-blue-100 transition-colors mb-4">
                                                            <div className="flex items-center justify-between">
                                                                <div className="flex items-center gap-4">
                                                                    <div className="p-3 bg-blue-600 text-white rounded-2xl shadow-lg">
                                                                        <Megaphone size={24} />
                                                                    </div>
                                                                    <div>
                                                                        <h4 className="font-black text-blue-900 text-lg uppercase tracking-tight">Difusión Automática</h4>
                                                                        <p className="text-[10px] text-blue-600 font-bold opacity-60 uppercase tracking-widest">Enviar Push/Email solo al iniciar la campaña</p>
                                                                    </div>
                                                                </div>
                                                                <button
                                                                    type="button"
                                                                    onClick={() => setFormData({ ...formData, autoBroadcast: !formData.autoBroadcast })}
                                                                    className={`p-2 rounded-full transition-all ${formData.autoBroadcast ? 'bg-blue-600 text-white' : 'bg-gray-200 text-gray-400'}`}
                                                                >
                                                                    {formData.autoBroadcast ? <ToggleRight size={32} /> : <ToggleLeft size={32} />}
                                                                </button>
                                                            </div>
                                                            {formData.autoBroadcast && (
                                                                <>
                                                                    <p className="mt-4 text-[10px] text-blue-800 font-medium bg-white/50 p-3 rounded-xl border border-blue-200/50 italic">
                                                                        {isFlashMode 
                                                                            ? "✨ El sistema enviará automáticamente las notificaciones a todos los socios unos minutos antes de que la campaña comience (o al inicio si eliges 0)."
                                                                            : "✨ El sistema enviará automáticamente las notificaciones a todos los socios al iniciar el día programado de la campaña."}
                                                                    </p>
                                                                    {isFlashMode && (
                                                                        <div className="mt-4 bg-white/40 p-4 rounded-2xl border border-blue-200/30 space-y-3">
                                                                            <div className="flex justify-between items-center">
                                                                                <label className="text-[10px] font-black text-blue-900 uppercase">Antelación del Mensaje</label>
                                                                                <span className="text-xs font-black text-blue-600 bg-white px-3 py-1 rounded-full shadow-sm">{formData.broadcastLeadMins || 0} Min</span>
                                                                            </div>
                                                                            <input
                                                                                type="range" min="0" max="120" step="5"
                                                                                className="w-full h-2 bg-blue-100 rounded-lg appearance-none cursor-pointer accent-blue-600"
                                                                                value={formData.broadcastLeadMins || 0}
                                                                                onChange={e => setFormData({ ...formData, broadcastLeadMins: parseInt(e.target.value) })}
                                                                            />
                                                                            <p className="text-[9px] text-blue-400 font-bold italic text-center">
                                                                                {formData.broadcastLeadMins === 0
                                                                                    ? "El mensaje saldrá exactamente al inicio."
                                                                                    : `El mensaje saldrá ${formData.broadcastLeadMins} minutos antes del inicio.`}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                </>
                                                            )}
                                                        </section>

                                                        <section className="space-y-4">
                                                            <label className={`text-xs font-black ${isFlashMode ? 'text-red-500' : 'text-gray-500'} uppercase px-2`}>Días de la semana</label>
                                                            <div className="flex flex-wrap gap-2">
                                                                {DAYS.map(day => {
                                                                    const isActive = isFlashMode
                                                                        ? formData.flashDays?.includes(day.id)
                                                                        : formData.daysOfWeek?.includes(day.id);
                                                                    return (
                                                                        <button
                                                                            key={day.id} type="button"
                                                                            onClick={() => {
                                                                                if (isFlashMode) {
                                                                                    const current = formData.flashDays || [];
                                                                                    setFormData({ ...formData, flashDays: current.includes(day.id) ? current.filter(d => d !== day.id) : [...current, day.id] });
                                                                                } else {
                                                                                    const current = formData.daysOfWeek || [];
                                                                                    setFormData({ ...formData, daysOfWeek: current.includes(day.id) ? current.filter(d => d !== day.id) : [...current, day.id] });
                                                                                }
                                                                            }}
                                                                            className={`flex-1 min-w-[60px] py-4 rounded-2xl font-black text-xs transition-all ${isActive ? (isFlashMode ? 'bg-red-600 text-white shadow-lg scale-105 shadow-red-100' : 'bg-purple-600 text-white shadow-lg scale-105') : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}
                                                                        >
                                                                            {day.label}
                                                                        </button>
                                                                    );
                                                                })}
                                                            </div>
                                                            <p className="text-[10px] text-gray-400 font-bold uppercase italic text-center">
                                                                {isFlashMode ? 'La oferta flash solo se activará en los días y horarios seleccionados' : 'La campaña tradicional solo estará visible los días seleccionados'}
                                                            </p>
                                                        </section>
                                                    </div>
                                                )}

                                                {/* Eliminado el tab FLASH antiguo para evitar duplicados, ahora todo está en CONTENT y SCHEDULE */}
                                            </div>
                                        </div>

                                        {/* Sticky Preview (Visible on large screens) */}
                                        <div className="hidden lg:block w-96 bg-gray-50 p-8 border-l border-gray-100 overflow-y-auto shrink-0">
                                            <div className="space-y-6">
                                                <div className="flex items-center gap-2 mb-2">
                                                    <div className="p-2 bg-purple-100 text-purple-600 rounded-lg">
                                                        <Monitor size={16} />
                                                    </div>
                                                    <h3 className="font-black text-gray-800 text-sm uppercase">Simulador PWA</h3>
                                                </div>

                                                {/* Contextual PWA Simulator */}
                                                <div className="flex justify-center">
                                                    <PWASimulator />
                                                </div>

                                                <div className="p-4 bg-purple-50 text-purple-800 rounded-xl text-xs font-medium leading-relaxed border border-purple-100">
                                                    💡 Usa el simulador para ver cómo se integrará tu campaña en el flujo de la aplicación.
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </>
                            )}

                            {/* Botón Cerrar */}
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="absolute top-8 right-8 text-gray-400 hover:text-black transition-colors p-2 rounded-full hover:bg-gray-100"
                            >
                                <X size={24} />
                            </button>
                        </div>
                    </div>
                )
            }

            {/* BROADCAST MODAL */}
            {
                isBroadcastModalOpen && broadcastData && (
                    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-gray-900/60 backdrop-blur-md" onClick={() => setIsBroadcastModalOpen(false)} />
                        <div className="bg-white w-full max-w-lg rounded-[2.5rem] shadow-2xl relative z-10 overflow-hidden animate-scale-up">
                            <div className="p-8 border-b border-gray-50 flex items-center gap-4">
                                <div className="p-3 bg-purple-100 text-purple-600 rounded-2xl">
                                    <Megaphone size={28} />
                                </div>
                                <div>
                                    <h2 className="text-xl font-black text-gray-800 uppercase tracking-tighter">Confirmar Difusión</h2>
                                    <p className="text-xs text-gray-400 font-bold uppercase">Selecciona los canales de envío</p>
                                </div>
                            </div>

                            <div className="p-8">
                                <div className="bg-gray-50 rounded-2xl p-4 border border-gray-100 mb-6">
                                    <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-2">Mensaje Vista Previa:</p>
                                    <p className="text-sm text-gray-600 italic leading-relaxed">
                                        "{broadcastData.msg}"
                                    </p>
                                </div>

                                <div className="space-y-3 mb-8">
                                    {NotificationService.isChannelEnabled(broadcastData.config, broadcastData.eventType, 'push') && (
                                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedChannels.push ? 'border-purple-200 bg-purple-50' : 'border-gray-100 opacity-60'}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedChannels.push}
                                                onChange={e => setSelectedChannels({ ...selectedChannels, push: e.target.checked })}
                                                className="w-5 h-5 text-purple-600 rounded focus:ring-purple-500"
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-800 flex items-center gap-2">
                                                    <Monitor size={16} className="text-purple-500" /> Notificación PUSH
                                                </p>
                                                <p className="text-[10px] text-gray-500 font-medium">Llega directo al celular del cliente</p>
                                            </div>
                                        </label>
                                    )}

                                    {NotificationService.isChannelEnabled(broadcastData.config, broadcastData.eventType, 'email') && (
                                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedChannels.email ? 'border-blue-200 bg-blue-50' : 'border-gray-100 opacity-60'}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedChannels.email}
                                                onChange={e => setSelectedChannels({ ...selectedChannels, email: e.target.checked })}
                                                className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-800 flex items-center gap-2">
                                                    <Sparkles size={16} className="text-blue-500" /> Correo Electrónico
                                                </p>
                                                <p className="text-[10px] text-gray-500 font-medium">Bandeja de entrada personalizada</p>
                                            </div>
                                        </label>
                                    )}

                                    {NotificationService.isChannelEnabled(broadcastData.config, broadcastData.eventType, 'whatsapp') && (
                                        <label className={`flex items-center gap-3 p-4 rounded-xl border-2 transition-all cursor-pointer ${selectedChannels.whatsapp ? 'border-green-200 bg-green-50' : 'border-gray-100 opacity-60'}`}>
                                            <input
                                                type="checkbox"
                                                checked={selectedChannels.whatsapp}
                                                onChange={e => setSelectedChannels({ ...selectedChannels, whatsapp: e.target.checked })}
                                                className="w-5 h-5 text-green-600 rounded focus:ring-green-500"
                                            />
                                            <div className="flex-1">
                                                <p className="font-bold text-gray-800 flex items-center gap-2">
                                                    <Megaphone size={16} className="text-green-500" /> WhatsApp
                                                </p>
                                                <p className="text-[10px] text-gray-500 font-medium">Redirige para envío manual/secuencial</p>
                                            </div>
                                        </label>
                                    )}
                                </div>

                                <button
                                    onClick={executeBroadcast}
                                    className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-2xl shadow-xl shadow-purple-200 flex items-center justify-center gap-2 text-lg transition active:scale-95"
                                >
                                    <Send size={20} />
                                    ¡Lanzar Difusión!
                                </button>
                                <button
                                    onClick={() => setIsBroadcastModalOpen(false)}
                                    className="w-full mt-2 py-3 text-gray-400 font-bold hover:bg-gray-50 rounded-xl transition text-sm"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                )
            }
        </div >
    );
};
