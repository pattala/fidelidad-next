const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/CampaignsPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add tempDate state
if (!content.includes('const [tempDate, setTempDate] = useState')) {
    content = content.replace(
        'const [editingId, setEditingId] = useState<string | null>(null);',
        `const [editingId, setEditingId] = useState<string | null>(null);\n    const [tempDate, setTempDate] = useState('');`
    );
}

// 2. Replace nextBroadcastDate in resetForm (if it was added previously, wait, in previous script I added it)
content = content.replace(
    /nextBroadcastDate:\s*''/,
    `additionalBroadcastDates: []`
);

// 3. Replace nextBroadcastDate in handleSave
content = content.replace(
    /nextBroadcastDate:\s*isFlashMode\s*\?\s*''\s*:\s*\(formData\.nextBroadcastDate\s*\|\|\s*''\)/,
    `additionalBroadcastDates: isFlashMode ? [] : (formData.additionalBroadcastDates || [])`
);

// 4. Replace the UI block
const uiTargetRegex = /<div className="mt-4 bg-white\/40 p-4 rounded-2xl border border-blue-200\/30 space-y-3">[\s\S]*?<label className="text-\[10px\] font-black text-blue-900 uppercase">Día Específico de Envío \(Opcional\)<\/label>[\s\S]*?<\/div>\s*\)\}/g;

const newUi = `<div className="mt-4 bg-white/40 p-4 rounded-2xl border border-blue-200/30 space-y-3">
                                                                            <div className="flex justify-between items-center mb-2">
                                                                                <label className="text-[10px] font-black text-blue-900 uppercase">Fechas Adicionales de Envío</label>
                                                                            </div>
                                                                            <div className="flex gap-2">
                                                                                <input 
                                                                                    type="date" 
                                                                                    className="flex-1 p-3 rounded-xl bg-white shadow-sm border-none text-sm font-bold focus:ring-2 focus:ring-blue-200 outline-none transition-all text-blue-800"
                                                                                    value={tempDate}
                                                                                    onChange={e => setTempDate(e.target.value)}
                                                                                />
                                                                                <button 
                                                                                    type="button"
                                                                                    onClick={() => {
                                                                                        if (tempDate && !(formData.additionalBroadcastDates || []).includes(tempDate)) {
                                                                                            setFormData({ ...formData, additionalBroadcastDates: [...(formData.additionalBroadcastDates || []), tempDate].sort() });
                                                                                            setTempDate('');
                                                                                        }
                                                                                    }}
                                                                                    className="px-4 bg-blue-600 text-white rounded-xl font-bold text-xs hover:bg-blue-700 transition-colors"
                                                                                >
                                                                                    Agregar
                                                                                </button>
                                                                            </div>
                                                                            
                                                                            {(formData.additionalBroadcastDates || []).length > 0 && (
                                                                                <div className="flex flex-wrap gap-2 mt-2">
                                                                                    {(formData.additionalBroadcastDates || []).map(date => (
                                                                                        <span key={date} className="flex items-center gap-1 bg-white px-2 py-1 rounded-lg shadow-sm border border-blue-100 text-[10px] font-bold text-blue-800">
                                                                                            {date}
                                                                                            <button 
                                                                                                type="button" 
                                                                                                onClick={() => setFormData({ ...formData, additionalBroadcastDates: formData.additionalBroadcastDates?.filter(d => d !== date) })}
                                                                                                className="text-red-500 hover:text-red-700 ml-1"
                                                                                            >
                                                                                                ×
                                                                                            </button>
                                                                                        </span>
                                                                                    ))}
                                                                                </div>
                                                                            )}

                                                                            <p className="text-[9px] text-blue-400 font-bold italic text-center leading-tight">
                                                                                La notificación se enviará de forma automática el primer día de la campaña, y también en las fechas adicionales que agregues aquí.
                                                                            </p>
                                                                        </div>
                                                                    )}`;

if (!uiTargetRegex.test(content)) {
    console.error("UI Target block not found. Might have been replaced already or regex is wrong.");
} else {
    content = content.replace(uiTargetRegex, newUi);
}

fs.writeFileSync(filePath, content, 'utf8');
console.log("Patched CampaignsPage.tsx successfully.");
