import React, { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Gift, XCircle, CheckCircle2, Loader2, PartyPopper } from 'lucide-react';
import { useClientAuth } from '../contexts/ClientAuthContext';
import { MysteryBoxService, type MysteryBoxChance } from '../../../services/mysteryBoxService';
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
    const [flashingPrize, setFlashingPrize] = useState("???");

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

                // Eliminamos la fricción: cualquier usuario puede jugar y ver su premio sin estar logueado
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
        if (!id) return;
        setStatus('playing');
        
        // --- EFECTOS DE SONIDO (Web Audio API) ---
        const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
        
        const oscSuspense = audioCtx.createOscillator();
        const gainSuspense = audioCtx.createGain();
        oscSuspense.type = 'triangle';
        oscSuspense.frequency.setValueAtTime(200, audioCtx.currentTime);
        oscSuspense.frequency.linearRampToValueAtTime(800, audioCtx.currentTime + 3.2);
        gainSuspense.gain.setValueAtTime(0, audioCtx.currentTime);
        gainSuspense.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.1);
        gainSuspense.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 3.2);
        oscSuspense.connect(gainSuspense);
        gainSuspense.connect(audioCtx.destination);
        oscSuspense.start();
        oscSuspense.stop(audioCtx.currentTime + 3.2);

        // Animación de agitar la caja
        if (boxRef.current) {
            boxRef.current.classList.add('animate-shake');
            setTimeout(() => boxRef.current?.classList.remove('animate-shake'), 1500);
        }

        const possiblePoints = ["5 Pts", "10 Pts", "25 Pts", "50 Pts", "100 Pts", "250 Pts"];
        const interval = setInterval(() => {
            setFlashingPrize(possiblePoints[Math.floor(Math.random() * possiblePoints.length)]);
        }, 100);

        try {
            // Fake delay para la animación
            await new Promise(r => setTimeout(r, 2000));

            const won = await MysteryBoxService.playChance(id);
            if (won === null) {
                clearInterval(interval);
                setStatus('invalid');
                setErrorMsg('No se pudo procesar tu premio. Intenta nuevamente o contacta soporte.');
                return;
            }

            clearInterval(interval);

            // Sonido de Victoria
            const oscWin = audioCtx.createOscillator();
            const gainWin = audioCtx.createGain();
            oscWin.type = 'sine';
            oscWin.frequency.setValueAtTime(523.25, audioCtx.currentTime); // C5
            oscWin.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1); // E5
            oscWin.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2); // G5
            oscWin.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3); // C6
            gainWin.gain.setValueAtTime(0.2, audioCtx.currentTime);
            gainWin.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
            oscWin.connect(gainWin);
            gainWin.connect(audioCtx.destination);
            oscWin.start();
            oscWin.stop(audioCtx.currentTime + 1.5);

            setPointsWon(won);
            
            // La asignación de puntos ahora se hace 100% de forma segura en el Backend (API play-mystery-box)
            // Por lo tanto, no es necesario hacer las escrituras en la base de datos desde aquí.

            setStatus('won');

            // Confetti
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FF5722', '#FFC107', '#4CAF50']
            });

        } catch (e: any) {
            console.error(e);
            setStatus('invalid');
            setErrorMsg(e?.message || 'Hubo un error al abrir la caja.');
        }
    };

    if (status === 'loading') {
        return (
            <div className="h-[calc(100dvh-140px)] overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-4">
                <div className="text-center">
                    <Loader2 className="w-12 h-12 text-white animate-spin mx-auto mb-4" />
                    <p className="text-white font-bold animate-pulse">Preparando tu sorpresa...</p>
                </div>
            </div>
        );
    }

    if (status === 'invalid') {
        return (
            <div className="h-[calc(100dvh-140px)] overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-4">
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

    // El estado auth_required ya no se usa.

    if (status === 'rejected') {
        return (
            <div className="h-[calc(100dvh-140px)] overflow-hidden bg-gray-900 flex flex-col items-center justify-center p-4">
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
            <div className="h-[calc(100dvh-140px)] overflow-hidden bg-gradient-to-br from-green-900 via-emerald-900 to-black flex flex-col items-center justify-center p-4">
                <div className="bg-white/10 backdrop-blur-xl p-8 rounded-[30px] border border-white/20 text-center max-w-sm w-full animate-in zoom-in duration-500">
                    <div className="relative w-28 h-28 mx-auto mb-6">
                        <div className="absolute inset-0 bg-yellow-400/20 rounded-full blur-2xl animate-pulse"></div>
                        <div className="relative bg-gradient-to-tr from-yellow-400 to-orange-500 w-full h-full rounded-full flex items-center justify-center border-4 border-white/20 shadow-[0_0_60px_rgba(250,204,21,0.6)]">
                            <PartyPopper className="w-14 h-14 text-white" />
                        </div>
                    </div>
                    {user ? (
                        <>
                            <h2 className="text-3xl md:text-4xl font-black text-white mb-2 drop-shadow-md">+{pointsWon} PTS!</h2>
                            <p className="text-green-300 font-bold mb-6 md:mb-8 text-sm md:text-base">Felicidades, ganaste estos puntos por tu compra.</p>
                            <button onClick={() => navigate('/')} className="w-full bg-white text-green-900 py-3 md:py-4 rounded-xl font-black text-base md:text-lg shadow-xl hover:scale-[1.02] active:scale-[0.98] transition">
                                Ver Mis Puntos
                            </button>
                        </>
                    ) : (
                        <>
                            <h2 className="text-2xl md:text-3xl font-black text-white mb-3 drop-shadow-md">¡Tus {pointsWon} puntos ya están listos! 🎁</h2>
                            <p className="text-green-300 font-medium mb-6 md:mb-8 text-sm md:text-base leading-snug">Iniciá sesión ahora para asegurar tu saldo y descubrí qué premios gratis ya podés canjear.</p>
                            <button onClick={() => navigate('/login?redirect=/')} className="w-full bg-white text-green-900 py-3 md:py-4 px-2 rounded-xl font-black text-base md:text-[17px] shadow-xl hover:scale-[1.02] active:scale-[0.98] transition">
                                Asegurar mis puntos y ver premios
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    // status === 'ready' || 'playing'
    return (
        <div className="h-[calc(100dvh-140px)] overflow-hidden bg-gradient-to-br from-indigo-900 via-purple-900 to-black flex flex-col items-center justify-center p-4 relative">
            {/* Background elements */}
            <div className="absolute top-20 left-10 w-64 h-64 bg-pink-500/20 rounded-full blur-3xl"></div>
            <div className="absolute bottom-20 right-10 w-80 h-80 bg-orange-500/20 rounded-full blur-3xl"></div>

            <div className="relative z-10 w-full max-w-sm">
                <div className="text-center mb-8 md:mb-12">
                    <h1 className="text-3xl md:text-4xl font-black text-white mb-2 md:mb-3 drop-shadow-lg">Caja Sorpresa</h1>
                    <p className="text-white/80 font-medium text-sm md:text-base">Tocá la caja para descubrir cuántos puntos extra te llevás hoy.</p>
                </div>

                <div 
                    ref={boxRef}
                    onClick={status === 'ready' ? handlePlay : undefined}
                    className={`relative w-48 h-48 md:w-56 md:h-56 mx-auto mb-8 md:mb-12 cursor-pointer transition-transform duration-300 hover:scale-105 ${status === 'playing' ? 'pointer-events-none' : ''}`}
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
                    <div className="absolute inset-0 bg-gradient-to-br from-orange-400 to-pink-600 rounded-[2.5rem] md:rounded-[3rem] rotate-6 opacity-50 blur-xl animate-pulse"></div>
                    <div className="absolute inset-0 bg-gradient-to-tr from-orange-500 to-pink-500 rounded-[2.5rem] md:rounded-[3rem] border-4 border-white/20 shadow-2xl flex items-center justify-center overflow-hidden">
                        <div className="absolute top-0 left-0 right-0 h-1/2 bg-white/10 rounded-b-full"></div>
                        <Gift className={`w-24 h-24 md:w-28 md:h-28 text-white drop-shadow-lg ${status === 'playing' ? 'animate-bounce' : ''}`} />
                    </div>
                </div>

                <div className="flex flex-col gap-3 md:gap-4">
                    {status === 'playing' ? (
                        <div className="flex flex-col items-center justify-center py-4 w-full overflow-hidden">
                            <h3 className="text-lg font-bold text-white/50 mb-4 uppercase tracking-widest animate-pulse">Sorteando...</h3>
                            <div className="w-full h-24 border-y-4 border-dashed border-white/20 bg-white/5 relative flex justify-center items-center overflow-hidden">
                                <h1 key={flashingPrize} className="text-4xl font-black italic drop-shadow-lg text-white absolute">
                                    {flashingPrize}
                                </h1>
                            </div>
                            <p className="text-white/40 font-bold text-xs mt-4 animate-bounce">¡No apagues la pantalla!</p>
                        </div>
                    ) : (
                        <>
                            <button onClick={handlePlay} className="w-full bg-white text-purple-900 py-3 md:py-4 rounded-2xl font-black text-lg md:text-xl shadow-[0_10px_30px_rgba(0,0,0,0.3)] hover:scale-[1.02] active:scale-[0.98] transition">
                                ¡ABRIR CAJA!
                            </button>
                            <button onClick={handleReject} className="w-full bg-transparent text-white/50 py-2 md:py-3 rounded-xl font-bold hover:bg-white/5 transition text-sm md:text-base">
                                No quiero jugar, gracias
                            </button>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
