// Club Fidelidad - Content Script
console.log("🚀 [Club Fidelidad] Integrador activado en: " + window.location.href);

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;

// Cargar configuración de storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    console.log("⚙️ [Club Fidelidad] Configuración cargada:", config.apiUrl ? "URL: " + config.apiUrl : "URL NO CONFIGURADA");
});

// Función para buscar el monto en el sitio
let isManualAmount = false;

function detectAmount() {
    const pageText = document.body.innerText.toUpperCase();
    const hasConfirmScreen = pageText.includes('CONFIRMAR FACTURA');
    const panel = document.getElementById('fidelidad-panel');

    // Si NO estamos en la pantalla de confirmación, quitamos el panel
    if (!hasConfirmScreen) {
        if (panel) {
            panel.remove();
            detectedAmount = 0;
            isManualAmount = false;
            selectedClient = null;
        }
        return;
    }

    let amount = 0;

    // 1. Buscamos específicamente la frase clave para extraer el monto
    const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let cand of allElements) {
        const text = cand.innerText.trim().toUpperCase();
        if (text.includes('TOTAL A PAGAR $:')) {
            let extracted = parseValue(text);
            if (extracted > 0) {
                amount = extracted;
                break;
            }
        }
    }

    // 2. Si encontramos el monto, mostramos o actualizamos el panel
    if (amount > 0 && amount !== detectedAmount) {
        detectedAmount = amount;
        if (panel) {
            const input = document.getElementById('fidelidad-amount-input');
            if (input && !isManualAmount) {
                input.value = detectedAmount;
            }
        } else {
            showFidelidadPanel();
        }
    } else if (amount > 0 && !panel) {
        // Por si el monto es el mismo pero el panel se cerró
        showFidelidadPanel();
    }
}

function updatePanelAmount() {
    const input = document.getElementById('fidelidad-amount-input');
    if (input) {
        input.value = detectedAmount;
    } else {
        showFidelidadPanel();
    }
}

function parseValue(text) {
    if (!text) return 0;
    // Eliminamos texto y nos quedamos con la parte numérica después del $ o al final
    let parts = text.split('$');
    let target = parts.length > 1 ? parts[1] : parts[0];

    // Limpieza agresiva: solo números, puntos y comas
    let clean = target.replace(/[^0-9,.]/g, '').trim();

    if (!clean) return 0;

    // Lógica para detectar miles vs decimales (AR: 1.250,50 o 1250,50)
    if (clean.includes('.') && clean.includes(',')) {
        // Formato con ambos: el punto es miles, la coma es decimal
        clean = clean.replace(/\./g, '').replace(',', '.');
    } else if (clean.includes(',')) {
        // Solo coma: es decimal
        clean = clean.replace(',', '.');
    } else if (clean.includes('.') && clean.split('.').pop().length !== 2) {
        // Si hay punto pero la parte final no tiene 2 dígitos, probable es miles
        // (Ej: 1.500 -> 1500)
        clean = clean.replace(/\./g, '');
    }

    return parseFloat(clean) || 0;
}

// Escaneo continuo acelerado para que se sienta reactivo
setInterval(detectAmount, 1000);

function showFidelidadPanel() {
    if (document.getElementById('fidelidad-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';
    panel.innerHTML = `
        <div class="fidelidad-header">
            <h1>Sumar Puntos</h1>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <div class="fidelidad-amount-container">
                <div class="fidelidad-amount-label">Monto de la venta</div>
                <input type="number" id="fidelidad-amount-input" class="fidelidad-amount-input" value="${detectedAmount}" step="0.01">
            </div>
            <div class="fidelidad-search-container">
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Nombre, DNI o Nº Socio...">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>
            <div id="fidelidad-selected-info" style="display:none; margin-bottom: 10px; font-size: 13px; color: #6200ee; font-weight: bold;"></div>
            <button id="fidelidad-submit" class="fidelidad-button" disabled>SUMAR PUNTOS</button>
            <div id="fidelidad-status" style="margin-top:10px; font-size: 12px; text-align: center;"></div>
        </div>
    `;

    document.body.appendChild(panel);

    // --- Lógica de Arrastre (Drag and Drop) ---
    const header = panel.querySelector('.fidelidad-header');
    let isDragging = false;
    let offset = { x: 0, y: 0 };

    header.onmousedown = (e) => {
        isDragging = true;
        offset.x = e.clientX - panel.offsetLeft;
        offset.y = e.clientY - panel.offsetTop;
        header.style.cursor = 'grabbing';
    };

    document.onmousemove = (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - offset.x) + 'px';
        panel.style.top = (e.clientY - offset.y) + 'px';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
    };

    document.onmouseup = () => {
        isDragging = false;
        header.style.cursor = 'move';
    };

    // Eventos
    document.getElementById('fidelidad-close').onclick = () => panel.remove();

    const searchInput = document.getElementById('fidelidad-search');
    const amountInput = document.getElementById('fidelidad-amount-input');
    const resultsDiv = document.getElementById('fidelidad-results');
    const submitBtn = document.getElementById('fidelidad-submit');
    const selectedInfo = document.getElementById('fidelidad-selected-info');
    const statusDiv = document.getElementById('fidelidad-status');

    amountInput.oninput = (e) => {
        isManualAmount = true;
        detectedAmount = parseFloat(e.target.value) || 0;
    };

    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value;
        if (q.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }
        // Predictive feel: faster debounce
        searchTimeout = setTimeout(() => searchClients(q), 300);
    };

    async function searchClients(q) {
        if (!config.apiUrl || !config.apiKey) {
            statusDiv.innerText = '⚠️ Configura la API en la extensión';
            return;
        }

        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            const data = await res.json();
            if (data.ok && data.clients.length > 0) {
                renderResults(data.clients);
            } else {
                resultsDiv.innerHTML = '<div class="fidelidad-result-item">No se encontraron clientes</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (e) {
            statusDiv.innerText = '❌ Error de conexión';
        }
    }

    function renderResults(clients) {
        resultsDiv.innerHTML = clients.map(c => `
            <div class="fidelidad-result-item" data-id="${c.id}" data-name="${c.name}" data-dni="${c.dni}" data-socio="${c.socio_number || ''}">
                <div style="font-weight:bold;">${c.name}</div>
                <div class="dni">DNI: ${c.dni} ${c.socio_number ? ` | Socio: #${c.socio_number}` : ''}</div>
            </div>
        `).join('');
        resultsDiv.style.display = 'block';

        const items = resultsDiv.getElementsByClassName('fidelidad-result-item');
        for (let item of items) {
            item.onclick = () => {
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
        if (!selectedClient) return;
        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';

        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey
                },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'external_integration',
                    concept: 'Compra en local'
                })
            });

            const data = await res.json();
            if (data.ok) {
                renderSuccess(data);
            } else {
                statusDiv.innerText = `❌ Error: ${data.error}`;
                submitBtn.disabled = false;
                submitBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            statusDiv.innerText = '❌ Error de conexión final';
            submitBtn.disabled = false;
            submitBtn.innerText = 'REINTENTAR';
        }
    };

    function renderSuccess(data) {
        const body = document.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div class="fidelidad-success">
                <div style="font-size: 40px;">✅</div>
                <div style="font-weight: bold; margin: 10px 0;">¡Puntos Asignados!</div>
                <div style="font-size: 13px; color: #666;">Se sumaron ${data.pointsAdded} puntos a ${selectedClient.name}.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">ABRIR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#eee; color:#333; margin-top:20px;" onclick="document.getElementById('fidelidad-panel').remove()">CERRAR</button>
            </div>
        `;
    }
}
