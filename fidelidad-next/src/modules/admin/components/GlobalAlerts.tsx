import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { Cake, X, ChevronDown, MessageCircle, User, Bell, Clock, PawPrint, ExternalLink } from 'lucide-react';
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
                const data = docSnap.data();
                setConfig(data);
            }
        });

        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
            const today = TimeService.now();
            
            // Formatear manualmente para evitar saltos por zona horaria (UTC shifts)
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
                    // Los mostramos siempre si es HOY, incluso si ya fueron saludados automáticamente
                    births.push({ 
                        id: d.id, 
                        ...data,
                        alreadyGreetedAuto: data.lastBirthdayGreetingYear === currentYear
                    });
                    console.log(`[GlobalAlerts Birthday Debug] User ${data.name} (${d.id}) -> lastGiftYear: ${data.lastBirthdayPointsYear}, greetedYear: ${data.lastBirthdayGreetingYear}`);
                }

                // 2. Expirations
                const pts = Number(data.points ?? data.puntos ?? 0);
                if (data.nextExpirationDate && data.nextExpirationDate > todayStr && data.nextExpirationDate <= windowEndStr && pts > 0) {
                    if (!data.lastWhatsAppManualDate || data.lastWhatsAppManualDate < todayStr) {
                        exps.push({ id: d.id, ...data, points: pts });
                    }
                }

                // 3. Pets (Mock check logic similar to engine)
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
            const hasGift = includeGift[user.id] ?? config.enableBirthdayBonus;
            const res = await BirthdayService.sendBirthdayGreeting(user.id, user, config, { 
                whatsappOnly: true, 
                mode: hasGift ? 'full' : 'clean' 
            });
            waLink = res.whatsappLink || '';
        } else {
            // For others, generate link based on templates
            const phone = user.phone || user.telefono;
            if (!phone) return;
            let p = phone.replace(/\D/g, '');
            if (!p.startsWith('54') && p.length === 10) p = '549' + p;
            
            const templates = config?.messaging?.templates || {};
            let msg = '';
            if (type === 'expiration') {
                msg = (templates.expirationWarning || "¡Hola {nombre}! 📢 Tienes {puntos} puntos por vencer. ⏳")
                    .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio')
                    .replace(/{puntos}/g, user.points.toString());
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

    // --- RENDER MINIMIZED ---
    if (isMinimized) {
        return (
            <button 
                onClick={toggleMinimized}
                className="fixed bottom-6 right-6 z-[9999] w-14 h-14 bg-amber-500 text-white rounded-full shadow-2xl flex items-center justify-center hover:scale-110 transition-all group border-4 border-white"
            >
                <Bell className="animate-swing" />
                <span className="absolute -top-1 -right-1 bg-red-600 text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white shadow-sm">{total}</span>
            </button>
        );
    }

    return (
        <div className={`fixed bottom-6 right-6 z-[9999] transition-all duration-300 ${isExpanded ? 'w-80' : 'w-72'}`}>
            <div className="bg-white/80 backdrop-blur-xl rounded-[24px] shadow-[0_20px_50px_rgba(0,0,0,0.2)] border border-white overflow-hidden flex flex-col max-h-[85vh]">
                
                {/* Header */}
                <div onClick={() => !isExpanded && setIsExpanded(true)} className={`p-4 flex items-center justify-between cursor-pointer ${isExpanded ? 'bg-amber-500 text-white' : 'hover:bg-amber-50'}`}>
                    <div className="flex items-center gap-3">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center ${isExpanded ? 'bg-white/20' : 'bg-amber-100 text-amber-600'}`}>
                            <Bell size={18} />
                        </div>
                        <div>
        <div className="fixed bottom-6 right-6 z-[9999] flex flex-col items-end gap-3 pointer-events-none">
            {/* Main Widget Panel */}
            {isExpanded && (
                <div className="w-80 max-h-[500px] bg-indigo-950/80 backdrop-blur-xl border border-white/20 rounded-[2rem] shadow-2xl shadow-indigo-500/20 flex flex-col overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 pointer-events-auto ring-1 ring-white/10">
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
                        <button onClick={toggleMinimized} className="text-white/50 hover:text-white p-1 hover:bg-white/10 rounded-full transition-colors">
                            <ChevronDown size={20} />
                        </button>
                    </div>

                    {/* Content Scroll Area */}
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 custom-scrollbar">
                        {/* Section: Birthdays */}
                        {birthdaysOfToday.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <Cake size={12} /> Cumpleaños de hoy
                                </h5>
                                {birthdaysOfToday.map(user => {
                                    const currentYear = TimeService.now().getFullYear().toString();
                                    const alreadyPaid = user.lastBirthdayPointsYear === currentYear;
                                    const isSelected = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);
                                    
                                    return (
                                        <div key={user.id} className="bg-white/5 backdrop-blur-sm p-4 rounded-[1.5rem] border border-white/10 hover:border-indigo-400/30 transition-all group">
                                            <div className="flex items-center justify-between mb-3">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-black text-white truncate group-hover:text-indigo-200 transition-colors">{user.name}</p>
                                                    <div className="flex flex-wrap items-center gap-1 mt-1">
                                                        <p className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-full ${alreadyPaid ? 'bg-green-500/20 text-green-400' : 'bg-indigo-500/20 text-indigo-300'}`}>
                                                            {alreadyPaid ? 'Puntos Acreditados' : (isSelected ? 'Acreditar Puntos' : 'Sin Regalo')}
                                                        </p>
                                                        {user.alreadyGreetedAuto && (
                                                            <span className="text-[9px] font-black bg-white/10 text-white/50 px-2 py-0.5 rounded-full">Auto OK</span>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center">
                                                    <input 
                                                        type="checkbox" 
                                                        disabled={alreadyPaid}
                                                        checked={isSelected}
                                                        onChange={(e) => setIncludeGift(prev => ({ ...prev, [user.id]: e.target.checked }))}
                                                        className={`w-5 h-5 rounded-lg border-white/10 bg-black/20 ${alreadyPaid ? 'opacity-30 cursor-not-allowed' : 'text-indigo-500 focus:ring-indigo-400 cursor-pointer hover:border-indigo-400'}`}
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => openWhatsApp(user, 'birthday')}
                                                className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] hover:from-[#20ba5a] hover:to-[#075E54] text-white text-[11px] font-black py-2.5 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-900/20 transition-all active:scale-95"
                                            >
                                                <MessageCircle size={14} /> ENVIAR WHATSAPP
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Section: Expirations */}
                        {expiringUsers.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <Clock size={12} /> Vencimientos Próximos
                                </h5>
                                {expiringUsers.map(user => (
                                    <div key={user.id} className="bg-white/5 backdrop-blur-sm p-4 rounded-[1.5rem] border border-white/10">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-xs font-black text-white">{user.name}</p>
                                                <p className="text-[10px] font-black text-orange-400 uppercase mt-0.5">
                                                    {user.points} pts a vencer
                                                </p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => openWhatsApp(user, 'expiration')}
                                            className="w-full bg-white/10 hover:bg-white/20 text-white text-[10px] font-black py-2.5 rounded-xl border border-white/10 transition-all"
                                        >
                                            AVISAR VENCIMIENTO
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Section: Pet Alerts */}
                        {petAlerts.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[10px] font-black text-indigo-300 uppercase tracking-widest flex items-center gap-2 mb-3">
                                    <Sparkles size={12} /> Reposición Alimento
                                </h5>
                                {petAlerts.map((pet, idx) => (
                                    <div key={`${pet.id}-${idx}`} className="bg-white/5 backdrop-blur-sm p-4 rounded-[1.5rem] border border-white/10">
                                        <div className="flex justify-between items-start mb-3">
                                            <div>
                                                <p className="text-[10px] font-black text-indigo-200 uppercase tracking-widest">{pet.petName}</p>
                                                <p className="text-xs font-bold text-white mt-0.5">{pet.name}</p>
                                            </div>
                                        </div>
                                        <button 
                                            onClick={() => openWhatsApp(pet, 'pet')}
                                            className="w-full bg-indigo-600 hover:bg-indigo-500 text-white text-[10px] font-black py-2.5 rounded-xl transition-all shadow-lg shadow-indigo-900/20"
                                        >
                                            RECORDAR COMPRA
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    {/* Footer */}
                    <div className="p-3 bg-black/20 text-center">
                        <p className="text-[8px] font-bold text-white/30 uppercase tracking-[0.2em]">Rampet v6.0 System</p>
                    </div>
                </div>
            )}

            {/* Floating Bubble Icon */}
            {!isExpanded && (
                <button
                    onClick={toggleMinimized}
                    className="w-16 h-16 bg-gradient-to-tr from-indigo-600 to-violet-600 rounded-full shadow-2xl shadow-indigo-500/40 flex items-center justify-center text-white border-2 border-white/20 hover:scale-110 active:scale-95 transition-all animate-bounce-subtle pointer-events-auto relative group"
                >
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black w-6 h-6 rounded-full flex items-center justify-center border-2 border-white animate-pulse">
                        {total}
                    </div>
                    <Sparkles className="group-hover:rotate-12 transition-transform" />
                </button>
            )}
        </div>
    );
};
