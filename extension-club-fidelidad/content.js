// Club Fidelidad - Content Script Simplified
console.log("🚀 [Club Fidelidad] Integrador v2 activado");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;
let pointsMoneyBase = 100;
let pointsPerPeso = 1;

// Cargar configuración de storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    fetchRules();
});

async function fetchRules() {
    if (!config.apiUrl || !config.apiKey) return;
    try {
        const res = await fetch(`${config.apiUrl}/api/assign-points?q=___`, {
            headers: { 'x-api-key': config.apiKey }
        });
        const data = await res.json();
        if (data.pointsMoneyBase) pointsMoneyBase = data.pointsMoneyBase;
        if (data.pointsPerPeso) pointsPerPeso = data.pointsPerPeso;
        updatePanelPoints();
    } catch (e) { }
}

function updatePanelPoints() {
    const ptsEl = document.getElementById('fidelidad-points-preview');
    if (ptsEl) {
        const pts = Math.floor((detectedAmount / pointsMoneyBase) * pointsPerPeso);
        ptsEl.innerText = `Equivale a ${pts} puntos`;
    }
}

// Función para buscar el monto en el sitio
let isManualAmount = false;

function detectAmount() {
    const pageText = document.body.innerText.toUpperCase();
    const hasConfirmScreen = pageText.includes('CONFIRMAR FACTURA');
    const panel = document.getElementById('fidelidad-panel');

    if (!hasConfirmScreen) {
        if (panel) panel.remove();
        detectedAmount = 0;
        isManualAmount = false;
        selectedClient = null;
        return;
    }

    let amount = 0;
    const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let cand of allElements) {
        const text = cand.innerText.trim().toUpperCase();
        if (text.includes('TOTAL A PAGAR $:')) {
            amount = parseValue(text);
            if (amount > 0) break;
        }
    }

    if (amount > 0 && amount !== detectedAmount) {
        detectedAmount = amount;
        if (panel) {
            const input = document.getElementById('fidelidad-amount-input');
            if (input && !isManualAmount) {
                input.value = String(detectedAmount).replace('.', ',');
                updatePanelPoints();
            }
        } else {
            showFidelidadPanel();
        }
    } else if (amount > 0 && !panel) {
        showFidelidadPanel();
    }
}

function parseValue(text) {
    if (!text) return 0;
    let parts = text.split('$');
    let target = parts.length > 1 ? parts[1] : parts[0];
    let clean = target.replace(/[^0-9,.]/g, '').trim();
    if (!clean) return 0;
    if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
    else if (clean.includes(',')) clean = clean.replace(',', '.');
    return parseFloat(clean) || 0;
}

setInterval(detectAmount, 1000);

