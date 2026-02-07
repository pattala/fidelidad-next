import React, { useEffect, useState } from 'react';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, writeBatch, where, getDocs } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { Bell, Trash2, MailOpen, ChevronLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ModernConfirmModal } from '../components/ModernConfirmModal';

interface InboxMessage {
    id: string;
    title: string;
    body: string;
    date: any; // Timestamp
    read: boolean;
    type?: 'system' | 'manual' | 'prize' | 'welcome';
    link?: string;
}

export const ClientInboxPage = () => {
    const [messages, setMessages] = useState<InboxMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [msgToDelete, setMsgToDelete] = useState<string | null>(null);
    const navigate = useNavigate();

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        // Listen to Inbox - query all to ensure we don't miss messages without dates (Ghost/Legacy)
        const q = query(
            collection(db, `users/${user.uid}/inbox`)
            // orderBy('date', 'desc') // Removed to prevent filtering out docs without 'date'
        );

        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data({ serverTimestamps: 'estimate' })
            })) as InboxMessage[];

            // Client-side sort to handle missing dates safely
            msgs.sort((a, b) => {
                const dateA = (a.date?.seconds || (a as any).sentAt?.seconds || 0);
                const dateB = (b.date?.seconds || (b as any).sentAt?.seconds || 0);
                return dateB - dateA;
            });

            setMessages(msgs);
            setLoading(false);
        });

        return () => unsubscribe();
    }, []);

    const markAsRead = async (msg: InboxMessage) => {
        if (msg.read) return;
        const user = auth.currentUser;
        if (!user) return;

        try {
            const msgRef = doc(db, `users/${user.uid}/inbox`, msg.id);
            await updateDoc(msgRef, { read: true });
        } catch (error) {
            console.error("Error marking as read", error);
        }
    };

    const markAllRead = async () => {
        const user = auth.currentUser;
        if (!user) return;
        const unread = messages.filter(m => !m.read);
        if (unread.length === 0) return;

        const batch = writeBatch(db);
        unread.forEach(msg => {
            const ref = doc(db, `users/${user.uid}/inbox`, msg.id);
            batch.update(ref, { read: true });
        });
        await batch.commit();
    };

    const deleteMessage = async (id: string) => {
        const user = auth.currentUser;
        if (!user) return;

        try {
            const ref = doc(db, `users/${user.uid}/inbox`, id);
            await writeBatch(db).delete(ref).commit();
            setMsgToDelete(null);
        } catch (error) {
            console.error("Error deleting", error);
        }
    };

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col h-screen overflow-hidden animate-fade-in">
            {/* Header - Fixed Height */}
            <div className="bg-white px-4 py-4 z-20 shadow-sm border-b border-gray-100 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-3">
                    <button onClick={() => navigate(-1)} className="text-gray-500 hover:text-gray-800 p-1">
                        <ChevronLeft size={24} />
                    </button>
                    <h1 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                        <Bell className="text-purple-600" size={20} /> Mis Mensajes
                    </h1>
                </div>
                {messages.some(m => !m.read) && (
                    <button
                        onClick={markAllRead}
                        className="text-xs font-bold text-purple-600 bg-purple-50 px-3 py-1.5 rounded-full hover:bg-purple-100 transition"
                    >
                        Marcar leídos
                    </button>
                )}
            </div>

            {/* List - Scrollable Area */}
            <div className="flex-1 overflow-y-auto scrollbar-thin p-4 space-y-3 pb-24">
                {loading ? (
                    [...Array(3)].map((_, i) => (
                        <div key={i} className="bg-white h-24 rounded-2xl shadow-sm animate-pulse"></div>
                    ))
                ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MailOpen size={32} />
                        </div>
                        <p>No tienes mensajes nuevos.</p>
                    </div>
                ) : (
                    messages.map(msg => (
                        <SwipeableMessage
                            key={msg.id}
                            msg={msg}
                            onDelete={(id) => setMsgToDelete(id)}
                            onRead={(m) => markAsRead(m)}
                        />
                    ))
                )}
            </div>

            {/* Confirmation Modal */}
            <ModernConfirmModal
                isOpen={!!msgToDelete}
                title="Eliminar Mensaje"
                message="¿Estás seguro que deseas borrar este mensaje? Esta acción no se puede deshacer."
                onConfirm={() => msgToDelete && deleteMessage(msgToDelete)}
                onCancel={() => setMsgToDelete(null)}
                confirmText="Sí, eliminar"
                type="danger"
            />
        </div>
    );
};

