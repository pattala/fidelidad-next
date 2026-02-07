// Club Fidelidad - Integrador PRO v3
console.log("🚀 [Club Fidelidad] Integrador PRO activado");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;
let pointsMoneyBase = 100;
let pointsPerPeso = 1;
let activePromotions = [];

// Carga inicial
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    if (config.apiUrl) fetchInitData();
});

async function fetchInitData() {
    try {
        const res = await fetch(`${config.apiUrl}/api/assign-points?q=___`, {
            headers: { 'x-api-key': config.apiKey }
        });
        const data = await res.json();
        if (data.ok) {
            pointsMoneyBase = Number(data.pointsMoneyBase) || 100;
            pointsPerPeso = Number(data.pointsPerPeso) || 1;
            activePromotions = data.activePromotions || [];
            updateUI();
        }
    } catch (e) { }
}

function calculatePoints() {
    const shadow = document.getElementById('fidelidad-pro-host')?.shadowRoot;
    if (!shadow) return 0;

    let basePoints = Math.floor((detectedAmount / pointsMoneyBase) * pointsPerPeso);

    // Aplicar promos seleccionadas
    let totalBonus = 0;
    let totalMultiplier = 1;

    const checks = shadow.querySelectorAll('.promo-checkbox:checked');
    checks.forEach(chk => {
        const rid = chk.dataset.id;
        const promo = activePromotions.find(p => p.id === rid);
        if (promo) {
            if (promo.rewardType === 'FIXED') totalBonus += Number(promo.rewardValue);
            if (promo.rewardType === 'MULTIPLIER') totalMultiplier *= Number(promo.rewardValue);
        }
    });

    return Math.floor(basePoints * totalMultiplier) + totalBonus;
}

function updateUI() {
    const shadow = document.getElementById('fidelidad-pro-host')?.shadowRoot;
    if (!shadow) return;

    const ptsPreview = shadow.getElementById('pts-preview');
    if (ptsPreview) {
        ptsPreview.innerText = `Equivale a ${calculatePoints()} puntos`;
    }
}

// Detección de Monto
function detectBilling() {
    const pageText = document.body.innerText.toUpperCase();
    const hasConfirm = pageText.includes('CONFIRMAR FACTURA');
    const host = document.getElementById('fidelidad-pro-host');

    if (!hasConfirm) {
        if (host) host.remove();
        detectedAmount = 0;
        selectedClient = null;
        return;
    }

    let amount = 0;
    const all = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of all) {
        const text = el.innerText.trim();
        if (text.toUpperCase().includes('TOTAL A PAGAR $:')) {
            amount = parseVal(text);
            if (amount > 0) break;
        }
    }

    if (amount > 0 && amount !== detectedAmount) {
        detectedAmount = amount;
        if (host) {
            const inp = host.shadowRoot.getElementById('amount-input');
            if (inp) {
                inp.value = String(detectedAmount).replace('.', ',');
                updateUI();
            }
        } else {
            injectProPanel();
        }
    } else if (amount > 0 && !host) {
        injectProPanel();
    }
}

