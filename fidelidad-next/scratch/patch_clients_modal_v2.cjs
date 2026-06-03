const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/admin/pages/ClientsPage.tsx');
let content = fs.readFileSync(file, 'utf8');

// 1. Add generateMysteryBox state
if (!content.includes('const [generateMysteryBox, setGenerateMysteryBox]')) {
    content = content.replace(
        'const [selectedPetsForLitter, setSelectedPetsForLitter] = useState<string[]>([]);',
        'const [selectedPetsForLitter, setSelectedPetsForLitter] = useState<string[]>([]);\n    const [generateMysteryBox, setGenerateMysteryBox] = useState(true);'
    );
}

// 2. Add generateMysteryBox to API payload
if (!content.includes('generateMysteryBox: generateMysteryBox')) {
    content = content.replace(
        'petLitterIds: isPetLitterPurchase ? selectedPetsForLitter : []',
        'petLitterIds: isPetLitterPurchase ? selectedPetsForLitter : [],\n                    generateMysteryBox: generateMysteryBox'
    );
}

// 3. Replace Pet and Mystery Box UI
const uiRegex = /\{\/\* SECCION PETSHOP: Marcar compra de alimento \*\/\}[\s\S]*?(?=<\/div>\s*<button type="submit")/;

const getPetDateHtmlCode = `
                                    {/* SECCION PETSHOP: Listado de mascotas estilo Extension */}
                                    {config?.enablePetModule && selectedClientForPoints.pets && selectedClientForPoints.pets.length > 0 && (
                                        <div className="mt-4 pt-4 border-t border-gray-100 flex flex-col gap-1.5">
                                            {selectedClientForPoints.pets.map(pet => {
                                                // Calcular fecha de vencimiento Alimento
                                                let foodDiffDays = 0;
                                                let foodFormatted = '';
                                                let hasFoodDate = false;
                                                if (pet.lastPurchaseDate) {
                                                    const raw = pet.lastPurchaseDate;
                                                    let parsedDate = raw._seconds ? new Date(raw._seconds * 1000) : new Date(raw + 'T12:00:00');
                                                    parsedDate.setDate(parsedDate.getDate() + (Number(pet.frequencyDays) || 30));
                                                    
                                                    const today = new Date();
                                                    today.setHours(0,0,0,0);
                                                    foodDiffDays = Math.floor((today.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));
                                                    foodFormatted = parsedDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                                    hasFoodDate = true;
                                                }

                                                // Calcular fecha de vencimiento Piedras (solo gatos)
                                                let litterDiffDays = 0;
                                                let litterFormatted = '';
                                                let hasLitterDate = false;
                                                const isCat = (pet.type || '').toLowerCase().trim() === 'gato';
                                                if (isCat && pet.lastLitterPurchaseDate) {
                                                    const raw = pet.lastLitterPurchaseDate;
                                                    let parsedDate = raw._seconds ? new Date(raw._seconds * 1000) : new Date(raw + 'T12:00:00');
                                                    parsedDate.setDate(parsedDate.getDate() + (Number(pet.litterFrequencyDays) || 15));
                                                    
                                                    const today = new Date();
                                                    today.setHours(0,0,0,0);
                                                    litterDiffDays = Math.floor((today.getTime() - parsedDate.getTime()) / (1000 * 60 * 60 * 24));
                                                    litterFormatted = parsedDate.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
                                                    hasLitterDate = true;
                                                }

                                                return (
                                                    <div key={pet.id} className="flex flex-col gap-1.5">
                                                        {/* Fila Alimento */}
                                                        <label className="flex items-center gap-2 bg-orange-50 border border-orange-200 px-3 py-2 rounded-xl cursor-pointer text-sm font-bold text-orange-800">
                                                            <input 
                                                                type="checkbox" 
                                                                className="w-4 h-4 rounded text-orange-600 focus:ring-orange-500 bg-white"
                                                                checked={selectedPetsForFood.includes(pet.id)}
                                                                onChange={e => {
                                                                    const newSelection = e.target.checked 
                                                                        ? [...selectedPetsForFood, pet.id] 
                                                                        : selectedPetsForFood.filter(id => id !== pet.id);
                                                                    setSelectedPetsForFood(newSelection);
                                                                    setIsPetFoodPurchase(newSelection.length > 0);
                                                                }}
                                                            />
                                                            🐾 Alimento {pet.name || ''}
                                                            {hasFoodDate && (
                                                                foodDiffDays > 0 
                                                                    ? <span className="text-red-600 font-black ml-1">(venció el {foodFormatted} - hace {foodDiffDays} días)</span>
                                                                    : <span className="opacity-70 ml-1 font-medium">(vence {foodFormatted})</span>
                                                            )}
                                                        </label>

                                                        {/* Fila Piedras */}
                                                        {isCat && (
                                                            <label className="flex items-center gap-2 bg-gray-50 border border-gray-200 px-3 py-2 rounded-xl cursor-pointer text-sm font-bold text-gray-700">
                                                                <input 
                                                                    type="checkbox" 
                                                                    className="w-4 h-4 rounded text-gray-600 focus:ring-gray-500 bg-white"
                                                                    checked={selectedPetsForLitter.includes(pet.id)}
                                                                    onChange={e => {
                                                                        const newSelection = e.target.checked 
                                                                            ? [...selectedPetsForLitter, pet.id] 
                                                                            : selectedPetsForLitter.filter(id => id !== pet.id);
                                                                        setSelectedPetsForLitter(newSelection);
                                                                        setIsPetLitterPurchase(newSelection.length > 0);
                                                                    }}
                                                                />
                                                                💨 Piedras {pet.name || ''}
                                                                {hasLitterDate && (
                                                                    litterDiffDays > 0 
                                                                        ? <span className="text-red-600 font-black ml-1">(venció el {litterFormatted} - hace {litterDiffDays} días)</span>
                                                                        : <span className="opacity-70 ml-1 font-medium">(vence {litterFormatted})</span>
                                                                )}
                                                            </label>
                                                        )}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    {/* SECCION CAJA SORPRESA */}
                                    {config?.mysteryBox?.enabled && (
                                        <div className="mt-4 p-3 bg-orange-50 border border-orange-300 rounded-xl border-dashed">
                                            <label className="flex items-center gap-2 cursor-pointer">
                                                <input 
                                                    type="checkbox" 
                                                    className="w-5 h-5 rounded text-orange-600 focus:ring-orange-500"
                                                    checked={generateMysteryBox}
                                                    onChange={e => setGenerateMysteryBox(e.target.checked)}
                                                />
                                                <div className="flex flex-col">
                                                    <span className="text-sm font-bold text-orange-900">🎁 Generar Caja Sorpresa</span>
                                                    <span className="text-xs text-orange-700">El cliente recibirá un sorteo por su compra</span>
                                                </div>
                                            </label>
                                        </div>
                                    )}
`;

content = content.replace(uiRegex, getPetDateHtmlCode);
fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
