import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Info } from 'lucide-react';
import { ModernConfirmModal } from './ModernConfirmModal';

interface CampaignActionModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string;
    description?: string;
    actionUrl?: string;
    actionText?: string;
}

export const CampaignActionModal = ({ isOpen, onClose, title, description, actionUrl, actionText }: CampaignActionModalProps) => {
    if (!isOpen) return null;

    const isExternal = actionUrl?.startsWith('http') || actionUrl?.startsWith('www');

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className="bg-white w-full max-w-md rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-in">
                {/* Header */}
                <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-indigo-50/30">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-2xl text-indigo-600">
                            <Info size={20} />
                        </div>
                        <h3 className="font-black text-indigo-900 uppercase tracking-tight line-clamp-1">{title}</h3>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                    >
                        <X size={24} />
                    </button>
                </div>

                {/* Content */}
                <div className="p-8 flex flex-col items-center text-center">
                    <div className="mb-6">
                        <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">
                            {description || 'Esta promoción tiene un beneficio especial para vos.'}
                        </p>
                    </div>

                    {actionUrl && (
                        <div className="w-full space-y-3">
                            {isExternal ? (
                                <a
                                    href={actionUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full bg-indigo-600 text-white flex items-center justify-center gap-2 py-4 rounded-3xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition"
                                >
                                    <ExternalLink size={18} />
                                    {actionText || 'Ver Más Información'}
                                </a>
                            ) : (
                                <button
                                    onClick={() => {
                                        // Internal navigation if needed
                                        window.location.href = actionUrl;
                                    }}
                                    className="w-full bg-indigo-600 text-white py-4 rounded-3xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition"
                                >
                                    {actionText || 'Ir Probar'}
                                </button>
                            )}
                            <button
                                onClick={onClose}
                                className="w-full text-gray-400 font-bold text-xs uppercase tracking-widest py-2 hover:text-gray-600 transition"
                            >
                                Tal vez luego
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
