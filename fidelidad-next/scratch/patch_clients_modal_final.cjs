const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/admin/pages/ClientsPage.tsx');
let content = fs.readFileSync(file, 'utf8');

const uiRegex = /                                    \)\}\r?\n                                <\/div>/;
const uiReplacement = `                                    )}
                                    
                                    {/* Piedras Sanitarias (Solo si tiene gatos) */}
                                    {selectedClientForPoints?.pets && selectedClientForPoints.pets.some((p: any) => (p.type || '').toLowerCase().trim() === 'gato') && (
                                        <div className="bg-orange-50/50 p-2.5 rounded-xl border border-orange-100 flex flex-col gap-2 mt-2">
                                            <label className="flex items-center gap-3 cursor-pointer group">
                                                <input 
                                                    type="checkbox"
                                                    className="w-5 h-5 rounded border-orange-300 text-orange-600 focus:ring-orange-500"
                                                    checked={isPetLitterPurchase}
                                                    onChange={e => {
                                                        setIsPetLitterPurchase(e.target.checked);
                                                        if (e.target.checked) {
                                                            const catIds = selectedClientForPoints.pets!.filter((p: any) => (p.type || '').toLowerCase().trim() === 'gato').map((p: any) => p.id);
                                                            setSelectedPetsForLitter(catIds);
                                                        }
                                                    }}
                                                />
                                                <span className="text-sm font-bold text-orange-700">Reposición Piedras 💨</span>
                                            </label>
                                            
                                            {isPetLitterPurchase && selectedClientForPoints.pets.filter((p: any) => (p.type || '').toLowerCase().trim() === 'gato').length > 1 && (
                                                <div className="flex flex-wrap gap-2 pl-8 animate-fade-in">
                                                    {selectedClientForPoints.pets.filter((p: any) => (p.type || '').toLowerCase().trim() === 'gato').map((pet: any) => (
                                                        <label key={pet.id} className="flex items-center gap-1.5 cursor-pointer bg-white border border-orange-100 px-2 py-1 rounded-lg">
                                                            <input
                                                                type="checkbox"
                                                                className="w-3.5 h-3.5 rounded text-orange-500 focus:ring-orange-400"
                                                                checked={selectedPetsForLitter.includes(pet.id)}
                                                                onChange={e => {
                                                                    if (e.target.checked) setSelectedPetsForLitter([...selectedPetsForLitter, pet.id]);
                                                                    else setSelectedPetsForLitter(selectedPetsForLitter.filter((id: string) => id !== pet.id));
                                                                }}
                                                            />
                                                            <span className="text-[10px] font-bold text-gray-600 uppercase">{pet.name}</span>
                                                        </label>
                                                    ))}
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>`;

content = content.replace(uiRegex, uiReplacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Done replacing modal UI!');
