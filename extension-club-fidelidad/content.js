// Club Fidelidad - Integrador Premium v2
console.log("🚀 [Club Fidelidad] Cargando Integrador Premium...");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;
let pointsMoneyBase = 100;
let pointsPerPeso = 1;

// Configuración de Storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    if (config.apiUrl) fetchRules();
});

async function fetchRules() {
    try {
        const res = await fetch(`${config.apiUrl}/api/assign-points?q=___`, {
            headers: { 'x-api-key': config.apiKey }
        });
        const data = await res.json();
        if (data.pointsMoneyBase) pointsMoneyBase = Number(data.pointsMoneyBase);
        if (data.pointsPerPeso) pointsPerPeso = Number(data.pointsPerPeso);
        console.log(`📊 [Club Fidelidad] Reglas cargadas: $${pointsMoneyBase} = ${pointsPerPeso} pts`);
        updatePreview();
    } catch (e) {
        console.error("❌ [Club Fidelidad] Error cargando reglas:", e);
    }
}

function updatePreview() {
    const shadow = document.getElementById('fidelidad-container')?.shadowRoot;
    if (!shadow) return;
    const ptsEl = shadow.getElementById('pts-preview');
    if (ptsEl) {
        const pts = Math.floor((detectedAmount / pointsMoneyBase) * pointsPerPeso);
        ptsEl.innerText = `Equivale a ${pts} puntos`;
    }
}

// Detector de pantalla de facturación
function detectBilling() {
    const pageText = document.body.innerText.toUpperCase();
    const hasConfirm = pageText.includes('CONFIRMAR FACTURA');
    const container = document.getElementById('fidelidad-container');

    if (!hasConfirm) {
        if (container) container.remove();
        detectedAmount = 0;
        selectedClient = null;
        return;
    }

    let amount = 0;
    const all = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of all) {
        const text = el.innerText.trim();
        if (text.toUpperCase().includes('TOTAL A PAGAR $:')) {
            amount = parseAmount(text);
            if (amount > 0) break;
        }
    }

    if (amount > 0 && amount !== detectedAmount) {
        detectedAmount = amount;
        if (container) {
            const input = container.shadowRoot.getElementById('amount-input');
            if (input) {
                input.value = String(detectedAmount).replace('.', ',');
                updatePreview();
            }
        } else {
            injectPanel();
        }
    } else if (amount > 0 && !container) {
        injectPanel();
    }
}

function parseAmount(text) {
    let parts = text.split('$');
    let target = parts.length > 1 ? parts[1] : parts[0];
    let clean = target.replace(/[^0-9,.]/g, '').trim();
    if (!clean) return 0;
    if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
    else if (clean.includes(',')) clean = clean.replace(',', '.');
    return parseFloat(clean) || 0;
}

setInterval(detectBilling, 1000);

