// Club Fidelidad - Integrador PRO v5
console.log("🚀 [Club Fidelidad] Cargando Integrador v5 (Final Fix)...");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;
let pointsMoneyBase = 100;
let pointsPerPeso = 1;
let activePromotions = [];

// Carga de configuración
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    if (config.apiUrl) fetchInitData();
});

async function fetchInitData() {
    if (!config.apiUrl || !config.apiKey) return;
    try {
        const res = await fetch(`${config.apiUrl}/api/assign-points?q=___`, {
            method: 'GET',
            headers: { 'x-api-key': config.apiKey }
        });
        const data = await res.json();
        if (data.ok) {
            pointsMoneyBase = Number(data.pointsMoneyBase) || 100;
            pointsPerPeso = Number(data.pointsPerPeso) || 1;
            activePromotions = data.activePromotions || [];
            console.log("📊 [Club Fidelidad] Datos cargados con éxito");
            updateUI();
        }
    } catch (e) {
        console.error("❌ [Club Fidelidad] Error al conectar API:", e);
    }
}

function calculatePoints() {
    const host = document.getElementById('fidelidad-pro-host');
    const shadow = host?.shadowRoot;
    if (!shadow) return 0;

    let basePoints = Math.floor((detectedAmount / pointsMoneyBase) * pointsPerPeso);
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
    const host = document.getElementById('fidelidad-pro-host');
    const shadow = host?.shadowRoot;
    if (!shadow) return;

    const ptsPreview = shadow.getElementById('pts-preview');
    if (ptsPreview) {
        ptsPreview.innerText = `Equivale a ${calculatePoints()} puntos`;
    }
}

