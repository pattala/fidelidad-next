
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, X, Search, MapPin, Phone, Mail, Coins, Sparkles, Gift, History, MessageCircle, Users, Bell, Check, FileDown, ArrowRight } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc, increment, runTransaction, arrayUnion, where, setDoc, collectionGroup } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import { NotificationService } from '../../../services/notificationService';
import { EmailService } from '../../../services/emailService';
import { CampaignService } from '../../../services/campaignService';
import type { Client } from '../../../types';
import { RedemptionModal } from '../components/RedemptionModal';
import { PointsHistoryModal } from '../components/PointsHistoryModal';
import { VisitHistoryModal } from '../components/VisitHistoryModal';

import { ARGENTINA_LOCATIONS } from '../../../data/locations'; // Import added
import { TimeService } from '../../../services/timeService';
import { useAdminAuth } from '../contexts/AdminAuthContext';

const INITIAL_CLIENT_STATE = {
    name: '',
    email: '',
    dni: '',
    phone: '',
    provincia: '',
    partido: '', // Added
    localidad: '',
    calle: '',
    piso: '',
    depto: '',
    cp: '',
    socioNumber: '',
    points: 0
};

export const ClientsPage = () => {
    const navigate = useNavigate();
    const { isReadOnly } = useAdminAuth();

    // Estados
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [config, setConfig] = useState<any>(null); // Config global

    // Estado del Modal CRUD
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formStep, setFormStep] = useState(1); // 1: Personal, 2: Domicilio
    const [formData, setFormData] = useState(INITIAL_CLIENT_STATE);

    // Estado Modal Asignar Puntos
    const [pointsModalOpen, setPointsModalOpen] = useState(false);
    const [selectedClientForPoints, setSelectedClientForPoints] = useState<Client | null>(null);
    const [pointsData, setPointsData] = useState({ amount: '', concept: 'Compra en local', isPesos: true, purchaseDate: new Date().toISOString().split('T')[0] });
    const [notifyWhatsapp, setNotifyWhatsapp] = useState(false); // Checkbox state
    const [applyPromotions, setApplyPromotions] = useState(true); // New State: Default True
    const [availablePromotions, setAvailablePromotions] = useState<any[]>([]);
    const [selectedPromos, setSelectedPromos] = useState<string[]>([]);

    // Estado Modal Canje
    const [redemptionModalOpen, setRedemptionModalOpen] = useState(false);
    const [selectedClientForRedemption, setSelectedClientForRedemption] = useState<Client | null>(null);

    // Estado Modal Historial
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [visitHistoryModalOpen, setVisitHistoryModalOpen] = useState(false);
    const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);


    // 1. Cargar Clientes y Config
    const fetchData = async () => {
        try {
            // Clientes
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc')); // Reverted to 'users'
            const querySnapshot = await getDocs(q);

            // 1. Fetch Config first to use it in calculations
            const freshConfig = await ConfigService.get();
            setConfig(freshConfig);

            // 2. Fetch all history for aggregation (one single fetch to avoid multiple query index issues)
            const allHistoryQuery = collectionGroup(db, 'points_history');
            const historySnap = await getDocs(allHistoryQuery);

            let metricsMap: {
                [key: string]: {
                    expiring: number,
                    totalspent: number,
                    redeemedPoints: number,
                    redeemedValue: number,
                    expDates: { [key: string]: number }
                }
            } = {};
            const now = new Date();

            historySnap.docs.forEach(d => {
                const parentId = d.ref.parent.parent?.id;
                if (parentId) {
                    if (!metricsMap[parentId]) metricsMap[parentId] = { expiring: 0, totalspent: 0, redeemedPoints: 0, redeemedValue: 0, expDates: {} };
                    const hData = d.data();
                    const amount = hData.amount || 0;

                    if (hData.type === 'credit') {
                        // Expiring?
                        const expiresAt = hData.expiresAt?.toDate ? hData.expiresAt.toDate() : new Date(hData.expiresAt);
                        if (expiresAt > now) {
                            const remaining = hData.remainingPoints !== undefined ? hData.remainingPoints : amount;
                            metricsMap[parentId].expiring += remaining;

                            // Group by date (ignoring time)
                            const dateKey = expiresAt.toISOString().split('T')[0];
                            metricsMap[parentId].expDates[dateKey] = (metricsMap[parentId].expDates[dateKey] || 0) + remaining;
                        }
                        // Money Spent (approx if not stored)
                        const ratio = freshConfig?.pointsPerPeso || 1;
                        const pesos = hData.moneySpent !== undefined ? hData.moneySpent : (amount * 100) / ratio;
                        metricsMap[parentId].totalspent += pesos;
                    } else if (hData.type === 'debit') {
                        metricsMap[parentId].redeemedPoints += Math.abs(amount);
                        metricsMap[parentId].redeemedValue += hData.redeemedValue || 0;
                    }
                }
            });

            const loadedClients = querySnapshot.docs.map(doc => {
                const data = doc.data();
                const metrics = metricsMap[doc.id] || { expiring: 0, totalspent: 0, redeemedPoints: 0, redeemedValue: 0, expDates: {} };

                // Sort and get top 2 expirations
                const sortedExpirations = Object.entries(metrics.expDates)
                    .map(([date, points]) => ({ date: new Date(date + 'T12:00:00'), points }))
                    .sort((a, b) => a.date.getTime() - b.date.getTime())
                    .slice(0, 2);

                return {
                    id: doc.id,
                    ...data,
                    name: data.name || data.nombre || '',
                    email: data.email || '',
                    dni: data.dni || '',
                    phone: data.phone || data.telefono || '',
                    points: data.points || data.puntos || 0,
                    socioNumber: String(data.socioNumber || data.numeroSocio || ''),
                    expiringPoints: metrics.expiring,
                    expirationDetails: sortedExpirations,
                    totalSpent: metrics.totalspent,
                    redeemedPoints: metrics.redeemedPoints,
                    redeemedValue: metrics.redeemedValue,
                    registrationDate: data.createdAt || data.fechaInscripcion || null,

                    // Address Normalization (Flattening)
                    provincia: data.domicilio?.components?.provincia || data.provincia || '',
                    partido: data.domicilio?.components?.partido || data.partido || '',
                    localidad: data.domicilio?.components?.localidad || data.localidad || '',
                    calle: data.domicilio?.components?.calle || data.calle || '',
                    piso: data.domicilio?.components?.piso || data.piso || '',
                    depto: data.domicilio?.components?.depto || data.depto || '',
                    cp: data.domicilio?.components?.zipCode || data.cp || ''
                } as Client;
            });

            setClients(loadedClients.filter(c => c.name));
        } catch (error) {
            console.error("Error cargando datos:", error);
            toast.error("Error de conexión");
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // 2. Guardar Cliente (CRUD)
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;
        setLoading(true);

        const safeDni = formData.dni.trim();
        const safeEmail = formData.email.trim();
        let newDocId = editingId || '';
        let finalSocioId = formData.socioNumber;

        if (!safeEmail.includes('@')) {
            toast.error('El email debe ser válido');
            setLoading(false);
            return;
        }

        if (!safeDni || safeDni.length < 6) {
            toast.error('El DNI es obligatorio y debe tener al menos 6 caracteres (se usará como contraseña)');
            setLoading(false);
            return;
        }

        if (!formData.phone) {
            toast.error('El teléfono es obligatorio');
            setLoading(false);
            return;
        }

        try {
            // Validar Duplicados
            const usersRef = collection(db, 'users');

            // Check DNI
            if (safeDni) {
                const qDni = query(usersRef, where('dni', '==', safeDni));
                const snapDni = await getDocs(qDni);
                const duplicateDni = snapDni.docs.find(d => d.id !== editingId);
                if (duplicateDni) {
                    toast.error(`Ya existe un cliente con el DNI ${safeDni}`);
                    setLoading(false);
                    return;
                }
            }

            // Check Email
            if (safeEmail) {
                const qEmail = query(usersRef, where('email', '==', safeEmail));
                const snapEmail = await getDocs(qEmail);
                const duplicateEmail = snapEmail.docs.find(d => d.id !== editingId);
                if (duplicateEmail) {
                    toast.error(`Ya existe un cliente con el email ${safeEmail}`);
                    setLoading(false);
                    return;
                }
            }

            const formattedAddress = `${formData.calle}, ${formData.localidad}, ${formData.partido}, ${formData.provincia}, Argentina`;
            const welcomePts = Number(config?.welcomePoints || 0);

            if (editingId) {
                // ACTUALIZAR
                const clientPayload = {
                    ...formData,
                    nombre: formData.name.trim(),
                    telefono: formData.phone.trim(),
                    numeroSocio: Number(formData.socioNumber),
                    socioNumber: Number(formData.socioNumber),
                    updatedAt: new Date(),
                    formatted_address: formattedAddress,
                    domicilio: {
                        status: 'complete',
                        addressLine: formattedAddress,
                        components: {
                            calle: formData.calle,
                            piso: formData.piso,
                            depto: formData.depto,
                            localidad: formData.localidad,
                            partido: formData.partido,
                            provincia: formData.provincia,
                            zipCode: formData.cp
                        }
                    }
                };
                await updateDoc(doc(db, 'users', editingId), clientPayload);
                toast.success('Cliente actualizado correctamente');
            } else {
                // CREAR
                // Generar ID Socio
                if (!finalSocioId) {
                    try {
                        await runTransaction(db, async (transaction) => {
                            const counterRef = doc(db, 'config', 'counters');
                            const counterDoc = await transaction.get(counterRef);
                            let nextId = 1000;
                            if (counterDoc.exists()) nextId = (counterDoc.data()?.lastSocioId || 1000) + 1;
                            transaction.set(counterRef, { lastSocioId: nextId }, { merge: true });
                            finalSocioId = nextId.toString();
                        });
                    } catch (e) {
                        finalSocioId = Math.floor(10000 + Math.random() * 9000).toString();
                    }
                }

                // Payload compatible con api/create-user.js (Español)
                const apiPayload = {
                    nombre: formData.name.trim(),
                    email: safeEmail,
                    dni: safeDni,
                    telefono: formData.phone.trim(),
                    numeroSocio: finalSocioId,
                    domicilio: {
                        status: 'complete',
                        addressLine: formattedAddress,
                        components: {
                            calle: formData.calle,
                            piso: formData.piso,
                            depto: formData.depto,
                            localidad: formData.localidad,
                            partido: formData.partido,
                            provincia: formData.provincia,
                            zipCode: formData.cp
                        }
                    },
                    role: 'client',
                    source: 'local'
                };

                let apiSuccess = false;
                try {
                    const res = await fetch('/api/create-user', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json', 'x-api-key': import.meta.env.VITE_API_KEY || '' },
                        body: JSON.stringify(apiPayload)
                    });
                    if (res.ok) {
                        const data = await res.json();
                        if (data.ok) {
                            newDocId = data.firestore.docId;
                            apiSuccess = true;
                            toast.success('¡Cliente registrado con éxito!');
                        }
                    } else if (res.status === 400 || res.status === 401) {
                        const err = await res.json();
                        toast.error(err.error || "Error de validación");
                        setLoading(false);
                        return;
                    }
                } catch (e) {
                    console.warn("API Backend no disponible, intentando local...");
                }

                if (!apiSuccess) {
                    try {
                        const newRef = doc(collection(db, 'users'));
                        newDocId = newRef.id;
                        await setDoc(newRef, {
                            ...apiPayload,
                            name: formData.name.trim(), // Keep both for backward compat
                            phone: formData.phone.trim(),
                            socioNumber: Number(finalSocioId),
                            numeroSocio: Number(finalSocioId),
                            points: 0,
                            createdAt: new Date(),
                            updatedAt: new Date()
                        });
                        toast.success('Cliente registrado (Modo Local)');
                    } catch (errLocal) {
                        console.error("Error local:", errLocal);
                        toast.error("Error al guardar cliente");
                        setLoading(false);
                        return;
                    }
                }
            }

            // --- ACCIONES POST-ALTA ---
            if (!editingId && newDocId) {
                const freshConfig = await ConfigService.get();
                const pts = Number(freshConfig?.welcomePoints || 0);

                if (pts > 0) {
                    let days = 365;
                    if (freshConfig?.expirationRules) {
                        const rule = freshConfig.expirationRules.find((r: any) => pts >= r.minPoints && (!r.maxPoints || pts <= r.maxPoints));
                        if (rule) days = rule.validityDays;
                    }
                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + days);

                    await addDoc(collection(db, `users/${newDocId}/points_history`), {
                        amount: pts,
                        concept: '🎁 Bienvenida al sistema',
                        date: new Date(),
                        type: 'credit',
                        expiresAt: expiresAt
                    });

                    await updateDoc(doc(db, 'users', newDocId), {
                        points: pts,
                        historialPuntos: arrayUnion({
                            fechaObtencion: new Date(),
                            puntosObtenidos: pts,
                            puntosDisponibles: pts,
                            diasCaducidad: days,
                            origen: '🎁 Bienvenida al sistema',
                            estado: 'Activo'
                        })
                    });
                }

                const welcomeTemplate = freshConfig?.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome;
                const welcomeMsg = welcomeTemplate
                    .replace(/{nombre}/g, formData.name.split(' ')[0])
                    .replace(/{nombre_completo}/g, formData.name)
                    .replace(/{puntos}/g, pts.toString())
                    .replace(/{dni}/g, formData.dni)
                    .replace(/{email}/g, formData.email)
                    .replace(/{socio}/g, finalSocioId)
                    .replace(/{numero_socio}/g, finalSocioId)
                    .replace(/{telefono}/g, formData.phone);

                if (formData.phone && NotificationService.isChannelEnabled(freshConfig, 'welcome', 'whatsapp')) {
                    const cleanPhone = formData.phone.replace(/\D/g, '');
                    if (cleanPhone.length > 5) {
                        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(welcomeMsg.trim())}`;
                        window.open(waUrl, '_blank');
                    }
                }

                if (formData.email && NotificationService.isChannelEnabled(freshConfig, 'welcome', 'email')) {
                    const htmlContent = EmailService.generateBrandedTemplate(freshConfig || {}, '¡Bienvenido al Club!', welcomeMsg);
                    EmailService.sendEmail(formData.email, '¡Bienvenido al Club!', htmlContent).catch(() => { });
                }

                NotificationService.sendToClient(newDocId, {
                    title: '¡Bienvenido al Club!',
                    body: welcomeMsg,
                    type: 'welcome',
                    icon: freshConfig?.logoUrl
                }).catch(() => { });
            }

            closeModal();
            setTimeout(() => fetchData(), 500);
        } catch (error: any) {
            console.error("Error General al guardar:", error);
            toast.error(error.message || "Error al guardar");
        } finally {
            setLoading(false);
        }
    };

    // 3. Eliminar
    const handleDelete = async (id: string, name: string) => {
        if (isReadOnly) return;
        if (!window.confirm(`¿Estás seguro de eliminar a ${name}?`)) return;

        const toastId = toast.loading('Eliminando usuario...');
        try {
            const response = await fetch('/api/delete-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || ''
                },
                body: JSON.stringify({ docId: id })
            });

            if (response.ok) {
                toast.success('Cliente eliminado (Base de datos y Auth)', { id: toastId });
            } else {
                await deleteDoc(doc(db, 'users', id));
                toast.success('Cliente eliminado (Solo base de datos)', { id: toastId });
            }
            fetchData();
        } catch (error) {
            toast.error("Error al eliminar", { id: toastId });
        }
    };

    // 4. Asignar Puntos
    const handleAssignPoints = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !selectedClientForPoints) return;

        setLoading(true);
        try {
            const currentConfig = await ConfigService.get();
            const inputVal = parseFloat(pointsData.amount);
            let finalPoints = 0;
            let newAccumulatedBalance = 0;

            if (pointsData.isPesos) {
                const currentBalance = selectedClientForPoints.accumulated_balance || 0;
                const totalVal = inputVal + currentBalance;
                const ratio = currentConfig?.pointsPerPeso || 1;
                finalPoints = Math.floor((totalVal / 100) * ratio);
                newAccumulatedBalance = totalVal % 100;
            } else {
                finalPoints = Math.floor(inputVal);
            }

            const activeBonuses = applyPromotions ? availablePromotions.filter(p => selectedPromos.includes(p.id)) : [];
            let bonusPoints = 0;
            if (activeBonuses.length > 0 && finalPoints > 0) {
                activeBonuses.forEach(b => {
                    if (b.rewardType === 'MULTIPLIER') bonusPoints += Math.floor(finalPoints * (b.rewardValue - 1));
                    else bonusPoints += (b.rewardValue || 0);
                });
                finalPoints += bonusPoints;
            }

            if (finalPoints <= 0 && !pointsData.isPesos) {
                toast.error("La cantidad de puntos debe ser mayor a 0");
                setLoading(false);
                return;
            }

            let days = 365;
            if (currentConfig?.expirationRules) {
                const rule = currentConfig.expirationRules.find((r: any) =>
                    finalPoints >= Number(r.minPoints) && (!r.maxPoints || finalPoints <= Number(r.maxPoints))
                );
                if (rule) days = rule.validityDays;
            }

            const selectedDate = new Date(pointsData.purchaseDate + 'T12:00:00');
            const expiresAt = new Date(selectedDate);
            expiresAt.setDate(expiresAt.getDate() + days);

            if (finalPoints > 0) {
                const historyRef = collection(db, `users/${selectedClientForPoints.id}/points_history`);
                await addDoc(historyRef, {
                    amount: finalPoints,
                    moneySpent: pointsData.isPesos ? inputVal : 0,
                    concept: pointsData.concept,
                    date: selectedDate,
                    type: 'credit',
                    expiresAt: expiresAt,
                    remainingPoints: finalPoints
                });

                await updateDoc(doc(db, 'users', selectedClientForPoints.id), {
                    points: increment(finalPoints),
                    historialPuntos: arrayUnion({
                        fechaObtencion: selectedDate,
                        puntosObtenidos: finalPoints,
                        puntosDisponibles: finalPoints,
                        diasCaducidad: days,
                        origen: pointsData.concept,
                        estado: 'Activo'
                    })
                });

                if (notifyWhatsapp && selectedClientForPoints.phone) {
                    const pointsTemplate = currentConfig?.messaging?.templates?.pointsAdded || DEFAULT_TEMPLATES.pointsAdded;
                    const msg = pointsTemplate
                        .replace(/{nombre}/g, selectedClientForPoints.name.split(' ')[0])
                        .replace(/{puntos}/g, finalPoints.toString())
                        .replace(/{saldo}/g, (selectedClientForPoints.points + finalPoints).toString())
                        .replace(/{total_puntos}/g, (selectedClientForPoints.points + finalPoints).toString())
                        .replace(/{vence}/g, expiresAt.toLocaleDateString())
                        .replace(/{concepto}/g, pointsData.concept);

                    const cleanPhone = selectedClientForPoints.phone.replace(/\D/g, '');
                    if (cleanPhone.length > 5) {
                        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(msg.trim())}`;
                        window.open(waUrl, '_blank');
                    }
                }
            }

            if (pointsData.isPesos) {
                await updateDoc(doc(db, 'users', selectedClientForPoints.id), {
                    accumulated_balance: newAccumulatedBalance
                });
            }

            toast.success(`¡Se asignaron ${finalPoints} puntos!`);
            closePointsModal();
            fetchData();
        } catch (error) {
            console.error("Error al asignar puntos:", error);
            toast.error("Error al asignar puntos");
        } finally {
            setLoading(false);
        }
    };


    // Auxiliares
    const refreshAndOpen = async (client: Client, openFn: (c: Client) => void) => {
        try {
            const snap = await getDocs(query(collection(db, 'users'), where('__name__', '==', client.id)));
            if (!snap.empty) {
                const data = snap.docs[0].data();
                const refreshed = { id: snap.docs[0].id, ...data } as Client;
                openFn(refreshed);
            } else {
                openFn(client);
            }
        } catch (e) {
            openFn(client);
        }
    };

    const openNewClientModal = () => {
        if (isReadOnly) return;
        setEditingId(null);
        setFormStep(1);
        setFormData(INITIAL_CLIENT_STATE);
        setIsModalOpen(true);
    };

    const openEditClientModal = (client: Client) => {
        if (isReadOnly) return;
        setEditingId(client.id);
        setFormData({
            name: client.name || '',
            email: client.email || '',
            dni: client.dni || '',
            phone: client.phone || '',
            provincia: client.provincia || '',
            partido: client.partido || '',
            localidad: client.localidad || '',
            calle: client.calle || '',
            piso: client.piso || '',
            depto: client.depto || '',
            cp: client.cp || '',
            socioNumber: client.socioNumber || '',
            points: client.points || 0
        });
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormStep(1);
        setFormData(INITIAL_CLIENT_STATE);
    };

    const openPointsModal = async (client: Client) => {
        if (isReadOnly) return;
        setSelectedClientForPoints(client);
        setPointsData({ amount: '', concept: 'Compra en local', isPesos: true, purchaseDate: new Date().toISOString().split('T')[0] });

        const promos = await CampaignService.getActiveBonusesForToday();
        setAvailablePromotions(promos);
        setSelectedPromos(promos.map(p => p.id));
        setPointsModalOpen(true);
    };

    const closePointsModal = () => {
        setPointsModalOpen(false);
        setSelectedClientForPoints(null);
    };

    const openRedemptionModal = (client: Client) => {
        if (isReadOnly) return;
        setSelectedClientForRedemption(client);
        setRedemptionModalOpen(true);
    };

    const openHistoryModal = (client: Client) => {
        setSelectedClientForHistory(client);
        setHistoryModalOpen(true);
    };

    const handleExportExcel = () => {
        const headers = [
            'Socio', 'Nombre', 'Email', 'DNI', 'Telefono', 'Fecha Alta',
            'Puntos Actuales', 'Puntos por Vencer', 'Puntos Canjeados Total',
            'Valor Canjes ($)', 'Total Gastado ($ Estimado)',
            'Provincia', 'Partido', 'Localidad', 'Calle', 'Piso', 'Depto', 'CP',
            'Visitas', 'Ultima Conexion', 'GPS', 'Notif', 'TyC'
        ];

        const rows = clients.map(c => [
            c.socioNumber || '',
            c.name || '',
            c.email || '',
            c.dni || '',
            c.phone || '',
            c.registrationDate ? new Date(c.registrationDate?.toDate?.() || c.registrationDate).toLocaleDateString() : '',
            c.points || 0,
            c.expiringPoints || 0,
            c.redeemedPoints || 0,
            c.redeemedValue || 0,
            c.totalSpent || 0,
            c.provincia || '',
            c.partido || '',
            c.localidad || '',
            c.calle || '',
            c.piso || '',
            c.depto || '',
            c.cp || '',
            c.visitCount || 0,
            c.lastActive ? new Date(c.lastActive?.toDate?.() || c.lastActive).toLocaleString() : '',
            c.permissions?.geolocation?.status || 'pendiente',
            c.permissions?.notifications?.status || 'pendiente',
            c.termsAccepted ? 'si' : 'no'
        ]);

        const csvContent = [
            headers.join(';'),
            ...rows.map(r => r.map(v => {
                if (typeof v === 'number') return v.toFixed(2).replace('.', ',');
                return `"${v}"`;
            }).join(';'))
        ].join('\n');

        const blob = new Blob(["\ufeff" + csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `clientes_${new Date().toISOString().split('T')[0]}.csv`);
        link.style.visibility = 'hidden';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        toast.success("Excel exportado correctamente");
    };

    const filteredClients = clients.filter(c =>
        c.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.dni?.includes(searchTerm) ||
        c.socioNumber?.includes(searchTerm)
    );

    return (
        <div className="animate-fade-in pb-20">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
                <div>
                    <h1 className="text-3xl font-bold text-gray-800">Clientes</h1>
                    <p className="text-gray-500">Gestiona la base de datos de socios y sus puntos.</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleExportExcel}
                        className="flex items-center justify-center gap-2 bg-white hover:bg-gray-50 text-gray-700 border border-gray-200 px-6 py-3 rounded-xl font-bold transition shadow-sm"
                    >
                        <FileDown size={20} className="text-blue-600" /> Exportar a Excel
                    </button>
                    {!isReadOnly && (
                        <button
                            onClick={openNewClientModal}
                            className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-100"
                        >
                            <Plus size={20} /> Nuevo Cliente
                        </button>
                    )}
                </div>
            </div>

            {/* Barra de Búsqueda */}
            <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 mb-6 flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
                    <input
                        type="text"
                        placeholder="Buscar por nombre, DNI o número de socio..."
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-gray-100 focus:ring-2 focus:ring-blue-100 outline-none transition"
                        value={searchTerm}
                        onChange={e => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-500 px-2 font-medium bg-gray-50 rounded-lg">
                    <Users size={16} /> {filteredClients.length} clientes encontrados
                </div>
            </div>

            {/* Lista de Clientes (Tabla) */}
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-gray-50 border-b border-gray-100">
                            <tr>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Socio / Nombre</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider">Dirección / Maps</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Permisos</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Actividad / Visitas</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Puntos</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredClients.map((client) => (
                                <tr key={client.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <div className="w-14 h-10 bg-blue-50 text-blue-700 rounded-lg flex flex-col items-center justify-center border border-blue-100 flex-shrink-0">
                                                <span className="text-[9px] font-bold uppercase leading-none opacity-60">Socio</span>
                                                <span className="text-sm font-black leading-none">{client.socioNumber}</span>
                                            </div>
                                            <div className="overflow-hidden">
                                                <div className="font-bold text-gray-800 leading-tight truncate">{client.name}</div>
                                                <div className="flex flex-col gap-0.5 mt-1">
                                                    <span className="text-[10px] text-gray-500 font-medium flex items-center gap-1 truncate">
                                                        <Mail size={10} /> {client.email}
                                                    </span>
                                                    <div className="flex gap-2">
                                                        <span className="text-[10px] text-gray-400 font-bold">DNI {client.dni}</span>
                                                        <span className="text-[10px] text-gray-400 font-bold flex items-center gap-1">
                                                            <Phone size={8} /> {client.phone}
                                                        </span>
                                                    </div>
                                                    <div className="text-[9px] text-blue-500 font-bold mt-0.5" title="Fecha en la que el usuario se registró en el Club">
                                                        Miembro desde: {client.registrationDate ? new Date(client.registrationDate?.toDate?.() || client.registrationDate).toLocaleDateString() : 'N/D'}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <div className="text-sm font-bold text-gray-800">{client.name}</div>
                                            <div className="flex items-center gap-2 mt-1">
                                                <span className="text-[10px] text-gray-400 font-mono">#{client.socioNumber}</span>
                                                <span className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider ${client.source === 'pwa'
                                                    ? 'bg-purple-100 text-purple-600 border border-purple-200'
                                                    : 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                                                    }`}>
                                                    {client.source === 'pwa' ? 'PWA' : 'Local'}
                                                </span>
                                            </div>
                                        </div>
                                        {client.calle ? (
                                            <div className="max-w-[180px]">
                                                <div className="text-sm text-gray-700 font-medium truncate">
                                                    {client.calle} {client.piso ? ` ${client.piso}°${client.depto}` : ''}
                                                </div>
                                                <div className="text-[10px] text-gray-400 truncate">
                                                    {client.localidad}, {client.provincia}
                                                </div>
                                                <a
                                                    href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${client.calle}, ${client.localidad}, ${client.provincia}, Argentina`)}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="inline-flex items-center gap-1 text-[10px] text-blue-500 hover:text-blue-700 font-bold mt-1"
                                                >
                                                    <MapPin size={10} /> Ver en Mapa
                                                </a>
                                            </div>
                                        ) : (
                                            <span className="text-gray-300 italic text-xs">Sin dirección</span>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex justify-center gap-1.5">
                                            <div title={client.termsAccepted ? "Términos Aceptados" : "Términos Pendientes"} className={`p-1.5 rounded-md ${client.termsAccepted ? 'text-blue-600 bg-blue-50' : 'text-gray-300 bg-gray-50'}`}>
                                                <Check size={14} strokeWidth={3} />
                                            </div>
                                            <div title={`Notificaciones: ${client.permissions?.notifications?.status || 'Pendiente'}`} className={`p-1.5 rounded-md ${(client.permissions?.notifications?.status === 'granted') ? 'text-purple-600 bg-purple-50' : 'text-gray-300 bg-gray-50'}`}>
                                                <Bell size={14} />
                                            </div>
                                            <div title={`Ubicación: ${client.permissions?.geolocation?.status || 'Pendiente'}`} className={`p-1.5 rounded-md ${(client.permissions?.geolocation?.status === 'granted') ? 'text-green-600 bg-green-50' : 'text-gray-300 bg-gray-50'}`}>
                                                <MapPin size={14} />
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <button
                                            onClick={() => { setSelectedClientForHistory(client); setVisitHistoryModalOpen(true); }}
                                            className="hover:bg-blue-50 p-1.5 rounded-lg transition-colors group/visits"
                                            title="Ver historial de aperturas de la App"
                                        >
                                            <div className="text-xs font-bold text-gray-700 group-hover/visits:text-blue-600 transition-colors">{client.visitCount || 0} visitas</div>
                                            <div className="text-[10px] text-gray-400 mt-0.5 flex items-center justify-center gap-1 group-hover/visits:text-blue-500">
                                                {client.lastActive ? (
                                                    `Hoy ${new Date(client.lastActive.toDate ? client.lastActive.toDate() : client.lastActive).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}`
                                                ) : 'Nunca'}
                                                <Sparkles size={10} className="opacity-0 group-hover/visits:opacity-100" />
                                            </div>
                                        </button>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-50 text-blue-700 rounded-full font-black mb-1">
                                            <Coins size={14} />
                                            {client.points || 0}
                                        </div>
                                        {client.expirationDetails && client.expirationDetails.length > 0 ? (
                                            <div className="space-y-1 mt-1">
                                                {client.expirationDetails.map((exp, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-50 py-0.5 px-1.5 rounded border border-orange-100"
                                                        title={`Vencimiento ${idx + 1}`}
                                                    >
                                                        <History size={10} />
                                                        {exp.points} ({exp.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})
                                                    </div>
                                                ))}
                                            </div>
                                        ) : (
                                            <div className="text-[9px] text-gray-300 font-bold mt-1">Sin vencimientos</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            {!isReadOnly && (
                                                <>
                                                    <button
                                                        onClick={() => openPointsModal(client)}
                                                        className="px-3 py-1.5 bg-green-600 text-white hover:bg-green-700 rounded-lg transition-all font-bold flex items-center gap-1.5 shadow-sm shadow-green-100"
                                                        title="Sumar Puntos"
                                                    >
                                                        <Plus size={16} /> Sumar
                                                    </button>
                                                    <button
                                                        onClick={() => openRedemptionModal(client)}
                                                        className="px-3 py-1.5 bg-blue-600 text-white hover:bg-blue-700 rounded-lg transition-all font-bold flex items-center gap-1.5 shadow-sm shadow-blue-100"
                                                        title="Canjear"
                                                    >
                                                        <Gift size={16} /> Canjes
                                                    </button>
                                                </>
                                            )}
                                            <button
                                                onClick={() => openHistoryModal(client)}
                                                className="p-2 bg-gray-50 text-gray-500 hover:bg-gray-600 hover:text-white rounded-lg transition-all"
                                                title="Ver Historial"
                                            >
                                                <History size={18} />
                                            </button>
                                            {!isReadOnly && (
                                                <>
                                                    <button
                                                        onClick={() => openEditClientModal(client)}
                                                        className="p-2 hover:bg-gray-100 text-gray-400 hover:text-blue-600 rounded-lg transition-all"
                                                        title="Editar"
                                                    >
                                                        <Edit size={18} />
                                                    </button>
                                                    <button
                                                        onClick={() => handleDelete(client.id, client.name)}
                                                        className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-600 rounded-lg transition-all"
                                                        title="Eliminar"
                                                    >
                                                        <Trash2 size={18} />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                    {filteredClients.length === 0 && (
                        <div className="p-20 text-center text-gray-400">
                            <Users size={48} className="mx-auto mb-4 opacity-20" />
                            <p className="text-lg">No se encontraron clientes</p>
                            <p className="text-sm">Prueba ajustando los términos de búsqueda</p>
                        </div>
                    )}
                </div>
            </div>

            {/* MODAL: CRUD Cliente */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-blue-600 p-6 flex justify-between items-center text-white">
                            <div>
                                <h2 className="text-xl font-bold">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                                {!editingId && (
                                    <p className="text-blue-100 text-xs mt-1">
                                        Paso {formStep} de 2: {formStep === 1 ? 'Datos Personales' : 'Dirección y Domicilio'}
                                    </p>
                                )}
                            </div>
                            <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                        </div>

                        <form onSubmit={(e) => {
                            if (!editingId && formStep === 1) {
                                e.preventDefault();
                                if (!formData.name || !formData.email || !formData.dni || !formData.phone) {
                                    toast.error("Completá todos los campos obligatorios");
                                    return;
                                }
                                setFormStep(2);
                            } else {
                                handleSave(e);
                            }
                        }} className="p-8 space-y-6 overflow-y-auto">

                            {!editingId && (
                                <div className="flex justify-center gap-3 mb-4">
                                    <div className={`h-2 w-16 rounded-full transition-all ${formStep === 1 ? 'bg-blue-600' : 'bg-blue-100'}`}></div>
                                    <div className={`h-2 w-16 rounded-full transition-all ${formStep === 2 ? 'bg-blue-600' : 'bg-blue-100'}`}></div>
                                </div>
                            )}

                            {(editingId || formStep === 1) && (
                                <div className="animate-fade-in">
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2 mb-4"><Users size={16} /> Datos del Socio</h3>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Nombre y Apellido *</label>
                                            <input
                                                type="text"
                                                required
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={formData.name}
                                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">DNI *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Será su contraseña"
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={formData.dni}
                                                onChange={e => setFormData({ ...formData, dni: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Email *</label>
                                            <input
                                                type="email"
                                                required
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={formData.email}
                                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Teléfono *</label>
                                            <input
                                                type="text"
                                                required
                                                placeholder="Ej: 1122334455"
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={formData.phone}
                                                onChange={e => setFormData({ ...formData, phone: e.target.value })}
                                            />
                                        </div>
                                        {editingId && (
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">N° de Socio</label>
                                                <input
                                                    type="text"
                                                    disabled
                                                    className="w-full p-3 rounded-xl border border-gray-100 bg-gray-50 text-gray-500 outline-none"
                                                    value={formData.socioNumber}
                                                />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {(editingId || formStep === 2) && (
                                <div className="animate-fade-in space-y-6">
                                    <hr className="border-gray-100" />
                                    <h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin size={16} /> Ubicación</h3>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div className="md:col-span-2 lg:col-span-2">
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Calle y Número</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                placeholder="Ej: Av. Rivadavia 1234"
                                                value={formData.calle}
                                                onChange={e => setFormData({ ...formData, calle: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Piso</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                placeholder="Ej: 2"
                                                value={formData.piso}
                                                onChange={e => setFormData({ ...formData, piso: e.target.value })}
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Depto</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                placeholder="Ej: B"
                                                value={formData.depto}
                                                onChange={e => setFormData({ ...formData, depto: e.target.value })}
                                            />
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Provincia</label>
                                            <select
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={formData.provincia}
                                                onChange={e => setFormData({ ...formData, provincia: e.target.value, partido: '', localidad: '' })}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {Object.keys(ARGENTINA_LOCATIONS).map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Localidad / Partido</label>
                                            <select
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={formData.partido}
                                                onChange={e => setFormData({ ...formData, partido: e.target.value, localidad: '' })}
                                                disabled={!formData.provincia}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {formData.provincia && Object.keys((ARGENTINA_LOCATIONS as any)[formData.provincia]).map(p => <option key={p} value={p}>{p}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Barrio / Ciudad</label>
                                            <select
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                value={formData.localidad}
                                                onChange={e => setFormData({ ...formData, localidad: e.target.value })}
                                                disabled={!formData.partido}
                                            >
                                                <option value="">Seleccionar...</option>
                                                {formData.partido && (ARGENTINA_LOCATIONS as any)[formData.provincia][formData.partido].map((l: string) => <option key={l} value={l}>{l}</option>)}
                                            </select>
                                        </div>
                                        <div>
                                            <label className="block text-sm font-bold text-gray-700 mb-2">Cód. Postal</label>
                                            <input
                                                type="text"
                                                className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                placeholder="Ej: 1425"
                                                value={formData.cp}
                                                onChange={e => setFormData({ ...formData, cp: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                </div>
                            )}

                            <div className="mt-8 flex justify-end gap-3 pt-6 border-t border-gray-50">
                                {formStep === 2 && !editingId && (
                                    <button
                                        type="button"
                                        onClick={() => setFormStep(1)}
                                        className="px-8 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition border border-gray-100"
                                    >
                                        Atrás
                                    </button>
                                )}
                                <button type="button" onClick={closeModal} className="px-8 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition">Cancelar</button>
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    {loading ? (
                                        <>Cargando...</>
                                    ) : (!editingId && formStep === 1 ? (
                                        <>Siguiente <ArrowRight size={18} /></>
                                    ) : (
                                        'Guardar Cliente'
                                    ))}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Asignar Puntos */}
            {pointsModalOpen && selectedClientForPoints && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                        <div className="bg-green-600 p-6 flex justify-between items-center text-white">
                            <div>
                                <h2 className="text-xl font-bold">Sumar Puntos</h2>
                                <p className="text-green-100 text-xs">{selectedClientForPoints.name}</p>
                            </div>
                            <button onClick={closePointsModal} className="p-2 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleAssignPoints} className="p-8 space-y-6">
                            <div className="flex gap-4 p-1 bg-gray-50 rounded-xl mb-4">
                                <button type="button" onClick={() => setPointsData({ ...pointsData, isPesos: true })} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${pointsData.isPesos ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Por Monto ($)</button>
                                <button type="button" onClick={() => setPointsData({ ...pointsData, isPesos: false })} className={`flex-1 py-2 rounded-lg font-bold text-sm transition ${!pointsData.isPesos ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-400'}`}>Puntos Directos</button>
                            </div>

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">{pointsData.isPesos ? 'Monto de la Compra ($)' : 'Cantidad de Puntos'}</label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold">{pointsData.isPesos ? '$' : 'pts'}</span>
                                    <input
                                        type="number"
                                        required
                                        autoFocus
                                        className="w-full pl-10 pr-4 py-4 rounded-xl border border-gray-200 text-2xl font-black focus:ring-2 focus:ring-green-100 outline-none"
                                        value={pointsData.amount}
                                        onChange={e => setPointsData({ ...pointsData, amount: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Concepto / Motivo</label>
                                    <input
                                        type="text"
                                        className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none"
                                        value={pointsData.concept}
                                        onChange={e => setPointsData({ ...pointsData, concept: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Fecha de Compra</label>
                                    <input
                                        type="date"
                                        className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none"
                                        value={pointsData.purchaseDate}
                                        onChange={e => setPointsData({ ...pointsData, purchaseDate: e.target.value })}
                                    />
                                </div>
                            </div>

                            <div className="space-y-3 p-4 bg-gray-50 rounded-2xl">
                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        checked={applyPromotions}
                                        onChange={e => setApplyPromotions(e.target.checked)}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Aplicar Promociones / Bonus</span>
                                </label>

                                {applyPromotions && availablePromotions.length > 0 && (
                                    <div className="mt-2 pl-8 space-y-2 border-l-2 border-green-100 ml-2 animate-fade-in">
                                        {availablePromotions.map(promo => (
                                            <label key={promo.id} className="flex items-center gap-2 cursor-pointer group">
                                                <input
                                                    type="checkbox"
                                                    className="w-4 h-4 rounded border-gray-300 text-green-500 focus:ring-green-400"
                                                    checked={selectedPromos.includes(promo.id)}
                                                    onChange={e => {
                                                        if (e.target.checked) setSelectedPromos([...selectedPromos, promo.id]);
                                                        else setSelectedPromos(selectedPromos.filter(id => id !== promo.id));
                                                    }}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-[10px] font-bold text-gray-700 uppercase group-hover:text-green-600 transition">
                                                        {promo.name || promo.title}
                                                    </span>
                                                    <span className="text-[9px] text-gray-400 font-bold">
                                                        {promo.rewardType === 'MULTIPLIER' ? `Multiplicador x${promo.rewardValue}` : `Bonus +${promo.rewardValue} pts`}
                                                    </span>
                                                </div>
                                            </label>
                                        ))}
                                    </div>
                                )}

                                <label className="flex items-center gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        className="w-5 h-5 rounded border-gray-300 text-green-600 focus:ring-green-500"
                                        checked={notifyWhatsapp}
                                        onChange={e => setNotifyWhatsapp(e.target.checked)}
                                    />
                                    <span className="text-sm font-medium text-gray-700">Notificar por WhatsApp</span>
                                </label>
                            </div>

                            <button type="submit" disabled={loading} className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-100 disabled:opacity-50">
                                {loading ? 'Procesando...' : 'Asignar Puntos'}
                            </button>
                        </form>
                    </div>
                </div>
            )}

            {/* MODAL: Canje */}
            {redemptionModalOpen && selectedClientForRedemption && (
                <RedemptionModal
                    client={selectedClientForRedemption}
                    onClose={() => setRedemptionModalOpen(false)}
                    onRedeemSuccess={() => {
                        setRedemptionModalOpen(false);
                        fetchData();
                    }}
                />
            )}

            {/* MODAL: Historial */}
            {historyModalOpen && selectedClientForHistory && (
                <PointsHistoryModal
                    client={selectedClientForHistory}
                    isOpen={historyModalOpen}
                    onClose={() => setHistoryModalOpen(false)}
                />
            )}

            {visitHistoryModalOpen && selectedClientForHistory && (
                <VisitHistoryModal
                    isOpen={visitHistoryModalOpen}
                    client={selectedClientForHistory}
                    onClose={() => setVisitHistoryModalOpen(false)}
                />
            )}
        </div>
    );
};
