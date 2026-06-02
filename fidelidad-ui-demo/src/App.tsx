import { useState, useEffect } from 'react';
import { CircularProgress } from './components/CircularProgress';
import { BottomSheet } from './components/BottomSheet';
import { CampaignCarousel } from './components/CampaignCarousel';
import { Scan, Gift, History, Bell, User, CheckCircle, Sparkles, Lock, Unlock, Zap, Server, Settings, Package, Calendar, Edit2, Trash2 } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

// Types for our Gamification Engine
type BoxTier = 'clasica' | 'epica';
type BoxState = 'locked' | 'unlocked' | 'opened';

interface MysteryBox {
  id: string;
  tier: BoxTier;
  state: BoxState;
  timestamp: Date;
}

interface Transaction {
  id: string;
  type: 'compra' | 'sorteo';
  points: number;
  date: Date;
  expiresAt: Date;
}

type CashierTask = { id: string, title: string, amount: number };

function App() {
  const [points, setPoints] = useState(150);
  const targetPoints = 300;
  
  // Game State
  const [boxes, setBoxes] = useState<MysteryBox[]>([]);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  
  // History State
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 't1', type: 'compra', points: 150, date: new Date(), expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) }
  ]);
  
  // UI State
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [isAdminOpen, setIsAdminOpen] = useState(false);
  const [sheetView, setSheetView] = useState<'box_list' | 'box_detail' | 'scanning_qr' | 'history'>('box_list');
  const [flashBanner, setFlashBanner] = useState<{message: string, tier: BoxTier} | null>(null);
  const [serverLog, setServerLog] = useState<string | null>(null);

  // Cashier Settings
  const [raffleEnabled, setRaffleEnabled] = useState(true);
  const [showCashierAlert, setShowCashierAlert] = useState(false);
  const [cashierTasks, setCashierTasks] = useState<CashierTask[]>([]);

  // Admin Settings (Master)
  const [isCampaignActive, setIsCampaignActive] = useState(true);
  const [forceCashierPrompt, setForceCashierPrompt] = useState(true);
  
  // Prize Bags
  const [classicPrizes, setClassicPrizes] = useState([
    { id: 'c1', points: 1, stock: 1000 },
    { id: 'c2', points: 2, stock: 800 },
    { id: 'c3', points: 3, stock: 500 },
    { id: 'c4', points: 5, stock: 100 },
    { id: 'c5', points: 25, stock: 5, isJackpot: true }
  ]);
  
  const [epicPrizes, setEpicPrizes] = useState([
    { id: 'e1', points: 10, stock: 500 },
    { id: 'e2', points: 25, stock: 200 },
    { id: 'e3', points: 150, stock: 5, isJackpot: true }
  ]);

  const [expirationRules, setExpirationRules] = useState([
    { id: 'r1', min: 1, max: 100, days: 7 },
    { id: 'r2', min: 101, max: 1000, days: 15 }
  ]);

  // Suspense Animation State
  const [isOpening, setIsOpening] = useState(false);
  const [flashingPrize, setFlashingPrize] = useState("???");

  // Fake Server Logger
  const logToServer = (msg: string) => {
    setServerLog(msg);
    setTimeout(() => setServerLog(null), 4000);
  };

  // ----------------------------------------------------
  // SIMULADOR DEL CAJERO (BACKEND)
  // ----------------------------------------------------
  const simulateCashierTransaction = (amount: number) => {
    // Siempre sumamos puntos por la compra independientemente del sorteo
    const basePoints = amount > 20000 ? 250 : 25;
    setPoints(prev => Math.min(prev + basePoints, targetPoints));
    
    setTransactions(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      type: 'compra',
      points: basePoints,
      date: new Date(),
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) // 6 Meses
    }, ...prev]);

    if (!raffleEnabled) {
      logToServer(`Firebase: Carga de ${basePoints} pts. Sorteo deshabilitado manualmente por el cajero.`);
      return;
    }

    if (!isCampaignActive) {
      logToServer(`Firebase: Carga de ${basePoints} pts. Campaña de gamificación globalmente pausada.`);
      return;
    }

    const tier: BoxTier = amount > 20000 ? 'epica' : 'clasica';
    const newBox: MysteryBox = {
      id: Math.random().toString(36).substr(2, 9),
      tier,
      state: 'locked',
      timestamp: new Date()
    };
    
    // El servidor añade la caja a la DB y envía el evento al cliente conectado
    setBoxes(prev => [newBox, ...prev]);
    setActiveBoxId(newBox.id); // <-- FIJAMOS LA CAJA ACTIVA AQUÍ
    
    // Mensaje consolidado:
    setFlashBanner({
      message: `¡Sumaste ${basePoints} Puntos! 🎁 Y además ganaste una oportunidad de abrir una Caja ${tier.toUpperCase()}. Escanéa el QR del mostrador.`,
      tier
    });
    
    // Auto-hide banner after 30 seconds if ignored
    setTimeout(() => setFlashBanner(null), 30000);

    // Entrenamiento al cajero
    if (forceCashierPrompt) {
      setShowCashierAlert(true);
      setTimeout(() => setShowCashierAlert(false), 5000);
    }
  };

  const handleDeletePrize = (tier: 'clasica' | 'epica', id: string) => {
    if (tier === 'clasica') {
      setClassicPrizes(prev => prev.filter(p => p.id !== id));
    } else {
      setEpicPrizes(prev => prev.filter(p => p.id !== id));
    }
  };

  const handleDeleteRule = (id: string) => {
    setExpirationRules(prev => prev.filter(r => r.id !== id));
  };

  // ----------------------------------------------------
  // INTERACCIÓN DEL CLIENTE (PWA)
  // ----------------------------------------------------
  const activeBox = boxes.find(b => b.id === activeBoxId);

  const handleOpenBoxDetails = (id: string) => {
    setActiveBoxId(id);
    setSheetView('box_detail');
    setIsSheetOpen(true);
  };

  const handleSimulateQRScan = () => {
    setSheetView('scanning_qr');
    setTimeout(() => {
      // Unlock all locked boxes!
      setBoxes(prev => prev.map(b => b.state === 'locked' ? { ...b, state: 'unlocked' } : b));
      logToServer("Firebase: Localización validada por QR. Cajas desbloqueadas.");
      
      // Si sabemos qué caja quería abrir, lo llevamos ahí. Si no, al inventario.
      setSheetView(activeBoxId ? 'box_detail' : 'box_list'); 
    }, 1500);
  };

  const handlePlayGame = () => {
    if (!activeBox || activeBox.state !== 'unlocked') return;

    // --- EFECTOS DE SONIDO (Web Audio API) ---
    // Usamos el navegador nativo para generar sonido sin descargar MP3s
    const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
    
    // Sonido de Suspenso (tono subiendo tipo "ruleta")
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

    setIsOpening(true);
    
    const bag = activeBox.tier === 'epica' ? epicPrizes : classicPrizes;
    const possiblePoints = bag.map(p => p.isJackpot ? "¡Jackpot!" : `${p.points} Pts`);
    if (possiblePoints.length === 0) possiblePoints.push("5 Pts", "25 Pts");

    // Efecto Tragamonedas: Cambiar texto rápidamente
    const interval = setInterval(() => {
      setFlashingPrize(possiblePoints[Math.floor(Math.random() * possiblePoints.length)]);
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      setIsOpening(false);
      
      // Sonido de Victoria (Fanfarria)
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

      // Simulate Server Roulette (Bolsa Cerrada)
      const availableTickets = bag.flatMap(p => Array(p.stock).fill(p));
      let wonPrize = { points: activeBox.tier === 'epica' ? 25 : 5, id: 'fallback', isJackpot: false };
      
      if (availableTickets.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableTickets.length);
        wonPrize = availableTickets[randomIndex];
        
        // Decrease stock
        if (activeBox.tier === 'clasica') {
          setClassicPrizes(prev => prev.map(p => p.id === wonPrize.id ? { ...p, stock: p.stock - 1 } : p));
        } else {
          setEpicPrizes(prev => prev.map(p => p.id === wonPrize.id ? { ...p, stock: p.stock - 1 } : p));
        }
      }

      const prize = wonPrize.points;
      
      // Update State
      setBoxes(prev => prev.map(b => b.id === activeBoxId ? { ...b, state: 'opened', prizeWon: prize } : b));
      // Sumamos puntos (puede superar el target de 300)
      setPoints(prev => prev + prize);
      
      setTransactions(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'sorteo',
        points: prize,
        date: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 Días
      }, ...prev]);
      
      logToServer(`Firebase: Token consumido. Stock actualizado. Cliente ganó ${prize} pts.`);

      // Confetti
      const colors = activeBox.tier === 'epica' ? ['#ffb300', '#ffd54f', '#ffffff'] : ['#8e24aa', '#d81b60', '#ffb300'];
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors });
    }, 3200);
  };

  return (
    <div className="min-h-screen pb-32 bg-background max-w-md mx-auto relative shadow-2xl overflow-x-hidden font-sans">
      
      {/* ====================================================
          PANEL DE ADMINISTRACIÓN OCULTO (SIMULADOR)
          ==================================================== */}
      <div className="bg-gray-900 text-white p-4 text-xs font-mono mb-4 rounded-b-2xl shadow-xl z-50 relative">
        <div className="flex items-center gap-2 mb-2 text-green-400 font-bold uppercase tracking-widest border-b border-gray-700 pb-2">
          <Server size={14} /> Simulador Backend / Caja
          <div className="ml-auto flex items-center gap-2 text-[10px] text-gray-300 normal-case bg-gray-800 px-2 py-1 rounded">
            <input 
              type="checkbox" 
              id="raffleSwitch" 
              checked={raffleEnabled} 
              onChange={(e) => setRaffleEnabled(e.target.checked)} 
              className="accent-green-500 w-3 h-3 cursor-pointer"
            />
            <label htmlFor="raffleSwitch" className="cursor-pointer">Aplica para Sorteo</label>
          </div>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => simulateCashierTransaction(2500)}
            className="flex-1 bg-gray-800 hover:bg-gray-700 py-2 px-2 rounded border border-gray-700 transition-colors"
          >
            Compra $2.500<br/><span className="text-gray-400">(Caja Clásica)</span>
          </button>
          <button 
            onClick={() => simulateCashierTransaction(25000)}
            className="flex-1 bg-purple-900/50 hover:bg-purple-900/80 py-2 px-2 rounded border border-purple-700/50 transition-colors"
          >
            Compra $25.000<br/><span className="text-purple-400">(Caja Épica)</span>
          </button>
          <button 
            onClick={() => setCashierTasks(prev => [...prev, { id: Math.random().toString(36).substr(2, 9), title: 'Reenviar Sorteo a DNI *456', amount: 2500 }])}
            className="flex-1 bg-red-900/50 hover:bg-red-900/80 py-2 px-2 rounded border border-red-700/50 transition-colors"
          >
            Fallo App<br/><span className="text-red-400">(Simular Error)</span>
          </button>
        </div>

        {/* BURBUJA DE TAREAS (HUB) */}
        {cashierTasks.length > 0 && (
          <div className="mt-4 p-3 bg-gray-800 rounded-xl border border-gray-700">
            <h4 className="font-bold text-yellow-500 mb-2 flex items-center gap-2"><Bell size={14}/> Tareas Pendientes ({cashierTasks.length})</h4>
            <div className="space-y-2">
              {cashierTasks.map(task => (
                <div key={task.id} className="flex items-center justify-between bg-gray-900 p-2 rounded border border-gray-700">
                  <span className="text-gray-300">{task.title}</span>
                  <button 
                    onClick={() => {
                      simulateCashierTransaction(task.amount);
                      setCashierTasks(prev => prev.filter(t => t.id !== task.id));
                    }}
                    className="bg-yellow-600 hover:bg-yellow-500 text-black font-bold px-3 py-1 rounded text-[10px]"
                  >
                    Reenviar
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        <button onClick={() => setIsAdminOpen(true)} className="w-full mt-4 py-1 bg-blue-600 rounded text-white font-bold">Abrir Panel Admin</button>
        {serverLog && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-2 text-green-300 p-2 bg-black/50 rounded">
            &gt; {serverLog}
          </motion.div>
        )}
      </div>

      {/* ====================================================
          FLASH BANNER IN-APP (POPUP INMEDIATO)
          ==================================================== */}
      <AnimatePresence>
        {flashBanner && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className={`w-full max-w-sm rounded-[32px] shadow-2xl p-6 text-center relative overflow-hidden ${flashBanner.tier === 'epica' ? 'bg-gradient-to-br from-purple-100 to-purple-300' : 'bg-gradient-to-br from-primary/10 to-primary/30 bg-white'}`}>
              <button onClick={() => setFlashBanner(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">✕</button>
              
              <motion.div 
                animate={{ y: [0, -10, 0] }} 
                transition={{ duration: 2, repeat: Infinity }}
                className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4"
              >
                <Gift size={48} className={flashBanner.tier === 'epica' ? 'text-purple-600' : 'text-primary'} />
              </motion.div>
              
              <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">¡Caja Sorpresa!</h2>
              <p className="text-gray-800 font-medium mb-6 text-sm">{flashBanner.message}</p>
              
              <button 
                onClick={() => {
                  setFlashBanner(null);
                  handleSimulateQRScan();
                  setIsSheetOpen(true);
                }}
                className={`w-full py-4 text-white text-lg font-black rounded-2xl active:scale-95 transition-all flex justify-center items-center gap-2 shadow-lg ${flashBanner.tier === 'epica' ? 'bg-purple-600 shadow-purple-600/50' : 'bg-primary shadow-primary/50'}`}
              >
                <Scan size={24} /> Escanear QR Ahora
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ====================================================
          UI DE LA PWA (VISTA DEL CLIENTE)
          ==================================================== */}
      
      {/* Header */}
      <header className="text-white pt-6 pb-10 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden -mt-4" 
              style={{ background: 'linear-gradient(135deg, #4a148c 0%, #880e4f 50%, #ad1457 100%)' }}>
        <div className="absolute top-[-50px] right-[-50px] w-40 h-40 bg-white/10 rounded-full blur-2xl" />
        
        <div className="flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight">¡Hola, Pablo! 👋</h1>
            <p className="text-white/90 font-bold bg-black/20 px-3 py-1 rounded-full inline-block mt-1 text-sm">
              {points < 500 ? '🥉 Nivel Bronce' : points < 2000 ? '🥈 Nivel Plata' : '🥇 Nivel VIP Oro'}
            </p>
          </div>
          <div className="relative">
            <button 
              onClick={() => { setSheetView('box_list'); setIsSheetOpen(true); }}
              className="p-3 bg-white/10 border border-white/20 rounded-full backdrop-blur-md active:scale-90 transition-transform"
            >
              <Gift size={20} />
            </button>
            {boxes.filter(b => b.state !== 'opened').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-accent opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-accent text-[9px] font-bold text-white items-center justify-center">
                  {boxes.filter(b => b.state !== 'opened').length}
                </span>
              </span>
            )}
          </div>
        </div>

        <div className="mt-8 flex justify-center relative z-10">
          <CircularProgress progress={points} total={targetPoints} label="tu próximo premio" />
        </div>
      </header>

      {/* Campaign Carousel */}
      <div className="mt-8 mb-6">
        <div className="flex justify-between items-center px-6 mb-4">
          <h2 className="text-lg font-black text-gray-800">Promociones y Ofertas</h2>
        </div>
        <CampaignCarousel />
      </div>

      <main className="px-6 space-y-8">
        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-4">
          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              // Si no hay cajas para abrir, simplemente abre el escáner normal
              if (boxes.filter(b => b.state === 'locked').length === 0) {
                 alert("Escáner QR Normal (No hay cajas bloqueadas)");
              } else {
                 handleSimulateQRScan();
                 setIsSheetOpen(true);
              }
            }}
            className="flex flex-col items-center justify-center gap-3 p-5 bg-white rounded-[28px] shadow-sm border border-gray-100 relative group"
          >
             <div className="p-4 bg-primary/10 text-primary rounded-2xl relative">
              <Scan size={28} />
              {boxes.filter(b => b.state === 'locked').length > 0 && (
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-accent rounded-full animate-pulse shadow-[0_0_10px_rgba(255,179,0,0.8)]" />
              )}
            </div>
            <span className="font-bold text-sm text-gray-800">Escanear Local</span>
          </motion.button>

          <motion.button 
            whileTap={{ scale: 0.95 }}
            onClick={() => { setSheetView('box_list'); setIsSheetOpen(true); }}
            className="flex flex-col items-center justify-center gap-3 p-5 bg-white rounded-[28px] shadow-sm border border-gray-100"
          >
            <div className="p-4 bg-secondary/10 text-secondary rounded-2xl relative">
              <Gift size={28} />
               {boxes.filter(b => b.state !== 'opened').length > 0 && (
                <div className="absolute -top-2 -right-2 bg-accent text-white font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center">
                  {boxes.filter(b => b.state !== 'opened').length}
                </div>
              )}
            </div>
            <span className="font-bold text-sm text-gray-800">Mis Premios</span>
          </motion.button>
        </div>
      </main>

      {/* Floating Bottom Navigation Bar */}
      <nav className="fixed bottom-0 w-full max-w-md mx-auto bg-white/80 backdrop-blur-lg border-t border-gray-100 p-4 pb-safe flex justify-around items-center rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30">
        <button className="flex flex-col items-center text-primary gap-1">
          <Scan size={24} />
          <span className="text-[10px] font-black uppercase tracking-wider mt-1">Inicio</span>
        </button>
        <button 
          onClick={() => { setSheetView('history'); setIsSheetOpen(true); }}
          className="flex flex-col items-center text-gray-400 hover:text-gray-800 gap-1 transition-colors"
        >
          <History size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Historial</span>
        </button>
        <button className="flex flex-col items-center text-gray-400 hover:text-gray-800 gap-1 transition-colors">
          <User size={24} />
          <span className="text-[10px] font-bold uppercase tracking-wider mt-1">Perfil</span>
        </button>
      </nav>

      {/* ====================================================
          BOTTOM SHEET (LOGICA DE GAMIFICACIÓN)
          ==================================================== */}
      <BottomSheet 
        isOpen={isSheetOpen} 
        onClose={() => setIsSheetOpen(false)}
      >
        <div className="py-2 min-h-[350px] flex flex-col">
          <AnimatePresence mode="wait">

            {/* VISTA 1: LISTA DE CAJAS (INVENTARIO) */}
            {sheetView === 'box_list' && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex-1">
                <h3 className="text-xl font-black text-gray-800 mb-4 px-4">Tus Sorpresas</h3>
                
                {boxes.filter(b => b.state !== 'opened').length === 0 ? (
                  <div className="text-center py-10 px-4 text-gray-500">
                    <Gift size={48} className="mx-auto mb-4 opacity-20" />
                    <p>No tienes premios pendientes.</p>
                    <p className="text-sm mt-2">¡Realiza compras para ganar Cajas Misteriosas!</p>
                  </div>
                ) : (
                  <div className="space-y-3 px-4 pb-4">
                    {boxes.filter(b => b.state !== 'opened').map(box => (
                      <div key={box.id} onClick={() => handleOpenBoxDetails(box.id)}
                           className="p-4 rounded-[20px] flex items-center justify-between border bg-white border-gray-200 shadow-sm cursor-pointer active:scale-95 transition-transform">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${box.tier === 'epica' ? 'bg-gradient-to-tr from-purple-400 to-purple-200 text-purple-900' : 'bg-gradient-to-tr from-primary/20 to-primary/5 text-primary'}`}>
                            <Gift size={24} />
                          </div>
                          <div>
                            <p className="font-bold text-gray-800">Caja {box.tier === 'epica' ? 'Épica' : 'Clásica'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">
                              {box.state === 'locked' && <><Lock size={10} /> Bloqueada (Falta Escaneo)</>}
                              {box.state === 'unlocked' && <><Unlock size={10} className="text-green-500"/> Lista para abrir</>}
                            </p>
                          </div>
                        </div>
                        <div className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {/* VISTA 2: DETALLE DE LA CAJA (INTENTAR ABRIR) */}
            {sheetView === 'box_detail' && activeBox && (
              <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full flex-1 flex flex-col items-center justify-center text-center px-4">
                
                {activeBox.state === 'locked' && (
                  <>
                    <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 relative">
                      <Gift size={48} className="text-gray-400" />
                      <div className="absolute -bottom-2 -right-2 bg-red-100 text-red-500 p-2 rounded-full shadow-lg">
                        <Lock size={20} />
                      </div>
                    </div>
                    <h3 className="text-2xl font-black text-gray-800 mb-2">Caja Bloqueada</h3>
                    <p className="text-gray-500 font-medium mb-8 text-sm">
                      Recibiste esta caja por tu compra, pero necesitas **escanear el código QR** de la caja de nuestra sucursal para poder abrirla.
                    </p>
                    <button 
                      onClick={() => handleSimulateQRScan()}
                      className="w-full py-4 bg-gray-900 text-white text-lg font-black rounded-2xl active:scale-95 transition-all flex justify-center items-center gap-2"
                    >
                      <Scan size={20} /> Escanear QR Físico ahora
                    </button>
                    <button onClick={() => setSheetView('box_list')} className="mt-4 text-gray-500 font-bold text-sm">Volver a mis premios</button>
                  </>
                )}

                {activeBox.state === 'unlocked' && (
                  isOpening ? (
                    <div className="flex flex-col items-center justify-center py-8 w-full overflow-hidden">
                      <h3 className="text-xl font-bold text-gray-400 mb-8 uppercase tracking-widest animate-pulse">Sorteando...</h3>
                      
                      <div className={`w-full h-32 border-y-4 border-dashed ${activeBox.tier === 'epica' ? 'border-purple-200 bg-purple-50/50' : 'border-primary/20 bg-primary/5'} relative flex justify-center items-center overflow-hidden`}>
                        <motion.h1 
                          key={flashingPrize}
                          initial={{ y: 50, opacity: 0 }}
                          animate={{ y: 0, opacity: 1 }}
                          exit={{ y: -50, opacity: 0 }}
                          transition={{ duration: 0.1 }}
                          className={`text-5xl font-black italic drop-shadow-lg absolute ${activeBox.tier === 'epica' ? 'text-purple-600' : 'text-primary'}`}
                        >
                          {flashingPrize}
                        </motion.h1>
                      </div>
                      
                      <p className="text-gray-400 font-bold text-sm mt-8 animate-bounce">¡No apagues la pantalla!</p>
                    </div>
                  ) : (
                   <>
                   <div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-2xl relative ${activeBox.tier === 'epica' ? 'bg-gradient-to-tr from-purple-400 to-purple-600 shadow-purple-500/40' : 'bg-gradient-to-tr from-primary to-secondary shadow-primary/40'}`}>
                     <Gift size={64} className="text-white animate-bounce" />
                     <div className="absolute -top-2 -right-2 bg-green-400 text-white p-2 rounded-full shadow-lg">
                       <Unlock size={20} />
                     </div>
                   </div>
                   <h3 className="text-3xl font-black text-gray-800 mb-2">¡Lista para abrir!</h3>
                   <p className="text-gray-500 font-medium mb-8 text-sm">
                     Has validado tu ubicación. Presiona el botón para descubrir tu premio sorpresa.
                   </p>
                   <button 
                     onClick={handlePlayGame}
                     className={`w-full py-4 text-white text-lg font-black rounded-2xl active:scale-95 transition-all flex justify-center items-center gap-2 ${activeBox.tier === 'epica' ? 'bg-purple-600' : 'bg-primary'}`}
                   >
                     <Sparkles size={20} /> ¡Abrir Caja!
                   </button>
                 </>
                  )
                )}

                {activeBox.state === 'opened' && (
                   <>
                   <div className="w-full py-4 flex flex-col items-center">
                     <motion.div initial={{ scale: 0 }} animate={{ scale: 1, rotate: 360 }} transition={{ type: 'spring' }} className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6 shadow-[0_0_30px_rgba(74,222,128,0.5)]">
                       <CheckCircle size={48} className="text-green-500" />
                     </motion.div>
                     <h3 className="text-xl font-bold text-gray-500 mb-2 uppercase tracking-widest">¡Puntos Acreditados!</h3>
                     <motion.h1 
                        initial={{ scale: 0.5, opacity: 0 }} 
                        animate={{ scale: 1, opacity: 1 }} 
                        className={`text-6xl font-black mb-4 drop-shadow-2xl ${activeBox.tier === 'epica' ? 'text-purple-600' : 'text-primary'}`}
                     >
                       +{activeBox.tier === 'epica' ? '250' : '25'} Pts
                     </motion.h1>
                     <p className="text-sm font-medium text-gray-500 mb-8 px-4">Los puntos ya se sumaron automáticamente a tu saldo total.</p>
                     <button onClick={() => setIsSheetOpen(false)} className="w-full py-4 bg-gray-900 text-white text-lg font-black rounded-2xl active:scale-95 transition-all">
                       Entendido
                     </button>
                   </div>
                 </>
                )}

              </motion.div>
            )}

            {/* VISTA 3: SIMULANDO ESCANEO QR */}
            {sheetView === 'scanning_qr' && (
              <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex-1 flex flex-col items-center justify-center py-10">
                <Scan size={64} className="text-primary animate-pulse mb-6" />
                <h3 className="text-xl font-bold text-gray-800 mb-2">Escaneando...</h3>
                <p className="text-sm text-gray-500">Validando código de sucursal.</p>
              </motion.div>
            )}

            {/* VISTA 4: HISTORIAL DE PUNTOS (DOBLE CADUCIDAD) */}
            {sheetView === 'history' && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex-1">
                <h3 className="text-xl font-black text-gray-800 mb-4 px-4">Tus Movimientos</h3>
                <div className="space-y-3 px-4 pb-4">
                  {transactions.map(t => (
                    <div key={t.id} className="p-4 bg-white border border-gray-100 shadow-sm rounded-[20px] flex justify-between items-center">
                      <div className="flex gap-3 items-center">
                        <div className={`p-3 rounded-2xl ${t.type === 'sorteo' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-400'}`}>
                          {t.type === 'sorteo' ? <Sparkles size={20} /> : <Package size={20} />}
                        </div>
                        <div className="flex flex-col">
                          <span className="font-bold text-gray-800">
                            {t.type === 'compra' ? 'Suma por Compra' : 'Caja Sorpresa'}
                          </span>
                          <span className="text-[10px] font-bold mt-1 px-2 py-0.5 rounded-md inline-block w-fit uppercase tracking-wider text-gray-500 bg-gray-100">
                            Vence: {t.expiresAt.toLocaleDateString()}
                          </span>
                        </div>
                      </div>
                      <div className="font-black text-lg text-primary">+{t.points}</div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}

          </AnimatePresence>
        </div>
      </BottomSheet>

      {/* ====================================================
          SIMULADOR DEL PANEL DE ADMINISTRACIÓN
          ==================================================== */}
      {isAdminOpen && (
        <div className="fixed inset-0 z-[100] bg-gray-50 flex flex-col md:flex-row overflow-hidden font-sans">
           <div className="w-full md:w-64 bg-gray-900 text-white p-6 flex flex-col shadow-xl z-10">
              <h2 className="text-2xl font-black mb-8 flex items-center gap-2"><Settings /> Panel Admin</h2>
              <div className="p-3 bg-gray-800 rounded-lg text-primary font-bold cursor-pointer border border-gray-700">Sorteos y Cajas</div>
              <div className="p-3 hover:bg-gray-800 rounded-lg text-gray-400 cursor-pointer transition-colors mt-2">Usuarios</div>
              <div className="p-3 hover:bg-gray-800 rounded-lg text-gray-400 cursor-pointer transition-colors">Reportes</div>
              <div className="mt-auto">
                <button onClick={() => setIsAdminOpen(false)} className="w-full py-3 bg-gray-800 hover:bg-gray-700 font-bold rounded-xl border border-gray-700 transition-colors">Cerrar Administrador</button>
              </div>
           </div>
           
           <div className="flex-1 p-8 overflow-y-auto bg-gray-50">
              <div className="max-w-5xl mx-auto space-y-8">
                 <div className="flex justify-between items-center bg-white p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-gray-100">
                   <div>
                     <h1 className="text-3xl font-black text-gray-800 mb-1">Motor de Gamificación</h1>
                     <p className="text-gray-500 font-medium">Configura el presupuesto mensual, probabilidades y vencimientos de las Cajas Sorpresa.</p>
                   </div>
                   <div className="flex items-center gap-4 bg-gray-50 p-4 rounded-2xl border border-gray-100">
                     <span className="font-bold text-gray-700">Estado de Campaña:</span>
                     <div 
                        onClick={() => setIsCampaignActive(!isCampaignActive)}
                        className={`w-16 h-8 rounded-full flex items-center p-1 cursor-pointer shadow-inner transition-colors ${isCampaignActive ? 'bg-green-500' : 'bg-gray-300'}`}
                      >
                         <div className={`w-6 h-6 bg-white rounded-full shadow-sm transition-transform ${isCampaignActive ? 'translate-x-8' : 'translate-x-0'}`}></div>
                      </div>
                   </div>
                 </div>

                 {/* Configuración de QR (Línea Blanca / Multi-tenant) */}
                 <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-gray-100 flex flex-col md:flex-row items-center md:items-start gap-8">
                    <div className="bg-gray-100 p-4 rounded-2xl flex-shrink-0 relative overflow-hidden group cursor-pointer">
                      <div className="w-40 h-40 bg-white grid grid-cols-5 grid-rows-5 gap-1 p-2 shadow-sm rounded-xl">
                        <div className="bg-black col-span-2 row-span-2 rounded-tl-lg"></div>
                        <div className="bg-black col-start-4 row-span-2 rounded-tr-lg"></div>
                        <div className="bg-black col-start-5 row-start-1"></div>
                        <div className="bg-black col-start-1 row-start-4 row-span-2 rounded-bl-lg"></div>
                        <div className="bg-black col-start-4 row-start-4 col-span-2 row-span-2 rounded-br-lg"></div>
                        <div className="bg-black col-start-3 row-start-3"></div>
                        <div className="bg-black col-start-2 row-start-3"></div>
                        <div className="bg-primary col-start-3 row-start-4 rounded-full"></div>
                      </div>
                      <div className="absolute inset-0 bg-black/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="text-white font-bold text-sm">Ampliar</span>
                      </div>
                    </div>
                    <div className="flex-1 text-center md:text-left">
                      <div className="inline-block bg-primary/10 text-primary text-xs font-black uppercase tracking-widest px-3 py-1 rounded-lg mb-3">
                        Punto de Venta
                      </div>
                      <h3 className="text-2xl font-black text-gray-800 mb-3">QR del Mostrador (Proof of Presence)</h3>
                      <p className="text-gray-500 font-medium text-sm mb-6 leading-relaxed">
                        Este código QR es <strong className="text-gray-700">único e irrepetible para este comercio</strong> (<code>TenantID: LOCAL_CENTRO_123</code>). 
                        Imprímelo en un acrílico y colócalo en la caja. No necesitas generar uno nuevo para cada cliente. 
                        El sistema usa este código para enrutar al cliente a tu base de datos y verificar si le acabas de asignar un premio.
                      </p>
                       <div className="flex flex-wrap items-center gap-4 justify-center md:justify-start">
                         <button className="bg-gray-900 text-white font-bold px-6 py-3 rounded-xl hover:bg-gray-800 transition-colors shadow-lg active:scale-95">
                           Descargar QR en Alta Calidad
                         </button>
                         <div className="flex items-center gap-2 bg-yellow-50 px-4 py-3 rounded-xl border border-yellow-200 cursor-pointer hover:bg-yellow-100 transition-colors" onClick={() => setForceCashierPrompt(!forceCashierPrompt)}>
                           <input type="checkbox" checked={forceCashierPrompt} readOnly className="accent-yellow-600 w-4 h-4 cursor-pointer" />
                           <span className="text-yellow-800 font-bold text-sm">Entrenamiento: Avisos al Cajero</span>
                         </div>
                       </div>
                    </div>
                 </div>

                 <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                    {/* Caja Clásica Config */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-blue-100">
                       <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-3">
                           <div className="p-2 bg-blue-50 text-blue-600 rounded-xl"><Package size={24}/></div>
                           <h3 className="text-2xl font-black text-blue-900">Caja Clásica</h3>
                         </div>
                         <div className="flex items-center gap-3">
                           <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100">
                             <span className="text-xs font-bold text-gray-500">Activa</span>
                             <div className="w-8 h-4 bg-green-500 rounded-full flex items-center p-0.5">
                                <div className="w-3 h-3 bg-white rounded-full translate-x-4 shadow-sm"></div>
                             </div>
                           </div>
                           <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                         </div>
                       </div>
                       
                       <div className="flex flex-wrap items-center gap-2 mb-6 bg-blue-50/50 p-2 rounded-xl border border-blue-100 w-fit">
                         <span className="text-xs font-bold text-blue-800 uppercase tracking-wider">Activable en Ticket de:</span>
                         <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200">
                           <span className="text-gray-400 font-bold">$</span>
                           <input type="number" defaultValue={1000} className="w-16 outline-none text-sm font-black text-gray-800" />
                         </div>
                         <span className="text-gray-400 text-sm font-bold">a</span>
                         <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-blue-200">
                           <span className="text-gray-400 font-bold">$</span>
                           <input type="number" defaultValue={19999} className="w-20 outline-none text-sm font-black text-gray-800" />
                         </div>
                       </div>
                       
                       <div className="flex items-center justify-between mb-3">
                         <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Bolsa de Premios Mensual</h4>
                         <button className="text-xs font-bold text-blue-600 bg-blue-50 px-2 py-1 rounded hover:bg-blue-100 transition-colors">+ Agregar Premio</button>
                       </div>
                        <div className="space-y-3">
                          {classicPrizes.map((prize) => (
                            <div key={prize.id} className={`flex justify-between items-center p-2 rounded-xl border shadow-sm relative overflow-hidden ${prize.isJackpot ? 'bg-blue-50 border-blue-200' : 'bg-gray-50 border-gray-100'}`}>
                              {prize.isJackpot && <div className="absolute top-0 left-0 w-1 h-full bg-blue-500"></div>}
                              <div className="flex items-center gap-2 pl-2">
                                {prize.isJackpot && <span className="font-black text-blue-700 uppercase text-xs">Jackpot:</span>}
                                <input type="number" defaultValue={prize.points} className={`w-16 border shadow-sm rounded-lg px-2 py-1 text-center font-bold outline-none ${prize.isJackpot ? 'border-blue-300 text-blue-900 bg-white' : 'border-gray-200 text-gray-800'}`} />
                                <span className={`font-bold text-sm ${prize.isJackpot ? 'text-blue-800' : 'text-gray-600'}`}>Pts</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold flex items-center gap-2 ${prize.isJackpot ? 'text-blue-600' : 'text-gray-500'}`}>
                                  Stock: <input type="number" value={prize.stock} onChange={(e) => setClassicPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, stock: parseInt(e.target.value) || 0 } : p))} className={`w-20 border shadow-sm rounded-lg px-2 py-1 text-right outline-none ${prize.isJackpot ? 'border-blue-300 text-blue-900 bg-white' : 'border-gray-200 text-gray-800'}`} />
                                </span>
                                <button onClick={() => handleDeletePrize('clasica', prize.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16}/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                    </div>

                    {/* Caja Épica Config */}
                    <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-purple-100">
                       <div className="flex items-center justify-between mb-4">
                         <div className="flex items-center gap-3">
                           <div className="p-2 bg-purple-50 text-purple-600 rounded-xl"><Package size={24}/></div>
                           <h3 className="text-2xl font-black text-purple-900">Caja Épica</h3>
                         </div>
                         <div className="flex items-center gap-3">
                           <div className="flex items-center gap-2 bg-gray-50 px-2 py-1 rounded-lg border border-gray-100 cursor-pointer hover:bg-gray-100">
                             <span className="text-xs font-bold text-gray-500">Activa</span>
                             <div className="w-8 h-4 bg-green-500 rounded-full flex items-center p-0.5">
                                <div className="w-3 h-3 bg-white rounded-full translate-x-4 shadow-sm"></div>
                             </div>
                           </div>
                           <button className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"><Trash2 size={18}/></button>
                         </div>
                       </div>
                       
                       <div className="flex flex-wrap items-center gap-2 mb-6 bg-purple-50/50 p-2 rounded-xl border border-purple-100 w-fit">
                         <span className="text-xs font-bold text-purple-800 uppercase tracking-wider">Activable en Ticket de:</span>
                         <div className="flex items-center gap-1 bg-white px-2 py-1 rounded border border-purple-200">
                           <span className="text-gray-400 font-bold">$</span>
                           <input type="number" defaultValue={20000} className="w-20 outline-none text-sm font-black text-gray-800" />
                         </div>
                         <span className="text-gray-400 text-sm font-bold">en adelante</span>
                       </div>
                       
                       <div className="flex items-center justify-between mb-3">
                         <h4 className="font-bold text-gray-800 text-sm uppercase tracking-wider">Bolsa de Premios Mensual</h4>
                         <button className="text-xs font-bold text-purple-600 bg-purple-50 px-2 py-1 rounded hover:bg-purple-100 transition-colors">+ Agregar Premio</button>
                       </div>
                       <div className="space-y-3">
                          {epicPrizes.map((prize) => (
                            <div key={prize.id} className={`flex justify-between items-center p-2 rounded-xl border shadow-sm relative overflow-hidden ${prize.isJackpot ? 'bg-purple-50 border-purple-200' : 'bg-gray-50 border-gray-100'}`}>
                              {prize.isJackpot && <div className="absolute top-0 left-0 w-1 h-full bg-purple-500"></div>}
                              <div className="flex items-center gap-2 pl-2">
                                {prize.isJackpot && <span className="font-black text-purple-700 uppercase text-xs">Jackpot:</span>}
                                <input type="number" defaultValue={prize.points} className={`w-16 border shadow-sm rounded-lg px-2 py-1 text-center font-bold outline-none ${prize.isJackpot ? 'border-purple-300 text-purple-900 bg-white' : 'border-gray-200 text-gray-800'}`} />
                                <span className={`font-bold text-sm ${prize.isJackpot ? 'text-purple-800' : 'text-gray-600'}`}>Pts</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold flex items-center gap-2 ${prize.isJackpot ? 'text-purple-600' : 'text-gray-500'}`}>
                                  Stock: <input type="number" value={prize.stock} onChange={(e) => setEpicPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, stock: parseInt(e.target.value) || 0 } : p))} className={`w-20 border shadow-sm rounded-lg px-2 py-1 text-right outline-none ${prize.isJackpot ? 'border-purple-300 text-purple-900 bg-white' : 'border-gray-200 text-gray-800'}`} />
                                </span>
                                <button onClick={() => handleDeletePrize('epica', prize.id)} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-md transition-colors"><Trash2 size={16}/></button>
                              </div>
                            </div>
                          ))}
                        </div>
                    </div>

                    {/* Botón para Agregar Más Cajas Dinámicamente */}
                    <div className="bg-gray-50/50 border-2 border-dashed border-gray-300 rounded-3xl flex flex-col items-center justify-center p-8 text-gray-400 hover:text-blue-600 hover:border-blue-400 hover:bg-blue-50 cursor-pointer transition-all min-h-[300px] shadow-sm">
                      <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center shadow-sm mb-4 text-3xl font-light">+</div>
                      <h3 className="text-xl font-bold">Agregar Nueva Escala</h3>
                      <p className="text-sm mt-2 text-center max-w-[200px] font-medium">Crea una nueva caja para un rango de compra distinto.</p>
                    </div>
                 </div>

                 {/* Vencimientos Exclusivos */}
                 <div className="bg-white p-8 rounded-3xl shadow-[0_4px_20px_rgba(0,0,0,0.02)] border border-red-100">
                    <div className="flex items-center gap-3 mb-2">
                       <div className="p-2 bg-red-50 text-red-600 rounded-xl"><Calendar size={24}/></div>
                       <h3 className="text-2xl font-black text-red-900">Caducidad Acelerada (Sorteos)</h3>
                    </div>
                    <p className="text-sm font-medium text-gray-500 mb-8 max-w-3xl">A diferencia de los puntos por compra (que vencen en 6 meses), los puntos ganados en sorteos deben generar <strong>urgencia psicológica</strong> para forzar una nueva visita rápida. Configura aquí su ventana de expiración según la cantidad ganada.</p>
                    
                    <div className="overflow-hidden rounded-2xl border border-gray-200">
                      <table className="w-full text-left bg-white">
                         <thead className="bg-gray-50 border-b border-gray-200">
                           <tr className="text-gray-500 text-xs font-bold uppercase tracking-widest">
                             <th className="py-4 px-6">Min Puntos</th>
                             <th className="py-4 px-6">Max Puntos</th>
                             <th className="py-4 px-6 text-right">Días de Validez</th>
                             <th className="py-4 px-6"></th>
                           </tr>
                         </thead>
                          <tbody className="text-gray-800 font-medium divide-y divide-gray-100">
                            {expirationRules.map(rule => (
                              <tr key={rule.id} className="hover:bg-gray-50 transition-colors">
                                <td className="py-4 px-6">{rule.min} pts</td>
                                <td className="py-4 px-6">{rule.max} pts</td>
                                <td className="py-4 px-6 text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <input type="number" defaultValue={rule.days} className="w-20 border border-gray-200 shadow-sm rounded-lg px-3 py-1.5 text-center font-bold focus:ring-2 focus:ring-red-500 focus:border-red-500 outline-none transition-all" /> 
                                    <span className="text-gray-500">días</span>
                                  </div>
                                </td>
                                <td className="py-4 px-6 text-right text-gray-400 hover:text-red-500 cursor-pointer transition-colors" onClick={() => handleDeleteRule(rule.id)}>✕</td>
                              </tr>
                            ))}
                          </tbody>
                      </table>
                    </div>
                    <button className="mt-6 text-sm text-red-600 font-bold px-5 py-2.5 bg-red-50 rounded-xl hover:bg-red-100 transition-colors border border-red-100 active:scale-95 shadow-sm">+ Agregar Nueva Regla de Caducidad</button>
                 </div>

              </div>
           </div>
        </div>
      )}
    </div>
  )
}

export default App
