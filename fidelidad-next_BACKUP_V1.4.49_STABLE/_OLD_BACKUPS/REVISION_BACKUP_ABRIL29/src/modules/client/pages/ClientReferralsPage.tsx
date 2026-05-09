import React, { useEffect, useState } from 'react';
import { useOutletContext } from 'react-router-dom';
import { auth, db } from '../../../lib/firebase';
import { doc, onSnapshot, updateDoc } from 'firebase/firestore';
import { Share2, Copy, Users, Gift, ArrowRight, CheckCircle2, Megaphone, Zap, Clock, Trophy } from 'lucide-react';
import { collection, query, where } from 'firebase/firestore';
import toast from 'react-hot-toast';

export const ClientReferralsPage = () => {
    const { config } = useOutletContext<{ config: any }>();
    const [userData, setUserData] = useState<any>(null);
    const [copied, setCopied] = useState(false);

    const [challengeCount, setChallengeCount] = useState(0);

    useEffect(() => {
        const user = auth.currentUser;
        if (!user) return;

        const unsub = onSnapshot(doc(db, 'users', user.uid), async (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                setUserData(data);

                // AUTO-GENERACIÓN para socios antiguos
                if (!data.referralCode) {
                    const namePart = (data.name || data.nombre || 'SOCIO').split(' ')[0].toUpperCase();
                    const newCode = `${namePart}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;
                    await updateDoc(doc(db, 'users', user.uid), {
                        referralCode: newCode,
                        referralStats: data.referralStats || { count: 0, pointsEarned: 0 }
                    });
                }
            }
        });

        // Contar referidos que califican para el desafío actual
        const challenge = config?.referrals?.challenge;
        let unsubChallenge = () => { };

        if (challenge?.enabled) {
            const startDate = new Date(challenge.startDate);
            const endDate = new Date(challenge.endDate);
            endDate.setHours(23, 59, 59, 999);

            const q = query(
                collection(db, 'users'),
                where('referrerUid', '==', user.uid),
                where('createdAt', '>=', startDate),
                where('createdAt', '<=', endDate)
            );

            unsubChallenge = onSnapshot(q, (snap) => {
                setChallengeCount(snap.size);
            });
        }

        return () => {
            unsub();
            unsubChallenge();
        };
    }, [config?.referrals?.challenge]);

    const referralCode = userData?.referralCode || 'GENERANDO...';
    // Usar la URL base de la config si existe, sino window.location
    const baseUrl = config?.contact?.pwaUrl || window.location.origin;
    const referralLink = `${baseUrl}/register?ref=${referralCode}`;

    const handleCopy = () => {
        if (referralCode === 'GENERANDO...') return;
        navigator.clipboard.writeText(referralLink);
        setCopied(true);
        toast.success('¡Enlace copiado!');
        setTimeout(() => setCopied(false), 2000);
    };

    const handleShare = () => {
        if (referralCode === 'GENERANDO...') return;
        const siteName = config?.siteName || import.meta.env.VITE_APP_NAME || 'Sistema de Beneficios';
        const points = config?.referrals?.pointsForReferee || 100;
        const text = `¡Hola! 👋 Te invito a sumarte a ${siteName}. Registrate con mi link y ganá ${points} puntos de regalo para tu primer premio: ${referralLink}`;
        const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
        
        // Parche para evitar bloqueadores de popups
        const link = document.createElement('a');
        link.href = whatsappUrl;
        link.target = '_blank';
        link.rel = 'noopener noreferrer';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    if (!userData) return (
        <div className="p-8 flex items-center justify-center min-h-[60vh]">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600"></div>
        </div>
    );

    return (
        <div className="p-4 space-y-8 animate-fade-in pb-20">
            {/* Hero Section */}
            <div className="text-center space-y-4">
                <div className="w-20 h-20 bg-gradient-to-tr from-purple-500 to-pink-500 rounded-3xl mx-auto flex items-center justify-center shadow-xl shadow-purple-200 rotate-3">
                    <Users size={40} className="text-white" />
                </div>
                <h2 className="text-3xl font-black text-gray-800 tracking-tight leading-tight">
                    Invita Amigos y <br />
                    <span className="text-purple-600">Gana Premios</span>
                </h2>
                <p className="text-gray-500 font-medium px-4">
                    Regala puntos a tus amigos y recibí una recompensa cuando realicen su primer consumo.
                </p>
            </div>

            {/* Reward Summary */}
            <div className="grid grid-cols-2 gap-4">
                <div className="bg-white p-5 rounded-[2rem] border-2 border-purple-50 shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Regalas</p>
                    <p className="text-2xl font-black text-purple-600">+{config?.referrals?.pointsForReferee || 100}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Puntos</p>
                </div>
                <div className="bg-white p-5 rounded-[2rem] border-2 border-pink-50 shadow-sm text-center">
                    <p className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-1">Recibís</p>
                    <p className="text-2xl font-black text-pink-600">+{config?.referrals?.pointsForReferrer || 200}</p>
                    <p className="text-[10px] font-bold text-gray-500 uppercase">Puntos</p>
                </div>
            </div>

            {/* Referral Challenge Section */}
            {config?.referrals?.challenge?.enabled && (
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-[2.5rem] p-6 text-white shadow-xl relative overflow-hidden animate-in zoom-in-95 duration-500">
                    <div className="absolute -top-4 -right-4 w-24 h-24 bg-white/10 rounded-full blur-2xl"></div>
                    <div className="absolute -bottom-8 -left-8 w-32 h-32 bg-black/10 rounded-full blur-3xl"></div>

                    <div className="flex justify-between items-start mb-6">
                        <div className="space-y-1">
                            <h3 className="text-xl font-black tracking-tight flex items-center gap-2 uppercase">
                                <Zap className="fill-current text-yellow-300" size={20} /> Desafío: Invita un Amigo
                            </h3>
                            <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider bg-black/20 px-2 py-1 rounded-full w-fit">
                                <Clock size={12} /> termina el {(new Date(config.referrals.challenge.endDate)).toLocaleDateString('es-AR', { day: 'numeric', month: 'long' })}
                            </div>
                        </div>
                        <div className="bg-white/20 p-3 rounded-2xl backdrop-blur-sm border border-white/20">
                            <Trophy size={24} />
                        </div>
                    </div>

                    <div className="space-y-4 relative z-10">
                        <div className="flex justify-between items-end">
                            <p className="text-xs font-bold opacity-80 uppercase tracking-widest">Tu Progreso</p>
                            <p className="text-2xl font-black">{challengeCount} <span className="text-sm font-bold opacity-70">amigos</span></p>
                        </div>

                        {/* Progress Bar Multi-Tier */}
                        <div className="space-y-3">
                            <div className="h-4 w-full bg-black/20 rounded-full overflow-hidden p-1 border border-white/10">
                                {(() => {
                                    const tiers = config.referrals.challenge.tiers.sort((a: any, b: any) => a.count - b.count);
                                    const maxCount = tiers[tiers.length - 1]?.count || 5;
                                    const percentage = Math.min((challengeCount / maxCount) * 100, 100);
                                    return (
                                        <div
                                            className="h-full bg-gradient-to-r from-yellow-300 to-white rounded-full transition-all duration-1000 shadow-[0_0_10px_rgba(255,255,255,0.5)]"
                                            style={{ width: `${percentage}%` }}
                                        />
                                    );
                                })()}
                            </div>

                            <div className="flex justify-between px-1">
                                {config.referrals.challenge.tiers.sort((a: any, b: any) => a.count - b.count).map((tier: any, idx: number) => (
                                    <div key={idx} className="flex flex-col items-center">
                                        <div className={`w-1 h-2 rounded-full mb-1 ${challengeCount >= tier.count ? 'bg-white' : 'bg-white/30'}`} />
                                        <p className={`text-[12px] font-black ${challengeCount >= tier.count ? 'text-white' : 'text-white/50'}`}>
                                            {tier.count}am
                                        </p>
                                        <p className={`text-[10px] font-bold ${challengeCount >= tier.count ? 'text-white' : 'text-white/50'}`}>
                                            +{tier.bonus}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="pt-2">
                            <p className="text-[10px] font-medium leading-tight opacity-90 italic bg-white/10 p-3 rounded-xl border border-white/10">
                                💡 ¡Sumá amigos antes del fin del desafío y ganá bonos extra de hasta {Math.max(...config.referrals.challenge.tiers.map((t: any) => t.bonus))} puntos!
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* Share Card */}
            <div className="bg-gray-900 rounded-[2.5rem] p-8 text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/20 rounded-full blur-3xl -mr-16 -mt-16"></div>

                <h3 className="text-sm font-black uppercase tracking-widest text-purple-300 mb-6 flex items-center gap-2">
                    <Share2 size={16} /> Tu Enlace de Invitación
                </h3>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-4 mb-6 border border-white/10 flex items-center justify-between overflow-hidden">
                    <code className="text-[11px] font-bold text-gray-200 truncate pr-4 opacity-80">
                        {referralLink}
                    </code>
                    <button
                        onClick={handleCopy}
                        className="p-2 hover:bg-white/10 rounded-lg transition active:scale-95 flex-shrink-0"
                    >
                        {copied ? <CheckCircle2 size={20} className="text-green-400" /> : <Copy size={20} />}
                    </button>
                </div>

                {(() => {
                    const siteName = config?.siteName || import.meta.env.VITE_APP_NAME || 'Sistema de Beneficios';
                    const points = config?.referrals?.pointsForReferee || 100;
                    const text = `¡Hola! 👋 Te invito a sumarte a ${siteName}. Registrate con mi link y ganá ${points} puntos de regalo para tu primer premio: ${referralLink}`;
                    const whatsappUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
                    
                    return (
                        <a
                            href={whatsappUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="w-full bg-white text-gray-900 py-4 rounded-2xl font-black text-sm hover:bg-purple-100 transition-all flex items-center justify-center gap-3 active:scale-95 shadow-lg no-underline"
                        >
                            Compartir por WhatsApp
                        </a>
                    );
                })()}
            </div>

            {/* Stats / How it works */}
            <div className="space-y-4">
                <h3 className="text-sm font-black uppercase tracking-widest text-gray-400 ml-2">¿Cómo funciona?</h3>
                <div className="bg-white rounded-[2rem] p-6 border border-gray-100 space-y-6">
                    <div className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-2xl bg-orange-50 flex items-center justify-center flex-none text-orange-500">
                            <Megaphone size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800 text-sm">1. Compartí tu link</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">Tus amigos se registran y reciben puntos de regalo.</p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-2xl bg-blue-50 flex items-center justify-center flex-none text-blue-500">
                            <Gift size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800 text-sm">2. Ellos visitan el local</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">Cuando tu amigo realiza su primera carga de puntos o canje.</p>
                        </div>
                    </div>

                    <div className="flex gap-4 items-start">
                        <div className="w-10 h-10 rounded-2xl bg-green-50 flex items-center justify-center flex-none text-green-500">
                            <CheckCircle2 size={20} />
                        </div>
                        <div>
                            <p className="font-bold text-gray-800 text-sm">3. ¡Ganás vos!</p>
                            <p className="text-xs text-gray-500 font-medium mt-0.5">Se te asignan automáticamente tus {config?.referrals?.pointsForReferrer || 200} puntos de bono.</p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Current Stats */}
            <div className="bg-white rounded-[2rem] p-6 border-2 border-gray-50 flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-purple-50 rounded-2xl flex items-center justify-center text-purple-600">
                        <Users size={24} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Amigos traídos</p>
                        <p className="text-xl font-black text-gray-800">{userData.referralStats?.count || 0}</p>
                    </div>
                </div>
                <div className="text-right">
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">Puntos ganados</p>
                    <p className="text-xl font-black text-purple-600">+{userData.referralStats?.pointsEarned || 0}</p>
                </div>
            </div>
        </div>
    );
};
