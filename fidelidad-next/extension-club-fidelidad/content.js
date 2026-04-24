// Club Fidelidad - Content Script (VERSIÓN EMPLEADO PRO - DRAG & STATUS FIX)
console.log("🚀 [Club Fidelidad] V32: Iniciando script con interfaz para empleados y fix de WhatsApp.");

let config = { apiUrl: '', apiKey: '' };
let apiRatios = { base: 100, perPeso: 1, discountK: 0 };
let detectedAmount = 0;
let detectedDiscounts = 0;
let selectedClient = null;
let currentPromos = [];
let enablePetModule = false;

// Cargar configuración de storage
chrome.storage.local.get(['appName', 'apiUrl', 'apiKey'], (res) => {
    config = res;
    if (res.apiUrl && res.apiKey) {
        console.log("🔍 [Club Fidelidad] Consultando pendientes a servidor...");
        // Trigger Campaign Engine
        fetch(`${res.apiUrl}/api/engine-campaigns?trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': res.apiKey }
        }).catch(e => console.error("❌ [Club Fidelidad] Error en trigger campañas:", e.message));

        fetch(`${res.apiUrl}/api/engine-daily?mode=daily&trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': res.apiKey }
        }).then(r => r.json())
        .then(data => {
            if (data?.ok) {
                const total = (data.birthdays?.totalToday || 0) + 
                              (data.expirations?.totalInWindow || 0) + 
                              (data.petAlerts?.results?.notified || 0);
                if (total > 0) showGlobalAlert(data, res.apiUrl);
            }
        }).catch(e => console.error("❌ [Club Fidelidad] Error en check diario:", e.message));
    }
});

