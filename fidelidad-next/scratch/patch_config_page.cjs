const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let content = fs.readFileSync(file, 'utf8');

const regex = /                                            <\/div>\r?\n                                        <\/div>\r?\n                                        \)\}/;

const replacement = `                                            </div>
                                        </div>
                                        )}

                                        {/* PIEDRAS SANITARIAS (Pet Module) */}
                                        {config.enablePetModule && (
                                        <div className="p-6 space-y-4 border-t border-gray-100">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">💨</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Aviso de Piedras Sanitarias (Solo Gatos)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Recordatorio automático cuando deben estar por terminarse las piedras.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.petLitterAlert_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert_title: e.target.value } } })}
                                                        placeholder="💨 Reposición de piedras para {mascota}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petLitterAlert || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.petLitterAlert}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert: DEFAULT_TEMPLATES.petLitterAlert } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'mascota']} onSelect={v => insertVar('petLitterAlert', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petLitterAlert_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petLitterAlert_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.petLitterAlert_whatsapp || config.messaging?.templates?.petLitterAlert || DEFAULT_TEMPLATES.petLitterAlert)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                    <ChannelSelector channels={config.messaging?.eventConfigs?.petLitterAlert?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, petLitterAlert: { channels: ch } } } })} />
                                                </div>
                                                {/* Comparte el mismo lead time que alimento por el momento, o no configuramos anticipación si se sincroniza con panel */}
                                            </div>
                                        </div>
                                        )}`;

content = content.replace(regex, replacement);
fs.writeFileSync(file, content, 'utf8');
console.log('Done!');
