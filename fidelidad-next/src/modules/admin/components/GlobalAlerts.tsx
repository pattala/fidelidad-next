import { useState, useEffect } from 'react';
import { collection, query, where, onSnapshot, doc, setDoc, updateDoc } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import { TimeService } from '../../../services/timeService';
import { ChevronDown, Sparkles, Bell, EyeOff, X } from 'lucide-react';
import toast from 'react-hot-toast';
import QRCode from 'react-qr-code';

export const GlobalAlerts = () => {
    const effectiveDate = TimeService.now();
    const year = effectiveDate.getFullYear();
    const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
    const day = String(effectiveDate.getDate()).padStart(2, '0');
    const todayStr = `${year}-${month}-${day}`;

    const [birthdaysOfToday, setBirthdaysOfToday] = useState<any[]>([]);
    const [expiringUsers, setExpiringUsers] = useState<any[]>([]);
    const [petAlerts, setPetAlerts] = useState<any[]>([]);
    const [redemptions, setRedemptions] = useState<any[]>([]);
    const [pointsAssignments, setPointsAssignments] = useState<any[]>([]);
    const [campaignAlerts, setCampaignAlerts] = useState<any[]>([]);
    const [processedAlerts, setProcessedAlerts] = useState<any>({});
    const [config, setConfig] = useState<any>(null);
    const [activeCampaignIds, setActiveCampaignIds] = useState<Set<string>>(new Set());
    const [campaignsMap, setCampaignsMap] = useState<Map<string, any>>(new Map());
    const [timeTrigger, setTimeTrigger] = useState(0);
    const [hasLoadedCampaignIds, setHasLoadedCampaignIds] = useState(false);
    const [mysteryBoxChances, setMysteryBoxChances] = useState<any[]>([]);
    
    const [activeTab, setActiveTab] = useState<'pending' | 'processed' | 'sorteos'>(
        () => (localStorage.getItem('globalAlerts_activeTab') as 'pending' | 'processed' | 'sorteos') || 'pending'
    );
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
            unsubs.forEach(u => u());
            unsubs = [];

            const effectiveDate = TimeService.now();
            // Evitar toISOString que corre el día por UTC
            const year = effectiveDate.getFullYear();
            const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
            const day = String(effectiveDate.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;
            const curY = year.toString();
            const dMD = `${month}-${day}`;
            
            const leadDays = Number(config?.messaging?.expirationWarningDays || 7);
            const winEnd = new Date(effectiveDate);
            winEnd.setDate(winEnd.getDate() + leadDays);
            
            const winEndY = winEnd.getFullYear();
            const winEndM = String(winEnd.getMonth() + 1).padStart(2, '0');
            const winEndD = String(winEnd.getDate()).padStart(2, '0');
            const winEndStr = `${winEndY}-${winEndM}-${winEndD}`;

            const unsubProcessed = onSnapshot(doc(db, 'audit_logs', `daily_alerts_${todayStr}`), (snap) => {
                if (snap.exists()) setProcessedAlerts(snap.data().actions || {});
                else setProcessedAlerts({});
            });
            unsubs.push(unsubProcessed);

            const unsubUsers = onSnapshot(query(collection(db, 'users')), (snap) => {
                const births: any[] = [];
                const exps: any[] = [];
                const pets: any[] = [];
                const activeIds = new Set<string>();

                snap.forEach(d => {
                    const data = d.data();
                    activeIds.add(d.id);
                    if (data.role === 'admin') return;
                    
                    const userIdentifier = data.socioNumber || data.phone || data.telefono || data.dni || d.id;
                    const bId = `birthday-${userIdentifier}-${curY}`;
                    const eId = `expiration-${userIdentifier}-${data.nextExpirationDate || 'today'}`;
                    
                    const userBD = data.birthDate || data.fechaNacimiento;
                    // Ignoramos alreadyGreeted (lastBirthdayGreetingYear) para el panel administrativo
                    // para que el botón de WhatsApp manual no desaparezca solo.
                    if (userBD && userBD.endsWith(dMD)) {
                        births.push({ ...data, alertId: bId, id: d.id });
                    }
                    
                    if (data.nextExpirationDate && data.nextExpirationDate >= todayStr && data.nextExpirationDate <= winEndStr) {
                        // Ignoramos alreadyNotified (lastExpirationWarningDate) para el panel administrativo
                        if ((data.points || 0) > 0) {
                            exps.push({ ...data, alertId: eId, id: d.id });
                        }
                    }
                    
                    if (data.pets) {
                        data.pets.forEach((p: any) => {
                            const pId = `pet-${userIdentifier}-${p.name}-${p.nextFoodAlertDate || 'today'}`;
                            const lastPurchase = p.lastPurchaseDate?.toDate ? p.lastPurchaseDate.toDate() : (p.lastPurchaseDate ? new Date(p.lastPurchaseDate + 'T12:00:00') : null);
                            if (lastPurchase) {
                                const cycleDays = Number(p.foodCycleDays || p.frequencyDays || 30);
                                // Fallbacks in case config is not fully loaded here
                                const warningDays = Number(config?.messaging?.petFoodWarningDays || config?.petFoodAlertLeadDays || 3);
                                
                                const exhaustionDate = new Date(lastPurchase);
                                exhaustionDate.setDate(lastPurchase.getDate() + cycleDays);
                                
                                const alertDate = new Date(exhaustionDate);
                                alertDate.setDate(exhaustionDate.getDate() - warningDays);
                                
                                const todayDate = new Date(todayStr + 'T12:00:00');
                                const isAlertWindow = (todayDate >= alertDate && todayDate <= exhaustionDate);
                                
                                const lastWa = p.lastWhatsAppDate ? new Date(p.lastWhatsAppDate + 'T12:00:00') : null;
                                const waSent = lastWa && lastWa >= lastPurchase;

                                if (isAlertWindow && !waSent) {
                                    pets.push({ ...data, petName: p.name, foodBrand: p.foodBrand || p.brand || '', alertId: pId, id: d.id, alertType: 'food' });
                                }
                                
                                // Lógica para Piedras Sanitarias (solo gatos)
                                if ((p.type || '').toLowerCase().trim() === 'gato') {
                                    const lastLitterPurchase = p.lastLitterPurchaseDate?.toDate ? p.lastLitterPurchaseDate.toDate() : (p.lastLitterPurchaseDate ? new Date(p.lastLitterPurchaseDate + 'T12:00:00') : null);
                                    if (lastLitterPurchase) {
                                        const litterCycleDays = Number(p.litterFrequencyDays || 15);
                                        const warningDays = Number(config?.petLitterAlertLeadDays ?? config?.messaging?.petFoodWarningDays ?? config?.petFoodAlertLeadDays ?? 3);
                                        
                                        const litterExhaustionDate = new Date(lastLitterPurchase);
                                        litterExhaustionDate.setDate(lastLitterPurchase.getDate() + litterCycleDays);
                                        
                                        const litterAlertDate = new Date(litterExhaustionDate);
                                        litterAlertDate.setDate(litterExhaustionDate.getDate() - warningDays);
                                        
                                        const todayDate = new Date(todayStr + 'T12:00:00');
                                        const isLitterAlertWindow = (todayDate >= litterAlertDate && todayDate <= litterExhaustionDate);
                                        
                                        const lastLitterWa = p.lastLitterWhatsAppDate ? new Date(p.lastLitterWhatsAppDate + 'T12:00:00') : null;
                                        const litterWaSent = lastLitterWa && lastLitterWa >= lastLitterPurchase;
                                        
                                        if (isLitterAlertWindow && !litterWaSent) {
                                            const litterPId = `litter-${userIdentifier}-${p.name}-${p.nextLitterAlertDate || 'today'}`;
                                            pets.push({ ...data, petName: p.name, alertId: litterPId, id: d.id, alertType: 'litter' });
                                        }
                                    }
                                }
                            }
                        });
                    }
                });
                setBirthdaysOfToday(births);
                setExpiringUsers(exps);
                setPetAlerts(pets);

                // Actualizar alertas de auditoría con estado de huérfano
                setRedemptions(prev => prev.map(r => ({ ...r, isOrphan: !activeIds.has(r.userId) })));
                setPointsAssignments(prev => prev.map(p => ({ ...p, isOrphan: !activeIds.has(p.userId) })));
                
                // Guardar IDs para futuros procesos en este mismo ciclo
                (window as any)._activeUserIds = activeIds;
            });
            unsubs.push(unsubUsers);

            const startOfSimToday = new Date(effectiveDate);
            startOfSimToday.setHours(0, 0, 0, 0);

            // NUEVO: Sincronización del simulador para no omitir transacciones físicas de hoy real
            const realToday = new Date();
            realToday.setHours(0, 0, 0, 0);
            const minQueryTimestamp = startOfSimToday < realToday ? startOfSimToday : realToday;

            const qReds = query(
                collection(db, 'audit_logs'), 
                where('type', '==', 'prize_redemption'),
                where('timestamp', '>=', minQueryTimestamp)
            );
            const unsubReds = onSnapshot(qReds, (snap) => {
                const reds: any[] = [];
                const activeIds = (window as any)._activeUserIds || new Set();
                snap.forEach(d => {
                    const data = d.data();
                    const dtl = data.details?.find((x: any) => x.action === 'prize_redeemed');
                    if (dtl) {
                        let detailDateStr = dtl.timestamp ? dtl.timestamp.split('T')[0] : '';
                        if (!detailDateStr) {
                            const logDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
                            const tzDate = new Date(logDate.toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"}));
                            const y = tzDate.getFullYear();
                            const m = String(tzDate.getMonth() + 1).padStart(2, '0');
                            const d = String(tzDate.getDate()).padStart(2, '0');
                            detailDateStr = `${y}-${m}-${d}`;
                        }

                        const isOrphan = dtl.userId ? !activeIds.has(dtl.userId) : false;
                        if (detailDateStr === todayStr && !isOrphan) {
                            const alertId = `redemption-${dtl.socioNumber || dtl.phone || dtl.userId || d.id}-${dtl.redemptionCode || 'N/A'}`;
                            reds.push({ 
                                ...dtl, 
                                name: dtl.userName, 
                                alertId, 
                                id: d.id,
                                timestamp: data.timestamp,
                                isOrphan
                            });
                        }
                    }
                });
                setRedemptions(reds);
            });
            unsubs.push(unsubReds);

            const qPoints = query(
                collection(db, 'audit_logs'), 
                where('type', '==', 'points_assignment'),
                where('timestamp', '>=', minQueryTimestamp)
            );
            const unsubPoints = onSnapshot(qPoints, (snap) => {
                const pts: any[] = [];
                const activeIds = (window as any)._activeUserIds || new Set();
                snap.forEach(d => {
                    const data = d.data();
                    const dtl = data.details?.find((x: any) => x.action === 'points_credited');
                    if (dtl) {
                        let detailDateStr = dtl.timestamp ? dtl.timestamp.split('T')[0] : '';
                        if (!detailDateStr) {
                            const logDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
                            const tzDate = new Date(logDate.toLocaleString("en-US", {timeZone: "America/Argentina/Buenos_Aires"}));
                            const y = tzDate.getFullYear();
                            const m = String(tzDate.getMonth() + 1).padStart(2, '0');
                            const d = String(tzDate.getDate()).padStart(2, '0');
                            detailDateStr = `${y}-${m}-${d}`;
                        }

                        const isOrphan = dtl.userId ? !activeIds.has(dtl.userId) : false;
                        if (detailDateStr === todayStr && !isOrphan) {
                            const alertId = `points-${dtl.socioNumber || dtl.phone || dtl.userId || d.id}-${d.id}`;
                            pts.push({ 
                                ...dtl, 
                                name: dtl.userName, 
                                alertId, 
                                id: d.id,
                                timestamp: data.timestamp,
                                isOrphan
                            });
                        }
                    }
                });
                setPointsAssignments(pts);
            });
            unsubs.push(unsubPoints);

            // Compensar desfasaje horario UTC del backend (hasta 24h)
            const minCampaignQueryTimestamp = new Date(minQueryTimestamp.getTime() - 24 * 3600 * 1000);
            const qCampaigns = query(
                collection(db, 'audit_logs'),
                where('type', '==', 'campaign_broadcast'),
                where('timestamp', '>=', minCampaignQueryTimestamp)
            );
            const unsubCampaigns = onSnapshot(qCampaigns, (snap) => {
                const camps: any[] = [];
                snap.forEach(d => {
                    const data = d.data();
                    const dtl = data.details?.find((x: any) => x.action === 'campaign_broadcasted');
                    if (dtl) {
                        const detailDateStr = dtl.timestamp ? dtl.timestamp.split('T')[0] : '';
                        const logDate = data.timestamp?.toDate ? data.timestamp.toDate() : new Date();
                        const logDateStr = logDate.getFullYear() + '-' + String(logDate.getMonth() + 1).padStart(2, '0') + '-' + String(logDate.getDate()).padStart(2, '0');
                        const finalDateStr = detailDateStr || logDateStr;

                        if (finalDateStr === todayStr) {
                            const alertId = `campaign-${dtl.campId}-${d.id}`;
                            camps.push({ 
                                ...dtl, 
                                name: dtl.campName || dtl.title, 
                                alertId, 
                                id: d.id,
                                timestamp: data.timestamp
                            });
                        }
                    }
                });
                console.log('[GlobalAlerts] Campaign Alerts:', camps);
                  setCampaignAlerts(camps);
            });
            unsubs.push(unsubCampaigns);

            const unsubCamps = onSnapshot(query(collection(db, 'campanas')), (snap) => {
                const activeIds = new Set<string>();
                const cmap = new Map<string, any>();
                snap.forEach(doc => {
                    cmap.set(doc.id, { id: doc.id, ...doc.data() });
                    if (doc.data().active) {
                        activeIds.add(doc.id);
                    }
                });
                setCampaignsMap(cmap);
                setActiveCampaignIds(activeIds);
                setHasLoadedCampaignIds(true);
            });
            unsubs.push(unsubCamps);

            // Sorteos (Mystery Box)
            const qMystery = query(
                collection(db, 'mystery_box_chances'),
                where('status', '==', 'pending')
            );
            const unsubMystery = onSnapshot(qMystery, (snap) => {
                const chances: any[] = [];
                const now = new Date();
                snap.forEach(doc => {
                    const data = doc.data();
                    const exp = data.resendExpiresAt || data.expiresAt;
                    if (!exp || exp.toDate() > now) {
                        chances.push({ id: doc.id, ...data });
                    }
                });
                setMysteryBoxChances(chances.sort((a, b) => b.createdAt.toDate().getTime() - a.createdAt.toDate().getTime()));
            });
            unsubs.push(unsubMystery);
        };

        refreshAlerts();
        const handleSimChange = () => refreshAlerts();
        window.addEventListener('time-simulation-change', handleSimChange);

        return () => {
            unsubs.forEach(u => u());
            window.removeEventListener('time-simulation-change', handleSimChange);
        };
    }, [config]);

    // Intervalo liviano para evaluar campañas flash que expiren horariamente hoy en segundo plano
    useEffect(() => {
        const interval = setInterval(() => {
            setTimeTrigger(prev => prev + 1);
        }, 15000); // 15 segundos
        return () => clearInterval(interval);
    }, []);

    // Opción D: Auto-archivar alertas de campañas expiradas → pasan a "Procesados" sin intervención del operador
        // Opción D: Auto-archivar alertas de campañas expiradas -> pasan a "Procesados" sin intervención del operador
    // Archiva alertas de días anteriores Y campañas flash de HOY que ya finalizaron su horario (con su tolerancia de gracia)
    useEffect(() => {
        if (!hasLoadedCampaignIds || campaignAlerts.length === 0) return;

        const effectiveDate = TimeService.now();
        const year = effectiveDate.getFullYear();
        const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
        const day = String(effectiveDate.getDate()).padStart(2, '0');
        const todayStr = year + "-" + month + "-" + day;

        const expiredPending = campaignAlerts.filter(u => {
            if (processedAlerts[u.alertId]) return false; // ya procesado
            
            const camp = campaignsMap.get(u.campId);
            
            // Si la campaña ya no existe o ya no está activa, la archivamos inmediatamente
            if (!camp || !camp.active) return true;

            // 1. Verificación horaria para Campañas Flash del día de HOY
            if (camp.isFlash) {
                if (camp.endTime) {
                    const [endH, endM] = camp.endTime.split(':').map(Number);
                    
                    // Si el campo flashGraceMins no existe (campañas legacy), aplicamos 15 minutos por defecto.
                    // Si el campo existe y es 0, respetamos 0.
                    const grace = (camp.flashGraceMins !== undefined && camp.flashGraceMins !== null) ? Number(camp.flashGraceMins) : 15;
                    
                    const endTimeDate = new Date(effectiveDate);
                    endTimeDate.setHours(endH, endM + grace, 0, 0);
                    
                    if (effectiveDate > endTimeDate) {
                        console.log("[GlobalAlerts] Auto-archivando campaña flash expirada hoy: " + camp.name + " (Hora Fin + Gracia: " + camp.endTime + " + " + grace + "m)");
                        return true; // Finalizada hoy, archivar de inmediato
                    }
                }
            }

            // 2. Verificación de vigencia por día para campañas tradicionales
            if (u.timestamp) {
                const alertDate = u.timestamp.toDate ? u.timestamp.toDate() : new Date(u.timestamp);
                const alertDateStr = alertDate.getFullYear() + "-" + String(alertDate.getMonth() + 1).padStart(2, '0') + "-" + String(alertDate.getDate()).padStart(2, '0');
                
                // Si la alerta es de hoy o del futuro, se mantiene pendiente (a menos que sea flash y haya expirado arriba)
                if (alertDateStr >= todayStr) return false;
            }
            
            return true; // Expirada y de un día anterior -> archivar
        });

        if (expiredPending.length === 0) return;
        const logRef = doc(db, 'audit_logs', "daily_alerts_" + todayStr);
        const newActions = { ...processedAlerts };
        expiredPending.forEach(u => { newActions[u.alertId] = 'sent'; });
        setDoc(logRef, { actions: newActions, lastUpdate: TimeService.now() }, { merge: true })
            .catch(e => console.error('[GlobalAlerts] Error auto-archivando campañas expiradas:', e));
    }, [campaignAlerts, campaignsMap, processedAlerts, hasLoadedCampaignIds, timeTrigger]);

    const handleAction = async (item: any, type: string, action: 'sent' | 'dismissed') => {
        const effectiveDate = TimeService.now();
        const year = effectiveDate.getFullYear();
        const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
        const day = String(effectiveDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const alertId = item.alertId;

        const logRef = doc(db, 'audit_logs', `daily_alerts_${todayStr}`);
        const currentActions = { ...processedAlerts, [alertId]: action };
        
        try {
            await setDoc(logRef, { actions: currentActions, lastUpdate: TimeService.now() }, { merge: true });
            
            if (action === 'sent') {
                if (item.isOrphan) {
                    toast.error("El usuario ya no existe. Solo podés descartar este aviso.");
                    return;
                }
                
                if (type === 'campaign') {
                    window.location.href = '/admin/campaigns';
                    return; // Ya marcamos en Firestore, redirigimos y listo.
                }

                const phone = (item.phone || item.telefono || '').replace(/\D/g, '');
                let p = phone;
                if (!p.startsWith('54') && p.length === 10) p = '549' + p;
                
                let msg = "";
                const fullName = item.nombre || item.name || 'Socio';
                const firstName = fullName.split(' ')[0];
                const socioInfo = item.socioNumber ? ` (Socio #${item.socioNumber})` : "";
                
                if (type === 'birthday') {
                    const bdPointsStr = (item.pointsAdded || config?.birthdayPoints || '').toString();
                    const hasPoints = bdPointsStr && bdPointsStr !== '0';
                    const defaultTpl = hasPoints 
                        ? '¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día. Te regalamos {puntos} puntos.' 
                        : '¡Feliz cumpleaños {nombre}! 🎂 Que tengas un gran día.';
                    
                    const tpl = config.messaging?.templates?.whatsappBirthday || defaultTpl;
                    msg = tpl.replace(/{nombre}/g, firstName).replace(/{nombre_completo}/g, fullName).replace(/{puntos}/g, bdPointsStr);
                } else if (type === 'expiration') {
                    const tpl = config.messaging?.templates?.whatsappExpiration || '¡Hola {nombre}! 📢 Te recordamos que tus {puntos} puntos están por vencer: {fecha}. ¡No los pierdas!';
                    // Usar nextExpirationAmount (puntos reales que vencen) no el total de puntos del socio
                    const expPts = (item.nextExpirationAmount || item.nextExpirationAmt || item.points || 0).toString();
                    
                    let finalFecha = item.nextExpirationDate ? TimeService.formatDisplayDate(item.nextExpirationDate) : 'pronto';
                    if (item.expirationDetails && Array.isArray(item.expirationDetails) && item.expirationDetails.length > 1) {
                        const dateParts: string[] = [];
                        item.expirationDetails.forEach((d: any) => {
                            const pts = d.points || 0;
                            const jsDate = d.date?.toDate ? d.date.toDate() : new Date(d.date);
                            const dStr = `${String(jsDate.getDate()).padStart(2, '0')}/${String(jsDate.getMonth() + 1).padStart(2, '0')}/${jsDate.getFullYear()}`;
                            dateParts.push(`${dStr} (${pts} pts)`);
                        });
                        if (dateParts.length === 2) {
                            finalFecha = dateParts.join(' y ');
                        } else {
                            const last = dateParts.pop();
                            finalFecha = dateParts.join(', ') + ' y ' + last;
                        }
                    }
                    
                    msg = tpl.replace(/{nombre}/g, firstName).replace(/{puntos}/g, expPts).replace(/{fecha}/g, finalFecha);
                } else if (type === 'redemption') {
                    const tpl = config.messaging?.templates?.whatsappRedemption || '¡Canje exitoso {nombre}! 🎁 Canjeaste {premio}. Código: {codigo}';
                    msg = tpl.replace(/{nombre}/g, firstName).replace(/{premio}/g, item.prizeName || 'Premio').replace(/{codigo}/g, item.redemptionCode || 'N/A');
                } else if (type === 'points') {
                    const balance = item.balanceAfter || item.balance || 'N/A';
                    msg = `¡Hola ${firstName}! 💰 Sumaste ${item.points} puntos. Tu saldo actual es ${balance}.`;
                } else if (item.alertType === 'litter') {
                    const tpl = config.messaging?.templates?.whatsappPetLitter || config.messaging?.templates?.petLitterAlert_whatsapp || config.messaging?.templates?.petLitterAlert || '¡Hola {nombre}! 🐾 Notamos que a {mascota} se le deben estar terminando sus piedras sanitarias. ¡Te esperamos para reponerlas! 💨';
                    msg = tpl.replace(/{nombre}/g, firstName).replace(/{mascota}/g, item.petName || '');
                    
                    if (item.id && item.pets) {
                        const userRef = doc(db, 'users', item.id);
                        const updatedPets = item.pets.map((p: any) => {
                            if (p.name === item.petName) {
                                return { ...p, lastLitterWhatsAppDate: todayStr };
                            }
                            return p;
                        });
                        updateDoc(userRef, { pets: updatedPets }).catch(e => console.error("Error updating pet litter wa date:", e));
                    }
                } else {
                    const tpl = config.messaging?.templates?.whatsappPetFood || '¡Hola {nombre}! 🐾 Notamos que a {mascota} se le debe estar terminando su alimento Marca: {marca}.';
                    msg = tpl.replace(/{nombre}/g, firstName).replace(/{mascota}/g, item.petName || '').replace(/{marca}/g, item.foodBrand || '');
                    
                    if (item.id && item.pets) {
                        const userRef = doc(db, 'users', item.id);
                        const updatedPets = item.pets.map((p: any) => {
                            if (p.name === item.petName) {
                                return { ...p, lastWhatsAppDate: todayStr };
                            }
                            return p;
                        });
                        updateDoc(userRef, { pets: updatedPets }).catch(e => console.error("Error updating pet wa date:", e));
                    }
                }
                window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`, '_blank');
            }
        } catch (e) {
            toast.error("Error al sincronizar");
        }
    };

    const deleteProcessed = async (alertId: string) => {
        const effectiveDate = TimeService.now();
        const year = effectiveDate.getFullYear();
        const month = String(effectiveDate.getMonth() + 1).padStart(2, '0');
        const day = String(effectiveDate.getDate()).padStart(2, '0');
        const todayStr = `${year}-${month}-${day}`;
        const newActions = { ...processedAlerts };
        delete newActions[alertId];
        const logRef = doc(db, 'audit_logs', `daily_alerts_${todayStr}`);
        await setDoc(logRef, { actions: newActions }, { merge: true });
    };

    const pendingB = birthdaysOfToday.filter(u => !processedAlerts[u.alertId]);
    const pendingE = expiringUsers.filter(u => !processedAlerts[u.alertId]);
    const pendingP = petAlerts.filter(u => !processedAlerts[u.alertId]);
    const pendingR = redemptions.filter(u => !processedAlerts[u.alertId]);
    const pendingA = pointsAssignments.filter(u => !processedAlerts[u.alertId]);
    const pendingC = campaignAlerts.filter(u => !processedAlerts[u.alertId]);

    const procB = birthdaysOfToday.filter(u => processedAlerts[u.alertId]);
    const procE = expiringUsers.filter(u => processedAlerts[u.alertId]);
    const procP = petAlerts.filter(u => processedAlerts[u.alertId]);
    const procR = redemptions.filter(u => processedAlerts[u.alertId]);
    const procA = pointsAssignments.filter(u => processedAlerts[u.alertId]);
    const procC = campaignAlerts.filter(u => !!processedAlerts[u.alertId]);

    const totalPending = pendingB.length + pendingE.length + pendingP.length + pendingR.length + pendingA.length + pendingC.length;
    const totalProcessed = procB.length + procE.length + procP.length + procR.length + procA.length + procC.length;

    if (totalPending === 0 && totalProcessed === 0 && mysteryBoxChances.length === 0) return null;

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
                        <button onClick={() => { setActiveTab('pending'); localStorage.setItem('globalAlerts_activeTab', 'pending'); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'pending' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>
                            PENDIENTES ({totalPending})
                        </button>
                        <button onClick={() => { setActiveTab('sorteos'); localStorage.setItem('globalAlerts_activeTab', 'sorteos'); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'sorteos' ? 'bg-orange-500/20 text-orange-400 shadow-lg border border-orange-500/20' : 'text-white/30'}`}>
                            SORTEOS ({mysteryBoxChances.length})
                        </button>
                        <button onClick={() => { setActiveTab('processed'); localStorage.setItem('globalAlerts_activeTab', 'processed'); }} className={`flex-1 py-2 rounded-xl text-[10px] font-black transition-all ${activeTab === 'processed' ? 'bg-white/10 text-white shadow-lg' : 'text-white/30'}`}>
                            PROCESADOS
                        </button>
                    </div>

                    <div className="p-6 max-h-[480px] overflow-y-auto space-y-6 custom-scrollbar">
                        {activeTab === 'pending' ? (
                            <>
                                {pendingC.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2">📢 Campañas Activas</div>
                                        <div className="space-y-3">{pendingC.map(u => <AlertCard key={u.alertId} item={u} type="campaign" onAction={handleAction} status="pending" isCampaignActive={activeCampaignIds.has(u.campId)} />)}</div>
                                    </div>
                                )}
                                {pendingB.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-3 flex items-center gap-2">🎂 Cumpleaños</div>
                                        <div className="space-y-3">{pendingB.map(u => <AlertCard key={u.alertId} item={u} type="birthday" onAction={handleAction} status="pending" />)}</div>
                                    </div>
                                )}
                                {pendingE.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">⏳ Vencimientos</div>
                                        <div className="space-y-3">{pendingE.map(u => <AlertCard key={u.alertId} item={u} type="expiration" onAction={handleAction} status="pending" />)}</div>
                                    </div>
                                )}
                                {pendingP.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2">🐾 Mascotas</div>
                                        <div className="space-y-3">{pendingP.map(u => <AlertCard key={u.alertId} item={u} type="pet" onAction={handleAction} status="pending" />)}</div>
                                    </div>
                                )}
                                {pendingR.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">🎁 Canjes</div>
                                        <div className="space-y-3">{pendingR.map(u => <AlertCard key={u.alertId} item={u} type="redemption" onAction={handleAction} status="pending" />)}</div>
                                    </div>
                                )}
                                {pendingA.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">💰 Asignaciones</div>
                                        <div className="space-y-3">{pendingA.map(u => <AlertCard key={u.alertId} item={u} type="points" onAction={handleAction} status="pending" />)}</div>
                                    </div>
                                )}
                                {totalPending === 0 && <div className="text-center py-10 opacity-30 text-xs font-bold">✨ ¡Todo al día!</div>}
                            </>
                        ) : activeTab === 'processed' ? (
                            <>
                                {procC.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">📢 Campañas Activas</div>
                                        <div className="space-y-3">{procC.map(u => <AlertCard key={u.alertId} item={u} type="campaign" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} isCampaignActive={activeCampaignIds.has(u.campId)} />)}</div>
                                    </div>
                                )}
                                {procB.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-pink-500 uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">🎂 Cumpleaños</div>
                                        <div className="space-y-3">{procB.map(u => <AlertCard key={u.alertId} item={u} type="birthday" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}</div>
                                    </div>
                                )}
                                {procE.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">⏳ Vencimientos</div>
                                        <div className="space-y-3">{procE.map(u => <AlertCard key={u.alertId} item={u} type="expiration" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}</div>
                                    </div>
                                )}
                                {procP.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-indigo-400 uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">🐾 Mascotas</div>
                                        <div className="space-y-3">{procP.map(u => <AlertCard key={u.alertId} item={u} type="pet" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}</div>
                                    </div>
                                )}
                                {procR.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">🎁 Canjes</div>
                                        <div className="space-y-3">{procR.map(u => <AlertCard key={u.alertId} item={u} type="redemption" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}</div>
                                    </div>
                                )}
                                {procA.length > 0 && (
                                    <div>
                                        <div className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2 opacity-50">💰 Asignaciones</div>
                                        <div className="space-y-3">{procA.map(u => <AlertCard key={u.alertId} item={u} type="points" onAction={handleAction} onDelete={deleteProcessed} status={processedAlerts[u.alertId]} />)}</div>
                                    </div>
                                )}
                                {Object.keys(processedAlerts).length === 0 && <div className="text-center py-10 opacity-30 text-xs font-bold">Vacío</div>}
                            </>
                        ) : activeTab === 'sorteos' ? (
                            (() => {
                                const activeMysteryBoxChances = mysteryBoxChances.filter(c => {
                                    const exp = c.resendExpiresAt || c.expiresAt;
                                    return !exp || exp.toDate() > TimeService.now();
                                });
                                return (
                            <>
                                {activeMysteryBoxChances.length > 0 ? (
                                    <div className="space-y-3">
                                        {activeMysteryBoxChances.map(c => {
                                            const pwaUrl = config?.contact?.pwaUrl || window.location.origin;
                                            const chanceUrl = `${pwaUrl}/play/${c.id}`;
                                            return (
                                            <div key={c.id} className="bg-white/[0.03] p-5 rounded-[30px] border border-orange-500/20 flex flex-col gap-4">
                                                <div className="flex items-center gap-4">
                                                    
                                                    <div>
                                                        <h5 className="font-bold text-white text-[15px]">{c.clientName || 'Cliente'}</h5>
                                                        <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider mt-1 flex flex-col gap-1.5">
                                                            <span>🎁 Compra de ${c.amount}</span>
                                                            <span className="text-[10px] text-white/70 tracking-normal font-bold bg-black/20 px-1.5 py-0.5 rounded inline-block w-fit mt-0.5">
                                                                🕒 {c.createdAt?.toDate().toLocaleDateString('es-AR')} - {c.createdAt?.toDate().toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'})} hs
                                                            </span>
                                                        </div>
                                                        <p className="text-[9px] text-orange-400/80 font-bold uppercase tracking-wider mt-1">
                                                            Expira el {(c.resendExpiresAt || c.expiresAt)?.toDate().toLocaleString('es-AR', { dateStyle: 'short', timeStyle: 'short' })}
                                                        </p>
                                                    </div>
                                                </div>
                                                <button onClick={() => {
                                                    const phone = (c.clientPhone || '').replace(/\D/g, '');
                                                    let p = phone;
                                                    if (p && !p.startsWith('54') && p.length === 10) p = '549' + p;
                                                    window.open(`https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent('¡Hola! Tu código para la Caja Sorpresa es: ' + chanceUrl)}`, '_blank');
                                                }} className="bg-orange-500/20 text-orange-400 py-3 rounded-2xl text-[10px] font-black transition-all hover:scale-[1.02]">
                                                    🔄 RE-ENVIAR LINK POR WHATSAPP
                                                </button>
                                            </div>
                                            );
                                        })}
                                    </div>
                                ) : (
                                    <div className="text-center py-10 opacity-30 text-xs font-bold">✨ No hay sorteos pendientes</div>
                                )}
                            </>
                                );
                            })()
                        ) : null}
                    </div>
                </div>
            )}

            {!isExpanded && (
                <button onMouseDown={handleMouseDown}
                    onClick={() => setIsExpanded(true)}
                    className="w-20 h-20 bg-gradient-to-tr from-violet-600 to-indigo-700 rounded-full shadow-[0_20px_60px_rgba(99,102,241,0.6)] flex items-center justify-center text-white border-4 border-white/20 hover:scale-110 active:scale-95 transition-all pointer-events-auto relative cursor-grab active:cursor-grabbing">
                    <div className="absolute -top-2 -right-2 bg-red-500 text-white text-[11px] font-black px-3 py-1 rounded-full border-2 border-white shadow-lg">
                        {totalPending}
                    </div>

                    {/* Desglose V.1.4.33 */}
                    {totalPending > 0 && (
                        <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-black/80 text-white text-[8px] font-black px-2 py-0.5 rounded-lg border border-white/20 whitespace-nowrap tracking-wider shadow-xl flex gap-1.5 backdrop-blur-sm">
                            {pendingC.length > 0 && <span className="text-blue-400">Cp:{pendingC.length}</span>}
                            {pendingB.length > 0 && <span className="text-pink-400">C:{pendingB.length}</span>}
                            {pendingE.length > 0 && <span className="text-amber-400">V:{pendingE.length}</span>}
                            {pendingP.length > 0 && <span className="text-indigo-400">A:{pendingP.length}</span>}
                            {pendingR.length > 0 && <span className="text-emerald-400">R:{pendingR.length}</span>}
                        </div>
                    )}
                    {mysteryBoxChances.length > 0 && (
                        <div className="absolute top-0 -left-2 bg-orange-500 text-white text-[9px] font-black px-2 py-0.5 rounded-full shadow-lg">
                            🎁 {(() => {
                                const activeMysteryBoxChances = mysteryBoxChances.filter(c => {
                                    const exp = c.resendExpiresAt || c.expiresAt;
                                    return !exp || exp.toDate() > TimeService.now();
                                });
                                return activeMysteryBoxChances.length;
                            })()}
                        </div>
                    )}

                    <Bell size={32} />
                </button>
            )}
        </div>
    );
};