function showFidelidadPanel() {
    if (document.getElementById('fidelidad-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';
    panel.innerHTML = `
        <div class="fidelidad-header" id="fidelidad-header">
            <h1>Sumar Puntos</h1>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <div class="fidelidad-amount-container">
                <div class="fidelidad-amount-label">Monto de la venta</div>
                <input type="text" id="fidelidad-amount-input" class="fidelidad-amount-input" value="${String(detectedAmount).replace('.', ',')}">
                <div id="fidelidad-points-preview" class="fidelidad-points-preview">Calculando puntos...</div>
            </div>
            <div class="fidelidad-search-container">
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Nombre, DNI o Nº Socio..." autocomplete="off">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>
            <div id="fidelidad-selected-info" style="display:none; margin-bottom: 15px; font-size: 13px; color: #6200ee; font-weight: bold; text-align: center;"></div>
            <button id="fidelidad-submit" class="fidelidad-button" disabled>SUMAR PUNTOS</button>
            <div id="fidelidad-status" style="margin-top:10px; font-size: 12px; text-align: center; color: #666;"></div>
        </div>
    `;

    document.body.appendChild(panel);
    updatePanelPoints();

    // Eventos Básicos (Como la Ver 1)
    document.getElementById('fidelidad-close').onclick = () => panel.remove();

    const searchInput = document.getElementById('fidelidad-search');
    const amountInput = document.getElementById('fidelidad-amount-input');
    const resultsDiv = document.getElementById('fidelidad-results');
    const submitBtn = document.getElementById('fidelidad-submit');
    const selectedInfo = document.getElementById('fidelidad-selected-info');
    const statusDiv = document.getElementById('fidelidad-status');

    // Bloquear propagación para permitir escribir
    const stopProp = (e) => e.stopPropagation();
    searchInput.onkeydown = stopProp;
    searchInput.onkeyup = stopProp;
    searchInput.onkeypress = stopProp;
    amountInput.onkeydown = stopProp;

    amountInput.oninput = (e) => {
        isManualAmount = true;
        let val = e.target.value.replace(',', '.');
        detectedAmount = parseFloat(val) || 0;
        updatePanelPoints();
    };

    let t;
    searchInput.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(t);
        if (q.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }
        t = setTimeout(() => searchClients(q), 300);
    };

    async function searchClients(q) {
        if (!config.apiUrl || !config.apiKey) return;
        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            const data = await res.json();
            if (data.ok) {
                if (data.pointsMoneyBase) pointsMoneyBase = data.pointsMoneyBase;
                if (data.pointsPerPeso) pointsPerPeso = data.pointsPerPeso;
                updatePanelPoints();
                renderResults(data.clients);
            }
        } catch (e) { }
    }

    function renderResults(clients) {
        if (clients.length === 0) {
            resultsDiv.innerHTML = '<div class="fidelidad-result-item">No hay resultados</div>';
        } else {
            resultsDiv.innerHTML = clients.map(c => `
                <div class="fidelidad-result-item" data-id="${c.id}" data-name="${c.name}">
                    <div style="font-weight:bold">${c.name}</div>
                    <div style="font-size:10px; color:#666">DNI: ${c.dni} ${c.socio_number ? `| Socio: #${c.socio_number}` : ''}</div>
                </div>
            `).join('');
        }
        resultsDiv.style.display = 'block';

        const items = resultsDiv.getElementsByClassName('fidelidad-result-item');
        for (let item of items) {
            item.onclick = (e) => {
                e.stopPropagation();
                selectedClient = { id: item.dataset.id, name: item.dataset.name };
                selectedInfo.innerText = `Cliente: ${selectedClient.name}`;
                selectedInfo.style.display = 'block';
                resultsDiv.style.display = 'none';
                searchInput.value = selectedClient.name;
                submitBtn.disabled = false;
            };
        }
    }

    submitBtn.onclick = async () => {
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
                    concept: 'Venta local'
                })
            });
            const data = await res.json();
            if (data.ok) {
                renderSuccess(data);
            } else {
                statusDiv.innerText = `Error: ${data.error}`;
                submitBtn.disabled = false;
                submitBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            statusDiv.innerText = 'Error de red';
            submitBtn.disabled = false;
        }
    };

    function renderSuccess(data) {
        const body = document.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div class="fidelidad-success" style="text-align:center; padding: 20px 0;">
                <div style="font-size:40px; margin-bottom:10px;">✅</div>
                <div style="font-weight:bold; margin-bottom:5px;">¡Puntos Sumados!</div>
                <div style="font-size:12px; color:#666; margin-bottom:15px;">Se asignaron ${data.pointsAdded} puntos.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-button" style="background:#25d366; text-decoration:none; display:block; margin-bottom:10px;">AVISAR POR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#eee; color:#333;" onclick="document.getElementById('fidelidad-panel').remove()">CERRAR</button>
            </div>
        `;
    }

    // Draggable (Header)
    let isDragging = false, offset = { x: 0, y: 0 };
    document.getElementById('fidelidad-header').onmousedown = (e) => {
        isDragging = true;
        offset.x = e.clientX - panel.offsetLeft;
        offset.y = e.clientY - panel.offsetTop;
    };
    document.onmousemove = (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - offset.x) + 'px';
        panel.style.top = (e.clientY - offset.y) + 'px';
        panel.style.right = 'auto'; panel.style.bottom = 'auto';
    };
    document.onmouseup = () => isDragging = false;
}
