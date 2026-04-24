import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { Cake, ChevronDown, MessageCircle, Sparkles, Bell, Gift, EyeOff } from 'lucide-react';
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
            let effectiveDate = today;
            if (config?.enableDateSimulator && config?.simulatedOffsetDays) {
                effectiveDate = new Date(today);
                effectiveDate.setDate(effectiveDate.getDate() + config.simulatedOffsetDays);
            }

            const dMD = `${String(effectiveDate.getMonth() + 1).padStart(2, '0')}-${String(effectiveDate.getDate()).padStart(2, '0')}`;
            const todayStr = effectiveDate.toISOString().split('T')[0];
            const currentYear = effectiveDate.getFullYear().toString();
            
            const births: any[] = [];
            const exps: any[] = [];
            const pets: any[] = [];

            snap.forEach(d => {
                const data = d.data();
                if (data.role === 'admin') return;
                
                // BIRTHDAYS: Matches Date (Ignore if already processed is NOT what we want for simulation clarity)
                const userBD = data.birthDate || data.fechaNacimiento;
                if (userBD && userBD.endsWith(dMD)) {
                    births.push({ id: d.id, ...data });
                }
                
                // EXPIRATIONS
                if (data.nextExpirationDate && data.nextExpirationDate === todayStr) {
                    exps.push({ id: d.id, ...data });
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
        const currentYear = TimeService.now().getFullYear().toString();
        const notify = shouldNotify[user.id] ?? true;
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
                    const list = user.breakdown ? user.breakdown.map((b:any)=>`\n• ${b.date}: ${b.rem} pts`).join('') : '';
                    msg = `¡Hola ${user.name?.split(' ')[0]}! 📢 Vencimientos próximos:${list}\n\n🔥 Total: ${user.points} pts.`;
                } else {
                    msg = `¡Hola ${user.name?.split(' ')[0]}! 🐾 Avisamos que se termina el alimento de ${user.petName}.`;
                }
                window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`, '_blank');
            } else {
                toast.success("Aviso archivado");
            }
        }
    };

    const total = birthdaysOfToday.length + expiringUsers.length + petAlerts.length;
    if (total === 0) return null;

    return (
        <div className="fixed z-[9999] flex flex-col items-end pointer-events-none transition-transform"
            style={{ bottom: '30px', right: '30px', transform: `translate(${position.x}px, ${position.y}px)` }}>
            
            {isExpanded && (
                <div className="w-[380px] bg-[#1a0b36]/90 backdrop-blur-2xl border border-white/10 rounded-[40px] shadow-[0_40px_100px_rgba(0,0,0,0.8)] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-200">
                    {/* Header Arrastrable */}
                    <div onMouseDown={handleMouseDown} className="p-6 cursor-grab active:cursor-grabbing border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-violet-600/20 to-transparent">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-violet-400" size={20} />
                            <span className="text-[12px] font-black uppercase tracking-widest text-white/80">Avisos del Día</span>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="text-white/20 hover:text-white transition-colors"><ChevronDown size={24}/></button>
                    </div>

                    <div className="p-6 max-h-[500px] overflow-y-auto space-y-6 scroll-smooth custom-scrollbar">
                        {birthdaysOfToday.map(u => (
                            <div key={u.id} className="bg-white/5 p-5 rounded-[28px] border border-white/10 flex flex-col gap-4">
                                <div>
                                    <h5 className="font-bold text-white flex items-center gap-2">🎂 {u.name}</h5>
                                    <p className="text-[10px] text-white/40 mt-1 uppercase font-bold tracking-tighter">DNI: {u.dni} | NRO: {u.socioNumber}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={() => setIncludeGift(prev => ({...prev, [u.id]: !(includeGift[u.id] ?? !!config?.enableBirthdayBonus)}))} 
                                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-2 ${ (includeGift[u.id]??true) ? 'bg-violet-500/20 border-violet-500/50 text-violet-200' : 'bg-white/5 border-white/10 text-white/40'}`}>
                                        <Gift size={12}/> GIFT: {(includeGift[u.id]??true) ? 'SÍ' : 'NO'}
                                    </button>
                                    <button onClick={() => setShouldNotify(prev => ({...prev, [u.id]: !(shouldNotify[u.id] ?? true)}))} 
                                        className={`flex-1 py-2 px-3 rounded-xl text-[10px] font-black border transition-all flex items-center justify-center gap-2 ${ (shouldNotify[u.id]??true) ? 'bg-green-500/20 border-green-500/50 text-green-200' : 'bg-red-500/20 border-red-500/50 text-red-200'}`}>
                                        <MessageCircle size={12}/> MSG: {(shouldNotify[u.id]??true) ? 'SÍ' : 'NO'}
                                    </button>
                                </div>
                                <button onClick={() => handleAction(u, 'birthday')} className="bg-white text-black font-black text-[11px] py-4 rounded-2xl hover:scale-[0.98] transition-transform active:scale-90">
                                    {(shouldNotify[u.id]??true) ? 'ENVIAR WHATSAPP' : 'PROCESAR SILENCIOSAMENTE'}
                                </button>
                            </div>
                        ))}

                        {[...expiringUsers, ...petAlerts].map((u, i) => (
                            <div key={i} className="bg-white/5 p-5 rounded-[28px] border border-white/10 flex flex-col gap-4">
                                <div className="flex justify-between items-start">
                                    <div>
                                        <h5 className="font-bold text-white tracking-tight">{u.name || u.petName}</h5>
                                        <p className="text-[10px] text-violet-400 font-bold uppercase mt-1">{u.points ? `⏳ Vence: ${u.points} pts` : `🐾 Alimento: ${u.petName}`}</p>
                                    </div>
                                    <button onClick={() => setShouldNotify(prev => ({...prev, [u.id]: !(shouldNotify[u.id] ?? true)}))} 
                                        className={`p-2 rounded-xl transition-all ${ (shouldNotify[u.id]??true) ? 'text-green-400 bg-green-400/10' : 'text-red-400 bg-red-400/10'}`}>
                                        { (shouldNotify[u.id]??true) ? <MessageCircle size={18}/> : <EyeOff size={18}/>}
                                    </button>
                                </div>
                                <button onClick={() => handleAction(u, u.points ? 'expiration' : 'pet')} className="bg-white/10 text-white font-bold text-[11px] py-3 rounded-xl hover:bg-white/20 transition-colors">
                                    {(shouldNotify[u.id]??true) ? 'ENVIAR AVISO' : 'MARCAR COMO VISTO'}
                                </button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {!isExpanded && (
                <button onMouseDown={handleMouseDown}
                    onClick={() => setIsExpanded(true)}
                    className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-600 rounded-full shadow-[0_20px_50px_rgba(99,102,241,0.5)] flex items-center justify-center text-white border-4 border-white/20 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative cursor-grab active:cursor-grabbing">
                    <div className="absolute -top-1 -right-1 bg-red-500 text-white text-[12px] font-black w-7 h-7 rounded-full flex items-center justify-center border-2 border-white shadow-lg">{total}</div>
                    <Bell size={30} />
                </button>
            )}
        </div>
    );
};
