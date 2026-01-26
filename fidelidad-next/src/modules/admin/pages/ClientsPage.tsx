import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, X, Search, MapPin, Phone, Mail, Coins, Sparkles, Gift, History, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc, increment, runTransaction, arrayUnion, where } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import { NotificationService } from '../../../services/notificationService';
import { EmailService } from '../../../services/emailService';
import { CampaignService } from '../../../services/campaignService';
import type { Client } from '../../../types';
import { RedemptionModal } from '../components/RedemptionModal';
import { PointsHistoryModal } from '../components/PointsHistoryModal';

import { ARGENTINA_LOCATIONS } from '../../../data/locations'; // Import added
import { TimeService } from '../../../services/timeService';

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
    // Estados
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [config, setConfig] = useState<any>(null); // Config global

    // Estado del Modal CRUD
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingId, setEditingId] = useState<string | null>(null);
    const [formData, setFormData] = useState(INITIAL_CLIENT_STATE);

    // Estado Modal Asignar Puntos
    const [pointsModalOpen, setPointsModalOpen] = useState(false);
    const [selectedClientForPoints, setSelectedClientForPoints] = useState<Client | null>(null);
    const [pointsData, setPointsData] = useState({ amount: '', concept: 'Compra en local', isPesos: true, purchaseDate: new Date().toISOString().split('T')[0] });
    const [notifyWhatsapp, setNotifyWhatsapp] = useState(false); // Checkbox state
    const [applyPromotions, setApplyPromotions] = useState(true); // New State: Default True

    // Estado Modal Canje
    const [redemptionModalOpen, setRedemptionModalOpen] = useState(false);
    const [selectedClientForRedemption, setSelectedClientForRedemption] = useState<Client | null>(null);

    // Estado Modal Historial
    const [historyModalOpen, setHistoryModalOpen] = useState(false);
    const [selectedClientForHistory, setSelectedClientForHistory] = useState<Client | null>(null);


    // 1. Cargar Clientes y Config
    const fetchData = async () => {
        try {
            // Clientes
            const q = query(collection(db, 'users'), orderBy('createdAt', 'desc')); // Reverted to 'users'
            const querySnapshot = await getDocs(q);

            const loadedClients = querySnapshot.docs.map(doc => {
                const data = doc.data();
                return {
                    id: doc.id,
                    ...data,
                    name: data.name || data.nombre || '',
                    phone: data.phone || data.telefono || '',
                    points: data.points || data.puntos || 0,
                    socioNumber: data.socioNumber || data.numeroSocio || '',
                    // Ensure address fields mapped if needed, though they seem flat or nested
                    // For now, focus on the main display fields
                };
            }) as Client[];

            setClients(loadedClients.filter(c => c.name));

            // Config
            const cfg = await ConfigService.get();
            setConfig(cfg);
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
        setLoading(true);

        const safeDni = formData.dni.trim();
        const safeEmail = formData.email.trim();

        if (!safeEmail.includes('@')) {
            toast.error('El email debe ser válido');
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

            const clientPayload = {
                ...formData,
                updatedAt: new Date(),
                role: 'client',
                domicilio: {
                    components: {
                        calle: formData.calle,
                        piso: formData.piso,
                        depto: formData.depto,
                        localidad: formData.localidad,
                        partido: formData.partido,
                        provincia: formData.provincia,
                        zipCode: formData.cp
                    },
                    formatted_address: formattedAddress
                },
                partido: formData.partido,
                formatted_address: formattedAddress
            };

            if (editingId) {
                const docRef = doc(db, 'users', editingId);
                // Check without auto-create fallback to avoid duplicates
                try {
                    await updateDoc(docRef, clientPayload);
                    toast.success('Cliente actualizado correctamente');
                } catch (error: any) {
                    if (error.code === 'not-found') {
                        toast.error('Error: El cliente ya no existe.');
                        closeModal();
                        fetchData();
                    } else {
                        throw error;
                    }
                }
            } else {
                // Generar ID Automático Transaccional
                let newSocioId = formData.socioNumber;

                if (!newSocioId) {
                    try {
                        await runTransaction(db, async (transaction) => {
                            const counterRef = doc(db, 'config', 'counters');
                            const counterDoc = await transaction.get(counterRef);

                            let nextId = 1000;
                            if (counterDoc.exists()) {
                                nextId = counterDoc.data().lastSocioId + 1;
                            }

                            transaction.set(counterRef, { lastSocioId: nextId }, { merge: true });
                            newSocioId = nextId.toString();
                        });
                    } catch (e) {
                        console.error("Error generando ID:", e);
                        // Fallback random si falla transacción (raro)
                        newSocioId = Math.floor(1000 + Math.random() * 9000).toString();
                    }
                }

                const welcomePts = config?.welcomePoints || 0;
                const newDocRef = await addDoc(collection(db, 'users'), {
                    ...clientPayload,
                    socioNumber: newSocioId,
                    createdAt: new Date(),
                    points: welcomePts,
                    historialPuntos: [] // Initialize array for PWA
                });

                if (welcomePts > 0) {
                    // Lógica de Vencimiento Escalonado
                    let days = 365; // Default 1 año
                    if (config?.expirationRules) {
                        const rule = config.expirationRules.find((r: any) =>
                            welcomePts >= r.minPoints && (r.maxPoints === null || welcomePts <= r.maxPoints)
                        );
                        if (rule) days = rule.validityDays;
                    }

                    const expiresAt = new Date();
                    expiresAt.setDate(expiresAt.getDate() + days);

                    await addDoc(collection(db, `users/${newDocRef.id}/points_history`), {
                        amount: welcomePts,
                        concept: '🎁 Bienvenida al sistema',
                        date: new Date(),
                        type: 'credit',
                        expiresAt: expiresAt
                    });

                    // Update PWA Array
                    await updateDoc(newDocRef, {
                        historialPuntos: arrayUnion({
                            fechaObtencion: new Date(),
                            puntosObtenidos: welcomePts,
                            puntosDisponibles: welcomePts,
                            diasCaducidad: days,
                            origen: '🎁 Bienvenida al sistema',
                            estado: 'Activo'
                        })
                    });

                    // CLEANUP: Keep max 20 History Items
                    try {
                        const MAX_HISTORY = 20;
                        const hQ = query(collection(db, `users/${newDocRef.id}/points_history`), orderBy('date', 'desc'));
                        const hSnap = await getDocs(hQ);
                        if (hSnap.size > MAX_HISTORY) {
                            const deletePromises: any[] = [];
                            hSnap.docs.slice(MAX_HISTORY).forEach(d => deletePromises.push(deleteDoc(d.ref)));
                            await Promise.all(deletePromises);
                        }
                    } catch (e) {
                        console.warn('Error cleaning history:', e);
                    }
                }

                // TRIGGER NOTIFICATIONS (Granular)
                // 1. WhatsApp
                if (NotificationService.isChannelEnabled(config, 'welcome', 'whatsapp') && formData.phone) {
                    const phone = formData.phone.replace(/\D/g, '');
                    if (phone) {
                        const template = config?.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome;
                        const msg = template
                            .replace(/{nombre}/g, formData.name.split(' ')[0])
                            .replace(/{nombre_completo}/g, formData.name)
                            .replace(/{puntos}/g, welcomePts.toString())
                            .replace(/{dni}/g, formData.dni)
                            .replace(/{email}/g, formData.email)
                            .replace(/{socio}/g, newSocioId)
                            .replace(/{numero_socio}/g, newSocioId)
                            .replace(/{telefono}/g, formData.phone);

                        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                    }
                }

                // 2. Push & Email (via NotificationService)
                if (NotificationService.isChannelEnabled(config, 'welcome', 'push')) {
                    const template = config?.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome;
                    const msg = template
                        .replace(/{nombre}/g, formData.name.split(' ')[0])
                        .replace(/{nombre_completo}/g, formData.name)
                        .replace(/{puntos}/g, welcomePts.toString())
                        .replace(/{dni}/g, formData.dni)
                        .replace(/{email}/g, formData.email);

                    NotificationService.sendToClient(newDocRef.id, {
                        title: '¡Bienvenido al Club!',
                        body: msg,
                        type: 'welcome',
                        icon: config?.logoUrl // Branding
                    });
                }

                // 3. Email (Direct via EmailService)
                if (NotificationService.isChannelEnabled(config, 'welcome', 'email') && formData.email) {
                    const template = config?.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome;
                    const msgBody = template
                        .replace(/{nombre}/g, formData.name.split(' ')[0])
                        .replace(/{nombre_completo}/g, formData.name)
                        .replace(/{puntos}/g, welcomePts.toString())
                        .replace(/{dni}/g, formData.dni)
                        .replace(/{email}/g, formData.email);

                    const htmlContent = EmailService.generateBrandedTemplate(config || {}, '¡Bienvenido al Club!', msgBody);

                    try {
                        await EmailService.sendEmail(formData.email, '¡Bienvenido al Club!', htmlContent);
                        toast.success('Email de bienvenida enviado');
                    } catch (err) {
                        console.error('Error enviando email:', err);
                    }
                }

                toast.success('Nuevo cliente registrado');
            }

            closeModal();
            fetchData();
        } catch (error) {
            console.error("Error el guardar:", error);
            toast.error("Error al guardar cliente");
        } finally {
            setLoading(false);
        }
    };

    // 3. Eliminar (Full Backend API)
    const handleDelete = async (id: string, name: string) => {
        if (!window.confirm(`¿Estás seguro de eliminar a ${name}? Esta acción purga TODOS sus datos y su acceso.`)) {
            return;
        }

        const toastId = toast.loading('Eliminando usuario por completo...');

        try {
            // Intento 1: Vía API (Frontend -> Backend -> Auth + Firestore)
            // Esto es necesario para borrar el Auth User, que requiere Admin SDK
            const response = await fetch('/api/delete-user', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    // Usa la variable de entorno si existe, sino un fallback común del proyecto viejo
                    'x-api-key': import.meta.env.VITE_API_KEY || 'Felipe01'
                },
                body: JSON.stringify({ docId: id })
            });

            const result = await response.json();

            if (response.ok && result.ok) {
                toast.success(`Cliente ${name} eliminado correctamente`, { id: toastId });
            } else {
                console.warn('API delete falló, usando fallback local', result);
                // Fallback: Si falla la API (ej. local sin env), borramos al menos en Firestore
                await deleteDoc(doc(db, 'users', id));
                toast.success(`Cliente ${name} eliminado (Solo Datos)`, { id: toastId });
            }

            fetchData();
        } catch (error) {
            console.error("Error al eliminar:", error);
            // Fallback final por si la red falla
            try {
                await deleteDoc(doc(db, 'users', id));
                toast.success(`Cliente ${name} eliminado (Local)`, { id: toastId });
                fetchData();
            } catch (e) {
                toast.error("No se pudo eliminar", { id: toastId });
            }
        }
    };

    // 4. Asignar Puntos (Lógica de Negocio)
    const handleAssignPoints = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!selectedClientForPoints) return;

        setLoading(true);
        try {
            // Force fetch fresh config
            const currentConfig = await ConfigService.get();

            // Calcular puntos finales
            let finalPoints = 0;
            let newAccumulatedBalance = 0;
            const inputVal = parseFloat(pointsData.amount);

            if (pointsData.isPesos) {
                // Lógica de Remanente
                const currentBalance = selectedClientForPoints.accumulated_balance || 0;
                const totalVal = inputVal + currentBalance;

                // Regla base: cada $100
                const ratio = currentConfig?.pointsPerPeso || 1;

                // Puntos base generados por este total
                const rawPoints = Math.floor((totalVal / 100) * ratio);

                // El remanente es el resto de la división por 100
                // PERO ojo: si el ratio es > 1 (ej 10 pts cada $100), la lógica de "sobra plata" sigue siendo sobre los $100.
                // $125 -> 1 unidad de 100 ($100) -> sobran $25.
                newAccumulatedBalance = totalVal % 100;

                finalPoints = rawPoints;
            } else {
                finalPoints = Math.floor(inputVal); // Directo puntos, no afecta remanente en $
            }

            // --- Lógica de BONOS ---
            const activeBonuses = applyPromotions ? await CampaignService.getActiveBonusesForToday() : [];
            let bonusPoints = 0;
            const appliedBonuses: string[] = [];

            // Solo aplicar bonos si se generaron puntos base
            if (activeBonuses.length > 0 && finalPoints > 0) {
                // Sumar bonos
                // 1. Aplicar Multiplicadores
                const multipliers = activeBonuses.filter(b => b.rewardType === 'MULTIPLIER');
                multipliers.forEach(m => {
                    const extra = Math.floor(finalPoints * (m.rewardValue - 1));
                    bonusPoints += extra;
                    appliedBonuses.push(`${m.name} (x${m.rewardValue})`);
                });

                // 2. Aplicar Fijos
                const fixed = activeBonuses.filter(b => b.rewardType === 'FIXED' || !b.rewardType);
                fixed.forEach(f => {
                    bonusPoints += (f.rewardValue || 0);
                    appliedBonuses.push(`${f.name} (+${f.rewardValue || 0})`);
                });

                // Agregar al total
                finalPoints += bonusPoints;
            }
            // -----------------------

            if (finalPoints <= 0 && pointsData.isPesos) {
                // Caso especial: Compró poquito ($20) y no llegó a 1 punto, PERO debemos guardar el saldo.
                // Permitimos continuar si es pesos, para guardar el balance.
                if (newAccumulatedBalance === (selectedClientForPoints.accumulated_balance || 0)) {
                    // Si no cambió nada y son 0 puntos
                    toast.error("El monto no genera puntos");
                    return;
                }
            } else if (finalPoints <= 0) {
                toast.error("La cantidad de puntos debe ser mayor a 0");
                return;
            }

            // Calcular Vencimiento
            // Calcular Vencimiento Escalonado
            // Calcular Vencimiento Escalonado
            let days = 365; // Default
            if (currentConfig?.expirationRules && currentConfig.expirationRules.length > 0) {
                // 1. Sort rules DESCENDING by minPoints to prioritize higher tiers
                const sortedRules = [...currentConfig.expirationRules].sort((a: any, b: any) => Number(b.minPoints) - Number(a.minPoints));

                // 2. Try to find exact range match
                let rule = sortedRules.find((r: any) =>
                    finalPoints >= Number(r.minPoints) && (!r.maxPoints || finalPoints <= Number(r.maxPoints))
                );

                // 3. Fallback: If no exact match (likely exceeding max of highest tier)
                if (!rule && sortedRules.length > 0) {
                    const highestRule = sortedRules[0]; // Highest tier is first
                    if (highestRule && finalPoints >= Number(highestRule.minPoints)) {
                        rule = highestRule;
                    }
                }

                if (rule) days = rule.validityDays;
            }

            // Fix Chronological Order for Today's Assignments (Respected Simulated Time)
            const now = TimeService.now();
            // Compare YYYY-MM-DD
            const todayStr = now.toLocaleDateString('es-AR', { year: 'numeric', month: '2-digit', day: '2-digit' }).split('/').reverse().join('-');
            // pointsData.purchaseDate is YYYY-MM-DD from input type="date"

            // Note: input date is usually local browser time. 
            // Better check:
            const isToday = pointsData.purchaseDate === now.toISOString().split('T')[0] || pointsData.purchaseDate === todayStr;

            const entryDate = isToday ? now : new Date(pointsData.purchaseDate + 'T12:00:00');
            const expiresAt = new Date(entryDate);
            expiresAt.setDate(expiresAt.getDate() + days);

            // A. Registrar movimiento en historial con VENCIMIENTO
            // A. Registrar movimiento en historial con VENCIMIENTO
            // Allow if points > 0 OR if money was spent (Audit trail)
            const moneySpent = pointsData.isPesos ? (parseFloat(pointsData.amount) + (selectedClientForPoints.accumulated_balance || 0)) : 0;
            const moneyAdded = pointsData.isPesos ? parseFloat(pointsData.amount) : 0;

            if (finalPoints > 0 || moneyAdded > 0) {
                // 1. Subcollection (Admin Record)
                await addDoc(collection(db, `users/${selectedClientForPoints.id}/points_history`), {
                    amount: finalPoints,
                    remainingPoints: finalPoints, // Initial FIFO state
                    concept: pointsData.concept + (appliedBonuses.length > 0 ? ` (+ Bono: ${appliedBonuses.join(', ')})` : ''),
                    date: entryDate,
                    type: 'credit',
                    expiresAt: expiresAt,
                    // Store Transaction Amount (Delta) for clarity in history
                    moneySpent: moneyAdded // Previously was accumulated, but user wants transaction value
                });

                // 2. Array Update (PWA Visibility)
                // Need to update the main doc to push to 'historialPuntos'
                const clientRef = doc(db, 'users', selectedClientForPoints.id);
                await updateDoc(clientRef, {
                    historialPuntos: arrayUnion({
                        fechaObtencion: entryDate,
                        puntosObtenidos: finalPoints,
                        puntosDisponibles: finalPoints,
                        diasCaducidad: days,
                        origen: pointsData.concept + (appliedBonuses.length > 0 ? ` (+ Bono)` : ''),
                        estado: 'Activo'
                    })
                });
            }

            // B. Actualizar total en documento de usuario
            const userRef = doc(db, 'users', selectedClientForPoints.id);
            const updates: any = {};

            if (finalPoints > 0) updates.points = increment(finalPoints);
            if (pointsData.isPesos) updates.accumulated_balance = newAccumulatedBalance;

            await updateDoc(userRef, updates);

            const balanceMsg = pointsData.isPesos && newAccumulatedBalance > 0 ? ` (Quedan $${newAccumulatedBalance} a favor)` : '';
            toast.success(`¡Se asignaron ${finalPoints} puntos a ${selectedClientForPoints.name}!${balanceMsg}`);

            // NOTIFICAR WHATSAPP (Granular Config)
            if (notifyWhatsapp && NotificationService.isChannelEnabled(config, 'pointsAdded', 'whatsapp') && selectedClientForPoints.phone) {
                const phone = selectedClientForPoints.phone.replace(/\D/g, '');
                if (phone) {
                    const template = config?.messaging?.templates?.pointsAdded || DEFAULT_TEMPLATES.pointsAdded;
                    const newTotal = (selectedClientForPoints.points || 0) + finalPoints;

                    const msg = template
                        .replace(/{nombre}/g, selectedClientForPoints.name.split(' ')[0])
                        .replace(/{nombre_completo}/g, selectedClientForPoints.name)
                        .replace(/{puntos}/g, finalPoints.toString())
                        .replace(/{saldo}/g, newTotal.toString())
                        .replace(/{dni}/g, selectedClientForPoints.dni || '')
                        .replace(/{email}/g, selectedClientForPoints.email || '');

                    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, '_blank');
                }
            }

            // NOTIFICAR PUSH (Granular Config)
            if (NotificationService.isChannelEnabled(config, 'pointsAdded', 'push')) {
                const template = config?.messaging?.templates?.pointsAdded || DEFAULT_TEMPLATES.pointsAdded;
                const newTotal = (selectedClientForPoints.points || 0) + finalPoints;
                const msg = template
                    .replace(/{nombre}/g, selectedClientForPoints.name.split(' ')[0])
                    .replace(/{nombre_completo}/g, selectedClientForPoints.name)
                    .replace(/{puntos}/g, finalPoints.toString())
                    .replace(/{saldo}/g, newTotal.toString())
                    .replace(/{dni}/g, selectedClientForPoints.dni || '')
                    .replace(/{email}/g, selectedClientForPoints.email || '');

                NotificationService.sendToClient(selectedClientForPoints.id, {
                    title: '¡Sumaste Puntos!',
                    body: msg,
                    type: 'pointsAdded',
                    icon: config?.logoUrl // Branding
                });
            }

            // CLEANUP: Keep max 20 History Items
            try {
                const MAX_HISTORY = 20;
                const hQ = query(collection(db, `users/${selectedClientForPoints.id}/points_history`), orderBy('date', 'desc'));
                const hSnap = await getDocs(hQ);
                if (hSnap.size > MAX_HISTORY) {
                    const deletePromises: any[] = [];
                    hSnap.docs.slice(MAX_HISTORY).forEach(d => deletePromises.push(deleteDoc(d.ref)));
                    await Promise.all(deletePromises);
                }
            } catch (e) {
                console.warn('Error cleaning history:', e);
            }

            closePointsModal();
            fetchData();
        } catch (error) {
            console.error("Error asignando puntos:", error);
            toast.error("Error al asignar puntos");
        } finally {
            setLoading(false);
        }
    };


    // Auxiliares Modales
    // Auxiliar: Refrescar Cliente antes de abrir modal
    const refreshAndOpen = async (client: Client, openFn: (c: Client) => void) => {
        try {
            // 1. Procesar Vencimientos (Lazy Check)
            const { ExpirationService } = await import('../../../services/expirationService');
            await ExpirationService.processExpirations(client.id);

            // 2. Obtener datos frescos
            const docRef = doc(db, 'users', client.id);
            const snap = await import('firebase/firestore').then(mod => mod.getDoc(docRef));

            if (snap.exists()) {
                const refreshedClient = { id: snap.id, ...snap.data() } as Client;
                // Update local list state optimistically/lazily if needed, but definitely for the modal
                openFn(refreshedClient);

                // Update list view too
                setClients(prev => prev.map(c => c.id === client.id ? refreshedClient : c));
            } else {
                openFn(client); // Fallback
            }
        } catch (e) {
            console.error(e);
            openFn(client);
        }
    };

    const openNewClientModal = () => {
        setEditingId(null);
        setFormData(INITIAL_CLIENT_STATE);
        setIsModalOpen(true);
    };

    const openEditClientModal = (client: Client) => {
        refreshAndOpen(client, (c) => {
            setEditingId(c.id);
            setFormData({
                ...INITIAL_CLIENT_STATE,
                ...c, // Spread seguro con datos frescos
                provincia: c.provincia || '',
                partido: c.partido || '',
                localidad: c.localidad || '',
                calle: c.calle || '',
                piso: c.piso || '',
                depto: c.depto || '',
                cp: c.cp || '',
                socioNumber: c.socioNumber || '',
            });
            setIsModalOpen(true);
        });
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingId(null);
        setFormData(INITIAL_CLIENT_STATE);
    };

    const openPointsModal = (client: Client) => {
        refreshAndOpen(client, (c) => {
            setSelectedClientForPoints(c);
            setPointsData({ amount: '', concept: 'Compra en local', isPesos: true, purchaseDate: new Date().toISOString().split('T')[0] });
            setNotifyWhatsapp(true);
            setApplyPromotions(true);
            setPointsModalOpen(true);
        });
    };

    const openRedemptionModal = (client: Client) => {
        refreshAndOpen(client, (c) => {
            setSelectedClientForRedemption(c);
            setRedemptionModalOpen(true);
        });
    };

    const openHistoryModal = (client: Client) => {
        // El modal de historial ya hace su propio fetch y processExpirations, 
        // pero refrescar aquí asegura que la lista de fondo se actualice.
        refreshAndOpen(client, (c) => {
            setSelectedClientForHistory(c);
            setHistoryModalOpen(true);
        });
    };

    const closePointsModal = () => {
        setPointsModalOpen(false);
        setSelectedClientForPoints(null);
    };

    const filteredClients = clients.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.dni && c.dni.includes(searchTerm)) ||
        (c.socioNumber && c.socioNumber.includes(searchTerm)) ||
        (c.email && c.email.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row justify-between items-center gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-800">Clientes</h1>
                    <p className="text-gray-500 text-sm">Administra la base de usuarios fidelizados</p>
                </div>
                <button
                    onClick={openNewClientModal}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-5 py-2.5 rounded-xl font-medium shadow-lg shadow-blue-200 transition-all flex items-center gap-2 active:scale-95 w-full md:w-auto justify-center"
                >
                    <Plus size={20} />
                    Nuevo Cliente
                </button>
            </div>

            {/* Buscador */}
            <div className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 flex items-center gap-3 sticky top-0 z-10 md:static">
                <Search className="text-gray-400" size={20} />
                <input
                    type="text"
                    placeholder="Buscar por nombre, DNI, N° Socio o Email..."
                    className="flex-1 outline-none text-gray-700 min-w-0" // min-w-0 fixes flex shrinking
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            {/* VISTA MÓVIL (Cards) - Visible solo en celulares (md:hidden) */}
            <div className="md:hidden space-y-4 pb-20">
                {filteredClients.map((client) => (
                    <div key={client.id} className="bg-white p-4 rounded-xl shadow-sm border border-gray-100 relative">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                                    {client.name.charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 leading-tight">{client.name}</h3>
                                    <div className="flex items-center gap-2 mt-1">
                                        {client.socioNumber && (
                                            <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                                #{client.socioNumber}
                                            </span>
                                        )}
                                        {client.createdAt && (
                                            <span className="text-[10px] text-gray-400">
                                                {client.createdAt?.seconds ? new Date(client.createdAt.seconds * 1000).toLocaleDateString('es-AR') : new Date(client.createdAt).toLocaleDateString('es-AR')}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            </div>
                            <div className="text-right">
                                <span className="block text-xl font-bold text-blue-600 leading-none">{client.points || 0}</span>
                                <span className="text-[9px] uppercase text-gray-400 font-bold">Pts</span>
                            </div>
                        </div>

                        <div className="space-y-2 text-sm text-gray-600 mb-4 border-b border-gray-50 pb-4">
                            {client.phone && (
                                <div className="flex items-center gap-2">
                                    <Phone size={16} className="text-green-500 shrink-0" />
                                    <span>{client.phone}</span>
                                </div>
                            )}
                            {client.email && (
                                <div className="flex items-center gap-2">
                                    <Mail size={16} className="text-blue-400 shrink-0" />
                                    <span className="truncate">{client.email}</span>
                                </div>
                            )}
                            {(client.calle || client.localidad) && (
                                <a
                                    href={client.google_maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${client.calle}, ${client.localidad}, ${client.partido || ''}, ${client.provincia}, Argentina`)}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-start gap-2 text-gray-500 hover:text-blue-600"
                                >
                                    <MapPin size={16} className="text-red-400 shrink-0 mt-0.5" />
                                    <span className="truncate leading-tight">
                                        {client.calle} {client.piso ? `(${client.piso}° ${client.depto})` : ''}
                                        {client.localidad && `, ${client.localidad}`}
                                    </span>
                                </a>
                            )}
                            {(client.accumulated_balance || 0) > 0 && (
                                <div className="mt-2 text-xs bg-green-50 text-green-700 px-2 py-1 rounded inline-block font-medium">
                                    💰 Saldo a favor: ${client.accumulated_balance}
                                </div>
                            )}
                        </div>

                        {/* Actions Grid */}
                        <div className="grid grid-cols-5 gap-2">
                            <button onClick={() => openPointsModal(client)} className="col-span-2 bg-green-500 hover:bg-green-600 text-white py-2 rounded-lg font-bold flex flex-col items-center justify-center text-xs shadow-sm active:scale-95 transition">
                                <Coins size={18} className="mb-1" />
                                Sumar
                            </button>
                            <button onClick={() => openHistoryModal(client)} className="bg-gray-50 hover:bg-gray-100 text-gray-600 py-2 rounded-lg flex flex-col items-center justify-center text-[10px] font-medium transition" title="Historial">
                                <History size={18} className="mb-1" />
                                Historial
                            </button>
                            <button onClick={() => navigate('/admin/whatsapp', { state: { clientId: client.id } })} className="bg-green-50 hover:bg-green-100 text-green-600 py-2 rounded-lg flex flex-col items-center justify-center text-[10px] font-medium transition" title="WhatsApp">
                                <MessageCircle size={18} className="mb-1" />
                                Chat
                            </button>
                            <button onClick={() => openEditClientModal(client)} className="bg-blue-50 hover:bg-blue-100 text-blue-600 py-2 rounded-lg flex flex-col items-center justify-center text-[10px] font-medium transition" title="Editar">
                                <Edit size={18} className="mb-1" />
                                Editar
                            </button>
                        </div>
                    </div>
                ))}
                {filteredClients.length === 0 && (
                    <div className="text-center py-10 text-gray-400 bg-white rounded-xl border border-gray-100">
                        <p>No se encontraron clientes.</p>
                    </div>
                )}
            </div>

            {/* VISTA DE ESCRITORIO (Tabla) - Visible solo en PC (hidden md:block) */}
            <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse">
                        <thead>
                            <tr className="bg-gray-50/50 border-b border-gray-100 text-xs uppercase tracking-wider text-gray-400 font-semibold">
                                <th className="p-4 pl-6">Cliente</th>
                                <th className="p-4">Contacto</th>
                                <th className="p-4">Ubicación</th>
                                <th className="p-4 text-center">Puntos</th>
                                <th className="p-4 text-right pr-6">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50 text-sm">
                            {filteredClients.map((client) => (
                                <tr key={client.id} className="hover:bg-blue-50/20 transition-colors group">
                                    <td className="p-4 pl-6">
                                        <div className="flex items-center gap-3">
                                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 text-white flex items-center justify-center font-bold shadow-sm">
                                                {client.name.charAt(0).toUpperCase()}
                                            </div>
                                            <div>
                                                <p className="font-bold text-gray-800 flex items-center gap-2">
                                                    {client.name}
                                                    {client.socioNumber && (
                                                        <span className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded border border-gray-200">
                                                            #{client.socioNumber}
                                                        </span>
                                                    )}
                                                </p>
                                                {client.createdAt && (
                                                    <p className="text-[10px] text-gray-400 mt-0.5">
                                                        Alta: {client.createdAt?.seconds ? new Date(client.createdAt.seconds * 1000).toLocaleDateString('es-AR') : new Date(client.createdAt).toLocaleDateString('es-AR')}
                                                    </p>
                                                )}
                                                <p className="text-xs text-gray-500 font-mono tracking-wide">{client.dni}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <div className="space-y-1">
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Mail size={14} className="text-blue-400" />
                                                <span>{client.email}</span>
                                            </div>
                                            <div className="flex items-center gap-2 text-gray-600">
                                                <Phone size={14} className="text-green-500" />
                                                <span>{client.phone || '-'}</span>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="p-4">
                                        <a
                                            href={client.google_maps_link || `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${client.calle}, ${client.localidad}, ${client.partido || ''}, ${client.provincia}, Argentina`)}`}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-start gap-2 text-gray-600 max-w-[200px] hover:text-blue-600 group/map transition-colors"
                                            title="Ver en Google Maps"
                                        >
                                            <MapPin size={14} className="text-red-400 mt-1 shrink-0 group-hover/map:text-red-500" />
                                            <span>
                                                {client.calle} {client.piso ? `(${client.piso}° ${client.depto})` : ''}
                                                <br />
                                                <span className="text-xs text-gray-400 group-hover/map:text-blue-400">{client.localidad}, {client.provincia}</span>
                                            </span>
                                        </a>
                                    </td>
                                    <td className="p-4 text-center">
                                        <span className="inline-flex flex-col items-center justify-center w-16 py-1 bg-yellow-50 text-yellow-700 rounded-lg border border-yellow-100 font-bold">
                                            {client.points || 0}
                                            <span className="text-[9px] uppercase font-normal opacity-70">Pts</span>
                                        </span>
                                        {(client.accumulated_balance || 0) > 0 && (
                                            <div className="text-[10px] text-green-600 font-bold mt-1 bg-green-50 px-1.5 py-0.5 rounded border border-green-100 text-center whitespace-nowrap" title="Saldo acumulado para próximos puntos">
                                                + ${client.accumulated_balance}
                                            </div>
                                        )}
                                    </td>
                                    <td className="p-4 text-right pr-6">
                                        <div className="flex justify-end gap-2 opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                                            <button
                                                onClick={() => openHistoryModal(client)}
                                                className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                                                title="Ver Historial"
                                            >
                                                <History size={18} />
                                            </button>
                                            <button
                                                onClick={() => navigate('/admin/whatsapp', { state: { clientId: client.id } })}
                                                className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                                                title="Enviar Mensaje"
                                            >
                                                <MessageCircle size={18} />
                                            </button>
                                            <button
                                                onClick={() => openPointsModal(client)}
                                                className="p-2 text-white bg-green-500 hover:bg-green-600 rounded-lg transition shadow-md hover:shadow-lg active:scale-95 flex items-center gap-1"
                                                title="Asignar Puntos"
                                            >
                                                <Coins size={16} />
                                            </button>
                                            <button
                                                onClick={() => openRedemptionModal(client)}
                                                disabled={(client.points || 0) <= 0}
                                                className={`p-2 text-white rounded-lg transition shadow-md flex items-center gap-1 ${client.points > 0 ? 'bg-pink-500 hover:bg-pink-600 hover:shadow-lg active:scale-95' : 'bg-gray-300 cursor-not-allowed'}`}
                                                title="Canjear Puntos"
                                            >
                                                <Gift size={16} />
                                            </button>
                                            <div className="w-px h-8 bg-gray-200 mx-1"></div>
                                            <button
                                                onClick={() => openEditClientModal(client)}
                                                className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                title="Editar"
                                            >
                                                <Edit size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(client.id, client.name)}
                                                className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                                                title="Eliminar"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}

                            {filteredClients.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-12 text-center text-gray-400">
                                        No hay clientes registrados.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* --- MODALES --- */}

            {/* Modal CRUD Cliente */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-2xl shadow-2xl overflow-hidden animate-slide-up">
                        <div className="px-6 py-4 bg-gray-50 border-b border-gray-100 flex justify-between items-center">
                            <h2 className="text-lg font-bold text-gray-800">
                                {editingId ? 'Editar Cliente' : 'Nuevo Cliente'}
                            </h2>
                            <button onClick={closeModal} className="text-gray-400 hover:text-gray-600 rounded-full p-1"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-6 space-y-6">
                            {/* Datos Personales */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input type="text" required placeholder="Nombre Completo" className="w-full rounded-lg border-gray-300 border p-2.5" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} />
                                <input type="text" placeholder="N° Socio (Automático)" className="w-full rounded-lg border-gray-300 border p-2.5 bg-gray-50 font-mono text-sm placeholder:text-gray-400 placeholder:text-xs" value={formData.socioNumber} onChange={e => setFormData({ ...formData, socioNumber: e.target.value })} />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <input type="text" required placeholder="DNI" className="w-full rounded-lg border-gray-300 border p-2.5" value={formData.dni} onChange={e => setFormData({ ...formData, dni: e.target.value })} />
                                <input type="email" required placeholder="Email" className="w-full rounded-lg border-gray-300 border p-2.5" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} />
                                <div className="md:col-span-2">
                                    <input type="text" required placeholder="Teléfono" className="w-full rounded-lg border-gray-300 border p-2.5" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} />
                                    <p className="text-xs text-gray-400 mt-1 ml-1">Formato sugerido: +54 9 11 1234 5678 (para WhatsApp)</p>
                                </div>
                            </div>

                            {/* Domicilio */}
                            <div className="border-t border-gray-50 pt-4 space-y-4">
                                <h3 className="text-sm font-bold text-gray-500 uppercase tracking-wide">Domicilio</h3>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Provincia */}
                                    <select
                                        required
                                        className="w-full rounded-lg border-gray-300 border p-2.5 bg-white text-gray-700"
                                        value={formData.provincia}
                                        onChange={e => setFormData({ ...formData, provincia: e.target.value, partido: '', localidad: '' })}
                                    >
                                        <option value="">Selecciona Provincia</option>
                                        {Object.keys(ARGENTINA_LOCATIONS).map(prov => (
                                            <option key={prov} value={prov}>{prov}</option>
                                        ))}
                                    </select>

                                    {/* Partido */}
                                    <select
                                        required
                                        className="w-full rounded-lg border-gray-300 border p-2.5 bg-white disabled:bg-gray-100 text-gray-700"
                                        value={formData.partido}
                                        onChange={e => setFormData({ ...formData, partido: e.target.value, localidad: '' })}
                                        disabled={!formData.provincia}
                                    >
                                        <option value="">Selecciona Partido/Depto</option>
                                        {formData.provincia && ARGENTINA_LOCATIONS[formData.provincia] &&
                                            Object.keys(ARGENTINA_LOCATIONS[formData.provincia]).sort().map(p => (
                                                <option key={p} value={p}>{p}</option>
                                            ))
                                        }
                                    </select>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {/* Localidad (Dropdown or Input) */}
                                    {formData.partido && ARGENTINA_LOCATIONS[formData.provincia]?.[formData.partido]?.length > 0 ? (
                                        <select
                                            required
                                            className="w-full rounded-lg border-gray-300 border p-2.5 bg-white text-gray-700"
                                            value={formData.localidad}
                                            onChange={e => setFormData({ ...formData, localidad: e.target.value })}
                                        >
                                            <option value="">Selecciona Localidad</option>
                                            {ARGENTINA_LOCATIONS[formData.provincia][formData.partido].sort().map(l => (
                                                <option key={l} value={l}>{l}</option>
                                            ))}
                                        </select>
                                    ) : (
                                        <input
                                            type="text"
                                            required
                                            placeholder="Localidad"
                                            className="w-full rounded-lg border-gray-300 border p-2.5"
                                            value={formData.localidad}
                                            onChange={e => setFormData({ ...formData, localidad: e.target.value })}
                                        />
                                    )}

                                    <input type="text" placeholder="CP" className="w-full rounded-lg border-gray-300 border p-2.5" value={formData.cp} onChange={e => setFormData({ ...formData, cp: e.target.value })} />
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <input type="text" required placeholder="Calle y Altura" className="w-full rounded-lg border-gray-300 border p-2.5 md:col-span-2" value={formData.calle} onChange={e => setFormData({ ...formData, calle: e.target.value })} />
                                    <div className="grid grid-cols-2 gap-2">
                                        <input type="text" placeholder="Piso" className="w-full rounded-lg border-gray-300 border p-2.5" value={formData.piso} onChange={e => setFormData({ ...formData, piso: e.target.value })} />
                                        <input type="text" placeholder="Depto" className="w-full rounded-lg border-gray-300 border p-2.5" value={formData.depto} onChange={e => setFormData({ ...formData, depto: e.target.value })} />
                                    </div>
                                </div>

                                {/* Preview de Dirección Formateada */}
                                {(formData.calle && formData.provincia) && (
                                    <div className="text-xs text-gray-500 bg-gray-50 p-2 rounded border border-gray-100 italic">
                                        <MapPin size={12} className="inline mr-1" />
                                        {`${formData.calle}, ${formData.localidad}, ${formData.partido}, ${formData.provincia}, Argentina`}
                                    </div>
                                )}
                            </div>

                            {/* Nota Legal / Autorizaciones */}
                            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex gap-2 items-start text-xs text-blue-700">
                                <Sparkles size={14} className="mt-0.5 shrink-0" />
                                <p>
                                    <strong>Nota Importante:</strong> El cliente deberá validar su identidad y aceptar los permisos de
                                    <strong> Ubicación con GPS</strong> y <strong>Notificaciones Push</strong> directamente desde su dispositivo
                                    al iniciar sesión en la App Web (PWA). Estos permisos no se pueden forzar desde el panel.
                                </p>
                            </div>

                            <div className="flex gap-3 justify-end pt-4 border-t border-gray-50">
                                <button type="button" onClick={closeModal} className="px-5 py-2.5 text-gray-600 font-medium hover:bg-gray-100 rounded-xl">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg transition active:scale-95">
                                    {loading ? 'Guardando...' : 'Guardar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal ASIGNAR PUNTOS */}
            {pointsModalOpen && selectedClientForPoints && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-md animate-fade-in">
                    <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden animate-scale-up">
                        <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-6 py-6 text-white text-center">
                            <h2 className="text-2xl font-black mb-1">¡Asignar Puntos!</h2>
                            <p className="opacity-90 text-sm">a {selectedClientForPoints.name}</p>
                        </div>

                        <form onSubmit={handleAssignPoints} className="p-6 space-y-6">
                            {/* Selector de Modo */}
                            <div className="bg-gray-100 p-1 rounded-lg flex text-sm font-bold">
                                <button
                                    type="button"
                                    onClick={() => setPointsData({ ...pointsData, isPesos: true })}
                                    className={`flex-1 py-2 rounded-md transition ${pointsData.isPesos ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    En Pesos ($)
                                </button>
                                <button
                                    type="button"
                                    onClick={() => setPointsData({ ...pointsData, isPesos: false })}
                                    className={`flex-1 py-2 rounded-md transition ${!pointsData.isPesos ? 'bg-white shadow text-green-600' : 'text-gray-500 hover:text-gray-700'}`}
                                >
                                    Directo (Pts)
                                </button>
                            </div>

                            {/* Input Principal */}
                            <div className="relative">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">
                                    {pointsData.isPesos ? 'Monto de la Compra' : 'Cantidad de Puntos'}
                                </label>
                                <div className="relative">
                                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 font-bold text-lg">
                                        {pointsData.isPesos ? '$' : 'Pts'}
                                    </span>
                                    <input
                                        type="number" autoFocus required min="1"
                                        className="w-full bg-gray-50 border-2 border-gray-200 rounded-xl py-4 pl-10 pr-4 text-3xl font-bold text-gray-800 outline-none focus:border-green-500 focus:bg-white transition"
                                        placeholder="0"
                                        value={pointsData.amount}
                                        onChange={e => setPointsData({ ...pointsData, amount: e.target.value })}
                                    />
                                </div>
                                {pointsData.isPesos && (
                                    <div className="text-right mt-2 space-y-1">
                                        <p className="text-xs text-green-600 font-bold">
                                            ➜ Base: {Math.floor((parseFloat(pointsData.amount || '0') / 100) * (config?.pointsPerPeso || 1))} Pts
                                        </p>
                                        {/* Preview de Bonos (Solo visual, requiere lógica async real, aquí simulamos llamada o dejamos genérico) 
                                            Para hacerlo reactivo real necesitaríamos un useEffect que busque bonos al abrir el modal.
                                            Por simplicidad y performance, mostraremos el aviso genérico si detectamos bonos al abrir.
                                        */}
                                        <BonusPreview />
                                    </div>
                                )}
                                {/* Visualización del Vencimiento (Feedback para el usuario) */}
                                <div className="mt-2 text-right">
                                    <p className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">
                                        Vencimiento de este lote:
                                    </p>
                                    <p className="text-sm font-medium text-gray-600">
                                        {(() => {
                                            // Calcular 'preview' del vencimiento
                                            let pts = 0;
                                            if (pointsData.isPesos) {
                                                const currentBalance = selectedClientForPoints?.accumulated_balance || 0;
                                                const totalVal = (parseFloat(pointsData.amount) || 0) + currentBalance;
                                                pts = Math.floor((totalVal / 100) * (config?.pointsPerPeso || 1));
                                            } else {
                                                pts = parseFloat(pointsData.amount) || 0;
                                            }

                                            // Buscar regla
                                            let days = 365;
                                            if (config?.expirationRules && pts > 0) {
                                                const rule = config.expirationRules.find((r: any) =>
                                                    pts >= r.minPoints && (r.maxPoints === null || pts <= r.maxPoints)
                                                );
                                                if (rule) {
                                                    days = rule.validityDays;
                                                } else {
                                                    // Fallback for exceeding points: Highest Tier logic
                                                    const sorted = [...config.expirationRules].sort((a: any, b: any) => Number(a.minPoints) - Number(b.minPoints));
                                                    const lastRule = sorted[sorted.length - 1];

                                                    // If pts >= lastRule.minPoints, then we are in (or above) the top tier
                                                    if (lastRule && pts >= Number(lastRule.minPoints)) {
                                                        days = lastRule.validityDays;
                                                    }
                                                }
                                            }

                                            // Calculate expiration based on PURCHASE DATE, not just today
                                            const baseDate = pointsData.purchaseDate
                                                ? new Date(pointsData.purchaseDate + 'T12:00:00')
                                                : new Date();

                                            const d = new Date(baseDate);
                                            d.setDate(d.getDate() + days);
                                            return d.toLocaleDateString('es-AR', { day: '2-digit', month: 'long', year: 'numeric' });
                                        })()}
                                    </p>
                                </div>
                            </div>

                            {/* Fecha de Compra */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Fecha de Compra</label>
                                <input
                                    type="date"
                                    required
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-100 font-medium text-gray-700"
                                    value={pointsData.purchaseDate}
                                    max={new Date().toISOString().split('T')[0]}
                                    onChange={e => setPointsData({ ...pointsData, purchaseDate: e.target.value })}
                                />
                            </div>

                            {/* Concepto */}
                            <div>
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Motivo / Concepto</label>
                                <select
                                    className="w-full p-3 bg-white border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-green-100"
                                    value={pointsData.concept}
                                    onChange={e => setPointsData({ ...pointsData, concept: e.target.value })}
                                >
                                    <option>Compra en local</option>
                                    <option>Regalo de cumpleaños</option>
                                    <option>Ajuste manual</option>
                                    <option>Promoción especial</option>
                                </select>
                            </div>

                            {/* Notificar Checkbox */}
                            {config?.messaging?.whatsappEnabled && (
                                <div className="flex items-center gap-2 p-3 bg-green-50 rounded-xl border border-green-100 cursor-pointer" onClick={() => setNotifyWhatsapp(!notifyWhatsapp)}>
                                    <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${notifyWhatsapp ? 'bg-green-500 border-green-500' : 'bg-white border-gray-300'}`}>
                                        {notifyWhatsapp && <span className="text-white text-xs font-bold">✓</span>}
                                    </div>
                                    <span className="text-sm font-bold text-gray-700 select-none">Notificar al cliente por WhatsApp</span>
                                </div>
                            )}

                            {/* Aplicar Promociones Checkbox */}
                            <div className="flex items-center gap-2 p-3 bg-purple-50 rounded-xl border border-purple-100 cursor-pointer mt-2" onClick={() => setApplyPromotions(!applyPromotions)}>
                                <div className={`w-5 h-5 rounded border flex items-center justify-center transition ${applyPromotions ? 'bg-purple-500 border-purple-500' : 'bg-white border-gray-300'}`}>
                                    {applyPromotions && <span className="text-white text-xs font-bold">✓</span>}
                                </div>
                                <span className="text-sm font-bold text-gray-700 select-none">Aplicar Promociones Vigentes</span>
                            </div>

                            <div className="flex gap-3 pt-2">
                                <button
                                    type="button" onClick={closePointsModal}
                                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl"
                                >
                                    Cancelar
                                </button>
                                <button
                                    type="submit" disabled={loading}
                                    className="flex-1 py-3 bg-grad-green text-white bg-green-500 hover:bg-green-600 font-bold rounded-xl shadow-lg shadow-green-200 transform transition active:scale-95"
                                >
                                    {loading ? 'Asignando...' : 'Confirmar'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* Modal REDENCION/CANJE */}
            {redemptionModalOpen && selectedClientForRedemption && (
                <RedemptionModal
                    client={selectedClientForRedemption}
                    onClose={() => {
                        setRedemptionModalOpen(false);
                        setSelectedClientForRedemption(null);
                    }}
                    onRedeemSuccess={() => {
                        fetchData(); // Recargar puntos
                    }}
                />
            )}

            {/* Modal HISTORIAL */}
            {historyModalOpen && selectedClientForHistory && (
                <PointsHistoryModal
                    isOpen={historyModalOpen}
                    client={selectedClientForHistory}
                    onClose={() => {
                        setHistoryModalOpen(false);
                        setSelectedClientForHistory(null);
                    }}
                    onClientUpdated={fetchData}
                />
            )}
        </div>
    );
};

// Componente auxiliar para mostrar bonos activos en el modal
const BonusPreview = () => {
    const [bonuses, setBonuses] = useState<any[]>([]);

    useEffect(() => {
        CampaignService.getActiveBonusesForToday().then(setBonuses);
    }, []);

    if (bonuses.length === 0) return null;

    return (
        <div className="animate-pulse flex flex-col items-end gap-1 mt-1">
            {bonuses.map(b => (
                <span key={b.id} className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-0.5 rounded-md border border-purple-100 flex items-center gap-1">
                    <Sparkles size={10} />
                    {b.rewardType === 'MULTIPLIER'
                        ? `x${b.rewardValue} Pts por ${b.name}`
                        : `+${b.rewardValue} Pts por ${b.name}`
                    }
                </span>
            ))}
        </div>
    );
};
