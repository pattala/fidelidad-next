const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/CampaignsPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. initial state
content = content.replace(
    /autoBroadcast:\s*false,\s*broadcastLeadMins:\s*15/,
    `autoBroadcast: false,
            broadcastLeadMins: 15,
            nextBroadcastDate: ''`
);

// 2. payload
content = content.replace(
    /isInternal:\s*!!formData\.isInternal\s*\};/,
    `isInternal: !!formData.isInternal,
                nextBroadcastDate: isFlashMode ? '' : (formData.nextBroadcastDate || '')
            };`
);

// 3. UI
const oldUi = `{formData.autoBroadcast && (
                                                                <>
                                                                    <p className="mt-4 text-[10px] text-blue-800 font-medium bg-white/50 p-3 rounded-xl border border-blue-200/50 italic">
                                                                        {isFlashMode 
                                                                            ? "⚡ El sistema enviará automáticamente las notificaciones a todos los socios unos minutos antes de que la campaña comience (o al inicio si eliges 0)."
                                                                            : "📣 El sistema enviará automáticamente las notificaciones a todos los socios al iniciar el día programado de la campaña."}
                                                                    </p>
                                                                    {isFlashMode && (`.replace(/\r\n/g, '\n');

const newUi = `{formData.autoBroadcast && (
                                                                <>
                                                                    {isFlashMode ? (
                                                                        <p className="mt-4 text-[10px] text-blue-800 font-medium bg-white/50 p-3 rounded-xl border border-blue-200/50 italic">
                                                                            ⚡ El sistema enviará automáticamente las notificaciones a todos los socios unos minutos antes de que la campaña comience (o al inicio si eliges 0).
                                                                        </p>
                                                                    ) : (
                                                                        <div className="mt-4 bg-white/40 p-4 rounded-2xl border border-blue-200/30 space-y-3">
                                                                            <div className="flex justify-between items-center mb-2">
                                                                                <label className="text-[10px] font-black text-blue-900 uppercase">Día Específico de Envío (Opcional)</label>
                                                                            </div>
                                                                            <input 
                                                                                type="date" 
                                                                                className="w-full p-3 rounded-xl bg-white shadow-sm border-none text-sm font-bold focus:ring-2 focus:ring-blue-200 outline-none transition-all text-blue-800"
                                                                                value={formData.nextBroadcastDate || ''}
                                                                                onChange={e => setFormData({ ...formData, nextBroadcastDate: e.target.value })}
                                                                            />
                                                                            <p className="text-[9px] text-blue-400 font-bold italic text-center leading-tight">
                                                                                {formData.nextBroadcastDate
                                                                                    ? "La notificación se enviará de forma automática únicamente en la fecha seleccionada."
                                                                                    : "Si lo dejas vacío, el sistema intentará enviarla todos los días que la campaña esté programada."}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {isFlashMode && (`.replace(/\r\n/g, '\n');

// Since Windows files have CRLF, we must replace CRLF with LF in content to match easily
let normalizedContent = content.replace(/\r\n/g, '\n');
normalizedContent = normalizedContent.replace(oldUi, newUi);

// Convert back to CRLF just in case, though git handles it
fs.writeFileSync(filePath, normalizedContent, 'utf8');
console.log("Patched CampaignsPage.tsx successfully.");