const AlertCard = ({ item, type, onAction, onDelete, status, isCampaignActive }: any) => {
    const isPending = status === 'pending';
    const isSent = status === 'sent';
    const isDismissed = status === 'dismissed';

    let timeStr = "";
    if (item.timestamp) {
        const d = item.timestamp.toDate ? item.timestamp.toDate() : new Date(item.timestamp);
        timeStr = d.toLocaleDateString('es-AR') + ' - ' + d.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) + ' hs';
    } else {
        const d = new Date();
        timeStr = d.toLocaleDateString('es-AR') + ' - ' + d.toLocaleTimeString('es-AR', {hour: '2-digit', minute:'2-digit'}) + ' hs';
    }

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
                        {type === 'campaign' ? (
                            <span className="flex items-center gap-1.5">
                                Campaña Iniciada
                                {!isCampaignActive && (
                                    <span className="bg-red-500/20 text-red-400 border border-red-500/30 text-[8px] font-black px-1.5 py-0.5 rounded uppercase tracking-wider">
                                        Terminada
                                    </span>
                                )}
                            </span>
                        ) : (
                            item.nombre || item.name || 'Socio'
                        )} 
                        {type !== 'campaign' && <span className="text-[10px] text-white/30 font-bold tracking-tighter">#{item.socioNumber || 'S/N'}</span>}
                        {isSent && <span className="text-[#25D366] text-xs font-black drop-shadow-[0_0_2px_rgba(37,211,102,0.5)]">✓✓</span>}
                        {isDismissed && <span className="text-red-500 text-xs font-black">✓</span>}
                    </h5>
                    <div className="text-[9px] text-white/40 font-bold uppercase tracking-wider mt-1 flex flex-col gap-1.5">
                        <span>
                            {type === 'campaign' ? `📢 ${item.name}` : type === 'pet' ? `🐾 ${item.petName}` : type === 'expiration' ? `⏳ ${item.points} pts` : type === 'redemption' ? `🎁 ${item.prizeName}` : type === 'points' ? `💰 +${item.points} pts` : '🎂 Cumpleaños'}
                            {item.isOrphan && <span className="ml-2 text-red-400 bg-red-400/10 px-1.5 py-0.5 rounded border border-red-400/20 text-[7px]">USUARIO ELIMINADO</span>}
                        </span>
                        <span className="text-[10px] text-white/70 tracking-normal font-bold bg-black/20 px-1.5 py-0.5 rounded inline-block w-fit mt-0.5">🕒 {timeStr}</span>
                    </div>
                </div>
            </div>

            <button onClick={() => onAction(item, type, 'sent')} className={`py-3 rounded-2xl text-[10px] font-black transition-all ${isPending ? 'bg-white text-black hover:scale-[1.02]' : 'bg-white/5 text-white/40'}`}>
                {isPending ? (type === 'campaign' ? '📥 DESCARGAR CSV (VER)' : '📳 ENVIAR WHATSAPP') : (type === 'campaign' ? '🔄 IR A CAMPAÑAS' : '🔄 RE-ENVIAR')}
            </button>
        </div>
    );
};
