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
                            <p className={`text-xs font-black uppercase tracking-widest ${isExpanded ? 'text-white' : 'text-amber-800'}`}>Avisos Críticos</p>
                            {!isExpanded && (
                                <p className="text-[10px] font-bold text-amber-600/80">
                                    {birthdaysOfToday.length > 0 && `🎂 ${birthdaysOfToday.length} `}
                                    {expiringUsers.length > 0 && `⏳ ${expiringUsers.length} `}
                                    {petAlerts.length > 0 && `🐾 ${petAlerts.length}`}
                                </p>
                            )}
                        </div>
                    </div>
                    <div className="flex items-center gap-1">
                        <button onClick={(e) => { e.stopPropagation(); toggleMinimized(); }} className="p-1 hover:bg-black/10 rounded-full transition-colors"><ChevronDown size={18} /></button>
                    </div>
                </div>

                {/* Expanded Content */}
                {isExpanded && (
                    <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-gradient-to-b from-transparent to-amber-50/30">
                        {/* Section: Birthdays */}
                        {birthdaysOfToday.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[9px] font-black text-pink-600 uppercase tracking-tighter flex items-center gap-1">
                                    <Cake size={10} /> Cumpleaños Hoy
                                </h5>
                                {birthdaysOfToday.map(user => {
                                    const currentYear = TimeService.now().getFullYear().toString();
                                    const alreadyPaid = user.lastBirthdayPointsYear === currentYear;
                                    const isSelected = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);
                                    
                                    return (
                                        <div key={user.id} className="bg-white p-3 rounded-2xl border border-pink-50 shadow-sm group">
                                            <div className="flex items-center justify-between mb-2">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-xs font-bold text-gray-800 truncate">{user.name}</p>
                                                    <p className={`text-[10px] font-black ${alreadyPaid ? 'text-green-500' : 'text-pink-400'}`}>
                                                        {alreadyPaid ? 'Puntos ya acreditados ✅' : (isSelected ? 'Se acreditarán puntos 🎁' : 'Saludo sin regalo ⚪')}
                                                        {user.alreadyGreetedAuto && ' · (Mensaje Auto OK ✉️)'}
                                                    </p>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <input 
                                                        type="checkbox" 
                                                        disabled={alreadyPaid}
                                                        checked={isSelected}
                                                        onChange={(e) => setIncludeGift(prev => ({ ...prev, [user.id]: e.target.checked }))}
                                                        className={`w-4 h-4 rounded border-gray-300 ${alreadyPaid ? 'opacity-50 cursor-not-allowed text-green-500' : 'text-pink-500 focus:ring-pink-400'}`}
                                                    />
                                                </div>
                                            </div>
                                            <button 
                                                onClick={() => openWhatsApp(user, 'birthday')}
                                                className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all"
                                            >
                                                <MessageCircle size={14} /> WHATSAPP {(isSelected || alreadyPaid) ? '+ REGALO' : ''}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Section: Expirations */}
                        {expiringUsers.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[9px] font-black text-amber-600 uppercase tracking-tighter flex items-center gap-1">
                                    <Clock size={10} /> Vencimientos Próximos
                                </h5>
                                {expiringUsers.map(user => (
                                    <div key={user.id} className="bg-white p-3 rounded-2xl border border-amber-50 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-gray-800 truncate flex-1">{user.name}</span>
                                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-2 py-0.5 rounded-full">{user.points} pts</span>
                                        </div>
                                        <button 
                                            onClick={() => openWhatsApp(user, 'expiration')}
                                            className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all"
                                        >
                                            <MessageCircle size={14} /> AVISAR VENCIMIENTO
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Section: Pet Alerts */}
                        {petAlerts.length > 0 && (
                            <div className="space-y-2">
                                <h5 className="text-[9px] font-black text-orange-600 uppercase tracking-tighter flex items-center gap-1">
                                    <PawPrint size={10} /> Reposición Alimento
                                </h5>
                                {petAlerts.map(user => (
                                    <div key={user.id} className="bg-white p-3 rounded-2xl border border-orange-50 shadow-sm">
                                        <div className="flex items-center justify-between mb-2">
                                            <span className="text-xs font-bold text-gray-800 truncate flex-1">{user.petName}</span>
                                            <span className="text-[9px] font-medium text-gray-500">de {user.name.split(' ')[0]}</span>
                                        </div>
                                        <button 
                                            onClick={() => openWhatsApp(user, 'pet')}
                                            className="w-full bg-[#25D366] hover:bg-[#20ba5a] text-white text-[10px] font-black py-2 rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-green-200 transition-all"
                                        >
                                            <MessageCircle size={14} /> RECORDAR COMPRA
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {/* Footer Link */}
                {isExpanded && (
                    <div className="p-3 border-t border-gray-100 bg-white text-center">
                        <button 
                            onClick={() => setIsExpanded(false)}
                            className="text-[10px] font-bold text-gray-400 hover:text-amber-600 flex items-center justify-center gap-1 mx-auto"
                        >
                            Cerrar detalle <X size={12} />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