// Internal Component for Swipe Logic to avoid clutter
const SwipeableMessage = ({ msg, onDelete, onRead }: { msg: InboxMessage, onDelete: (id: string) => void, onRead: (m: InboxMessage) => void }) => {
    const [offsetX, setOffsetX] = useState(0);
    const [isSwiping, setIsSwiping] = useState(false);
    const startX = React.useRef(0);

    const handleTouchStart = (e: React.TouchEvent) => {
        startX.current = e.touches[0].clientX;
        setIsSwiping(true);
    };

    const handleTouchMove = (e: React.TouchEvent) => {
        if (!startX.current) return;
        const currentX = e.touches[0].clientX;
        const diff = currentX - startX.current;
        // Only allow swipe left (negative)
        if (diff < 0) {
            setOffsetX(diff);
        }
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);
        if (offsetX < -100) {
            // Threshold met - Trigger Delete
            onDelete(msg.id);
        } else {
            // Reset
            setOffsetX(0);
        }
        startX.current = 0;
    };

    return (
        <div className="relative overflow-hidden rounded-2xl mb-3">
            {/* Background Action (Delete) */}
            <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl">
                <Trash2 className="text-white" size={24} />
            </div>

            {/* Foreground Content */}
            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => onRead(msg)}
                style={{ transform: `translateX(${offsetX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
                className={`
                    relative p-4 rounded-2xl mb-3 transition-all
                    ${msg.read
                        ? 'bg-gray-50 border border-gray-100'
                        : 'bg-white shadow-md border-l-4 border-l-purple-500 border-y border-r border-gray-100 scale-[1.01]'}
                `}
            >
                <div className="flex justify-between items-start mb-2">
                    <div className="flex items-center gap-2">
                        {!msg.read && (
                            <span className="shrink-0 w-2 h-2 rounded-full bg-purple-600 animate-pulse shadow-sm shadow-purple-300"></span>
                        )}
                        <h3 className={`text-gray-800 ${msg.read ? 'font-medium' : 'font-black text-base'}`}>
                            {msg.title}
                        </h3>
                    </div>
                    <span className="text-[10px] text-gray-400 whitespace-nowrap ml-2">
                        {msg.date?.seconds
                            ? format(new Date(msg.date.seconds * 1000), 'd MMM yyyy HH:mm', { locale: es })
                            : 'Reciente'}
                    </span>
                </div>

                <p className="text-sm text-gray-600 leading-relaxed mb-3">
                    {msg.body}
                </p>

                <div className="flex justify-between items-center border-t border-gray-50 pt-3 mt-1">
                    {(() => {
                        let label = 'Sistema';
                        let colorClass = 'bg-gray-100 text-gray-500';
                        const type = msg.type?.toLowerCase();

                        if (type === 'prize' || type === 'premio' || type === 'redemption') {
                            label = 'Premio';
                            colorClass = 'bg-yellow-50 text-yellow-700 border border-yellow-100';
                        } else if (type === 'pointsadded' || type === 'puntos') {
                            label = 'Puntos';
                            colorClass = 'bg-green-50 text-green-700 border border-green-100';
                        } else if (type === 'welcome' || type === 'bienvenida') {
                            label = 'Bienvenida';
                            colorClass = 'bg-purple-50 text-purple-700 border border-purple-100';
                        } else if (type === 'campaign' || type === 'campaña' || type === 'offer' || type === 'oferta') {
                            label = 'Promoción';
                            colorClass = 'bg-rose-50 text-rose-700 border border-rose-100';
                        } else if (type === 'manual') {
                            label = 'Mensaje';
                            colorClass = 'bg-blue-50 text-blue-700 border border-blue-100';
                        }

                        return (
                            <span className={`text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider ${colorClass}`}>
                                {label}
                            </span>
                        );
                    })()}

                    {/* Visible Delete Button */}
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            onDelete(msg.id);
                        }}
                        className="text-gray-400 hover:text-red-500 p-1.5 rounded-full hover:bg-red-50 transition"
                    >
                        <Trash2 size={16} />
                    </button>
                </div>
            </div>
        </div>
    );
};

