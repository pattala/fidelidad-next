import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { Cake, ChevronDown, MessageCircle, Sparkles, Bell, Gift, EyeOff, Calendar, X } from 'lucide-react';
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
    const [shouldNotify, setShouldNotify] = useState<{ [id: string]: boolean }>({});
    const [dismissedItems, setDismissedItems] = useState<{ [id: string]: boolean }>({});

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
            if (!config) return;

            const effectiveDate = TimeService.now();

            // Formato robusto para evitar errores de zona horaria
            const dY = effectiveDate.getFullYear();
            const dM = String(effectiveDate.getMonth() + 1).padStart(2, '0');
            const dD = String(effectiveDate.getDate()).padStart(2, '0');
            const dMD = `${dM}-${dD}`;
            const todayStr = `${dY}-${dM}-${dD}`;
            
            // Ventana de aviso según configuración (V.1.2.4)
            const leadDays = Number(config?.messaging?.expirationWarningDays || 7);
            const winEnd = new Date(effectiveDate);
            winEnd.setDate(winEnd.getDate() + leadDays);
            const winEndStr = `${winEnd.getFullYear()}-${String(winEnd.getMonth() + 1).padStart(2, '0')}-${String(winEnd.getDate()).padStart(2, '0')}`;
            
            const births: any[] = [];
            const exps: any[] = [];
            const pets: any[] = [];

            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'admin') return;
                
                // BIRTHDAYS
                const userBD = data.birthDate || data.fechaNacimiento;
                if (userBD && userBD.endsWith(dMD)) {
                    births.push({ id: d.id, ...data });
                }
                
                // EXPIRATIONS (Ventana de aviso)
                if (data.nextExpirationDate && data.nextExpirationDate >= todayStr && data.nextExpirationDate <= winEndStr) {
                    // Solo si tiene puntos y no se notificó hoy real
                    if ((data.points || 0) > 0) {
                        let processedExpirations = [];
                        if (data.expirationDetails && Array.isArray(data.expirationDetails)) {
                            processedExpirations = data.expirationDetails.map((e: any) => ({
                                date: e.date?.toDate ? e.date.toDate() : new Date(e.date),
                                points: e.points
                            }));
                        }
                        exps.push({ 
                            id: d.id, 
                            ...data, 
                            expirationDetails: processedExpirations.sort((a:any, b:any) => a.date.getTime() - b.date.getTime()) 
                        });
                    }
                }
                
                // PETS
                if (data.pets) {
                    data.pets.forEach((p: any) => {
                        if (p.nextFoodAlertDate === todayStr) {
                            pets.push({ id: d.id, petName: p.name, ...data });
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

    const handleAction = async (user: any, type: 'birthday' | 'expiration' | 'pet') => {
        const today = TimeService.now();
        let effectiveDate = today;
        if (config?.enableDateSimulator && config?.simulatedOffsetDays) {
            effectiveDate = new Date(today);
            effectiveDate.setDate(effectiveDate.getDate() + config.simulatedOffsetDays);
        }
        const currentYear = effectiveDate.getFullYear().toString();
        
        const notify = shouldNotify[user.id] ?? true;
        // El default de regalo ahora respeta estrictamente la config si no se eligió nada manualmente
        const gift = includeGift[user.id] ?? (config?.enableBirthdayBonus && user.lastBirthdayPointsYear !== currentYear);

        if (type === 'birthday') {
            if (gift && user.lastBirthdayPointsYear !== currentYear) {
                const ok = await BirthdayService.giveBirthdayPoints(user.id, user, config);
                if (!ok) { toast.error("Error al acreditar"); return; }
            }
            if (notify) {
                const res = await BirthdayService.sendBirthdayGreeting(user.id, user, config, { 
                    whatsappOnly: true, mode: gift ? 'full' : 'clean' 
                });
                if (res.whatsappLink) window.open(res.whatsappLink, '_blank');
            } else {
                toast.success("Procesado sin mensaje");
            }
        } else {
            if (notify) {
                const phone = (user.phone || user.telefono || '').replace(/\D/g, '');
                if (!phone) return;
                const p = phone.startsWith('54') ? phone : (phone.length === 10 ? '549' + phone : phone);
                let msg = "";
                if(type === 'expiration') {
                    // Discriminación de puntos por fecha (usando expirationDetails si existe)
                    const breakdown = user.expirationDetails || [];
                    if (breakdown.length > 0) {
                        const list = breakdown.map((b: any) => {
                            const d = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                            const dStr = `${d.getDate()}/${d.getMonth() + 1}`;
                            return `\n• ${b.points} pts el ${dStr}`;
                        }).join('');
                        msg = `¡Hola ${user.name?.split(' ')[0]}! 📢 Tenés puntos próximos a vencer:${list}\n\n🔥 Total a vencer: ${user.points} pts. ¡Aprovechalos pronto! 🎁`;
                    } else {
                        msg = `¡Hola ${user.name?.split(' ')[0]}! 📢 Tus puntos (${user.points} pts) están por vencer el ${user.nextExpirationDate?.split('-').reverse().join('/')}. ¡Aprovechalos pronto! 🎁`;
                    }
                } else {
                    msg = `¡Hola ${user.name?.split(' ')[0]}! 🐾 Avisamos que se termina el alimento de ${user.petName}.`;
                }
                window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`, '_blank');
            } else {
                toast.success("Aviso archivado");
            }
        }
        const key = type === 'pet' ? `pet-${user.id}-${user.petName}` : `${type}-${user.id}`;
        setDismissedItems(prev => ({ ...prev, [key]: true }));
    };

    const handleDismiss = (id: string, type: 'birthday' | 'expiration' | 'pet', petName?: string) => {
        const key = type === 'pet' ? `pet-${id}-${petName}` : `${type}-${id}`;
        setDismissedItems(prev => ({ ...prev, [key]: true }));
    };

    const filteredBirthdays = birthdaysOfToday.filter(u => !dismissedItems[`birthday-${u.id}`]);
    const filteredExpirations = expiringUsers.filter(u => !dismissedItems[`expiration-${u.id}`]);
    const filteredPets = petAlerts.filter(u => !dismissedItems[`pet-${u.id}-${u.petName}`]);

    const total = filteredBirthdays.length + filteredExpirations.length + filteredPets.length;
    if (total === 0) return null;

    return (
        <div className="fixed z-[9999] flex flex-col items-end pointer-events-none transition-transform"
            style={{ bottom: '30px', right: '30px', transform: `translate(${position.x}px, ${position.y}px)` }}>
            
            {isExpanded && (
                <div className="w-[390px] bg-[#0c051a]/95 backdrop-blur-3xl border border-white/10 rounded-[45px] shadow-[0_50px_120px_rgba(0,0,0,0.9)] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-300">
                    <div onMouseDown={handleMouseDown} className="p-7 cursor-grab active:cursor-grabbing border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/30 to-transparent">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-violet-400" size={24} />
                            <div>
                                <span className="block text-[13px] font-black uppercase tracking-[0.2em] text-white">Alertas Smart</span>
                                <span className="text-[9px] text-violet-300/60 font-bold uppercase tracking-widest">{config?.enableDateSimulator ? 'Modo Simulación' : 'Tiempo Real'}</span>
                            </div>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="bg-white/5 hover:bg-white/10 p-2 rounded-full transition-all"><ChevronDown size={28} className="text-white/40"/></button>
                    </div>

                    <div className="p-7 max-h-[520px] overflow-y-auto space-y-7 custom-scrollbar bg-black/20">
                        {filteredBirthdays.map(u => {
                            const bonusActive = config?.enableBirthdayBonus;
                            const isSelected = includeGift[u.id] ?? !!bonusActive; // Aquí se aplica el default configurado
                            const isMsg = shouldNotify[u.id] ?? true;
                            
                            return (
                                <div key={u.id} className="bg-white/[0.03] p-6 rounded-[35px] border border-white/10 flex flex-col gap-5 hover:bg-white/[0.06] transition-all relative group">
                                    <button 
                                        onClick={() => handleDismiss(u.id, 'birthday')} 
                                        className="absolute top-4 right-4 text-white/30 hover:text-white/80 transition-colors p-1.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 md:opacity-100"
                                        title="Descartar aviso"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="flex justify-between items-start pr-6">
                                        <div>
                                            <h5 className="font-black text-white text-lg tracking-tight">🎂 {u.name || u.nombre || 'Socio'}</h5>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-1">DNI: {u.dni} | NRO: {u.socioNumber}</p>
                                        </div>
                                        <div className="bg-violet-500/20 px-3 py-1 rounded-full border border-violet-500/20">
                                            <span className="text-[9px] font-black text-violet-300 uppercase">Cumpleaños</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3">
                                        <button onClick={() => setIncludeGift(prev => ({...prev, [u.id]: !isSelected}))} 
                                            className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black border transition-all flex items-center justify-center gap-2 ${ isSelected ? 'bg-violet-600/30 border-violet-500/40 text-violet-200' : 'bg-white/5 border-white/5 text-white/20'}`}>
                                            <Gift size={14}/> REGALO: {isSelected ? 'SÍ' : 'NO'}
                                        </button>
                                        <button onClick={() => setShouldNotify(prev => ({...prev, [u.id]: !isMsg}))} 
                                            className={`flex-1 py-3 px-4 rounded-2xl text-[10px] font-black border transition-all flex items-center justify-center gap-2 ${ isMsg ? 'bg-green-600/30 border-green-500/40 text-green-200' : 'bg-red-600/30 border-red-500/40 text-red-200'}`}>
                                            <MessageCircle size={14}/> MSG: {isMsg ? 'SÍ' : 'NO'}
                                        </button>
                                    </div>
                                    <button onClick={() => handleAction(u, 'birthday')} className="bg-white text-black font-black text-[12px] py-4.5 rounded-2xl shadow-xl hover:scale-[1.02] active:scale-95 transition-all">
                                        {isMsg ? 'ENVIAR WHATSAPP' : 'PROCESAR SIN MENSAJE'}
                                    </button>
                                </div>
                            );
                        })}

                        {filteredExpirations.map((u, i) => {
                            const isMsg = shouldNotify[u.id] ?? true;
                            return (
                                <div key={`exp-${i}`} className="bg-white/[0.03] p-6 rounded-[35px] border border-white/10 flex flex-col gap-5 relative group">
                                    <button 
                                        onClick={() => handleDismiss(u.id, 'expiration')} 
                                        className="absolute top-4 right-4 text-white/30 hover:text-white/80 transition-colors p-1.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 md:opacity-100"
                                        title="Descartar aviso"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="flex justify-between items-center pr-6">
                                        <div className="flex-1">
                                            <h5 className="font-extrabold text-white text-lg tracking-tight">{u.name || u.nombre || 'Socio'}</h5>
                                            <p className="text-[10px] text-white/40 font-bold uppercase tracking-wider mt-0.5">Socio N°: {u.socioNumber || 'S/N'}</p>
                                            <p className="text-[11px] text-orange-400 font-black uppercase flex items-center gap-2 mt-1"><Calendar size={12}/> Vence: {u.nextExpirationDate?.split('-').reverse().join('/')}</p>
                                        </div>
                                        <button onClick={() => setShouldNotify(prev => ({...prev, [u.id]: !isMsg}))} 
                                            className={`p-3 rounded-2xl transition-all ${ isMsg ? 'text-green-400 bg-green-400/10 border border-green-400/20' : 'text-red-400 bg-red-400/10 border border-red-400/20'}`}>
                                            { isMsg ? <MessageCircle size={20}/> : <EyeOff size={20}/>}
                                        </button>
                                    </div>
                                    <div className="bg-black/20 p-4 rounded-2xl border border-white/5">
                                        <p className="text-[11px] font-black text-white/90">⚠️ {u.points} puntos por expirar</p>
                                        {u.expirationDetails && u.expirationDetails.length > 0 && (
                                            <div className="mt-2 space-y-1 opacity-50">
                                                {u.expirationDetails.map((b: any, idx: number) => {
                                                    const d = b.date?.toDate ? b.date.toDate() : new Date(b.date);
                                                    const dStr = `${d.getDate()}/${d.getMonth() + 1}`;
                                                    return (
                                                        <p key={idx} className="text-[9px] font-bold">• {dStr}: {b.points} pts</p>
                                                    );
                                                })}
                                            </div>
                                        )}
                                    </div>
                                    <button onClick={() => handleAction(u, 'expiration')} className="bg-white/10 text-white font-black text-[12px] py-3.5 rounded-2xl hover:bg-white/20 transition-all">
                                        {isMsg ? 'ENVIAR AVISO' : 'ARCHIVAR AVISO'}
                                    </button>
                                </div>
                            );
                        })}

                        {filteredPets.map((u, i) => {
                            const isMsg = shouldNotify[u.id] ?? true;
                            return (
                                <div key={`pet-${i}`} className="bg-white/[0.03] p-6 rounded-[35px] border border-white/10 flex flex-col gap-5 relative group">
                                    <button 
                                        onClick={() => handleDismiss(u.id, 'pet', u.petName)} 
                                        className="absolute top-4 right-4 text-white/30 hover:text-white/80 transition-colors p-1.5 rounded-full hover:bg-white/10 opacity-0 group-hover:opacity-100 md:opacity-100"
                                        title="Descartar aviso"
                                    >
                                        <X size={14} />
                                    </button>
                                    <div className="flex justify-between items-center pr-6">
                                        <div className="flex-1">
                                            <h5 className="font-extrabold text-white text-lg tracking-tight">{u.name || u.nombre || 'Socio'}</h5>
                                            <p className="text-[11px] text-indigo-400 font-black uppercase mt-1">🐾 Alimento: {u.petName}</p>
                                        </div>
                                        <button onClick={() => setShouldNotify(prev => ({...prev, [u.id]: !isMsg}))} 
                                            className={`p-3 rounded-2xl transition-all ${ isMsg ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                                            { isMsg ? <MessageCircle size={20}/> : <EyeOff size={20}/>}
                                        </button>
                                    </div>
                                    <button onClick={() => handleAction(u, 'pet')} className="bg-indigo-500/20 text-indigo-200 font-black text-[12px] py-3.5 rounded-2xl border border-indigo-500/20 hover:bg-indigo-500/30 transition-all">
                                        {isMsg ? 'AVISAR AL CLIENTE' : 'DESCARTAR AVISO'}
                                    </button>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {!isExpanded && (
                <button onMouseDown={handleMouseDown}
                    onClick={() => setIsExpanded(true)}
                    className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-700 rounded-full shadow-[0_20px_60px_rgba(99,102,241,0.6)] flex items-center justify-center text-white border-4 border-white/20 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative cursor-grab active:cursor-grabbing">
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[13px] font-black w-8 h-8 rounded-full flex items-center justify-center border-2 border-white shadow-lg">{total}</div>
                    <Bell size={32} />
                </button>
            )}
        </div>
    );
};
