const fs = require('fs');
const path = 'src/modules/admin/components/MysteryBoxConfig.tsx';
let content = fs.readFileSync(path, 'utf8');

// I need to add `mb.cashierDecision ?? true` and the update toggle
const replacementStr = `
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={mb.enableCashierAlert ?? true} onChange={(e) => updateMb({ enableCashierAlert: e.target.checked })} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>
                            
                            <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">
                                <div>
                                    <h3 className="text-sm font-bold text-gray-700">Decisión del Cajero</h3>
                                    <p className="text-xs text-gray-500">Si está apagado, el cajero no podrá evitar generar la caja sorpresa.</p>
                                </div>
                                <label className="relative inline-flex items-center cursor-pointer">
                                    <input type="checkbox" className="sr-only peer" checked={mb.cashierDecision ?? true} onChange={(e) => updateMb({ cashierDecision: e.target.checked })} />
                                    <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>
                                </label>
                            </div>`;

content = content.replace(
    /<\/label>\s*<\/div>\s*\{mb\.enableCashierAlert/,
    `</label>\n                                </div>\n                                \n                                <div className="flex items-center justify-between border-t border-gray-100 pt-4 mt-4">\n                                    <div>\n                                        <h3 className="text-sm font-bold text-gray-700">Decisión del Cajero</h3>\n                                        <p className="text-xs text-gray-500">Si está apagado, el cajero no podrá destildar la opción en la caja.</p>\n                                    </div>\n                                    <label className="relative inline-flex items-center cursor-pointer">\n                                        <input type="checkbox" className="sr-only peer" checked={mb.cashierDecision ?? true} onChange={(e) => updateMb({ cashierDecision: e.target.checked })} />\n                                        <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-orange-500"></div>\n                                    </label>\n                                </div>\n                                \n                            {mb.enableCashierAlert`
);

fs.writeFileSync(path, content, 'utf8');
console.log('MysteryBoxConfig replaced');
