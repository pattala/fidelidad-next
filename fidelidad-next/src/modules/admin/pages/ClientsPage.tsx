
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Edit, Trash2, X, Search, MapPin, Phone, Mail, Coins, Sparkles, Gift, History, MessageCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc, increment, runTransaction, arrayUnion, where, setDoc } from 'firebase/firestore';
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

                    // Address Normalization (Flattening)
                    provincia: data.domicilio?.components?.provincia || data.provincia || '',
                    partido: data.domicilio?.components?.partido || data.partido || '',
                    localidad: data.domicilio?.components?.localidad || data.localidad || '',
                    calle: data.domicilio?.components?.calle || data.calle || '',
                    piso: data.domicilio?.components?.piso || data.piso || '',
                    depto: data.domicilio?.components?.depto || data.depto || '',
                    cp: data.domicilio?.components?.zipCode || data.cp || ''
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
        if (isReadOnly) return;
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
                // --- CREAR NUEVO CLIENTE ---
                let newDocId = '';
                let welcomePts = config?.welcomePoints || 0;

                // Generar ID Socio
                let newSocioId = formData.socioNumber;
                if (!newSocioId) {
                    try {
                        await runTransaction(db, async (transaction) => {
                            const counterRef = doc(db, 'config', 'counters');
                            const counterDoc = await transaction.get(counterRef);
                            let nextId = 1000;
                            if (counterDoc.exists()) nextId = counterDoc.data().lastSocioId + 1;
                            transaction.set(counterRef, { lastSocioId: nextId }, { merge: true });
                            newSocioId = nextId.toString();
                        });
                    } catch (e) {
                        newSocioId = Math.floor(1000 + Math.random() * 9000).toString();
                    }
                }

                // Payload Base
                const createPayload = {
                    email: formData.email,
                    dni: formData.dni,
                    nombre: formData.name,
                    telefono: formData.phone,
                    numeroSocio: newSocioId,
                    domicilio: {
                        status: 'complete',
                        addressLine: formattedAddress,
                        components: {
                            calle: formData.calle,
                            localidad: formData.localidad,
                            partido: formData.partido,
                            provincia: formData.provincia
                        }
                    },
                    fechaInscripcion: new Date().toISOString()
                };

                // INTENTO 1: Usar API (Backend Real para Auth + Firestore)
                let creationSuccess = false;
                try {
                    const resCreate = await fetch('/api/create-user', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': import.meta.env.VITE_API_KEY || ''
                        },
                        body: JSON.stringify(createPayload)
                    });

                    if (resCreate.ok) {
                        const resultCreate = await resCreate.json();
                        if (resultCreate.ok) {
                            newDocId = resultCreate.firestore.docId;
                            creationSuccess = true;
                            toast.success('¡Cliente registrado con éxito!');
                        }
                    } else {
                        const errData = await resCreate.json();
                        console.warn("API Create falló:", errData);
                    }
                } catch (e) {
                    console.warn("API Backend no disponible, usando método directo...", e);
                }

                // FALLBACK: Escritura Directa en Firestore (Si falló API)
                if (!creationSuccess) {
                    try {
                        const usersCol = collection(db, 'users');
                        const newDocRef = doc(usersCol);
                        newDocId = newDocRef.id;

                        await setDoc(newDocRef, {
                            ...createPayload,
                            points: 0,
                            role: 'client',
                            createdAt: new Date(),
                            updatedAt: new Date(),
                            name: formData.name,
                            phone: formData.phone,
                            socioNumber: newSocioId,
                            calle: formData.calle,
                            localidad: formData.localidad,
                            provincia: formData.provincia
                        });
                        toast.success('¡Cliente registrado con éxito (Modo Local)!');
                    } catch (errFallback) {
                        console.error("Error fatal creando cliente:", errFallback);
                        toast.error("Error al guardar en base de datos");
                        setLoading(false);
                        return;
                    }
                }

                // --- POST-CREATION ACTIONS ---
                console.log("[ClientsPage] Starting post-creation actions for ID:", newDocId);
                if (newDocId) {
                    // Refrescar config al vuelo para asegurar que no sea null
                    const freshConfig = await ConfigService.get();

                    // 1. Asignar Puntos de Bienvenida
                    if (welcomePts > 0) {
                        let days = 365;
                        if (freshConfig?.expirationRules) {
                            const rule = freshConfig.expirationRules.find((r: any) =>
                                welcomePts >= r.minPoints && (r.maxPoints === null || welcomePts <= r.maxPoints)
                            );
                            if (rule) days = rule.validityDays;
                        }

                        const expiresAt = new Date();
                        expiresAt.setDate(expiresAt.getDate() + days);

                        await addDoc(collection(db, `users/${newDocId}/points_history`), {
                            amount: welcomePts,
                            concept: '🎁 Bienvenida al sistema',
                            date: new Date(),
                            type: 'credit',
                            expiresAt: expiresAt
                        });

                        await updateDoc(doc(db, 'users', newDocId), {
                            points: welcomePts,
                            historialPuntos: arrayUnion({
                                fechaObtencion: new Date(),
                                puntosObtenidos: welcomePts,
                                puntosDisponibles: welcomePts,
                                diasCaducidad: days,
                                origen: '🎁 Bienvenida al sistema',
                                estado: 'Activo'
                            })
                        });
                    }

                    // 2. WhatsApp (Si está habilitado el canal 'welcome')
                    const welcomeTemplate = freshConfig?.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome;
                    const welcomeMsg = welcomeTemplate
                        .replace(/{nombre}/g, formData.name.split(' ')[0])
                        .replace(/{nombre_completo}/g, formData.name)
                        .replace(/{puntos}/g, welcomePts.toString())
                        .replace(/{dni}/g, formData.dni)
                        .replace(/{email}/g, formData.email)
                        .replace(/{socio}/g, newSocioId)
                        .replace(/{numero_socio}/g, newSocioId)
                        .replace(/{telefono}/g, formData.phone);

                    if (formData.phone && NotificationService.isChannelEnabled(freshConfig, 'welcome', 'whatsapp')) {
                        const cleanPhone = formData.phone.replace(/\D/g, '');
                        if (cleanPhone.length > 5) {
                            const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(welcomeMsg.trim())}`;
                            window.open(waUrl, '_blank');
                        }
                    }

                    // 3. Email (Si está habilitado el canal 'welcome')
                    if (formData.email && NotificationService.isChannelEnabled(freshConfig, 'welcome', 'email')) {
                        const htmlContent = EmailService.generateBrandedTemplate(freshConfig || {}, '¡Bienvenido al Club!', welcomeMsg);
                        EmailService.sendEmail(formData.email, '¡Bienvenido al Club!', htmlContent).catch(() => { });
                    }

                    // 4. Push & Inbox
                    NotificationService.sendToClient(newDocId, {
                        title: '¡Bienvenido al Club!',
                        body: welcomeMsg,
                        type: 'welcome',
                        icon: freshConfig?.logoUrl
                    }).catch(() => { });
                }
            }

            closeModal();
            setTimeout(() => fetchData(), 1000);
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
                    'x-api-key': import.meta.env.VITE_API_KEY
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

            // Bonistas
            const activeBonuses = applyPromotions ? await CampaignService.getActiveBonusesForToday() : [];
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

            // Expiración
            let days = 365;
            if (currentConfig?.expirationRules) {
                const rule = currentConfig.expirationRules.find((r: any) =>
                    finalPoints >= Number(r.minPoints) && (!r.maxPoints || finalPoints <= Number(r.maxPoints))
                );
                if (rule) days = rule.validityDays;
            }

            const now = TimeService.now();
            const expiresAt = new Date(now);
            expiresAt.setDate(expiresAt.getDate() + days);

            // Guardar
            if (finalPoints > 0) {
                await addDoc(collection(db, `users/${selectedClientForPoints.id}/points_history`), {
                    amount: finalPoints,
                    concept: pointsData.concept,
                    date: now,
                    type: 'credit',
                    expiresAt: expiresAt
                });

                await updateDoc(doc(db, 'users', selectedClientForPoints.id), {
                    points: increment(finalPoints),
                    historialPuntos: arrayUnion({
                        fechaObtencion: now,
                        puntosObtenidos: finalPoints,
                        puntosDisponibles: finalPoints,
                        diasCaducidad: days,
                        origen: pointsData.concept,
                        estado: 'Activo'
                    })
                });
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
            toast.error("Error al asignar puntos");
        } finally {
            setLoading(false);
        }
    };


    // Auxiliares
    const refreshAndOpen = async (client: Client, openFn: (c: Client) => void) => {
        try {
            const docRef = doc(db, 'users', client.id);
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
        setFormData(INITIAL_CLIENT_STATE);
        setIsModalOpen(true);
    };

    const openEditClientModal = (client: Client) => {
        if (isReadOnly) return;
        setEditingId(client.id);
        // Map client to formData keys correctly
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
        setFormData(INITIAL_CLIENT_STATE);
    };

    const openPointsModal = (client: Client) => {
        if (isReadOnly) return;
        setSelectedClientForPoints(client);
        setPointsData({ amount: '', concept: 'Compra en local', isPesos: true, purchaseDate: new Date().toISOString().split('T')[0] });
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

    // Filtrar
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
                {!isReadOnly && (
                    <button
                        onClick={openNewClientModal}
                        className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-xl font-bold transition shadow-lg shadow-blue-100"
                    >
                        <Plus size={20} /> Nuevo Cliente
                    </button>
                )}
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

            {/* Lista de Clientes */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
                {filteredClients.map((client) => (
                    <div key={client.id} className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition group">
                        <div className="flex justify-between items-start mb-4">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center font-bold text-xl uppercase">
                                    {client.name?.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-gray-800 line-clamp-1">{client.name}</h3>
                                    <div className="flex items-center gap-2 text-xs text-gray-400">
                                        <span className="bg-gray-100 px-1.5 py-0.5 rounded font-mono">#{client.socioNumber}</span>
                                        <span>DNI {client.dni}</span>
                                    </div>
                                </div>
                            </div>
                            <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition">
                                {!isReadOnly && (
                                    <>
                                        <button onClick={() => openEditClientModal(client)} className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Editar">
                                            <Edit size={18} />
                                        </button>
                                        <button onClick={() => handleDelete(client.id, client.name)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition" title="Eliminar">
                                            <Trash2 size={18} />
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>

                        <div className="space-y-2 mb-6 text-sm">
                            <div className="flex items-center gap-2 text-gray-600">
                                <Phone size={14} className="text-gray-400" /> {client.phone}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600 truncate">
                                <Mail size={14} className="text-gray-400" /> {client.email}
                            </div>
                            <div className="flex items-center gap-2 text-gray-600">
                                <MapPin size={14} className="text-gray-400" /> {client.localidad || 'Sin dirección'}
                            </div>
                        </div>

                        <div className="flex items-center justify-between pt-4 border-t border-gray-50 bg-gray-50/30 -mx-6 -mb-6 px-6 pb-6 rounded-b-2xl mt-4">
                            <div className="flex flex-col">
                                <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wider">Puntos Disponibles</span>
                                <div className="flex items-center gap-1.5 text-blue-600">
                                    <Coins size={18} />
                                    <span className="text-xl font-black">{client.points || 0}</span>
                                </div>
                            </div>

                            <div className="flex gap-2">
                                <button
                                    onClick={() => openHistoryModal(client)}
                                    className="p-2.5 bg-white text-gray-500 hover:text-blue-600 rounded-xl border border-gray-200 shadow-sm transition"
                                    title="Ver Historial"
                                >
                                    <History size={18} />
                                </button>
                                {!isReadOnly && (
                                    <>
                                        <button
                                            onClick={() => openPointsModal(client)}
                                            className="px-4 py-2.5 bg-green-600 hover:bg-green-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition"
                                        >
                                            <Plus size={18} /> Sumar
                                        </button>
                                        <button
                                            onClick={() => openRedemptionModal(client)}
                                            className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold flex items-center gap-2 shadow-sm transition"
                                        >
                                            <Gift size={18} /> Canje
                                        </button>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* MODAL: CRUD Cliente */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                    <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
                        <div className="bg-blue-600 p-6 flex justify-between items-center text-white">
                            <h2 className="text-xl font-bold">{editingId ? 'Editar Cliente' : 'Nuevo Cliente'}</h2>
                            <button onClick={closeModal} className="p-2 hover:bg-white/10 rounded-full transition"><X size={20} /></button>
                        </div>
                        <form onSubmit={handleSave} className="p-8 space-y-6 overflow-y-auto">
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
                                    <label className="block text-sm font-bold text-gray-700 mb-2">DNI</label>
                                    <input
                                        type="text"
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
                            </div>

                            <hr className="border-gray-100" />
                            <h3 className="font-bold text-gray-800 flex items-center gap-2"><MapPin size={16} /> Dirección</h3>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Provincia</label>
                                    <select
                                        className="w-full p-3 rounded-xl border border-gray-200"
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
                                        className="w-full p-3 rounded-xl border border-gray-200"
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
                                        className="w-full p-3 rounded-xl border border-gray-200"
                                        value={formData.localidad}
                                        onChange={e => setFormData({ ...formData, localidad: e.target.value })}
                                        disabled={!formData.partido}
                                    >
                                        <option value="">Seleccionar...</option>
                                        {formData.partido && (ARGENTINA_LOCATIONS as any)[formData.provincia][formData.partido].map((l: string) => <option key={l} value={l}>{l}</option>)}
                                    </select>
                                </div>
                            </div>

                            <div className="mt-8 flex justify-end gap-3">
                                <button type="button" onClick={closeModal} className="px-8 py-3 rounded-xl font-bold text-gray-500 hover:bg-gray-50 transition">Cancelar</button>
                                <button type="submit" disabled={loading} className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50">
                                    {loading ? 'Guardando...' : 'Guardar Cliente'}
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

                            <div>
                                <label className="block text-sm font-bold text-gray-700 mb-2">Concepto / Motivo</label>
                                <input
                                    type="text"
                                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-green-100 outline-none"
                                    value={pointsData.concept}
                                    onChange={e => setPointsData({ ...pointsData, concept: e.target.value })}
                                />
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
                    isOpen={redemptionModalOpen}
                    onClose={() => setRedemptionModalOpen(false)}
                    onSuccess={() => {
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
        </div>
    );
};
