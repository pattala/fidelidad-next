// Integrador Fidelidad v8 - Reconstrucción de Alta Fidelidad
console.log("🚀 [Club Fidelidad] Iniciando Integrador v8...");

let state = {
    detectedAmount: 0,
    selectedClient: null,
    pointsMoneyBase: 100,
    pointsPerPeso: 1,
    activePromotions: [],
    apiUrl: '',
    apiKey: ''
};

// Carga de configuración desde storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    state.apiUrl = res.apiUrl;
    state.apiKey = res.apiKey;
    if (state.apiUrl) fetchInitData();
});

// Proxy de Mensajería para evitar CORS
async function apiCall(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'API_CALL',
            params: { url, method, body }
        }, response => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            if (response.ok) resolve(response.data);
            else reject(new Error(response.error));
        });
    });
}

async function fetchInitData() {
    try {
        const data = await apiCall(`${state.apiUrl}/api/assign-points?q=___`);
        if (data.ok) {
            state.pointsMoneyBase = Number(data.pointsMoneyBase) || 100;
            state.pointsPerPeso = Number(data.pointsPerPeso) || 1;
            state.activePromotions = data.activePromotions || [];
            updateUI();
        }
    } catch (e) {
        console.error("❌ Error API:", e);
    }
}

function calculatePoints() {
    const root = document.getElementById('cf-host')?.shadowRoot;
    if (!root) return 0;

    let base = Math.floor((state.detectedAmount / state.pointsMoneyBase) * state.pointsPerPeso);
    let bonus = 0;
    let mult = 1;

    const checks = root.querySelectorAll('.promo-chk:checked');
    checks.forEach(chk => {
        const p = state.activePromotions.find(x => x.id === chk.dataset.id);
        if (p) {
            if (p.rewardType === 'FIXED') bonus += Number(p.rewardValue);
            if (p.rewardType === 'MULTIPLIER') mult *= Number(p.rewardValue);
        }
    });

    return Math.floor(base * mult) + bonus;
}

function updateUI() {
    const root = document.getElementById('cf-host')?.shadowRoot;
    if (!root) return;

    const ptsEl = root.getElementById('pts-preview');
    if (ptsEl) ptsEl.innerText = `Equivale a ${calculatePoints()} puntos`;

    const container = root.getElementById('promo-list');
    if (container && state.activePromotions.length > 0 && container.getAttribute('data-loaded') !== 'true') {
        container.innerHTML = state.activePromotions.map(p => `
            <label class="promo-item">
                <input type="checkbox" class="promo-chk" data-id="${p.id}" checked>
                <div class="promo-info">
                    <span class="promo-name">${p.title}</span>
                    <span class="promo-val">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue + ' pts'}</span>
                </div>
            </label>
        `).join('');
        container.setAttribute('data-loaded', 'true');
        container.querySelectorAll('.promo-chk').forEach(c => c.onchange = updateUI);
    }
}

