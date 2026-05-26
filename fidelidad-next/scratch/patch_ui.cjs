const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/CampaignsPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

const targetBlock = /\{formData\.autoBroadcast && \(\s*<>\s*<p className="mt-4 text-\[10px\] text-blue-800 font-medium bg-white\/50 p-3 rounded-xl border border-blue-200\/50 italic">\s*\{isFlashMode\s*\?\s*"[^"]+"\s*:\s*"[^"]+"\}\s*<\/p>\s*\{isFlashMode && \(/g;

const match = targetBlock.exec(content);
if (!match) {
    console.error("Match not found!");
} else {
    const newBlock = `{formData.autoBroadcast && (
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
                                                                                    : "Si lo dejas vacío, el sistema intentará enviarla al inicio según los días programados."}
                                                                            </p>
                                                                        </div>
                                                                    )}
                                                                    {isFlashMode && (`.replace(/\n/g, '\n');

    content = content.replace(targetBlock, newBlock);
    fs.writeFileSync(filePath, content, 'utf8');
    console.log("Patched successfully!");
}