function showGlobalAlert(fullData, adminUrl) {
    const birthdays = fullData.birthdays?.list || [];
    const expirations = fullData.expirations?.list || [];
    const petAlerts = fullData.petAlerts?.list || [];
    const total = birthdays.length + expirations.length + petAlerts.length;

    if (total === 0) {
        const w = document.getElementById('cf-v32-bubble');
        if (w) w.remove();
        return;
    }

    let container = document.getElementById('cf-v32-bubble');
    if (container) container.remove();
    
    container = document.createElement('div');
    container.id = 'cf-v32-bubble';
    container.style.cssText = `position:fixed; bottom:30px; right:30px; z-index:2147483647; pointer-events:none; transition: opacity 0.3s;`;

    let isExpanded = false;
    let pos = { x: 0, y: 0 };
    let dragStart = { x: 0, y: 0 };
    let isDragging = false;

    if (!document.getElementById('cf-v32-styles')) {
        const style = document.createElement('style');
        style.id = 'cf-v32-styles';
        style.textContent = `
            .cf-v32-glass {
                background: rgba(15, 10, 40, 0.96); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px);
                border: 1px solid rgba(255, 255, 255, 0.15); border-radius: 34px;
                box-shadow: 0 40px 80px rgba(0, 0, 0, 0.7); color: white;
                font-family: 'Segoe UI', system-ui, sans-serif; pointer-events: auto;
            }
            .cf-v32-bubble {
                width: 74px; height: 74px; background: linear-gradient(135deg, #6366f1, #a855f7);
                border-radius: 50%; display: flex; align-items:center; justify-content:center;
                cursor: grab; border: 4px solid white; box-shadow: 0 15px 40px rgba(99, 102, 241, 0.5);
                transition: transform 0.2s; animation: cf-v32-float 4s infinite ease-in-out; pointer-events: auto;
            }
            .cf-v32-panel { width: 360px; max-height: 560px; display: flex; flex-direction: column; overflow: hidden; animation: cf-v32-pop 0.3s cubic-bezier(0,1,0.2,1); }
            .cf-v32-card { background: rgba(255,255,255,0.06); border-radius: 26px; padding: 20px; margin-bottom: 15px; border: 1px solid rgba(255,255,255,0.1); }
            .cf-v32-badge { font-size: 9px; font-weight: 900; padding: 5px 12px; border-radius: 12px; text-transform: uppercase; letter-spacing: 0.8px; border: 1px solid currentColor; }
            .cf-v32-btn-wa {
                background: linear-gradient(135deg, #25D366, #128C7E); color: white; border: none;
                border-radius: 16px; padding: 14px; font-weight: 900; font-size: 11px;
                text-transform: uppercase; cursor: pointer; width: 100%; margin-top: 15px;
                display: flex; align-items: center; justify-content: center; gap: 8px;
                box-shadow: 0 10px 20px rgba(18, 140, 126, 0.3);
            }
            .cf-v32-btn-wa:hover { filter: brightness(1.15); transform: translateY(-1px); }
            @keyframes cf-v32-float { 0%,100% {transform:translateY(0)} 50% {transform:translateY(-12px)} }
            @keyframes cf-v32-pop { from {opacity:0; transform:scale(0.8) translateY(40px)} to {opacity:1; transform:scale(1) translateY(0)} }
            .cf-v32-scrollbar::-webkit-scrollbar { width: 4px; }
            .cf-v32-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        `;
        document.head.appendChild(style);
    }

    const generateWhatsAppToken = (type, phone, name, extra, cfg) => {
        if (!phone) return null;
        let p = phone.replace(/\D/g, '');
        if (!p.startsWith('54') && p.length === 10) p = '549' + p;
        const templates = cfg?.messaging?.templates || {};
        const firstName = name.split(' ')[0];
        let msg = "";
        if (type === 'birthdays') {
            const points = cfg?.birthdayPoints || 100;
            if (cfg?.enableBirthdayBonus !== false) {
                msg = (templates.birthday || "¡Feliz cumpleaños, {nombre}! 🎂🎉 Te regalamos {puntos} puntos para que los disfrutes. ¡Que pases un gran día! ✨")
                        .replace(/{puntos}/g, points.toString());
            } else { 
                msg = templates.birthdaySimple || "¡Feliz cumpleaños, {nombre}! 🎂🎉 Esperamos que pases un día increíble. ✨"; 
            }
        } else if (type === 'expirations') {
            msg = (templates.expirationWarning || "¡Hola {nombre}! 📢 Tienes {puntos} puntos por vencer. ⏳").replace(/{puntos}/g, extra);
        } else if (type === 'petAlerts') {
            msg = (templates.petFoodAlert || "¡Hola {nombre}! 🐾 Vemos que el alimento de {mascota} está por terminarse.").replace(/{mascota}/g, extra);
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
            ui.className = 'cf-v32-glass cf-v32-panel';
            ui.innerHTML = `
                <div style="padding:22px; cursor:grab; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between; align-items:center;" id="cf-v32-drag">
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size:26px;">⭐</span>
                        <div>
                            <div style="font-weight:900; font-size:12px; text-transform:uppercase; color:#d1d5db;">Avisos Smart</div>
                            <div style="font-size:9px; opacity:0.5; font-weight:700; letter-spacing:0.5px;">Panel para Empleados</div>
                        </div>
                    </div>
                    <button id="cf-v32-close" style="background:none; border:none; color:white; font-size:28px; cursor:pointer; opacity:0.3; line-height:1;">×</button>
                </div>
                <div style="padding:24px; overflow-y:auto; flex:1;" class="cf-v32-scrollbar">
                    ${renderBirthdays()}
                    ${renderGroup('expirations', '⏳ Puntos por Vencer', expirations, '#f59e0b')}
                    ${renderGroup('petAlerts', '🐾 Mascotas / Alimento', petAlerts, '#6366f1')}
                </div>
                <div style="padding:15px; text-align:center; background:rgba(0,0,0,0.2);">
                    <a href="${adminUrl}/admin/dashboard" target="_blank" style="color:rgba(255,255,255,0.4); font-size:9px; font-weight:900; text-decoration:none; text-transform:uppercase; letter-spacing:1px;">Gestionar en Panel Administrador</a>
                </div>
            `;
            const d = ui.querySelector('#cf-v32-drag');
            d.onmousedown = (e) => {
                isDragging = true; dragStart.x = e.clientX - pos.x; dragStart.y = e.clientY - pos.y;
                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', mouseUp);
            };
            ui.querySelector('#cf-v32-close').onclick = () => { isExpanded = false; render(); };
            ui.querySelectorAll('.cf-v32-btn-wa').forEach(b => {
                b.onclick = () => {
                    const url = generateWhatsAppToken(b.dataset.type, b.dataset.phone, b.dataset.name, b.dataset.extra, fullData.config);
                    if (url) window.open(url, '_blank');
                };
            });
        } else {
            ui.className = 'cf-v32-bubble';
            ui.innerHTML = `<span style="font-size:34px;">🔔</span><div style="position:absolute; top:-4px; right:-4px; background:#ef4444; color:white; font-size:11px; font-weight:900; width:26px; height:26px; border-radius:50%; display:flex; align-items:center; justify-content:center; border:2.5px solid white; box-shadow:0 8px 20px rgba(239, 68, 68, 0.4);">${total}</div>`;
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
        const currentYear = new Date().getFullYear().toString();
        return `
            <div style="margin-bottom:25px;">
                <div style="font-size:10px; font-weight:900; color:#ec4899; text-transform:uppercase; margin-bottom:12px; letter-spacing:1.2px; opacity:0.8;">🎂 Cumpleaños Hoy</div>
                ${birthdays.map(c => {
                    const gifted = c.lastBirthdayPointsYear === currentYear;
                    const greeted = c.lastBirthdayGreetingYear === currentYear;
                    return `
                        <div class="cf-v32-card">
                            <div style="margin-bottom:12px;">
                                <div style="font-weight:900; font-size:15px; color:white; margin-bottom:2px;">${c.name}</div>
                                <div style="font-size:10px; opacity:0.5; font-weight:700;">DNI: ${c.dni || 'S/D'} | Socio: ${c.socioNumber || 'N/A'}</div>
                            </div>
                            <div style="display:flex; flex-wrap:wrap; gap:6px; margin-bottom:15px;">
                                <span class="cf-v32-badge" style="color:${gifted ? '#4ade80' : '#fb923c'};">${gifted ? 'REGALO: ENVIADO ✅' : 'REGALO: PENDIENTE 🎁'}</span>
                                ${greeted ? `<span class="cf-v32-badge" style="color:#60a5fa;">MENSAJE AUTO: OK ✉️</span>` : ''}
                            </div>
                            <button class="cf-v32-btn-wa" data-type="birthdays" data-phone="${c.phone}" data-name="${c.name}">
                                <span>📱 Enviar WhatsApp</span>
                            </button>
                        </div>
                    `;
                }).join('')}
            </div>
        `;
    };

    const renderGroup = (type, title, list, color) => {
        if (!list || list.length === 0) return '';
        return `
            <div style="margin-bottom:25px;">
                <div style="font-size:10px; font-weight:900; color:${color}; text-transform:uppercase; margin-bottom:12px; letter-spacing:1.2px; opacity:0.8;">${title}</div>
                ${list.map(item => `
                    <div class="cf-v32-card">
                        <div style="font-weight:900; font-size:15px; color:white; margin-bottom:4px;">${item.name}</div>
                        <div style="font-size:10px; color:${color}; font-weight:800; margin-bottom:12px; opacity:0.9;">
                             ${type === 'expirations' ? `⚠️ ${item.points} puntos próximos a vencer` : `🐾 Alimento de ${item.petName}`}
                        </div>
                        <button class="cf-v32-btn-wa" data-type="${type}" data-phone="${item.phone}" data-name="${item.name}" data-extra="${type === 'expirations' ? item.points : item.petName}">
                            <span>📱 Enviar WhatsApp</span>
                        </button>
                    </div>
                `).join('')}
            </div>
        `;
    };

    render();
    document.body.appendChild(container);
}

// RESTO DE LÓGICA DE LA EXTENSIÓN (DETECCIÓN DE MONTOS, etc.)
async function refreshAlertCounts() {
    if (!config.apiUrl || !config.apiKey) return;
    const url = `${config.apiUrl}/api/engine-daily?mode=daily&trigger=extension`;
    chrome.runtime.sendMessage({ action: "fetchAlerts", url, apiKey: config.apiKey }, (res) => {
        if (res?.success) {
            if (res.data.config) config.serverConfig = res.data.config;
            showGlobalAlert(res.data, config.apiUrl);
        }
    });
}
window.addEventListener('focus', () => { refreshAlertCounts(); setTimeout(detectAmount, 500); });

function detectAmount() {
    const selectors = ['#cpbtc_total','input[name="cpbtc_total"]','#total_pago','input[name="total_pago"]','#monto_pago','input[name="monto_pago"]','#importe_total','input[name="importe_total"]','.total-import'];
    let input = null;
    for (let s of selectors) { input = document.querySelector(s); if (input) break; }
    let val = 0;
    if (input && input.value) val = parseFloat(input.value.replace(/[^0-9.,]/g, '').replace(',', '.'));
    else {
        const bt = document.body.innerText;
        const m = bt.match(/Total a pagar \$:\s*([0-9.,]+)/i) || bt.match(/Total a pagar\s*\$?:\s*([0-9.,]+)/i) || bt.match(/Monto Total\s*\$?:\s*([0-9.,]+)/i);
        if (m) val = parseFloat(m[1].replace(/[^0-9.,]/g, '').replace(',', '.'));
    }
    let discountSum = 0;
    try {
        document.querySelectorAll('table tbody tr').forEach(row => {
            const cells = row.querySelectorAll('td');
            if (cells.length >= 6) {
                const rt = row.innerText.toUpperCase();
                const tt = cells[5].innerText.trim();
                if (tt.startsWith('-') || tt.includes('(') || rt.includes('DESCUENTO') || rt.includes('PROMO') || rt.includes('COMBO')) {
                    const n = Math.abs(parseFloat(tt.replace(/[^0-9.,-]/g, '').replace(',', '.')));
                    if (!isNaN(n)) discountSum += n;
                }
            }
        });
    } catch(e) {}
    detectedDiscounts = discountSum;
    if (!isNaN(val) && val > 0) {
        if (val !== detectedAmount || !document.getElementById('fidelidad-panel')) {
            detectedAmount = val;
            showFidelidadPanel();
        }
    }
}
const observer = new MutationObserver(() => detectAmount());
observer.observe(document.body, { childList: true, subtree: true });
detectAmount();

function showFidelidadPanel() {
    if (document.getElementById('fidelidad-panel')) {
        const ae = document.getElementById('cf-display-amount');
        if (ae) ae.innerHTML = `$ ${detectedAmount.toLocaleString('es-AR')} ${detectedDiscounts > 0 ? `<span style="color:#ef4444">(-$${detectedDiscounts})</span>` : ''}`;
        return;
    }
    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';
    panel.innerHTML = `
        <div class="fidelidad-header">
            <div><h1 id="cf-main-title">Sumar Puntos</h1><span id="cf-client-name-header" style="font-size:10px">Seleccione un cliente</span></div>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Buscar Socio (DNI o Nombre)...">
            <div id="fidelidad-results" class="fidelidad-results" style="display:none"></div>
            <div id="cf-tabs-container" class="cf-tabs" style="display:none;margin-top:15px"><button class="cf-tab active" data-tab="sumar">Sumar</button><button class="cf-tab" data-tab="canjes">Canjear</button></div>
            <div id="cf-tab-content-sumar" class="cf-tab-content" style="display:none">
                <div class="cf-field"><label class="cf-label">Monto ($)</label><input type="number" id="cf-input-amount" class="fidelidad-input" value="${detectedAmount - detectedDiscounts}"></div>
                <div id="cf-display-amount" style="font-size:11px;color:#666">$ ${detectedAmount}</div>
                <button id="fidelidad-submit" class="fidelidad-button">Asignar Puntos</button>
            </div>
            <div id="cf-tab-content-canjes" style="display:none"><div id="cf-prizes-list" style="display:grid;grid-template-columns:1fr 1fr;gap:10px"></div></div>
            <div id="fidelidad-status" style="margin-top:10px;font-size:12px;text-align:center"></div>
        </div>
    `;
    document.body.appendChild(panel);
    panel.querySelector('#fidelidad-close').onclick = () => panel.remove();
    
    const si = panel.querySelector('#fidelidad-search');
    si.oninput = () => {
        const q = si.value;
        if(q.length<2) return;
        fetch(`${config.apiUrl}/api/assign-points?q=${q}`, { headers: {'x-api-key': config.apiKey} })
        .then(r => r.json()).then(data => {
            if(data.ok) renderResults(data.clients, panel);
        });
    };
}

function renderResults(clients, panel) {
    const rd = panel.querySelector('#fidelidad-results');
    rd.innerHTML = '';
    clients.forEach(c => {
        const div = document.createElement('div');
        div.className = 'fidelidad-result-item';
        div.innerText = c.name;
        div.onclick = () => {
            selectedClient = c;
            panel.querySelector('#cf-client-name-header').innerText = c.name;
            panel.querySelector('#cf-tabs-container').style.display = 'flex';
            panel.querySelector('#cf-tab-content-sumar').style.display = 'block';
            rd.style.display = 'none';
        };
        rd.appendChild(div);
    });
    rd.style.display = 'block';
}

function generateWhatsApp(type, phone, name, extra, cfg) {
    if (!phone) return null;
    let p = phone.replace(/\D/g, '');
    if (!p.startsWith('54') && p.length === 10) p = '549' + p;
    const firstName = name.split(' ')[0];
    const templates = cfg?.messaging?.templates || {};
    let msg = "";
    if (type==='birthdays') msg = "¡Feliz cumple {nombre}!";
    else if (type==='expirations') msg = "¡Hola {nombre}! Tus {puntos} puntos vencen pronto.";
    msg = msg.replace('{nombre}', firstName).replace('{puntos}', extra);
    return `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`;
}
