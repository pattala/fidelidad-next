import { useEffect, useRef, useState, useMemo } from 'react';
import { auth, db } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit, getDocs, updateDoc } from 'firebase/firestore';
import { useNavigate, useOutletContext } from 'react-router-dom';
import {
    User as UserIcon,
    LogOut,
    Plus,
    Calendar,
    ChevronRight,
    Search,
    Clock,
    Sparkles,
    Cake,
    X,
    Shield,
    TrendingUp,
    Coins,
    Dog,
    Cat,
    Maximize2
} from 'lucide-react';
import { TimeService } from '../../../services/timeService';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import { type BonusRule } from '../../../services/campaignService';
import { CampaignCarousel } from '../components/CampaignCarousel';
import { PointsExpirationWarning } from '../components/PointsExpirationWarning';
import { PointsExpirationModal } from '../components/PointsExpirationModal';
import { NotificationPermissionPrompt } from '../components/NotificationPermissionPrompt';
import { useFcmToken } from '../../../hooks/useFcmToken';
import { ModernConfirmModal } from '../components/ModernConfirmModal';
import { CampaignActionModal } from '../components/CampaignActionModal';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { usePWAInstall } from '../../../hooks/usePWAInstall';
import { PWAInstallAdvantageModal } from '../components/PWAInstallAdvantageModal';
const RecentActivityList = ({ uid }: { uid?: string }) => {
    const [activities, setActivities] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!uid) return;
        const fetchRecent = async () => {
            try {
                const q = query(
                    collection(db, 'users', uid, 'points_history'),
                    orderBy('date', 'desc'),
                    limit(5)
                );
                const snap = await getDocs(q);
                setActivities(snap.docs.map(d => ({ id: d.id, ...d.data() })));
            } catch (e) {
                console.error(e);
            } finally {
                setLoading(false);
            }
        };
        fetchRecent();
    }, [uid]);

    if (loading) return <div className="w-full h-24 bg-gray-100 rounded-xl animate-pulse"></div>;

    if (activities.length === 0) return (
        <div className="w-full text-center py-4 rounded-xl border border-dashed border-gray-200 bg-gray-50">
            <p className="text-xs text-gray-400">Sin movimientos recientes</p>
        </div>
    );

    return (
        <>
            {activities.map((item) => {
                const isPositive = item.type === 'credit' || (item.amount > 0 && item.type !== 'debit');
                return (
                    <div key={item.id} className="w-full bg-white p-4 rounded-2xl shadow-sm text-gray-800 flex items-center justify-between border border-gray-100">
                        <div className="flex flex-col gap-1">
                            <span className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                {item.date?.toDate ? item.date.toDate().toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' }) : ''}
                            </span>
                            <p className="text-xs font-black uppercase tracking-tight leading-tight">
                                {item.concept || 'Movimiento'}
                            </p>
                        </div>
                        <span className={`text-sm font-black px-3 py-1 rounded-xl ${isPositive ? 'bg-green-50 text-green-600' : 'bg-red-50 text-red-600'}`}>
                            {isPositive ? '+' : ''}{item.amount}
                        </span>
                    </div>
                );
            })}
        </>
    );
};

const CountdownTimer = ({ targetTime }: { targetTime: string }) => {
    const [timeLeft, setTimeLeft] = useState("");

    useEffect(() => {
        const calculate = () => {
            const now = TimeService.now();
            const [h, m] = targetTime.split(':').map(Number);
            const target = new Date(now);
            target.setHours(h, m, 0, 0);

            let diff = target.getTime() - now.getTime();

            // Prevent negative values
            if (diff <= 0) {
                setTimeLeft('00:00:00');
                return;
            }

            const hh = Math.floor(diff / (1000 * 60 * 60));
            diff -= hh * (1000 * 60 * 60);
            const mm = Math.floor(diff / (1000 * 60));
            diff -= mm * (1000 * 60);
            const ss = Math.floor(diff / 1000);

            setTimeLeft(`${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`);
        };

        calculate();
        const interval = setInterval(calculate, 1000);
        return () => clearInterval(interval);
    }, [targetTime]);

    return <p className="text-xl font-black font-mono leading-none tracking-tighter">{timeLeft}</p>;
};

