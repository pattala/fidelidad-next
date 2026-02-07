// Club Fidelidad - Integrador PRO v4
console.log("🚀 [Club Fidelidad] Cargando Integrador v4...");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;
let pointsMoneyBase = 100;
let pointsPerPeso = 1;
let activePromotions = [];

// Escuchar cambios en la configuración
chrome.storage.onChanged.addListener((changes) => {
    if (changes.apiUrl) config.apiUrl = changes.apiUrl.newValue;
    if (changes.apiKey) config.apiKey = changes.apiKey.newValue;
    if (config.apiUrl) fetchInitData();
});

// Carga inicial de storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    console.log("📦 [Club Fidelidad] Configuración cargada:", config.apiUrl ? "URL OK" : "URL Pendiente");
    if (config.apiUrl) fetchInitData();
});

async function fetchInitData() {
    if (!config.apiUrl || !config.apiKey) return;
    try {
        const res = await fetch(`${config.apiUrl}/api/assign-points?q=___`, {
            headers: { 'x-api-key': config.apiKey }
        });
        const data = await res.json();
        if (data.ok) {
            pointsMoneyBase = Number(data.pointsMoneyBase) || 100;
            pointsPerPeso = Number(data.pointsPerPeso) || 1;
            activePromotions = data.activePromotions || [];
            console.log("📊 [Club Fidelidad] Datos de conversión actualizados");
            updateUI();
        }
    } catch (e) {
        console.error("❌ [Club Fidelidad] Error al conectar con la API:", e);
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

// Detector de la pantalla de confirmación
function detectBilling() {
    try {
        const pageText = document.body.innerText.toUpperCase();
        const hasConfirm = pageText.includes('CONFIRMAR FACTURA') || pageText.includes('TOTAL A PAGAR');
        const host = document.getElementById('fidelidad-pro-host');

        if (!hasConfirm) {
            if (host) {
                console.log("👋 [Club Fidelidad] Pantalla de facturación cerrada");
                host.remove();
            }
            detectedAmount = 0;
            selectedClient = null;
            return;
        }

        // Si ya existe el panel, solo actualizamos el monto si cambió
        let amount = 0;
        const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
        for (let el of candidates) {
            const text = el.innerText.trim();
            if (text.toUpperCase().includes('TOTAL A PAGAR $:')) {
                amount = parseVal(text);
                if (amount > 0) break;
            }
        }

        if (amount > 0 && Math.abs(amount - detectedAmount) > 0.01) {
            console.log("💰 [Club Fidelidad] Monto detectado:", amount);
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
    } catch (err) {
        console.error("❌ [Club Fidelidad] Error en detección:", err);
    }
}

function parseVal(t) {
    let p = t.split('$');
    let s = p.length > 1 ? p[1] : p[0];
    let c = s.replace(/[^0-9,.]/g, '').trim();
    if (!c) return 0;
    // Manejo de puntos de miles y comas decimales (Argentina)
    if (c.includes('.') && c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
    else if (c.includes(',')) c = c.replace(',', '.');
    return parseFloat(c) || 0;
}

// Iniciar detector cada segundo
setInterval(detectBilling, 1500);

function injectProPanel() {
    if (document.getElementById('fidelidad-pro-host')) return;

    console.log("🎨 [Club Fidelidad] Inyectando panel PRO...");

    const host = document.createElement('div');
    host.id = 'fidelidad-pro-host';
    host.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 2147483647;
        pointer-events: auto !important;
    `;
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    const style = document.createElement('style');
    style.textContent = `
        .panel {
            width: 320px;
            background: #ffffff;
            border-radius: 16px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.3);
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
            overflow: hidden;
            border: 1px solid #e0e0e0;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
            color: #1f2937;
        }
        @keyframes slideIn { from { transform: translateX(20px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }

        .header {
            background: #10b981;
            padding: 14px 18px;
            color: white;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }
        .header h2 { margin: 0; font-size: 15px; font-weight: 700; letter-spacing: -0.01em; }
        .close { cursor: pointer; font-size: 20px; line-height: 1; }

        .content { padding: 18px; }

        .field-group { margin-bottom: 16px; }
        .label { display: block; font-size: 11px; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 6px; }
        
        input {
            width: 100%;
            padding: 10px 12px;
            border: 2px solid #f3f4f6;
            border-radius: 10px;
            box-sizing: border-box;
            font-size: 13px;
            outline: none;
            background: #f9fafb;
            color: #111827;
            user-select: text !important;
        }
        input:focus { border-color: #10b981; background: white; }

        .amount-input { font-size: 22px; font-weight: 800; text-align: center; color: #059669; }
        .pts-preview { margin-top: 6px; font-size: 12px; font-weight: 700; color: #059669; text-align: center; }

        .promo-box { background: #f9fafb; border-radius: 12px; padding: 12px; border: 1px solid #f3f4f6; margin-bottom: 16px; }
        .promo-item { display: flex; align-items: center; gap: 8px; font-size: 12px; margin-bottom: 8px; cursor: pointer; }
        .promo-item:last-child { margin-bottom: 0; }
        .promo-item input { width: 16px; height: 16px; cursor: pointer; }
        .promo-badge { font-size: 9px; background: #d1fae5; color: #065f46; padding: 1px 5px; border-radius: 4px; font-weight: 700; margin-left: auto; }

        .results {
            background: white; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 4px;
            max-height: 150px; overflow-y: auto; position: absolute; width: 284px; z-index: 100;
        }
        .result-item { padding: 10px; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
        .result-item:hover { background: #f0fdf4; }
        .result-item b { display: block; font-size: 13px; }
        .result-item small { font-size: 10px; color: #6b7280; }

        .submit-btn {
            width: 100%; padding: 14px; background: #10b981; color: white; border: none;
            border-radius: 12px; font-size: 14px; font-weight: 700; cursor: pointer;
            transition: all 0.2s;
        }
        .submit-btn:hover:not(:disabled) { background: #059669; }
        .submit-btn:disabled { background: #d1d5db; cursor: not-allowed; }

        .whatsapp-opt { display: flex; align-items: center; gap: 8px; margin-top: 12px; font-size: 12px; font-weight: 600; color: #059669; cursor: pointer; }
        .status { text-align: center; margin-top: 10px; font-size: 11px; color: #6b7280; }
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
            <div class="field-group">
                <label class="label">Monto de la Venta ($)</label>
                <input type="text" id="amount-input" class="amount-input" value="${String(detectedAmount).replace('.', ',')}">
                <div id="pts-preview" class="pts-preview">Calculando puntos...</div>
            </div>

            <div class="field-group" style="position:relative;">
                <label class="label">Cliente</label>
                <input type="text" id="search-input" placeholder="Nombre, DNI o Nº Socio..." autocomplete="off">
                <div id="results-list" class="results" style="display:none;"></div>
                <div id="selected-info" style="display:none; margin-top:8px; padding:8px; background:#ecfdf5; border:1px solid #10b981; border-radius:8px; text-align:center; font-weight:700; color:#065f46; font-size:12px;"></div>
            </div>

            <div class="promo-box">
                <div style="font-size:10px; font-weight:800; color:#9ca3af; margin-bottom:8px; text-transform:uppercase;">Promociones Aplicables</div>
                <div id="promo-list">
                    ${activePromotions.length > 0 ? activePromotions.map(p => `
                        <label class="promo-item">
                            <input type="checkbox" class="promo-checkbox" data-id="${p.id}" checked>
                            <span>${p.title}</span>
                            <span class="promo-badge">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue + ' pts'}</span>
                        </label>
                    `).join('') : '<div style="font-size:11px; color:#999; text-align:center;">No hay promos hoy</div>'}
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

    // Eventos y Lógica
    const closeBtn = shadow.getElementById('fidelidad-close');
    const searchInp = shadow.getElementById('search-input');
    const amountInp = shadow.getElementById('amount-input');
    const resultsList = shadow.getElementById('results-list');
    const submitBtn = shadow.getElementById('submit-btn');
    const statusMsg = shadow.getElementById('status-msg');
    const selectedInfo = shadow.getElementById('selected-info');
    const whatsappCheck = shadow.getElementById('whatsapp-notify');

    closeBtn.onclick = () => host.remove();

    // Kill events to parent to allow typing
    const kill = (e) => e.stopPropagation();
    panel.addEventListener('keydown', kill, true);
    panel.addEventListener('keyup', kill, true);
    panel.addEventListener('keypress', kill, true);
    panel.addEventListener('mousedown', kill, true);
    panel.addEventListener('mouseup', kill, true);
    panel.addEventListener('click', kill, true);

    amountInp.oninput = (e) => {
        let val = e.target.value.replace(',', '.');
        detectedAmount = parseFloat(val) || 0;
        updateUI();
    };

    shadow.querySelectorAll('.promo-checkbox').forEach(chk => {
        chk.onchange = updateUI;
    });

    let debounce;
    searchInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(debounce);
        if (q.length < 2) {
            resultsList.style.display = 'none';
            return;
        }
        debounce = setTimeout(async () => {
            if (!config.apiUrl || !config.apiKey) return;
            try {
                const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': config.apiKey }
                });
                const data = await res.json();
                if (data.ok) {
                    renderSearch(data.clients);
                }
            } catch (e) { }
        }, 300);
    };

    function renderSearch(cls) {
        if (cls.length === 0) {
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
            it.onclick = (e) => {
                e.stopPropagation();
                selectedClient = { id: it.dataset.id, name: it.dataset.name };
                selectedInfo.innerText = `Cliente: ${selectedClient.name}`;
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
        statusMsg.innerText = 'Enviando puntos...';

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
                renderFinal(data);
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

    function renderFinal(d) {
        shadow.querySelector('.content').innerHTML = `
            <div style="text-align:center; padding: 10px 0;">
                <div style="font-size:40px; margin-bottom:10px;">✅</div>
                <div style="font-weight:800; font-size:16px; color:#10b981; margin-bottom:4px;">Asignación Exitosa</div>
                <div style="margin-bottom:15px; font-size:12px; color:#4b5563;">
                    Se otorgaron <b>${d.pointsAdded}</b> puntos.
                </div>
                ${d.whatsappLink ? `<a href="${d.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:12px; border-radius:10px; font-weight:700; text-decoration:none; margin-bottom:10px;">AVISAR WHATSAPP</a>` : ''}
                <button onclick="document.getElementById('fidelidad-pro-host').remove()" style="width:100%; padding:10px; background:#f3f4f6; border:none; border-radius:10px; font-weight:600; cursor:pointer;">CERRAR</button>
            </div>
        `;
    }

    // Drag and Drop
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
