$filePath = "src\modules\admin\pages\ConfigPage.tsx"
$originalLines = [System.IO.File]::ReadAllLines($filePath, [System.Text.Encoding]::UTF8)

# Build the new content for the messaging templates section (replaces lines 2107-3088, 0-indexed)
$newMessagingSection = @'
                            {/* WhatsApp Preview Modal */}
                            {waPreview.isOpen && (
                                <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setWaPreview({ ...waPreview, isOpen: false })}>
                                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
                                    <div className="relative bg-[#0a1929] rounded-3xl shadow-2xl w-full max-w-sm overflow-hidden" onClick={e => e.stopPropagation()}>
                                        <div className="bg-[#128C7E] px-5 py-4 flex items-center gap-3">
                                            <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center text-white text-lg">&#128100;</div>
                                            <div>
                                                <div className="text-white font-bold text-sm">Vista Previa WhatsApp</div>
                                                <div className="text-green-200 text-xs">En línea</div>
                                            </div>
                                            <button onClick={() => setWaPreview({ ...waPreview, isOpen: false })} className="ml-auto text-white/70 hover:text-white text-xl">✕</button>
                                        </div>
                                        <div className="p-5 min-h-[120px] bg-[#0d2137]">
                                            <div className="bg-[#1a3a2a] rounded-2xl rounded-tl-none px-4 py-3 max-w-[85%] shadow-md">
                                                <p className="text-[#e8f5e9] text-sm whitespace-pre-wrap leading-relaxed">
                                                    {waPreview.content
                                                        .replace(/{nombre}/g, 'María')
                                                        .replace(/{nombre_completo}/g, 'María García')
                                                        .replace(/{puntos}/g, '350')
                                                        .replace(/{saldo}/g, '350')
                                                        .replace(/{siteName}/g, config.siteName || 'El Club')
                                                        .replace(/{premio}/g, 'Café Gratis')
                                                        .replace(/{codigo}/g, 'ABC-123')
                                                        .replace(/{fecha}/g, '31/12/2025')
                                                        .replace(/{amigo}/g, 'Luis')
                                                        .replace(/{mascota}/g, 'Lola')
                                                        .replace(/{marca}/g, 'Royal Canin')
                                                        .replace(/{titulo}/g, 'Gran Promo')
                                                        .replace(/{descripcion}/g, 'Doble puntos')
                                                        .replace(/{detalle}/g, '2x1 en todo')
                                                        .replace(/{vencimiento}/g, '31/12/2025')
                                                        .replace(/{horario}/g, '20:00')
                                                    }
                                                </p>
                                                <div className="text-right text-[10px] text-green-300/60 mt-1">✓✓ 10:30</div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* GESTOR DE MENSAJES */}
                            <div className="mt-8 space-y-6">

                                {/* SECCIÓN A: CAMPAÑAS MASIVAS */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-orange-500 to-red-600 px-6 py-4">
                                        <h3 className="text-white font-black text-base flex items-center gap-2">⚡ Campañas Masivas</h3>
                                        <p className="text-orange-100 text-xs mt-1">Mensajes de difusión manual para promociones y eventos especiales.</p>
                                    </div>
                                    <div className="divide-y divide-gray-50">

                                        {/* FLASH OFFER */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">⚡</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Oferta Flash</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Para campañas urgentes. Se usa automáticamente en campañas marcadas como "Flash".</p>
                                                </div>
                                                <span className="ml-auto text-[10px] bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded-full font-bold uppercase">Urgente</span>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título (Asunto Email / Título Push)</label>
                                                    <input type="text"
                                                        value={config.messaging?.templates?.flashOffer_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer_title: e.target.value } } })}
                                                        placeholder="⚡ ¡OFERTA FLASH! {titulo}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-yellow-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal (Email / Push)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.flashOffer || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.flashOffer}
                                                            className="w-full px-3 py-2 rounded-lg border border-yellow-200 focus:ring-2 focus:ring-yellow-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer: DEFAULT_TEMPLATES.flashOffer } } })} className="px-2 py-1.5 text-gray-400 hover:text-yellow-600 rounded hover:bg-yellow-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('flashOffer')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'titulo', 'detalle', 'horario']} onSelect={v => insertVar('flashOffer', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional, si difiere)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.flashOffer_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, flashOffer_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal. Aprovechá *negritas* y _cursivas_."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.flashOffer_whatsapp || config.messaging?.templates?.flashOffer || DEFAULT_TEMPLATES.flashOffer)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.offer?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, offer: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* OFERTA ESPECIAL */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🏷️</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Oferta Especial</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Promociones con vencimiento. Se usa para campañas tipo "Oferta".</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.offer_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer_title: e.target.value } } })}
                                                        placeholder="🔥 ¡Oferta Especial! {titulo}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.offer || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.offer}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer: DEFAULT_TEMPLATES.offer } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('offer')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'titulo', 'detalle', 'vencimiento']} onSelect={v => insertVar('offer', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.offer_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, offer_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.offer_whatsapp || config.messaging?.templates?.offer || DEFAULT_TEMPLATES.offer)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.offer?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, offer: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* CAMPAÑA */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🚀</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Nueva Campaña (Promo Manual)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Mensaje de difusión general para campañas sin urgencia.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.campaign_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign_title: e.target.value } } })}
                                                        placeholder="🚀 ¡Nueva Campaña! {titulo}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.campaign || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.campaign}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign: DEFAULT_TEMPLATES.campaign } } })} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('campaign')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'titulo', 'descripcion']} onSelect={v => insertVar('campaign', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.campaign_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, campaign_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.campaign_whatsapp || config.messaging?.templates?.campaign || DEFAULT_TEMPLATES.campaign)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.campaign?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, campaign: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                {/* SECCIÓN B: EVENTOS AUTOMÁTICOS */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-4">
                                        <h3 className="text-white font-black text-base flex items-center gap-2">🤖 Eventos Automáticos</h3>
                                        <p className="text-blue-100 text-xs mt-1">Mensajes disparados automáticamente por el sistema según reglas configuradas.</p>
                                    </div>
                                    <div className="divide-y divide-gray-50">

                                        {/* SUMA DE PUNTOS */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🌟</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Suma de Puntos (Compra)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al cliente cada vez que acumula puntos por una compra.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.pointsAdded_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded_title: e.target.value } } })}
                                                        placeholder="🎉 ¡Sumaste puntos en {siteName}!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.pointsAdded || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.pointsAdded}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded: DEFAULT_TEMPLATES.pointsAdded } } })} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('pointsAdded')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'puntos', 'saldo']} onSelect={v => insertVar('pointsAdded', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.pointsAdded_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, pointsAdded_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.pointsAdded_whatsapp || config.messaging?.templates?.pointsAdded || DEFAULT_TEMPLATES.pointsAdded)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.pointsAdded?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, pointsAdded: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* CANJE */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🎁</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Canje de Premio</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Confirmación automática cuando un cliente canjea un premio.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.redemption_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption_title: e.target.value } } })}
                                                        placeholder="🎁 ¡Canje confirmado!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.redemption || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.redemption}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption: DEFAULT_TEMPLATES.redemption } } })} className="px-2 py-1.5 text-gray-400 hover:text-blue-600 rounded hover:bg-blue-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('redemption')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'premio', 'codigo']} onSelect={v => insertVar('redemption', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.redemption_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, redemption_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.redemption_whatsapp || config.messaging?.templates?.redemption || DEFAULT_TEMPLATES.redemption)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.redemption?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, redemption: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* CUMPLEAÑOS */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🎂</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Cumpleaños</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía el día del cumpleaños. El sistema elige con o sin puntos según configuración.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.birthday_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday_title: e.target.value } } })}
                                                        placeholder="🎂 ¡Feliz Cumpleaños {nombre}!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo CON Regalo (Puntos)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.birthday || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.birthday}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday: DEFAULT_TEMPLATES.birthday } } })} className="px-2 py-1.5 text-gray-400 hover:text-pink-600 rounded hover:bg-pink-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('birthday')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'puntos']} onSelect={v => insertVar('birthday', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B2. Cuerpo SIN Regalo (Solo Saludo)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.birthdaySimple || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthdaySimple: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.birthdaySimple}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-pink-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthdaySimple: DEFAULT_TEMPLATES.birthdaySimple } } })} className="px-2 py-1.5 text-gray-400 hover:text-pink-600 rounded hover:bg-pink-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('birthdaySimple')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo']} onSelect={v => insertVar('birthdaySimple', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.birthday_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, birthday_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal. Ej: ¡Feliz cumple *{nombre}*! 🎂"
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.birthday_whatsapp || config.messaging?.templates?.birthday || DEFAULT_TEMPLATES.birthday)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.birthday?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, birthday: { channels: ch } } } })} />
                                                <p className="text-[10px] text-gray-400 mt-2 italic">* El sistema detecta automáticamente si enviar el mensaje con o sin puntos según la configuración de "Reglas del Juego".</p>
                                            </div>
                                        </div>

                                        {/* BIENVENIDA */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">👋</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Bienvenida (Nuevo Cliente)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al completar el registro en la PWA.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.welcome_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome_title: e.target.value } } })}
                                                        placeholder="👋 ¡Bienvenido a {siteName}!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.welcome || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.welcome}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-indigo-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome: DEFAULT_TEMPLATES.welcome } } })} className="px-2 py-1.5 text-gray-400 hover:text-indigo-600 rounded hover:bg-indigo-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('welcome')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'puntos', 'socio', 'dni']} onSelect={v => insertVar('welcome', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.welcome_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, welcome_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.welcome_whatsapp || config.messaging?.templates?.welcome || DEFAULT_TEMPLATES.welcome)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.welcome?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, welcome: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* VENCIMIENTO */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2">
                                                    <span className="text-xl">⚠️</span>
                                                    <div>
                                                        <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Aviso de Vencimiento</h4>
                                                        <p className="text-[10px] text-gray-400 mt-0.5">Alerta enviada antes del vencimiento de puntos.</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3">
                                                    <div className="flex items-center gap-1 text-xs text-gray-500">
                                                        <span>Avisar</span>
                                                        <input type="number" min="1" max="90" value={config.messaging?.expirationWarningDays || 7}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, expirationWarningDays: parseInt(e.target.value) || 7 } })}
                                                            className="w-12 bg-transparent border-b border-gray-300 text-center font-bold focus:border-orange-500 outline-none text-orange-600"
                                                        />
                                                        <span>días antes</span>
                                                    </div>
                                                    <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, enableExpirationWarnings: !config.messaging?.enableExpirationWarnings } })}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.messaging?.enableExpirationWarnings ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${config.messaging?.enableExpirationWarnings ? 'translate-x-5' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                            </div>
                                            {config.messaging?.enableExpirationWarnings && (
                                            <div className="grid gap-3 animate-fade-in">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.expirationWarning_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning_title: e.target.value } } })}
                                                        placeholder="⏳ Tus puntos están por vencer"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.expirationWarning || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.expirationWarning}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning: DEFAULT_TEMPLATES.expirationWarning } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('expirationWarning')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'puntos', 'fecha']} onSelect={v => insertVar('expirationWarning', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.expirationWarning_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, expirationWarning_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.expirationWarning_whatsapp || config.messaging?.templates?.expirationWarning || DEFAULT_TEMPLATES.expirationWarning)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                                <div className="pt-2">
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                    <ChannelSelector channels={config.messaging?.eventConfigs?.expirationWarning?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, expirationWarning: { channels: ch } } } })} />
                                                </div>
                                                <div className="p-3 bg-orange-50/50 rounded-xl border border-orange-100 flex items-center justify-between">
                                                    <div>
                                                        <h4 className="text-xs font-bold text-orange-900">🔁 Itinerancia de Avisos</h4>
                                                        <p className="text-[10px] text-orange-700/70 leading-tight mt-0.5">Repetir notificaciones aunque no haya cambios en puntos.</p>
                                                    </div>
                                                    <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, repeatExpirationWarnings: !config.messaging?.repeatExpirationWarnings } })}
                                                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${config.messaging?.repeatExpirationWarnings ? 'bg-orange-500' : 'bg-gray-300'}`}>
                                                        <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition ${config.messaging?.repeatExpirationWarnings ? 'translate-x-5' : 'translate-x-1'}`} />
                                                    </button>
                                                </div>
                                                {config.messaging?.repeatExpirationWarnings && (
                                                    <div className="ml-4 p-3 bg-white rounded-lg border border-orange-100 animate-fade-in">
                                                        <label className="flex items-center gap-2">
                                                            <span className="text-xs font-bold text-orange-800 whitespace-nowrap">Recordar cada</span>
                                                            <input type="number" min={0} max={30} value={config.messaging?.expirationReminderIntervalDays ?? 5}
                                                                onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, expirationReminderIntervalDays: parseInt(e.target.value) || 0 } })}
                                                                className="w-14 px-2 py-1 text-center text-xs font-bold border border-orange-200 rounded focus:outline-none"
                                                            />
                                                            <span className="text-xs text-orange-700">días</span>
                                                        </label>
                                                    </div>
                                                )}
                                            </div>
                                            )}
                                        </div>

                                        {/* ALIMENTO (Pet Module) */}
                                        {config.enablePetModule && (
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🐶</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Aviso de Alimento (Módulo Mascotas)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Recordatorio automático cuando le queda poco alimento a la mascota.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.petFoodAlert_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert_title: e.target.value } } })}
                                                        placeholder="🐾 Recordatorio de alimento para {mascota}"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-orange-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petFoodAlert || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.petFoodAlert}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert: DEFAULT_TEMPLATES.petFoodAlert } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'mascota', 'marca']} onSelect={v => insertVar('petFoodAlert', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.petFoodAlert_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.petFoodAlert_whatsapp || config.messaging?.templates?.petFoodAlert || DEFAULT_TEMPLATES.petFoodAlert)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                    <ChannelSelector channels={config.messaging?.eventConfigs?.petFoodAlert?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, petFoodAlert: { channels: ch } } } })} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-orange-700 uppercase tracking-widest mb-1">Anticipación de Aviso</label>
                                                    <div className="flex items-center gap-2">
                                                        <input type="number" value={config.petFoodAlertLeadDays || 0} onChange={e => setConfig({ ...config, petFoodAlertLeadDays: parseInt(e.target.value) || 0 })} className="w-16 p-2 bg-white rounded-lg border border-orange-100 text-sm font-bold outline-none" min="0" max="15" />
                                                        <span className="text-xs text-gray-500">días antes de agotarse</span>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        )}

                                    </div>
                                </div>

                                {/* SECCIÓN C: REFERIDOS */}
                                <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
                                    <div className="bg-gradient-to-r from-purple-600 to-pink-600 px-6 py-4">
                                        <h3 className="text-white font-black text-base flex items-center gap-2">🤝 Sistema de Referidos</h3>
                                        <p className="text-purple-100 text-xs mt-1">Mensajes del programa de referidos y desafíos.</p>
                                    </div>
                                    <div className="divide-y divide-gray-50">

                                        {/* DESAFÍO */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🎯</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Desafío de Referidos</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Difusión manual para motivar durante un desafío activo.</p>
                                                </div>
                                                <span className="ml-auto text-[10px] bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-bold uppercase">Difusión Manual</span>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.referralChallenge_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge_title: e.target.value } } })}
                                                        placeholder="🚀 ¡NUEVO DESAFÍO ACTIVO!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralChallenge || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.referralChallenge || '¡Tenemos un nuevo desafío!'}
                                                            className="w-full px-3 py-2 rounded-lg border border-orange-200 focus:ring-2 focus:ring-orange-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge: DEFAULT_TEMPLATES.referralChallenge } } })} className="px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('referralChallenge', '¡NUEVO DESAFÍO ACTIVO! 🚀')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_completo', 'fecha_limite', 'puntos', 'meta']} onSelect={v => insertVar('referralChallenge', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralChallenge_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralChallenge_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.referralChallenge_whatsapp || config.messaging?.templates?.referralChallenge || DEFAULT_TEMPLATES.referralChallenge || '¡Tenemos un desafío!')} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="mt-4 flex flex-col sm:flex-row items-start sm:items-center gap-4 justify-between bg-orange-50/50 p-3 rounded-xl border border-orange-100">
                                                <div className="w-full sm:w-auto">
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Difusión</label>
                                                    <ChannelSelector channels={challengeChannels} onChange={setChallengeChannels} />
                                                </div>
                                                <button type="button" onClick={async () => {
                                                    const channelsStr = challengeChannels.join(', ') || 'Ninguno';
                                                    if (challengeChannels.length === 0) { toast.error('Selecciona al menos un canal'); return; }
                                                    if (!window.confirm(`¿Deseas difundir el desafío a todos los clientes a través de: ${channelsStr}?`)) return;
                                                    const toastId = toast.loading('Iniciando difusión...');
                                                    const title = '¡NUEVO DESAFÍO ACTIVO! 🚀';
                                                    const templateText = config.messaging?.templates?.referralChallenge || DEFAULT_TEMPLATES.referralChallenge || 'Desafío Activo';
                                                    try {
                                                        const challengeEndDateRaw = config.referrals?.challenge?.endDate;
                                                        let expirationDateFormatted = 'pronto';
                                                        if (challengeEndDateRaw) {
                                                            const [year, month, day] = challengeEndDateRaw.split('-');
                                                            expirationDateFormatted = `${day}/${month}/${year}`;
                                                        }
                                                        const q = query(collection(db, 'users'));
                                                        const snap = await getDocs(q);
                                                        if (challengeChannels.includes('push')) {
                                                            const pushPromises = snap.docs.map(doc => {
                                                                const d = doc.data(); const userName = d.name || '';
                                                                let personalizedMsg = templateText.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName).replace(/{fecha_limite}/g, expirationDateFormatted).replace(/{vencimiento}/g, expirationDateFormatted).replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0').replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');
                                                                return NotificationService.sendToClient(doc.id, { title, body: personalizedMsg, type: 'campaign', icon: config.logoUrl || '/pwa-192x192.png' });
                                                            });
                                                            await Promise.allSettled(pushPromises);
                                                        }
                                                        if (challengeChannels.includes('email')) {
                                                            const emailPromises = snap.docs.map(doc => {
                                                                const d = doc.data();
                                                                if (d.email) {
                                                                    const userName = d.name || '';
                                                                    let personalizedMsg = templateText.replace(/{nombre}/g, userName.split(' ')[0]).replace(/{nombre_completo}/g, userName).replace(/{fecha_limite}/g, expirationDateFormatted).replace(/{vencimiento}/g, expirationDateFormatted).replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0').replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');
                                                                    const htmlContent = EmailService.generateBrandedTemplate(config, title, personalizedMsg);
                                                                    return EmailService.sendEmail(d.email, title, htmlContent);
                                                                }
                                                                return null;
                                                            }).filter(Boolean);
                                                            await Promise.allSettled(emailPromises);
                                                        }
                                                        if (challengeChannels.includes('whatsapp')) {
                                                            let waMsg = templateText.replace(/{fecha_limite}/g, expirationDateFormatted).replace(/{vencimiento}/g, expirationDateFormatted).replace(/{puntos}/g, config.referrals?.challenge?.tiers?.[0]?.bonus?.toString() || '0').replace(/{meta}/g, config.referrals?.challenge?.tiers?.[0]?.count?.toString() || '0');
                                                            navigate('/admin/whatsapp', { state: { message: waMsg } });
                                                        }
                                                        toast.success('¡Difusión completada!', { id: toastId });
                                                    } catch (e) { toast.error('Error en la difusión', { id: toastId }); }
                                                }} className="flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-orange-500 to-rose-600 text-white rounded-xl text-sm font-black shadow-lg hover:scale-105 transition whitespace-nowrap">
                                                    <Megaphone size={16} /> ¡Difundir a Todos!
                                                </button>
                                            </div>
                                        </div>

                                        {/* RECOMPENSA POR REFERIDO */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🤝</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Premio por Referido (al Nuevo Socio)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al nuevo cliente cuando completa el ciclo de referido.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.referralReward_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward_title: e.target.value } } })}
                                                        placeholder="🎁 ¡Tu amigo te regaló puntos!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralReward || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.referralReward}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward: DEFAULT_TEMPLATES.referralReward } } })} className="px-2 py-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('referralReward')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'amigo', 'puntos']} onSelect={v => insertVar('referralReward', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralReward_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralReward_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.referralReward_whatsapp || config.messaging?.templates?.referralReward || DEFAULT_TEMPLATES.referralReward)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.referralReward?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, referralReward: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                        {/* PUNTOS POR REFERIR */}
                                        <div className="p-6 space-y-4">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xl">🏆</span>
                                                <div>
                                                    <h4 className="font-black text-gray-800 text-sm uppercase tracking-tight">Puntos por Referir (al Anfitrión)</h4>
                                                    <p className="text-[10px] text-gray-400 mt-0.5">Se envía al socio que invitó cuando su referido completa el ciclo.</p>
                                                </div>
                                            </div>
                                            <div className="grid gap-3">
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">A. Título</label>
                                                    <input type="text" value={config.messaging?.templates?.referralPoints_title || ''}
                                                        onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints_title: e.target.value } } })}
                                                        placeholder="🏆 ¡Ganaste puntos por tu invitación!"
                                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none text-sm"
                                                    />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-1">B. Cuerpo Principal</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralPoints || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints: e.target.value } } })}
                                                            placeholder={DEFAULT_TEMPLATES.referralPoints}
                                                            className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:ring-2 focus:ring-purple-100 outline-none resize-none text-sm"
                                                        />
                                                        <div className="flex flex-col gap-1">
                                                            <button type="button" onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints: DEFAULT_TEMPLATES.referralPoints } } })} className="px-2 py-1.5 text-gray-400 hover:text-purple-600 rounded hover:bg-purple-50 transition text-sm" title="Restaurar">↺</button>
                                                            <button type="button" onClick={() => openPreview('referralPoints')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>
                                                        </div>
                                                    </div>
                                                    <VariableChips vars={['siteName', 'nombre', 'nombre_referido', 'puntos']} onSelect={v => insertVar('referralPoints', v)} />
                                                </div>
                                                <div>
                                                    <label className="block text-[10px] font-bold text-green-600 uppercase tracking-widest mb-1">C. Cuerpo WhatsApp (opcional)</label>
                                                    <div className="flex gap-2">
                                                        <textarea rows={2} value={config.messaging?.templates?.referralPoints_whatsapp || ''}
                                                            onChange={e => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, referralPoints_whatsapp: e.target.value } } })}
                                                            placeholder="Vacío = usa el Cuerpo Principal."
                                                            className="w-full px-3 py-2 rounded-lg border border-green-200 focus:ring-2 focus:ring-green-100 outline-none resize-none text-sm"
                                                        />
                                                        <button type="button" onClick={() => openWaPreview(config.messaging?.templates?.referralPoints_whatsapp || config.messaging?.templates?.referralPoints || DEFAULT_TEMPLATES.referralPoints)} className="px-2 py-1.5 text-green-600 hover:text-green-800 rounded hover:bg-green-50 transition border border-green-200" title="Vista Previa WhatsApp"><MessageCircle size={16} /></button>
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="pt-2">
                                                <label className="block text-[10px] font-bold text-gray-400 uppercase tracking-widest mb-2">Canales de Envío</label>
                                                <ChannelSelector channels={config.messaging?.eventConfigs?.referralPoints?.channels || []} onChange={(ch) => setConfig({ ...config, messaging: { ...config.messaging!, eventConfigs: { ...config.messaging?.eventConfigs, referralPoints: { channels: ch } } } })} />
                                            </div>
                                        </div>

                                    </div>
                                </div>

                                {/* Email Preview Button */}
                                {config.messaging?.emailEnabled && (
                                    <div className="flex justify-end pt-2">
                                        <button type="button" onClick={handleTestEmail} className="px-4 py-2 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 font-medium transition flex items-center gap-2">
                                            <Monitor size={16} /> Ver Previsualización de Email
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>
                    )
                }
