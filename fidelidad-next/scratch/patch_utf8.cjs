const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, '../src/modules/admin/pages/ConfigPage.tsx');
let content = fs.readFileSync(filePath, 'utf8');

// 1. Add Rocket to Lucide imports
content = content.replace("Dog } from 'lucide-react'", "Dog, Rocket, Search, CheckCircle2 } from 'lucide-react'");

// 2. Add testMessageModal state and handlers
const stateCode = `
    const [testMessageModal, setTestMessageModal] = useState({
        isOpen: false,
        templateKey: '',
        title: '',
        body: '',
        waBody: '',
        channels: [] as string[]
    });

    const openTestModal = (key: string, customTitle?: string) => {
        const templates = config.messaging?.templates as any;
        const events = config.messaging?.eventConfigs as any;
        const t = templates?.[key] || '';
        const title = templates?.[key + '_title'] || customTitle || '';
        const wa = templates?.[key + '_whatsapp'] || '';
        const ch = events?.[key]?.channels || [];
        setTestMessageModal({
            isOpen: true,
            templateKey: key,
            title: title,
            body: t,
            waBody: wa,
            channels: ch
        });
    };
`;

content = content.replace('const [waPreview, setWaPreview] = useState({', stateCode + '\n\n    const [waPreview, setWaPreview] = useState({');

