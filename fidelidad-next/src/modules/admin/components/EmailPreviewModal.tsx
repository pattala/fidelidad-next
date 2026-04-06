import React from 'react';
import { X, Smartphone, Monitor, Mail } from 'lucide-react';
import { EmailService } from '../../../services/emailService';
import type { AppConfig } from '../../../types';

interface EmailPreviewModalProps {
    isOpen: boolean;
    onClose: () => void;
    config: AppConfig;
    templateTitle: string;
    templateContent: string;
    templateId: string;
}

const MOCK_DATA: Record<string, string> = {
    nombre: "Juan Pérez",
    puntos: "150",
    saldo: "450",
    numero_socio: "12345",
    premio: "Café + Medialuna",
    codigo: "TR-8822",
    titulo: "¡Gran Promo de Verano!",
    descripcion: "Solo por esta semana, sumá doble en todos tus consumos.",
    detalle: "2x1 en cervezas artesanales",
    vencimiento: "31/12/2026",
    fecha: "15 de Mayo",
    horario: "20:00",
    amigo: "Sofía García",
    nombre_referido: "Carlos López",
    siteName: import.meta.env.VITE_APP_NAME || "Sistema de Beneficios",
    direccion: "Av. Siempre Viva 742",
    whatsapp: "+54 9 11 1234-5678"
};

export const EmailPreviewModal = ({ isOpen, onClose, config, templateTitle, templateContent, templateId }: EmailPreviewModalProps) => {
    const [viewMode, setViewMode] = React.useState<'desktop' | 'mobile'>('desktop');

    if (!isOpen) return null;

    // Process variables for preview
    const processVariables = (text: string) => {
        let processed = text;
        const dynamicVars = {
            ...MOCK_DATA,
            siteName: config.siteName || import.meta.env.VITE_APP_NAME || "Sistema de Beneficios"
        };
        Object.entries(dynamicVars).forEach(([key, value]) => {
            const regex = new RegExp(`\\{${key}\\}`, 'g');
            processed = processed.replace(regex, value);
        });
        return processed;
    };

    const previewTitle = processVariables(templateTitle || 'Notificación');
    const previewContent = processVariables(templateContent || 'Contenido del mensaje...');

    // Generate full HTML using the service logic
    const fullHtml = EmailService.generateBrandedTemplate(config, previewTitle, previewContent);

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
            <div className={`bg-white rounded-3xl shadow-2xl overflow-hidden transition-all duration-300 flex flex-col ${viewMode === 'desktop' ? 'w-full max-w-4xl h-[90vh]' : 'w-[400px] h-[800px] max-h-[90vh]'}`}>

                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-b border-gray-100">
                    <div className="flex items-center gap-3">
                        <div className="bg-blue-100 text-blue-600 p-2 rounded-xl">
                            <Mail size={20} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-gray-800 leading-tight">Vista Previa de Email</h3>
                            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Plantilla: {templateId}</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        <div className="flex bg-gray-200 p-1 rounded-lg mr-4">
                            <button
                                onClick={() => setViewMode('desktop')}
                                className={`p-1.5 rounded-md transition ${viewMode === 'desktop' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                title="Vista Escritorio"
                            >
                                <Monitor size={18} />
                            </button>
                            <button
                                onClick={() => setViewMode('mobile')}
                                className={`p-1.5 rounded-md transition ${viewMode === 'mobile' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
                                title="Vista Móvil"
                            >
                                <Smartphone size={18} />
                            </button>
                        </div>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                        >
                            <X size={24} />
                        </button>
                    </div>
                </div>

                {/* Sub-header with Subject Preview */}
                <div className="px-6 py-3 bg-white border-b border-gray-100">
                    <div className="flex gap-2 text-sm">
                        <span className="font-bold text-gray-400 w-16">Asunto:</span>
                        <span className="text-gray-700 font-medium">{previewTitle}</span>
                    </div>
                </div>

                {/* Content Area */}
                <div className="flex-1 bg-gray-100 overflow-hidden flex justify-center p-4">
                    <div className={`bg-white shadow-lg overflow-hidden transition-all duration-300 ${viewMode === 'desktop' ? 'w-full' : 'w-full max-w-[375px]'} rounded-xl`}>
                        <iframe
                            srcDoc={fullHtml}
                            title="Email Preview"
                            className="w-full h-full border-0"
                        />
                    </div>
                </div>

                {/* Footer Info */}
                <div className="px-6 py-3 bg-gray-50 border-t border-gray-100">
                    <p className="text-[10px] text-gray-400 italic">
                        * Los datos mostrados (nombres, puntos, premios) son ejemplos de prueba para visualizar el diseño.
                    </p>
                </div>
            </div>
        </div>
    );
};
