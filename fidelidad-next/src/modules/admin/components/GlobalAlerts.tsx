import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { Cake, ChevronDown, MessageCircle, Sparkles, Bell, User, CheckCircle2 } from 'lucide-react';
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
    const [sendWA, setSendWA] = useState<{ [id: string]: boolean }>({});

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
            
            // Simulación de Fecha para el Dashboard
            let effectiveDate = today;
            if (config?.enableDateSimulator && config?.simulatedOffsetDays) {
                effectiveDate = new Date(today);
                effectiveDate.setDate(effectiveDate.getDate() + config.simulatedOffsetDays);
            }

            const dMD = `${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`;
            const todayStr = effectiveDate.toISOString().split('T')[0];
            const currentYear = effectiveDate.getFullYear().toString();
            const winEnd = new Date(effectiveDate); winEnd.setDate(winEnd.getDate() + 30);
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
    }, [config]);

    const openWhatsApp = async (user: any, type: 'birthday' | 'expiration' | 'pet') => {
        if (!config) return;
        const shouldSend = sendWA[user.id] ?? true;
        
        let waLink = '';
        if (type === 'birthday') {
            const currentYear = TimeService.now().getFullYear().toString();
            const alreadyPaid = user.lastBirthdayPointsYear === currentYear;
            const wantGift = includeGift[user.id] ?? (alreadyPaid || config.enableBirthdayBonus);
            
            if (wantGift && !alreadyPaid && config.enableBirthdayBonus) {
                const ok = await BirthdayService.giveBirthdayPoints(user.id, user, config);
                if (!ok) { toast.error("Error al acreditar puntos"); return; }
                toast.success("Regalo acreditado");
            }
            
            if (shouldSend) {
                const res = await BirthdayService.sendBirthdayGreeting(user.id, user, config, { 
                    whatsappOnly: true, 
                    mode: (wantGift && config.enableBirthdayBonus) ? 'full' : 'clean' 
                });
                waLink = res.whatsappLink || '';
            } else {
                toast.success("Procesado sin mensaje");
            }
        } else {
            if (shouldSend) {
                const phone = user.phone || user.telefono;
                if (!phone) return;
                let p = phone.replace(/\D/g, '');
                if (!p.startsWith('54') && p.length === 10) p = '549' + p;
                const templates = config?.messaging?.templates || {};
                let msg = '';
                if (type === 'expiration') {
                    const breakdown = user.breakdown || [];
                    if (breakdown.length > 1) {
                        const listStr = breakdown.map((b: any) => `\n• ${b.date}: ${b.rem} pts`).join('');
                        msg = `¡Hola {nombre}! 📢 Tus puntos vencen próximamente:${listStr}\n\n🔥 Total a vencer: ${user.points} pts.`
                            .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio');
                    } else {
                        msg = (templates.expirationWarning || "¡Hola {nombre}! 📢 Próximo vencimiento de {puntos} pts.")
                            .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio').replace(/{puntos}/g, user.points?.toString());
                    }
                } else if (type === 'pet') {
                    msg = (templates.petFoodAlert || "¡Hola {nombre}! 🐾 Reposición de {mascota}.")
                        .replace(/{nombre}/g, user.name?.split(' ')[0] || 'Socio').replace(/{mascota}/g, user.petName);
                }
                waLink = `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`;
            } else {
                toast.success("Aviso descartado");
            }
        }
        
        if (waLink && shouldSend) {
            window.open(waLink, '_blank');
        }
    };

    const total = birthdaysOfToday.length + expiringUsers.length + petAlerts.length;
    if (total === 0) return null;

    return (
        <div className="fixed z-[9999] flex flex-col items-end gap-3 pointer-events-none transition-transform duration-75"
            style={{ bottom: '24px', right: '24px', transform: `translate(${position.x}px, ${position.y}px)` }}>
            
            {isExpanded && !isMinimized && (
                <div className="w-[440px] max-h-[620px] bg-indigo-950/98 backdrop-blur-3xl border border-white/20 rounded-[3rem] shadow-[0_50px_120px_-20px_rgba(0,0,0,1)] flex flex-col overflow-hidden pointer-events-auto ring-1 ring-white/10 animate-in zoom-in-95 duration-200">
                    <div onMouseDown={handleMouseDown} className="p-8 bg-gradient-to-r from-violet-600/70 to-indigo-600/70 border-b border-white/10 flex items-center justify-between cursor-grab active:cursor-grabbing">
                        <div className="flex items-center gap-5">
                            <div className="bg-white/20 p-3 rounded-2xl shadow-inner">
                                <Sparkles size={26} className="text-violet-100 animate-pulse" />
                            </div>
                            <div>
                                <h4 className="text-lg font-black text-white uppercase tracking-wider">Centro de Avisos</h4>
                                <p className="text-[12px] text-violet-100/70 font-bold uppercase tracking-widest">Inteligencia Rampet</p>
                            </div>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="text-white/40 hover:text-white p-2 hover:bg-white/10 rounded-full transition-all hover:scale-110"><ChevronDown size={32} /></button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-8 space-y-8 custom-scrollbar text-white">
                        {birthdaysOfToday.length > 0 && (
                            <div className="space-y-6">
                                <h5 className="text-[12px] font-black text-violet-400 uppercase tracking-[0.3em] px-2 flex items-center gap-3">
                                    <Cake size={16} /> Cumpleaños del Día
                                </h5>
                                {birthdaysOfToday.map(user => {
                                    const today = TimeService.now();
                                    let effectiveDate = today;
                                    if (config?.enableDateSimulator && config?.simulatedOffsetDays) {
                                        effectiveDate = new Date(today);
                                        effectiveDate.setDate(effectiveDate.getDate() + config.simulatedOffsetDays);
                                    }
                                    const currentYear = effectiveDate.getFullYear().toString();
                                    const gifted = user.lastBirthdayPointsYear === currentYear;
                                    const bonusActive = config?.enableBirthdayBonus;
                                    const isSelected = includeGift[user.id] ?? (gifted || bonusActive);
                                    const isWAActive = sendWA[user.id] ?? true;
                                    
                                    return (
                                        <div key={user.id} className="bg-white/5 p-7 rounded-[3rem] border border-white/10 hover:bg-white/10 transition-all shadow-xl">
                                            <div className="flex items-start justify-between mb-6">
                                                <div className="flex-1">
                                                    <p className="text-xl font-black tracking-tight leading-none mb-3">{user.name || 'Socio'}</p>
                                                    <div className="flex items-center gap-3 text-[11px] font-bold text-white/40 uppercase tracking-tighter">
                                                        <User size={13} />
                                                        <span>DNI: {user.dni || 'S/D'}</span>
                                                        <span className="opacity-20">|</span>
                                                        <span>SOCIO: {user.socioNumber || 'N/A'}</span>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="grid grid-cols-2 gap-4 mb-6">
                                                <label className="flex items-center gap-3 bg-black/30 p-3 rounded-2xl border border-white/5 cursor-pointer hover:bg-black/50 transition-colors">
                                                    <input type="checkbox" disabled={gifted || bonusActive} checked={isSelected} 
                                                        onChange={(e) => setIncludeGift(prev => ({ ...prev, [user.id]: e.target.checked }))} 
                                                        className="w-6 h-6 rounded-lg text-violet-500 focus:ring-0 bg-transparent border-white/20" />
                                                    <div className="leading-none">
                                                        <p className="text-[10px] font-black uppercase text-violet-300">Regalo</p>
                                                        <p className="text-[9px] text-white/40">{bonusActive ? 'AUTO' : 'MANUAL'}</p>
                                                    </div>
                                                </label>
                                                <label className="flex items-center gap-3 bg-black/30 p-3 rounded-2xl border border-white/5 cursor-pointer hover:bg-black/50 transition-colors">
                                                    <input type="checkbox" checked={isWAActive} 
                                                        onChange={(e) => setSendWA(prev => ({ ...prev, [user.id]: e.target.checked }))} 
                                                        className="w-6 h-6 rounded-lg text-green-500 focus:ring-0 bg-transparent border-white/20" />
                                                    <div className="leading-none">
                                                        <p className="text-[10px] font-black uppercase text-green-400">WhatsApp</p>
                                                        <p className="text-[9px] text-white/40">{isWAActive ? 'ENVIAR' : 'NO ENVIAR'}</p>
                                                    </div>
                                                </label>
                                            </div>
                                            
                                            <div className="flex flex-wrap gap-2 mb-6">
                                                {gifted ? (
                                                    <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-green-500/20 text-green-400 rounded-xl border border-green-500/30 flex items-center gap-1"><CheckCircle2 size={12}/> YA ACREDITADO</span>
                                                ) : (
                                                    isSelected && <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-orange-500/20 text-orange-400 rounded-xl border border-orange-500/30">🎁 SUMAR REGALO</span>
                                                )}
                                                {!isSelected && !gifted && <span className="text-[10px] font-black uppercase px-3 py-1.5 bg-gray-500/20 text-gray-400 rounded-xl border border-gray-500/30">✉️ SOLO SALUDO</span>}
                                            </div>

                                            <button onClick={() => openWhatsApp(user, 'birthday')} className="w-full bg-gradient-to-r from-[#25D366] to-[#128C7E] text-white text-[13px] font-black py-4.5 rounded-[1.8rem] flex items-center justify-center gap-3 shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                                {isWAActive ? <MessageCircle size={22} /> : <CheckCircle2 size={22} />} 
                                                {(!gifted && bonusActive && isSelected) ? 'PROCESAR ACREDITACIÓN' : (isWAActive ? 'ENVIAR MENSAJE' : 'MARCAR COMO VISTO')}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                        {(expiringUsers.length > 0 || petAlerts.length > 0) && (
                            <div className="space-y-6">
                                <h5 className="text-[12px] font-black text-violet-400 uppercase tracking-[0.3em] px-2 flex items-center gap-3">
                                    <Sparkles size={16} /> Otros Avisos
                                </h5>
                                {[...expiringUsers, ...petAlerts].map((item, idx) => {
                                    const isWAActive = sendWA[item.id] ?? true;
                                    return (
                                        <div key={idx} className="bg-white/5 p-7 rounded-[3rem] border border-white/10 flex flex-col gap-5">
                                            <div className="flex items-center justify-between gap-4">
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-base font-black truncate">{item.name || item.petName}</p>
                                                    <p className="text-[11px] font-bold text-violet-300 mt-1 uppercase opacity-80">{item.points ? `⏳ ${item.points} pts por vencer` : `🐾 Alimento: ${item.petName}`}</p>
                                                </div>
                                                <label className="flex items-center gap-2 cursor-pointer">
                                                    <input type="checkbox" checked={isWAActive} 
                                                        onChange={(e) => setSendWA(prev => ({ ...prev, [item.id]: e.target.checked }))} 
                                                        className="w-5 h-5 rounded-md text-green-500 focus:ring-0 bg-transparent border-white/20" />
                                                    <MessageCircle size={18} className={isWAActive ? 'text-green-400' : 'text-white/20'} />
                                                </label>
                                            </div>
                                            <button onClick={() => openWhatsApp(item, item.points ? 'expiration' : 'pet')} className="w-full bg-white/10 hover:bg-white/20 p-4 rounded-2xl text-[12px] font-black transition-all flex items-center justify-center gap-2">
                                                {isWAActive ? 'ENVIAR WHATSAPP' : 'MARCAR COMO GESTIONADO'}
                                            </button>
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {(!isExpanded || isMinimized) && (
                <button onMouseDown={handleMouseDown}
                    onClick={() => { setIsMinimized(false); setIsExpanded(true); }}
                    className="w-18 h-18 bg-gradient-to-tr from-violet-600 to-indigo-700 rounded-full shadow-2xl flex items-center justify-center text-white border-2 border-white/40 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative cursor-grab active:cursor-grabbing">
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[12px] font-black min-w-[28px] h-7 px-1.5 rounded-full flex items-center justify-center border-2 border-white shadow-xl animate-bounce">{total}</div>
                    <Bell size={28} />
                </button>
            )}
        </div>
    );
};
