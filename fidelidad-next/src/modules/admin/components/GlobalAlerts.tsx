import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, auth } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { Cake, X, ChevronDown, MessageCircle, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { BirthdayService } from '../../../services/birthdayService';
import toast from 'react-hot-toast';

export const GlobalAlerts = () => {
    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);
    const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    const navigate = useNavigate();

    const [isBirthdayAlertVisible, setIsBirthdayAlertVisible] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('hideBirthdayAlert') !== 'true';
        }
        return true;
    });

    const [isBirthdayMinimized, setIsBirthdayMinimized] = useState(() => {
        if (typeof window !== 'undefined') {
            return sessionStorage.getItem('birthdayMinimized') === 'true';
        }
        return false;
    });

    const [whatsappMentionsGift, setWhatsappMentionsGift] = useState<{ [key: string]: boolean }>({});
    const [fabPos, setFabPos] = useState({ x: 32, y: 32 });
    const [isFabExpanded, setIsFabExpanded] = useState(false);

    useEffect(() => {
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
            if (docSnap.exists()) setConfig(docSnap.data());
        });

        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
            const today = TimeService.now();
            const todayMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            
            const windowEnd = new Date(today);
            windowEnd.setDate(windowEnd.getDate() + 30);
            const windowEndStr = `${windowEnd.getFullYear()}-${String(windowEnd.getMonth() + 1).padStart(2, '0')}-${String(windowEnd.getDate()).padStart(2, '0')}`;

            const birthdays: any[] = [];
            const expirations: any[] = [];
            const currentYear = today.getFullYear().toString();

            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'admin') return;

                // 1. Birthdays
                if (data.birthDate?.endsWith(todayMD) || data.fechaNacimiento?.endsWith(todayMD)) {
                    if (data.lastBirthdayGreetingYear !== currentYear) {
                        birthdays.push({ id: d.id, ...data });
                    }
                }

                // 2. Expirations
                const pts = Number(data.points ?? data.puntos ?? 0);
                const hasPoints = pts > 0 || (data.nextExpirationAmount || 0) > 0;
                if (data.nextExpirationDate && data.nextExpirationDate > todayStr && data.nextExpirationDate <= windowEndStr && hasPoints) {
                    if (!data.lastWhatsAppManualDate || data.lastWhatsAppManualDate < todayStr) {
                        expirations.push({
                            id: d.id,
                            name: data.name || data.nombre || 'Socio',
                            points: pts > 0 ? pts : (data.nextExpirationAmount || 0),
                            nextExpirationDate: data.nextExpirationDate,
                            phone: data.phone || data.telefono || ''
                        });
                    }
                }
            });

            setBirthdaysOfToday(birthdays);
            setExpiringUsers(expirations);
        });

        return () => {
            unsubConfig();
            unsubUsers();
        };
    }, []);

    const markExpirationHandled = async (user: any, action: 'sent' | 'cancelled') => {
        try {
            const todayAR = TimeService.now().toLocaleDateString('en-CA');
            await updateDoc(doc(db, 'users', user.id), {
                lastWhatsAppManualDate: todayAR,
                lastExpirationNotice: todayAR
            });
            setExpiringUsers(prev => prev.filter(u => u.id !== user.id));
        } catch (e) {
            toast.error('Error al actualizar');
        }
    };

    const generateExpirationWaLink = (user: any): string | null => {
        if (!user.phone) return null;
        let phone = user.phone.replace(/\D/g, '');
        if (!phone.startsWith('54') && phone.length === 10) phone = '549' + phone;
        const template = config?.messaging?.templates?.expirationWarning || '¡Hola {nombre}! 📢 Tienes {puntos} puntos próximos a vencer. ⏳';
        const [y, m, d] = (user.nextExpirationDate || '').split('-');
        const msg = template.replace(/{nombre}/g, user.name.split(' ')[0]).replace(/{puntos}/g, user.points.toString()).replace(/{fecha}/g, d ? `${d}/${m}/${y}` : '');
        return `https://api.whatsapp.com/send?phone=${phone}&text=${encodeURIComponent(msg.trim())}`;
    };

    const openWhatsAppSafely = (url: string) => {
        const link = document.createElement('a');
        link.href = url;
        link.target = '_blank';
        link.click();
    };

    if (birthdaysOfToday.length === 0 && expiringUsers.length === 0) return null;

    return (
        <>
            {/* WhatsApp FAB for Expirations */}
            {expiringUsers.length > 0 && (
                <div className="fixed z-[60] bottom-8 left-8">
                    {isFabExpanded ? (
                        <div className="bg-white rounded-2xl shadow-2xl border border-green-100 w-80 overflow-hidden mb-4">
                            <div className="bg-green-600 text-white px-4 py-3 flex items-center justify-between">
                                <span className="font-bold text-sm flex items-center gap-2">
                                    <MessageCircle size={16} /> Vencimientos ({expiringUsers.length})
                                </span>
                                <button onClick={() => setIsFabExpanded(false)}><X size={16} /></button>
                            </div>
                            <div className="max-h-72 overflow-y-auto divide-y divide-gray-50">
                                {expiringUsers.map(user => (
                                    <div key={user.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold text-gray-800 truncate">{user.name}</p>
                                            <p className="text-xs text-amber-600 font-medium">{user.points} pts · {user.nextExpirationDate}</p>
                                        </div>
                                        <div className="flex items-center gap-1">
                                            <button onClick={async () => {
                                                const link = generateExpirationWaLink(user);
                                                if (link) openWhatsAppSafely(link);
                                                await markExpirationHandled(user, 'sent');
                                            }} className="p-1.5 bg-green-100 text-green-700 rounded-lg"><MessageCircle size={15} /></button>
                                            <button onClick={() => markExpirationHandled(user, 'cancelled')} className="p-1.5 bg-gray-100 text-gray-400 rounded-lg"><X size={15} /></button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ) : (
                        <button onClick={() => setIsFabExpanded(true)} className="bg-green-500 hover:bg-green-600 text-white p-4 rounded-full shadow-2xl flex items-center gap-2 hover:scale-105 transition-transform">
                            <MessageCircle size={24} />
                            <span className="font-bold text-sm">{expiringUsers.length}</span>
                        </button>
                    )}
                </div>
            )}

            {/* Birthday Alert */}
            {isBirthdayAlertVisible && birthdaysOfToday.length > 0 && (
                <div className={`fixed bottom-8 right-8 z-[60] transition-all ${isBirthdayMinimized ? 'w-14 h-14' : 'w-80'}`}>
                    {isBirthdayMinimized ? (
                        <button onClick={() => setIsBirthdayMinimized(false)} className="w-14 h-14 bg-pink-500 text-white rounded-full shadow-2xl flex items-center justify-center animate-bounce-subtle">
                            <Cake size={28} />
                            <span className="absolute -top-1 -right-1 bg-white text-pink-600 text-[10px] font-black w-5 h-5 rounded-full flex items-center justify-center shadow-sm border border-pink-100">{birthdaysOfToday.length}</span>
                        </button>
                    ) : (
                        <div className="bg-white rounded-2xl shadow-2xl border border-pink-100 overflow-hidden flex flex-col max-h-[80vh]">
                            <div className="bg-pink-500 p-4 flex items-center justify-between text-white">
                                <div className="flex items-center gap-2">
                                    <Cake size={20} />
                                    <span className="font-bold text-sm">Cumples (${birthdaysOfToday.length})</span>
                                </div>
                                <div className="flex gap-1">
                                    <button onClick={() => setIsBirthdayMinimized(true)}><ChevronDown size={18} /></button>
                                    <button onClick={() => setIsBirthdayAlertVisible(false)}><X size={18} /></button>
                                </div>
                            </div>
                            <div className="overflow-y-auto p-4 space-y-4 max-h-[60vh] bg-pink-50/20">
                                {birthdaysOfToday.map(client => (
                                    <div key={client.id} className="p-3 bg-white rounded-xl border border-pink-100 shadow-sm">
                                        <div className="flex items-center gap-3 mb-2">
                                            <User size={16} className="text-pink-400" />
                                            <p className="font-bold text-gray-800 text-sm truncate">{client.name}</p>
                                        </div>
                                        <button 
                                            onClick={async () => {
                                                if (!config) return;
                                                const res: any = await BirthdayService.sendBirthdayGreeting(client.id, client, config, { whatsappOnly: true });
                                                if (res?.whatsappLink) openWhatsAppSafely(res.whatsappLink);
                                            }}
                                            className="w-full bg-[#25D366] text-white text-[11px] font-bold py-2 rounded-lg flex items-center justify-center gap-2"
                                        >
                                            <MessageCircle size={14} /> WhatsApp
                                        </button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
