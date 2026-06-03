const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/admin/pages/ClientsPage.tsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /<div className="col-span-2 mt-2 flex justify-between items-center pt-2 border-t border-orange-100\/50">/;

const replacement = `
                                                            {/* BLOQUE PIEDRAS (Solo Gatos) */}
                                                            {pet.type === 'gato' && (
                                                                <div className="col-span-2 mt-2 pt-2 border-t border-orange-100/50">
                                                                    <div className="grid grid-cols-2 gap-4">
                                                                        <div className="col-span-2 bg-gray-50 border border-gray-200 rounded-xl p-3 flex flex-col gap-2">
                                                                            <h4 className="text-[10px] font-black text-gray-700 uppercase flex items-center gap-1">
                                                                                <span className="text-sm">💨</span> Configuración de Piedras Sanitarias
                                                                            </h4>
                                                                            <div>
                                                                                <label className="block text-[10px] font-bold text-gray-700 uppercase mb-1">Frecuencia Piedras (Días)</label>
                                                                                <input 
                                                                                    type="number"
                                                                                    value={pet.litterFrequencyDays || 15}
                                                                                    onChange={e => {
                                                                                        const newPets = [...formData.pets];
                                                                                        newPets[idx].litterFrequencyDays = Math.max(1, parseInt(e.target.value) || 15);
                                                                                        setFormData({ ...formData, pets: newPets });
                                                                                    }}
                                                                                    className="w-full p-2 bg-white rounded-lg border border-gray-300 text-sm font-bold outline-none focus:ring-2 focus:ring-gray-400"
                                                                                    min="1"
                                                                                />
                                                                            </div>
                                                                            <div className="flex justify-between items-center mt-1">
                                                                                <span className="text-[9px] font-black text-gray-600 uppercase">Última Compra:</span>
                                                                                <span className="text-xs font-bold text-gray-800">{pet.lastLitterPurchaseDate ? (typeof pet.lastLitterPurchaseDate === 'string' ? pet.lastLitterPurchaseDate : (pet.lastLitterPurchaseDate.toDate ? pet.lastLitterPurchaseDate.toDate().toLocaleDateString() : 'N/A')) : 'Sin registros'}</span>
                                                                            </div>
                                                                            {pet.lastLitterPurchaseDate && (
                                                                                <div className="flex justify-between items-center">
                                                                                    <span className="text-[9px] font-black text-gray-600 uppercase">Fin de Piedras Estimado:</span>
                                                                                    <span className="text-xs font-bold text-gray-800 underline">
                                                                                        {(() => {
                                                                                            const last = pet.lastLitterPurchaseDate instanceof Date ? pet.lastLitterPurchaseDate : (pet.lastLitterPurchaseDate.toDate ? pet.lastLitterPurchaseDate.toDate() : new Date(pet.lastLitterPurchaseDate));
                                                                                            const next = new Date(last);
                                                                                            next.setDate(next.getDate() + (pet.litterFrequencyDays || 15));
                                                                                            return next.toLocaleDateString();
                                                                                        })()}
                                                                                    </span>
                                                                                </div>
                                                                            )}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            )}

                                                            <div className="col-span-2 mt-2 flex justify-between items-center pt-2 border-t border-orange-100/50">`;

if (content.includes('<div className="col-span-2 mt-2 flex justify-between items-center pt-2 border-t border-orange-100/50">')) {
    content = content.replace(regex, replacement);
    fs.writeFileSync(file, content, 'utf8');
    console.log('Successfully patched ClientsPage.tsx!');
} else {
    console.error('Regex did not match in ClientsPage.tsx!');
}
