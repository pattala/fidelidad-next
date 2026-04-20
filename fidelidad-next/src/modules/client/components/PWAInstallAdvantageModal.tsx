import React from 'react';
import { ModernConfirmModal } from './ModernConfirmModal';
import { Sparkles, Download, Phone, Zap, Bell, CheckCircle2, ShieldCheck } from 'lucide-react';

interface PWAInstallAdvantageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInstall: () => void;
    isIOS: boolean;
    mode?: 'permissions' | 'install'; // New Mode
}

export const PWAInstallAdvantageModal: React.FC<PWAInstallAdvantageModalProps> = ({
    isOpen,
    onClose,
    onInstall,
    isIOS,
    mode = 'install'
}) => {
    const isPermissionMode = mode === 'permissions';

    return (
        <ModernConfirmModal
            isOpen={isOpen}
            title={isPermissionMode ? "¡Tu cuenta está creciendo! 📈" : "¡Vuelve tu App una Super-App! 🚀"}
            message=""
            onConfirm={onInstall}
            onCancel={onClose}
            confirmText={isPermissionMode ? "Activar ahora" : (isIOS ? "Ver cómo instalar" : "Instalar ahora")}
            cancelText="Quizás luego"
            type={isPermissionMode ? "warning" : "info"}
        >
            <div className="space-y-6 py-2">
                <div className="bg-emerald-50 p-4 rounded-2xl border border-emerald-100 flex items-start gap-4">
                    <div className="bg-emerald-500 text-white p-2 rounded-xl shadow-sm shrink-0">
                        <Sparkles size={18} />
                    </div>
                    <div>
                        <p className="text-xs font-black text-emerald-900 uppercase tracking-tight">¡Felicidades por tus puntos! 🎉</p>
                        <p className="text-[11px] text-emerald-700 font-medium">
                            {isPermissionMode 
                                ? "Activá las notificaciones para que nunca te pierdas el aviso de un premio o regalo."
                                : "Instalá la App para acceder más rápido y no perderte los próximos premios."}
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {isPermissionMode ? (
                        <>
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                    <Bell size={16} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-800 leading-none">Avisos de Premios</p>
                                    <p className="text-[9px] text-gray-500">Recibí una alerta inmediata cuando ganes un beneficio.</p>
                                </div>
                            </div>
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
                                    <ShieldCheck size={16} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-800 leading-none">Seguridad Total</p>
                                    <p className="text-[9px] text-gray-500">Tus datos y puntos siempre protegidos y a la vista.</p>
                                </div>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center text-blue-500 shrink-0">
                                    <Zap size={16} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-800 leading-none">Más Rápida</p>
                                    <p className="text-[9px] text-gray-500">Abre al instante desde tu pantalla de inicio.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-purple-50 flex items-center justify-center text-purple-500 shrink-0">
                                    <Bell size={16} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-800 leading-none">Notificaciones VIP</p>
                                    <p className="text-[9px] text-gray-500">Enterate antes que nadie de las ofertas flash.</p>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 p-3 bg-white rounded-xl border border-gray-100 shadow-sm">
                                <div className="w-8 h-8 rounded-lg bg-amber-50 flex items-center justify-center text-amber-500 shrink-0">
                                    <CheckCircle2 size={16} strokeWidth={2.5} />
                                </div>
                                <div>
                                    <p className="text-[10px] font-black uppercase text-gray-800 leading-none">Sin Gastar Espacio</p>
                                    <p className="text-[9px] text-gray-500">Ocupa menos que una foto. ¡Es mágica!</p>
                                </div>
                            </div>
                        </>
                    )}
                </div>

                {isIOS && !isPermissionMode && (
                    <div className="bg-amber-50/50 p-3 rounded-xl border border-amber-100/50">
                        <p className="text-[9px] text-amber-800 font-bold leading-tight">
                            ℹ️ Como usas iPhone, te mostraremos una guía rápida de 2 pasos para instalarla manualmente.
                        </p>
                    </div>
                )}

                {/* HELP TIP FOR BLOCKED PERMISSIONS v6.0.5 */}
                <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mt-2">
                    <p className="text-[9px] text-gray-500 font-medium leading-tight">
                        <span className="font-bold text-gray-700">¿Permiso bloqueado?</span> Tocá el icono del candado 🔒 o los tres puntos **⋮** en la barra de tu navegador para "Resetear permisos" y volver a intentar.
                    </p>
                </div>
            </div>
        </ModernConfirmModal>
    );
};
