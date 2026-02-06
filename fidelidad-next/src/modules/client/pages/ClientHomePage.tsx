import { useEffect, useState } from 'react';
import { auth, db } from '../../../lib/firebase';
import { doc, onSnapshot, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { useNavigate, useOutletContext } from 'react-router-dom';
import { LogOut, Calendar, Sparkles, Bell } from 'lucide-react';
import { signOut } from 'firebase/auth';
import toast from 'react-hot-toast';
import { CampaignService, type BonusRule } from '../../../services/campaignService';
import { CampaignCarousel } from '../components/CampaignCarousel';
import { PointsExpirationWarning } from '../components/PointsExpirationWarning';
import { NotificationPermissionPrompt } from '../components/NotificationPermissionPrompt'; // New Import
import { useFcmToken } from '../../../hooks/useFcmToken'; // New Import

// Subcomponent for the list to keep main component clean
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

export const ClientHomePage = () => {
    const [user, setUser] = useState<any>(null);
    const [userData, setUserData] = useState<any>(null);
    const { config } = useOutletContext<{ config: any }>();

    const [campaigns, setCampaigns] = useState<BonusRule[]>([]);

    const navigate = useNavigate();

    const handleLogout = async () => {
        try {
            await signOut(auth);
            navigate('/login');
        } catch (error) {
            console.error('Error signing out:', error);
        }
    };

    useEffect(() => {
        const unsubscribeAuth = auth.onAuthStateChanged(async (u) => {
            setUser(u);
            if (u) {
                // Registro de Actividad (Ping)
                const userRef = doc(db, 'users', u.uid);

                // Actualizar última actividad y contador de forma silenciosa e inmediata
                // Throttle: solo una vez por sesión de pestaña (o cada 30 min) para no inflar el historial
                const lastPing = sessionStorage.getItem(`ping_${u.uid}`);
                const nowMs = Date.now();

                if (!lastPing || (nowMs - Number(lastPing) > 30 * 60 * 1000)) {
                    try {
                        const { updateDoc, increment, serverTimestamp, collection, addDoc } = await import('firebase/firestore');
                        await updateDoc(userRef, {
                            lastActive: serverTimestamp(),
                            visitCount: increment(1)
                        });
                        // Guardar en historial para analítica de frecuencia
                        await addDoc(collection(db, 'users', u.uid, 'visit_history'), {
                            date: serverTimestamp(),
                            type: 'app_open',
                            clientName: displayName,
                            clientEmail: u.email,
                            platform: 'pwa',
                            location: userData?.lastLocation || null
                        });
                        sessionStorage.setItem(`ping_${u.uid}`, nowMs.toString());
                    } catch (e) {
                        console.error("Error updating activity:", e);
                    }
                }

                const unsubDb = onSnapshot(userRef, async (document) => {
                    const data = document.data();
                    setUserData(data);
                });
                return () => unsubDb();
            }
        });
        return () => unsubscribeAuth();
    }, []);

    useEffect(() => {
        const fetchCampaigns = async () => {
            try {
                const fetched = await CampaignService.getActiveBonusesForToday();
                setCampaigns(fetched);
            } catch (error) {
                console.error('Error fetching campaigns:', error);
            }
        };

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

        fetchCampaigns();
    }, [user?.uid]);

    const homeBanners = campaigns.filter(c => c.showInHomeBanner);

    const displayData = userData || {
        name: user?.displayName || 'Invitado',
        points: 0,
        accumulated_balance: 0
    };

    const displayName = userData?.name || userData?.nombre || user?.displayName || 'Invitado';

    const pointsRatio = Number(config?.pointsPerPeso || 1);
    const moneyBase = Number(config?.pointsMoneyBase || 100);
    const costPerPoint = moneyBase / pointsRatio;
    const rawBalance = Number(displayData.accumulated_balance || 0);
    const balanceForCalc = rawBalance % costPerPoint;
    const missing = Math.ceil(costPerPoint - balanceForCalc);

    // Prompt Logic
    const { retrieveToken } = useFcmToken(); // Modificar hook para devolver esto
    const handlePermissionGranted = () => {
        retrieveToken();
    };

    return (
        <div className="relative font-sans text-gray-800 px-4 pt-6 space-y-6">
            <NotificationPermissionPrompt
                user={user}
                userData={userData}
                onNotificationGranted={handlePermissionGranted}
            />


            {/* GREETING LINE */}
            <div className="flex justify-between items-center px-2">
                <div className="flex items-center gap-3">
                    <div className="bg-white/80 backdrop-blur-md w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm border border-purple-50">
                        <img
                            src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${displayName}`}
                            alt="Avatar"
                            className="w-9 h-9 rounded-full"
                        />
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
                        <h2 className="text-2xl font-black uppercase tracking-tight text-[#4a148c] leading-none mt-1">
                            {displayName}
                        </h2>
                    </div>
                </div>
            </div>

            {/* HERO CAROUSEL */}
            <section className="relative z-10 mx-0">
                <CampaignCarousel />
            </section>

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
                        <div className="text-right">
                            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">Saldo a favor</p>
                            <p className="text-2xl font-black text-gray-600 tracking-tight">${Math.floor(balanceForCalc)}</p>
                        </div>
                    </div>

                    <div className="text-center bg-purple-50 py-2 rounded-xl">
                        <p className="text-xs font-bold text-gray-600 uppercase tracking-tight">
                            Te faltan <span className="text-pink-600 font-black">${missing}</span> para sumar <span className="text-pink-600 font-black">1 punto</span>
                        </p>
                    </div>

                    {user && (
                        <div className="space-y-2 py-2 border-t border-gray-50">
                            <PointsExpirationWarning userId={user.uid} compact={true} />
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

                {homeBanners.length > 0 ? (
                    <div className="flex flex-col gap-3">
                        {homeBanners.map((camp) => (
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
                                        if (camp.link) {
                                            if (camp.link.startsWith('http')) {
                                                window.location.href = camp.link;
                                            } else {
                                                navigate(camp.link);
                                            }
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
        </div >
    );
};
