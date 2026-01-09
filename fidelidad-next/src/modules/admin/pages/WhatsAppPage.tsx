import React, { useState, useEffect } from 'react';
import { db } from '../../../lib/firebase';
import { collection, getDocs, query } from 'firebase/firestore';
import { ConfigService, DEFAULT_TEMPLATES } from '../../../services/configService';
import type { AppConfig } from '../../../types';
import type { Client } from '../../../types';
import { Search, Filter, Send, Copy, CheckSquare, Square } from 'lucide-react';
import toast from 'react-hot-toast';

import { useLocation } from 'react-router-dom';

export const WhatsAppPage = () => {
    const location = useLocation();
    const [clients, setClients] = useState<Client[]>([]);
    const [config, setConfig] = useState<AppConfig | null>(null);
    const [loading, setLoading] = useState(true);

    // Filters & Selection
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedTag, setSelectedTag] = useState<string>('');
    const [selectedClients, setSelectedClients] = useState<Set<string>>(new Set());

    // Message
    const [message, setMessage] = useState('');

    useEffect(() => {
        const loadJava = async () => {
            try {
                // 1. Load Config (for default message)
                const cfg = await ConfigService.get();
                setConfig(cfg);

                // Check for incoming message from navigation state (Broadcast)
                const state = location.state as any;
                const incomingMessage = state?.message;
                const targetClientId = state?.clientId;

                if (incomingMessage) {
                    setMessage(incomingMessage);
                } else {
                    setMessage(cfg?.messaging?.whatsappDefaultMessage || DEFAULT_TEMPLATES.whatsappDefaultMessage);
                }

                // 2. Load Clients
                // Note: 'orderBy' might fail if field doesn't exist on all docs or index missing for 'name'.
                // defaulting to safe fetch
                const q = query(collection(db, 'users')); // Reverted to 'users'
                const snap = await getDocs(q);
                // Filter users that have a name (valid clients)
                const list = snap.docs
                    .map(d => {
                        const data = d.data();
                        return {
                            id: d.id,
                            ...data,
                            name: data.name || data.nombre || '',
                            phone: data.phone || data.telefono || '',
                            points: data.points || data.puntos || 0,
                            dni: data.dni || '',
                            email: data.email || ''
                        } as Client;
                    })
                    .filter(c => c.name)
                    .sort((a, b) => a.name.localeCompare(b.name));

                setClients(list);

                // Pre-selection Logic
                if (targetClientId) {
                    const target = list.find(c => c.id === targetClientId);
                    if (target) {
                        setSelectedClients(new Set([targetClientId]));
                        setSearchTerm(target.name); // Auto-filter to show this client
                    }
                }

            } catch (error) {
                console.error(error);
                toast.error('Error cargando datos');
            } finally {
                setLoading(false);
            }
        };
        loadJava();
    }, []);

    // Derived: Unique Tags
    const allTags = Array.from(new Set(clients.flatMap(c => c.tags || []))).sort();

    // Derived: Filtered Clients
    const filteredClients = clients.filter(c => {
        const term = searchTerm.toLowerCase();
        const matchesSearch =
            (c.name || '').toLowerCase().includes(term) ||
            (c.phone || '').includes(term) ||
            (c.dni || '').includes(term) ||
            (c.email || '').toLowerCase().includes(term);

        const matchesTag = selectedTag ? c.tags?.includes(selectedTag) : true;

        return matchesSearch && matchesTag;
    });

    const toggleClient = (id: string) => {
        const newSet = new Set(selectedClients);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedClients(newSet);
    };

    const toggleAll = () => {
        if (selectedClients.size === filteredClients.length) {
            setSelectedClients(new Set());
        } else {
            setSelectedClients(new Set(filteredClients.map(c => c.id)));
        }
    };

    const generateLink = (client: Client) => {
        if (!client.phone) return '#';

        // Clean phone
        let phoneNum = client.phone.replace(/\D/g, '');
        // Simple fix for Argentinian numbers if missing (though config says international format required)
        if (!phoneNum.startsWith('54') && phoneNum.length === 10) phoneNum = '549' + phoneNum;

        // Process message variables
        // Extract first name for a more personal touch if desired, or use full name
        const firstName = client.name.split(' ')[0];

        const processedMsg = message
            .replace(/{nombre}/g, firstName)
            .replace(/{nombre_completo}/g, client.name)
            .replace(/{puntos}/g, (client.points || 0).toString())
            .replace(/{dni}/g, client.dni || '')
            .replace(/{email}/g, client.email || '');

        return `https://wa.me/${phoneNum}?text=${encodeURIComponent(processedMsg)}`;
    };

    const handleSendIndividual = (client: Client) => {
        if (!client.phone) {
            toast.error('Cliente sin teléfono');
            return;
        }
        const link = generateLink(client);
        window.open(link, '_blank');
    };

    // Sending Queue Logic
    const [isSendingMode, setIsSendingMode] = useState(false);
    const [sendingQueue, setSendingQueue] = useState<Client[]>([]);
    const [currentIndex, setCurrentIndex] = useState(0);

    const startSendingQueue = () => {
        const queue = filteredClients.filter(c => selectedClients.has(c.id));
        if (queue.length === 0) return;
        setSendingQueue(queue);
        setCurrentIndex(0);
        setIsSendingMode(true);
    };

    const handleNext = () => {
        if (currentIndex < sendingQueue.length - 1) {
            setCurrentIndex(prev => prev + 1);
        } else {
            toast.success("¡Envío masivo completado!");
            setIsSendingMode(false);
            setSendingQueue([]);
            setCurrentIndex(0);
            setSelectedClients(new Set()); // Optional: clear selection after done
        }
    };

    const handleSendCurrent = () => {
        const client = sendingQueue[currentIndex];
        const link = generateLink(client);
        window.open(link, '_blank');
        handleNext();
    };


    const copyLinksToClipboard = () => {
        // Feature for "Bulk Send" workaround (since we can't open 100 tabs)
        // We generate a list of links
        const selectedList = filteredClients.filter(c => selectedClients.has(c.id));
        if (selectedList.length === 0) return;

        const text = selectedList.map(c => `${c.name}: ${generateLink(c)}`).join('\n');
        navigator.clipboard.writeText(text);
        toast.success(`Enlaces para ${selectedList.length} clientes copiados.`);
    };

    return (
        <div className="max-w-6xl mx-auto h-[calc(100vh-140px)] flex gap-6">

            {/* LEFT: Client List & Selection */}
            <div className="w-2/3 flex flex-col bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
                {/* Header / Filters */}
                <div className="p-4 border-b border-gray-100 bg-gray-50 flex gap-4 items-center">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <input
                            type="text" placeholder="Buscar por Nombre, DNI, Email..."
                            value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100"
                        />
                    </div>
                    <div className="w-48 relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                        <select
                            value={selectedTag} onChange={e => setSelectedTag(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 outline-none focus:ring-2 focus:ring-blue-100 appearance-none bg-white"
                        >
                            <option value="">Todas las Etiquetas</option>
                            {allTags.map(t => <option key={t} value={t}>{t}</option>)}
                        </select>
                    </div>
                </div>

                {/* List Header */}
                <div className="px-4 py-2 bg-gray-100 border-b border-gray-200 flex items-center text-xs font-bold text-gray-500 uppercase">
                    <button onClick={toggleAll} className="mr-3 hover:text-blue-600">
                        {selectedClients.size > 0 && selectedClients.size === filteredClients.length ? <CheckSquare size={18} /> : <Square size={18} />}
                    </button>
                    <div className="w-12">Avatar</div>
                    <div className="flex-1">Nombre</div>
                    <div className="w-32">Teléfono</div>
                    <div className="w-24 text-right">Puntos</div>
                    <div className="w-24 text-center">Acción</div>
                </div>

                {/* Scrollable List */}
                <div className="flex-1 overflow-y-auto">
                    {loading ? (
                        <div className="p-8 text-center text-gray-400">Cargando clientes...</div>
                    ) : filteredClients.length === 0 ? (
                        <div className="p-8 text-center text-gray-400">No se encontraron clientes.</div>
                    ) : (
                        filteredClients.map(client => (
                            <div key={client.id} className={`flex items-center px-4 py-3 border-b border-gray-50 hover:bg-blue-50/50 transition ${selectedClients.has(client.id) ? 'bg-blue-50' : ''}`}>
                                <button onClick={() => toggleClient(client.id)} className="mr-3 text-gray-400 hover:text-blue-600">
                                    {selectedClients.has(client.id) ? <CheckSquare size={18} className="text-blue-600" /> : <Square size={18} />}
                                </button>

                                <div className="w-12">
                                    <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-400 to-purple-500 flex items-center justify-center text-white font-bold text-xs uppercase">
                                        {client.name.substring(0, 2)}
                                    </div>
                                </div>

                                <div className="flex-1 min-w-0">
                                    <p className="font-bold text-gray-800 truncate">{client.name}</p>
                                    <div className="flex gap-1 mt-0.5">
                                        {client.tags?.map(t => (
                                            <span key={t} className="text-[10px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded-full">{t}</span>
                                        ))}
                                    </div>
                                </div>

                                <div className="w-32 text-sm text-gray-600 font-mono truncate">
                                    {client.phone || <span className="text-gray-300 italic">Sin cel</span>}
                                </div>

                                <div className="w-24 text-right font-bold text-blue-600">
                                    {client.points || 0}
                                </div>

                                <div className="w-24 flex justify-center">
                                    <button
                                        onClick={() => handleSendIndividual(client)}
                                        className="p-2 text-green-600 hover:bg-green-100 rounded-full transition"
                                        title="Enviar WhatsApp ahora"
                                        disabled={!client.phone}
                                    >
                                        <Send size={16} />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>

                {/* Footer Count */}
                <div className="p-3 bg-gray-50 border-t border-gray-200 text-xs text-center text-gray-500">
                    Mostrando {filteredClients.length} clientes • Seleccionados: <b>{selectedClients.size}</b>
                </div>
            </div>


            {/* RIGHT: Composer */}
            <div className="w-1/3 flex flex-col gap-6">

                {/* Message Editor */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex-1 flex flex-col">
                    <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center gap-2">
                        <span className="text-green-500 text-2xl">📱</span>
                        Redactar Mensaje
                    </h3>

                    <div className="flex-1">
                        <textarea
                            value={message}
                            onChange={e => setMessage(e.target.value)}
                            className="w-full h-full p-4 bg-gray-50 rounded-xl border border-gray-200 outline-none focus:ring-2 focus:ring-green-100 resize-none font-medium text-gray-700"
                            placeholder="Escribe tu mensaje aquí..."
                        />
                    </div>

                    <div className="mt-4 space-y-3">
                        <p className="text-xs text-gray-400">Variables Disponibles (haz clic para insertar):</p>
                        <div className="flex gap-2">
                            <button onClick={() => setMessage(m => m + ' {nombre} ')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 transition">
                                {`{nombre}`}
                            </button>
                            <button onClick={() => setMessage(m => m + ' {puntos} ')} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-xs font-bold text-gray-600 transition">
                                {`{puntos}`}
                            </button>
                        </div>
                    </div>
                </div>

                {/* Actions */}
                <div className="bg-green-50 rounded-2xl border border-green-100 p-6">
                    <h4 className="font-bold text-green-800 mb-2">Acciones Masivas</h4>
                    <p className="text-xs text-green-700/80 mb-4">
                        Envía mensajes uno por uno de forma rápida y segura.
                    </p>

                    <button
                        onClick={startSendingQueue}
                        disabled={selectedClients.size === 0}
                        className="w-full mb-3 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-xl shadow-lg shadow-green-200 flex items-center justify-center gap-2 transition disabled:opacity-50 disabled:shadow-none"
                    >
                        <Send size={18} />
                        Iniciar Envío ({selectedClients.size})
                    </button>

                    <button
                        onClick={copyLinksToClipboard}
                        disabled={selectedClients.size === 0}
                        className="w-full bg-white hover:bg-gray-50 text-green-700 border border-green-200 font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition disabled:opacity-50"
                    >
                        <Copy size={16} />
                        Solo Copiar Links
                    </button>
                </div>

            </div>

            {/* SENDING MODE OVERLAY */}
            {isSendingMode && sendingQueue.length > 0 && (
                <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
                    <div className="bg-white rounded-3xl shadow-2xl max-w-md w-full overflow-hidden animate-in fade-in zoom-in duration-200">
                        {/* Header */}
                        <div className="bg-green-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h3 className="font-bold text-xl">Envío en Progreso</h3>
                                <p className="text-green-100 text-sm">Destinatario {currentIndex + 1} de {sendingQueue.length}</p>
                            </div>
                            <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center font-bold">
                                {Math.round(((currentIndex) / sendingQueue.length) * 100)}%
                            </div>
                        </div>

                        {/* Current Client Card */}
                        <div className="p-8 flex flex-col items-center">
                            <div className="w-20 h-20 rounded-full bg-gray-100 mb-4 flex items-center justify-center text-2xl font-bold text-gray-400 uppercase">
                                {sendingQueue[currentIndex].name.substring(0, 2)}
                            </div>
                            <h2 className="text-2xl font-bold text-gray-800 text-center mb-1">
                                {sendingQueue[currentIndex].name}
                            </h2>
                            <p className="text-gray-500 font-mono mb-6">
                                {sendingQueue[currentIndex].phone}
                            </p>

                            <div className="w-full bg-gray-50 rounded-xl p-4 border border-gray-100 mb-8 max-h-40 overflow-y-auto">
                                <p className="text-sm text-gray-600 italic">
                                    "{message
                                        .replace(/{nombre}/g, sendingQueue[currentIndex].name.split(' ')[0])
                                        .replace(/{puntos}/g, (sendingQueue[currentIndex].points || 0).toString())}"
                                </p>
                            </div>

                            {/* Main Action */}
                            <button
                                onClick={handleSendCurrent}
                                className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-4 rounded-2xl shadow-xl shadow-green-200 flex items-center justify-center gap-3 text-lg transition transform active:scale-95 mb-3"
                            >
                                <Send size={24} />
                                Abrir WhatsApp
                            </button>

                            {/* Secondary Actions */}
                            <div className="flex gap-3 w-full">
                                <button
                                    onClick={handleNext}
                                    className="flex-1 py-3 text-gray-500 font-bold hover:bg-gray-100 rounded-xl transition"
                                >
                                    Saltar
                                </button>
                                <button
                                    onClick={() => setIsSendingMode(false)}
                                    className="flex-1 py-3 text-red-500 font-bold hover:bg-red-50 rounded-xl transition"
                                >
                                    Cancelar
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

        </div>
    );
};
