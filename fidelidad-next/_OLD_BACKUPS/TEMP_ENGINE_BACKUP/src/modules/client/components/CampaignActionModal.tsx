import React, { useEffect, useState } from 'react';
import { X, ExternalLink, Info, AlertTriangle, ShieldAlert } from 'lucide-react';
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
    const [iframeError, setIframeError] = useState(false);

    if (!isOpen) return null;

    const hasUrl = !!actionUrl;

    // Detect if URL is an image
    const isImage = actionUrl ? (
        /\.(jpg|jpeg|png|webp|avif|gif|svg)$/i.test(actionUrl.split('?')[0]) ||
        (actionUrl.includes('firebasestorage.googleapis.com') && actionUrl.includes('alt=media'))
    ) : false;

    return (
        <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`bg-white w-full ${hasUrl ? (isImage ? 'max-w-2xl h-auto' : 'max-w-4xl h-[92vh] sm:h-[85vh]') : 'max-w-md'} rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl overflow-hidden flex flex-col animate-scale-in max-h-[95vh]`}>
                {/* Header */}
                <div className="p-4 sm:p-6 border-b border-gray-50 flex justify-between items-center bg-white sticky top-0 z-20">
                    <div className="flex items-center gap-2">
                        <div className="bg-indigo-100 p-2 rounded-2xl text-indigo-600 shrink-0">
                            <Info size={20} />
                        </div>
                        <h3 className="font-black text-indigo-900 uppercase tracking-tight line-clamp-1 text-sm sm:text-base">{title}</h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {hasUrl && (
                            <a
                                href={actionUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-full transition"
                                title="Abrir en ventana nueva"
                            >
                                <ExternalLink size={20} />
                            </a>
                        )}
                        <button
                            onClick={onClose}
                            className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-full transition"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto flex flex-col bg-gray-50/50">
                    {hasUrl ? (
                        <div className="flex-1 w-full relative flex items-center justify-center min-h-[40vh]">
                            {isImage ? (
                                <img
                                    src={actionUrl}
                                    className="max-w-full h-auto object-contain block mx-auto animate-fade-in"
                                    alt={title}
                                    style={{ maxHeight: 'calc(95vh - 80px)' }}
                                />
                            ) : (
                                <div className="flex-1 w-full relative h-full">
                                    <iframe
                                        src={actionUrl}
                                        className="w-full h-full min-h-[70vh] border-none bg-white"
                                        title={title}
                                        onError={() => setIframeError(true)}
                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                                        allowFullScreen
                                    />
                                    {iframeError && (
                                        <div className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center bg-white">
                                            <AlertTriangle size={48} className="text-amber-500 mb-4" />
                                            <h4 className="text-lg font-bold text-gray-800 mb-2">No se puede mostrar aquí</h4>
                                            <p className="text-gray-600 mb-6">Algunos sitios no permiten cargarse dentro de otras apps por seguridad.</p>
                                            <a
                                                href={actionUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="bg-indigo-600 text-white px-8 py-4 rounded-3xl font-black uppercase tracking-widest shadow-lg hover:bg-indigo-700 transition"
                                            >
                                                Abrir en ventana completa
                                            </a>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="p-8 flex flex-col items-center text-center justify-center flex-1">
                            <div className="mb-6">
                                <p className="text-gray-600 font-medium leading-relaxed whitespace-pre-wrap">
                                    {description || 'Esta promoción tiene un beneficio especial para vos.'}
                                </p>
                            </div>
                            <button
                                onClick={onClose}
                                className="w-full max-w-xs bg-indigo-600 text-white py-4 rounded-3xl font-black text-sm uppercase tracking-widest shadow-lg shadow-indigo-100 hover:bg-indigo-700 active:scale-95 transition"
                            >
                                Entendido
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};
