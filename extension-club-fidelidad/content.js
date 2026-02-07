// Integrador Fidelidad v10 - VISIBILITY & INTERACTION MASTER
console.log("🚀 [Club Fidelidad] v10 iniciando...");

let state = {
    detectedAmount: 0,
    selectedClient: null,
    pointsMoneyBase: 100,
    pointsPerPeso: 1,
    activePromotions: [],
    apiUrl: '',
    apiKey: ''
};

// Carga de configuración
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    state.apiUrl = res.apiUrl;
    state.apiKey = res.apiKey;
    console.log("📦 [Club Fidelidad] Config cargada");
    if (state.apiUrl) fetchInitData();
});

async function apiCall(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'API_CALL',
            params: { url, method, body }
        }, response => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            if (response && response.ok) resolve(response.data);
            else reject(new Error(response?.error || 'Unknown error'));
        });
    });
}

async function fetchInitData() {
    if (!state.apiUrl) return;
    try {
        const data = await apiCall(`${state.apiUrl}/api/assign-points?q=___`);
        if (data.ok) {
            state.pointsMoneyBase = Number(data.pointsMoneyBase) || 100;
            state.pointsPerPeso = Number(data.pointsPerPeso) || 1;
            state.activePromotions = data.activePromotions || [];
            console.log("✅ [Club Fidelidad] Promos cargadas:", state.activePromotions.length);
            updateUI();
        }
    } catch (e) {
        console.error("❌ [Club Fidelidad] Error API:", e);
    }
}

function calculatePoints() {
    let base = Math.floor((state.detectedAmount / state.pointsMoneyBase) * state.pointsPerPeso);
    let bonus = 0;
    let mult = 1;

    const host = document.getElementById('cf-host');
    if (host && host.shadowRoot) {
        const checks = host.shadowRoot.querySelectorAll('.promo-chk:checked');
        checks.forEach(chk => {
            const p = state.activePromotions.find(x => x.id === chk.dataset.id);
            if (p) {
                if (p.rewardType === 'FIXED') bonus += Number(p.rewardValue);
                if (p.rewardType === 'MULTIPLIER') mult *= Number(p.rewardValue);
            }
        });
    }
    return Math.floor(base * mult) + bonus;
}

function updateUI() {
    const host = document.getElementById('cf-host');
    if (!host || !host.shadowRoot) return;
    const root = host.shadowRoot;

    const ptsEl = root.getElementById('pts-preview');
    if (ptsEl) ptsEl.innerText = `Equivale a ${calculatePoints()} puntos`;

    const container = root.getElementById('promo-list');
    if (container && state.activePromotions.length > 0 && container.getAttribute('data-loaded') !== 'true') {
        container.innerHTML = state.activePromotions.map(p => `
            <label class="promo-item">
                <input type="checkbox" class="promo-chk" data-id="${p.id}" checked>
                <div class="promo-info">
                    <span class="promo-name">${p.title}</span>
                    <span class="promo-badge">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue}</span>
                </div>
            </label>
        `).join('');
        container.setAttribute('data-loaded', 'true');
        container.querySelectorAll('.promo-chk').forEach(c => c.onchange = updateUI);
    }
}

// Detector
function detectBilling() {
    const pageText = document.body.innerText.toUpperCase();
    const isBilling = pageText.includes('CONFIRMAR FACTURA') ||
        pageText.includes('TOTAL A PAGAR') ||
        document.querySelector('input[placeholder="Paga con $"]') !== null;

    const host = document.getElementById('cf-host');

    if (!isBilling) {
        if (host) host.remove();
        state.detectedAmount = 0;
        return;
    }

    let amount = 0;
    const items = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of items) {
        const val = el.innerText.trim();
        if (val.toUpperCase().includes('TOTAL A PAGAR $:')) {
            amount = parseVal(val);
            if (amount > 0) break;
        }
    }

    if (amount === 0) {
        const pagaCon = document.querySelector('input[placeholder="Paga con $"]');
        if (pagaCon && pagaCon.value) amount = parseVal(pagaCon.value);
    }

    if (amount > 0) {
        if (Math.abs(amount - state.detectedAmount) > 0.1) {
            state.detectedAmount = amount;
            if (host && host.shadowRoot) {
                const inp = host.shadowRoot.getElementById('amount-inp');
                if (inp) inp.value = String(amount).replace('.', ',');
                updateUI();
            }
        }
        if (!host) injectPanel();
    }
}

