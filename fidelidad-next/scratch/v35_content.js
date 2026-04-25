// Club Fidelidad - Content Script (VERSI├ôN EMPLEADO V35 - EXPIRATION ITINERARY)
console.log("­ƒÜÇ [Club Fidelidad] V35: Implementando itinerario de vencimientos detallado.");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let detectedDiscounts = 0;

// Cargar configuraci├│n de storage
chrome.storage.local.get(['appName', 'apiUrl', 'apiKey'], (res) => {
    config = res;
    if (res.apiUrl && res.apiKey) {
        // Trigger Engine
        fetch(`${res.apiUrl}/api/engine-campaigns?trigger=extension`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-api-key': res.apiKey } }).catch(e => {});

        fetch(`${res.apiUrl}/api/engine-daily?mode=daily&trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': res.apiKey }
        }).then(r => r.json())
        .then(data => {
            if (data?.ok) {
                const total = (data.birthdays?.list?.length || 0) + (data.expirations?.list?.length || 0) + (data.petAlerts?.list?.length || 0);
                if (total > 0) showGlobalAlert(data, res.apiUrl);
            }
        }).catch(e => console.error("ÔØî [Club Fidelidad] Error:", e.message));
    }
});

function showGlobalAlert(fullData, adminUrl) {
    const birthdays = fullData.birthdays?.list || [];
    const expirations = fullData.expirations?.list || [];
    const petAlerts = fullData.petAlerts?.list || [];
    const total = birthdays.length + expirations.length + petAlerts.length;

    if (total === 0) {
        const w = document.getElementById('cf-v35-bubble');
        if (w) w.remove();
        return;
    }

    let container = document.getElementById('cf-v35-bubble');
    if (container) container.remove();
    
    container = document.createElement('div');
    container.id = 'cf-v35-bubble';
    container.style.cssText = `position:fixed; bottom:30px; right:30px; z-index:2147483647; pointer-events:none;`;

    let isExpanded = false;
    let pos = { x: 0, y: 0 };
    let dragStart = { x: 0, y: 0 };
    let isDragging = false;

    if (!document.getElementById('cf-v35-styles')) {
        const style = document.createElement('style');
        style.id = 'cf-v35-styles';
        style.textContent = `
            .cf-v35-glass {
                background: rgba(13, 10, 42, 0.98); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
                border: 1px solid rgba(255,255,255,0.15); border-radius: 36px;
                box-shadow: 0 50px 100px -20px rgba(0,0,0,0.85); color: white;
                font-family: system-ui, -apple-system, sans-serif; pointer-events: auto;
            }
            .cf-v35-bubble {
                width: 78px; height: 78px; background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border-radius: 50%; display: flex; align-items:center; justify-content:center;
                cursor: grab; border: 4px solid white; box-shadow: 0 20px 50px rgba(99, 102, 241, 0.6);
                transition: transform 0.2s; animation: cf-v35-float 4s infinite ease-in-out; pointer-events: auto;
            }
            .cf-v35-panel { width: 400px; max-height: 580px; display: flex; flex-direction: column; overflow: hidden; animation: cf-v35-pop 0.3s cubic-bezier(0,1,0.2,1); }
            .cf-v35-card { background: rgba(255,255,255,0.07); border-radius: 30px; padding: 24px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1); }
            .cf-v35-checkbox { width: 22px; height: 22px; cursor: pointer; accent-color: #25D366; }
            .cf-v35-btn-wa {
                background: linear-gradient(135deg, #25D366, #128C7E); color: white; border: none;
                border-radius: 20px; padding: 16px; font-weight: 900; font-size: 13px;
                text-transform: uppercase; cursor: pointer; width: 100%; margin-top: 15px;
                box-shadow: 0 10px 20px rgba(18, 140, 126, 0.3); transition: all 0.2s;
            }
            .cf-v35-btn-wa:hover { filter: brightness(1.1); transform: scale(1.02); }
            .cf-v35-btn-wa.no-msg { background: rgba(255,255,255,0.1); color: #fff; box-shadow: none; border: 1px solid rgba(255,255,255,0.2); }
            @keyframes cf-v35-float { 0%,100% {transform:translateY(0)} 50% {transform:translateY(-12px)} }
            @keyframes cf-v35-pop { from {opacity:0; transform:scale(0.8) translateY(40px)} to {opacity:1; transform:scale(1) translateY(0)} }
            .cf-scrollbar::-webkit-scrollbar { width: 4px; }
            .cf-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        `;
        document.head.appendChild(style);
    }

    const generateWhatsAppToken = (type, phone, name, extra, cfg, breakdownStr) => {
        if (!phone) return null;
        let p = phone.replace(/\D/g, '');
        if (!p.startsWith('54') && p.length === 10) p = '549' + p;
        const templates = cfg?.messaging?.templates || {};
        const firstName = name.split(' ')[0];
        let msg = "";
        
        if (type === 'birthdays') {
            const points = cfg?.birthdayPoints || 100;
            if (cfg?.enableBirthdayBonus !== false) {
                msg = (templates.birthday || "┬íFeliz cumple {nombre}! ­ƒÄé­ƒÄë Te regalamos {puntos} puntos. Ô£¿").replace(/{puntos}/g, points.toString());
            } else { msg = templates.birthdaySimple || "┬íFeliz cumple {nombre}! ­ƒÄé­ƒÄë Ô£¿"; }
        } else if (type === 'expirations') {
            if (breakdownStr && breakdownStr.includes('|')) {
                const list = breakdownStr.split('|').map(s => `\nÔÇó ${s}`).join('');
                msg = `┬íHola ${firstName}! ­ƒôó Tus puntos vencen pr├│ximamente:${list}\n\n­ƒöÑ Total a vencer: ${extra} pts.`;
            } else {
                msg = (templates.expirationWarning || "┬íHola {nombre}! ­ƒôó {puntos} pts por vencer. ÔÅ│").replace(/{puntos}/g, extra);
            }
        } else if (type === 'petAlerts') {
            msg = (templates.petFoodAlert || "┬íHola {nombre}! ­ƒÉ¥ Reposici├│n de {mascota}.").replace(/{mascota}/g, extra);
        }
        msg = msg.replace(/{nombre}/g, firstName).replace(/{tienda}/g, cfg?.siteName || cfg?.appName || 'la tienda');
        return `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`;
    };

    const mouseUp = () => { isDragging = false; document.removeEventListener('mousemove', onMouseMove); };
    const onMouseMove = (e) => { 
        if (isDragging) {
            pos.x = e.clientX - dragStart.x; pos.y = e.clientY - dragStart.y;
            container.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        }
    };

    const render = () => {
        container.innerHTML = '';
        const ui = document.createElement('div');
        if (isExpanded) {
            ui.className = 'cf-v35-glass cf-v35-panel';
            ui.innerHTML = `
                <div style="padding:24px; cursor:grab; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;" id="cf-v35-drag">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:28px;">Ô¡É</span>
                        <div>
                            <div style="font-weight:900; font-size:13px; text-transform:uppercase;">Centro de Avisos</div>
                            <div style="font-size:10px; opacity:0.5; font-weight:700;">Gesti├│n de Vencimientos</div>
                        </div>
                    </div>
                    <button id="cf-v35-close" style="background:none; border:none; color:white; font-size:28px; cursor:pointer;" title="Minimizar">├ù</button>
                </div>
                <div style="padding:22px; overflow-y:auto; flex:1;" class="cf-scrollbar">
                    ${renderBirthdays()}
                    ${renderExpirations()}
                    ${renderGroup('petAlerts', '­ƒÉ¥ Mascotas', petAlerts, '#6366f1')}
                </div>
            `;
            ui.querySelector('#cf-v35-drag').onmousedown = (e) => {
                isDragging = true; dragStart.x = e.clientX - pos.x; dragStart.y = e.clientY - pos.y;
                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', mouseUp);
            };
            ui.querySelector('#cf-v35-close').onclick = () => { isExpanded = false; render(); };
            
            ui.querySelectorAll('.cf-v35-card').forEach(card => {
                const btn = card.querySelector('.cf-v35-btn-wa');
                const checkWA = card.querySelector('.cf-v34-wa-toggle');
                
                checkWA.onchange = () => {
                    const active = checkWA.checked;
                    btn.innerText = active ? '­ƒô▒ Enviar WhatsApp' : 'Ô£à Marcar como visto';
                    if (!active) btn.classList.add('no-msg');
                    else btn.classList.remove('no-msg');
                };

                btn.onclick = () => {
                    if (checkWA.checked) {
                        const url = generateWhatsAppToken(btn.dataset.type, btn.dataset.phone, btn.dataset.name, btn.dataset.extra, fullData.config, btn.dataset.breakdown);
                        if (url) window.open(url, '_blank');
                    }
                    card.style.opacity = '0.3'; btn.innerText = 'PROCESADO';
                };
            });
        } else {
            ui.className = 'cf-v35-bubble';
            ui.innerHTML = `<span style="font-size:36px;">­ƒöö</span><div style="position:absolute; top:-5px; right:-5px; background:#ef4444; color:white; font-size:11px; font-weight:900; width:28px; height:28px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2.5px solid white;">${total}</div>`;
            ui.onmousedown = (e) => {
                isDragging = true; dragStart.x = e.clientX - pos.x; dragStart.y = e.clientY - pos.y;
                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', mouseUp);
            };
            ui.onclick = (e) => { if (Math.abs(e.clientX - (pos.x + dragStart.x)) < 5) { isExpanded = true; render(); } };
        }
        container.appendChild(ui);
    };

    const renderBirthdays = () => {
        if (birthdays.length === 0) return '';
        const curY = new Date().getFullYear().toString();
        return `<div style="margin-bottom:25px;">
            <div style="font-size:11px; font-weight:900; color:#ec4899; text-transform:uppercase; margin-bottom:12px;">­ƒÄé Cumplea├▒os Hoy</div>
            ${birthdays.map(c => `<div class="cf-v35-card">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                    <div><div style="font-weight:900; font-size:16px;">${c.name}</div><div style="font-size:10px; opacity:0.5;">DNI: ${c.dni} | Nro: ${c.socioNumber}</div></div>
                    <div style="text-align:center"><span style="font-size:8px; opacity:0.6; display:block">MSG</span><input type="checkbox" class="cf-v35-checkbox cf-v34-wa-toggle" checked></div>
                </div>
                <div style="color:${c.lastBirthdayPointsYear === curY ? '#4ade80' : '#fb923c'}; font-size:9px; font-weight:900;">${c.lastBirthdayPointsYear === curY ? 'Ô£à REGALO ENVIADO' : '­ƒÄü REGALO PENDIENTE'}</div>
                <button class="cf-v35-btn-wa" data-type="birthdays" data-phone="${c.phone}" data-name="${c.name}">­ƒô▒ Enviar WhatsApp</button>
            </div>`).join('')}
        </div>`;
    };

    const renderExpirations = () => {
        if (expirations.length === 0) return '';
        return `<div style="margin-bottom:25px;">
            <div style="font-size:11px; font-weight:900; color:#f59e0b; text-transform:uppercase; margin-bottom:12px;">ÔÅ│ Vencimientos Pr├│ximos</div>
            ${expirations.map(item => {
                const bStr = item.breakdown ? item.breakdown.map(b => `${b.date}: ${b.rem} pts`).join('|') : '';
                return `<div class="cf-v35-card">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                    <div style="flex:1;">
                        <div style="font-weight:900; font-size:16px; margin-bottom:4px;">${item.name}</div>
                        <div style="font-size:11px; color:#f59e0b; font-weight:800;">ÔÜá´©Å ${item.points} pts por vencer</div>
                    </div>
                    <div style="text-align:center"><span style="font-size:8px; opacity:0.6; display:block">MSG</span><input type="checkbox" class="cf-v35-checkbox cf-v34-wa-toggle" checked></div>
                </div>
                ${item.breakdown && item.breakdown.length > 1 ? `<div style="font-size:9px; opacity:0.6; font-weight:700; background:rgba(0,0,0,0.2); padding:8px; border-radius:12px;">${item.breakdown.map(b => `ÔÇó ${b.date}: ${b.rem} pts`).join('<br>')}</div>` : ''}
                <button class="cf-v35-btn-wa" data-type="expirations" data-phone="${item.phone}" data-name="${item.name}" data-extra="${item.points}" data-breakdown="${bStr}">­ƒô▒ Enviar WhatsApp</button>
            </div>`;
            }).join('')}
        </div>`;
    };

    const renderGroup = (type, title, list, color) => {
        if (!list || list.length === 0) return '';
        return `<div style="margin-bottom:25px;"><div style="font-size:11px; font-weight:900; color:${color}; text-transform:uppercase; margin-bottom:12px;">${title}</div>
            ${list.map(item => `<div class="cf-v35-card">
                <div style="display:flex; justify-content:space-between; align-items:start; margin-bottom:12px;">
                    <div style="flex:1;"><div style="font-weight:900; font-size:16px;">${item.name}</div><div style="font-size:11px; color:${color}; font-weight:800;">­ƒÉ¥ Alimento: ${item.petName}</div></div>
                    <div style="text-align:center"><span style="font-size:8px; opacity:0.6; display:block">MSG</span><input type="checkbox" class="cf-v35-checkbox cf-v34-wa-toggle" checked></div>
                </div>
                <button class="cf-v35-btn-wa" data-type="${type}" data-phone="${item.phone}" data-name="${item.name}" data-extra="${item.petName}">­ƒô▒ Enviar WhatsApp</button>
            </div>`).join('')}
        </div>`;
    };

    render();
    document.body.appendChild(container);
}

// PANEL DE CARGA DE PUNTOS (integrado desde V35)
function detectAmount() {
    const s = ['#cpbtc_total','input[name="cpbtc_total"]','#total_pago','input[name="total_pago"]','#monto_pago','input[name="monto_pago"]','#importe_total','input[name="importe_total"]','.total-import'];
    let i = null; for (let x of s) { i = document.querySelector(x); if (i) break; }
    let v = 0;
    if (i && i.value) {
        v = parseFloat(i.value.replace(/[^0-9.,]/g, '').replace(',', '.'));
    } else {
        const bodyContent = document.body.innerText;
        const match = bodyContent.match(/Total a pagar \$:\s*([0-9.,]+)/i) ||
            bodyContent.match(/Total a pagar\s*\$?:\s*([0-9.,]+)/i) ||
            bodyContent.match(/Monto Total\s*\$?:\s*([0-9.,]+)/i);
        if (match && match[1]) v = parseFloat(match[1].replace(/[^0-9.,]/g, '').replace(',', '.'));
    }
    const panelExists = document.getElementById('fidelidad-panel');
    if (!isNaN(v) && v > 0 && (v !== detectedAmount || !panelExists)) { detectedAmount = v; showFidelidadPanel(); }
}
const o = new MutationObserver(() => detectAmount());
o.observe(document.body, { childList: true, subtree: true });
detectAmount();

function showFidelidadPanel() {
    if (document.getElementById('fidelidad-panel')) {
        const amountEl = document.querySelector('.fidelidad-amount');
        if (amountEl) amountEl.innerText = `$ ${detectedAmount.toLocaleString('es-AR')}`;
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';
    panel.innerHTML = `
        <div class="fidelidad-header">
            <h1>Sumar Puntos</h1>
            <span class="fidelidad-close" id="fidelidad-close">├ù</span>
        </div>
        <div class="fidelidad-body">
            <div class="fidelidad-amount">$ ${detectedAmount.toLocaleString('es-AR')}</div>
            <div class="fidelidad-search-container" style="position:relative;">
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Buscar por Nombre o DNI..." autocomplete="off">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>
            <div id="fidelidad-selected-info" style="display:none; margin-bottom: 10px; font-size: 13px; color: #6200ee; font-weight: bold;"></div>
            <button id="fidelidad-submit" class="fidelidad-button" disabled>SUMAR PUNTOS</button>
            <div id="fidelidad-status" style="margin-top:10px; font-size: 12px; text-align: center;"></div>
        </div>
    `;

    // Estrategia de infiltraci├│n: intentar injetarnos dentro del modal activo
    const modalSelectors = ['.modal-content', '.modal-body', '.bootbox', '.ui-dialog-content', '.sky-modal', '[role="dialog"]'];
    let injector = document.body;
    for (let sel of modalSelectors) {
        const found = document.querySelector(sel);
        if (found) { injector = found; break; }
    }
    injector.appendChild(panel);

    const searchInput = document.getElementById('fidelidad-search');
    const resultsDiv  = document.getElementById('fidelidad-results');
    const submitBtn   = document.getElementById('fidelidad-submit');
    const selectedInfo = document.getElementById('fidelidad-selected-info');
    const statusDiv   = document.getElementById('fidelidad-status');
    let selectedClient = null;

    function killEvent(e) {
        if (document.activeElement === searchInput) { e.stopPropagation(); e.stopImmediatePropagation(); }
    }
    window.addEventListener('keydown',  killEvent, true);
    window.addEventListener('keyup',    killEvent, true);
    window.addEventListener('keypress', killEvent, true);

    document.getElementById('fidelidad-close').onclick = () => {
        window.removeEventListener('keydown',  killEvent, true);
        window.removeEventListener('keyup',    killEvent, true);
        window.removeEventListener('keypress', killEvent, true);
        panel.remove();
    };

    let focusInterval;
    searchInput.onfocus = () => {
        focusInterval = setInterval(() => {
            if (document.activeElement !== searchInput && document.getElementById('fidelidad-panel')) searchInput.focus();
        }, 50);
    };
    searchInput.onblur = () => clearInterval(focusInterval);
    setTimeout(() => searchInput.focus(), 300);

    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value;
        if (q.length < 3) { resultsDiv.style.display = 'none'; return; }
        searchTimeout = setTimeout(() => searchClients(q), 500);
    };

    async function searchClients(q) {
        if (!config.apiUrl || !config.apiKey) { statusDiv.innerText = 'ÔÜá´©Å Configura la API'; return; }
        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            const data = await res.json();
            if (data.ok && data.clients.length > 0) {
                renderResults(data.clients);
            } else {
                resultsDiv.innerHTML = '<div class="fidelidad-result-item">No se encontraron clientes</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (e) { statusDiv.innerText = 'ÔØî Error de conexi├│n'; }
    }

    function renderResults(clients) {
        resultsDiv.innerHTML = clients.map(c => `
            <div class="fidelidad-result-item" data-id="${c.id}" data-name="${c.name}" data-dni="${c.dni}">
                <div>${c.name}</div>
                <div class="dni">DNI: ${c.dni} | Pts: ${c.points ?? 'ÔÇö'}</div>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';

        resultsDiv.querySelectorAll('.fidelidad-result-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                selectedClient = { id: item.dataset.id, name: item.dataset.name };
                selectedInfo.innerText = `Cliente: ${selectedClient.name}`;
                selectedInfo.style.display = 'block';
                resultsDiv.style.display = 'none';
                searchInput.value = selectedClient.name;
                submitBtn.disabled = false;
            };
        });
    }

    submitBtn.onclick = async () => {
        if (!selectedClient) return;
        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';
        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'external_integration',
                    concept: 'Compra en local',
                    applyWhatsApp: true
                })
            });
            const data = await res.json();
            if (data.ok) {
                renderSuccess(data);
            } else {
                statusDiv.innerText = `ÔØî Error: ${data.error}`;
                submitBtn.disabled = false;
                submitBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            statusDiv.innerText = 'ÔØî Error de conexi├│n';
            submitBtn.disabled = false;
        }
    };

    function renderSuccess(data) {
        const body = document.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div style="text-align: center; color: #16a34a; padding: 10px;">
                <div style="font-size: 40px;">Ô£à</div>
                <div style="font-weight: bold; font-size: 18px; margin: 5px 0;">┬íPuntos Asignados!</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 15px;">Se sumaron ${data.pointsAdded} puntos a ${selectedClient.name}.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">ENVIAR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#f3f4f6; color:#374151; margin-top:15px; border: 1px solid #d1d5db;" id="cf-final-close">CERRAR</button>
            </div>
        `;
        document.getElementById('cf-final-close').onclick = () => {
            window.removeEventListener('keydown',  killEvent, true);
            window.removeEventListener('keyup',    killEvent, true);
            window.removeEventListener('keypress', killEvent, true);
            panel.remove();
        };
        if (data.whatsappLink) window.open(data.whatsappLink, '_blank');
    }
}

