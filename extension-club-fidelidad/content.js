// Club Fidelidad - Integrador PRO v6 (The "Visible" Fix)
console.log("🚀 [Club Fidelidad] v6 iniciando...");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;
let pointsMoneyBase = 100;
let pointsPerPeso = 1;
let activePromotions = [];

// Carga de configuración
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    console.log("📦 [Club Fidelidad] Configuración cargada");
    if (config.apiUrl) fetchInitData();
});

async function fetchInitData() {
    if (!config.apiUrl || !config.apiKey) return;
    try {
        console.log("📡 [Club Fidelidad] Intentando conectar con API...");
        const res = await fetch(`${config.apiUrl}/api/assign-points?q=___`, {
            method: 'GET',
            headers: { 'x-api-key': config.apiKey }
        });
        const data = await res.json();
        if (data.ok) {
            pointsMoneyBase = Number(data.pointsMoneyBase) || 100;
            pointsPerPeso = Number(data.pointsPerPeso) || 1;
            activePromotions = data.activePromotions || [];
            console.log("✅ [Club Fidelidad] Datos de promociones cargados");
            updateUI();
        }
    } catch (e) {
        console.error("❌ [Club Fidelidad] Error API:", e);
    }
}

function calculatePoints() {
    let basePoints = Math.floor((detectedAmount / pointsMoneyBase) * pointsPerPeso);
    let totalBonus = 0;
    let totalMultiplier = 1;

    const host = document.getElementById('fidelidad-pro-host');
    if (host?.shadowRoot) {
        const checks = host.shadowRoot.querySelectorAll('.promo-checkbox:checked');
        checks.forEach(chk => {
            const promo = activePromotions.find(p => p.id === chk.dataset.id);
            if (promo) {
                if (promo.rewardType === 'FIXED') totalBonus += Number(promo.rewardValue);
                if (promo.rewardType === 'MULTIPLIER') totalMultiplier *= Number(promo.rewardValue);
            }
        });
    }
    return Math.floor(basePoints * totalMultiplier) + totalBonus;
}

function updateUI() {
    const host = document.getElementById('fidelidad-pro-host');
    if (host?.shadowRoot) {
        const ptsEl = host.shadowRoot.getElementById('pts-preview');
        if (ptsEl) ptsEl.innerText = `Equivale a ${calculatePoints()} puntos`;

        // Render promos if they were empty before
        const promoContainer = host.shadowRoot.getElementById('promo-container');
        if (promoContainer && activePromotions.length > 0 && promoContainer.innerHTML.includes('No hay promociones')) {
            renderPromosInContainer(promoContainer);
        }
    }
}

function renderPromosInContainer(container) {
    container.innerHTML = activePromotions.map(p => `
        <label class="promo-item">
            <input type="checkbox" class="promo-checkbox" data-id="${p.id}" checked>
            <span>${p.title}</span>
            <span class="promo-badge">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue}</span>
        </label>
    `).join('');
    container.querySelectorAll('.promo-checkbox').forEach(c => c.onchange = updateUI);
}