// Detección de factura en pantalla
function detectBilling() {
    const text = document.body.innerText.toUpperCase();
    const isConfirming = text.includes('CONFIRMAR FACTURA') || text.includes('TOTAL A PAGAR');
    const host = document.getElementById('cf-host');

    if (!isConfirming) {
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

    if (amount > 0) {
        if (Math.abs(amount - state.detectedAmount) > 0.01) {
            state.detectedAmount = amount;
            if (host?.shadowRoot) {
                const inp = host.shadowRoot.getElementById('amount-inp');
                if (inp) inp.value = String(amount).replace('.', ',');
                updateUI();
            }
        }
        if (!host) injectPanel();
    }
}

function parseVal(t) {
    let s = t.split('$')[1] || t.split('$')[0];
    let c = s.replace(/[^0-9,.]/g, '').trim();
    if (!c) return 0;
    if (c.includes('.') && c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
    else if (c.includes(',')) c = c.replace(',', '.');
    return parseFloat(c) || 0;
}

setInterval(detectBilling, 1000);

function injectPanel() {
    if (document.getElementById('cf-host')) return;

    const host = document.createElement('div');
    host.id = 'cf-host';
    host.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        z-index: 2147483647 !important;
        all: initial !important;
    `;
    document.documentElement.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        .panel {
            width: 320px;
            background: #ffffff;
            border-radius: 20px;
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            font-family: 'Segoe UI', system-ui, sans-serif;
            overflow: hidden;
            border: 1px solid #e5e7eb;
            display: flex;
            flex-direction: column;
            pointer-events: auto !important;
            color: #111827;
        }
        .header {
            background: #10b981;
            padding: 15px 20px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
            font-weight: 700;
        }
        .header h2 { margin: 0; font-size: 14px; text-transform: uppercase; }
        .close { cursor: pointer; font-size: 20px; opacity: 0.8; }
        .close:hover { opacity: 1; }

        .body { padding: 20px; }

        .label { display: block; font-size: 10px; font-weight: 800; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; letter-spacing: 0.05em; }
        
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
        }
        input:focus { border-color: #10b981; background: #fff; }

        .amount-inp { font-size: 24px; font-weight: 900; text-align: center; color: #059669; }
        .pts-preview { margin-top: -10px; margin-bottom: 15px; text-align: center; font-size: 12px; font-weight: 700; color: #059669; background: #ecfdf5; padding: 6px; border-radius: 8px; }

        .promo-section { background: #f9fafb; border-radius: 16px; padding: 12px; border: 1px solid #f3f4f6; margin-bottom: 15px; }
        .promo-list { display: flex; flex-direction: column; gap: 8px; }
        .promo-item { display: flex; align-items: center; gap: 10px; cursor: pointer; }
        .promo-item input { width: 18px; height: 18px; margin: 0; cursor: pointer; }
        .promo-info { flex: 1; display: flex; justify-content: space-between; align-items: center; }
        .promo-name { font-size: 12px; font-weight: 600; color: #374151; }
        .promo-val { font-size: 10px; font-weight: 800; color: white; background: #10b981; padding: 2px 6px; border-radius: 6px; }

        .results {
            background: white; border: 1px solid #e5e7eb; border-radius: 12px;
            max-height: 180px; overflow-y: auto; position: absolute; width: 278px; z-index: 1000;
            box-shadow: 0 10px 15px -3px rgba(0,0,0,0.15); margin-top: -10px;
        }
        .res-item { padding: 12px; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
        .res-item:hover { background: #f0fdf4; }
        .res-item b { display: block; font-size: 13px; margin-bottom: 2px; }
        .res-item span { font-size: 10px; color: #6b7280; }

        .selected-box { margin-bottom: 15px; padding: 10px; background: #ecfdf5; border: 2.5px solid #10b981; border-radius: 12px; text-align: center; }
        .selected-name { font-weight: 900; color: #065f46; font-size: 14px; }

        .whatsapp-opt { display: flex; align-items: center; gap: 10px; margin-bottom: 20px; color: #059669; font-weight: 700; font-size: 13px; cursor: pointer; }
        .whatsapp-opt input { width: 18px; height: 18px; margin: 0; }

        .btn-confirm {
            width: 100%; padding: 16px; background: #10b981; color: white; border: none;
            border-radius: 16px; font-size: 16px; font-weight: 800; cursor: pointer;
            box-shadow: 0 10px 20px -5px rgba(16, 185, 129, 0.5); transition: all 0.2s;
        }
        .btn-confirm:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }
        .status { margin-top: 12px; text-align: center; font-size: 11px; color: #6b7280; font-weight: 600; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
        <div class="header" id="drag-h">
            <h2>Integrador Fidelidad</h2>
            <div class="close" id="close-btn">✕</div>
        </div>
        <div class="body">
            <label class="label">Monto de la Venta</label>
            <input type="text" id="amount-inp" class="amount-inp" value="${String(state.detectedAmount).replace('.', ',')}">
            <div id="pts-preview" class="pts-preview">Calculando...</div>

            <div style="position:relative;">
                <label class="label">Beneficiario</label>
                <input type="text" id="search-inp" placeholder="DNI, Nombre o Socio..." autocomplete="off">
                <div id="res-list" class="results" style="display:none;"></div>
                <div id="selected-ui" class="selected-box" style="display:none;">
                    <div class="selected-name" id="sel-name"></div>
                </div>
            </div>

            <div class="promo-section">
                <div class="label" style="margin-bottom:10px;">Promociones Activas</div>
                <div id="promo-list" class="promo-list">
                    <div style="font-size:11px; color:#999; text-align:center;">Cargando...</div>
                </div>
            </div>

            <label class="whatsapp-opt">
                <input type="checkbox" id="wa-chk" checked>
                <span>Enviar aviso WhatsApp</span>
            </label>

            <button id="confirm-btn" class="btn-confirm" disabled>OTORGAR PUNTOS</button>
            <div id="status-txt" class="status"></div>
        </div>
    `;
    shadow.appendChild(panel);

    const sInp = shadow.getElementById('search-inp');
    const aInp = shadow.getElementById('amount-inp');
    const rList = shadow.getElementById('res-list');
    const cBtn = shadow.getElementById('confirm-btn');
    const closeBtn = shadow.getElementById('close-btn');

    closeBtn.onclick = () => host.remove();

    // INTERACTION FIX: Prevent keys from bubbling to the site only if typed in our inputs
    const killKeys = (e) => {
        e.stopPropagation();
    };
    [sInp, aInp].forEach(inp => {
        inp.addEventListener('keydown', killKeys);
        inp.addEventListener('keyup', killKeys);
        inp.addEventListener('keypress', killKeys);
    });

    // Ensure clicks within the panel don't bubble
    panel.addEventListener('mousedown', (e) => e.stopPropagation());
    panel.addEventListener('click', (e) => e.stopPropagation());

    aInp.oninput = (e) => {
        state.detectedAmount = parseFloat(e.target.value.replace(',', '.')) || 0;
        updateUI();
    };

    let deb;
    sInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(deb);
        if (q.length < 2) { rList.style.display = 'none'; return; }
        deb = setTimeout(async () => {
            try {
                const data = await apiCall(`${state.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`);
                if (data.ok) renderResults(data.clients);
            } catch (e) { }
        }, 300);
    };

    function renderResults(cls) {
        if (!cls.length) rList.innerHTML = '<div class="res-item">Sin resultados</div>';
        else {
            rList.innerHTML = cls.map(c => `
                <div class="res-item" data-id="${c.id}" data-name="${c.name}">
                    <b>${c.name}</b>
                    <span>DNI: ${c.dni} ${c.socio_number ? '| #' + c.socio_number : ''}</span>
                </div>
            `).join('');
        }
        rList.style.display = 'block';
        rList.querySelectorAll('.res-item').forEach(it => {
            it.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                state.selectedClient = { id: it.dataset.id, name: it.dataset.name };
                shadow.getElementById('sel-name').innerText = state.selectedClient.name;
                shadow.getElementById('selected-ui').style.display = 'block';
                rList.style.display = 'none';
                sInp.value = state.selectedClient.name;
                cBtn.disabled = false;
            };
        });
    }

    cBtn.onclick = async () => {
        cBtn.disabled = true;
        cBtn.innerText = 'PROCESANDO...';
        const st = shadow.getElementById('status-txt');
        st.innerText = 'Guardando en la base de datos...';

        const bIds = Array.from(shadow.querySelectorAll('.promo-chk:checked')).map(c => c.dataset.id);
        const wChk = shadow.getElementById('wa-chk').checked;

        try {
            const res = await apiCall(`${state.apiUrl}/api/assign-points`, 'POST', {
                uid: state.selectedClient.id,
                amount: state.detectedAmount,
                reason: 'external_integration',
                concept: 'Venta facturador',
                bonusIds: bIds,
                applyWhatsApp: wChk
            });
            if (res.ok) renderFinal(res);
            else {
                st.innerText = `❌ ${res.error}`; cBtn.disabled = false; cBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            st.innerText = '❌ Error de conexión'; cBtn.disabled = false;
        }
    };

    function renderFinal(d) {
        shadow.querySelector('.body').innerHTML = `
            <div style="text-align:center; padding: 15px 0;">
                <div style="font-size:50px; margin-bottom:15px;">👏</div>
                <div style="font-weight:900; font-size:20px; color:#10b981; margin-bottom:5px;">¡Listo!</div>
                <div style="margin-bottom:20px; font-size:14px; color:#4b5563;">Sumaste <b>${d.pointsAdded}</b> puntos.</div>
                ${d.whatsappLink ? `<a href="${d.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:16px; border-radius:14px; font-weight:800; text-decoration:none; margin-bottom:12px;">ENVIAR WHATSAPP</a>` : ''}
                <button onclick="document.getElementById('cf-host').remove()" style="width:100%; padding:12px; background:#f3f4f6; border:none; border-radius:12px; font-weight:700; color:#6b7280; cursor:pointer;">CERRAR</button>
            </div>
        `;
    }

    // ARRASTRE (DRAG) ROBUSTO
    const handle = shadow.getElementById('drag-h');
    let isDragging = false;
    let startX, startY, initialHostLeft, initialHostTop;

    handle.onmousedown = (e) => {
        isDragging = true;
        startX = e.clientX;
        startY = e.clientY;
        initialHostLeft = host.offsetLeft;
        initialHostTop = host.offsetTop;
        e.preventDefault();
        e.stopPropagation();
    };

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - startX;
        const dy = e.clientY - startY;
        host.style.left = (initialHostLeft + dx) + 'px';
        host.style.top = (initialHostTop + dy) + 'px';
        host.style.right = 'auto'; // Disable fixed right positioning
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
    });

    updateUI();
}