function parseVal(t) {
    let s = t.includes('$') ? t.split('$')[1] : t;
    let c = s.replace(/[^0-9,.]/g, '').trim();
    if (!c) return 0;
    if (c.includes('.') && c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
    else if (c.includes(',')) c = c.replace(',', '.');
    return parseFloat(c) || 0;
}

setInterval(detectBilling, 1000);

function injectPanel() {
    if (document.getElementById('cf-host')) return;

    console.log("💉 [Club Fidelidad] Inyectando panel...");

    const host = document.createElement('div');
    host.id = 'cf-host';
    // Estilos ultra-agresivos para asegurar visibilidad
    host.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        width: 340px !important;
        height: auto !important;
        z-index: 2147483647 !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        background: transparent !important;
        pointer-events: auto !important;
        margin: 0 !important;
    `;

    // Inyectar en document.body si existe, sino en documentElement
    (document.body || document.documentElement).appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        .panel {
            width: 320px;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 30px 60px -12px rgba(0,0,0,0.45), 0 0 1px rgba(0,0,0,0.3);
            font-family: 'Inter', system-ui, sans-serif;
            border: 2px solid #10b981;
            overflow: hidden;
            color: #111827;
            pointer-events: auto !important;
        }
        .header {
            background: #10b981;
            padding: 14px 18px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            user-select: none;
        }
        .header h2 { margin: 0; font-size: 14px; font-weight: 800; text-transform: uppercase; }
        .close { cursor: pointer; font-size: 20px; }

        .content { padding: 20px; }

        .label { display: block; font-size: 10px; font-weight: 800; color: #9ca3af; text-transform: uppercase; margin-bottom: 6px; }
        
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
            pointer-events: auto !important;
            user-select: text !important;
        }
        input:focus { border-color: #10b981; background: #fff; }

        .amount-inp { font-size: 24px; font-weight: 900; text-align: center; color: #059669; }
        .pts-box { margin-top: -10px; margin-bottom: 20px; text-align: center; font-size: 13px; font-weight: 800; color: #059669; background: #ecfdf5; padding: 8px; border-radius: 10px; }

        .promo-list { background: #f9fafb; border-radius: 15px; padding: 12px; border: 1px solid #f3f4f6; margin-bottom: 15px; }
        .promo-item { display: flex; align-items: center; gap: 10px; font-size: 12px; margin-bottom: 8px; cursor: pointer; color: #374151; }
        .promo-item:last-child { margin-bottom: 0; }
        .promo-item input { width: 18px; height: 18px; cursor: pointer; margin: 0; }
        .promo-info { flex: 1; display: flex; justify-content: space-between; align-items: center; }
        .promo-badge { font-size: 10px; font-weight: 800; color: white; background: #10b981; padding: 2px 6px; border-radius: 6px; }

        .results {
            background: white; border: 1px solid #e5e7eb; border-radius: 12px;
            max-height: 180px; overflow-y: auto; position: absolute; width: 280px; z-index: 1000;
            box-shadow: 0 15px 30px rgba(0,0,0,0.15); margin-top: -12px;
        }
        .res-item { padding: 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
        .res-item:hover { background: #f0fdf4; }

        .selected-pill { margin-bottom: 15px; padding: 10px; background: #ecfdf5; border: 2px solid #10b981; border-radius: 12px; text-align: center; font-weight: 800; color: #065f46; font-size: 13px; }

        .btn-confirm {
            width: 100%; padding: 16px; background: #10b981; color: white; border: none;
            border-radius: 15px; font-size: 15px; font-weight: 800; cursor: pointer;
            box-shadow: 0 10px 15px rgba(16, 185, 129, 0.4);
        }
        .btn-confirm:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }

        .wa-row { display: flex; align-items: center; gap: 8px; margin-top: 15px; font-size: 13px; font-weight: 700; color: #059669; cursor: pointer; }
        .wa-row input { width: 18px; height: 18px; }
        .status { text-align: center; margin-top: 10px; font-size: 11px; color: #6b7280; font-weight: 600; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
        <div class="header" id="drag-zone">
            <h2>Integrador Fidelidad</h2>
            <div class="close" id="close-btn">✕</div>
        </div>
        <div class="content">
            <label class="label">Total Venta</label>
            <input type="text" id="amount-inp" class="amount-inp" value="${String(state.detectedAmount).replace('.', ',')}">
            <div id="pts-preview" class="pts-box">Calculando...</div>

            <div style="position:relative;">
                <label class="label">Cliente</label>
                <input type="text" id="search-inp" placeholder="DNI o Nombre..." autocomplete="off">
                <div id="res-box" class="results" style="display:none;"></div>
                <div id="sel-info" class="selected-pill" style="display:none;"></div>
            </div>

            <div class="promo-list" id="promo-list">
                <div style="text-align:center; font-size:11px; color:#999;">Buscando promociones...</div>
            </div>

            <label class="wa-row">
                <input type="checkbox" id="wa-chk" checked>
                <span>Avisar por WhatsApp</span>
            </label>

            <button id="sub-btn" class="btn-confirm" disabled>OTORGAR PUNTOS</button>
            <div id="stat-txt" class="status"></div>
        </div>
    `;
    shadow.appendChild(panel);

    // Eventos
    const sInp = shadow.getElementById('search-inp');
    const aInp = shadow.getElementById('amount-inp');
    const rBox = shadow.getElementById('res-box');
    const sBtn = shadow.getElementById('sub-btn');
    const closeBtn = shadow.getElementById('close-btn');

    closeBtn.onclick = () => host.remove();

    // INTERACTION FIX: Kill propagation to avoid site steal
    const stop = (e) => e.stopPropagation();
    panel.addEventListener('keydown', stop, true);
    panel.addEventListener('keyup', stop, true);
    panel.addEventListener('mousedown', stop, true);
    panel.addEventListener('click', stop, true);

    aInp.oninput = (e) => {
        state.detectedAmount = parseFloat(e.target.value.replace(',', '.')) || 0;
        updateUI();
    };

    let deb;
    sInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(deb);
        if (q.length < 2) { rBox.style.display = 'none'; return; }
        deb = setTimeout(async () => {
            try {
                const d = await apiCall(`${state.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`);
                if (d.ok) renderResults(d.clients);
            } catch (e) { }
        }, 300);
    };

    function renderResults(cls) {
        if (!cls.length) rBox.innerHTML = '<div class="res-item">Sin resultados</div>';
        else {
            rBox.innerHTML = cls.map(c => `
                <div class="res-item" data-id="${c.id}" data-name="${c.name}">
                    <b>${c.name}</b>
                    <div style="font-size:10px; color:#6b7280;">DNI: ${c.dni} ${c.socio_number ? '| #' + c.socio_number : ''}</div>
                </div>
            `).join('');
        }
        rBox.style.display = 'block';
        rBox.querySelectorAll('.res-item').forEach(it => {
            it.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                state.selectedClient = { id: it.dataset.id, name: it.dataset.name };
                const sel = shadow.getElementById('sel-info');
                sel.innerText = `Beneficiario: ${state.selectedClient.name}`;
                sel.style.display = 'block';
                rBox.style.display = 'none';
                sInp.value = state.selectedClient.name;
                sBtn.disabled = false;
            };
        });
    }

    sBtn.onclick = async () => {
        sBtn.disabled = true;
        sBtn.innerText = 'PROCESANDO...';
        const st = shadow.getElementById('stat-txt');
        st.innerText = 'Asignando puntos...';

        const bIds = Array.from(shadow.querySelectorAll('.promo-chk:checked')).map(c => c.dataset.id);
        const wChk = shadow.getElementById('wa-chk').checked;

        try {
            const r = await apiCall(`${state.apiUrl}/api/assign-points`, 'POST', {
                uid: state.selectedClient.id,
                amount: state.detectedAmount,
                reason: 'external_integration',
                concept: 'Venta facturador',
                bonusIds: bIds,
                applyWhatsApp: wChk
            });
            if (r.ok) renderSuccess(r);
            else {
                st.innerText = `❌ ${r.error}`; sBtn.disabled = false; sBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            st.innerText = '❌ Error de red'; sBtn.disabled = false;
        }
    };

    function renderSuccess(d) {
        shadow.querySelector('.content').innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
                <div style="font-size:50px; margin-bottom:15px;">💸</div>
                <div style="font-weight:900; font-size:20px; color:#10b981;">¡Puntos Asignados!</div>
                <div style="margin:10px 0 20px; font-size:14px; color:#4b5563;">Sumaste <b>${d.pointsAdded}</b> puntos.</div>
                ${d.whatsappLink ? `<a href="${d.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:16px; border-radius:15px; font-weight:800; text-decoration:none; margin-bottom:12px;">INFORMAR POR WHATSAPP</a>` : ''}
                <button onclick="document.getElementById('cf-host').remove()" style="width:100%; padding:12px; background:#f3f4f6; border:none; border-radius:12px; font-weight:800; color:#6b7280; cursor:pointer;">CERRAR</button>
            </div>
        `;
    }

    // DRAG
    const dragZone = shadow.getElementById('drag-zone');
    let isD = false, sx, sy, il, it;
    dragZone.onmousedown = (e) => {
        isD = true; sx = e.clientX; sy = e.clientY; il = host.offsetLeft; it = host.offsetTop;
        e.preventDefault(); e.stopPropagation();
    };
    document.addEventListener('mousemove', (e) => {
        if (!isD) return;
        host.style.left = (il + (e.clientX - sx)) + 'px';
        host.style.top = (it + (e.clientY - sy)) + 'px';
        host.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => isD = false);

    updateUI();
}
