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
    
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMinimized, setIsMinimized] = useState(() => {
        if (typeof window !== 'undefined') return sessionStorage.getItem('cf_alerts_minimized') === 'true';
        return false;
    });
    const [includeGift, setIncludeGift] = useState<{ [id: string]: boolean }>({});

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

                // 1. Birthdays
                if (data.birthDate?.endsWith(todayMD) || data.fechaNacimiento?.endsWith(todayMD)) {
                    births.push({ 
                        id: d.id, 
                        ...data,
                        alreadyGreetedAuto: data.lastBirthdayGreetingYear === currentYear
                    });
                }

                // 2. Expirations
                const pts = Number(data.points ?? data.puntos ?? 0);
                if (data.nextExpirationDate && data.nextExpirationDate > todayStr && data.nextExpirationDate <= windowEndStr && pts > 0) {
                    if (!data.lastWhatsAppManualDate || data.lastWhatsAppManualDate < todayStr) {
                        exps.push({ id: d.id, ...data, points: pts });
                    }
                }

                // 3. Pets
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
            
            console.log(`[GlobalAlerts Debug] Date: ${todayStr}, MD: ${todayMD}`);
            console.log(`[GlobalAlerts Debug] Counts -> Birthdays: ${births.length}, Expirations: ${exps.length}, Pets: ${pets.length}`);
        });

        return () => { unsubConfig(); unsubUsers(); };
    }, []);

    const toggleMinimized = () => {
        const newState = !isMinimized;
        setIsMinimized(newState);
        sessionStorage.setItem('cf_alerts_minimized', String(newState));
        if (newState) setIsExpanded(false);
    };

    const openWhatsApp = async (user: any, type: 'birthday' | 'expiration' | 'pet') => {
        if (!config) return;
        
        let waLink = '';
        if (type === 'birthday') {
            const currentYear = TimeService.now().getFullYear().toString();
            const alreadyPaid = user.lastBirthdayPointsYear === currentYear;
            const wantGift = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);

            if (wantGift && !alreadyPaid) {
                const ok = await BirthdayService.giveBirthdayPoints(user.id, user, config);
                if (!ok) {
                    toast.error("Error al acreditar puntos");
                    return;
                }
            }

            const res = await BirthdayService.sendBirthdayGreeting(user.id, user, config, { 
                whatsappOnly: true, 
                mode: wantGift ? 'full' : 'clean' 
            });
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
                    .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio')
                    .replace(/{puntos}/g, user.points?.toString());
            } else if (type === 'pet') {
                msg = (templates.petFoodAlert || "¡Hola {nombre}! 🐾 Vemos que el alimento de {mascota} está por terminarse.")
                    .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio')
                    .replace(/{mascota}/g, user.petName);
            }
            waLink = `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`;
        }

        if (waLink) window.open(waLink, '_blank');
    };

    const total = birthdaysOfToday.length + expiringUsers.length + petAlerts.length;
    if (total === 0) return null;

    return (
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
            {/* Main Widget Panel */}
            {isExpanded && !isMinimized && (
                <div className="w-80 max-h-[500px] bg-indigo-950/90 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl shadow-indigo-500/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto ring-1 ring-white/10">
                    {/* Header */}
                    <div className="p-4 bg-gradient-to-r from-indigo-600/40 to-violet-600/40 border-b border-white/10 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="bg-white/10 p-2 rounded-xl backdrop-blur-md">
                                <Sparkles size={18} className="text-indigo-200" />
                            </div>
                            <div>
                                <h4 className="text-sm font-black text-white uppercase tracking-tighter">Centro de Avisos</h4>
                                <p className="text-[10px] text-indigo-200 font-bold uppercase tracking-widest opacity-70">Rampet Fidelidad</p>
                            </div>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar bg-black/20">
                        {/* Birthdays */}
                        {birthdaysOfToday.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <Cake size={12} /> Cumpleaños hoy
                                </h5>
                                {birthdaysOfToday.map(user => {
                                    const currentYear = TimeService.now().getFullYear().toString();
                                    const alreadyPaid = user.lastBirthdayPointsYear === currentYear;
                                    const isSelected = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);
                                    
                                    return (
                                        <div key={user.id} className="bg-white/5 backdrop-blur-sm p-4 rounded-[1.5rem] border border-white/10 group">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-white truncate">{user.name}</p>
                                                    <div className="flex items-center gap-1 mt-1">
                                                        <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${alreadyPaid ? 'bg-green-500/20 text-green-400' : 'bg-indigo-500/20 text-indigo-300'}`}>
                                                            {alreadyPaid ? 'Acreditados' : (isSelected ? 'Con Regalo' : 'Sin Regalo')}
                                                        </span>
                                                        {user.alreadyGreetedAuto && <span className="text-[9px] text-white/40">✉️</span>}
                                                    </div>
                                                </div>
                                                <input 
                                                    type="checkbox" 
                                                    disabled={alreadyPaid}
                                                    checked={isSelected}
                                                    onChange={(e) => setIncludeGift(prev => ({ ...prev, [user.id]: e.target.checked }))}
                                                    className="w-5 h-5 rounded-lg border-white/10 bg-black/30 text-indigo-500 cursor-pointer"
                                                />
                                            </div>
                                            <button 
                                                onClick={() => openWhatsApp(user, 'birthday')}
                                                className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-2"
                                            >
                                                <MessageCircle size={14} /> ENVIAR WHATSAPP
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Expirations & Pets (Simplified for brevity but styled same) */}
                        {expiringUsers.length > 0 && (
                             <div className="space-y-2">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <Clock size={12} /> Vencimientos
                                </h5>
                                {expiringUsers.map(user => (
                                    <div key={user.id} className="bg-white/5 p-4 rounded-[1.5rem] border border-white/10">
                                        <p className="text-xs font-black text-white">{user.name}</p>
                                        <p className="text-[10px] font-black text-orange-400 uppercase mb-3">{user.points} pts próximos</p>
                                        <button onClick={() => openWhatsApp(user, 'expiration')} className="w-full bg-white/10 text-white text-[10px] font-black py-2 px-4 rounded-xl border border-white/5">AVISAR</button>
                                    </div>
                                ))}
                             </div>
                        )}
                        
                        {petAlerts.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-2">
                                    <Sparkles size={12} /> Mascotas
                                </h5>
                                {petAlerts.map((pet, idx) => (
                                    <div key={idx} className="bg-white/5 p-4 rounded-[1.5rem] border border-white/10">
                                        <p className="text-[9px] font-black text-indigo-300 uppercase mb-1">{pet.petName}</p>
                                        <p className="text-xs font-bold text-white mb-3">{pet.name}</p>
                                        <button onClick={() => openWhatsApp(pet, 'pet')} className="w-full bg-indigo-600 text-white text-[10px] font-black py-2 rounded-xl">RECORDAR COMIDA</button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Footer */}
                    <div className="p-3 bg-black/40 text-center border-t border-white/5">
                        <p className="text-[8px] font-bold text-white/20 uppercase tracking-widest">Rampet System v6.0</p>
                    </div>
                </div>
            )}

            {/* Floating Bubble Icon */}
            {(!isExpanded || isMinimized) && (
                <button
                    onClick={() => isMinimized ? toggleMinimized() : setIsExpanded(true)}
                    className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full shadow-2xl shadow-indigo-500/40 flex items-center justify-center text-white border-2 border-white/20 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative"
                >
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                        {total}
                    </div>
                    <Bell className={total > 0 ? 'animate-swing' : ''} size={24} />
                </button>
            )}
        </div>
    );
};

// Icons not imported properly fix
const Bell = ({ size, className }: any) => (
    <svg xmlns="http://www.w3.org/2000/svg" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
        <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
    </svg>
);
