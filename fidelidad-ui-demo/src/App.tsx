import { useState } from 'react';
import { CircularProgress } from './components/CircularProgress';
import { BottomSheet } from './components/BottomSheet';
import { CampaignCarousel } from './components/CampaignCarousel';
import { MasterCalculatorModal } from './components/MasterCalculatorModal';
import { Scan, Gift, History, User, CheckCircle, Sparkles, Lock, Unlock, Settings, Package, Calendar, Trash2, ArrowLeft, ArrowRight, DollarSign, Store, Smartphone } from 'lucide-react';
import confetti from 'canvas-confetti';
import { motion, AnimatePresence } from 'framer-motion';

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

function App() {
  const [activeRole, setActiveRole] = useState<'hub' | 'cashier' | 'admin' | 'client'>('hub');

  const [points, setPoints] = useState(150);
  const targetPoints = 300;
  
  const [boxes, setBoxes] = useState<MysteryBox[]>([]);
  const [activeBoxId, setActiveBoxId] = useState<string | null>(null);
  
  const [transactions, setTransactions] = useState<Transaction[]>([
    { id: 't1', type: 'compra', points: 150, date: new Date(), expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) }
  ]);
  
  const [isSheetOpen, setIsSheetOpen] = useState(false);
  const [sheetView, setSheetView] = useState<'box_list' | 'box_detail' | 'scanning_qr' | 'history'>('box_list');
  const [flashBanner, setFlashBanner] = useState<{message: string, tier: BoxTier} | null>(null);
  const [isCalculatorOpen, setIsCalculatorOpen] = useState(false);

  // Cashier Settings
  const [cashierAmount, setCashierAmount] = useState<string>('');
  const [cashierStatus, setCashierStatus] = useState<{type: 'success' | 'error', msg: string} | null>(null);

  // Admin Settings
  const [isCampaignActive, setIsCampaignActive] = useState(true);
  
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

  const [isOpening, setIsOpening] = useState(false);
  const [flashingPrize, setFlashingPrize] = useState("???");

  const simulateCashierTransaction = () => {
    const amount = Number(cashierAmount);
    if (amount <= 0) {
      setCashierStatus({ type: 'error', msg: 'Ingresa un monto válido.' });
      return;
    }

    const basePoints = amount > 20000 ? 250 : 25;
    setPoints(prev => Math.min(prev + basePoints, targetPoints));
    
    setTransactions(prev => [{
      id: Math.random().toString(36).substr(2, 9),
      type: 'compra',
      points: basePoints,
      date: new Date(),
      expiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000)
    }, ...prev]);

    if (!isCampaignActive) {
      setCashierStatus({ type: 'success', msg: `Se asignaron ${basePoints} puntos. Sorteo inactivo.` });
      setCashierAmount('');
      return;
    }

    const tier: BoxTier = amount > 20000 ? 'epica' : 'clasica';
    const newBox: MysteryBox = {
      id: Math.random().toString(36).substr(2, 9),
      tier,
      state: 'locked',
      timestamp: new Date()
    };
    
    setBoxes(prev => [newBox, ...prev]);
    setActiveBoxId(newBox.id);
    
    setFlashBanner({
      message: `¡Sumaste ${basePoints} Puntos! 🎁 Y además ganaste una oportunidad de abrir una Caja ${tier.toUpperCase()}. Escanéa el QR del mostrador.`,
      tier
    });
    
    setTimeout(() => setFlashBanner(null), 10000);
    setCashierStatus({ type: 'success', msg: `¡Cobro exitoso! El cliente ganó una Caja ${tier === 'epica' ? 'Épica' : 'Clásica'}.` });
    setCashierAmount('');

    setTimeout(() => setCashierStatus(null), 3000);
  };

  const handleSimulateQRScan = () => {
    setSheetView('scanning_qr');
    setTimeout(() => {
      setBoxes(prev => prev.map(b => b.state === 'locked' ? { ...b, state: 'unlocked' } : b));
      setSheetView(activeBoxId ? 'box_detail' : 'box_list'); 
    }, 1500);
  };

  const handlePlayGame = () => {
    const activeBox = boxes.find(b => b.id === activeBoxId);
    if (!activeBox || activeBox.state !== 'unlocked') return;

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

    setIsOpening(true);
    
    const bag = activeBox.tier === 'epica' ? epicPrizes : classicPrizes;
    const possiblePoints = bag.map(p => p.isJackpot ? "¡Jackpot!" : `${p.points} Pts`);
    if (possiblePoints.length === 0) possiblePoints.push("5 Pts", "25 Pts");

    const interval = setInterval(() => {
      setFlashingPrize(possiblePoints[Math.floor(Math.random() * possiblePoints.length)]);
    }, 100);

    setTimeout(() => {
      clearInterval(interval);
      setIsOpening(false);
      
      const oscWin = audioCtx.createOscillator();
      const gainWin = audioCtx.createGain();
      oscWin.type = 'sine';
      oscWin.frequency.setValueAtTime(523.25, audioCtx.currentTime);
      oscWin.frequency.setValueAtTime(659.25, audioCtx.currentTime + 0.1);
      oscWin.frequency.setValueAtTime(783.99, audioCtx.currentTime + 0.2);
      oscWin.frequency.setValueAtTime(1046.50, audioCtx.currentTime + 0.3);
      gainWin.gain.setValueAtTime(0.2, audioCtx.currentTime);
      gainWin.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 1.5);
      oscWin.connect(gainWin);
      gainWin.connect(audioCtx.destination);
      oscWin.start();
      oscWin.stop(audioCtx.currentTime + 1.5);

      const availableTickets = bag.flatMap(p => Array(p.stock).fill(p));
      let wonPrize = { points: activeBox.tier === 'epica' ? 25 : 5, id: 'fallback', isJackpot: false };
      
      if (availableTickets.length > 0) {
        const randomIndex = Math.floor(Math.random() * availableTickets.length);
        wonPrize = availableTickets[randomIndex];
        
        if (activeBox.tier === 'clasica') {
          setClassicPrizes(prev => prev.map(p => p.id === wonPrize.id ? { ...p, stock: p.stock - 1 } : p));
        } else {
          setEpicPrizes(prev => prev.map(p => p.id === wonPrize.id ? { ...p, stock: p.stock - 1 } : p));
        }
      }

      const prize = wonPrize.points;
      
      setBoxes(prev => prev.map(b => b.id === activeBoxId ? { ...b, state: 'opened', prizeWon: prize } : b));
      setPoints(prev => prev + prize);
      
      setTransactions(prev => [{
        id: Math.random().toString(36).substr(2, 9),
        type: 'sorteo',
        points: prize,
        date: new Date(),
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)
      }, ...prev]);
      
      const colors = activeBox.tier === 'epica' ? ['#ffb300', '#ffd54f', '#ffffff'] : ['#8e24aa', '#d81b60', '#ffb300'];
      confetti({ particleCount: 150, spread: 80, origin: { y: 0.6 }, colors });
    }, 3200);
  };

  const renderHub = () => (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gray-50 p-6">
      <h1 className="text-3xl font-black text-gray-800 mb-2">Simulador de Ecosistema</h1>
      <p className="text-gray-500 mb-10 text-center max-w-md">Selecciona un rol para simular una parte específica del sistema de fidelidad. Esta vista consolida todas las herramientas.</p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full max-w-4xl">
        <div onClick={() => setActiveRole('cashier')} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 hover:shadow-xl hover:border-blue-300 transition-all cursor-pointer flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Store size={32} /></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Punto de Venta</h2>
          <p className="text-sm text-gray-500">Simulador simplificado de cobro para cajeros. Acredita puntos y genera premios automáticamente.</p>
        </div>

        <div onClick={() => setActiveRole('admin')} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 hover:shadow-xl hover:border-purple-300 transition-all cursor-pointer flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Settings size={32} /></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">Panel Admin</h2>
          <p className="text-sm text-gray-500">Configura la probabilidad de los premios, stock, y parámetros del motor de gamificación.</p>
        </div>

        <div onClick={() => setActiveRole('client')} className="bg-white rounded-3xl p-8 shadow-sm border border-gray-200 hover:shadow-xl hover:border-pink-300 transition-all cursor-pointer flex flex-col items-center text-center group">
          <div className="w-16 h-16 bg-pink-100 text-pink-600 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform"><Smartphone size={32} /></div>
          <h2 className="text-xl font-bold text-gray-800 mb-2">App Cliente (PWA)</h2>
          <p className="text-sm text-gray-500">Vista del consumidor. Escanea QRs y abre cajas sorpresa desde un dispositivo móvil.</p>
        </div>
      </div>
    </div>
  );

  const renderCashier = () => (
    <div className="min-h-screen bg-gray-100 flex flex-col items-center justify-center p-6 font-sans">
      <div className="bg-white rounded-3xl shadow-xl border border-gray-200 w-full max-w-sm overflow-hidden">
        <div className="bg-blue-600 p-6 text-white text-center">
          <h2 className="text-2xl font-black">Caja Registradora</h2>
          <p className="text-blue-200 text-sm">Simulador de Punto de Venta</p>
        </div>
        
        <div className="p-6">
          <label className="text-sm font-bold text-gray-500 uppercase tracking-wider mb-2 block text-center">Monto de la Compra</label>
          <div className="flex items-center justify-center text-5xl font-black text-gray-800 mb-8 mt-4">
            <span className="text-gray-400 mr-2">$</span>
            {cashierAmount || '0'}
          </div>

          <div className="grid grid-cols-3 gap-3 mb-6">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <button key={num} onClick={() => setCashierAmount(prev => prev + num)} className="bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-2xl py-4 rounded-xl transition-colors">{num}</button>
            ))}
            <button onClick={() => setCashierAmount('')} className="bg-red-50 hover:bg-red-100 text-red-500 font-bold text-lg py-4 rounded-xl transition-colors">C</button>
            <button onClick={() => setCashierAmount(prev => prev + '0')} className="bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-2xl py-4 rounded-xl transition-colors">0</button>
            <button onClick={() => setCashierAmount(prev => prev.slice(0, -1))} className="bg-gray-50 hover:bg-gray-100 text-gray-800 font-bold text-lg py-4 rounded-xl transition-colors">⌫</button>
          </div>

          <button onClick={simulateCashierTransaction} className="w-full bg-blue-600 hover:bg-blue-700 text-white font-black text-xl py-4 rounded-2xl flex items-center justify-center gap-2 transition-transform active:scale-95 shadow-lg shadow-blue-600/30">
            <Scan size={24} /> Cobrar y Sumar Puntos
          </button>

          <AnimatePresence>
            {cashierStatus && (
              <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className={`mt-4 p-4 rounded-xl text-center font-bold text-sm ${cashierStatus.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                {cashierStatus.msg}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </div>
  );

  const renderAdmin = () => (
    <div className="min-h-screen bg-gray-50 p-6 overflow-y-auto">
      <div className="max-w-4xl mx-auto space-y-6">
        
        <div className="flex justify-between items-center bg-white p-6 rounded-3xl shadow-sm border border-gray-200">
          <div>
            <h1 className="text-2xl font-black text-gray-800">Panel de Administración</h1>
            <p className="text-gray-500">Configura de manera intuitiva los premios de fidelidad.</p>
          </div>
          <div className="flex gap-3">
             <button onClick={() => setIsCalculatorOpen(true)} className="flex items-center gap-2 px-4 py-2 bg-purple-50 text-purple-700 font-bold rounded-xl border border-purple-200 hover:bg-purple-100 transition-colors">
              <Settings size={18} /> Opciones Avanzadas (Master Calculator)
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Caja Clásica */}
          <div className="bg-white rounded-3xl shadow-sm border border-blue-100 overflow-hidden">
            <div className="bg-blue-50 p-6 border-b border-blue-100 flex items-center gap-3">
              <div className="p-3 bg-white text-blue-600 rounded-xl shadow-sm"><Package size={24}/></div>
              <div>
                <h3 className="text-xl font-black text-blue-900">Caja Clásica</h3>
                <p className="text-sm text-blue-700">Para compras menores a $20.000</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">Stock mensual de premios que saldrán en las cajas clásicas.</p>
              <div className="space-y-3">
                {classicPrizes.map((prize) => (
                  <div key={prize.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <span className="font-bold text-gray-700">{prize.isJackpot ? 'Premio Mayor' : 'Premio Normal'} ({prize.points} Pts)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Stock:</span>
                      <input type="number" value={prize.stock} onChange={(e) => setClassicPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, stock: parseInt(e.target.value) || 0 } : p))} className="w-16 border border-gray-300 rounded px-2 py-1 text-center font-bold" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Caja Épica */}
          <div className="bg-white rounded-3xl shadow-sm border border-purple-100 overflow-hidden">
            <div className="bg-purple-50 p-6 border-b border-purple-100 flex items-center gap-3">
              <div className="p-3 bg-white text-purple-600 rounded-xl shadow-sm"><Package size={24}/></div>
              <div>
                <h3 className="text-xl font-black text-purple-900">Caja Épica</h3>
                <p className="text-sm text-purple-700">Para compras mayores a $20.000</p>
              </div>
            </div>
            <div className="p-6">
              <p className="text-sm text-gray-500 mb-4">Premios premium con más probabilidades de retener al cliente.</p>
              <div className="space-y-3">
                {epicPrizes.map((prize) => (
                  <div key={prize.id} className="flex justify-between items-center bg-gray-50 p-3 rounded-xl border border-gray-200">
                    <span className="font-bold text-gray-700">{prize.isJackpot ? 'Premio Mayor' : 'Premio Normal'} ({prize.points} Pts)</span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-500">Stock:</span>
                      <input type="number" value={prize.stock} onChange={(e) => setEpicPrizes(prev => prev.map(p => p.id === prize.id ? { ...p, stock: parseInt(e.target.value) || 0 } : p))} className="w-16 border border-gray-300 rounded px-2 py-1 text-center font-bold" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

      </div>

      <MasterCalculatorModal 
        isOpen={isCalculatorOpen} 
        onClose={() => setIsCalculatorOpen(false)} 
        config={{ pointValue: 10, pointsMoneyBase: 100 }} 
        onSave={() => setIsCalculatorOpen(false)} 
      />
    </div>
  );

  const renderClient = () => (
    <div className="min-h-[100vh] pb-32 bg-gray-50 max-w-md mx-auto relative shadow-2xl overflow-x-hidden font-sans border-x border-gray-200">
       <AnimatePresence>
        {flashBanner && (
          <motion.div 
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
          >
            <div className={`w-full max-w-sm rounded-[32px] shadow-2xl p-6 text-center relative overflow-hidden ${flashBanner.tier === 'epica' ? 'bg-gradient-to-br from-purple-100 to-purple-300' : 'bg-gradient-to-br from-pink-100 to-pink-300'}`}>
              <button onClick={() => setFlashBanner(null)} className="absolute top-4 right-4 text-gray-500 hover:text-gray-800">✕</button>
              <motion.div animate={{ y: [0, -10, 0] }} transition={{ duration: 2, repeat: Infinity }} className="mx-auto w-24 h-24 bg-white rounded-full flex items-center justify-center shadow-lg mb-4">
                <Gift size={48} className={flashBanner.tier === 'epica' ? 'text-purple-600' : 'text-pink-600'} />
              </motion.div>
              <h2 className="text-2xl font-black text-gray-900 mb-2 uppercase tracking-tight">¡Caja Sorpresa!</h2>
              <p className="text-gray-800 font-medium mb-6 text-sm">{flashBanner.message}</p>
              <button 
                onClick={() => { setFlashBanner(null); handleSimulateQRScan(); setIsSheetOpen(true); }}
                className={`w-full py-4 text-white text-lg font-black rounded-2xl active:scale-95 transition-all flex justify-center items-center gap-2 shadow-lg ${flashBanner.tier === 'epica' ? 'bg-purple-600' : 'bg-pink-600'}`}
              >
                <Scan size={24} /> Escanear QR Ahora
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <header className="text-white pt-6 pb-10 px-6 rounded-b-[40px] shadow-lg relative overflow-hidden" style={{ background: 'linear-gradient(135deg, #4a148c 0%, #880e4f 50%, #ad1457 100%)' }}>
        <div className="flex justify-between items-center relative z-10">
          <div>
            <h1 className="text-2xl font-black tracking-tight">¡Hola, Pablo! 👋</h1>
            <p className="text-white/90 font-bold bg-black/20 px-3 py-1 rounded-full inline-block mt-1 text-sm">Nivel Oro</p>
          </div>
          <div className="relative">
            <button onClick={() => { setSheetView('box_list'); setIsSheetOpen(true); }} className="p-3 bg-white/10 border border-white/20 rounded-full backdrop-blur-md active:scale-90 transition-transform"><Gift size={20} /></button>
            {boxes.filter(b => b.state !== 'opened').length > 0 && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-yellow-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-4 w-4 bg-yellow-400 text-[9px] font-bold text-black items-center justify-center">{boxes.filter(b => b.state !== 'opened').length}</span>
              </span>
            )}
          </div>
        </div>
        <div className="mt-8 flex justify-center relative z-10">
          <CircularProgress progress={points} total={targetPoints} label="tu próximo premio" />
        </div>
      </header>

      <div className="mt-8 mb-6">
        <h2 className="text-lg font-black text-gray-800 px-6 mb-4">Promociones y Ofertas</h2>
        <CampaignCarousel />
      </div>

      <main className="px-6 space-y-8">
        <div className="grid grid-cols-2 gap-4">
          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { if (boxes.filter(b => b.state === 'locked').length === 0) { alert("Escáner QR Normal"); } else { handleSimulateQRScan(); setIsSheetOpen(true); } }} className="flex flex-col items-center justify-center gap-3 p-5 bg-white rounded-[28px] shadow-sm border border-gray-100">
             <div className="p-4 bg-pink-100 text-pink-600 rounded-2xl relative">
              <Scan size={28} />
              {boxes.filter(b => b.state === 'locked').length > 0 && <div className="absolute -top-1 -right-1 w-3 h-3 bg-yellow-400 rounded-full animate-pulse shadow-lg" />}
            </div>
            <span className="font-bold text-sm text-gray-800">Escanear Local</span>
          </motion.button>

          <motion.button whileTap={{ scale: 0.95 }} onClick={() => { setSheetView('box_list'); setIsSheetOpen(true); }} className="flex flex-col items-center justify-center gap-3 p-5 bg-white rounded-[28px] shadow-sm border border-gray-100">
            <div className="p-4 bg-purple-100 text-purple-600 rounded-2xl relative">
              <Gift size={28} />
               {boxes.filter(b => b.state !== 'opened').length > 0 && <div className="absolute -top-2 -right-2 bg-yellow-400 text-black font-bold text-xs w-5 h-5 rounded-full flex items-center justify-center">{boxes.filter(b => b.state !== 'opened').length}</div>}
            </div>
            <span className="font-bold text-sm text-gray-800">Mis Premios</span>
          </motion.button>
        </div>
      </main>

      <nav className="absolute bottom-0 w-full bg-white/80 backdrop-blur-lg border-t border-gray-100 p-4 pb-safe flex justify-around items-center rounded-t-[32px] shadow-[0_-10px_40px_rgba(0,0,0,0.05)] z-30">
        <button className="flex flex-col items-center text-pink-600 gap-1"><Scan size={24} /><span className="text-[10px] font-black uppercase tracking-wider mt-1">Inicio</span></button>
        <button onClick={() => { setSheetView('history'); setIsSheetOpen(true); }} className="flex flex-col items-center text-gray-400 hover:text-gray-800 gap-1 transition-colors"><History size={24} /><span className="text-[10px] font-bold uppercase tracking-wider mt-1">Historial</span></button>
        <button className="flex flex-col items-center text-gray-400 hover:text-gray-800 gap-1 transition-colors"><User size={24} /><span className="text-[10px] font-bold uppercase tracking-wider mt-1">Perfil</span></button>
      </nav>

      <BottomSheet isOpen={isSheetOpen} onClose={() => setIsSheetOpen(false)}>
        <div className="py-2 min-h-[350px] flex flex-col">
          <AnimatePresence mode="wait">
            {sheetView === 'box_list' && (
              <motion.div key="list" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex-1">
                <h3 className="text-xl font-black text-gray-800 mb-4 px-4">Tus Sorpresas</h3>
                {boxes.filter(b => b.state !== 'opened').length === 0 ? (
                  <div className="text-center py-10 px-4 text-gray-500"><Gift size={48} className="mx-auto mb-4 opacity-20" /><p>No tienes premios pendientes.</p></div>
                ) : (
                  <div className="space-y-3 px-4 pb-4">
                    {boxes.filter(b => b.state !== 'opened').map(box => (
                      <div key={box.id} onClick={() => { setActiveBoxId(box.id); setSheetView('box_detail'); }} className="p-4 rounded-[20px] flex items-center justify-between border bg-white border-gray-200 shadow-sm cursor-pointer active:scale-95 transition-transform">
                        <div className="flex items-center gap-3">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${box.tier === 'epica' ? 'bg-gradient-to-tr from-purple-400 to-purple-200 text-purple-900' : 'bg-gradient-to-tr from-pink-200 to-pink-100 text-pink-600'}`}><Gift size={24} /></div>
                          <div>
                            <p className="font-bold text-gray-800">Caja {box.tier === 'epica' ? 'Épica' : 'Clásica'}</p>
                            <p className="text-xs text-gray-500 flex items-center gap-1">{box.state === 'locked' && <><Lock size={10} /> Bloqueada</>} {box.state === 'unlocked' && <><Unlock size={10} className="text-green-500"/> Lista para abrir</>}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </motion.div>
            )}

            {sheetView === 'box_detail' && activeBoxId && (
              <motion.div key="detail" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }} className="w-full flex-1 flex flex-col items-center justify-center text-center px-4">
                {boxes.find(b => b.id === activeBoxId)?.state === 'locked' && (
                  <><div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mb-6 relative"><Gift size={48} className="text-gray-400" /><div className="absolute -bottom-2 -right-2 bg-red-100 text-red-500 p-2 rounded-full"><Lock size={20} /></div></div><h3 className="text-2xl font-black text-gray-800 mb-2">Caja Bloqueada</h3><p className="text-gray-500 font-medium mb-8 text-sm">Necesitas escanear el código QR de la sucursal para poder abrirla.</p><button onClick={handleSimulateQRScan} className="w-full py-4 bg-gray-900 text-white text-lg font-black rounded-2xl active:scale-95 flex justify-center items-center gap-2"><Scan size={20} /> Escanear QR Físico ahora</button></>
                )}
                {boxes.find(b => b.id === activeBoxId)?.state === 'unlocked' && (
                  isOpening ? (
                    <div className="flex flex-col items-center justify-center py-8 w-full"><h3 className="text-xl font-bold text-gray-400 mb-8 uppercase animate-pulse">Sorteando...</h3><div className={`w-full h-32 border-y-4 border-dashed relative flex justify-center items-center overflow-hidden`}><motion.h1 key={flashingPrize} initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className={`text-5xl font-black italic`}>{flashingPrize}</motion.h1></div></div>
                  ) : (
                   <><div className={`w-32 h-32 rounded-full flex items-center justify-center mb-6 shadow-2xl relative bg-gradient-to-tr from-pink-500 to-purple-500`}><Gift size={64} className="text-white animate-bounce" /><div className="absolute -top-2 -right-2 bg-green-400 text-white p-2 rounded-full"><Unlock size={20} /></div></div><h3 className="text-3xl font-black text-gray-800 mb-2">¡Lista para abrir!</h3><p className="text-gray-500 font-medium mb-8 text-sm">Has validado tu ubicación.</p><button onClick={handlePlayGame} className="w-full py-4 text-white text-lg font-black rounded-2xl bg-pink-600"><Sparkles size={20} /> ¡Abrir Caja!</button></>
                  )
                )}
                {boxes.find(b => b.id === activeBoxId)?.state === 'opened' && (
                   <><div className="w-full py-4 flex flex-col items-center"><div className="w-24 h-24 bg-green-100 rounded-full flex items-center justify-center mb-6"><CheckCircle size={48} className="text-green-500" /></div><h3 className="text-xl font-bold text-gray-500 mb-2 uppercase">¡Puntos Acreditados!</h3><h1 className="text-6xl font-black mb-4 text-pink-600">+{boxes.find(b => b.id === activeBoxId)?.tier === 'epica' ? '250' : '25'} Pts</h1><button onClick={() => setIsSheetOpen(false)} className="w-full py-4 bg-gray-900 text-white text-lg font-black rounded-2xl">Entendido</button></div></>
                )}
              </motion.div>
            )}

            {sheetView === 'scanning_qr' && (
              <motion.div key="scanning" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="w-full flex-1 flex flex-col items-center justify-center py-10"><Scan size={64} className="text-pink-600 animate-pulse mb-6" /><h3 className="text-xl font-bold text-gray-800 mb-2">Escaneando...</h3></motion.div>
            )}

            {sheetView === 'history' && (
              <motion.div key="history" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="w-full flex-1"><h3 className="text-xl font-black text-gray-800 mb-4 px-4">Tus Movimientos</h3><div className="space-y-3 px-4 pb-4">{transactions.map(t => (<div key={t.id} className="p-4 bg-white border border-gray-100 shadow-sm rounded-[20px] flex justify-between items-center"><div className="flex gap-3 items-center"><div className={`p-3 rounded-2xl ${t.type === 'sorteo' ? 'bg-purple-50 text-purple-600' : 'bg-gray-50 text-gray-400'}`}>{t.type === 'sorteo' ? <Sparkles size={20} /> : <Package size={20} />}</div><div className="flex flex-col"><span className="font-bold text-gray-800">{t.type === 'compra' ? 'Suma por Compra' : 'Caja Sorpresa'}</span><span className="text-[10px] font-bold mt-1 px-2 py-0.5 rounded-md inline-block text-gray-500 bg-gray-100">Vence: {t.expiresAt.toLocaleDateString()}</span></div></div><div className="font-black text-lg text-pink-600">+{t.points}</div></div>))}</div></motion.div>
            )}
          </AnimatePresence>
        </div>
      </BottomSheet>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
       {activeRole !== 'hub' && (
         <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between shrink-0 shadow-md relative z-[100]">
           <button onClick={() => setActiveRole('hub')} className="flex items-center gap-2 hover:bg-gray-800 p-2 rounded-lg transition-colors text-sm font-bold">
             <ArrowLeft size={16} /> Volver al Hub
           </button>
           <div className="text-xs font-bold uppercase tracking-widest text-gray-400">
             {activeRole === 'cashier' ? 'Simulador POS' : activeRole === 'admin' ? 'Configuración' : 'PWA'}
           </div>
         </div>
       )}
       
       <div className="flex-1 relative overflow-x-hidden">
         {activeRole === 'hub' && renderHub()}
         {activeRole === 'cashier' && renderCashier()}
         {activeRole === 'admin' && renderAdmin()}
         {activeRole === 'client' && renderClient()}
       </div>
    </div>
  );
}

export default App;