// Detector de Factura
function detectBilling() {
    const pageText = document.body.innerText.toUpperCase();
    const hasTotal = pageText.includes('TOTAL A PAGAR');
    const host = document.getElementById('fidelidad-pro-host');

    if (!hasTotal) {
        if (host) host.remove();
        detectedAmount = 0;
        selectedClient = null;
        return;
    }

    let amount = 0;
    const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of candidates) {
        const text = el.innerText.trim();
        if (text.toUpperCase().includes('TOTAL A PAGAR $:')) {
            amount = parseAmount(text);
            if (amount > 0) break;
        }
    }

    if (amount > 0 && Math.abs(amount - detectedAmount) > 0.01) {
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

function parseAmount(t) {
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
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        width: 320px;
        pointer-events: auto !important;
        all: initial;
    `;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host {
            pointer-events: auto !important;
        }
        .panel {
            width: 320px;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0, 0, 0, 0.4);
            font-family: 'Segoe UI', system-ui, sans-serif;
            overflow: hidden;
            border: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
            pointer-events: auto !important;
            user-select: auto !important;
        }
        .header {
            background: #10b981;
            padding: 14px 18px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            pointer-events: auto !important;
        }
        .header h2 { margin: 0; font-size: 15px; font-weight: 700; color: white !important; }
        .close { cursor: pointer; font-size: 20px; font-weight: bold; }

        .content { 
            padding: 18px; 
            pointer-events: auto !important;
            background: white;
        }

        .label { display: block; font-size: 10px; font-weight: 800; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }
        
        input {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #f3f4f6;
            border-radius: 10px;
            box-sizing: border-box;
            font-size: 14px;
            outline: none;
            background: #f9fafb;
            color: #111827;
            display: block;
            margin-bottom: 12px;
            pointer-events: auto !important;
            user-select: text !important;
        }
        input:focus { border-color: #10b981; background: white; }

        .amount-input { font-size: 22px; font-weight: 800; text-align: center; color: #059669; }
        .pts-preview { margin-top: -6px; margin-bottom: 15px; font-size: 12px; font-weight: 700; color: #059669; text-align: center; }

        .promo-list {
            background: #f9fafb; border-radius: 12px; padding: 12px; border: 1px solid #f3f4f6; margin-bottom: 15px;
        }
        .promo-item { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px; color: #374151; pointer-events: auto !important; cursor: pointer; }
        .promo-item:last-child { margin-bottom: 0; }
        .promo-item input { width: 16px; height: 16px; margin: 0; pointer-events: auto !important; cursor: pointer; }
        .promo-badge { font-size: 9px; background: #d1fae5; color: #065f46; padding: 2px 6px; border-radius: 4px; font-weight: 700; margin-left: auto; }

        .results {
            background: white; border: 1px solid #e5e7eb; border-radius: 10px;
            max-height: 150px; overflow-y: auto; position: absolute; width: calc(100% - 36px); z-index: 100;
            box-shadow: 0 10px 15px -3px rgba(0, 0, 0, 0.1);
        }
        .result-item { padding: 10px; border-bottom: 1px solid #f3f4f6; cursor: pointer; pointer-events: auto !important; }
        .result-item:hover { background: #f0fdf4; }
        .result-item b { display: block; font-size: 13px; color: #111827; }
        .result-item small { font-size: 10px; color: #6b7280; }

        .submit-btn {
            width: 100%; padding: 14px; background: #10b981; color: white; border: none;
            border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer;
            transition: all 0.2s; pointer-events: auto !important;
        }
        .submit-btn:disabled { background: #d1d5db; cursor: not-allowed; }

        .whatsapp-opt { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 13px; font-weight: 600; color: #059669; cursor: pointer; pointer-events: auto !important; }
        .whatsapp-opt input { width: 16px; height: 16px; }

        .status { text-align: center; margin-top: 10px; font-size: 11px; color: #6b7280; }
        
        /* Ocultar scroll si no es necesario */
        .content::-webkit-scrollbar { width: 4px; }
        .content::-webkit-scrollbar-thumb { background: #e5e7eb; border-radius: 10px; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
        <div class="header" id="drag-zone">
            <h2>Sumar Puntos</h2>
            <div class="close" id="p-close">✕</div>
        </div>
        <div class="content">
            <label class="label">Total Venta ($)</label>
            <input type="text" id="amount-input" class="amount-input" value="${String(detectedAmount).replace('.', ',')}">
            <div id="pts-preview" class="pts-preview">Calculando...</div>

            <label class="label">Buscar Cliente</label>
            <input type="text" id="search-input" placeholder="Nombre o DNI..." autocomplete="off">
            <div id="results-list" class="results" style="display:none;"></div>
            <div id="selected-info" style="display:none; margin-top:-10px; margin-bottom:12px; padding:8px; background:#f0fdf4; border:1px solid #10b981; border-radius:10px; text-align:center; font-weight:700; color:#065f46; font-size:12px;"></div>

            <div class="promo-list">
                <div style="font-size:9px; font-weight:800; color:#9ca3af; margin-bottom:8px; text-transform:uppercase;">Promociones Hoy</div>
                <div id="promo-container">
                    ${activePromotions.map(p => `
                        <label class="promo-item">
                            <input type="checkbox" class="promo-checkbox" data-id="${p.id}" checked>
                            <span>${p.title}</span>
                            <span class="promo-badge">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue}</span>
                        </label>
                    `).join('') || '<div style="font-size:11px; color:#999; text-align:center;">No hay promociones</div>'}
                </div>
            </div>

            <label class="whatsapp-opt">
                <input type="checkbox" id="w-notify" checked>
                <span>Enviar Notificación WhatsApp</span>
            </label>

            <button id="s-btn" class="submit-btn" disabled>OTORGAR PUNTOS</button>
            <div id="status-txt" class="status"></div>
        </div>
    `;
    shadow.appendChild(panel);

    // Seleccionar elementos
    const closeBtn = shadow.getElementById('p-close');
    const searchInp = shadow.getElementById('search-input');
    const amountInp = shadow.getElementById('amount-input');
    const resultsList = shadow.getElementById('results-list');
    const submitBtn = shadow.getElementById('s-btn');
    const statusTxt = shadow.getElementById('status-txt');
    const selectedInfo = shadow.getElementById('selected-info');
    const wCheck = shadow.getElementById('w-notify');

    closeBtn.onclick = () => host.remove();

    // INTERACTION FIX (The Nuclear Option)
    // We stop propagation for ALL relevant mouse and keyboard events
    // This prevents the host site from seeing anything we do inside the panel.
    ['click', 'mousedown', 'mouseup', 'keydown', 'keyup', 'keypress', 'touchstart', 'touchend'].forEach(evt => {
        panel.addEventListener(evt, (e) => {
            e.stopPropagation();
        }, { capture: true });
    });

    amountInp.oninput = (e) => {
        detectedAmount = parseFloat(e.target.value.replace(',', '.')) || 0;
        updateUI();
    };

    shadow.querySelectorAll('.promo-checkbox').forEach(c => c.onchange = updateUI);

    let deb;
    searchInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(deb);
        if (q.length < 2) {
            resultsList.style.display = 'none';
            return;
        }
        deb = setTimeout(async () => {
            if (!config.apiUrl) return;
            try {
                const r = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': config.apiKey }
                });
                const d = await r.json();
                if (d.ok) {
                    // Update rules if they come in the search (fallback)
                    if (d.pointsMoneyBase) pointsMoneyBase = d.pointsMoneyBase;
                    if (d.pointsPerPeso) pointsPerPeso = d.pointsPerPeso;

                    renderSearch(d.clients);
                }
            } catch (e) { }
        }, 300);
    };

    function renderSearch(cls) {
        if (!cls.length) {
            resultsList.innerHTML = '<div class="result-item"><span>Sin resultados</span></div>';
        } else {
            resultsList.innerHTML = cls.map(c => `
                <div class="result-item" data-id="${c.id}" data-name="${c.name}">
                    <b>${c.name}</b>
                    <small>DNI: ${c.dni} ${c.socio_number ? '| Socio: #' + c.socio_number : ''}</small>
                </div>
            `).join('');
        }
        resultsList.style.display = 'block';

        resultsList.querySelectorAll('.result-item').forEach(it => {
            it.onmousedown = (e) => { // Use mousedown to trigger before search input focus changes
                e.stopPropagation();
                selectedClient = { id: it.dataset.id, name: it.dataset.name };
                selectedInfo.innerText = `Beneficiario: ${selectedClient.name}`;
                selectedInfo.style.display = 'block';
                resultsList.style.display = 'none';
                searchInp.value = selectedClient.name;
                submitBtn.disabled = false;
            };
        });
    }

    submitBtn.onclick = async () => {
        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';
        statusTxt.innerText = 'Guardando puntos...';

        const bonusIds = Array.from(shadow.querySelectorAll('.promo-checkbox:checked')).map(c => c.dataset.id);

        try {
            const r = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'external_integration',
                    concept: 'Venta local',
                    bonusIds: bonusIds,
                    applyWhatsApp: wCheck.checked
                })
            });
            const d = await r.json();
            if (d.ok) {
                renderFinal(d);
            } else {
                statusTxt.innerText = `❌ Error: ${d.error}`;
                submitBtn.disabled = false;
                submitBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            statusTxt.innerText = '❌ Error de red';
            submitBtn.disabled = false;
        }
    };

    function renderFinal(d) {
        shadow.querySelector('.content').innerHTML = `
            <div style="text-align:center; padding: 10px 0;">
                <div style="font-size:40px; margin-bottom:15px;">🏁</div>
                <div style="font-weight:800; font-size:18px; color:#10b981; margin-bottom:5px;">¡Puntos Otorgaods!</div>
                <div style="margin-bottom:20px; font-size:13px; color:#4b5563;">
                    Se asignaron <b>${d.pointsAdded}</b> puntos.
                </div>
                ${d.whatsappLink ? `<a href="${d.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:15px; border-radius:12px; font-weight:700; text-decoration:none; margin-bottom:10px;">NOTIFICAR WHATSAPP</a>` : ''}
                <button onclick="document.getElementById('fidelidad-pro-host').remove()" style="width:100%; padding:12px; background:#f3f4f6; border:none; border-radius:12px; font-weight:700; cursor:pointer; color:#4b5563;">CERRAR</button>
            </div>
        `;
    }

    // DRAG LOGIC (Simplified and Corrected)
    const dragZone = shadow.getElementById('drag-zone');
    let isDragging = false;
    let startX, startY, initialLeft, initialTop;

    dragZone.addEventListener('mousedown', (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialLeft = host.offsetLeft;
        initialTop = host.offsetTop;
        dragZone.style.cursor = 'grabbing';
        e.preventDefault();
        e.stopPropagation();
    }, true);

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        host.style.left = (initialLeft + dx) + 'px';
        host.style.top = (initialTop + dy) + 'px';
        host.style.right = 'auto'; // Disable fixed right
    }, true);

    document.addEventListener('mouseup', () => {
        if (isDragging) {
            isDragging = false;
            dragZone.style.cursor = 'move';
        }
    }, true);

    updateUI();
}
