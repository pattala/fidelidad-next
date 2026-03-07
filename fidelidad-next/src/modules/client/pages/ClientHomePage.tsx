import { useEffect, useRef, useState } from 'react';
import { auth, db } from '../../../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, limit, getDocs } from 'firebase/firestore';
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
import { ContextualPermissionBanner } from '../components/ContextualPermissionBanner';
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
    const [showContextualNotif, setShowContextualNotif] = useState(false);
    const [showContextualGeo, setShowContextualGeo] = useState(false);
    const [contextualPointsMsg, setContextualPointsMsg] = useState('');
    const prevPointsRef = useRef<number | null>(null);

    const { config } = useOutletContext<{ config: any }>();

    const [campaigns, setCampaigns] = useState<BonusRule[]>([]);

    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            // Limpiar flags de sesión para que el próximo login se tome como visita nueva
            // y se vuelvan a mostrar banners PWA si estaban en 'later'
            if (user) {
                sessionStorage.removeItem(`ping_${user.uid}`);
            }
            sessionStorage.removeItem('dismissed_notif_prompt');
            sessionStorage.removeItem('dismissed_geo_prompt');

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
            // Registro de Actividad (Ping)
            const userRef = doc(db, 'users', user.uid);
            const lastPing = sessionStorage.getItem(`ping_${user.uid}`);
            const nowMs = Date.now();

            if (!lastPing || (nowMs - Number(lastPing) > 30 * 60 * 1000)) {
                (async () => {
                    try {
                        const { updateDoc, increment, serverTimestamp, collection, addDoc } = await import('firebase/firestore');
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
                        sessionStorage.setItem(`ping_${user.uid}`, nowMs.toString());
                    } catch (e) {
                        console.error("Error updating activity:", e);
                    }
                })();
            }
        }
    }, [user, !!userData, authLoading, isAdmin]);

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
    const { retrieveToken } = useFcmToken(); // Modificar hook para devolver esto
    const handlePermissionGranted = () => {
        retrieveToken();
    };

    // Detectar cuando suben los puntos para mostrar banner contextual de notif
    useEffect(() => {
        if (!userData || !user) return;
        const currentPoints = userData.points || 0;
        if (prevPointsRef.current !== null && currentPoints > prevPointsRef.current) {
            const gained = currentPoints - prevPointsRef.current;
            const notifStatus = userData.permissions?.notifications?.status || 'pending';
            const notifPerm = typeof Notification !== 'undefined' ? Notification.permission : 'denied';

            // Fase 2 Gatekeeper: Solo si ya pasó la Fase 1 (está en dismissed o denied por standby anterior) y NO está en standby de fase 2
            const nextPrompt = userData.permissions?.notifications?.nextPrompt || 0;
            const isPhase2Ready = (notifStatus === 'dismissed' || notifStatus === 'denied') && Date.now() >= nextPrompt;

            if (isPhase2Ready && notifStatus !== 'granted' && notifStatus !== 'blocked' && notifPerm !== 'granted' && notifPerm !== 'denied') {
                setContextualPointsMsg(`¡Ganaste ${gained} puntos!`);
                setShowContextualNotif(true);
            } else {
                // Si notificaciones no aplica, probamos Geografía directamente
                const geoStatus = userData.permissions?.geolocation?.status || 'pending';
                const geoNextPrompt = userData.permissions?.geolocation?.nextPrompt || 0;
                const isGeoPhase2Ready = (geoStatus === 'dismissed' || geoStatus === 'denied') && Date.now() >= geoNextPrompt;

                if (isGeoPhase2Ready && geoStatus !== 'granted' && geoStatus !== 'blocked') {
                    setContextualPointsMsg(`¡Ganaste ${gained} puntos!`);
                    setShowContextualGeo(true);
                }
            }
        }
        prevPointsRef.current = currentPoints;
    }, [userData?.points]);

    return (
        <div
            className="relative font-sans text-gray-800 px-4 pt-4 pb-12 space-y-8 animate-fade-in"
        >
            <NotificationPermissionPrompt
                user={user}
                userData={userData}
                onNotificationGranted={handlePermissionGranted}
            />

            {showContextualNotif && (
                <ContextualPermissionBanner
                    user={user}
                    userData={userData}
                    type="notifications"
                    triggerMessage={contextualPointsMsg}
                    config={config}
                    onGranted={() => {
                        setShowContextualNotif(false);
                        handlePermissionGranted();
                        // Mostrar geo como siguiente paso (encadenamiento)
                        setTimeout(() => setShowContextualGeo(true), 800);
                    }}
                    onDismiss={() => {
                        setShowContextualNotif(false);
                        // Encadenamiento: incluso si descarta Notif, probamos Geo
                        setTimeout(() => setShowContextualGeo(true), 600);
                    }}
                    onNeverAsk={() => {
                        setShowContextualNotif(false);
                        // Encadenamiento
                        setTimeout(() => setShowContextualGeo(true), 600);
                    }}
                />
            )}

            {showContextualGeo && (
                <ContextualPermissionBanner
                    user={user}
                    userData={userData}
                    type="geolocation"
                    triggerMessage={contextualPointsMsg}
                    config={config}
                    onGranted={() => setShowContextualGeo(false)}
                    onDismiss={() => setShowContextualGeo(false)}
                    onNeverAsk={() => setShowContextualGeo(false)}
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
                    className="w-11 h-11 bg-white/80 backdrop-blur-md rounded-2xl flex items-center justify-center shadow-sm border border-gray-100 text-gray-400 hover:text-rose-500 hover:border-rose-100 transition-all active:scale-90"
                    title="Cerrar Sesión"
                >
                    <LogOut size={22} />
                </button>
            </div>

            {/* Logout Confirmation */}
            <ModernConfirmModal
                isOpen={showLogoutConfirm}
                title="Cerrar Sesión"
                message="¿Estás seguro que deseas salir de tu cuenta?"
                onConfirm={() => {
                    signOut(auth).then(() => navigate('/login'));
                }}
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
                <CampaignCarousel campaigns={carouselCampaigns} loading={false} />
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

            {/* POINTS CARD */}
            <div className="relative z-10 px-0">
                <div className="bg-white rounded-[2rem] p-6 shadow-[0_10px_30px_rgba(0,0,0,0.05)] border border-gray-100 relative overflow-hidden flex flex-col gap-4">
                    <div className="flex justify-between items-end border-b border-gray-50 pb-4 mb-2">
                        <div>
                            <p className="text-[11px] font-black text-gray-400 uppercase tracking-widest mb-1.5">Tus puntos:</p>
                            <div className="flex items-baseline gap-1">
                                <span className="text-5xl font-black text-[#4a148c] tracking-tighter leading-none">{displayData.points}</span>
                                <span className="text-sm font-bold text-gray-400 uppercase ml-1">pts</span>
                            </div>
                        </div>
                    </div>

                    <div className="text-center bg-purple-50/50 py-3 rounded-2xl border border-purple-100/50">
                        <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest mb-1">Próximo Punto</p>
                        <p className="text-xs font-black text-gray-700">
                            Te faltan <span className="text-pink-600 font-black">${missing}</span> para sumar <span className="text-pink-600 font-black">1 punto</span>
                        </p>
                    </div>

                    {user && (
                        <div className="space-y-3 py-2 border-t border-gray-50">
                            <PointsExpirationWarning userId={user.uid as string} compact={true} />

                            <div className="flex items-center justify-between bg-emerald-50/80 p-4 rounded-[1.5rem] border border-emerald-100 shadow-sm shadow-emerald-50">
                                <div className="flex flex-col">
                                    <div className="flex items-center gap-2 mb-0.5">
                                        <div className="bg-emerald-600 p-1 rounded-lg text-white">
                                            <TrendingUp size={12} />
                                        </div>
                                        <span className="text-[10px] font-black text-emerald-800 uppercase tracking-widest">Saldo a favor</span>
                                    </div>
                                    {displayData.accumulated_balance_updated_at && (
                                        <p className="text-[8px] text-emerald-600 font-bold opacity-70">
                                            Act: {new Date(displayData.accumulated_balance_updated_at.toDate ? displayData.accumulated_balance_updated_at.toDate() : displayData.accumulated_balance_updated_at).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' })}
                                        </p>
                                    )}
                                </div>
                                <div className="text-right">
                                    <span className="text-2xl font-black text-emerald-600 tracking-tight leading-none">${Math.floor(balanceForCalc).toLocaleString()}</span>
                                    <p className="text-[8px] font-bold text-emerald-800/50 uppercase tracking-tighter">pesos a cuenta</p>
                                </div>
                            </div>

                            <button
                                onClick={() => setShowExpirationModal(true)}
                                className="w-full text-center text-[10px] font-black text-purple-600 uppercase tracking-widest hover:text-purple-800 transition-colors flex items-center justify-center gap-1.5 py-2 bg-purple-50/50 rounded-xl border border-purple-100/50"
                            >
                                <Clock size={12} strokeWidth={3} />
                                Ver detalle de vencimientos
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => navigate('/rewards')}
                        className="w-full bg-[#ffca28] text-[#5d4037] py-2.5 rounded-3xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(255,202,40,0.3)] active:scale-[0.98] transition"
                    >
                        Ver premios <span className="text-xl leading-none">›</span>
                    </button>
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
