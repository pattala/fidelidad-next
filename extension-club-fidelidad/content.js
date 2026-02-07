// Integrador Fidelidad v7 - Reconstrucción Total
console.log("🚀 [Club Fidelidad] Integrador v7 (Clean Boot) iniciado");

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
    if (state.apiUrl) fetchInitData();
});

async function apiProxy(url, method = 'GET', body = null) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({
            type: 'API_CALL',
            params: {
                url,
                method,
                headers: { 'x-api-key': state.apiKey },
                body
            }
        }, response => {
            if (chrome.runtime.lastError) return reject(chrome.runtime.lastError);
            if (response.ok) resolve(response.data);
            else reject(new Error(response.error));
        });
    });
}

async function fetchInitData() {
    try {
        const data = await apiProxy(`${state.apiUrl}/api/assign-points?q=___`);
        if (data.ok) {
            state.pointsMoneyBase = Number(data.pointsMoneyBase) || 100;
            state.pointsPerPeso = Number(data.pointsPerPeso) || 1;
            state.activePromotions = data.activePromotions || [];
            updateUI();
        }
    } catch (e) {
        console.error("❌ Error inicialización:", e);
    }
}

function calculatePoints() {
    let base = Math.floor((state.detectedAmount / state.pointsMoneyBase) * state.pointsPerPeso);
    let bonus = 0;
    let mult = 1;

    document.querySelectorAll('.cf-promo-chk:checked').forEach(chk => {
        const p = state.activePromotions.find(x => x.id === chk.dataset.id);
        if (p) {
            if (p.rewardType === 'FIXED') bonus += Number(p.rewardValue);
            if (p.rewardType === 'MULTIPLIER') mult *= Number(p.rewardValue);
        }
    });

    return Math.floor(base * mult) + bonus;
}

function updateUI() {
    const ptsEl = document.getElementById('cf-pts-preview');
    if (ptsEl) ptsEl.innerText = `Equivale a ${calculatePoints()} puntos`;

    const container = document.getElementById('cf-promo-container');
    if (container && state.activePromotions.length > 0 && container.getAttribute('data-loaded') !== 'true') {
        container.innerHTML = state.activePromotions.map(p => `
            <label class="cf-promo-item">
                <input type="checkbox" class="cf-promo-chk" data-id="${p.id}" checked>
                <span>${p.title}</span>
                <span class="cf-promo-badge">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue}</span>
            </label>
        `).join('');
        container.setAttribute('data-loaded', 'true');
        container.querySelectorAll('.cf-promo-chk').forEach(c => c.onchange = updateUI);
    }
}