// 3. Add the Modal component at the end of the file before <EmailPreviewModal>
const modalCode = `
            {/* Modal de Prueba de Envío */}
            {testMessageModal.isOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setTestMessageModal({ ...testMessageModal, isOpen: false })} />
                    <div className="relative bg-white rounded-3xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh]">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-purple-50">
                            <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-purple-100 text-purple-600 rounded-2xl flex items-center justify-center">
                                    <Rocket size={24} />
                                </div>
                                <div>
                                    <h3 className="text-xl font-black text-purple-900">Probar Envío: {testMessageModal.templateKey}</h3>
                                    <p className="text-sm text-purple-700/70">Enviá un mensaje real a un usuario para verificar variables.</p>
                                </div>
                            </div>
                            <button onClick={() => setTestMessageModal({ ...testMessageModal, isOpen: false })} className="text-gray-400 hover:text-gray-600 p-2 rounded-xl hover:bg-white transition">
                                ✕
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto space-y-6">
                            
                            {/* Búsqueda de Usuario */}
                            <div className="space-y-3">
                                <label className="block text-sm font-bold text-gray-700">1. Buscar Usuario de Prueba</label>
                                <div className="relative">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                                    <input 
                                        type="text" 
                                        placeholder="Buscar por nombre, email o DNI..." 
                                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-200 rounded-xl focus:ring-2 focus:ring-purple-500 outline-none"
                                        id="testUserSearchInput"
                                        onChange={async (e) => {
                                            const val = e.target.value;
                                            const resultsDiv = document.getElementById('testUserResults');
                                            if (!resultsDiv) return;
                                            if (val.length < 3) {
                                                resultsDiv.innerHTML = '';
                                                return;
                                            }
                                            resultsDiv.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">Buscando...</div>';
                                            
                                            // Buscar en Firebase
                                            const q = query(collection(db, 'users'), orderBy('name'), limit(5));
                                            const snap = await getDocs(q);
                                            let results: any[] = [];
                                            snap.forEach(doc => {
                                                const d = doc.data();
                                                if (d.name?.toLowerCase().includes(val.toLowerCase()) || d.email?.toLowerCase().includes(val.toLowerCase()) || d.dni?.includes(val)) {
                                                    results.push({ id: doc.id, ...d });
                                                }
                                            });
                                            
                                            if (results.length === 0) {
                                                resultsDiv.innerHTML = '<div class="p-3 text-sm text-gray-500 text-center">No se encontraron usuarios.</div>';
                                                return;
                                            }
                                            
                                            (window as any)._testUsers = results; // Guardar temporalmente
                                            
                                            resultsDiv.innerHTML = results.map((u, idx) => \`
                                                <div class="p-3 hover:bg-purple-50 cursor-pointer flex justify-between items-center border-b border-gray-100 last:border-0 transition" onclick="window._selectTestUser(\${idx})">
                                                    <div>
                                                        <div class="font-bold text-gray-800 text-sm">\${u.name || 'Sin nombre'}</div>
                                                        <div class="text-xs text-gray-500">\${u.email || u.phone || 'Sin datos de contacto'}</div>
                                                    </div>
                                                    <div class="text-xs bg-purple-100 text-purple-700 px-2 py-1 rounded-full font-bold">\${u.points || 0} pts</div>
                                                </div>
                                            \`).join('');
                                        }}
                                    />
                                </div>
                                <div id="testUserResults" className="bg-white border border-gray-100 rounded-xl overflow-hidden shadow-sm empty:hidden"></div>
                                
                                <div id="selectedTestUser" className="hidden bg-green-50 border border-green-200 rounded-xl p-4 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <CheckCircle2 className="text-green-500" size={20} />
                                        <div>
                                            <div id="selUserName" className="font-bold text-green-900 text-sm">Usuario</div>
                                            <div id="selUserData" className="text-xs text-green-700">Datos</div>
                                        </div>
                                    </div>
                                    <button onClick={() => {
                                        document.getElementById('selectedTestUser')?.classList.add('hidden');
                                        (document.getElementById('testUserSearchInput') as HTMLInputElement).value = '';
                                        (window as any)._selectedUserForTest = null;
                                    }} className="text-xs text-green-700 font-bold hover:text-green-900 underline">Cambiar</button>
                                </div>
                            </div>
                            
                            <div className="relative flex items-center py-2">
                                <div className="flex-grow border-t border-gray-200"></div>
                                <span className="flex-shrink-0 mx-4 text-gray-400 text-xs font-bold uppercase tracking-widest">O ingresar datos manuales</span>
                                <div className="flex-grow border-t border-gray-200"></div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">Email Manual</label>
                                    <input type="email" id="manualTestEmail" placeholder="test@test.com" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                                </div>
                                <div>
                                    <label className="block text-xs font-bold text-gray-600 mb-1">WhatsApp Manual</label>
                                    <input type="text" id="manualTestPhone" placeholder="5491122334455" className="w-full px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-sm outline-none focus:ring-2 focus:ring-purple-500" />
                                </div>
                            </div>

                            {/* Canales */}
                            <div className="space-y-3 pt-4 border-t border-gray-100">
                                <label className="block text-sm font-bold text-gray-700">2. Seleccionar Canales a Probar</label>
                                <div className="flex gap-4">
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-purple-50 p-3 rounded-xl transition flex-1 border border-gray-200 hover:border-purple-200">
                                        <input type="checkbox" id="testChEmail" defaultChecked={testMessageModal.channels.includes('email')} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                        <span className="text-sm font-bold text-gray-700">Email</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-purple-50 p-3 rounded-xl transition flex-1 border border-gray-200 hover:border-purple-200">
                                        <input type="checkbox" id="testChWa" defaultChecked={testMessageModal.channels.includes('whatsapp')} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                        <span className="text-sm font-bold text-gray-700">WhatsApp</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer bg-gray-50 hover:bg-purple-50 p-3 rounded-xl transition flex-1 border border-gray-200 hover:border-purple-200">
                                        <input type="checkbox" id="testChPush" defaultChecked={testMessageModal.channels.includes('push')} className="w-4 h-4 text-purple-600 rounded border-gray-300 focus:ring-purple-500" />
                                        <span className="text-sm font-bold text-gray-700">Push</span>
                                    </label>
                                </div>
                            </div>

                        </div>
                        <div className="p-6 bg-gray-50 border-t border-gray-100 flex justify-end gap-3">
                            <button onClick={() => setTestMessageModal({ ...testMessageModal, isOpen: false })} className="px-6 py-3 font-bold text-gray-500 hover:bg-gray-200 rounded-xl transition">
                                Cancelar
                            </button>
                            <button onClick={async () => {
                                const user = (window as any)._selectedUserForTest;
                                const manualEmail = (document.getElementById('manualTestEmail') as HTMLInputElement)?.value;
                                const manualPhone = (document.getElementById('manualTestPhone') as HTMLInputElement)?.value;
                                
                                const chEmail = (document.getElementById('testChEmail') as HTMLInputElement)?.checked;
                                const chWa = (document.getElementById('testChWa') as HTMLInputElement)?.checked;
                                const chPush = (document.getElementById('testChPush') as HTMLInputElement)?.checked;
                                
                                if (!user && !manualEmail && !manualPhone) {
                                    toast.error('Selecciona un usuario o ingresá datos manuales');
                                    return;
                                }
                                if (!chEmail && !chWa && !chPush) {
                                    toast.error('Selecciona al menos un canal para probar');
                                    return;
                                }

                                const toastId = toast.loading('Enviando pruebas...');
                                
                                // Funciones de reemplazo
                                const processText = (text: string) => {
                                    return text
                                        .replace(/{nombre}/g, user ? (user.name || '').split(' ')[0] : 'UsuarioPrueba')
                                        .replace(/{nombre_completo}/g, user ? user.name || '' : 'Usuario Prueba Completo')
                                        .replace(/{puntos}/g, user ? String(user.points || 0) : '150')
                                        .replace(/{saldo}/g, user ? String(user.points || 0) : '150')
                                        .replace(/{siteName}/g, config.siteName || 'El Club')
                                        .replace(/{premio}/g, 'Premio de Prueba')
                                        .replace(/{codigo}/g, 'TEST-123')
                                        .replace(/{fecha}/g, '31/12/2025')
                                        .replace(/{vencimiento}/g, '31/12/2025')
                                        .replace(/{fecha_limite}/g, '31/12/2025')
                                        .replace(/{amigo}/g, 'AmigoPrueba')
                                        .replace(/{nombre_referido}/g, 'AmigoPrueba')
                                        .replace(/{mascota}/g, user?.pets?.[0]?.name || 'Firulais')
                                        .replace(/{marca}/g, 'MarcaPrueba')
                                        .replace(/{titulo}/g, 'Titulo de Promoción')
                                        .replace(/{descripcion}/g, 'Descripción de campaña de prueba')
                                        .replace(/{detalle}/g, 'Detalle de oferta')
                                        .replace(/{horario}/g, '20:00');
                                };

                                const finalTitle = processText(testMessageModal.title || 'Mensaje de Prueba');
                                const finalBody = processText(testMessageModal.body);
                                const finalWaBody = processText(testMessageModal.waBody || testMessageModal.body);

                                try {
                                    const emailToSend = manualEmail || user?.email;
                                    const phoneToSend = manualPhone || user?.phone;

                                    if (chEmail) {
                                        if (!emailToSend) toast.error('No hay email para enviar');
                                        else {
                                            const html = EmailService.generateBrandedTemplate(config, finalTitle, finalBody);
                                            await EmailService.sendEmail(emailToSend, finalTitle, html);
                                            toast.success('Email de prueba enviado', { id: toastId });
                                        }
                                    }
                                    if (chPush) {
                                        if (!user?.id) toast.error('Se requiere un usuario de la BD para probar Push');
                                        else {
                                            await NotificationService.sendToClient(user.id, { title: finalTitle, body: finalBody, type: 'campaign' });
                                            toast.success('Push de prueba enviado', { id: toastId });
                                        }
                                    }
                                    if (chWa) {
                                        if (!phoneToSend) toast.error('No hay teléfono para WhatsApp');
                                        else {
                                            const url = \`https://api.whatsapp.com/send?phone=\${phoneToSend}&text=\${encodeURIComponent(finalWaBody)}\`;
                                            window.open(url, '_blank');
                                            toast.success('Abriendo WhatsApp...', { id: toastId });
                                        }
                                    }
                                } catch (error) {
                                    console.error(error);
                                    toast.error('Hubo un error al enviar las pruebas', { id: toastId });
                                }
                            }} className="px-6 py-3 bg-purple-600 hover:bg-purple-700 text-white font-black rounded-xl flex items-center gap-2 shadow-lg hover:shadow-xl hover:-translate-y-0.5 transition active:scale-95">
                                <Rocket size={18} /> ¡Enviar Prueba!
                            </button>
                        </div>
                    </div>
                </div>
            )}
            
            <EmailPreviewModal
`;