function parseVal(t) {
    let p = t.split('$');
    let s = p.length > 1 ? p[1] : p[0];
    let c = s.replace(/[^0-9,.]/g, '').trim();
    if (!c) return 0;
    if (c.includes('.') && c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
    else if (c.includes(',')) c = c.replace(',', '.');
    return parseFloat(c) || 0;
}

setInterval(detectBilling, 1000);

function injectProPanel() {
    if (document.getElementById('fidelidad-pro-host')) return;

    const host = document.createElement('div');
    host.id = 'fidelidad-pro-host';
    host.style.cssText = `
        position: fixed;
        top: 10px;
        right: 10px;
        z-index: 2147483647;
        pointer-events: auto !important;
        all: initial;
    `;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        .panel {
            width: 340px;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.4);
            font-family: 'Inter', -apple-system, sans-serif;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            user-select: none;
            display: flex;
            flex-direction: column;
            pointer-events: auto !important;
        }
        .header {
            background: #10b981;
            padding: 16px 20px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }
        .header h2 { margin: 0; font-size: 16px; font-weight: 700; }
        .close { cursor: pointer; font-size: 24px; opacity: 0.8; }
        .close:hover { opacity: 1; }

        .content { padding: 20px; overflow-y: auto; max-height: 80vh; }

        .tabs { display: flex; background: #f3f4f6; padding: 4px; border-radius: 12px; margin-bottom: 20px; }
        .tab { flex: 1; text-align: center; padding: 8px; font-size: 12px; font-weight: 600; color: #6b7280; cursor: pointer; border-radius: 10px; }
        .tab.active { background: white; color: #059669; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); }

        .label { display: block; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.025em; }
        
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #f3f4f6;
            border-radius: 12px;
            box-sizing: border-box;
            font-size: 14px;
            outline: none;
            background: #f9fafb;
            color: #111827;
            transition: all 0.2s;
            user-select: text !important;
            pointer-events: auto !important;
        }
        input:focus { border-color: #10b981; background: white; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); }

        .amount-row { text-align: center; margin-bottom: 20px; }
        .amount-input { font-size: 28px; font-weight: 800; text-align: center; color: #059669; background: #ecfdf5; border-color: #d1fae5; }
        .pts-preview { margin-top: 8px; font-size: 13px; font-weight: 700; color: #059669; }

        .promo-section { background: #f9fafb; border-radius: 16px; padding: 15px; margin-bottom: 20px; border: 1px solid #f3f4f6; }
        .promo-title { display: flex; align-items: center; gap: 8px; margin-bottom: 12px; }
        .promo-list { display: flex; flex-direction: column; gap: 10px; }
        .promo-item { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .promo-item input { width: 18px; height: 18px; cursor: pointer; }
        .promo-item span { font-size: 13px; font-weight: 500; color: #374151; }
        .promo-badge { font-size: 10px; background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: auto; }

        .search-results {
            background: white; border: 1px solid #e5e7eb; border-radius: 12px; margin-top: 4px;
            max-height: 200px; overflow-y: auto; box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
            position: absolute; width: 300px; z-index: 100;
        }
        .result-item { padding: 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
        .result-item:hover { background: #f0fdf4; }
        .result-item b { display: block; font-size: 14px; color: #111827; }
        .result-item small { font-size: 11px; color: #6b7280; }

        .whatsapp-opt { display: flex; align-items: center; gap: 10px; margin-top: 15px; padding: 10px; background: #f0fdf4; border-radius: 12px; cursor: pointer; }
        .whatsapp-opt input { width: 18px; height: 18px; }
        .whatsapp-opt span { font-size: 13px; font-weight: 600; color: #065f46; }

        .submit-btn {
            width: 100%; padding: 16px; background: #10b981; color: white; border: none;
            border-radius: 16px; font-size: 16px; font-weight: 700; cursor: pointer;
            margin-top: 20px; transition: all 0.2s; box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4);
        }
        .submit-btn:hover:not(:disabled) { transform: translateY(-1px); box-shadow: 0 20px 25px -5px rgba(16, 185, 129, 0.4); }
        .submit-btn:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }

        .status { text-align: center; margin-top: 15px; font-size: 12px; color: #6b7280; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
        <div class="header" id="fidelidad-drag">
            <h2>Sumar Puntos</h2>
            <span class="close" id="fidelidad-close">×</span>
        </div>
        <div class="content">
            <div class="tabs">
                <div class="tab active">Por Monto ($)</div>
                <div class="tab">Puntos Directos</div>
            </div>

            <div class="amount-row">
                <label class="label">Monto de la Compra ($)</label>
                <input type="text" id="amount-input" class="amount-input" value="${String(detectedAmount).replace('.', ',')}">
                <div id="pts-preview" class="pts-preview">Calculando...</div>
            </div>

            <div style="position:relative; margin-bottom: 20px;">
                <label class="label">Cliente (Nombre, DNI o Nº Socio)</label>
                <input type="text" id="search-input" placeholder="Buscar cliente..." autocomplete="off">
                <div id="results-box" class="search-results" style="display:none;"></div>
                <div id="selected-box" style="display:none; margin-top:10px; padding:10px; border:2px solid #10b981; border-radius:12px; background:#ecfdf5; text-align:center;">
                    <span id="selected-name" style="font-weight:800; color:#065f46; font-size:14px;"></span>
                </div>
            </div>

            <div class="promo-section">
                <div class="promo-title">
                    <input type="checkbox" id="promo-toggle" checked>
                    <span class="label" style="margin:0">Aplicar Promociones / Bonus</span>
                </div>
                <div class="promo-list" id="promo-list">
                    ${activePromotions.length > 0 ? activePromotions.map(p => `
                        <label class="promo-item">
                            <input type="checkbox" class="promo-checkbox" data-id="${p.id}" checked>
                            <span>${p.title}</span>
                            <span class="promo-badge">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue + ' pts'}</span>
                        </label>
                    `).join('') : '<div style="font-size:11px; color:#999; text-align:center;">No hay promociones activas hoy</div>'}
                </div>
            </div>

            <label class="whatsapp-opt">
                <input type="checkbox" id="whatsapp-notify" checked>
                <span>Notificar por WhatsApp</span>
            </label>

            <button id="submit-btn" class="submit-btn" disabled>ASIGNAR PUNTOS</button>
            <div id="status-msg" class="status"></div>
        </div>
    `;
    shadow.appendChild(panel);

    // Eventos
    const closeBtn = shadow.getElementById('fidelidad-close');
    const searchInp = shadow.getElementById('search-input');
    const amountInp = shadow.getElementById('amount-input');
    const resultsBox = shadow.getElementById('results-box');
    const submitBtn = shadow.getElementById('submit-btn');
    const statusMsg = shadow.getElementById('status-msg');
    const selectedBox = shadow.getElementById('selected-box');
    const selectedName = shadow.getElementById('selected-name');
    const whatsappCheck = shadow.getElementById('whatsapp-notify');

    closeBtn.onclick = () => host.remove();

    // INTERACTION FIX: Stop propagation to prevent site interfering
    const stopP = (e) => e.stopPropagation();
    [searchInp, amountInp, panel].forEach(el => {
        el.addEventListener('keydown', stopP, true);
        el.addEventListener('keyup', stopP, true);
        el.addEventListener('keypress', stopP, true);
        el.addEventListener('mousedown', stopP, true);
        el.addEventListener('click', stopP, true);
    });

    amountInp.oninput = (e) => {
        const val = e.target.value.replace(',', '.');
        detectedAmount = parseFloat(val) || 0;
        updateUI();
    };

    shadow.querySelectorAll('.promo-checkbox').forEach(c => c.onchange = updateUI);

    let t;
    searchInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(t);
        if (q.length < 2) {
            resultsBox.style.display = 'none';
            return;
        }
        t = setTimeout(async () => {
            if (!config.apiUrl || !config.apiKey) return;
            try {
                const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': config.apiKey }
                });
                const data = await res.json();
                if (data.ok) renderResults(data.clients);
            } catch (e) { }
        }, 300);
    };

    function renderResults(cl) {
        if (cl.length === 0) {
            resultsBox.innerHTML = '<div class="result-item"><span>Sin resultados</span></div>';
        } else {
            resultsBox.innerHTML = cl.map(c => `
                <div class="result-item" data-id="${c.id}" data-name="${c.name}">
                    <b>${c.name}</b>
                    <small>DNI: ${c.dni} ${c.socio_number ? '| Socio: #' + c.socio_number : ''}</small>
                </div>
            `).join('');
        }
        resultsBox.style.display = 'block';

        resultsBox.querySelectorAll('.result-item').forEach(it => {
            it.onclick = (e) => {
                e.stopPropagation();
                selectedClient = { id: it.dataset.id, name: it.dataset.name };
                selectedName.innerText = selectedClient.name;
                selectedBox.style.display = 'block';
                resultsBox.style.display = 'none';
                searchInp.value = selectedClient.name;
                submitBtn.disabled = false;
            };
        });
    }

    submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';
        statusMsg.innerText = 'Registrando en el sistema...';

        const bonusIds = Array.from(shadow.querySelectorAll('.promo-checkbox:checked')).map(c => c.dataset.id);

        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'external_integration',
                    concept: 'Compra en local',
                    bonusIds: bonusIds,
                    applyWhatsApp: whatsappCheck.checked
                })
            });
            const data = await res.json();
            if (data.ok) {
                renderSuccess(data);
            } else {
                statusMsg.innerText = `❌ Error: ${data.error}`;
                submitBtn.disabled = false;
                submitBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            statusMsg.innerText = '❌ Error de red';
            submitBtn.disabled = false;
        }
    };

    function renderSuccess(d) {
        shadow.querySelector('.content').innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
                <div style="font-size:50px; margin-bottom:15px;">🎉</div>
                <div style="font-weight:800; font-size:20px; color:#10b981; margin-bottom:5px;">¡Asignación Exitosa!</div>
                <div style="margin-bottom:20px; font-size:14px; color:#4b5563;">
                    Se otorgaron <b>${d.pointsAdded}</b> puntos.<br>Nuevo saldo: <b>${d.newBalance}</b>.
                </div>
                ${d.whatsappLink ? `<a href="${d.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:16px; border-radius:12px; font-weight:700; text-decoration:none; margin-bottom:10px;">ENVIAR WHATSAPP</a>` : ''}
                <button onclick="document.getElementById('fidelidad-pro-host').remove()" style="width:100%; padding:12px; background:#f3f4f6; border:none; border-radius:12px; font-weight:600; cursor:pointer;">CERRAR</button>
            </div>
        `;
    }

    // Drag
    let dr = false, ox = 0, oy = 0;
    shadow.getElementById('fidelidad-drag').onmousedown = (e) => {
        dr = true; ox = e.clientX - host.offsetLeft; oy = e.clientY - host.offsetTop;
    };
    document.addEventListener('mousemove', (e) => {
        if (!dr) return;
        host.style.left = (e.clientX - ox) + 'px';
        host.style.top = (e.clientY - oy) + 'px';
    });
    document.addEventListener('mouseup', () => dr = false);

    updateUI();
}