export const ClientHomePage = () => {
    const { user, userData, loading: authLoading, isAdmin } = useClientAuth();
    const [showExpirationModal, setShowExpirationModal] = useState(false);
    const [showLogoutConfirm, setShowLogoutConfirm] = useState(false);
    const [selectedPromo, setSelectedPromo] = useState<BonusRule | null>(null);
    const [currentTimeStore, setCurrentTimeStore] = useState(new Date());
    const [activeBannerPhase, setActiveBannerPhase] = useState<'none' | 'large'>('none');
    const [zoomedPhoto, setZoomedPhoto] = useState<string | null>(null);
    const { token, retrieveToken } = useFcmToken();

    // Helper for dynamic pet age
    const getPetAge = (pet: any) => {
        if (!pet.birthDate) return pet.age ? `${pet.age} años` : '';
        try {
            const birth = pet.birthDate.toDate ? pet.birthDate.toDate() : new Date(pet.birthDate);
            const now = new Date();
            let age = now.getFullYear() - birth.getFullYear();
            const m = now.getMonth() - birth.getMonth();
            if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
                age--;
            }
            if (age < 1) {
                const months = (now.getFullYear() - birth.getFullYear()) * 12 + (now.getMonth() - birth.getMonth());
                return months > 0 ? `${months} m` : 'Recién nacido';
            }
            return `${age} años`;
        } catch (e) {
            return pet.age ? `${pet.age} años` : '';
        }
    };


    const prevPointsRef = useRef<number | null>(null);
    const lastActionTs = useRef<number>(0);
    const initialLoadTs = useRef<number>(Date.now());
    const [readyForBanner, setReadyForBanner] = useState(false);
    const [hideDiagnostic, setHideDiagnostic] = useState(() => {
        if (typeof sessionStorage === 'undefined') return false;
        return sessionStorage.getItem('rampet_hide_diagnostic') === 'true';
    });

    useEffect(() => {
        const timer = setTimeout(() => setReadyForBanner(true), 1600);
        return () => clearTimeout(timer);
    }, []);

    const PC_PROMPT_SESSION_KEY = 'rampet_pc_prompt_shown';
    
    const { config } = useOutletContext<{ config: any }>();

    const isMobileDevice = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const ua = navigator.userAgent;
        const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
        const isIPadOS = (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
        return isMobileUA || isIPadOS;
    }, []);

    // --- PWA INSTALL LOGIC ---
    const { isStandalone, handleInstall, isIOS: isIOSHook, isInstalled } = usePWAInstall();
    const [showPWAAdvantages, setShowPWAAdvantages] = useState(false);
    const [gloriaMode, setGloriaMode] = useState<'permissions' | 'install'>('install');
    const [isIOS, setIsIOS] = useState(false);
    const [lastPushRx, setLastPushRx] = useState<string | null>(() => {
        if (typeof localStorage === 'undefined') return null;
        return localStorage.getItem('rampet_last_push_rx');
    });

    useEffect(() => {
        try {
            const channel = new BroadcastChannel('fcm_diagnostic');
            channel.onmessage = (event) => {
                if (event.data?.type === 'PUSH_RECEIVED') {
                    const ts = new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
                    setLastPushRx(ts);
                    localStorage.setItem('rampet_last_push_rx', ts);
                    toast.success('¡Mensaje Push recibido!');
                }
            };
            return () => channel.close();
        } catch (e) {
            return () => {};
        }
    }, []);

    const [swState, setSwState] = useState<string>('checking...');

    useEffect(() => {
        if (!('serviceWorker' in navigator)) {
            setSwState('unsupported');
            return;
        }
        const check = async () => {
            try {
                const reg = await navigator.serviceWorker.getRegistration();
                if (!reg) setSwState('none');
                else if (reg.installing) setSwState('installing');
                else if (reg.waiting) setSwState('waiting');
                else if (reg.active) setSwState('activated');
                else setSwState('unknown');
            } catch (e) {
                setSwState('error');
            }
        };
        check();
        const interval = setInterval(check, 3000);
        return () => clearInterval(interval);
    }, []);

    // --- DIAGNOSTIC DATA (For Test Users) ---
    const diagnostic = useMemo(() => {
        if (!userData || !config) return null;
        
        const getDeviceKey = () => {
            if (typeof window === 'undefined') return 'pc';
            const ua = navigator.userAgent;
            const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
            const isIPadOS = (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
            return (isMobileUA || isIPadOS) ? 'mobile' : 'pc';
        };
        const dk = getDeviceKey();
        const prefix = dk === 'mobile' ? 'mobile_' : 'pc_';
        
        const permissions = userData.permissions || {};
        const notif = permissions.notifications || {};
        const geo = permissions.geolocation || {};
        
        const fcmDebug = userData[`fcmDebug_${dk}`] || {};

        return {
            device: dk.toUpperCase(),
            version: 'v4.7-NATIVE-FIX',
            browserPerm: typeof Notification !== 'undefined' ? Notification.permission : 'unsupported',
            swState: swState,
            notifStatus: notif[`${prefix}status`] || 'pending',
            fcmTime: fcmDebug.timestamp 
                ? new Date(fcmDebug.timestamp).toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
                : null,
            ua: typeof navigator !== 'undefined' ? navigator.userAgent : 'N/A',
            token: token ? `${token.substring(0, 8)}...${token.substring(token.length - 8)}` : 'VACÍO',
            fcmError: userData.lastFcmError || null,
            lastPush: lastPushRx
        };
    }, [userData, config, isMobileDevice, token, swState, lastPushRx]);

    // Track PWA installation in Firestore
    useEffect(() => {
        if (user?.uid && isInstalled && !userData?.pwaInstalled && !isAdmin) {
            updateDoc(doc(db, 'users', user.uid), {
                pwaInstalled: true,
                pwaInstalledAt: TimeService.now().getTime()
            }).catch(console.error);
        }

        // Sync local PWA prompt stats to Firestore on load if missing
        if (user?.uid && !isAdmin && userData) {
            const deviceKey = isMobileDevice ? 'Mobile' : 'PC';
            const dbField = `pwaPromptStats${deviceKey}`;
            // Removed obsolete migration logic to fix ReferenceError
        }
    }, [isInstalled, user?.uid, userData?.pwaInstalled, isAdmin, isMobileDevice]);

    const isCondensed = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < 768;
    }, []);
    const isMobile = isMobileDevice || isCondensed;

    const handleRequestNativePermission = async () => {
        if (typeof Notification === 'undefined') {
            toast.error('Este navegador no soporta notificaciones.');
            return;
        }

        try {
            toast.loading('Solicitando permiso...', { id: 'native-perm' });
            
            // 1. Petición PURA de permiso (Más compatible con Samsung)
            const permission = await Notification.requestPermission();
            
            if (permission === 'granted') {
                toast.loading('Configurando avisos...', { id: 'native-perm' });
                
                // 2. Solo si hay permiso, intentamos el motor de fondo
                try {
                    const registration = await navigator.serviceWorker.ready;
                    const sub = await registration.pushManager.subscribe({
                        userVisibleOnly: true,
                        applicationServerKey: 'BHmqZhSCc-QcEmLflzdu228dg_dkTRmUm3jRb7mQjlw05sMTio0uc_MdZg0D_u1bHtAHegsNrkRziYNQIAuwirk'
                    });
                    console.log('[PUSH] Subscribed successfully:', sub);
                } catch (pushErr) {
                    console.warn('[PUSH] Subscription engine delayed:', pushErr);
                }

                toast.success('¡Activado con éxito!', { id: 'native-perm' });
                retrieveToken();
            } else if (permission === 'denied') {
                toast.error('Permiso denegado en ajustes.', { id: 'native-perm' });
            } else {
                toast.error('Petición cancelada o bloqueada.', { id: 'native-perm' });
            }
        } catch (err: any) {
            console.error(err);
            toast.error(`Error: ${err.message || 'Error al pedir permiso'}`, { id: 'native-perm' });
        }
    };

    const handleResetPermissions = async () => {
        if (!user?.uid) return;
        const deviceKey = isMobileDevice ? 'mobile' : 'pc';
        try {
            await updateDoc(doc(db, 'users', user.uid), {
                // Clear prefixed fields (Primary)
                'permissions.notifications.mobile_status': 'pending',
                'permissions.notifications.mobile_dismissedCount': 0,
                'permissions.notifications.mobile_nextPrompt': null,
                'permissions.notifications.pc_status': 'pending',
                'permissions.notifications.pc_dismissedCount': 0,
                'permissions.notifications.pc_nextPrompt': null,
                // Clear generic fields (Legacy/Safety)
                'permissions.notifications.status': 'pending',
                'permissions.notifications.dismissedCount': 0,
                'permissions.notifications.nextPrompt': null,
                
                'permissions.geolocation.mobile_status': 'pending',
                'permissions.geolocation.mobile_dismissedCount': 0,
                'permissions.geolocation.mobile_nextPrompt': null,
                'permissions.geolocation.pc_status': 'pending',
                'permissions.geolocation.pc_dismissedCount': 0,
                'permissions.geolocation.pc_nextPrompt': null,
                
                [`fcmDebug_${deviceKey}`]: { 
                    step: 'reset_manual', 
                    timestamp: new Date().toISOString(),
                    ua: navigator.userAgent
                }
            });
            window.location.reload();
        } catch (err) {
            console.error('Failed to reset permissions:', err);
            alert('Error al resetear permisos. Reintenta.');
        }
    };

    const handleDeepUpdate = async () => {
        if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return;
        try {
            toast.loading('Limpiando memoria...', { id: 'deep-update' });
            const regs = await navigator.serviceWorker.getRegistrations();
            for (const reg of regs) await reg.unregister();
            if ('caches' in window) {
                const names = await caches.keys();
                for (const name of names) await caches.delete(name);
            }
            toast.success('Actualizando...', { id: 'deep-update' });
            setTimeout(() => window.location.reload(), 1000);
        } catch (err) {
            console.error(err);
            window.location.reload();
        }
    };

    const handleInteraction = (triggerCooldown: boolean = true) => {
        const now = TimeService.now().getTime();
        lastActionTs.current = now;
        if (triggerCooldown && isMobileDevice && user) {
            updateDoc(doc(db, 'users', user.uid), {
                'permissions.global_lastMobileDismissal': now
            }).catch(console.error);
        }
    };

    // --- 🔍 DIAGNÓSTICO: Log de estado al cargar ---
    useEffect(() => {
        if (!userData || !config || authLoading || isAdmin) return;
        const prefix = isMobileDevice ? 'mobile_' : 'pc_';
        const deviceKey = isMobileDevice ? 'Mobile' : 'PC';
        const permissions = userData.permissions || {};
        const notif = permissions.notifications || {};
        const geo = permissions.geolocation || {};
        const gloriaStats = userData[`pwaPromptStats${deviceKey}`] || {};
        const messaging = config?.messaging || {};

        const maxBanner = isMobileDevice
            ? (Number(messaging.maxLargePromptDismissalsMobile) || 2)
            : (Number(messaging.maxLargePromptDismissalsPC) || 2);
        const maxGloria = Number(messaging.pwaInstallPromptMaxAttempts) || 3;
        const cooldownGloriaH = Number(messaging.pwaInstallPromptCooldownHours) || 24;
        const lastGloriaTs = gloriaStats.lastPromptTs || 0;
        const minutesSinceGloria = lastGloriaTs ? Math.round((Date.now() - lastGloriaTs) / 60000) : null;

        console.log(
            '%c🔍 RAMPET DIAGNÓSTICO',
            'background:#4a148c;color:white;font-weight:bold;padding:4px 8px;border-radius:4px'
        );
        console.table({
            '📱 Dispositivo': deviceKey,
            '🔔 Status Notif': notif[`${prefix}status`] || 'pending',
            '🔵 Intentos Banner': `${notif[`${prefix}dismissedCount`] || 0} / ${maxBanner}`,
            '✨ Intentos Gloria': `${gloriaStats.currentCycleCount || 0} / ${maxGloria}`,
            '⏱ Cooldown Gloria': lastGloriaTs
                ? `${minutesSinceGloria}min transcurridos (cooldown: ${cooldownGloriaH * 60}min)`
                : 'Sin intentos previos',
            '🔒 Bloqueado hasta': notif[`${prefix}nextPrompt`]
                ? new Date(notif[`${prefix}nextPrompt`]).toLocaleString('es-AR')
                : 'Sin bloqueo',
            '🌍 Geo Bloqueado hasta': geo[`${prefix}nextPrompt`]
                ? new Date(geo[`${prefix}nextPrompt`]).toLocaleString('es-AR')
                : 'Sin bloqueo',
        });
    }, [!!userData, !!config, authLoading, isAdmin]);

    // --- POINTS INCREASE DETECTION (Removed) ---
    // User requested to remove "Momento de Gloria" (Phase 2) PWA logic.
    // We stick to Phase 1 (Initial Banners).

    const [campaigns, setCampaigns] = useState<BonusRule[]>([]);

    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            // Limpiar TODO el estado local para que el próximo login sea 100% fresco
            sessionStorage.clear();
            localStorage.clear();
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    const displayData = userData || {
        name: isAdmin ? 'Administrador' : (authLoading ? 'Cargando...' : 'Socio'),
        points: 0,
        accumulated_balance: 0
    };

    const displayName = userData?.name || userData?.nombre || (isAdmin ? 'Administrador' : (authLoading ? 'Cargando...' : (user ? (user.displayName || 'Socio') : 'Invitado')));

    const isVisitLogged = useRef(false);
    useEffect(() => {
        if (user && !userData && !authLoading && !isAdmin) {
            // This might happen if auth is ok but firestore doc is missing
            console.warn("User authenticated but no firestore data found.");
        }

        if (user && !isVisitLogged.current) {
            // Registro de Actividad (Ping / Visita)
            (async () => {
                try {
                    const sessionVisitId = sessionStorage.getItem('current_visit_id');

                    // Si no tenemos ID de visita en esta sesión, es una visita nueva (por Login o por abrir pestaña)
                    if (!sessionVisitId) {
                        isVisitLogged.current = true;
                        const newVisitId = Math.random().toString(36).substring(7);
                        sessionStorage.setItem('current_visit_id', newVisitId);

                        const { updateDoc, increment, serverTimestamp, doc, setDoc } = await import('firebase/firestore');
                        const userRef = doc(db, 'users', user.uid);
                        const currentName = userData?.name || userData?.nombre || user.displayName || (isAdmin ? 'Admin' : 'Socio');

                        if (!isAdmin) {
                            await updateDoc(userRef, {
                                lastActive: serverTimestamp(),
                                visitCount: increment(1)
                            });
                        }

                        // Usamos setDoc con un ID basado en el tiempo + random para evitar "Document already exists"
                        const historyId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
                        const historyRef = doc(db, 'users', user.uid, 'visit_history', historyId);
                        
                        await setDoc(historyRef, {
                            date: serverTimestamp(),
                            type: 'app_open',
                            clientName: currentName,
                            clientEmail: user.email,
                            platform: 'pwa',
                            location: userData?.lastLocation || null
                        });

                        // También marcamos ping de 30 mins para actividad secundaria
                        sessionStorage.setItem(`ping_${user.uid}`, Date.now().toString());
                    }
                } catch (e) {
                    console.error("Error updating activity:", e);
                }
            })();
        }
    }, [user?.uid, !!userData, authLoading, isAdmin]);

    // CHEQUEO DE CUMPLEAÑOS (UNA SOLA VEZ AL CARGAR)
    const [birthdayChecked, setBirthdayChecked] = useState(false);
    const [isBirthdayVisible, setIsBirthdayVisible] = useState(true);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const offset = TimeService.getOffsetInDays();
            const hidden = sessionStorage.getItem(`hideBirthdayBanner_${offset}`) === 'true';
            setIsBirthdayVisible(!hidden);
        }
    }, []);

    const handleHideBirthday = () => {
        setIsBirthdayVisible(false);
        const offset = TimeService.getOffsetInDays();
        sessionStorage.setItem(`hideBirthdayBanner_${offset}`, 'true');
    };
    useEffect(() => {
        if (userData && user?.uid && config && !birthdayChecked) {
            setBirthdayChecked(true);
            const runCheck = async () => {
                const { BirthdayService } = await import('../../../services/birthdayService');
                await BirthdayService.checkAndProcessBirthday(user.uid, userData, config);
            };
            runCheck();
        }
    }, [user?.uid, !!userData, !!config, birthdayChecked]);

    useEffect(() => {
        const interval = setInterval(() => {
            setCurrentTimeStore(new Date());
        }, 60000); // Actualizar cada minuto para expirar ofertas flash
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleSimChange = () => {
            // Trigger a re-render or re-fetch
            window.location.reload();
        };
        window.addEventListener('time-simulation-change', handleSimChange);
        return () => window.removeEventListener('time-simulation-change', handleSimChange);
    }, []);

    useEffect(() => {
        // Suscripción en tiempo real a campañas
        const q = query(collection(db, 'campanas'), orderBy('name'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const fetched = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as BonusRule[];

            // Filtrar para hoy localmente para reactividad inmediata
            const now = currentTimeStore;
            const todayDay = now.getDay();
            const year = now.getFullYear();
            const month = String(now.getMonth() + 1).padStart(2, '0');
            const day = String(now.getDate()).padStart(2, '0');
            const todayStr = `${year}-${month}-${day}`;

            const activeToday = fetched.filter(b => {
                if (!b.active) return false;
                if (b.startDate && b.startDate > todayStr) return false;
                if (b.endDate && b.endDate < todayStr) return false;

                const targetDays = b.isFlash ? b.flashDays : b.daysOfWeek;
                if (targetDays && Array.isArray(targetDays) && targetDays.length > 0 && !targetDays.includes(todayDay)) return false;

                // Test Mode Filtering
                if (b.isInternal && !userData?.isTestUser) return false;

                return true;
            });

            setCampaigns(activeToday);
        });

        if (user?.uid) {
            // Check and process expirations silently on load
            import('../../../services/expirationService').then(({ ExpirationService }) => {
                ExpirationService.processExpirations(user.uid).then((expiredAmount) => {
                    if (expiredAmount && expiredAmount > 0) {
                        toast(`Se han vencido ${expiredAmount} puntos antiguos.`, { icon: 'info' });
                    }
                });
            });
        }

        return () => unsubscribe();
    }, [user?.uid, currentTimeStore]);

    const carouselCampaigns = campaigns.filter(c => c.showInCarousel && !c.isFlash);
    const listCampaigns = campaigns.filter(c => c.showInHomeBanner && !c.isFlash);

    const activeFlash = campaigns.find(c => {
        if (!c.startTime || !c.endTime) return false;
        const now = currentTimeStore;
        const curHHmm = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}:00`;
        const startTimestamp = `${c.startTime}:00`;
        const endTimestamp = `${c.endTime}:00`;

        // Instant switch at end time (strict comparison)
        return curHHmm >= startTimestamp && curHHmm < endTimestamp;
    });

    const pointsRatio = Number(config?.pointsPerPeso || 1);
    const moneyBase = Number(config?.pointsMoneyBase || 100);
    const costPerPoint = pointsRatio > 0 ? (moneyBase / pointsRatio) : moneyBase;
    const rawBalance = Number(displayData.accumulated_balance || 0);
    const balanceForCalc = rawBalance % costPerPoint;
    const missing = Math.max(0, Math.ceil(costPerPoint - (rawBalance % costPerPoint)));

    // Prompt Logic

    // Prompt Logic
    const handlePermissionGranted = () => {
        retrieveToken();
    };

    // --- CENTRAL BANNER ORCHESTRATOR ---
    useEffect(() => {
        if (!userData || !user || !config || authLoading || !readyForBanner) return;

        const now = TimeService.now().getTime();
        const permissions = userData.permissions || {};
        const messaging = config.messaging || {};

        // (pwa_banner_dismissed guard removed to allow multiple attempts per visit if cooldown permits)

        // 1. COOLDOWN CHECK (Smarter Cooldown for Handhelds)
        if (isMobileDevice) {
            const lastGlobalDismissal = permissions.global_lastMobileDismissal || 0;
            const cooldownMs = (messaging.mobileCooldownHours || 0.0167) * 3600 * 1000;

            const isRegistration = (userData.visitCount === 1) && !lastGlobalDismissal;

            if (!isRegistration) {
                if ((now - lastGlobalDismissal < cooldownMs) || (now - lastActionTs.current < 5000)) {
                    if (activeBannerPhase !== 'none') setActiveBannerPhase('none');
                    return;
                }
            }
        } else {
            // PC Session Check
            const isHandled = sessionStorage.getItem(PC_PROMPT_SESSION_KEY) === 'true';
            if (isHandled) {
                if (activeBannerPhase !== 'none') setActiveBannerPhase('none');
                return;
            }
        }

        // 2. PHASE 1: LARGE BANNERS (PRIORITY)
        const checkPhase1 = () => {
            if (messaging.enableLargePrompt === false) return false;

            const prefix = isMobileDevice ? 'mobile_' : 'pc_';
            const notifStatus = permissions.notifications?.[`${prefix}status`] || 'pending';
            const geoStatus = permissions.geolocation?.[`${prefix}status`] || 'pending';

            const counterKey = isMobileDevice ? 'mobile_dismissedCount' : 'pc_dismissedCount';
            const notifCount = permissions.notifications?.[counterKey] || 0;
            const geoCount = permissions.geolocation?.[counterKey] || 0;
            const rawMax = isMobileDevice 
                ? (messaging.maxLargePromptDismissalsMobile) 
                : (messaging.maxLargePromptDismissalsPC);
            const maxAttempts = typeof rawMax === 'number' ? rawMax : parseInt(rawMax as any) || 2;

            // Cooldown check
            const notifNextPrompt = permissions.notifications?.[`${prefix}nextPrompt`] || 0;
            const isNotifCooldown = notifNextPrompt > TimeService.now().getTime();
            
            const geoNextPrompt = permissions.geolocation?.[`${prefix}nextPrompt`] || 0;
            const isGeoCooldown = geoNextPrompt > TimeService.now().getTime();

            const browserState = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

            const canShowNotif = (notifStatus === 'pending' || notifStatus === 'later' || notifStatus === 'later_phase1_complete' || notifStatus === 'blocked') &&
                notifCount < maxAttempts &&
                !isNotifCooldown &&
                browserState === 'default';

            const canShowGeo = isMobileDevice &&
                (geoStatus === 'pending' || geoStatus === 'later' || geoStatus === 'later_phase1_complete' || geoStatus === 'blocked') &&
                geoCount < maxAttempts &&
                !isGeoCooldown;

            // Debug log
            if (readyForBanner && (userData.visitCount || 0) < 10) {
                console.log('[Banner Orchestrator Debug]', {
                    device: isMobileDevice ? 'MOBILE' : 'PC',
                    notif: { status: notifStatus, count: notifCount, max: maxAttempts, next: notifNextPrompt, cooling: isNotifCooldown },
                    geo: { status: geoStatus, count: geoCount, max: maxAttempts, next: geoNextPrompt, cooling: isGeoCooldown },
                    canShowNotif,
                    canShowGeo,
                    browserState
                });
            }

            return canShowNotif || canShowGeo;
        };

        if (checkPhase1()) {
            if (activeBannerPhase !== 'large') setActiveBannerPhase('large');
            return;
        }

        if (activeBannerPhase !== 'none') setActiveBannerPhase('none');

    }, [userData?.permissions, userData?.visitCount, !!config, activeBannerPhase, readyForBanner]);

    return (
        <div
            className="relative font-sans text-gray-800 px-4 pt-4 pb-12 space-y-8 animate-fade-in"
        >
            {/* DIAGNOSTIC PANEL (Test Users Only - TOP POSITION) */}
            {userData?.isTestUser && diagnostic && !hideDiagnostic && (
                <div className="mx-0 mb-8 p-5 bg-blue-900/90 backdrop-blur-md rounded-3xl border-2 border-blue-400/30 text-white shadow-2xl relative overflow-hidden group">
                    <button
                        onClick={() => {
                            setHideDiagnostic(true);
                            sessionStorage.setItem('rampet_hide_diagnostic', 'true');
                        }}
                        className="absolute top-4 right-4 z-20 p-2 bg-white/10 hover:bg-white/20 rounded-full transition-all active:scale-90"
                    >
                        <X size={14} />
                    </button>
                    <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:rotate-12 transition-transform">
                        <Shield size={60} />
                    </div>
                    <div className="relative z-10 pr-8">
                        <div className="flex items-center gap-2 mb-3">
                            <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse"></span>
                            <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Panel de Diagnóstico</h3>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-y-3 gap-x-2">
                            <div>
                                <p className="text-[7px] font-bold text-blue-300 uppercase tracking-widest mb-0.5">Dispositivo</p>
                                <p className="text-xs font-black uppercase">{diagnostic.device} <span className="text-[8px] opacity-40">({diagnostic.version})</span></p>
                            </div>
                            <div>
                                <p className="text-[7px] font-bold text-blue-300 uppercase tracking-widest mb-0.5 text-orange-400">Browser Perm</p>
                                <p className="text-[10px] font-black uppercase text-orange-300">{diagnostic.browserPerm}</p>
                            </div>
                            <div>
                                <p className="text-[7px] font-bold text-blue-300 uppercase tracking-widest mb-0.5 text-emerald-400">SW State</p>
                                <p className="text-[10px] font-black uppercase text-emerald-300">{diagnostic.swState}</p>
                            </div>
                            <div>
                                <p className="text-[7px] font-bold text-blue-300 uppercase tracking-widest mb-0.5 text-purple-400">Last Push</p>
                                <p className="text-[10px] font-black uppercase text-purple-300">{diagnostic.lastPush || 'NINGUNO'}</p>
                            </div>
                            
                            <div className="col-span-2 space-y-2">
                                <div className="bg-white/5 p-2 rounded-xl">
                                    <p className="text-[7px] font-bold text-blue-300 uppercase tracking-widest mb-1">Detección UA:</p>
                                    <p className="text-[8px] font-mono break-all opacity-80 leading-tight">{diagnostic.ua}</p>
                                </div>
                                <div className="bg-white/5 p-2 rounded-xl">
                                    <p className="text-[7px] font-bold text-blue-300 uppercase tracking-widest mb-1">Token Actual:</p>
                                    <p className="text-[9px] font-mono font-black text-blue-200">{diagnostic.token}</p>
                                </div>
                                {diagnostic.fcmError && (
                                    <div className="bg-rose-500/20 p-2 rounded-xl border border-rose-500/30">
                                        <p className="text-[7px] font-bold text-rose-300 uppercase tracking-widest mb-1">Error Detectado:</p>
                                        <p className="text-[8px] font-mono leading-tight">{diagnostic.fcmError}</p>
                                    </div>
                                )}
                            </div>

                            <div className="col-span-2 grid grid-cols-2 gap-2 mt-2">
                                {diagnostic.browserPerm !== 'granted' && (
                                    <button
                                        onClick={handleRequestNativePermission}
                                        className="col-span-2 bg-blue-500 hover:bg-blue-600 text-[10px] font-black uppercase text-white py-4 px-2 rounded-xl shadow-lg shadow-blue-500/20 transition-all flex items-center justify-center gap-2 animate-bounce-slow"
                                    >
                                        🔔 PEDIR PERMISO NATIVO
                                    </button>
                                )}
                                <button
                                    onClick={retrieveToken}
                                    className="col-span-1 bg-emerald-500/20 hover:bg-emerald-500/40 text-[9px] font-black uppercase text-emerald-300 py-3 px-2 rounded-xl border-2 border-emerald-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    🔄 FORZAR TOKEN
                                </button>
                                <button
                                    onClick={handleDeepUpdate}
                                    className="col-span-1 bg-purple-500/20 hover:bg-purple-500/40 text-[9px] font-black uppercase text-purple-300 py-3 px-2 rounded-xl border-2 border-purple-500/30 transition-all flex items-center justify-center gap-2"
                                >
                                    🚀 ACTUALIZAR
                                </button>
                                <button
                                    onClick={handleResetPermissions}
                                    className="col-span-1 bg-rose-500/10 hover:bg-rose-500/20 text-[9px] font-black uppercase text-rose-300/60 py-3 px-2 rounded-xl border border-rose-500/10 transition-all flex items-center justify-center gap-2"
                                >
                                    LIMPIAR DB
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeBannerPhase === 'large' && (
                <NotificationPermissionPrompt
                    user={user}
                    userData={userData}
                    config={config}
                    onNotificationGranted={handlePermissionGranted}
                    onPhaseEnd={(triggerCooldown) => {
                        handleInteraction(triggerCooldown);
                        setActiveBannerPhase('none');
                    }}
                />
            )}


            {/* GREETING LINE */}
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                <div 
                    className="bg-white/80 backdrop-blur-md w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-purple-50 text-purple-600 cursor-zoom-in active:scale-95 transition-all overflow-hidden"
                    onClick={() => {
                        const photo = userData?.photoUrl || userData?.foto;
                        if (photo) setZoomedPhoto(photo);
                    }}
                >
                    {userData?.photoUrl || userData?.foto ? (
                        <img src={userData.photoUrl || userData.foto} alt="Perfil" className="w-full h-full object-cover" />
                    ) : (
                        <UserIcon size={28} strokeWidth={2.5} />
                    )}
                </div>
                    <div>
                        <div className="flex items-center gap-2">
                            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">Hola,</span>
                            {(userData?.socioNumber || userData?.numeroSocio) && (
                                <span className="bg-purple-100 text-purple-700 text-[9px] font-black px-2 py-0.5 rounded-full uppercase tracking-tighter">
                                    Socio #{userData.socioNumber || userData.numeroSocio}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                            <h2 className="text-2xl font-black uppercase tracking-tight text-[#4a148c] leading-none">
                                {displayName}
                            </h2>
                            {userData?.isTestUser && (
                                <span className="bg-blue-600 text-white text-[9px] font-black px-1.5 py-0.5 rounded shadow-sm flex items-center gap-1 uppercase animate-pulse">
                                    <Shield size={10} /> Tester
                                </span>
                            )}
                        </div>
                    </div>
                </div>

                {/* LogOut Button - Moved here from Header */}
                <button
                    onClick={() => setShowLogoutConfirm(true)}
                    className="h-11 px-4 bg-white/80 backdrop-blur-md rounded-2xl flex items-center gap-2 shadow-sm border border-gray-100 text-gray-400 hover:text-rose-500 hover:border-rose-100 transition-all active:scale-90"
                    title="Cerrar Sesión"
                >
                    <span className="text-[10px] font-black uppercase tracking-widest">Salir</span>
                    <LogOut size={18} />
                </button>
            </div>

            {/* Logout Confirmation */}
            <ModernConfirmModal
                isOpen={showLogoutConfirm}
                title="Cerrar Sesión"
                message="¿Estás seguro que deseas salir de tu cuenta?"
                onConfirm={handleLogout}
                onCancel={() => setShowLogoutConfirm(false)}
                confirmText="Sí, salir"
                type="danger"
            />

            {/* FLASH OFFER BANNER (DYNAMIC MARKETING) */}
            {activeFlash && (
                <div className="bg-gradient-to-r from-red-600 via-orange-500 to-red-600 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden animate-pulse-slow border-4 border-white/20">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Clock size={80} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-2">
                            <Sparkles size={20} className="animate-bounce" />
                            <span className="text-[10px] font-black uppercase tracking-[0.3em]">¡OFERTA FLASH ACTIVA!</span>
                        </div>
                        <h3 className="text-2xl font-black tracking-tight mb-1 uppercase italic">
                            {activeFlash.flashTitle || activeFlash.title || activeFlash.name}
                        </h3>
                        <div className="flex items-center gap-3 mt-3">
                            <div className="bg-white/20 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shrink-0">
                                <p className="text-[8px] font-bold uppercase opacity-80 mb-0.5">Finaliza en:</p>
                                <CountdownTimer targetTime={activeFlash.endTime as string} />
                            </div>
                            <div className="flex flex-col min-w-0">
                                <span className="text-xl font-black leading-none truncate">
                                    {activeFlash.flashRewardType === 'TEXT'
                                        ? activeFlash.flashRewardText
                                        : activeFlash.flashRewardType === 'MULTIPLIER'
                                            ? `x${activeFlash.flashRewardValue} Puntos`
                                            : `+${activeFlash.flashRewardValue} pts`}
                                </span>
                                <span className="text-[9px] font-bold opacity-80 uppercase tracking-tighter">¡Aprovechala ahora!</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* HERO CAROUSEL */}
            <section className="relative z-10 mx-0">
                <CampaignCarousel campaigns={carouselCampaigns} loading={false} speedSeconds={config?.carouselSpeedSeconds} />
            </section>

            {/* BIRTHDAY BANNER */}
            {(() => {
                const now = TimeService.now();
                const todayMD = `${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
                const isBirthday = userData?.birthDate?.endsWith(todayMD);

                if (isBirthday && isBirthdayVisible) {
                    return (
                        <div className="bg-gradient-to-r from-pink-500 via-purple-500 to-indigo-500 p-6 rounded-[2rem] shadow-xl text-white relative overflow-hidden animate-pulse-slow">
                            <button
                                onClick={handleHideBirthday}
                                className="absolute top-3 right-3 z-10 bg-white/20 hover:bg-white/40 p-1.5 rounded-full transition-colors"
                            >
                                <X size={16} strokeWidth={3} />
                            </button>
                            <div className="absolute top-0 right-0 p-4 opacity-20">
                                <Cake size={80} />
                            </div>
                            <div className="relative z-10 pr-6">
                                <div className="flex items-center gap-2 mb-2">
                                    <Sparkles size={20} />
                                    <span className="text-[10px] font-black uppercase tracking-[0.3em]">¡Evento Especial!</span>
                                </div>
                                <h3 className="text-2xl font-black tracking-tight mb-1">¡FELIZ CUMPLEAÑOS! 🎂</h3>
                                <p className="text-xs font-medium opacity-90">Hoy es tu día especial y queremos celebrarlo con vos. ¡Ya sumamos tus puntos de regalo! 🎁</p>
                            </div>
                        </div>
                    );
                }
                return null;
            })()}

            {/* POINTS AND BALANCE CARD */}
            <div className="relative z-10 px-0">
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden flex flex-col gap-5">

                    {/* Integrated Quadrant */}
                    <div className="grid grid-cols-2 gap-4">
                        {/* Points Section */}
                        <div className="flex flex-col justify-center border-r border-gray-50 pr-4">
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mb-1.5 leading-none">Tus puntos:</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-4xl sm:text-5xl font-black text-[#4a148c] tracking-tighter leading-none">{displayData.points}</span>
                                <span className="text-xs font-bold text-gray-400 uppercase">pts</span>
                            </div>
                        </div>

                        {/* Balance Section */}
                        <div className="flex flex-col justify-center items-end pl-2 opacity-80 text-right">
                            <div className="mb-1">
                                <p className="text-[7px] font-black text-emerald-800 uppercase tracking-widest leading-none">A favor para sumar puntos</p>
                            </div>
                            <div className="flex items-baseline gap-0.5">
                                <span className="text-xl font-black text-emerald-600 tracking-tighter leading-none">${Math.floor(balanceForCalc).toLocaleString()}</span>
                                <span className="text-[8px] font-bold text-emerald-800/40 uppercase tracking-tighter">pesos</span>
                            </div>
                            {displayData.accumulated_balance_updated_at && (
                                <p className="text-[7px] text-emerald-600/50 font-bold mt-0.5">
                                    Act: {new Date(displayData.accumulated_balance_updated_at.toDate ? displayData.accumulated_balance_updated_at.toDate() : displayData.accumulated_balance_updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="text-center bg-purple-50/50 py-3 rounded-2xl border border-purple-100/50">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Próximo Punto</p>
                        <p className="text-xs font-black text-gray-700">
                            Te faltan <span className="text-pink-600 font-black">${missing}</span> para sumar <span className="text-pink-600 font-black">1 punto</span>
                        </p>
                    </div>

                    {user && (
                        <div className="space-y-4 pt-2 border-t border-gray-50">
                            <PointsExpirationWarning userId={user.uid as string} compact={true} />

                            <div className="grid grid-cols-2 gap-3">
                                <button
                                    onClick={() => setShowExpirationModal(true)}
                                    className="text-center text-[10px] font-black text-purple-600 uppercase tracking-widest hover:text-purple-800 transition-colors flex items-center justify-center gap-1.5 py-3 bg-purple-50/50 rounded-2xl border border-purple-100/50"
                                >
                                    <Clock size={12} strokeWidth={3} />
                                    Vencimientos
                                </button>
                                <button
                                    onClick={() => navigate('/rewards')}
                                    className="text-center text-[10px] font-black text-purple-600 uppercase tracking-widest hover:text-purple-800 transition-colors flex items-center justify-center gap-1.5 py-3 bg-purple-50/50 rounded-2xl border border-purple-100/50"
                                >
                                    <Coins size={12} strokeWidth={3} />
                                    Canjear
                                </button>
                            </div>
                        </div>
                    )}

                    {/* MY PETS DASHBOARD (NEW) */}
                    {config?.enablePetModule && userData?.pets && userData.pets.length > 0 && (
                        <div className="pt-2 animate-fade-in border-t border-gray-50 mt-2">
                            <div className="flex items-center justify-between mb-3 px-1">
                                <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-widest leading-none">Mis Mascotas</h3>
                                <button onClick={() => navigate('/perfil')} className="text-[9px] font-bold text-purple-600 uppercase">Ver todas</button>
                            </div>
                            <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide -mx-1 px-1">
                                {userData.pets.map((pet: any) => (
                                    <div 
                                        key={pet.id} 
                                        className="flex flex-col items-center gap-1.5 shrink-0 group"
                                        onClick={() => {
                                            if (pet.photoUrl) setZoomedPhoto(pet.photoUrl);
                                            else navigate('/perfil');
                                        }}
                                    >
                                        <div className="w-14 h-14 rounded-2xl bg-white shadow-sm border border-gray-100 flex items-center justify-center overflow-hidden active:scale-90 transition-all cursor-zoom-in relative">
                                            {pet.photoUrl ? (
                                                <img src={pet.photoUrl} alt={pet.name} className="w-full h-full object-cover" />
                                            ) : (
                                                <div className="bg-orange-50 w-full h-full flex items-center justify-center text-orange-400">
                                                    {(pet.type || '').toLowerCase().trim() === 'perro' ? <span className="text-xl">🐶</span> : (pet.type || '').toLowerCase().trim() === 'gato' ? <span className="text-xl">🐱</span> : <span className="text-xl">🐾</span>}
                                                </div>
                                            )}
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-black text-gray-700 uppercase tracking-tighter truncate max-w-[60px] leading-none">{pet.name}</span>
                                            <span className="text-[8px] font-bold text-gray-400 uppercase tracking-tighter mt-0.5">{getPetAge(pet)}</span>
                                        </div>

                                    </div>
                                ))}
                                <button 
                                    onClick={() => navigate('/perfil?addPet=true')}
                                    className="flex flex-col items-center gap-1.5 shrink-0"
                                >
                                    <div className="w-14 h-14 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300 hover:border-purple-300 hover:text-purple-300 transition-all active:scale-90">
                                        <Plus size={20} />
                                    </div>
                                    <span className="text-[9px] font-bold text-gray-400 uppercase tracking-tighter">Más</span>
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* REFERRAL BANNER */}
            {(() => {
                const isChallengeActive = config?.referrals?.challenge?.enabled;
                return (
                    <div
                        onClick={() => navigate('/referrals')}
                        className={`bg-gradient-to-r ${isChallengeActive ? 'from-orange-500 to-rose-600 animate-flash-gentle shadow-[0_0_20px_rgba(249,115,22,0.4)]' : 'from-purple-600 to-indigo-600'} rounded-[2rem] p-6 shadow-xl text-white relative overflow-hidden active:scale-[0.98] transition cursor-pointer`}
                    >
                        <div className="absolute top-0 right-0 p-4 opacity-10">
                            {isChallengeActive ? <Sparkles size={80} /> : <UserIcon size={80} />}
                        </div>
                        <div className="relative z-10 flex items-center justify-between">
                            <div>
                                <h3 className="text-xl font-black tracking-tight mb-1 uppercase">
                                    {isChallengeActive ? '¡DESAFÍO: INVITA AMIGOS! 🚀' : 'Invita y Gana 🎁'}
                                </h3>
                                <p className="text-[10px] font-bold opacity-90 uppercase tracking-widest">
                                    {isChallengeActive ? '¡Ganá bonos extra por cada amigo que traigas!' : 'Regala puntos a tus amigos'}
                                </p>
                            </div>
                            <div className="bg-white/20 backdrop-blur-md p-2 rounded-xl">
                                <ChevronRight size={24} />
                            </div>
                        </div>
                    </div>
                );
            })()}

            {/* PROMOS VIGENTES (MODERN UNIFIED) */}
            <section className="px-2 space-y-3">
                <div className="flex justify-between items-center mb-1 px-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]" style={{ color: config.sectionTitleColor }}>Promos Vigentes</h3>
                    <span
                        onClick={() => navigate('/promos')}
                        className="text-[10px] font-black uppercase tracking-widest cursor-pointer hover:opacity-70 transition text-[#4a148c]"
                        style={{ color: config.linkColor }}
                    >
                        Ver todas ›
                    </span>
                </div>

                {listCampaigns.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {listCampaigns.map((camp) => (
                            <div key={camp.id} className="bg-white rounded-2xl p-3 flex items-center justify-between gap-3 shadow-sm border border-gray-100 overflow-hidden relative">
                                {camp.imageUrl && (
                                    <div className="absolute inset-0 opacity-[0.03] pointer-events-none">
                                        <img src={camp.imageUrl} className="w-full h-full object-cover" alt="" />
                                    </div>
                                )}
                                <div className="flex items-center gap-3 relative z-10 w-full overflow-hidden">
                                    <div className="bg-purple-100 p-2 rounded-xl text-purple-600 shrink-0">
                                        {camp.imageUrl ? (
                                            <img src={camp.imageUrl} className="w-10 h-10 rounded-lg object-cover" alt="" />
                                        ) : (
                                            <Calendar size={20} />
                                        )}
                                    </div>
                                    <div className="overflow-hidden">
                                        <h4 className="text-[11px] font-black uppercase tracking-tight leading-tight text-gray-800 line-clamp-1">
                                            {camp.showTitle !== false ? (camp.title || camp.name) : (camp.title || '')}
                                        </h4>
                                        {camp.showDescription !== false && camp.description && (
                                            <p className="text-[10px] text-gray-500 font-medium mt-0.5 line-clamp-1">
                                                {camp.description}
                                            </p>
                                        )}
                                        {camp.endDate && (
                                            <div className="flex items-center gap-1 mt-1">
                                                <span className="bg-amber-50 text-amber-600 text-[8px] font-bold px-1.5 py-0.5 rounded-md border border-amber-100/50 uppercase flex items-center gap-1">
                                                    📅 Vence: {new Date(camp.endDate + 'T23:59:59').toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                                </span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <button
                                    onClick={() => {
                                        if (camp.actionUrl || camp.link) {
                                            setSelectedPromo(camp);
                                        } else {
                                            toast('Solo informativo... consultanos en el local!', {
                                                icon: '📢',
                                                style: {
                                                    borderRadius: '10px',
                                                    background: '#333',
                                                    color: '#fff',
                                                },
                                            });
                                        }
                                    }}
                                    className="bg-purple-50 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest border border-purple-100 shrink-0 text-purple-700 relative z-10"
                                >
                                    {camp.buttonText || 'Ver detalles'}
                                </button>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div
                        onClick={() => navigate('/promos')}
                        className="bg-white rounded-2xl p-6 text-center border-2 border-dashed border-gray-100 cursor-pointer active:scale-95 transition group hover:border-purple-200"
                    >
                        <div className="bg-purple-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-3 text-purple-600 group-hover:scale-110 transition">
                            <Sparkles size={24} />
                        </div>
                        <h4 className="font-bold text-gray-400 text-xs uppercase tracking-wide">No hay promos destacadas hoy</h4>
                        <p className="text-[10px] text-purple-600 font-bold mt-1">¡Toca para ver todo el catálogo de promociones!</p>
                    </div>
                )
                }
            </section >

            {/* MI ACTIVIDAD */}
            <section className="px-2 space-y-3">
                <div className="flex justify-between items-center mb-1 px-2">
                    <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]" style={{ color: config.sectionTitleColor }}>Mi Actividad</h3>
                    <span
                        onClick={() => navigate('/activity')}
                        className="text-[10px] font-black uppercase tracking-widest cursor-pointer hover:opacity-70 transition text-[#4a148c]"
                        style={{ color: config.linkColor }}
                    >
                        Ver todo ›
                    </span>
                </div>

                <div className="flex flex-col gap-3 max-h-80 overflow-y-auto scrollbar-hide pr-1 pb-4">
                    <RecentActivityList uid={user?.uid} />
                </div>
            </section>

            <PointsExpirationModal
                isOpen={showExpirationModal}
                userId={user?.uid as string}
                onClose={() => setShowExpirationModal(false)}
            />

            {selectedPromo && (
                <CampaignActionModal
                    isOpen={!!selectedPromo}
                    onClose={() => setSelectedPromo(null)}
                    title={(selectedPromo as any).title || (selectedPromo as any).name}
                    description={(selectedPromo as any).description}
                    actionUrl={(selectedPromo as any).actionUrl || (selectedPromo as any).link}
                    actionText={(selectedPromo as any).actionText || (selectedPromo as any).buttonText}
                />
            )}

            <PWAInstallAdvantageModal
                isOpen={showPWAAdvantages}
                onClose={async () => {
                    const nowTs = TimeService.now().getTime();
                    const deviceKey = isMobileDevice ? 'Mobile' : 'PC';
                    const dbFieldStats = `pwaPromptStats${deviceKey}`;
                    const stats = userData?.[dbFieldStats] || {};
                    const currentCount = stats.currentCycleCount || 0;
                    const messaging = config?.messaging || {};
                    const maxAttempts = Number(messaging.pwaInstallPromptMaxAttempts) || 3;

                    if (currentCount >= maxAttempts && user?.uid) {
                        const resetDays = Number(messaging.pwaInstallPromptResetDays) || 30;
                        const nextPrompt = nowTs + (resetDays * 24 * 3600 * 1000);
                        const prefix = isMobileDevice ? 'mobile_' : 'pc_';
                        await updateDoc(doc(db, 'users', user.uid), {
                            [`permissions.notifications.${prefix}status`]: 'blocked',
                            'permissions.notifications.status': 'blocked',
                            [`permissions.notifications.${prefix}nextPrompt`]: nextPrompt,
                            'permissions.notifications.updatedAt': nowTs
                        }).catch(console.error);
                        toast(`Nos vemos en ${resetDays} días, recuerda que puedes cambiar los permisos desde tu perfil`, { icon: '🤝', duration: 6000 });
                    }
                    setShowPWAAdvantages(false);
                }}
                isIOS={isIOS}
                mode={gloriaMode}
                onInstall={async () => {
                    const now = TimeService.now().getTime();
                    const deviceKey = isMobileDevice ? 'Mobile' : 'PC';
                    const dbFieldStats = `pwaPromptStats${deviceKey}`;

                    if (gloriaMode === 'permissions') {
                        try {
                            const permission = await Notification.requestPermission();
                            if (permission === 'granted') {
                                toast.success('¡Notificaciones activadas!', { icon: '🔔' });
                                
                                // REGLA DE ORO: Reiniciar contador de Gloria a 0 por éxito
                                if (user?.uid) {
                                    updateDoc(doc(db, 'users', user.uid), {
                                        'permissions.notifications.status': 'granted',
                                        [`permissions.notifications.${isMobileDevice ? 'mobile_' : 'pc_'}status`]: 'granted',
                                        [`permissions.notifications.updatedAt`]: now,
                                        [`${dbFieldStats}.currentCycleCount`]: 0, // RESET por éxito con permisos
                                        [`${dbFieldStats}.lastUpdate`]: now
                                    }).catch(console.error);
                                }

                                if (typeof (window as any).retrieveToken === 'function') {
                                    (window as any).retrieveToken();
                                }
                            } else {
                                toast.error('No se pudieron activar. Revisa los ajustes de tu navegador.');
                            }
                        } catch (e) {
                            console.error(e);
                        }
                    } else {
                        if (isIOS) {
                            toast('Para instalar: Toca "Compartir" y luego "Agregar a Inicio"', { icon: '📲' });
                        } else {
                            handleInstall();
                        }
                        
                        // REGLA DE ORO: Si acepta instalar, marcamos éxito total y reseteamos
                        if (user?.uid) {
                            updateDoc(doc(db, 'users', user.uid), {
                                pwaInstalled: true,
                                pwaInstalledAt: now,
                                [`${dbFieldStats}.currentCycleCount`]: 0,
                                [`${dbFieldStats}.lastUpdate`]: now
                            }).catch(console.error);
                        }
                    }
                    setShowPWAAdvantages(false);
                }}
            />
            {/* BOTTOM PADDING (SAFETY) */}
            <div className="h-8"></div>
            {/* PHOTO ZOOM MODAL */}
            {zoomedPhoto && (
                <div 
                    className="fixed inset-0 z-[1000] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in"
                    onClick={() => setZoomedPhoto(null)}
                >
                    <div className="relative max-w-sm w-full animate-zoom-in">
                        <button className="absolute -top-12 right-0 text-white p-2">
                            <X size={32} />
                        </button>
                        <img 
                            src={zoomedPhoto} 
                            alt="Zoomed" 
                            className="w-full aspect-square object-cover rounded-[3rem] shadow-2xl border-4 border-white/20"
                            onClick={(e) => e.stopPropagation()}
                        />
                    </div>
                </div>
            )}
        </div>
    );
};