content = content.replace('<EmailPreviewModal', modalCode);

// 4. Inject buttons into the UI
const emailPreviewBtn = ' title="Vista Previa Email"><Eye size={16} /></button>';
const testBtn = ` title="Vista Previa Email"><Eye size={16} /></button>\n                                                            <button type="button" onClick={() => openTestModal('__TEMPLATE__')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>`;

content = content.replace("onClick={() => openPreview('flashOffer')}" + emailPreviewBtn, "onClick={() => openPreview('flashOffer')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'flashOffer'));
content = content.replace("onClick={() => openPreview('offer')}" + emailPreviewBtn, "onClick={() => openPreview('offer')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'offer'));
content = content.replace("onClick={() => openPreview('campaign')}" + emailPreviewBtn, "onClick={() => openPreview('campaign')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'campaign'));
content = content.replace("onClick={() => openPreview('pointsAdded')}" + emailPreviewBtn, "onClick={() => openPreview('pointsAdded')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'pointsAdded'));
content = content.replace("onClick={() => openPreview('redemption')}" + emailPreviewBtn, "onClick={() => openPreview('redemption')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'redemption'));
content = content.replace("onClick={() => openPreview('birthday')}" + emailPreviewBtn, "onClick={() => openPreview('birthday')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'birthday'));
content = content.replace("onClick={() => openPreview('birthdaySimple')}" + emailPreviewBtn, "onClick={() => openPreview('birthdaySimple')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'birthdaySimple'));
content = content.replace("onClick={() => openPreview('welcome')}" + emailPreviewBtn, "onClick={() => openPreview('welcome')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'welcome'));
content = content.replace("onClick={() => openPreview('expirationWarning')}" + emailPreviewBtn, "onClick={() => openPreview('expirationWarning')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'expirationWarning'));
content = content.replace("onClick={() => openPreview('referralChallenge', '¡NUEVO DESAFÍO ACTIVO! 🚀')}" + emailPreviewBtn, "onClick={() => openPreview('referralChallenge', '¡NUEVO DESAFÍO ACTIVO! 🚀')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'referralChallenge'));
content = content.replace("onClick={() => openPreview('referralReward')}" + emailPreviewBtn, "onClick={() => openPreview('referralReward')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'referralReward'));
content = content.replace("onClick={() => openPreview('referralPoints')}" + emailPreviewBtn, "onClick={() => openPreview('referralPoints')} className=\"px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100\"" + testBtn.replace('__TEMPLATE__', 'referralPoints'));

// Pet Food Alert
const testBtnPet = ` title="Restaurar">↺</button>\n                                                            <button type="button" onClick={() => openPreview('petFoodAlert')} className="px-2 py-1.5 text-blue-500 hover:text-blue-700 rounded hover:bg-blue-50 transition border border-blue-100" title="Vista Previa Email"><Eye size={16} /></button>\n                                                            <button type="button" onClick={() => openTestModal('petFoodAlert')} className="px-2 py-1.5 text-purple-600 hover:text-purple-800 rounded hover:bg-purple-50 transition border border-purple-200" title="Probar Envío a Usuario"><Rocket size={16} /></button>`;
content = content.replace("onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert: DEFAULT_TEMPLATES.petFoodAlert } } })} className=\"px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm\" title=\"Restaurar\">↺</button>", 
                          "onClick={() => setConfig({ ...config, messaging: { ...config.messaging!, templates: { ...config.messaging?.templates, petFoodAlert: DEFAULT_TEMPLATES.petFoodAlert } } })} className=\"px-2 py-1.5 text-gray-400 hover:text-orange-600 rounded hover:bg-orange-50 transition text-sm\"" + testBtnPet);

// 5. Add a useEffect to handle global test user selection click
const effectCode = `
    // Efecto para vincular el click del usuario de prueba desde el HTML crudo
    useEffect(() => {
        (window as any)._selectTestUser = (idx: number) => {
            const users = (window as any)._testUsers || [];
            const user = users[idx];
            if (user) {
                (window as any)._selectedUserForTest = user;
                const resultsDiv = document.getElementById('testUserResults');
                const selectedDiv = document.getElementById('selectedTestUser');
                const selName = document.getElementById('selUserName');
                const selData = document.getElementById('selUserData');
                
                if (resultsDiv) resultsDiv.innerHTML = '';
                if (selectedDiv) selectedDiv.classList.remove('hidden');
                if (selName) selName.innerText = user.name || 'Usuario';
                if (selData) selData.innerText = (user.email || user.phone || '') + ' - ' + (user.points || 0) + ' pts';
            }
        };
    }, []);

    const [testMessageModal,
`;

content = content.replace("const [testMessageModal,", effectCode);

fs.writeFileSync(filePath, content, 'utf8');
console.log('File patched successfully using UTF-8');
