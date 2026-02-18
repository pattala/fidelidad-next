import React, { useState, useEffect } from 'react';
import { Settings2, MoveVertical } from 'lucide-react';

export const ClientPaddingTool = ({ initialValue = 12 }: { initialValue?: number }) => {
    const [padding, setPadding] = useState(initialValue);
    const [isOpen, setIsOpen] = useState(false);

    useEffect(() => {
        document.documentElement.style.setProperty('--pwa-padding-top', `${padding}px`);
    }, [padding]);

    return (
        <div className="fixed bottom-24 right-4 z-[9999] flex flex-col items-end gap-2 pointer-events-none">
            {isOpen && (
                <div className="bg-white/90 backdrop-blur-md p-4 rounded-3xl shadow-2xl border border-purple-100 flex flex-col gap-3 w-48 pointer-events-auto animate-in fade-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-center">
                        <span className="text-[10px] font-black text-purple-600 uppercase tracking-widest">Padding Top</span>
                        <span className="bg-purple-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-full">{padding}px</span>
                    </div>
                    <input
                        type="range"
                        min="0"
                        max="500"
                        step="4"
                        value={padding}
                        onChange={(e) => setPadding(parseInt(e.target.value))}
                        className="w-full h-1.5 bg-purple-100 rounded-lg appearance-none cursor-pointer accent-purple-600"
                    />
                    <p className="text-[8px] text-gray-400 italic">Mueve para ajustar la posición del contenido</p>
                </div>
            )}
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="w-12 h-12 bg-purple-600 text-white rounded-full shadow-lg flex items-center justify-center pointer-events-auto active:scale-95 transition-all border-4 border-white"
            >
                {isOpen ? <MoveVertical size={20} /> : <Settings2 size={20} />}
            </button>
        </div>
    );
};