// Detector Mejorado
function detectBilling() {
    const pageText = document.body.innerText.toUpperCase();
    const hasTotal = pageText.includes('TOTAL A PAGAR') || pageText.includes('CONFIRMAR FACTURA');
    const host = document.getElementById('fidelidad-pro-host');

    if (!hasTotal) {
        if (host) {
            console.log("👋 [Club Fidelidad] Removiendo panel (fuera de pantalla)");
            host.remove();
        }
        detectedAmount = 0;
        return;
    }

    // Buscar monto
    let amount = 0;
    const items = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of items) {
        const text = el.innerText.trim();
        if (text.toUpperCase().includes('TOTAL A PAGAR $:')) {
            amount = parseAmount(text);
            if (amount > 0) break;
        }
    }

    if (amount > 0) {
        if (Math.abs(amount - detectedAmount) > 0.1) {
            console.log("💰 [Club Fidelidad] Nuevo monto:", amount);
            detectedAmount = amount;
            if (host) {
                const inp = host.shadowRoot.getElementById('amount-input');
                if (inp) inp.value = String(detectedAmount).replace('.', ',');
                updateUI();
            }
        }

        if (!host) {
            console.log("✨ [Club Fidelidad] Inyectando panel...");
            injectProPanel();
        }
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
    // Estilos de alto impacto para visibilidad
    host.style.cssText = `
        position: fixed !important;
        top: 30px !important;
        right: 30px !important;
        z-index: 2147483647 !important;
        width: 320px !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        all: initial;
    `;
    document.documentElement.appendChild(host); // Root level

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        :host { pointer-events: auto !important; }
        .panel {
            width: 320px;
            background: #ffffff;
            border-radius: 18px;
            box-shadow: 0 30px 60px -12px rgba(0,0,0,0.4), 0 0 0 1px rgba(0,0,0,0.05);
            font-family: 'Inter', -apple-system, system-ui, sans-serif;
            overflow: hidden;
            border: 2px solid #10b981;
            display: flex;
            flex-direction: column;
            pointer-events: auto !important;
        }
        .header {
            background: #10b981;
            padding: 16px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            font-weight: 800;
        }
        .header h2 { margin: 0; font-size: 14px; text-transform: uppercase; letter-spacing: 0.5px; color: white !important; }
        .close { cursor: pointer; font-size: 18px; background: rgba(0,0,0,0.1); width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; border-radius: 50%; }

        .content { padding: 20px; background: white; }

        label.top-label { display: block; font-size: 10px; font-weight: 900; color: #9ca3af; text-transform: uppercase; margin-bottom: 6px; }
        
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
            margin-bottom: 15px;
            user-select: text !important;
        }
        input:focus { border-color: #10b981; background: white; }

        .amount-display { font-size: 24px; font-weight: 900; text-align: center; color: #059669; }
        .pts-preview { margin-top: -8px; margin-bottom: 15px; font-size: 13px; font-weight: 800; color: #059669; text-align: center; background: #ecfdf5; padding: 4px; border-radius: 6px; }

        .promo-list { background: #f9fafb; border-radius: 14px; padding: 12px; border: 1px solid #f3f4f6; margin-bottom: 15px; }
        .promo-item { display: flex; align-items: center; gap: 10px; font-size: 12px; margin-bottom: 8px; color: #374151; cursor: pointer; }
        .promo-item:last-child { margin-bottom: 0; }
        .promo-item input { width: 16px; height: 16px; margin: 0; cursor: pointer; }
        .promo-badge { font-size: 9px; background: #10b981; color: white; padding: 2px 6px; border-radius: 4px; font-weight: 900; margin-left: auto; }

        .results {
            background: white; border: 1px solid #e5e7eb; border-radius: 12px;
            max-height: 160px; overflow-y: auto; position: absolute; width: calc(100% - 40px); z-index: 100;
            box-shadow: 0 10px 25px rgba(0,0,0,0.1);
        }
        .result-item { padding: 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
        .result-item:hover { background: #f0fdf4; }
        .result-item b { display: block; font-size: 14px; color: #111827; }

        .btn-submit {
            width: 100%; padding: 16px; background: #10b981; color: white; border: none;
            border-radius: 14px; font-size: 15px; font-weight: 800; cursor: pointer;
            box-shadow: 0 10px 15px -3px rgba(16, 185, 129, 0.4);
        }
        .btn-submit:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }

        .whatsapp-row { display: flex; align-items: center; gap: 8px; margin-top: 15px; font-size: 13px; font-weight: 700; color: #059669; }
        .whatsapp-row input { width: 16px; height: 16px; }

        .status-bar { text-align: center; margin-top: 12px; font-size: 11px; color: #6b7280; font-weight: 600; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
        <div class="header" id="drag-handle">
            <h2>Integrador Fidelidad</h2>
            <div class="close" id="close-x">✕</div>
        </div>
        <div class="content">
            <label class="top-label">Total a Cobrar</label>
            <input type="text" id="amount-input" class="amount-display" value="${String(detectedAmount).replace('.', ',')}">
            <div id="pts-preview" class="pts-preview">Puntos: 0</div>

            <label class="top-label">Cliente</label>
            <input type="text" id="search-input" placeholder="DNI o Nombre..." autocomplete="off">
            <div id="results-list" class="results" style="display:none;"></div>
            <div id="selected-info" style="display:none; margin-top:-10px; margin-bottom:12px; padding:10px; background:#f0fdf4; border:1.5px solid #10b981; border-radius:12px; text-align:center; font-weight:800; color:#065f46; font-size:13px;"></div>

            <div class="promo-list" id="promo-container">
                <div style="text-align:center; font-size:11px; color:#999; padding:5px;">Cargando promociones...</div>
            </div>

            <label class="whatsapp-row">
                <input type="checkbox" id="w-check" checked>
                <span>Notificar por WhatsApp</span>
            </label>

            <button id="submit-btn" class="btn-submit" disabled>CONFIRMAR PUNTOS</button>
            <div id="status-msg" class="status-bar"></div>
        </div>
    `;
    shadow.appendChild(panel);

    const cBtn = shadow.getElementById('close-x');
    const sInp = shadow.getElementById('search-input');
    const aInp = shadow.getElementById('amount-input');
    const rList = shadow.getElementById('results-list');
    const subBtn = shadow.getElementById('submit-btn');
    const statEl = shadow.getElementById('status-msg');
    const selBox = shadow.getElementById('selected-info');
    const wCheck = shadow.getElementById('w-check');
    const promoBox = shadow.getElementById('promo-container');

    cBtn.onclick = () => host.remove();

    // INTERACTION ISOLATION
    ['mousedown', 'mouseup', 'click', 'keydown', 'keyup', 'keypress'].forEach(e => {
        panel.addEventListener(e, (ev) => ev.stopPropagation(), { capture: true });
    });

    aInp.oninput = (e) => {
        detectedAmount = parseFloat(e.target.value.replace(',', '.')) || 0;
        updateUI();
    };

    if (activePromotions.length > 0) renderPromosInContainer(promoBox);

    let deb;
    sInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(deb);
        if (q.length < 2) { rList.style.display = 'none'; return; }
        deb = setTimeout(async () => {
            try {
                const r = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': config.apiKey }
                });
                const d = await r.json();
                if (d.ok) renderResults(d.clients);
            } catch (e) { }
        }, 300);
    };

    function renderResults(cls) {
        if (!cls.length) { rList.innerHTML = '<div class="result-item"><span>Sin resultados</span></div>'; }
        else {
            rList.innerHTML = cls.map(c => `
                <div class="result-item" data-id="${c.id}" data-name="${c.name}">
                    <b>${c.name}</b>
                    <small>DNI: ${c.dni} ${c.socio_number ? '| #' + c.socio_number : ''}</small>
                </div>
            `).join('');
        }
        rList.style.display = 'block';
        rList.querySelectorAll('.result-item').forEach(it => {
            it.onmousedown = (e) => {
                e.stopPropagation();
                selectedClient = { id: it.dataset.id, name: it.dataset.name };
                selBox.innerText = `Beneficiario: ${selectedClient.name}`;
                selBox.style.display = 'block';
                rList.style.display = 'none';
                sInp.value = selectedClient.name;
                subBtn.disabled = false;
            };
        });
    }

    subBtn.onclick = async () => {
        subBtn.disabled = true;
        subBtn.innerText = 'ENVIANDO...';
        statEl.innerText = 'Sincronizando puntos...';
        const bIds = Array.from(shadow.querySelectorAll('.promo-checkbox:checked')).map(c => c.dataset.id);
        try {
            const r = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'external_integration',
                    concept: 'Venta facturador',
                    bonusIds: bIds,
                    applyWhatsApp: wCheck.checked
                })
            });
            const d = await r.json();
            if (d.ok) renderSuccess(d); else {
                statEl.innerText = `❌ ${d.error}`; subBtn.disabled = false; subBtn.innerText = 'REINTENTAR';
            }
        } catch (e) { statEl.innerText = '❌ Error de red'; subBtn.disabled = false; }
    };

    function renderSuccess(d) {
        shadow.querySelector('.content').innerHTML = `
            <div style="text-align:center; padding:10px 0;">
                <div style="font-size:40px; margin-bottom:15px;">🌟</div>
                <div style="font-weight:900; font-size:18px; color:#10b981;">¡Operación Exitosa!</div>
                <div style="margin:10px 0 20px; font-size:14px; color:#4b5563;">Asignaste <b>${d.pointsAdded}</b> puntos.</div>
                ${d.whatsappLink ? `<a href="${d.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:16px; border-radius:14px; font-weight:800; text-decoration:none; margin-bottom:10px;">NOTIFICAR WHATSAPP</a>` : ''}
                <button onclick="document.getElementById('fidelidad-pro-host').remove()" style="width:100%; padding:12px; background:#f3f4f6; border:none; border-radius:12px; font-weight:700; color:#6b7280; pointer-events:auto !important;">CERRAR VENTANA</button>
            </div>
        `;
    }

    // Drag Logic
    const dH = shadow.getElementById('drag-handle');
    let isD = false, sx, sy, il, it;
    dH.onmousedown = (e) => {
        isD = true; sx = e.clientX; sy = e.clientY; il = host.offsetLeft; it = host.offsetTop;
        e.preventDefault(); e.stopPropagation();
    };
    document.addEventListener('mousemove', (e) => {
        if (!isD) return;
        host.style.left = (il + (e.clientX - sx)) + 'px';
        host.style.top = (it + (e.clientY - sy)) + 'px';
        host.style.right = 'auto';
    }, true);
    document.addEventListener('mouseup', () => isD = false, true);

    updateUI();
}
