import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Gift, Search, ArrowRight, Loader2, AlertCircle } from 'lucide-react';
import { MysteryBoxService, MysteryBoxChance } from '../../../services/mysteryBoxService';
import { useClientAuth } from '../contexts/ClientAuthContext';

export const MysteryBoxLookupPage = () => {
    const navigate = useNavigate();
    const { user, userData, loading: authLoading } = useClientAuth();
    
    const [dni, setDni] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [chances, setChances] = useState<MysteryBoxChance[]>([]);
    const [searched, setSearched] = useState(false);

    // AUTO-LOOKUP EXACTAMENTE COMO PIDIÓ EL USUARIO
    // "haga que la pwa mande el dato diciendole al servidor hola soy yo, hay algun codigo para mi ?"
    useEffect(() => {
        if (!authLoading && user && userData?.dni) {
            const autoFetch = async () => {
                setLoading(true);
                try {
                    const results = await MysteryBoxService.getPendingByUid(user.uid);
                    setChances(results);
                    setSearched(true);
                    
                    // Si encuentra exactamente 1 caja sorpresa pendiente, entra automático
                    if (results.length === 1) {
                        navigate(`/play/${results[0].id}`);
                    }
                } catch (err) {
                    console.error('Error auto-fetching boxes:', err);
                } finally {
                    setLoading(false);
                }
            };
            autoFetch();
        } else if (!authLoading && !user) {
            // Si sabemos que no está logueado, detenemos la carga inicial
            setLoading(false);
        }
    }, [authLoading, user, navigate]);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        const cleanDni = dni.trim().replace(/[^0-9]/g, '');
        if (cleanDni.length < 6) {
            setError('Ingresa un DNI o celular válido.');
            return;
        }

        setError('');
        setLoading(true);
        try {
            const results = await MysteryBoxService.getPendingByDni(cleanDni);
            setChances(results);
            setSearched(true);
            
            if (results.length === 1) {
                navigate(`/play/${results[0].id}`);
            }
        } catch (err) {
            console.error(err);
            setError('Ocurrió un error al buscar tus sorteos.');
        } finally {
            setLoading(false);
        }
    };

    const handlePlay = (id: string) => {
        navigate(`/play/${id}`);
    };

    // Mostrar loader mientras resuelve sesión o hace auto-fetch
    if (authLoading || (loading && !searched && user)) {
        return (
            <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
                <Loader2 className="w-10 h-10 animate-spin text-orange-500 mb-4" />
                <p className="text-gray-500 font-medium animate-pulse">Buscando tus sorpresas...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-3xl shadow-xl overflow-hidden border border-orange-100">
                <div className="bg-gradient-to-br from-orange-500 to-rose-500 p-8 text-center relative overflow-hidden">
                    <div className="absolute top-0 left-0 w-full h-full opacity-10 bg-[radial-gradient(circle_at_center,_white_0%,_transparent_100%)]"></div>
                    <Gift className="w-16 h-16 text-white mx-auto mb-4 animate-bounce" />
                    <h1 className="text-3xl font-black text-white tracking-tight relative z-10">
                        Caja Sorpresa
                    </h1>
                    <p className="text-orange-100 font-medium mt-2 relative z-10">
                        {user ? '¡Descubrí si tenés premios esperándote!' : 'Buscá tus sorteos pendientes'}
                    </p>
                </div>

                <div className="p-8">
                    {!searched || chances.length === 0 ? (
                        <form onSubmit={handleSearch} className="space-y-6">
                            
                            {searched && chances.length === 0 && (
                                <div className="bg-orange-50 text-orange-800 p-4 rounded-2xl flex items-start gap-3 border border-orange-100">
                                    <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5 text-orange-500" />
                                    <div>
                                        <p className="font-bold text-sm">No encontramos sorteos pendientes</p>
                                        <p className="text-xs mt-1 opacity-80">
                                            {user ? 'No hay cajas sorpresas pendientes para tu cuenta en este momento.' : 'Asegurate de haber ingresado el mismo DNI o Celular con el que te registraron la compra.'}
                                        </p>
                                    </div>
                                </div>
                            )}

                            {/* Si está logueado pero no tiene sorteos, le permitimos buscar otro DNI o salir */}
                            {!user && (
                                <div>
                                    <label className="block text-sm font-bold text-gray-700 mb-2">Ingresá tu DNI o Celular</label>
                                    <div className="relative">
                                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                                            <Search className="h-5 w-5 text-gray-400" />
                                        </div>
                                        <input 
                                            type="tel"
                                            value={dni}
                                            onChange={e => {
                                                setDni(e.target.value);
                                                setSearched(false);
                                            }}
                                            className="w-full pl-11 pr-4 py-4 bg-gray-50 border border-gray-200 rounded-2xl focus:ring-4 focus:ring-orange-500/20 focus:border-orange-500 transition-all font-bold text-gray-900 text-lg outline-none placeholder:font-normal placeholder:text-gray-400"
                                            placeholder="Ej: 30123456"
                                            autoFocus
                                        />
                                    </div>
                                    {error && <p className="text-red-500 text-xs font-bold mt-2">{error}</p>}
                                </div>
                            )}

                            {!user ? (
                                <button
                                    type="submit"
                                    disabled={loading || !dni}
                                    className="w-full bg-gradient-to-r from-orange-500 to-rose-500 text-white font-black py-4 px-6 rounded-2xl hover:opacity-90 active:scale-95 transition-all shadow-lg shadow-orange-500/30 flex items-center justify-center gap-2 disabled:opacity-50 disabled:active:scale-100 disabled:shadow-none"
                                >
                                    {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                                        <>
                                            BUSCAR MIS SORTEOS
                                            <ArrowRight className="w-5 h-5" />
                                        </>
                                    )}
                                </button>
                            ) : (
                                <div className="text-center pt-2">
                                    <button 
                                        type="button"
                                        onClick={() => navigate('/')} 
                                        className="text-orange-500 font-bold hover:text-orange-600 transition-colors"
                                    >
                                        Volver a mi panel
                                    </button>
                                </div>
                            )}
                        </form>
                    ) : (
                        <div className="space-y-4">
                            <h3 className="font-black text-gray-900 text-center mb-6">¡Tenés {chances.length} {chances.length === 1 ? 'sorteo pendiente' : 'sorteos pendientes'}!</h3>
                            
                            {chances.map((c, i) => (
                                <button
                                    key={c.id}
                                    onClick={() => handlePlay(c.id)}
                                    className="w-full text-left bg-orange-50 hover:bg-orange-100 border border-orange-200 p-4 rounded-2xl transition-all flex items-center justify-between group active:scale-95"
                                >
                                    <div>
                                        <div className="font-bold text-orange-900 flex items-center gap-2">
                                            <Gift className="w-4 h-4 text-orange-500" />
                                            Caja Sorpresa #{i+1}
                                        </div>
                                        <div className="text-xs text-orange-600/70 font-medium mt-1">
                                            Válido hasta hoy a las {c.expiresAt?.toDate().toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
                                        </div>
                                    </div>
                                    <div className="w-8 h-8 rounded-full bg-orange-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform shadow-md shadow-orange-500/30">
                                        <ArrowRight className="w-4 h-4" />
                                    </div>
                                </button>
                            ))}
                            
                            <button 
                                onClick={() => navigate('/')}
                                className="w-full text-center text-sm font-bold text-gray-400 hover:text-gray-600 mt-6 pt-4 border-t border-gray-100"
                            >
                                Volver a mi panel
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
