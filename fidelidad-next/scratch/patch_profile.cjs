const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/client/pages/ClientProfilePage.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Initial State Updates
content = content.replace(
    'setPetFormData({ name: \'\', type: \'perro\', breed: \'Mestizo / Sin Raza\', age: \'\', brand: \'Royal Canin\', variant: \'\', frequencyDays: 30, receiveAlerts: true });',
    'setPetFormData({ name: \'\', type: \'perro\', breed: \'Mestizo / Sin Raza\', age: \'\', brand: \'Royal Canin\', variant: \'\', frequencyDays: 30, litterFrequencyDays: 15, receiveAlerts: true });'
);
content = content.replace(
    'setPetFormData({ name: \'\', type: \'perro\', breed: \'Mestizo / Sin Raza\', age: \'\', brand: \'Royal Canin\', variant: \'\', frequencyDays: 30, receiveAlerts: true });',
    'setPetFormData({ name: \'\', type: \'perro\', breed: \'Mestizo / Sin Raza\', age: \'\', brand: \'Royal Canin\', variant: \'\', frequencyDays: 30, litterFrequencyDays: 15, receiveAlerts: true });'
);

// 2. Pet Save Logic
content = content.replace(
    'frequencyDays: Number(petFormData.frequencyDays) || 30,',
    'frequencyDays: Number(petFormData.frequencyDays) || 30,\n                litterFrequencyDays: petFormData.type === \'gato\' ? (Number(petFormData.litterFrequencyDays) || 15) : undefined,\n                lastLitterPurchaseDate: petFormData.type === \'gato\' ? (editingPet?.lastLitterPurchaseDate || null) : undefined,'
);

// 3. UI logic: Add Piedras visual to the list
const petCardRegex = /\{\/\* Fin de alimento visual \*\/\}([\s\S]*?)<\/span>[\s\S]*?<\/span>[\s\S]*?<\/div>/;
const petCardStr = `
                                                    {pet.lastPurchaseDate && pet.frequencyDays && (
                                                        <span className="text-[9px] font-black text-orange-600 bg-orange-50 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            🐾 Fin de alimento: {(() => {
                                                                const last = pet.lastPurchaseDate.toDate ? pet.lastPurchaseDate.toDate() : new Date(pet.lastPurchaseDate);
                                                                const next = new Date(last);
                                                                next.setDate(last.getDate() + Number(pet.frequencyDays));
                                                                return next.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                                            })()}
                                                        </span>
                                                    )}
                                                    {pet.type === 'gato' && pet.lastLitterPurchaseDate && pet.litterFrequencyDays && (
                                                        <span className="text-[9px] font-black text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            💨 Piedras: {(() => {
                                                                const last = pet.lastLitterPurchaseDate.toDate ? pet.lastLitterPurchaseDate.toDate() : new Date(pet.lastLitterPurchaseDate);
                                                                const next = new Date(last);
                                                                next.setDate(last.getDate() + Number(pet.litterFrequencyDays));
                                                                return next.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>`;
// Actually instead of regex, let's just insert it by replacing the closing div.
content = content.replace(
    /<\/span>\s*\}\)\(\)\}\s*<\/span>\s*\)\}\s*<\/div>/,
    `</span>
                                                    )}
                                                    {pet.type === 'gato' && pet.lastLitterPurchaseDate && pet.litterFrequencyDays && (
                                                        <span className="text-[9px] font-black text-gray-600 bg-gray-100 px-2 py-0.5 rounded-full flex items-center gap-1">
                                                            💨 Fin piedras: {(() => {
                                                                const last = pet.lastLitterPurchaseDate.toDate ? pet.lastLitterPurchaseDate.toDate() : new Date(pet.lastLitterPurchaseDate);
                                                                const next = new Date(last);
                                                                next.setDate(last.getDate() + Number(pet.litterFrequencyDays));
                                                                return next.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                                            })()}
                                                        </span>
                                                    )}
                                                </div>`
);

// 4. Modal editing form: change grid to 3 columns if cat, or add a field
const duraHtml = `
                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1">Dura (días)</label>
                                            <input
                                                type="number"
                                                value={petFormData.frequencyDays}
                                                onChange={(e) => setPetFormData({ ...petFormData, frequencyDays: Number(e.target.value) })}
                                                className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                                placeholder="Ej: 30"
                                            />
                                        </div>`;

const newDuraHtml = `
                                    <div className={\`grid gap-3 \${petFormData.type === 'gato' ? 'grid-cols-3' : 'grid-cols-2'}\`}>
                                        <div>
                                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1" title="Días que dura el alimento">Alimento (días)</label>
                                            <input
                                                type="number"
                                                value={petFormData.frequencyDays || ''}
                                                onChange={(e) => setPetFormData({ ...petFormData, frequencyDays: Number(e.target.value) })}
                                                className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                                placeholder="Ej: 30"
                                            />
                                        </div>
                                        {petFormData.type === 'gato' && (
                                            <div>
                                                <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1 block ml-1" title="Días que duran las piedras">Piedras (días)</label>
                                                <input
                                                    type="number"
                                                    value={petFormData.litterFrequencyDays || 15}
                                                    onChange={(e) => setPetFormData({ ...petFormData, litterFrequencyDays: Number(e.target.value) })}
                                                    className="w-full px-4 py-3 bg-white border-gray-100 rounded-xl focus:ring-2 focus:ring-orange-500/20 focus:border-orange-500 transition-all text-sm font-medium"
                                                    placeholder="Ej: 15"
                                                />
                                            </div>
                                        )}`;

content = content.replace(duraHtml, newDuraHtml);

// 5. Version Info at the bottom of the profile: "version del software asi me ayuda a saber si se refreco bien o no"
const logoutRegex = /Cerrar Sesión<\/span>\s*<\/button>\s*<\/div>/;
const logoutReplacement = `Cerrar Sesión</span>
                                    </button>
                                </div>
                                <div className="text-center mt-6 text-[10px] text-gray-400 font-bold uppercase tracking-widest">
                                    PWA V50.1
                                </div>`;
content = content.replace(logoutRegex, logoutReplacement);

fs.writeFileSync(file, content, 'utf8');
console.log('ClientProfilePage patched!');
