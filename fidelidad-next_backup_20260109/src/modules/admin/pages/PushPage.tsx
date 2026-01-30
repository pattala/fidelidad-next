import React, { useState } from 'react';
import { Send, Bell, User, Users } from 'lucide-react';
import toast from 'react-hot-toast';
import { ConfigService } from '../../../services/configService';
import type { AppConfig } from '../../../types';
import { collection, getDocs, query, doc, getDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { NotificationService } from '../../../services/notificationService';

export const PushPage = () => {
    const [loading, setLoading] = useState(false);
    const [targetType, setTargetType] = useState<'all' | 'single'>('single');
    const [targetId, setTargetId] = useState('');
    const [selectedClientName, setSelectedClientName] = useState(''); // New state for UI

    // Client Search State
    const [clients, setClients] = useState<any[]>([]);
    const [filteredClients, setFilteredClients] = useState<any[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loadingClients, setLoadingClients] = useState(false);
    const [showSuggestions, setShowSuggestions] = useState(false);

    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');

    // Load Clients for Search
    React.useEffect(() => {
        const fetchClients = async () => {
            setLoadingClients(true);
            try {
                const q = query(collection(db, 'users')); // Reverted to 'users'
                const snap = await getDocs(q);
                const list = snap.docs.map(d => {
                    const data = d.data();
                    return {
                        id: d.id,
                        ...data,
                        name: data.name || data.nombre || '',
                        phone: data.phone || data.telefono || '',
                        socioNumber: data.socioNumber || data.numeroSocio || '',
                        points: data.points || data.puntos || 0
                    };
                });
                setClients(list);
            } catch (e) {
                console.error("Error loading clients", e);
            } finally {
                setLoadingClients(false);
            }
        };
        fetchClients();
    }, []);

    // Filter Logic
    React.useEffect(() => {
        if (!searchTerm) {
            setFilteredClients([]);
            return;
        }
        const lower = searchTerm.toLowerCase();
        const results = clients.filter(c =>
            (c.name || '').toLowerCase().includes(lower) ||
            (c.socioNumber || '').toString().includes(lower) ||
            (c.dni || '').toString().includes(lower)
        ).slice(0, 5); // Limit result
        setFilteredClients(results);
    }, [searchTerm, clients]);

    const selectClient = (client: any) => {
        setTargetId(client.id);
        setSelectedClientName(client.name);
        setSearchTerm('');
        setShowSuggestions(false);
    };

    const [config, setConfig] = useState<AppConfig | null>(null);

    // Load Config for Branding
    React.useEffect(() => {
        ConfigService.get().then(setConfig);
    }, []);

    const handleSend = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!title || !body) {
            toast.error('Título y mensaje requeridos');
            return;
        }

        if (targetType === 'single' && !targetId) {
            toast.error('ID de cliente requerido');
            return;
        }

        if (!confirm('¿Confirmar envío de notificación push?')) return;

        setLoading(true);
        const toastId = toast.loading('Enviando...');

        try {
            if (targetType === 'single') {
                // Verify user exists first (optional but good)
                const docRef = doc(db, 'users', targetId); // Reverted to 'users'
                const snap = await getDoc(docRef);

                if (!snap.exists()) {
                    // Try searching by socioNumber or email? For now just ID.
                    // A real app would allow search.
                    toast.error('Cliente no encontrado (ID inválido)', { id: toastId });
                    setLoading(false);
                    return;
                }

                await NotificationService.sendToClient(targetId, {
                    title,
                    body,
                    type: 'manual',
                    icon: config?.logoUrl // Branding
                });
                toast.success('Enviado a 1 cliente', { id: toastId });

            } else {
                // ALL Users
                const q = query(collection(db, 'users')); // Reverted to 'users'
                const snap = await getDocs(q);

                let sent = 0;
                const promises = snap.docs.map(d => {
                    sent++;
                    return NotificationService.sendToClient(d.id, {
                        title,
                        body,
                        type: 'manual',
                        icon: config?.logoUrl // Branding
                    });
                });

                await Promise.allSettled(promises);
                toast.success(`Enviado a ${sent} clientes`, { id: toastId });
            }

            // Reset form
            setTitle('');
            setBody('');
        } catch (error) {
            console.error(error);
            toast.error('Error al enviar', { id: toastId });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="max-w-4xl mx-auto animate-fade-in">
            <h1 className="text-3xl font-bold text-gray-800 flex items-center gap-2 mb-6">
                <Bell className="text-orange-500" /> Notificaciones Push Directas
            </h1>

            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 p-6">
                <form onSubmit={handleSend} className="space-y-6">

                    {/* Target Selection */}
                    <div className="grid grid-cols-2 gap-4">
                        <label className={`
                            flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                            ${targetType === 'single' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 hover:border-gray-200'}
                        `}>
                            <input
                                type="radio" name="target" value="single" className="hidden"
                                checked={targetType === 'single'}
                                onChange={() => setTargetType('single')}
                            />
                            <User size={24} />
                            <div className="text-left">
                                <span className="block font-bold">Un Cliente</span>
                                <span className="text-xs opacity-75">Enviar por ID específico</span>
                            </div>
                        </label>

                        <label className={`
                            flex items-center justify-center gap-3 p-4 rounded-xl border-2 cursor-pointer transition-all
                            ${targetType === 'all' ? 'border-orange-500 bg-orange-50 text-orange-700' : 'border-gray-100 hover:border-gray-200'}
                        `}>
                            <input
                                type="radio" name="target" value="all" className="hidden"
                                checked={targetType === 'all'}
                                onChange={() => setTargetType('all')}
                            />
                            <Users size={24} />
                            <div className="text-left">
                                <span className="block font-bold">Todos los Clientes</span>
                                <span className="text-xs opacity-75">Difusión masiva</span>
                            </div>
                        </label>
                    </div>

                    {/* Target Selection: Search UI */}
                    {targetType === 'single' && (
                        <div className="animate-fade-in-down relative z-20">
                            <label className="block text-sm font-bold text-gray-700 mb-1">Buscar Cliente</label>

                            {targetId ? (
                                <div className="flex items-center gap-3 p-3 bg-green-50 border border-green-200 rounded-xl">
                                    <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center text-green-700 font-bold">
                                        <User size={20} />
                                    </div>
                                    <div className="flex-1">
                                        <p className="font-bold text-gray-800">{selectedClientName}</p>
                                        <p className="text-xs text-green-600 font-mono">ID: {targetId}</p>
                                    </div>
                                    <button
                                        type="button"
                                        onClick={() => { setTargetId(''); setSelectedClientName(''); }}
                                        className="p-2 hover:bg-white rounded-full text-gray-400 hover:text-red-500 transition"
                                    >
                                        Cambiar
                                    </button>
                                </div>
                            ) : (
                                <div className="relative">
                                    <input
                                        type="text"
                                        placeholder="Escribe nombre, DNI o N° Socio..."
                                        className="w-full rounded-xl border-gray-200 p-3 pl-10 focus:ring-2 focus:ring-orange-200 outline-none transition"
                                        value={searchTerm}
                                        onChange={e => { setSearchTerm(e.target.value); setShowSuggestions(true); }}
                                        onFocus={() => setShowSuggestions(true)}
                                    />
                                    <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />

                                    {/* Suggestions Dropdown */}
                                    {showSuggestions && searchTerm && (
                                        <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-xl shadow-xl border border-gray-100 overflow-hidden max-h-60 overflow-y-auto">
                                            {loadingClients ? (
                                                <div className="p-4 text-center text-xs text-gray-400">Buscando...</div>
                                            ) : filteredClients.length > 0 ? (
                                                filteredClients.map(client => (
                                                    <button
                                                        key={client.id}
                                                        type="button"
                                                        onClick={() => selectClient(client)}
                                                        className="w-full text-left px-4 py-3 hover:bg-orange-50 flex items-center justify-between border-b border-gray-50 last:border-0 transition"
                                                    >
                                                        <div>
                                                            <p className="font-bold text-gray-800 text-sm">{client.name}</p>
                                                            <p className="text-xs text-gray-400">
                                                                {client.socioNumber ? `#${client.socioNumber} • ` : ''}
                                                                {client.dni || 'Sin DNI'}
                                                            </p>
                                                        </div>
                                                        <div className="text-xs font-bold text-orange-500">Seleccionar</div>
                                                    </button>
                                                ))
                                            ) : (
                                                <div className="p-4 text-center text-xs text-gray-400">No se encontraron resultados</div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}

                    {/* Message Fields */}
                    <div className="space-y-4 pt-4 border-t border-gray-50">
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Título</label>
                            <input
                                type="text"
                                placeholder="Ej: ¡Sorpresa de Viernes!"
                                className="w-full rounded-xl border-gray-200 p-3 focus:ring-2 focus:ring-orange-200 outline-none transition font-bold"
                                value={title}
                                onChange={e => setTitle(e.target.value)}
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-700 mb-1">Mensaje / Cuerpo</label>
                            <textarea
                                placeholder="Escribe el contenido de la notificación..."
                                className="w-full rounded-xl border-gray-200 p-3 focus:ring-2 focus:ring-orange-200 outline-none transition h-32 resize-none"
                                value={body}
                                onChange={e => setBody(e.target.value)}
                            />
                        </div>
                    </div>

                    {/* Action */}
                    <div className="pt-4 flex justify-end">
                        <button
                            type="submit"
                            disabled={loading || (targetType === 'single' && !targetId) || !title || !body}
                            className={`
                                px-8 py-3 rounded-xl font-bold text-white shadow-lg flex items-center gap-2 transition-all
                                ${loading ? 'bg-gray-400 cursor-wait' : 'bg-orange-500 hover:bg-orange-600 active:scale-95 shadow-orange-200'}
                            `}
                        >
                            <Send size={20} />
                            {loading ? 'Enviando...' : 'Enviar Notificación'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};
