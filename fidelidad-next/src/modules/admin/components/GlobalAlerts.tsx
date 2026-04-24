import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { Cake, ChevronDown, MessageCircle, Sparkles, Bell, User } from 'lucide-react';
import { BirthdayService } from '../../../services/birthdayService';
import toast from 'react-hot-toast';

export const GlobalAlerts = () => {
    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);
    const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
    const [petAlerts, setPetAlerts] = useState<any[]>([]);
    const [config, setConfig] = useState<any>(null);
    
    const [isExpanded, setIsExpanded] = useState(false);
    const [isMinimized, setIsMinimized] = useState(true);
    const [includeGift, setIncludeGift] = useState<{ [id: string]: boolean }>({});

    // Draggable Logic
    const [position, setPosition] = useState({ x: 0, y: 0 });
    const [isDragging, setIsDragging] = useState(false);
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

    const handleMouseDown = (e: React.MouseEvent) => {
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
            if (docSnap.exists()) setConfig(docSnap.data());
        });

        const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
            const today = TimeService.now();
            const dMD = `${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
            const todayStr = today.toISOString().split('T')[0];
            const currentYear = today.getFullYear().toString();
            const winEnd = new Date(today); winEnd.setDate(winEnd.getDate() + 30);
            const winEndStr = winEnd.toISOString().split('T')[0];
            
            const births: any[] = [];
            const exps: any[] = [];
            const pets: any[] = [];

            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'admin') return;
                
                // Birthday logic
                if (data.birthDate?.endsWith(dMD) || data.fechaNacimiento?.endsWith(dMD)) {
                    births.push({ 
                        id: d.id, ...data, 
                        isGreeted: data.lastBirthdayGreetingYear === currentYear,
                        isGifted: data.lastBirthdayPointsYear === currentYear
                    });
                }
                
                // Expirations
                const pts = Number(data.points ?? data.puntos ?? 0);
                if (data.nextExpirationDate && data.nextExpirationDate > todayStr && data.nextExpirationDate <= winEndStr && pts > 0) {
                    if (!data.lastWhatsAppManualDate || data.lastWhatsAppManualDate < todayStr) {
                        exps.push({ id: d.id, ...data, points: pts });
                    }
                }
                
                // Pets
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
            // Solo acreditar si la config general de regalos está prendida
            const wantGift = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);
            if (wantGift && !alreadyPaid && config.enableBirthdayBonus) {
                const ok = await BirthdayService.giveBirthdayPoints(user.id, user, config);
                if (!ok) { toast.error("Error al acreditar puntos"); return; }
            }
            const res = await BirthdayService.sendBirthdayGreeting(user.id, user, config, { 
                whatsappOnly: true, 
                mode: (wantGift && config.enableBirthdayBonus) ? 'full' : 'clean' 
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
                msg = (templates.expirationWarning || "¡Hola {nombre}! 📢 Próximo vencimiento de {puntos} pts.")
                    .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio').replace(/{puntos}/g, user.points?.toString());
            } else if (type === 'pet') {
                msg = (templates.petFoodAlert || "¡Hola {nombre}! 🐾 Reposición de {mascota}.")
                    .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio').replace(/{mascota}/g, user.petName);
            }
            waLink = `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`;
        }
        if (waLink) window.open(waLink, '_blank');
    };

    const total = birthdaysOfToday.length + expiringUsers.length + petAlerts.length;
    if (total === 0) return null;

    return (
        <div className="fixed z-[9999] flex flex-col items-end gap-3 pointer-events-none transition-transform duration-75"
            style={{ bottom: '24px', right: '24px', transform: `translate(${position.x}px, ${position.y}px)` }}>
            
            {isExpanded && !isMinimized && (
                <div className="w-[420px] max-h-[600px] bg-indigo-950/95 backdrop-blur-3xl border border-white/20 rounded-[3rem] shadow-[0_50px_100px_-20px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden pointer-events-auto ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
                    <div onMouseDown={handleMouseDown} className="p-7 bg-gradient-to-r from-violet-600/60 to-indigo-600/60 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing">
                        <div className="flex items-center gap-4">
                            <div className="bg-white/10 p-2.5 rounded-2xl">
                                <Sparkles size={24} className="text-violet-100 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-base font-black text-white uppercase tracking-wider">Centro de Avisos</h4>
                                <p className="text-[11px] text-violet-200/70 font-bold uppercase tracking-widest">Rampet Fidelidad Pro</p>
                            </div>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="text-white/40 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all hover:scale-110"><ChevronDown size={28} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-7 space-y-7 custom-scrollbar text-white bg-black/5">
                        {birthdaysOfToday.length > 0 && (
                            <div className="space-y-5">
                                <h5 className="text-[11px] font-black text-violet-400 uppercase tracking-[0.2em] px-2 flex items-center gap-2">
                                    <Cake size={14} /> Cumpleaños Hoy
                                </h5>
                                {birthdaysOfToday.map(user => {
                                    const currentYear = TimeService.now().getFullYear().toString();
                                    const gifted = user.lastBirthdayPointsYear === currentYear;
                                    const bonusActive = config?.enableBirthdayBonus;
                                    const isSelected = includeGift[user.id] ?? (gifted || bonusActive);
                                    
                                    return (
                                        <div key={user.id} className="bg-white/5 p-6 rounded-[2.5rem] border border-white/10 hover:bg-white/10 transition-all hover:translate-y-[-2px] shadow-sm">
                                            <div className="flex items-start justify-between mb-5">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-lg font-black tracking-tight leading-none mb-2">{user.name || 'Socio'}</p>
                                                    <div className="flex items-center gap-2 text-[11px] font-bold text-white/40 uppercase">
                                                        <User size={12} />
                                                        <span>DNI: {user.dni || 'S/D'}</span>
                                                        <span className="opacity-30">|</span>
                                                        <span>ID: {user.socioNumber || 'N/A'}</span>
                                                    </div>
                                                </div>
                                                {bonusActive && (
                                                    <input type="checkbox" disabled={gifted} checked={isSelected} 
                                                        onChange={(e) => setIncludeGift(prev => ({ ...prev, [user.id]: e.target.checked }))} 
                                                        className="w-7 h-7 rounded-xl border-white/10 bg-black/40 text-violet-500 cursor-pointer focus:ring-0 focus:ring-offset-0" />
                                                )}
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mb-5">
                                                {gifted ? (
                                                    <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-green-500/20 text-green-400 rounded-xl border border-green-500/30">REGALO ENVIADO ✅</span>
                                                ) : (
                                                    bonusActive && <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">REGALO PENDIENTE 🎁</span>
                                                )}
                                                {!bonusActive && <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-indigo-500/20 text-indigo-300 rounded-xl border border-indigo-500/30">GREETING ONLY ✉️</span>}
                                            </div>

                                            <button onClick={() => openWhatsApp(user, 'birthday')} className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[12px] font-black py-4 rounded-[1.5rem] flex items-center justify-center gap-3 shadow-xl hover:brightness-110 active:scale-95 transition-all">
                                                <MessageCircle size={20} /> {(!gifted && bonusActive && isSelected) ? 'ACREDITAR + SALUDAR' : 'ENVIAR SALUDO'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {(expiringUsers.length > 0 || petAlerts.length > 0) && (
                            <div className="space-y-4">
                                <h5 className="text-[10px] font-black text-violet-300 uppercase tracking-widest px-2">⚠️ Otros Avisos</h5>
                                {[...expiringUsers, ...petAlerts].map((item, idx) => (
                                    <div key={idx} className="bg-white/5 p-5 rounded-[2rem] border border-white/10 flex items-center justify-between gap-4">
                                        <div className="flex-1 min-w-0">
                                            <p className="text-sm font-bold truncate">{item.name || item.petName}</p>
                                            <p className="text-[10px] text-white/50">{item.points ? `Vencimiento: ${item.points} pts` : `Alimento: ${item.petName}`}</p>
                                        </div>
                                        <button onClick={() => openWhatsApp(item, item.points ? 'expiration' : 'pet')} className="bg-white/10 p-3 rounded-2xl text-white hover:bg-white/20"><MessageCircle size={20} /></button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(!isExpanded || isMinimized) && (
                <button onMouseDown={handleMouseDown}
                    onClick={() => { setIsMinimized(false); setIsExpanded(true); }}
                    className="w-16 h-16 bg-gradient-to-tr from-violet-600 to-indigo-700 rounded-full shadow-2xl flex items-center justify-center text-white border-2 border-white/30 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative cursor-grab active:cursor-grabbing">
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[10px] font-black min-w-[24px] h-6 px-1 rounded-full flex items-center justify-center border-2 border-white shadow-lg animate-pulse">{total}</div>
                    <Bell size={24} />
                </button>
            )}
        </div>
    );
};
