const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '../extension-club-fidelidad/content.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Add activeTab "sorteos" to the state
if (!content.includes('let activeTab = \'pending\';')) {
    // maybe it's inside `buildAlertsPanel`?
}

const buildRegex = /let activeTab = 'pending';/;
content = content.replace(buildRegex, "let activeTab = 'pending';"); // no change here, it's fine

// 2. Add tab button
const tabsRegex = /<button id="tab-processed"[^>]*>[\s\S]*?PROCESADOS[\s\S]*?<\/button>/;
const tabsReplacement = `<button id="tab-sorteos" style="flex:1; padding:8px; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; \${activeTab === 'sorteos' ? 'background:rgba(234,88,12,0.2); color:#fdba74; border: 1px solid rgba(234,88,12,0.3);' : 'background:none; color:rgba(255,255,255,0.4);'}">
                        SORTEOS (\${fullData.mysteryBoxes ? fullData.mysteryBoxes.length : 0})
                    </button>
                    $&`;
if (!content.includes('tab-sorteos')) {
    content = content.replace(tabsRegex, tabsReplacement);
}

// 3. Add render logic for Sorteos tab
const renderListRegex = /\$\{activeTab === 'pending' \? renderList\([\s\S]*?\) \: renderList\([\s\S]*?\)\}/;
const renderListReplacement = `\${activeTab === 'sorteos' 
                        ? renderMysteryBoxes(fullData.mysteryBoxes || []) 
                        : activeTab === 'pending' ? renderList(pendingB, pendingE, pendingP, pendingR, pendingA, (fullData.campaigns?.list || []).filter(c => getStatus(c.alertId) === 'pending'), 'pending', curY, fullData) : renderList(procB, procE, procP, procR, procA, (fullData.campaigns?.list || []).filter(c => getStatus(c.alertId) !== 'pending'), 'processed', curY, fullData)}`;
if (!content.includes('renderMysteryBoxes(fullData.mysteryBoxes')) {
    content = content.replace(renderListRegex, renderListReplacement);
}

// 4. Add the click handler
const clickHandlerRegex = /ui\.querySelector\('#tab-processed'\)\.onclick = \(\) => \{ activeTab = 'processed'; render\(\); \};/;
const clickHandlerReplacement = `ui.querySelector('#tab-processed').onclick = () => { activeTab = 'processed'; render(); };
            ui.querySelector('#tab-sorteos').onclick = () => { activeTab = 'sorteos'; render(); };`;
if (!content.includes("ui.querySelector('#tab-sorteos')")) {
    content = content.replace(clickHandlerRegex, clickHandlerReplacement);
}

// 5. Create `renderMysteryBoxes` function
const renderMysteryBoxesFn = `
        const renderMysteryBoxes = (boxes) => {
            if (!boxes || boxes.length === 0) {
                return '<div style="text-align:center; padding:40px 0; opacity:0.3; font-size:12px; font-weight:bold; color:white;">🎁 No hay sorteos pendientes</div>';
            }
            return boxes.map(b => {
                const isExpired = new Date(b.expiresAt._seconds ? b.expiresAt._seconds * 1000 : b.expiresAt) < new Date();
                return \`
                <div style="background:\${isExpired ? 'rgba(239,68,68,0.1)' : 'rgba(234,88,12,0.1)'}; border:1px solid \${isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(234,88,12,0.2)'}; padding:12px; border-radius:12px; margin-bottom:8px; display:flex; flex-direction:column; gap:8px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <div style="font-weight:bold; font-size:14px; color:white;">\${b.userName || 'Socio'}</div>
                            <div style="font-size:11px; color:rgba(255,255,255,0.7);">
                                \${b.socioNumber ? 'Nº: ' + b.socioNumber : (b.phone ? 'Tel: ' + b.phone : '')}
                            </div>
                        </div>
                        <div style="background:\${isExpired ? 'rgba(239,68,68,0.2)' : 'rgba(234,88,12,0.2)'}; color:\${isExpired ? '#fca5a5' : '#fdba74'}; padding:2px 8px; border-radius:12px; font-size:10px; font-weight:bold;">
                            \${isExpired ? 'VENCIDO' : 'PENDIENTE'}
                        </div>
                    </div>
                    <div style="font-size:11px; color:white;">Monto Compra: $\${b.amount}</div>
                    <button class="cf-v35-btn-mb" data-id="\${b.id}" data-phone="\${b.phone}" style="width:100%; padding:8px; background:\${isExpired ? '#dc2626' : '#ea580c'}; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">
                        Reenviar Link WhatsApp
                    </button>
                </div>
                \`;
            }).join('');
        };
`;
if (!content.includes('const renderMysteryBoxes = (boxes) => {')) {
    content = content.replace('const renderList = (bArr, eArr, pArr, rArr, aArr, campArr, mode, y, fd) => {', renderMysteryBoxesFn + '\n        const renderList = (bArr, eArr, pArr, rArr, aArr, campArr, mode, y, fd) => {');
}

// 6. Handle attachActions for mystery boxes
const attachActionsRegex = /ui\.querySelectorAll\('\.cf-v35-btn-wa'\)\.forEach\(btn => \{/;
const mbActions = `
            ui.querySelectorAll('.cf-v35-btn-mb').forEach(btn => {
                btn.onclick = () => {
                    const id = btn.getAttribute('data-id');
                    const phone = btn.getAttribute('data-phone');
                    const url = \`\${config.apiUrl}/pwa/mystery-box?id=\${id}\`;
                    const msg = \`¡Hola! Ganaste una Caja Sorpresa. Hacé click acá para abrirla: \${url}\`;
                    window.open(\`https://wa.me/\${phone.replace(/\\D/g, '')}?text=\${encodeURIComponent(msg)}\`, '_blank');
                };
            });
`;
if (!content.includes('cf-v35-btn-mb')) {
    content = content.replace(attachActionsRegex, mbActions + '\n            ui.querySelectorAll(\'.cf-v35-btn-wa\').forEach(btn => {');
}

fs.writeFileSync(file, content, 'utf8');
console.log('content.js patched for Sorteos tab');
