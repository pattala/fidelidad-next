import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { Cake, ChevronDown, MessageCircle, Clock, Sparkles } from 'lucide-react';
import { BirthdayService } from '../../../services/birthdayService';
import toast from 'react-hot-toast';

export const GlobalAlerts = () => {
    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);
    const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
    const [petAlerts, setPetAlerts] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    
    // UI State: Always start minimized
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    
    const [includeGift, setIncludeGift] = useState<{ [id: string]: boolean }>({});

    // Draggable Logic
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
        // Only drag from header or bubble
        setIsDragging(true);
        setDragStart({ x: e.clientX - position.x, y: e.clientY - position.y });
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (!isDragging) return;
            setPosition({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
        };
        const handleMouseUp = () => setIsDragging(false);

        if (isDragging) {
            window.addEventListener('mousemove', handleMouseMove);
            window.addEventListener('mouseup', handleMouseUp);
        }
        return () => {
            window.removeEventListener('mousemove', handleMouseMove);
            window.removeEventListener('mouseup', handleMouseUp);
        };
    }, [isDragging, dragStart]);

    useEffect(() => {
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (docSnap) => {
            if (docSnap.exists()) {
                setConfig(docSnap.data());
            }
        });

        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
            const today = TimeService.now();
            const dMonth = String(today.getMonth() + 1).padStart(2, '0');
            const dDay = String(today.getDate()).padStart(2, '0');
            const dYear = today.getFullYear();
            const todayMD = `${dMonth}-${dDay}`;
            const todayStr = `${dYear}-${dMonth}-${dDay}`;
            const windowEnd = new Date(today);
            windowEnd.setDate(windowEnd.getDate() + 30);
            const windowEndStr = windowEnd.toISOString().split('T')[0];
            const currentYear = today.getFullYear().toString();
            
            const births: any[] = [];
            const exps: any[] = [];
            const pets: any[] = [];

            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'admin') return;
                if (data.birthDate?.endsWith(todayMD) || data.fechaNacimiento?.endsWith(todayMD)) {
                    births.push({ id: d.id, ...data, alreadyGreetedAuto: data.lastBirthdayGreetingYear === currentYear });
                }
                const pts = Number(data.points ?? data.puntos ?? 0);
                if (data.nextExpirationDate && data.nextExpirationDate > todayStr && data.nextExpirationDate <= windowEndStr && pts > 0) {
                    if (!data.lastWhatsAppManualDate || data.lastWhatsAppManualDate < todayStr) {
                        exps.push({ id: d.id, ...data, points: pts });
                    }
                }
                if (data.pets && Array.isArray(data.pets)) {
                    data.pets.forEach((p: any) => {
                        if (p.nextFoodAlertDate === todayStr) {
                            pets.push({ id: d.id, petName: p.name, category: p.category, ...data });
                        }
                    });
                }
            });
            setBirthdaysOfToday(births);
            setExpiringUsers(exps);
            setPetAlerts(pets);
        });

        return () => { unsubConfig(); unsubUsers(); };
    }, []);

    const openWhatsApp = async (user: any, type: 'birthday' | 'expiration' | 'pet') => {
        if (!config) return;
        let waLink = '';
        if (type === 'birthday') {
            const currentYear = TimeService.now().getFullYear().toString();
            const alreadyPaid = user.lastBirthdayPointsYear === currentYear;
            const wantGift = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);
            if (wantGift && !alreadyPaid) {
                const ok = await BirthdayService.giveBirthdayPoints(user.id, user, config);
                if (!ok) { toast.error("Error al acreditar puntos"); return; }
            }
            const res = await BirthdayService.sendBirthdayGreeting(user.id, user, config, { whatsappOnly: true, mode: wantGift ? 'full' : 'clean' });
            waLink = res.whatsappLink || '';
        } else {
            const phone = user.phone || user.telefono;
            if (!phone) return;
            let p = phone.replace(/\D/g, '');
            if (!p.startsWith('54') && p.length === 10) p = '549' + p;
            const templates = config?.messaging?.templates || {};
            let msg = '';
            if (type === 'expiration') {
                msg = (templates.expirationWarning || "¡Hola {nombre}! 📢 Tienes {puntos} puntos por vencer. ⏳")
                    .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio').replace(/{puntos}/g, user.points?.toString());
            } else if (type === 'pet') {
                msg = (templates.petFoodAlert || "¡Hola {nombre}! 🐾 Vemos que el alimento de {mascota} está por terminarse.")
                    .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio').replace(/{mascota}/g, user.petName);
            }
            waLink = `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`;
        }
        if (waLink) window.open(waLink, '_blank');
    };

    const total = birthdaysOfToday.length + expiringUsers.length + petAlerts.length;
    if (total === 0) return null;

    return (
        <div 
            className="fixed z-[9999] flex flex-col items-end gap-3 pointer-events-none transition-transform duration-75"
            style={{ 
                bottom: '24px', 
                right: '24px',
                transform: `translate(${position.x}px, ${position.y}px)` 
            }}
        >
            {/* Extended Panel */}
            {isExpanded && !isMinimized && (
                <div className="w-80 max-h-[500px] bg-indigo-950/80 backdrop-blur-2xl border border-white/20 rounded-[2.5rem] shadow-2xl shadow-indigo-500/20 flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 pointer-events-auto ring-1 ring-white/10">
                    <div onMouseDown={handleMouseDown} className="p-5 bg-gradient-to-r from-violet-600/40 to-indigo-600/40 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing">
                        <div className="flex items-center gap-3">
                            <Sparkles size={20} className="text-violet-200 animate-pulse" />
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-wider">Avisos Smart</h4>
                                <p className="text-[10px] text-violet-200/50 font-bold uppercase tracking-widest">Rampet System</p>
                            </div>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="text-white/40 hover:text-white p-1 hover:bg-white/10 rounded-full">
                            <ChevronDown size={22} />
                        </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-5 custom-scrollbar bg-black/20 text-white">
                        {birthdaysOfToday.length > 0 && (
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-violet-300 uppercase tracking-widest flex items-center gap-2">🎂 Cumpleaños</h5>
                                {birthdaysOfToday.map(user => {
                                    const currentYear = TimeService.now().getFullYear().toString();
                                    const alreadyPaid = user.lastBirthdayPointsYear === currentYear;
                                    const isSelected = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);
                                    return (
                                        <div key={user.id} className="bg-white/5 p-4 rounded-[1.8rem] border border-white/10">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black truncate">{user.name}</p>
                                                    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg ${alreadyPaid ? 'bg-green-500/20 text-green-300' : 'bg-violet-500/20 text-violet-300'}`}>
                                                        {alreadyPaid ? 'Acreditados' : (isSelected ? '+ Regalo' : 'Sin Regalo')}
                                                    </span>
                                                </div>
                                                <input type="checkbox" disabled={alreadyPaid} checked={isSelected} onChange={(e) => setIncludeGift(prev => ({ ...prev, [user.id]: e.target.checked }))} className="w-5 h-5 rounded-lg border-white/10 bg-black/40 text-violet-500" />
                                            </div>
                                            <button onClick={() => openWhatsApp(user, 'birthday')} className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg">
                                                <MessageCircle size={14} /> WHATSAPP
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {/* Simplified list for others */}
                        {(expiringUsers.length > 0 || petAlerts.length > 0) && (
                            <div className="space-y-3">
                                <h5 className="text-[10px] font-black text-violet-300 uppercase tracking-widest flex items-center gap-2">⚠️ Otros Avisos</h5>
                                {[...expiringUsers, ...petAlerts].map((item, idx) => (
                                    <div key={idx} className="bg-white/5 p-4 rounded-[1.8rem] border border-white/10 flex items-center justify-between gap-2">
                                        <div className="flex-1">
                                            <p className="text-xs font-black truncate">{item.name || item.petName}</p>
                                            <p className="text-[10px] text-white/50">{item.points ? 'Vencimiento' : 'Alimento'}</p>
                                        </div>
                                        <button onClick={() => openWhatsApp(item, item.points ? 'expiration' : 'pet')} className="bg-white/10 p-2 rounded-xl text-white"><MessageCircle size={16} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Floating Bubble */}
            {(!isExpanded || isMinimized) && (
                <button
                    onMouseDown={handleMouseDown}
                    onClick={() => { setIsMinimized(false); setIsExpanded(true); }}
                    className="w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-700 rounded-full shadow-[0_20px_50px_rgba(79,70,229,0.3)] flex items-center justify-center text-white border-2 border-white/20 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative cursor-grab active:cursor-grabbing animate-bounce-subtle"
                >
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">{total}</div>
                    <Bell size={24} />
                </button>
            )}
        </div>
    );
};

const Bell = ({ size, className }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
);
