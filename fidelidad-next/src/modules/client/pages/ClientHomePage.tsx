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
    Coins
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

    const prevPointsRef = useRef<number | null>(null);
    const lastActionTs = useRef<number>(0);
    const initialLoadTs = useRef<number>(Date.now());
    const [readyForBanner, setReadyForBanner] = useState(false);

    useEffect(() => {
        const timer = setTimeout(() => setReadyForBanner(true), 1600);
        return () => clearTimeout(timer);
    }, []);
    const isMobileDevice = useMemo(() => {
        if (typeof window === 'undefined') return false;
        const ua = navigator.userAgent;
        const isMobileUA = /iPhone|iPad|iPod|Android/i.test(ua);
        const isIPadOS = (navigator.maxTouchPoints > 0 && /Macintosh/.test(ua));
        return isMobileUA || isIPadOS;
    }, []);
    const isCondensed = useMemo(() => {
        if (typeof window === 'undefined') return false;
        return window.innerWidth < 768;
    }, []);
    const isMobile = isMobileDevice || isCondensed;

    const handleInteraction = (triggerCooldown: boolean = true) => {
        const now = TimeService.now().getTime();
        lastActionTs.current = now;
        if (triggerCooldown && isMobileDevice && user) {
            updateDoc(doc(db, 'users', user.uid), {
                'permissions.global_lastMobileDismissal': now
            }).catch(console.error);
        }
    };

    const { config } = useOutletContext<{ config: any }>();

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

    useEffect(() => {
        if (user && !userData && !authLoading && !isAdmin) {
            // This might happen if auth is ok but firestore doc is missing
            console.warn("User authenticated but no firestore data found.");
        }

        if (user) {
            // Registro de Actividad (Ping / Visita)
            (async () => {
                try {
                    const sessionKey = `vcount_${user.uid}_${new Date().toISOString().split('T')[0]}`;
                    const sessionVisitId = sessionStorage.getItem('current_visit_id');
                    const hasCountedToday = sessionStorage.getItem(sessionKey);

                    // Si no tenemos ID de visita en esta sesión, es una visita nueva (por Login o por abrir pestaña)
                    if (!sessionVisitId) {
                        const newVisitId = Math.random().toString(36).substring(7);
                        sessionStorage.setItem('current_visit_id', newVisitId);

                        const { updateDoc, increment, serverTimestamp, collection, addDoc } = await import('firebase/firestore');
                        const userRef = doc(db, 'users', user.uid);
                        const currentName = userData?.name || userData?.nombre || user.displayName || (isAdmin ? 'Admin' : 'Socio');

                        if (!isAdmin) {
                            await updateDoc(userRef, {
                                lastActive: serverTimestamp(),
                                visitCount: increment(1)
                            });
                        }

                        await addDoc(collection(db, 'users', user.uid, 'visit_history'), {
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

    // --- NOTIFICATION REALITY SYNC ---
    useEffect(() => {
        const syncReality = async () => {
            if (!userData || !user || !config) return;
            const browserState = typeof Notification !== 'undefined' ? Notification.permission : 'default';
            const dbStatus = userData.permissions?.notifications?.status;

            if (browserState === 'granted' && dbStatus !== 'granted') {
                // SOLO sincronizar a 'granted' si NO está en 'denied' (manual del usuario)
                if (dbStatus === 'pending' || dbStatus === 'later' || !dbStatus) {
                    await updateDoc(doc(db, 'users', user.uid), {
                        'permissions.notifications.status': 'granted',
                        'permissions.notifications.updatedAt': TimeService.now().getTime()
                    });
                }
            } else if (browserState !== 'granted' && dbStatus === 'granted') {
                await updateDoc(doc(db, 'users', user.uid), {
                    'permissions.notifications.status': browserState === 'denied' ? 'denied' : 'pending',
                    'permissions.notifications.updatedAt': TimeService.now().getTime()
                });
            }
        };
        syncReality();

        // Also sync on window focus (if they came back from settings)
        window.addEventListener('focus', syncReality);
        return () => window.removeEventListener('focus', syncReality);
    }, [userData?.permissions?.notifications?.status, user?.uid]);

    // Prompt Logic
    const { retrieveToken } = useFcmToken();
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

            const canShowNotif = (notifStatus === 'pending' || notifStatus === 'later' || notifStatus === 'later_phase1_complete') &&
                (notifStatus === 'later_phase1_complete' ? true : notifCount < maxAttempts) &&
                !isNotifCooldown &&
                browserState === 'default';

            const canShowGeo = isMobileDevice &&
                (geoStatus === 'pending' || geoStatus === 'later' || geoStatus === 'later_phase1_complete') &&
                (geoStatus === 'later_phase1_complete' ? true : geoCount < maxAttempts) &&
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
                    <div className="bg-white/80 backdrop-blur-md w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-purple-50 text-purple-600">
                        <UserIcon size={28} strokeWidth={2.5} />
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
                                    className="bg-[#ffca28] text-[#5d4037] py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(255,202,40,0.2)] active:scale-[0.98] transition"
                                >
                                    Ver premios <ChevronRight size={14} strokeWidth={3} />
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
                    title={selectedPromo.title || selectedPromo.name}
                    description={selectedPromo.description}
                    actionUrl={selectedPromo.actionUrl || selectedPromo.link}
                    actionText={selectedPromo.actionText || selectedPromo.buttonText}
                />
            )}
        </div>
    );
};
