import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift, XCircle, CheckCircle2, Loader2, PartyPopper } from 'lucide-react';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { MysteryBoxService, MysteryBoxChance } from '../../../services/mysteryBoxService';
import { ConfigService } from '../../../services/configService';
import { doc, getDoc, updateDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../../../lib/firebase';
import confetti from 'canvas-confetti';

export const MysteryBoxPage = () => {
    const { id } = useParams<{ id: string }>();
    const navigate = useNavigate();
    const { user } = useClientAuth();
    
    const [chance, setChance] = useState<MysteryBoxChance | null>(null);
    const [status, setStatus] = useState<'loading' | 'auth_required' | 'ready' | 'playing' | 'won' | 'rejected' | 'invalid'>('loading');
    const [pointsWon, setPointsWon] = useState(0);
    const [errorMsg, setErrorMsg] = useState('');

    const boxRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!id) {
            setStatus('invalid');
            setErrorMsg('Enlace inválido.');
            return;
        }

        const verifyAndLoad = async () => {
            // Wait a bit for auth state to settle
            await new Promise(r => setTimeout(r, 500));

            try {
                const data = await MysteryBoxService.getChance(id);
                if (!data || data.status !== 'pending') {
                    setStatus('invalid');
                    setErrorMsg('Este enlace ya fue utilizado o ha expirado.');
                    return;
                }

                // Si el QR no fue marcado como escaneado, lo marcamos (para analíticas y seguridad)
                if (!data.qrScanned) {
                    await MysteryBoxService.markAsScanned(id);
                }

                setChance(data);

                if (!user) {
                    setStatus('auth_required');
                    return;
                }

                // Verificar si es el mismo usuario (por DNI/phone o simplemente dejarlo reclamar si es un login genérico)
                // Por ahora confiamos en que el login es suficiente
                setStatus('ready');

            } catch (err: any) {
                console.error(err);
                setStatus('invalid');
                setErrorMsg('Error al cargar la sorpresa.');
            }
        };

        verifyAndLoad();
    }, [id, user]);

    const handleLoginAndClaim = () => {
        // Here we could trigger a specific login flow or let the system handle it
        navigate('/login?redirect=/play/' + id);
    };

    const handleReject = async () => {
        if (!id) return;
        setStatus('loading');
        try {
            await MysteryBoxService.rejectChance(id);
            setStatus('rejected');
        } catch (e) {
            setStatus('invalid');
        }
    };

    const handlePlay = async () => {
        if (!id || !user) return;
        setStatus('playing');
        
        // Animación de agitar la caja
        if (boxRef.current) {
            boxRef.current.classList.add('animate-shake');
            setTimeout(() => boxRef.current?.classList.remove('animate-shake'), 1500);
        }

        try {
            // Fake delay para la animación
            await new Promise(r => setTimeout(r, 2000));

            const won = await MysteryBoxService.playChance(id);
            if (won === null) {
                setStatus('invalid');
                setErrorMsg('No se pudo procesar tu premio. Intenta nuevamente o contacta soporte.');
                return;
            }

            setPointsWon(won);
            
            // Assign points to user with short expiration
            const config = await ConfigService.get();
            const expDays = config.mysteryBox?.pointsExpirationDays || 15;
            
            // Mismo mecanismo que assignment normal pero con source "sorteo"
            const userRef = doc(db, 'users', user.uid);
            const userSnap = await getDoc(userRef);
            
            if (userSnap.exists()) {
                const userData = userSnap.data();
                const now = new Date();
                const expDate = new Date(now.getTime() + (expDays * 24 * 60 * 60 * 1000));
                
                const expDetails = userData.expirationDetails || [];
                expDetails.push({
                    date: expDate.toISOString(),
                    points: won
                });
                
                // Actualizar expirationDate si es menor a la que tenía
                let newExpDateStr = userData.nextExpirationDate;
                const newExpDateStrFormatted = expDate.toISOString().split('T')[0];
                if (!newExpDateStr || newExpDateStrFormatted < newExpDateStr) {
                    newExpDateStr = newExpDateStrFormatted;
                }

                await updateDoc(userRef, {
                    points: (userData.points || 0) + won,
                    expirationDetails: expDetails,
                    nextExpirationDate: newExpDateStr
                });

                await addDoc(collection(db, 'users', user.uid, 'points_history'), {
                    type: 'credit',
                    amount: won,
                    date: serverTimestamp(),
                    concept: 'Premio Caja Sorpresa',
                    moneySpent: 0,
                    source: 'caja_sorpresa'
                });
            }

            setStatus('won');

            // Confetti
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FF5722', '#FFC107', '#4CAF50']
            });

        } catch (e) {
            console.error(e);
            setStatus('invalid');
            setErrorMsg('Hubo un error al abrir la caja.');
        }
    };

    if (status === 'loading') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
                    <p className="text-white font-bold animate-pulse">Preparando tu sorpresa...</p>
                </div>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[30px] border border-white/10 text-center max-w-sm w-full">
                    <div className="bg-red-500/20 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
                        <XCircle className="w-10 h-10 text-red-500" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">¡Ups!</h2>
                    <p className="text-white/60 mb-8">{errorMsg}</p>
                    <button onClick={() => navigate('/')} className="w-full bg-white/10 text-white py-4 rounded-xl font-bold hover:bg-white/20 transition">
                        Volver al inicio
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'auth_required') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[30px] border border-white/10 text-center max-w-sm w-full">
                    <div className="bg-gradient-to-tr from-orange-400 to-pink-500 w-24 h-24 rounded-[2rem] flex items-center justify-center mx-auto mb-6 rotate-12 shadow-[0_0_40px_rgba(249,115,22,0.4)]">
                        <Gift className="w-12 h-12 text-white" />
                    </div>
                    <h2 className="text-2xl font-black text-white mb-2">¡Tenés una Sorpresa!</h2>
                    <p className="text-white/80 mb-8">Para abrir la Caja Sorpresa y guardar tus puntos, necesitás iniciar sesión.</p>
                    <button onClick={handleLoginAndClaim} className="w-full bg-gradient-to-r from-orange-500 to-pink-500 text-white py-4 rounded-xl font-black text-lg shadow-lg hover:scale-[1.02] active:scale-[0.98] transition">
                        Ingresar y Abrir
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'rejected') {
        return (
            <div className="min-h-screen bg-gray-900 flex items-center justify-center p-4">
                <div className="text-center">
                    <p className="text-white/60 mb-6">Has rechazado la Caja Sorpresa.</p>
                    <button onClick={() => navigate('/')} className="px-8 py-3 bg-white/10 rounded-xl text-white font-bold">
                        Volver a Inicio
                    </button>
                </div>
            </div>
        );
    }

    if (status === 'won') {
        return (
            <div className="min-h-screen bg-gradient-to-br from-green-900 via-emerald-900 to-black flex items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[30px] border border-white/20 text-center max-w-sm w-full animate-in zoom-in duration-500">
                    <div className="relative w-32 h-32 mx-auto mb-6">
                        <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-2xl animate-pulse"></div>
                        <div className="relative bg-gradient-to-tr from-yellow-400 to-orange-500 w-full h-full rounded-full flex items-center justify-center border-4 border-white/20 shadow-[0_0_60px_rgba(250,204,21,0.6)]">
                            <PartyPopper className="w-16 h-16 text-white" />
                        </div>
                    </div>
                    <h2 className="text-4xl font-black text-white mb-2 drop-shadow-md">¡+{pointsWon} PTS!</h2>
                    <p className="text-green-300 font-bold mb-8">Felicidades, ganaste estos puntos por tu compra.</p>
                    <button onClick={() => navigate('/')} className="w-full bg-white text-green-900 py-4 rounded-xl font-black text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition">
                        Ver Mis Puntos
                    </button>
                </div>
            </div>
        );
    }

    // status === 'ready' || 'playing'
    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex items-center justify-center p-4 overflow-hidden relative">
            {/* Background elements */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl"></div>

            <div className="relative z-10 w-full max-w-sm">
                <div className="text-center mb-12">
                    <h1 className="text-4xl font-black text-white mb-3 drop-shadow-lg">Caja Sorpresa</h1>
                    <p className="text-white/80 font-medium">Tocá la caja para descubrir cuántos puntos extra te llevás hoy.</p>
                </div>

                <div 
                    ref={boxRef}
                    onClick={status === 'ready' ? handlePlay : undefined}
                    className={`relative w-64 h-64 mx-auto mb-12 cursor-pointer transition-transform duration-300 hover:scale-105 ${status === 'playing' ? 'pointer-events-none' : ''}`}
                >
                    <style>{`
                        @keyframes shake {
                            0%, 100% { transform: translateX(0) rotate(0); }
                            20% { transform: translateX(-10px) rotate(-5deg); }
                            40% { transform: translateX(10px) rotate(5deg); }
                            60% { transform: translateX(-10px) rotate(-5deg); }
                            80% { transform: translateX(10px) rotate(5deg); }
                        }
                        .animate-shake { animation: shake 0.5s ease-in-out infinite; }
                    `}</style>
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-pink-600 rounded-[3rem] rotate-6 opacity-50 blur-xl animate-pulse"></div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-pink-500 rounded-[3rem] border-4 border-white/20 shadow-2xl flex items-center justify-center overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10 rounded-b-full"></div>
                        <Gift className={`w-32 h-32 text-white drop-shadow-lg ${status === 'playing' ? 'animate-bounce' : ''}`} />
                    </div>
                </div>

                <div className="flex flex-col gap-4">
                    {status === 'playing' ? (
                        <div className="text-center py-4">
                            <Loader2 className="w-8 h-8 text-white animate-spin mx-auto mb-2" />
                            <p className="text-white font-bold animate-pulse">Abriendo...</p>
                        </div>
                    ) : (
                        <>
                            <button onClick={handlePlay} className="w-full bg-white text-purple-900 py-4 rounded-2xl font-black text-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition">
                                ¡ABRIR CAJA!
                            </button>
                            <button onClick={handleReject} className="w-full bg-transparent text-white/50 py-3 rounded-xl font-bold hover:bg-white/5 transition">
                                No quiero jugar, gracias
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