// Inyección de Panel con Shadow DOM (Aislamiento Total)
function injectPanel() {
    if (document.getElementById('fidelidad-container')) return;

    const host = document.createElement('div');
    host.id = 'fidelidad-container';
    host.style.all = 'initial';
    host.style.position = 'fixed';
    host.style.top = '20px';
    host.style.right = '20px';
    host.style.zIndex = '2147483647';
    document.body.appendChild(host);

    const shadow = host.attachShadow({ mode: 'open' });

    // Estilos Premium (Basados en el diseño que pasaste)
    const style = document.createElement('style');
    style.textContent = `
        :host {
            font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            user-select: none;
        }
        .panel {
            width: 320px;
            background: white;
            border-radius: 16px;
            box-shadow: 0 20px 50px rgba(0,0,0,0.3);
            overflow: hidden;
            display: flex;
            flex-direction: column;
            animation: slideIn 0.3s ease-out;
            border: 1px solid rgba(0,0,0,0.1);
        }
        @keyframes slideIn { from { transform: translateX(50px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }
        
        .header {
            background: #15a34a; /* Verde como en la foto */
            color: white;
            padding: 16px 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            cursor: move;
        }
        .header h1 { font-size: 18px; margin: 0; font-weight: 700; }
        .close { cursor: pointer; font-size: 24px; line-height: 1; opacity: 0.8; }
        .close:hover { opacity: 1; }

        .body { padding: 20px; }

        .tabs {
            display: flex;
            background: #f3f4f6;
            padding: 4px;
            border-radius: 10px;
            margin-bottom: 20px;
        }
        .tab {
            flex: 1;
            padding: 8px;
            text-align: center;
            font-size: 12px;
            font-weight: 600;
            color: #6b7280;
            cursor: pointer;
            border-radius: 8px;
        }
        .tab.active { background: white; color: #1e40af; shadow: 0 2px 4px rgba(0,0,0,0.05); }

        .field-group { margin-bottom: 18px; }
        .label { font-size: 12px; font-weight: 700; color: #374151; margin-bottom: 6px; display: block; text-transform: uppercase; letter-spacing: 0.5px; }
        
        input {
            width: 100%;
            padding: 12px;
            border: 2px solid #e5e7eb;
            border-radius: 10px;
            box-sizing: border-box;
            font-size: 14px;
            outline: none;
            transition: all 0.2s;
            color: #111827;
            background: #f9fafb;
            user-select: text !important;
        }
        input:focus { border-color: #15a34a; background: white; box-shadow: 0 0 0 4px rgba(21, 163, 74, 0.1); }

        .amount-input { font-size: 24px; font-weight: 800; text-align: center; color: #15a34a; }
        .pts-preview { text-align: center; font-size: 13px; font-weight: 700; color: #15a34a; margin-top: 8px; background: #f0fdf4; padding: 4px; border-radius: 6px; }

        .results {
            background: white; border: 1px solid #e5e7eb; border-radius: 10px; margin-top: 5px;
            max-height: 180px; overflow-y: auto; box-shadow: 0 4px 6px rgba(0,0,0,0.05);
        }
        .result-item { padding: 10px 15px; border-bottom: 1px solid #f3f4f6; cursor: pointer; }
        .result-item:hover { background: #f0fdf4; }
        .result-item b { display: block; font-size: 14px; }
        .result-item span { font-size: 11px; color: #6b7280; }

        .btn-submit {
            width: 100%; padding: 16px; background: #15a34a; color: white; border: none;
            border-radius: 12px; font-size: 16px; font-weight: 700; cursor: pointer;
            transition: all 0.2s; box-shadow: 0 4px 14px rgba(21, 163, 74, 0.4);
        }
        .btn-submit:disabled { background: #d1d5db; box-shadow: none; cursor: not-allowed; }
        .btn-submit:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(21, 163, 74, 0.4); }

        .status { margin-top: 12px; text-align: center; font-size: 12px; color: #6b7280; }
        
        /* Checkbox Styles like in the screenshot */
        .promo-list { background: #f9fafb; border-radius: 12px; padding: 12px; margin-top: 10px; display: none; }
        .promo-item { display: flex; align-items: center; gap: 8px; font-size: 11px; margin-bottom: 6px; }
        .promo-item input { width: auto; }
    `;
    shadow.appendChild(style);

    const panel = document.createElement('div');
    panel.className = 'panel';
    panel.innerHTML = `
        <div class="header" id="drag-handle">
            <h1>Sumar Puntos</h1>
            <span class="close" id="close-btn">×</span>
        </div>
        <div class="body">
            <div class="tabs">
                <div class="tab active">Por Monto ($)</div>
                <div class="tab">Puntos Directos</div>
            </div>

            <div class="field-group">
                <label class="label">Monto de la Compra ($)</label>
                <input type="text" id="amount-input" class="amount-input" value="${String(detectedAmount).replace('.', ',')}">
                <div id="pts-preview" class="pts-preview">Calculando puntos...</div>
            </div>

            <div class="field-group">
                <label class="label">Cliente (Nombre, DNI o Nº Socio)</label>
                <input type="text" id="search-input" placeholder="Escriba aquí..." autocomplete="off">
                <div id="results-list" class="results" style="display:none;"></div>
            </div>

            <div id="selected-client-box" style="display:none; margin-bottom: 15px; padding: 10px; background: #f0fdf4; border-radius: 8px; border: 1px solid #bbf7d0; text-align: center;">
                <span id="selected-name" style="font-weight: 800; color: #15a34a; font-size: 14px;"></span>
            </div>

            <button id="submit-btn" class="btn-submit" disabled>ASIGNAR PUNTOS</button>
            <div id="status-msg" class="status"></div>
        </div>
    `;
    shadow.appendChild(panel);

    // --- Lógica de Eventos ---
    const closeBtn = shadow.getElementById('close-btn');
    const searchInp = shadow.getElementById('search-input');
    const amountInp = shadow.getElementById('amount-input');
    const resultsList = shadow.getElementById('results-list');
    const submitBtn = shadow.getElementById('submit-btn');
    const statusMsg = shadow.getElementById('status-msg');
    const selectedBox = shadow.getElementById('selected-client-box');
    const selectedName = shadow.getElementById('selected-name');

    closeBtn.onclick = () => host.remove();

    // ESCUDO NUCLEAR PARA ESCRITURA
    // En el shadow DOM, los eventos aún burbujean al documento. Debemos detenerlos.
    const killEvents = (e) => {
        e.stopPropagation();
        // No llamamos preventDefault() porque queremos que el input funcione.
    };

    [searchInp, amountInp].forEach(inp => {
        inp.addEventListener('keydown', killEvents, true);
        inp.addEventListener('keyup', killEvents, true);
        inp.addEventListener('keypress', killEvents, true);

        // Bloquear clics que salgan al facturador
        inp.addEventListener('mousedown', killEvents, true);
    });

    amountInp.oninput = (e) => {
        const val = e.target.value.replace(',', '.');
        detectedAmount = parseFloat(val) || 0;
        updatePreview();
    };

    let searchDebounce;
    searchInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(searchDebounce);
        if (q.length < 2) {
            resultsList.style.display = 'none';
            return;
        }
        searchDebounce = setTimeout(() => searchAction(q), 300);
    };

    async function searchAction(q) {
        if (!config.apiUrl || !config.apiKey) return;
        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            const data = await res.json();
            if (data.ok) {
                // Actualizar reglas si vienen en el search
                if (data.pointsMoneyBase) pointsMoneyBase = data.pointsMoneyBase;
                if (data.pointsPerPeso) pointsPerPeso = data.pointsPerPeso;
                updatePreview();

                if (data.clients.length > 0) {
                    renderClients(data.clients);
                } else {
                    resultsList.innerHTML = '<div class="result-item"><span>Sin resultados</span></div>';
                    resultsList.style.display = 'block';
                }
            }
        } catch (e) { console.error(e); }
    }

    function renderClients(clients) {
        resultsList.innerHTML = clients.map(c => `
            <div class="result-item" data-id="${c.id}" data-name="${c.name}">
                <b>${c.name}</b>
                <span>DNI: ${c.dni} ${c.socio_number ? `| Socio: #${c.socio_number}` : ''}</span>
            </div>
        `).join('');
        resultsList.style.display = 'block';

        const items = resultsList.querySelectorAll('.result-item');
        items.forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                selectedClient = { id: item.dataset.id, name: item.dataset.name };
                selectedName.innerText = selectedClient.name;
                selectedBox.style.display = 'block';
                resultsList.style.display = 'none';
                searchInp.value = selectedClient.name;
                submitBtn.disabled = false;
            };
        });
    }

    submitBtn.onclick = async () => {
        if (!selectedClient) return;
        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';
        statusMsg.innerText = 'Enviando al sistema de fidelidad...';

        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'external_integration',
                    concept: 'Venta local'
                })
            });
            const data = await res.json();
            if (data.ok) {
                renderDone(data);
            } else {
                statusMsg.innerText = `❌ Error: ${data.error}`;
                submitBtn.disabled = false;
                submitBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            statusMsg.innerText = '❌ Error de conexión';
            submitBtn.disabled = false;
        }
    };

    function renderDone(data) {
        shadow.querySelector('.body').innerHTML = `
            <div style="text-align: center; padding: 20px 0;">
                <div style="font-size: 50px; margin-bottom: 10px;">✅</div>
                <div style="font-weight: 800; font-size: 18px; color: #15a34a; margin-bottom: 5px;">¡Listo!</div>
                <div style="font-size: 14px; color: #4b5563; margin-bottom: 20px;">
                    Se asignaron <b>${data.pointsAdded}</b> puntos a <b>${selectedClient.name}</b>.
                </div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" style="display: block; background: #25d366; color: white; padding: 14px; border-radius: 12px; font-weight: 700; text-decoration: none; margin-bottom: 10px; box-shadow: 0 4px 10px rgba(37, 211, 102, 0.3);">NOTIFICAR POR WHATSAPP</a>` : ''}
                <button id="final-close" style="width: 100%; padding: 12px; background: #f3f4f6; color: #374151; border: none; border-radius: 10px; font-weight: 600; cursor: pointer;">CERRAR VENTANA</button>
            </div>
        `;
        shadow.getElementById('final-close').onclick = () => host.remove();
    }

    // Draggable (Drag Handle)
    let isDragging = false, offset = { x: 0, y: 0 };
    shadow.getElementById('drag-handle').onmousedown = (e) => {
        isDragging = true;
        offset.x = e.clientX - host.offsetLeft;
        offset.y = e.clientY - host.offsetTop;
    };
    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        host.style.left = (e.clientX - offset.x) + 'px';
        host.style.top = (e.clientY - offset.y) + 'px';
    });
    document.addEventListener('mouseup', () => isDragging = false);

    updatePreview();
}
