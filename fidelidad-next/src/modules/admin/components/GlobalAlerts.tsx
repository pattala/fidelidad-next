import { useState, useEffect } from 'react';
import { collection, query, onSnapshot, doc, setDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { ChevronDown, Sparkles, Bell, EyeOff, X } from 'lucide-react';
import toast from 'react-hot-toast';

export const GlobalAlerts = () => {
    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);
    const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
    const [petAlerts, setPetAlerts] = useState<any[]>([]);
    const [processedAlerts, setProcessedAlerts] = useState<any>({});
    const [config, setConfig] = useState<any>(null);
    
    const [activeTab, setActiveTab] = useState<'pending' | 'processed'>('pending');
    const [isExpanded, setIsExpanded] = useState(false);
    
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
        // Cargar configuración inicial
        const unsubConfig = onSnapshot(doc(db, 'config', 'general'), (snap) => {
            if (snap.exists()) setConfig(snap.data());
        });
        return () => unsubConfig();
    }, []);

    useEffect(() => {
        let unsubs: (() => void)[] = [];

        const refreshAlerts = () => {
            // Limpiar listeners anteriores
            unsubs.forEach(u => u());
            unsubs = [];

            const effectiveDate = TimeService.now();
            const todayStr = effectiveDate.toISOString().split('T')[0];
            const curY = effectiveDate.getFullYear().toString();
            const dM = String(effectiveDate.getMonth() + 1).padStart(2, '0');
            const dD = String(effectiveDate.getDate()).padStart(2, '0');
            const dMD = `${dM}-${dD}`;
            
            const leadDays = Number(config?.messaging?.expirationWarningDays || 7);
            const winEnd = new Date(effectiveDate);
            winEnd.setDate(winEnd.getDate() + leadDays);
            const winEndStr = winEnd.toISOString().split('T')[0];

            // 1. Listener de Alertas Procesadas
            const unsubProcessed = onSnapshot(doc(db, 'audit_logs', `daily_alerts_${todayStr}`), (snap) => {
                if (snap.exists()) setProcessedAlerts(snap.data().actions || {});
                else setProcessedAlerts({});
            });
            unsubs.push(unsubProcessed);

            // 2. Listener de Usuarios (Alertas dinámicas)
            const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
                const births: any[] = [];
                const exps: any[] = [];
                const pets: any[] = [];

                snap.forEach(d => {
                    const data = d.data();
                    if (data.role === 'admin') return;
                    
                    const bId = `birthday-${data.socioNumber || data.dni || data.id || d.id}-${curY}`;
                    const eId = `expiration-${data.socioNumber || data.phone || data.telefono}-${data.nextExpirationDate || 'today'}-${data.points || 0}`;
                    
                    const userBD = data.birthDate || data.fechaNacimiento;
                    if (userBD && userBD.endsWith(dMD)) {
                        births.push({ ...data, alertId: bId, id: d.id });
                    }
                    
                    if (data.nextExpirationDate && data.nextExpirationDate >= todayStr && data.nextExpirationDate <= winEndStr) {
                        if ((data.points || 0) > 0) {
                            exps.push({ ...data, alertId: eId, id: d.id });
                        }
                    }
                    
                    if (data.pets) {
                        data.pets.forEach((p: any) => {
                            const pId = `pet-${data.socioNumber || data.phone || data.telefono}-${p.name}-${p.lastFoodAlertDate || 'today'}-${data.points || 0}`;
                            if (p.nextFoodAlertDate === todayStr) {
                                pets.push({ ...data, petName: p.name, alertId: pId, id: d.id });
                            }
                        });
                    }
                });
                setBirthdaysOfToday(births);
                setExpiringUsers(exps);
                setPetAlerts(pets);
            });
            unsubs.push(unsubUsers);
        };

        refreshAlerts();
        
        // Listen for simulation changes to refresh everything
        const handleSimChange = () => refreshAlerts();
        window.addEventListener('time-simulation-change', handleSimChange);

        return () => {
            unsubs.forEach(u => u());
            window.removeEventListener('time-simulation-change', handleSimChange);
        };
    }, [config]);

    const handleAction = async (item: any, type: string, action: 'sent' | 'dismissed') => {
        const todayStr = TimeService.now().toISOString().split('T')[0];
        const alertId = item.alertId;

        const logRef = doc(db, 'audit_logs', `daily_alerts_${todayStr}`);
        const currentActions = { ...processedAlerts, [alertId]: action };
        
        try {
            await setDoc(logRef, { actions: currentActions, lastUpdate: new Date() }, { merge: true });
            
            if (action === 'sent') {
                const phone = (item.phone || item.telefono || '').replace(/\D/g, '');
                let p = phone;
                if (!p.startsWith('54') && p.length === 10) p = '549' + p;
                
                let msg = "";
                const firstName = item.name?.split(' ')[0];
                const socioInfo = item.socioNumber ? ` (Socio #${item.socioNumber})` : "";
                
                if (type === 'birthday') {
                    msg = `¡Feliz cumple ${firstName}${socioInfo}! 🎂 Te regalamos puntos. ✨`;
                } else if (type === 'expiration') {
                    msg = `¡Hola ${firstName}${socioInfo}! 📢 Tus puntos (${item.points} pts) vencen pronto.`;
                } else {
                    msg = `¡Hola ${firstName}${socioInfo}! 🐾 Recordatorio de alimento para ${item.petName}.`;
                }
                window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`, '_blank');
            }
        } catch (e) {
            toast.error("Error al sincronizar");
        }
    };

    const deleteProcessed = async (alertId: string) => {
        const todayStr = TimeService.now().toISOString().split('T')[0];
        const newActions = { ...processedAlerts };
        delete newActions[alertId];
        const logRef = doc(db, 'audit_logs', `daily_alerts_${todayStr}`);
        await setDoc(logRef, { actions: newActions }, { merge: true });
    };

    const pendingB = birthdaysOfToday.filter(u => !processedAlerts[u.alertId]);
    const pendingE = expiringUsers.filter(u => !processedAlerts[u.alertId]);
    const pendingP = petAlerts.filter(u => !processedAlerts[u.alertId]);

    const procB = birthdaysOfToday.filter(u => processedAlerts[u.alertId]);
    const procE = expiringUsers.filter(u => processedAlerts[u.alertId]);
    const procP = petAlerts.filter(u => processedAlerts[u.alertId]);

    const totalPending = pendingB.length + pendingE.length + pendingP.length;
    const totalDiscarded = Object.values(processedAlerts).filter(v => v === 'dismissed').length;

    if (totalPending === 0 && Object.keys(processedAlerts).length === 0) return null;

    return (
        <div className="fixed z-[9999] flex flex-col items-end pointer-events-none transition-transform"
            style={{ bottom: '30px', right: '30px', transform: `translate(${position.x}px, ${position.y}px)` }}>
            
            {isExpanded && (
                <div className="w-[390px] bg-[#0c051a]/95 backdrop-blur-3xl border border-white/10 rounded-[45px] shadow-[0_50px_120px_rgba(0,0,0,0.9)] overflow-hidden pointer-events-auto animate-in zoom-in-95 duration-300 flex flex-col">
                    <div onMouseDown={handleMouseDown} className="p-6 cursor-grab active:cursor-grabbing border-b border-white/5 flex items-center justify-between bg-gradient-to-r from-indigo-600/30 to-transparent">
                        <div className="flex items-center gap-3">
                            <Sparkles className="text-violet-400" size={20} />
                            <div>
                                <span className="block text-[12px] font-black uppercase tracking-wider text-white">Gestión de Alertas</span>
                                <span className="text-[9px] text-violet-300/60 font-bold uppercase tracking-widest">Dashboard Sync</span>
                            </div>
                        </div>
                        <button onClick={() => setIsExpanded(false)} className="text-white/40 hover:text-white"><ChevronDown size={24}/></button>
                    </div>

                    <div className="flex bg-black/40 p-1 mx-4 mt-4 rounded-2xl border border-white/5">
                        <button onClick={() => setActiveTab('pending')} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'pending' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>
                            PENDIENTES ({totalPending})
                        </button>
                        <button onClick={() => setActiveTab('processed')} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'processed' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>
                            PROCESADOS
                        </button>
                    </div>

                    <div className="p-6 max-h-[480px] overflow-y-auto space-y-4 custom-scrollbar">
                        {activeTab === 'pending' ? (
                            <>
                                {pendingB.map(u => <AlertCard key={u.alertId} item={u} type="birthday" onAction={handleAction} status="pending" />)}
                                {pendingE.map(u => <AlertCard key={u.alertId} item={u} type="expiration" onAction={handleAction} status="pending" />)}
                                {pendingP.map(u => <AlertCard key={u.alertId} item={u} type="pet" onAction={handleAction} status="pending" />)}
                                {totalPending === 0 && <div className="text-center py-10 opacity-30 text-xs font-bold">✨ ¡Todo al día!</div>}
                            </>
                        ) : (
                            <>
                                {procB.map(u => <AlertCard key={u.alertId} item={u} type="birthday" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}
                                {procE.map(u => <AlertCard key={u.alertId} item={u} type="expiration" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}
                                {procP.map(u => <AlertCard key={u.alertId} item={u} type="pet" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}
                                {Object.keys(processedAlerts).length === 0 && <div className="text-center py-10 opacity-30 text-xs font-bold">Vacío</div>}
                            </>
                        )}
                    </div>
                </div>
            )}

            {!isExpanded && (
                <button onMouseDown={handleMouseDown}
                    onClick={() => setIsExpanded(true)}
                    className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-700 rounded-full shadow-[0_20px_60px_rgba(99,102,241,0.6)] flex items-center justify-center text-white border-4 border-white/20 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative cursor-grab active:cursor-grabbing">
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[11px] font-black px-3 py-1 rounded-full border-2 border-white shadow-lg">
                        {totalPending} / {totalDiscarded}
                    </div>
                    <Bell size={32} />
                </button>
            )}
        </div>
    );
};

const AlertCard = ({ item, type, onAction, onDelete, status }: any) => {
    const isPending = status === 'pending';
    const isSent = status === 'sent';
    const isDismissed = status === 'dismissed';

    return (
        <div className={`bg-white/[0.03] p-5 rounded-[30px] border border-white/10 flex flex-col gap-4 relative group transition-all ${!isPending ? 'opacity-60 grayscale-[0.5]' : ''}`}>
            {isPending ? (
                <button onClick={() => onAction(item, type, 'dismissed')} className="absolute top-4 right-4 text-white/20 hover:text-red-400 p-1.5"><X size={16}/></button>
            ) : (
                <button onClick={() => onDelete(item.alertId)} className="absolute top-4 right-4 text-white/20 hover:text-white p-1.5"><EyeOff size={16}/></button>
            )}
            
            <div className="flex justify-between items-start">
                <div>
                    <h5 className="font-bold text-white text-[15px] flex items-center gap-2">
                        {item.name} <span className="text-[10px] text-white/30 font-bold tracking-tighter">#{item.socioNumber || 'S/N'}</span>
                        {isSent && <span className="text-[#25D366] text-xs font-black drop-shadow-[0_0_2px_rgba(37,211,102,0.5)]">✓✓</span>}
                        {isDismissed && <span className="text-red-500 text-xs font-black">✓</span>}
                    </h5>
                    <p className="text-[9px] text-white/40 font-bold uppercase tracking-wider mt-1">
                        {type === 'pet' ? `🐾 ${item.petName}` : type === 'expiration' ? `⏳ ${item.points} pts` : '🎂 Cumpleaños'}
                    </p>
                </div>
            </div>

            <button onClick={() => onAction(item, type, 'sent')} className={`py-3 rounded-2xl text-[10px] font-black transition-all ${isPending ? 'bg-white text-black hover:scale-[1.02]' : 'bg-white/5 text-white/40'}`}>
                {isPending ? '📳 ENVIAR WHATSAPP' : '🔄 RE-ENVIAR'}
            </button>
        </div>
    );
};
