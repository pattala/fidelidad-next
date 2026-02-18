import React, { useEffect, useState } from 'react';
import { collection, query, onSnapshot, doc, updateDoc, writeBatch } from 'firebase/firestore';
import { auth, db } from '../../../lib/firebase';
import { Trash2, MailOpen, ChevronLeft, Mail } from 'lucide-react';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { ModernConfirmModal } from '../components/ModernConfirmModal';
import type { AppConfig } from '../../../types';

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
    const { config, setHeaderTitle, setHeaderActions } = useOutletContext<{
        config: AppConfig,
        setHeaderTitle: (title: string | null) => void,
        setHeaderActions: (actions: React.ReactNode | null) => void
    }>();
    const [messages, setMessages] = useState<InboxMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [msgToDelete, setMsgToDelete] = useState<string | null>(null);
    const [isBulkDeleteConfirmOpen, setIsBulkDeleteConfirmOpen] = useState(false);
    const navigate = useNavigate();

    // Set Header State
    useEffect(() => {
        setHeaderTitle('Mensajes');

        const actions = (
            <div className="flex items-center gap-1">
                {messages.some(m => !m.read) && (
                    <button
                        onClick={markAllRead}
                        className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 text-white"
                        title="Marcar todos como leídos"
                    >
                        <MailOpen size={20} />
                    </button>
                )}
                {messages.length > 0 && (
                    <button
                        onClick={() => setIsBulkDeleteConfirmOpen(true)}
                        className="p-2 hover:bg-white/10 rounded-xl transition-all active:scale-95 text-white"
                        title="Borrar todos"
                    >
                        <Trash2 size={20} />
                    </button>
                )}
            </div>
        );

        setHeaderActions(actions);

        return () => {
            setHeaderTitle(null);
            setHeaderActions(null);
        };
    }, [messages, setHeaderTitle, setHeaderActions]);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const q = query(
            collection(db, `users/${user.uid}/inbox`)
        );

        const unsubscribe = onSnapshot(q, { includeMetadataChanges: true }, (snapshot) => {
            const msgs = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data({ serverTimestamps: 'estimate' })
            })) as InboxMessage[];

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

    const deleteAllMessages = async () => {
        const user = auth.currentUser;
        if (!user || messages.length === 0) return;

        try {
            const batch = writeBatch(db);
            messages.forEach(msg => {
                const ref = doc(db, `users/${user.uid}/inbox`, msg.id);
                batch.delete(ref);
            });
            await batch.commit();
        } catch (error) {
            console.error("Error deleting all", error);
        }
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
        <div className="min-h-screen bg-gray-50 pb-28 animate-fade-in">


            {/* List */}
            <div
                className="p-4 space-y-3 transition-all"
                style={{ paddingTop: `var(--pwa-padding-top, 12px)` }}
            >
                {loading ? (
                    <div className="space-y-3">
                        {[...Array(3)].map((_, i) => (
                            <div key={i} className="bg-white h-24 rounded-2xl shadow-sm animate-pulse"></div>
                        ))}
                    </div>
                ) : messages.length === 0 ? (
                    <div className="text-center py-12 text-gray-400">
                        <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MailOpen size={32} />
                        </div>
                        <p>No tienes mensajes nuevos.</p>
                    </div>
                ) : (
                    <div className="space-y-3">
                        {messages.map(msg => (
                            <SwipeableMessage
                                key={msg.id}
                                msg={msg}
                                onDelete={(id) => setMsgToDelete(id)}
                                onRead={(m) => markAsRead(m)}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* Confirmation Modal - Single Delete */}
            <ModernConfirmModal
                isOpen={!!msgToDelete}
                title="Eliminar Mensaje"
                message="¿Estás seguro que deseas borrar este mensaje? Esta acción no se puede deshacer."
                onConfirm={() => msgToDelete && deleteMessage(msgToDelete)}
                onCancel={() => setMsgToDelete(null)}
                confirmText="Sí, eliminar"
                type="danger"
            />

            {/* Confirmation Modal - Bulk Delete */}
            <ModernConfirmModal
                isOpen={isBulkDeleteConfirmOpen}
                title="Limpiar Inbox"
                message={`¿Estás seguro que deseas eliminar los ${messages.length} mensajes? Esta acción no se puede deshacer.`}
                onConfirm={() => {
                    deleteAllMessages();
                    setIsBulkDeleteConfirmOpen(false);
                }}
                onCancel={() => setIsBulkDeleteConfirmOpen(false)}
                confirmText="Sí, borrar todo"
                type="danger"
            />
        </div>
    );
};

interface SwipeableMessageProps {
    msg: InboxMessage;
    onDelete: (id: string) => void;
    onRead: (m: InboxMessage) => void;
}

const SwipeableMessage = ({ msg, onDelete, onRead }: SwipeableMessageProps) => {
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
        if (diff < 0) {
            setOffsetX(diff);
        }
    };

    const handleTouchEnd = () => {
        setIsSwiping(false);
        if (offsetX < -100) {
            onDelete(msg.id);
        } else {
            setOffsetX(0);
        }
        startX.current = 0;
    };

    return (
        <div className="relative overflow-hidden rounded-2xl">
            <div className="absolute inset-0 bg-red-500 flex items-center justify-end pr-6 rounded-2xl">
                <Trash2 className="text-white" size={24} />
            </div>

            <div
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onClick={() => onRead(msg)}
                style={{ transform: `translateX(${offsetX}px)`, transition: isSwiping ? 'none' : 'transform 0.2s ease-out' }}
                className={`
                    relative p-4 rounded-2xl transition-all
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