'@

# Split the new section into lines
$newLines = $newMessagingSection -split "`n" | ForEach-Object { $_.TrimEnd("`r") }

# Step 1: Remove activeMsgTab state line (index 153, 0-indexed)
# Step 2: Add waPreview state after previewModal block (after index 183 which is blank)
# Step 3: Replace lines 2107 to 3088 with new content

$waPreviewCode = @(
    '',
    '    // WhatsApp Preview State',
    '    const [waPreview, setWaPreview] = useState({',
    '        isOpen: false,',
    '        content: ''''',
    '    });',
    '',
    '    const openWaPreview = (text: string) => {',
    '        setWaPreview({ isOpen: true, content: text });',
    '    };',
    ''
)

# Build new file:
# Part 1: lines 0-152 (before activeMsgTab), skip 153, lines 154-183, insert waPreview, lines 184-2106, new content, lines 3089+ (advanced tab onwards)
$part1 = $originalLines[0..152]          # before activeMsgTab (line 153 is 0-indexed 153, skip it)
$part2 = $originalLines[154..183]        # after activeMsgTab through previewModal block
$part3 = $originalLines[184..2106]       # after previewModal to before SUB-TABS
$part4 = $newLines                       # new messaging section
$part5 = $originalLines[3089..($originalLines.Length-1)]  # from advanced tab onwards

$combined = $part1 + $part2 + $waPreviewCode + $part3 + $part4 + $part5

# Write with UTF8 no BOM
$encoding = New-Object System.Text.UTF8Encoding($false)
[System.IO.File]::WriteAllLines($filePath, $combined, $encoding)

Write-Host "Done! New file has $($combined.Length) lines."
