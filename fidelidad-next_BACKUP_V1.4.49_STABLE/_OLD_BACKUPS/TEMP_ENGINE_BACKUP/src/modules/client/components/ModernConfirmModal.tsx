
import React from 'react';
import { X, Check, AlertTriangle } from 'lucide-react';

interface ModernConfirmModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    type?: 'danger' | 'info' | 'warning';
}

export const ModernConfirmModal: React.FC<ModernConfirmModalProps> = ({
    isOpen,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = 'Confirmar',
    cancelText = 'Cancelar',
    type = 'danger'
}) => {
    if (!isOpen) return null;

    const getColor = () => {
        switch (type) {
            case 'danger': return 'bg-rose-600 text-white shadow-rose-200 hover:bg-rose-700';
            case 'warning': return 'bg-amber-500 text-white shadow-amber-200 hover:bg-amber-600';
            case 'info': return 'bg-purple-600 text-white shadow-purple-200 hover:bg-purple-700';
            default: return 'bg-gray-900 text-white shadow-gray-200 hover:bg-black';
        }
    };

    const getIcon = () => {
        switch (type) {
            case 'danger': return <div className="bg-rose-50 text-rose-600 p-3 rounded-2xl mb-4 self-center shadow-sm"><AlertTriangle size={32} /></div>;
            case 'warning': return <div className="bg-amber-50 text-amber-600 p-3 rounded-2xl mb-4 self-center shadow-sm"><AlertTriangle size={32} /></div>;
            case 'info': return <div className="bg-purple-50 text-purple-600 p-3 rounded-2xl mb-4 self-center shadow-sm"><Check size={32} /></div>;
            default: return null;
        }
    };

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm animate-fade-in font-sans">
            <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-8 shadow-2xl animate-in-up relative overflow-hidden flex flex-col items-center text-center border border-gray-100">
                {/* Close Button X */}
                <button onClick={onCancel} className="absolute top-6 right-6 text-gray-400 hover:text-gray-600 transition">
                    <X size={20} />
                </button>

                {getIcon()}

                <h3 className="text-xl font-black text-gray-800 uppercase tracking-tight mb-2 italic-none">
                    {title}
                </h3>

                <p className="text-sm text-gray-500 font-medium leading-relaxed mb-8 px-2 italic-none">
                    {message}
                </p>

                <div className="flex flex-col gap-3 w-full">
                    <button
                        onClick={onConfirm}
                        className={`w-full py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl transition-all active:scale-95 flex items-center justify-center gap-2 ${getColor()}`}
                    >
                        <Check size={16} strokeWidth={3} />
                        {confirmText}
                    </button>

                    <button
                        onClick={onCancel}
                        className="w-full py-4 text-xs font-black text-gray-400 uppercase tracking-widest hover:text-gray-600 transition"
                    >
                        {cancelText}
                    </button>
                </div>
            </div>
        </div>
    );
};
