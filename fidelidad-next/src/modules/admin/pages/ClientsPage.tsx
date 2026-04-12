
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    Users, Plus, Search, Filter, Mail, Phone, MapPin, Check, Bell, Coins, History,
    Shield, ArrowRight, Download, Edit2, Trash2, X, ChevronRight, Gift, Sparkles, Cake,
    FileDown, MessageCircle, Edit, TrendingUp, Monitor, Smartphone, Dog
} from 'lucide-react';
import toast from 'react-hot-toast';
import { collection, addDoc, getDocs, query, orderBy, doc, deleteDoc, updateDoc, increment, runTransaction, arrayUnion, where, setDoc, collectionGroup, onSnapshot, serverTimestamp, Timestamp } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import { NotificationService } from '../../../services/notificationService';
import { EmailService } from '../../../services/emailService';
import { CampaignService } from '../../../services/campaignService';
import { TimeService } from '../../../services/timeService';
import type { Client } from '../../../types';
import { RedemptionModal } from '../components/RedemptionModal';
import { PointsHistoryModal } from '../components/PointsHistoryModal';
import { VisitHistoryModal } from '../components/VisitHistoryModal';
import { ExpirationService } from '../../../services/expirationService';
import { AuditService } from '../../../services/auditService';

import { ARGENTINA_LOCATIONS } from '../../../data/locations'; // Import added
import { useAdminAuth } from '../contexts/AdminAuthContext';
import { PhoneUtils } from '../../../utils/phoneUtils';

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
    points: 0,
    birthDate: '',
    isTestUser: false,
    pets: [] as any[]
};


const PointsTimer = ({ endTime }: { endTime?: string }) => {
    const [timeLeft, setTimeLeft] = useState<string>('');
    const [isGrace, setIsGrace] = useState(false);

    useEffect(() => {
        if (!endTime) return;
        const interval = setInterval(() => {
            const now = TimeService.now();
            const [h, m] = endTime.split(':').map(Number);
            const target = new Date(now);
            target.setHours(h, m, 0, 0);

            const diff = target.getTime() - now.getTime();

            if (diff > 0) {
                setIsGrace(false);
                const mm = Math.floor(diff / (1000 * 60));
                const ss = Math.floor((diff % (1000 * 60)) / 1000);
                setTimeLeft(`${mm}:${ss.toString().padStart(2, '0')}`);
            } else {
                setIsGrace(true);
                const graceDiff = diff + (15 * 60 * 1000);
                if (graceDiff > 0) {
                    const mm = Math.floor(graceDiff / (1000 * 60));
                    const ss = Math.floor((graceDiff % (1000 * 60)) / 1000);
                    setTimeLeft(`${mm}:${ss.toString().padStart(2, '0')}`);
                } else {
                    setTimeLeft('00:00');
                }
            }
        }, 1000);
        return () => clearInterval(interval);
    }, [endTime]);

    if (!endTime) return null;

    return (
        <div className="flex items-center gap-1">
            <span className={`text-[8px] px-1 rounded-full font-black ${isGrace ? 'bg-orange-100 text-orange-600' : 'bg-green-100 text-green-600 animate-pulse'}`}>
                {isGrace ? 'TOLERANCIA' : '¡ACTIVA!'}
            </span>
            <span className={`text-[9px] font-black px-1 rounded-sm ${isGrace ? 'bg-orange-50 text-orange-600' : 'bg-green-50 text-green-600'}`}>
                {isGrace ? 'CIERRA EN: ' : 'TERMINA EN: '}{timeLeft}
            </span>
        </div>
    );
};

