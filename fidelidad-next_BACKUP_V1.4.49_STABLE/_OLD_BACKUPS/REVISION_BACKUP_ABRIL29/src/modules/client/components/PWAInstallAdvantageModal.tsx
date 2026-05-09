import React from 'react';
import { ModernConfirmModal } from './ModernConfirmModal';
import { Sparkles, Download, Phone, Zap, Bell, CheckCircle2, ShieldCheck } from 'lucide-react';

interface PWAInstallAdvantageModalProps {
    isOpen: boolean;
    onClose: () => void;
    onInstall: () => void;
    isIOS: boolean;
    mode?: 'permissions' | 'install' | 'system_settings' | 'success'; 
}

export const PWAInstallAdvantageModal: React.FC<PWAInstallAdvantageModalProps> = ({
    isOpen,
    onClose,
    onInstall,
    isIOS,
    mode = 'install'
}) => {
    const isPermissionMode = mode === 'permissions';
    const isSystemMode = mode === 'system_settings';
    const isSuccessMode = mode === 'success';

    return (
        <ModernConfirmModal
            isOpen={isOpen}
            title={isSystemMode ? "Ajustes de Notificaciones ⚙️" : (isSuccessMode ? "¡Instalación Exitosa! 🎉" : (isPermissionMode ? "¡Tu cuenta está creciendo! 📈" : "¡Vuelve tu App una Super-App! 🚀"))}
            message=""
            onConfirm={isSuccessMode || isSystemMode ? onClose : onInstall}
            onCancel={onClose}
            confirmText={isSuccessMode ? "¡Listo! La abriré" : (isSystemMode ? "Entendido" : (isPermissionMode ? "Activar ahora" : (isIOS ? "Ver cómo instalar" : "Instalar ahora")))}
            cancelText={isSystemMode || isSuccessMode ? "Cerrar" : "Quizás luego"}
            type={isSuccessMode ? "success" : (isSystemMode ? "info" : (isPermissionMode ? "warning" : "info"))}
        >
            <div className="space-y-6 py-2">
                <div className={`${isSystemMode ? 'bg-amber-50 border-amber-100' : 'bg-emerald-50 border-emerald-100'} p-4 rounded-2xl border flex items-start gap-4`}>
                    <div className={`${isSystemMode ? 'bg-amber-500' : 'bg-emerald-500'} text-white p-2 rounded-xl shadow-sm shrink-0`}>
                        {isSystemMode ? <Phone size={18} /> : <Sparkles size={18} />}
                    </div>
                    <div>
                        <p className={`text-xs font-black uppercase tracking-tight ${isSystemMode ? 'text-amber-900' : 'text-emerald-900'}`}>
                            {isSystemMode ? "Habilitar en Android" : "¡Felicidades por tus puntos! 🎉"}
                        </p>
                        <p className={`text-[11px] font-medium ${isSystemMode ? 'text-amber-700' : 'text-emerald-700'}`}>
                            {isSystemMode 
                                ? "Para recibir notificaciones, debes habilitarlas en los ajustes de tu teléfono."
                                : (isSuccessMode 
                                    ? "¡Ya podés disfrutar de la App! Buscá el ícono en tu pantalla de inicio."
                                    : (isPermissionMode 
                                        ? "Activá las notificaciones para que nunca te pierdas el aviso de un premio o regalo."
                                        : "Instalá la App para acceder más rápido y no perderte los próximos premios."))
                            }
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 gap-3">
                    {isSystemMode ? (
                        <div className="space-y-3 bg-white p-4 rounded-2xl border border-gray-100 shadow-sm">
                            <h4 className="text-[10px] font-black uppercase text-gray-400 tracking-widest mb-2">Pasos para Samsung / Android:</h4>
                            <div className="flex items-start gap-3">
                                <span className="bg-gray-100 text-gray-800 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">1</span>
                                <p className="text-[11px] text-gray-700">Busca el icono de la App en tu pantalla de inicio.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="bg-gray-100 text-gray-800 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">2</span>
                                <p className="text-[11px] text-gray-700">Mantenlo presionado hasta que salga el menú y toca el icono <span className="font-bold">"ℹ️ Info"</span>.</p>
                            </div>
                            <div className="flex items-start gap-3">
                                <span className="bg-gray-100 text-gray-800 w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0">3</span>
                                <p className="text-[11px] text-gray-700">Toca en <span className="font-bold text-purple-600">"Notificaciones"</span> y activa la opción <span className="font-bold text-emerald-600">"Permitir"</span>.</p>
                            </div>
                        </div>
                    ) : (
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
                    )}
                </div>

                {/* HELP TIP v6.0.5 */}
                {!isSystemMode && (
                    <div className="bg-gray-50 p-3 rounded-xl border border-gray-100 mt-2">
                        <p className="text-[9px] text-gray-500 font-medium leading-tight">
                            <span className="font-bold text-gray-700">¿Permiso bloqueado?</span> Tocá el icono del candado 🔒 o los tres puntos **⋮** en la barra de tu navegador para "Resetear permisos" y volver a intentar.
                        </p>
                    </div>
                )}
            </div>
        </ModernConfirmModal>
    );
};