// Detector de Factura
function detectBilling() {
    const text = document.body.innerText.toUpperCase();
    const isBilling = text.includes('CONFIRMAR FACTURA') || text.includes('TOTAL A PAGAR');
    const panel = document.getElementById('cf-main-panel');

    if (!isBilling) {
        if (panel) panel.remove();
        state.detectedAmount = 0;
        return;
    }

    let amount = 0;
    const Els = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of Els) {
        const t = el.innerText.trim();
        if (t.toUpperCase().includes('TOTAL A PAGAR $:')) {
            amount = parseVal(t);
            if (amount > 0) break;
        }
    }

    if (amount > 0) {
        if (Math.abs(amount - state.detectedAmount) > 0.1) {
            state.detectedAmount = amount;
            if (panel) {
                const inp = document.getElementById('cf-amount-input');
                if (inp) inp.value = String(amount).replace('.', ',');
                updateUI();
            }
        }
        if (!panel) injectPanel();
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
    if (document.getElementById('cf-main-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'cf-main-panel';
    panel.className = 'cf-panel-root';
    panel.innerHTML = `
        <div class="cf-header" id="cf-drag-handle">
            <span>INTEGRADOR FIDELIDAD</span>
            <div id="cf-close-btn" class="cf-close">✕</div>
        </div>
        <div class="cf-body">
            <div class="cf-group">
                <label>TOTAL A COBRAR</label>
                <input type="text" id="cf-amount-input" class="cf-amount" value="${String(state.detectedAmount).replace('.', ',')}">
                <div id="cf-pts-preview" class="cf-pts">Calculando puntos...</div>
            </div>

            <div class="cf-group" style="position:relative;">
                <label>BUSCAR CLIENTE</label>
                <input type="text" id="cf-search-input" placeholder="DNI o Nombre..." autocomplete="off">
                <div id="cf-results" class="cf-results-box" style="display:none;"></div>
                <div id="cf-selected" class="cf-selected-pill" style="display:none;"></div>
            </div>

            <div class="cf-promos">
                <div class="cf-promo-title">PROMOCIONES VIGENTES</div>
                <div id="cf-promo-container" class="cf-promo-list">
                    <div style="font-size:11px; color:#999; text-align:center;">Cargando...</div>
                </div>
            </div>

            <label class="cf-whatsapp">
                <input type="checkbox" id="cf-w-notify" checked>
                <span>Notificar por WhatsApp</span>
            </label>

            <button id="cf-submit" class="cf-btn" disabled>CONFIRMAR PUNTOS</button>
            <div id="cf-status" class="cf-status-text"></div>
        </div>
    `;

    // Inyectar Estilos Directos (Sin Shadow DOM)
    const style = document.createElement('style');
    style.id = 'cf-styles';
    style.textContent = `
        .cf-panel-root {
            position: fixed !important; top: 20px !important; right: 20px !important;
            width: 320px !important; background: white !important; z-index: 999999999 !important;
            border-radius: 16px !important; border: 2px solid #10b981 !important;
            box-shadow: 0 10px 40px rgba(0,0,0,0.3) !important; font-family: sans-serif !important;
            display: flex !important; flex-direction: column !important; overflow: hidden !important;
            color: #1f2937 !important; user-select: auto !important;
        }
        .cf-header { background: #10b981; padding: 12px 18px; color: white; display: flex; justify-content: space-between; align-items: center; cursor: move; font-weight: 800; font-size: 13px; }
        .cf-close { cursor: pointer; padding: 4px; }
        .cf-body { padding: 18px; }
        .cf-group { margin-bottom: 15px; }
        .cf-group label { display: block; font-size: 10px; font-weight: 800; color: #9ca3af; margin-bottom: 6px; }
        .cf-amount { width: 100%; border: 2px solid #f3f4f6; border-radius: 10px; background: #f9fafb; padding: 10px; font-size: 24px; font-weight: 900; text-align: center; color: #059669; outline: none; box-sizing: border-box; }
        .cf-pts { text-align: center; margin-top: 6px; color: #059669; font-weight: 700; font-size: 12px; }
        
        .cf-panel-root input[type="text"] {
            width: 100% !important; border: 2px solid #f3f4f6 !important; border-radius: 10px !important;
            background: #f9fafb !important; padding: 10px !important; font-size: 14px !important;
            box-sizing: border-box !important; outline: none !important;
        }
        .cf-panel-root input:focus { border-color: #10b981 !important; background: white !important; }

        .cf-results-box { position: absolute; background: white; border: 1px solid #e5e7eb; border-radius: 10px; width: 100%; max-height: 150px; overflow-y: auto; z-index: 100; box-shadow: 0 4px 6px rgba(0,0,0,0.1); margin-top: 2px; }
        .cf-res-item { padding: 10px; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
        .cf-res-item:hover { background: #f0fdf4; }
        .cf-res-item b { display: block; font-size: 13px; }
        .cf-res-item span { font-size: 10px; color: #6b7280; }

        .cf-selected-pill { margin-top: 10px; padding: 8px; background: #ecfdf5; border: 1px solid #10b981; border-radius: 8px; text-align: center; font-weight: 700; color: #065f46; font-size: 12px; }

        .cf-promos { background: #f9fafb; border-radius: 12px; padding: 10px; border: 1px solid #f3f4f6; margin-bottom: 15px; }
        .cf-promo-title { font-size: 9px; font-weight: 900; color: #9ca3af; margin-bottom: 8px; }
        .cf-promo-item { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 6px; cursor: pointer; }
        .cf-promo-badge { margin-left: auto; background: #10b981; color: white; padding: 1px 4px; border-radius: 4px; font-size: 9px; font-weight: 800; }
        
        .cf-whatsapp { display: flex; align-items: center; gap: 8px; margin-bottom: 15px; color: #059669; font-weight: 700; font-size: 12px; cursor: pointer; }
        .cf-btn { width: 100%; background: #10b981; color: white; border: none; padding: 14px; border-radius: 12px; font-weight: 800; cursor: pointer; font-size: 14px; box-shadow: 0 4px 10px rgba(16,185,129,0.3); }
        .cf-btn:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }
        .cf-status-text { margin-top: 10px; text-align: center; font-size: 11px; color: #6b7280; }
    `;

    document.head.appendChild(style);
    document.body.appendChild(panel);

    // Lógica de Eventos con PROTECCIÓN ELECTRÓNICA
    const sInp = document.getElementById('cf-search-input');
    const aInp = document.getElementById('cf-amount-input');
    const rBox = document.getElementById('cf-results');
    const sBtn = document.getElementById('cf-submit');
    const wInp = document.getElementById('cf-w-notify');
    const cBtn = document.getElementById('cf-close-btn');

    cBtn.onclick = () => panel.remove();

    // BLOQUEO ABSOLUTO DE PROPAGACIÓN
    // Esto evita que el sitio "robe" las teclas o clicks
    const block = (e) => {
        e.stopPropagation();
        // Solo bloqueamos shortcuts del sitio si estamos escribiendo
        if (e.type === 'keydown' && (e.target.tagName === 'INPUT')) {
            // Permitimos Backspace, Flechas, Enter, Letras, Números
            // Pero evitamos que el sitio detecte F1-F12 o atajos raros
        }
    };

    [panel, sInp, aInp].forEach(el => {
        el.addEventListener('keydown', block, true);
        el.addEventListener('keyup', block, true);
        el.addEventListener('mousedown', block, true);
        el.addEventListener('click', block, true);
    });

    // Forzar foco cuando se clickea un input
    [sInp, aInp].forEach(inp => {
        inp.onfocus = () => {
            console.log("🎯 Foco forzado en", inp.id);
            // El sitio podría tener un intervalo que roba el foco. Lo peleamos:
            // inp.focus(); 
        };
    });

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
                const data = await apiProxy(`${state.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`);
                if (data.ok) renderResults(data.clients);
            } catch (e) {
                console.error(e);
            }
        }, 300);
    };

    function renderResults(clients) {
        if (!clients.length) { rBox.innerHTML = '<div class="cf-res-item">Sin resultados</div>'; }
        else {
            rBox.innerHTML = clients.map(c => `
                <div class="cf-res-item" data-id="${c.id}" data-name="${c.name}">
                    <b>${c.name}</b>
                    <span>DNI: ${c.dni} ${c.socio_number ? '| #' + c.socio_number : ''}</span>
                </div>
            `).join('');
        }
        rBox.style.display = 'block';
        rBox.querySelectorAll('.cf-res-item').forEach(it => {
            it.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                state.selectedClient = { id: it.dataset.id, name: it.dataset.name };
                const sPill = document.getElementById('cf-selected');
                sPill.innerText = `Cliente: ${state.selectedClient.name}`;
                sPill.style.display = 'block';
                rBox.style.display = 'none';
                sInp.value = state.selectedClient.name;
                sBtn.disabled = false;
            };
        });
    }

    sBtn.onclick = async () => {
        sBtn.disabled = true;
        sBtn.innerText = 'PROCESANDO...';
        const st = document.getElementById('cf-status');
        st.innerText = 'Sincronizando puntos...';

        const bonusIds = Array.from(document.querySelectorAll('.cf-promo-chk:checked')).map(c => c.dataset.id);

        try {
            const res = await apiProxy(`${state.apiUrl}/api/assign-points`, 'POST', {
                uid: state.selectedClient.id,
                amount: state.detectedAmount,
                reason: 'external_integration',
                concept: 'Venta local',
                bonusIds,
                applyWhatsApp: wInp.checked
            });
            if (res.ok) renderSuccess(res);
            else {
                st.innerText = `❌ ${res.error}`; sBtn.disabled = false; sBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            st.innerText = '❌ Error de red'; sBtn.disabled = false;
        }
    };

    function renderSuccess(d) {
        document.querySelector('.cf-body').innerHTML = `
            <div style="text-align:center; padding: 20px 0;">
                <div style="font-size:40px; margin-bottom:15px;">✅</div>
                <div style="font-weight:900; font-size:18px; color:#10b981;">¡Puntos Otorgaods!</div>
                <div style="margin:10px 0 20px; font-size:14px; color:#4b5563;">Se asignaron <b>${d.pointsAdded}</b> puntos.</div>
                ${d.whatsappLink ? `<a href="${d.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:15px; border-radius:12px; font-weight:700; text-decoration:none; margin-bottom:10px;">ENVIAR WHATSAPP</a>` : ''}
                <button onclick="document.getElementById('cf-main-panel').remove()" style="width:100%; padding:12px; background:#f3f4f6; border:none; border-radius:12px; font-weight:700; color:#6b7280; cursor:pointer;">CERRAR</button>
            </div>
        `;
    }

    // Drag simple
    let isD = false, ox, oy;
    document.getElementById('cf-drag-handle').onmousedown = e => {
        isD = true; ox = e.clientX - panel.offsetLeft; oy = e.clientY - panel.offsetTop;
        e.preventDefault(); e.stopPropagation();
    };
    document.onmousemove = e => {
        if (!isD) return;
        panel.style.left = (e.clientX - ox) + 'px';
        panel.style.top = (e.clientY - oy) + 'px';
    };
    document.onmouseup = () => isD = false;

    updateUI();
}