export const ClientsPage = () => {
    const navigate = useNavigate();
    const { isReadOnly } = useAdminAuth();

    // Estados
    const [clients, setClients] = useState<Client[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState(false); // New state for buttons/modals
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
    const [isPetFoodPurchase, setIsPetFoodPurchase] = useState(false);
    const [selectedPetsForFood, setSelectedPetsForFood] = useState<string[]>([]);

    // Toggles Alta Cliente
    const [applyWelcomeBonus, setApplyWelcomeBonus] = useState(true);
    const [applyAddressBonus, setApplyAddressBonus] = useState(true);
    const [sendWelcomeWa, setSendWelcomeWa] = useState(true);

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
            const q = query(collection(db, 'users'));
            const snapshot = await getDocs(q);

            // 1. Fetch Config first to use it in calculations
            const freshConfig = await ConfigService.get();
            setConfig(freshConfig);

            const loadedClientsPromises = snapshot.docs.map(async (doc) => {
                const data = doc.data();
                // Calcular métricas complejas (vencimientos, etc.)
                const metrics = await ExpirationService.getClientMetrics(doc.id);

                // Address Normalization (Flattening)
                const provincia = data.domicilio?.components?.provincia || data.provincia || '';
                const partido = data.domicilio?.components?.partido || data.partido || '';
                const localidad = data.domicilio?.components?.localidad || data.localidad || '';
                const calle = data.domicilio?.components?.calle || data.calle || '';
                const piso = data.domicilio?.components?.piso || data.piso || '';
                const depto = data.domicilio?.components?.depto || data.depto || '';
                const cp = data.domicilio?.components?.zipCode || data.cp || '';

                const expirations = metrics.expirations || [];
                const sortedExpirations = [...expirations].sort((a: any, b: any) => a.date.getTime() - b.date.getTime());

                return {
                    id: doc.id,
                    ...data,
                    name: data.name || data.nombre || '',
                    email: data.email || '',
                    dni: data.dni || '',
                    phone: data.phone || data.telefono || '',
                    points: data.points ?? data.puntos ?? 0,
                    socioNumber: String(data.socioNumber || data.numeroSocio || ''),
                    expiringPoints: metrics.expiring,
                    expirationDetails: sortedExpirations,
                    totalSpent: metrics.totalspent,
                    redeemedPoints: metrics.redeemedPoints,
                    redeemedValue: metrics.redeemedValue,
                    registrationDate: data.createdAt || data.fechaInscripcion || null,
                    provincia, partido, localidad, calle, piso, depto, cp,
                    createdAt: data.createdAt // Preservar para sort
                } as Client;
            });

            const loadedClients = await Promise.all(loadedClientsPromises);

            // Ordenar en memoria por createdAt desc (clientes más nuevos primero)
            const sortedAndFiltered = loadedClients
                .filter((c: Client) => (c.name || c.dni) && c.role !== 'admin')
                .sort((a: Client, b: Client) => {
                    const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
                    const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
                    return dateB - dateA;
                });

            setClients(sortedAndFiltered);
        } catch (error) {
            console.error("Error cargando datos:", error);
            toast.error("Error de conexión");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        setLoading(true);
        // Config listener
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (snap) => {
            if (snap.exists()) setConfig(snap.data());
        });

        // Clients listener (Real-time). Quitamos orderBy para no excluir docs que no tengan el campo 'createdAt'
        const q = query(collection(db, 'users'));
        const unsubscribe = onSnapshot(q, async (snapshot) => {
            // We still need the complex calculations, so we call fetchData but optimized
            // To avoid flickering, we'll do the fetch and then set. 
            // In a real app we'd subscribe to history too, but that's heavy.
            fetchData();
        });

        return () => {
            unsubscribe();
            unsubConfig();
        };
    }, []);

    // 2. Guardar Cliente (CRUD)
    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly) return;
        setActionLoading(true); // Use actionLoading

        const safeDni = formData.dni.trim();
        const safeEmail = formData.email.trim();
        let newDocId = editingId || '';
        let finalSocioId = formData.socioNumber;

        if (!safeEmail.includes('@')) {
            toast.error('El email debe ser válido');
            setActionLoading(false);
            return;
        }

        if (!safeDni || safeDni.length < 6) {
            toast.error('El DNI es obligatorio y debe tener al menos 6 caracteres (se usará como contraseña)');
            setActionLoading(false);
            return;
        }

        if (!formData.phone) {
            toast.error('El teléfono es obligatorio');
            setActionLoading(false);
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
                    setActionLoading(false);
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
                    setActionLoading(false);
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
                    },
                    pets: formData.pets || [],
                    termsAccepted: true,
                    termsAcceptedAt: new Date().toISOString()
                };
                await updateDoc(doc(db, 'users', editingId), clientPayload);

                // --- AUDITORIA ---
                AuditService.log('user_mgmt', `Perfil actualizado: ${formData.name}`, [
                    { action: 'user_updated_profile', status: 'success', info: `Cambios en perfil de ${formData.name}. DNI: ${formData.dni}, Tel: ${formData.phone}` }
                ]);

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
                    birthDate: formData.birthDate,
                    localidad: formData.localidad,
                    numeroSocio: finalSocioId,
                    pets: formData.pets || [],
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
                    source: 'local',
                    termsAccepted: true,
                    termsAcceptedAt: new Date().toISOString()
                };

                let apiSuccess = false;
                try {
                    const token = await auth.currentUser?.getIdToken();
                    const res = await fetch('/api/users?action=create', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'x-api-key': import.meta.env.VITE_API_KEY || '',
                            'Authorization': `Bearer ${token}`
                        },
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
                        setActionLoading(false);
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
                        setActionLoading(false);
                        return;
                    }
                }
            }

            // --- ACCIONES POST-ALTA ---
            if (!editingId && newDocId) {
                const freshConfig = await ConfigService.get();

                let totalWelcomePts = 0;
                const conceptParts: string[] = [];

                if (applyWelcomeBonus && Number(freshConfig?.welcomePoints || 0) > 0 && freshConfig?.enableWelcomeBonus !== false) {
                    totalWelcomePts += Number(freshConfig?.welcomePoints);
                    conceptParts.push('Registro');
                }

                const hasAddress =
                    formData.calle.trim() !== '' &&
                    formData.provincia.trim() !== '' &&
                    (formData.localidad.trim() !== '' || formData.partido.trim() !== '');

                if (applyAddressBonus && Number(freshConfig?.pointsForAddress || 0) > 0 && freshConfig?.enableAddressBonus !== false && hasAddress) {
                    totalWelcomePts += Number(freshConfig?.pointsForAddress);
                    conceptParts.push('Domicilio');
                }

                if (totalWelcomePts > 0) {
                    let days = 365;
                    if (freshConfig?.expirationRules && freshConfig.expirationRules.length > 0) {
                        const sortedRules = [...freshConfig.expirationRules].sort((a: any, b: any) => (a.minPoints || 0) - (b.minPoints || 0));
                        const rule = sortedRules.find((r: any) => totalWelcomePts >= r.minPoints && (!r.maxPoints || totalWelcomePts <= r.maxPoints));
                        if (rule) {
                            days = rule.validityDays;
                        } else {
                            const highestRule = sortedRules[sortedRules.length - 1];
                            if (totalWelcomePts >= (highestRule.minPoints || 0)) {
                                days = highestRule.validityDays;
                            }
                        }
                    }
                    const expiresAt = TimeService.now();
                    expiresAt.setDate(expiresAt.getDate() + days);

                    const conceptStr = `🎁 Bienvenida al sistema (${conceptParts.join(' + ')})`;

                    await addDoc(collection(db, `users/${newDocId}/points_history`), {
                        amount: totalWelcomePts,
                        concept: conceptStr,
                        date: new Date(),
                        type: 'credit',
                        expiresAt: expiresAt
                    });

                    await updateDoc(doc(db, 'users', newDocId), {
                        points: totalWelcomePts,
                        historialPuntos: arrayUnion({
                            fechaObtencion: new Date(),
                            puntosObtenidos: totalWelcomePts,
                            puntosDisponibles: totalWelcomePts,
                            diasCaducidad: days,
                            origen: conceptStr,
                            estado: 'Activo'
                        })
                    });
                }

                const welcomeTemplate = freshConfig?.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome;
                const welcomeMsg = welcomeTemplate
                    .replace(/{nombre}/g, formData.name.split(' ')[0])
                    .replace(/{nombre_completo}/g, formData.name)
                    .replace(/{puntos}/g, totalWelcomePts.toString())
                    .replace(/{dni}/g, formData.dni)
                    .replace(/{email}/g, formData.email)
                    .replace(/{socio}/g, finalSocioId)
                    .replace(/{numero_socio}/g, finalSocioId)
                    .replace(/{telefono}/g, formData.phone)
                    .replace(/{siteName}/g, freshConfig?.siteName || 'nuestro Club');

                if (formData.phone && sendWelcomeWa) {
                    const cleanPhone = PhoneUtils.formatForWhatsApp(formData.phone);
                    if (cleanPhone) {
                        const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(welcomeMsg.trim())}`;
                        setTimeout(() => {
                            const link = document.createElement('a');
                            link.href = waUrl;
                            link.target = '_blank';
                            link.rel = 'noopener noreferrer';
                            document.body.appendChild(link);
                            link.click();
                            document.body.removeChild(link);
                        }, 500);
                    }
                }

                if (formData.email && NotificationService.isChannelEnabled(freshConfig, 'welcome', 'email')) {
                    const welcomeSubject = `¡Bienvenido a ${freshConfig?.siteName || 'nuestro Club'}!`;
                    const htmlContent = EmailService.generateBrandedTemplate(freshConfig || {}, welcomeSubject, welcomeMsg);
                    EmailService.sendEmail(formData.email, welcomeSubject, htmlContent).catch(() => { });
                }

                NotificationService.sendToClient(newDocId, {
                    title: `¡Bienvenido a ${freshConfig?.siteName || 'nuestro Club'}!`,
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
            setActionLoading(false);
        }
    };

    // 3. Eliminar
    const handleDelete = async (id: string, name: string) => {
        if (isReadOnly) return;

        // PROTECCIÓN DE CUENTAS MAESTRAS
        const masterEmails = ['pablo_attala@yahoo.com.ar', 'admin@admin.com'];
        // Obtenemos el email buscando en la lista local de clientes (id es doc.id)
        const targetClient = clients.find(c => c.id === id);
        if (targetClient && masterEmails.includes(targetClient.email?.toLowerCase())) {
            toast.error("Esta es una cuenta maestra del sistema y no puede ser eliminada.");
            return;
        }

        if (!window.confirm(`¿Estás seguro de eliminar a ${name}? Esta acción borrará permanentemente sus puntos, visitas y mensajes.`)) return;

        const toastId = toast.loading('Eliminando usuario y limpiando datos...');
        try {
            const response = await fetch('/api/users?action=delete', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || ''
                },
                body: JSON.stringify({ docId: id })
            });

            if (response.ok) {
                // --- AUDITORIA ---
                AuditService.log('user_mgmt', `Cliente eliminado: ${name}`, [
                    { action: 'client_deleted', status: 'success', info: `ID: ${id}, Nombre: ${name}` }
                ]);
                toast.success('Cliente y todos sus datos eliminados correctamente', { id: toastId });
            } else {
                const err = await response.json();
                throw new Error(err.error || 'Error en el servidor al purgar datos');
            }
            fetchData();
        } catch (error: any) {
            console.error("Delete error:", error);
            toast.error(`Error de purga: ${error.message}. Intenta de nuevo o verifica tu conexión.`, { id: toastId });
        }
    };

    // 4. Asignar Puntos
    const handleAssignPoints = async (e: React.FormEvent) => {
        e.preventDefault();
        if (isReadOnly || !selectedClientForPoints) return;

        setActionLoading(true);
        try {
            const inputVal = parseFloat(pointsData.amount);
            if (isNaN(inputVal) || inputVal <= 0) {
                toast.error("Ingrese un monto válido");
                setActionLoading(false);
                return;
            }

            const token = await auth.currentUser?.getIdToken();
            const res = await fetch('/api/assign-points', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': import.meta.env.VITE_API_KEY || '',
                    'Authorization': `Bearer ${token}`,
                    'x-executor-role': (auth.currentUser as any)?.reloadUserInfo?.customAttributes?.includes('editor') ? 'editor' : 'admin'
                },
                body: JSON.stringify({
                    uid: selectedClientForPoints.id,
                    amount: inputVal,
                    reason: pointsData.isPesos ? 'external_integration' : 'manual',
                    concept: pointsData.concept,
                    date: pointsData.purchaseDate,
                    bonusIds: applyPromotions ? selectedPromos : [],
                    applyWhatsApp: notifyWhatsapp
                })
            });

            const data = await res.json();

            if (data.ok) {
                toast.success(`¡Se asignaron ${data.pointsAdded} puntos!`);
                if (data.whatsappLink && notifyWhatsapp) {
                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = data.whatsappLink;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }, 500);
                }

                // 3. Update User Balance
                const userRef = doc(db, 'users', selectedClientForPoints.id);
                const updates: any = {
                    points: increment(data.pointsAdded)
                };

                // SECCION PETSHOP: Actualizar fecha de compra de alimento
                if (isPetFoodPurchase && selectedClientForPoints.pets) {
                    const updatedPets = selectedClientForPoints.pets.map(pet => {
                        if (selectedPetsForFood.includes(pet.id)) {
                            return { ...pet, lastPurchaseDate: Timestamp.fromDate(new Date(pointsData.purchaseDate)) };
                        }
                        return pet;
                    });
                    updates.pets = updatedPets;
                }

                await updateDoc(userRef, updates);

                // Actualizar cache de vencimientos
                ExpirationService.updateNextExpirationCache(selectedClientForPoints.id);

                closePointsModal();
                fetchData();
            } else {
                toast.error(`Error: ${data.error}`);
            }
        } catch (error) {
            console.error("Error al asignar puntos:", error);
            toast.error("Error de conexión al asignar puntos");
        } finally {
            setActionLoading(false);
        }
    };

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
            points: client.points || 0,
            birthDate: client.birthDate || '',
            isTestUser: client.isTestUser || false,
            pets: client.pets || []
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

        const isWAEnabled = NotificationService.isChannelEnabled(config, 'pointsAdded', 'whatsapp');
        setNotifyWhatsapp(isWAEnabled);

        const promos = await CampaignService.getActiveBonusesForToday();
        const calculablePromos = promos.filter(p => p.rewardType === 'FIXED' || p.rewardType === 'MULTIPLIER' || p.rewardType === 'INFO' || p.rewardType === 'TEXT');

        // --- REFINAMIENTO DE VISIBILIDAD (Marketing Dinámico) ---
        const GRACE_PERIOD_MINS = 15;
        const now = TimeService.now();
        const curHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

        const filteredPromos = calculablePromos.filter(p => {
            if (!p.startTime && !p.endTime) return true;

            // Si no empezó, no se muestra (evita ruido en carga)
            if (p.startTime && p.startTime > curHHmm) return false;

            // Si terminó, chequear periodo de gracia de 15 min
            if (p.endTime) {
                const [h, m] = p.endTime.split(':').map(Number);
                const endTimestamp = new Date(now);
                endTimestamp.setHours(h, m + GRACE_PERIOD_MINS, 0, 0);
                if (now > endTimestamp) return false;
            }
            return true;
        });

        setAvailablePromotions(filteredPromos);

        // Auto-seleccionar promos (incluyendo periodo de gracia para paridad con extensión)
        const autoSelected = filteredPromos.map(p => p.id);

        setSelectedPromos(autoSelected);
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

    const openHistoryModal = async (client: Client) => {
        // Aseguramos que los puntos estén actualizados calculando vencimientos antes de mostrar
        try {
            await ExpirationService.processExpirations(client.id);
        } catch (e) { }
        setSelectedClientForHistory(client);
        setHistoryModalOpen(true);
    };

    const handleExportExcel = () => {
        // --- AUDITORIA ---
        AuditService.log('data_export', 'Exportación de base de clientes a Excel', [
            { action: 'excel_export', status: 'success', info: `Total registros: ${clients.length}` }
        ]);

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
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-center">Dinero a Favor</th>
                                <th className="px-6 py-4 text-xs font-bold text-gray-400 uppercase tracking-wider text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {filteredClients.map((client) => (
                                <tr key={client.id} className="hover:bg-gray-50/50 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            {(() => {
                                                const today = TimeService.now();
                                                const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
                                                const isBirthday = client.birthDate?.endsWith(todayMD);

                                                return (
                                                    <div className={`w-14 h-10 ${isBirthday ? 'bg-pink-50 text-pink-600 border-pink-200 animate-pulse' : 'bg-blue-50 text-blue-700 border-blue-100'} rounded-lg flex flex-col items-center justify-center border flex-shrink-0 relative`}>
                                                        <span className="text-[9px] font-bold uppercase leading-none opacity-60">Socio</span>
                                                        <span className="text-sm font-black leading-none">{client.socioNumber}</span>
                                                        {isBirthday && (
                                                            <div className="absolute -top-2 -right-2 bg-pink-500 text-white p-1 rounded-full shadow-sm animate-bounce">
                                                                <Cake size={10} />
                                                            </div>
                                                        )}
                                                    </div>
                                                );
                                            })()}
                                            <div className="overflow-hidden">
                                                <div className="flex items-center gap-2">
                                                    <div className="font-bold text-gray-800 leading-tight truncate">{client.name}</div>
                                                    <span className={`text-[8px] px-1.5 py-0.5 rounded-full font-bold uppercase tracking-wider shrink-0 ${client.source === 'pwa'
                                                        ? 'bg-purple-100 text-purple-600 border border-purple-200'
                                                        : 'bg-emerald-100 text-emerald-600 border border-emerald-200'
                                                        }`}>
                                                        {client.source === 'pwa' ? 'PWA' : 'Local'}
                                                    </span>
                                                    {client.isTestUser && (
                                                        <span className="bg-blue-600 text-white text-[8px] font-black px-1.5 py-0.5 rounded flex items-center gap-0.5 uppercase shadow-sm">
                                                            <Shield size={8} /> TEST
                                                        </span>
                                                    )}
                                                </div>
                                                {config?.enablePetModule && client.pets && client.pets.length > 0 && (
                                                    <div className="flex flex-wrap gap-1 mt-1.5 translate-y-[-2px]">
                                                        {client.pets.map((pet, idx) => (
                                                            <div key={idx} className="flex items-center gap-1 bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded border border-orange-100/50" title={`${pet.breed} - Come: ${pet.foodBrand}`}>
                                                                <span className="text-[10px]">🐾</span>
                                                                <span className="text-[9px] font-black uppercase tracking-tighter truncate max-w-[60px]">{pet.name}</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
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
                                                    {client.referredBy && (
                                                        <div className="text-[9px] text-orange-600 font-black mt-1 flex items-center gap-1 bg-orange-50 w-fit px-1.5 py-0.5 rounded border border-orange-100">
                                                            <Gift size={10} /> Invitado por: {clients.find(c => c.id === client.referredBy)?.name || 'Otro Socio'}
                                                        </div>
                                                    )}
                                                    {client.referralStats && client.referralStats.count > 0 && (
                                                        <div className="text-[9px] text-purple-600 font-black mt-1 flex items-center gap-1 bg-purple-50 w-fit px-1.5 py-0.5 rounded border border-purple-100">
                                                            <Users size={10} /> Invitó a: {client.referralStats.count} {client.referralStats.count === 1 ? 'amigo' : 'amigos'} (+{client.referralStats.pointsEarned} pts)
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
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
                                        <div className="flex justify-center gap-2">
                                            <div className="flex flex-col items-center gap-1" title={client.termsAccepted ? "Términos Aceptados" : "Términos Pendientes"}>
                                                <div className={`p-1.5 rounded-md ${client.termsAccepted ? 'text-blue-600 bg-blue-50' : 'text-gray-300 bg-gray-50'}`}>
                                                    <Check size={14} strokeWidth={3} />
                                                </div>
                                                <span className={`text-[7px] font-black uppercase ${client.termsAccepted ? 'text-blue-500' : 'text-gray-300'}`}>
                                                    {client.termsAccepted ? 'OK' : 'PEND'}
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-center gap-1" title={`Notificaciones: ${client.permissions?.notifications?.status === 'granted' ? (client.fcmToken ? 'Activas (Con Token)' : 'Permiso concedido pero falta registrar Token') : 'Pendiente/Denegado'}`}>
                                                <div className={`p-1.5 rounded-md ${(client.permissions?.notifications?.status === 'granted' && client.fcmToken) ? 'text-purple-600 bg-purple-50 border border-purple-100 shadow-sm' : 'text-gray-300 bg-gray-50'}`}>
                                                    <Bell size={14} />
                                                </div>
                                                <div className="flex gap-1 h-3 mt-1">
                                                    {client.permissions?.notifications?.platforms?.includes('pc') && (
                                                        <div title={`PC (Token ok)`} className="bg-indigo-100 p-0.5 rounded shadow-sm">
                                                            <Monitor size={10} className="text-indigo-600" />
                                                        </div>
                                                    )}
                                                    {client.permissions?.notifications?.platforms?.includes('mobile') && (
                                                        <div title={`Celular (Token ok)`} className="bg-purple-100 p-0.5 rounded shadow-sm">
                                                            <Smartphone size={10} className="text-purple-600" />
                                                        </div>
                                                    )}
                                                </div>
                                                <span className={`text-[7px] font-black uppercase ${client.permissions?.notifications?.status === 'granted' ? 'text-purple-600' : (client.permissions?.notifications?.status === 'blocked' ? 'text-red-400' : 'text-gray-300')}`}>
                                                    {(() => {
                                                        const s = client.permissions?.notifications?.status || (client.permissions?.notifications as any)?.mobile_status || (client.permissions?.notifications as any)?.pc_status;
                                                        const visits = client.visitCount || 0;
                                                        if (s === 'granted') return 'ACTIVO';
                                                        if (s === 'blocked') return 'BLOCK';
                                                        if (s === 'later' || s === 'later_phase1_complete') return 'ESPERA';
                                                        return visits > 0 ? 'PEND' : 'NUNCA';
                                                    })()}
                                                </span>
                                            </div>

                                            <div className="flex flex-col items-center gap-1">
                                                <button
                                                    onClick={() => {
                                                        if (client.lastLocation) {
                                                            const coords = `${client.lastLocation.lat}, ${client.lastLocation.lng}`;
                                                            navigator.clipboard.writeText(coords);
                                                            toast.success(`Coordenadas copiadas: ${coords}`);
                                                        }
                                                    }}
                                                    title={`Ubicación: ${(client.permissions?.geolocation?.status === 'granted' || (client.permissions?.geolocation as any)?.mobile_status === 'granted' || (client.permissions?.geolocation as any)?.pc_status === 'granted') ? (client.lastLocation ? 'Activa (Con Coordenadas - Clic para copiar)' : 'Permiso concedido pero sin datos aún') : 'Pendiente/Denegado'}`}
                                                    className={`p-1.5 rounded-md transition-all ${((client.permissions?.geolocation?.status === 'granted' || (client.permissions?.geolocation as any)?.mobile_status === 'granted' || (client.permissions?.geolocation as any)?.pc_status === 'granted') && client.lastLocation) ? 'text-green-600 bg-green-50 border border-green-100 shadow-sm hover:scale-110 active:scale-95' : 'text-gray-300 bg-gray-50'}`}
                                                >
                                                    <MapPin size={14} />
                                                </button>
                                                <span className={`text-[7px] font-black uppercase ${client.permissions?.geolocation?.status === 'granted' ? 'text-green-600' : (client.permissions?.geolocation?.status === 'blocked' ? 'text-red-400' : 'text-gray-300')}`}>
                                                    {(() => {
                                                        const s = client.permissions?.geolocation?.status || (client.permissions?.geolocation as any)?.mobile_status || (client.permissions?.geolocation as any)?.pc_status;
                                                        const visits = client.visitCount || 0;
                                                        if (s === 'granted') return 'ACTIVO';
                                                        if (s === 'blocked') return 'BLOCK';
                                                        if (s === 'later' || s === 'later_phase1_complete') return 'ESPERA';
                                                        return visits > 0 ? 'PEND' : 'NUNCA';
                                                    })()}
                                                </span>
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
                                        {client.expirationDetails && client.expirationDetails.filter(e => e.points > 0).length > 0 ? (
                                            <div className="space-y-1 mt-1">
                                                {client.expirationDetails.filter(e => e.points > 0).slice(0, 3).map((exp, idx) => (
                                                    <div
                                                        key={idx}
                                                        className="flex items-center justify-center gap-1 text-[9px] font-bold text-orange-600 bg-orange-50 py-0.5 px-1.5 rounded border border-orange-100"
                                                        title={`Vencimiento`}
                                                    >
                                                        <History size={10} />
                                                        {exp.points} ({exp.date.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })})
                                                    </div>
                                                ))}
                                                {client.expirationDetails.filter(e => e.points > 0).length > 3 && (
                                                    <div className="text-[8px] font-black text-orange-400 uppercase tracking-tighter mt-1">
                                                        + {client.expirationDetails.filter(e => e.points > 0).length - 3} vencimientos más
                                                    </div>
                                                )}
                                            </div>
                                        ) : (
                                            <div className="text-[9px] text-gray-300 font-bold mt-1">Sin vencimientos</div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full font-black ${(client.accumulated_balance || 0) > 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-gray-50 text-gray-400 opacity-50'}`}>
                                            <TrendingUp size={14} />
                                            ${(client.accumulated_balance || 0).toLocaleString()}
                                        </div>
                                        {client.accumulated_balance_updated_at && (
                                            <div className="text-[8px] text-gray-400 mt-1 font-bold">
                                                Act: {new Date(client.accumulated_balance_updated_at.toDate ? client.accumulated_balance_updated_at.toDate() : client.accumulated_balance_updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                            </div>
                                        )}
                                    </td>
                                    <td className="px-6 py-4">
                                        {config?.enablePetModule && client.pets && client.pets.length > 0 && (
                                            <div className="flex flex-wrap gap-1 max-w-[150px]">
                                                {client.pets.map((pet: any, idx: number) => (
                                                    <span key={idx} className="bg-orange-50 text-orange-700 text-[8px] px-1.5 py-0.5 rounded-full font-black border border-orange-100 flex items-center gap-1">
                                                        <span>🐾</span> {pet.name.toUpperCase()}
                                                    </span>
                                                ))}
                                            </div>
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
            {
                isModalOpen && (
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
                                            <div>
                                                <label className="block text-sm font-bold text-gray-700 mb-2">Cumpleaños</label>
                                                <input
                                                    type="date"
                                                    className="w-full p-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none"
                                                    value={formData.birthDate}
                                                    onChange={e => setFormData({ ...formData, birthDate: e.target.value })}
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

                                        <div className="mt-6 flex items-center gap-3 p-4 bg-blue-50 rounded-2xl border border-blue-100">
                                            <div className="flex-1">
                                                <h4 className="text-sm font-bold text-blue-800 flex items-center gap-2">
                                                    <Shield size={16} /> Usuario de Prueba / Tester
                                                </h4>
                                                <p className="text-[10px] text-blue-600 mt-0.5">
                                                    Los usuarios de prueba pueden ver campañas internas y premios restringidos en la PWA.
                                                </p>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    className="sr-only peer"
                                                    checked={formData.isTestUser}
                                                    onChange={e => setFormData({ ...formData, isTestUser: e.target.checked })}
                                                />
                                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
                                            </label>
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

                                {!editingId && formStep === 2 && (
                                    <div className="animate-fade-in p-5 bg-orange-50 rounded-2xl border border-orange-100 mt-6 space-y-4">
                                        <h4 className="font-bold text-orange-800 flex items-center gap-2">
                                            <Gift size={18} /> Premios de Bienvenida y Notificaciones
                                        </h4>
                                        <p className="text-xs text-orange-700">
                                            Al crear un cliente manualmente, puedes decidir si otorgarle los premios iniciales como si se hubiera registrado en la App.
                                        </p>
                                    </div>
                                )}

                                {/* SECCION MASCOTAS (Módulo Petshop) */}
                                {config?.enablePetModule && (editingId || formStep === 2) && (
                                    <div className="animate-fade-in space-y-4 pt-6 border-t border-gray-100">
                                        <h3 className="font-bold text-gray-800 flex items-center gap-2"><Dog size={16} /> Mis Mascotas</h3>
                                        
                                        <div className="space-y-4">
                                            {formData.pets.map((pet: any, idx: number) => (
                                                <div key={idx} className="p-4 bg-orange-50/50 rounded-2xl border border-orange-100 relative group animate-fade-in">
                                                    <button 
                                                        type="button"
                                                        onClick={() => {
                                                            const newPets = [...formData.pets];
                                                            newPets.splice(idx, 1);
                                                            setFormData({ ...formData, pets: newPets });
                                                        }}
                                                        className="absolute top-2 right-2 p-1.5 text-gray-400 hover:text-red-600 hover:bg-white rounded-full transition-all opacity-0 group-hover:opacity-100"
                                                    >
                                                        <Trash2 size={14} />
                                                    </button>
                                                    <div className="grid grid-cols-2 gap-x-4 gap-y-3">
                                                        <div className="col-span-1">
                                                            <label className="block text-[10px] font-bold text-orange-700 uppercase mb-1">Nombre</label>
                                                            <input 
                                                                type="text"
                                                                value={pet.name}
                                                                onChange={e => {
                                                                    const newPets = [...formData.pets];
                                                                    newPets[idx].name = e.target.value;
                                                                    setFormData({ ...formData, pets: newPets });
                                                                }}
                                                                className="w-full p-2 bg-white rounded-lg border border-orange-100 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200"
                                                                placeholder="Ej: Firulais"
                                                            />
                                                        </div>
                                                        <div className="col-span-1">
                                                            <label className="block text-[10px] font-bold text-orange-700 uppercase mb-1">Tipo de Mascota</label>
                                                            <select
                                                                value={pet.type || 'perro'}
                                                                onChange={e => {
                                                                    const newPets = [...formData.pets];
                                                                    newPets[idx].type = e.target.value;
                                                                    setFormData({ ...formData, pets: newPets });
                                                                }}
                                                                className="w-full p-2 bg-white rounded-lg border border-orange-100 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200"
                                                            >
                                                                <option value="perro">🐶 Perro</option>
                                                                <option value="gato">🐱 Gato</option>
                                                                <option value="otro">🐾 Otro</option>
                                                            </select>
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-orange-700 uppercase mb-1">Especie / Raza</label>
                                                            <input 
                                                                type="text"
                                                                value={pet.breed}
                                                                onChange={e => {
                                                                    const newPets = [...formData.pets];
                                                                    newPets[idx].breed = e.target.value;
                                                                    setFormData({ ...formData, pets: newPets });
                                                                }}
                                                                className="w-full p-2 bg-white rounded-lg border border-orange-100 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                                                                placeholder="Ej: Golden Retriever"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-orange-700 uppercase mb-1">Marca de Alimento</label>
                                                            <input 
                                                                type="text"
                                                                value={pet.foodBrand || pet.brand}
                                                                onChange={e => {
                                                                    const newPets = [...formData.pets];
                                                                    newPets[idx].foodBrand = e.target.value;
                                                                    setFormData({ ...formData, pets: newPets });
                                                                }}
                                                                className="w-full p-2 bg-white rounded-lg border border-orange-100 text-sm outline-none focus:ring-2 focus:ring-orange-200"
                                                                placeholder="Ej: Royal Canin"
                                                            />
                                                        </div>
                                                        <div>
                                                            <label className="block text-[10px] font-bold text-orange-700 uppercase mb-1">Frecuencia (Días)</label>
                                                            <input 
                                                                type="number"
                                                                value={pet.frequencyDays || 30}
                                                                onChange={e => {
                                                                    const newPets = [...formData.pets];
                                                                    newPets[idx].frequencyDays = Math.max(1, parseInt(e.target.value) || 30);
                                                                    setFormData({ ...formData, pets: newPets });
                                                                }}
                                                                className="w-full p-2 bg-white rounded-lg border border-orange-100 text-sm font-bold outline-none focus:ring-2 focus:ring-orange-200"
                                                                min="1"
                                                            />
                                                        </div>
                                                        <div className="flex items-center gap-2 pt-4">
                                                            <label className="relative inline-flex items-center cursor-pointer">
                                                                <input
                                                                    type="checkbox"
                                                                    className="sr-only peer"
                                                                    checked={pet.receiveAlerts !== false}
                                                                    onChange={e => {
                                                                        const newPets = [...formData.pets];
                                                                        newPets[idx].receiveAlerts = e.target.checked;
                                                                        setFormData({ ...formData, pets: newPets });
                                                                    }}
                                                                />
                                                                <div className="w-9 h-5 bg-gray-200 peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-orange-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-orange-600"></div>
                                                                <span className="ml-2 text-[10px] font-bold text-orange-700 uppercase">Alertas</span>
                                                            </label>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                            
                                            <button 
                                                type="button"
                                                onClick={() => setFormData({ 
                                                    ...formData, 
                                                    pets: [...formData.pets, { id: Math.random().toString(36).substr(2, 9), name: '', breed: '', age: '', foodBrand: '', receiveAlerts: true, createdAt: new Date() }] 
                                                })}
                                                className="w-full py-3 border-2 border-dashed border-orange-200 rounded-2xl text-orange-600 font-bold text-sm hover:bg-orange-50 hover:border-orange-300 transition-all flex items-center justify-center gap-2"
                                            >
                                                <Plus size={16} /> Agregar Mascota
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {!editingId && formStep === 2 && (
                                    <div className="space-y-3">
                                            {(config?.welcomePoints || 0) > 0 && config?.enableWelcomeBonus !== false && (
                                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-orange-100/50 rounded-lg transition">
                                                    <input
                                                        type="checkbox"
                                                        checked={applyWelcomeBonus}
                                                        onChange={e => setApplyWelcomeBonus(e.target.checked)}
                                                        className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                    />
                                                    <span className="text-sm font-bold text-gray-700">
                                                        Sumar {config.welcomePoints} pts por Registro Inicial
                                                    </span>
                                                </label>
                                            )}

                                            {(config?.pointsForAddress || 0) > 0 && config?.enableAddressBonus !== false && (
                                                <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-orange-100/50 rounded-lg transition">
                                                    <input
                                                        type="checkbox"
                                                        checked={applyAddressBonus}
                                                        onChange={e => setApplyAddressBonus(e.target.checked)}
                                                        className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                    />
                                                    <span className="text-sm font-bold text-gray-700">
                                                        Sumar {config.pointsForAddress} pts por Domicilio Completo
                                                    </span>
                                                </label>
                                            )}

                                            <label className="flex items-center gap-3 cursor-pointer p-2 hover:bg-green-50 rounded-lg transition border border-transparent hover:border-green-100">
                                                <input
                                                    type="checkbox"
                                                    checked={sendWelcomeWa}
                                                    onChange={e => setSendWelcomeWa(e.target.checked)}
                                                    className="w-5 h-5 rounded border-green-300 text-green-600 focus:ring-green-500"
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-green-800">
                                                        Enviar WhatsApp de Bienvenida al guardar
                                                    </span>
                                                    <span className="text-[10px] text-green-600">Abre una pestaña de WhatsApp Web con el mensaje configurado.</span>
                                                </div>
                                            </label>
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
                                        disabled={actionLoading}
                                        className="px-8 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition shadow-lg shadow-blue-100 disabled:opacity-50 flex items-center justify-center gap-2"
                                    >
                                        {actionLoading ? (
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
                )
            }

            {/* MODAL: Asignar Puntos */}
            {
                pointsModalOpen && selectedClientForPoints && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-fade-in">
                        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden">
                            <div className="bg-green-600 p-6 flex justify-between items-center text-white">
                                <div>
                                    <h2 className="text-xl font-bold">Sumar Puntos</h2>
                                    <p className="text-green-100 text-xs">{selectedClientForPoints.name}</p>
                                    {config?.enablePetModule && selectedClientForPoints.pets && selectedClientForPoints.pets.length > 0 && (
                                        <div className="flex flex-wrap gap-1 mt-2">
                                            {selectedClientForPoints.pets.map((p, i) => (
                                                <div key={i} className="bg-white/20 px-2 py-1 rounded-lg flex items-center gap-1.5 border border-white/20">
                                                    <span className="text-[10px]">🐾</span>
                                                    <span className="text-[10px] font-bold uppercase">{p.name}</span>
                                                    <span className="text-[9px] opacity-70">({p.foodBrand})</span>
                                                </div>
                                            ))}
                                        </div>
                                    )}
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
                                    {/* PV PREVIEW */}
                                    <div className="mt-2 ml-2">
                                        {pointsData.isPesos && (selectedClientForPoints.accumulated_balance || 0) > 0 && (
                                            <p className="text-[10px] text-emerald-600 font-black uppercase tracking-tighter mb-1 animate-pulse">
                                                ★ Incluye ${(selectedClientForPoints.accumulated_balance || 0).toLocaleString()} de Puntos a Favor previos
                                            </p>
                                        )}
                                        {(() => {
                                            const val = parseFloat(pointsData.amount);
                                            if (isNaN(val) || val <= 0) return <span className="text-[11px] text-gray-400 font-medium italic">Ingresa un monto para ver los puntos</span>;

                                            let ptsBase = 0;
                                            if (pointsData.isPesos) {
                                                const curAcc = selectedClientForPoints.accumulated_balance || 0;
                                                const total = val + curAcc;
                                                const ratio = config?.pointsPerPeso || 1;
                                                ptsBase = Math.floor((total / 100) * ratio);
                                            } else {
                                                ptsBase = Math.floor(val);
                                            }

                                            let bonus = 0;
                                            if (applyPromotions) {
                                                availablePromotions.filter(p => selectedPromos.includes(p.id)).forEach(b => {
                                                    const isFlash = b.isFlash;
                                                    const rType = isFlash ? (b.flashRewardType || b.rewardType) : b.rewardType;
                                                    const rValue = isFlash ? (b.flashRewardValue ?? b.rewardValue) : b.rewardValue;

                                                    if (rType === 'MULTIPLIER') bonus += Math.floor(ptsBase * (rValue - 1));
                                                    else bonus += (rValue || 0);
                                                });
                                            }
                                            const totalFinal = ptsBase + bonus;
                                            return (
                                                <span className="text-xs text-gray-500 font-bold flex items-center gap-1.5 animate-fade-in">
                                                    ✨ Se asignarán: <strong className="text-green-600 font-black">{totalFinal} puntos</strong>
                                                    {bonus > 0 && <span className="text-[10px] text-gray-400 font-medium">(Base: {ptsBase} + Bonus: {bonus})</span>}
                                                </span>
                                            );
                                        })()}
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
                                                        <div className="flex items-center gap-1.5">
                                                            <span className="text-[10px] font-bold text-gray-700 uppercase group-hover:text-green-600 transition">
                                                                {promo.name || promo.title}
                                                            </span>
                                                            {(() => {
                                                                if (!promo.startTime && !promo.endTime) return null;
                                                                const now = TimeService.now();
                                                                const curHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
                                                                const isExpiredToday = promo.endTime && promo.endTime < curHHmm;
                                                                const isActiveNow = !isExpiredToday;

                                                                return (
                                                                    <PointsTimer endTime={promo.endTime} />
                                                                );
                                                            })()}
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            <span className="text-[9px] text-gray-400 font-bold">
                                                                {(() => {
                                                                    const isFlash = promo.isFlash;
                                                                    const rType = isFlash ? (promo.flashRewardType || promo.rewardType) : promo.rewardType;
                                                                    const rValue = isFlash ? (promo.flashRewardValue ?? promo.rewardValue) : promo.rewardValue;
                                                                    const rText = isFlash ? (promo.flashRewardText || promo.rewardText) : promo.rewardText;

                                                                    if (rType === 'MULTIPLIER') return `Multiplicador x${rValue}`;
                                                                    if (rType === 'FIXED') return `Bonus +${rValue} pts`;
                                                                    if (rType === 'TEXT') return rText || 'Beneficio Especial';
                                                                    return isFlash ? '⚡ Informativa / Flash' : 'Informativa';
                                                                })()}
                                                            </span>
                                                            {(promo.startTime || promo.endTime) && (
                                                                <span className="text-[9px] text-purple-400 font-black">
                                                                    ⏰ {promo.startTime || '00:00'} a {promo.endTime || '23:59'} hs
                                                                </span>
                                                            )}
                                                        </div>
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

                                    {/* SECCION PETSHOP: Marcar compra de alimento */}
                                    {config?.enablePetModule && selectedClientForPoints.pets && selectedClientForPoints.pets.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-100">
                                            <label className="flex items-center gap-3 cursor-pointer mb-2">
                                                <input
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                    checked={isPetFoodPurchase}
                                                    onChange={e => {
                                                        setIsPetFoodPurchase(e.target.checked);
                                                        if (e.target.checked) setSelectedPetsForFood(selectedClientForPoints.pets!.map(p => p.id));
                                                    }}
                                                />
                                                <span className="text-sm font-bold text-orange-700">Reposición de Alimento 🐾</span>
                                            </label>
                                            
                                            {isPetFoodPurchase && selectedClientForPoints.pets.length > 1 && (
                                                <div className="flex flex-wrap gap-2 pl-8 animate-fade-in">
                                                    {selectedClientForPoints.pets.map(pet => (
                                                        <label key={pet.id} className="flex items-center gap-1.5 cursor-pointer bg-white border border-orange-100 px-2 py-1 rounded-lg">
                                                            <input
                                                                type="checkbox"
                                                                className="w-3.5 h-3.5 rounded text-orange-500 focus:ring-orange-400"
                                                                checked={selectedPetsForFood.includes(pet.id)}
                                                                onChange={e => {
                                                                    if (e.target.checked) setSelectedPetsForFood([...selectedPetsForFood, pet.id]);
                                                                    else setSelectedPetsForFood(selectedPetsForFood.filter(id => id !== pet.id));
                                                                }}
                                                            />
                                                            <span className="text-[10px] font-bold text-gray-600 uppercase">{pet.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                <button type="submit" disabled={actionLoading} className="w-full py-4 bg-green-600 text-white rounded-2xl font-bold text-lg hover:bg-green-700 transition shadow-lg shadow-green-100 disabled:opacity-50">
                                    {actionLoading ? 'Procesando...' : 'Asignar Puntos'}
                                </button>
                            </form>
                        </div>
                    </div>
                )
            }

            {/* MODAL: Canje */}
            {
                redemptionModalOpen && selectedClientForRedemption && (
                    <RedemptionModal
                        client={selectedClientForRedemption}
                        onClose={() => setRedemptionModalOpen(false)}
                        onRedeemSuccess={() => {
                            setRedemptionModalOpen(false);
                            fetchData();
                        }}
                    />
                )
            }

            {/* MODAL: Historial */}
            {
                historyModalOpen && selectedClientForHistory && (
                    <PointsHistoryModal
                        client={selectedClientForHistory}
                        isOpen={historyModalOpen}
                        onClose={() => setHistoryModalOpen(false)}
                        onClientUpdated={fetchData}
                    />
                )
            }

            {
                visitHistoryModalOpen && selectedClientForHistory && (
                    <VisitHistoryModal
                        isOpen={visitHistoryModalOpen}
                        client={selectedClientForHistory}
                        onClose={() => setVisitHistoryModalOpen(false)}
                    />
                )
            }
        </div >
    );
};
