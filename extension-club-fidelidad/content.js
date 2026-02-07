
// Club Fidelidad - Content Script (VERSIÓN 29 - MODAL INFILTRATION)
console.log("🚀 [Club Fidelidad] v29: Iniciando versión con infiltración en modal");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;

// Cargar configuración de storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
});

// Función para buscar el monto en el sitio
function detectAmount() {
    const selectors = [
        '#cpbtc_total',
        'input[name="cpbtc_total"]',
        '#total_pago',
        'input[name="total_pago"]',
        '#monto_pago',
        'input[name="monto_pago"]',
        '#importe_total',
        'input[name="importe_total"]',
        '.total-import'
    ];

    let input = null;
    for (let s of selectors) {
        input = document.querySelector(s);
        if (input) break;
    }

    let val = 0;
    if (input && input.value) {
        val = parseFloat(input.value.replace(/[^0-9.,]/g, '').replace(',', '.'));
    } else {
        const bodyContent = document.body.innerText;
        const match = bodyContent.match(/Total a pagar \$:\s*([0-9.,]+)/i) ||
            bodyContent.match(/Total a pagar\s*\$?:\s*([0-9.,]+)/i) ||
            bodyContent.match(/Monto Total\s*\$?:\s*([0-9.,]+)/i);

        if (match && match[1]) {
            val = parseFloat(match[1].replace(/[^0-9.,]/g, '').replace(',', '.'));
        }
    }

    if (!isNaN(val) && val > 0) {
        const panelExists = document.getElementById('fidelidad-panel');
        if (val !== detectedAmount || !panelExists) {
            console.log(`💰 [Club Fidelidad] Monto detectado: ${val}`);
            detectedAmount = val;
            showFidelidadPanel();
        }
    }
}

const observer = new MutationObserver(() => detectAmount());
observer.observe(document.body, { childList: true, subtree: true });
detectAmount();

function showFidelidadPanel() {
    if (document.getElementById('fidelidad-panel')) {
        const amountEl = document.querySelector('.fidelidad-amount');
        if (amountEl) amountEl.innerText = `$ ${detectedAmount.toLocaleString('es-AR')}`;
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';
    panel.innerHTML = `
        <div class="fidelidad-header">
            <h1>Sumar Puntos</h1>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <div class="fidelidad-amount">$ ${detectedAmount.toLocaleString('es-AR')}</div>
            <div class="fidelidad-search-container" style="position:relative;">
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Buscar por Nombre o DNI..." autocomplete="off">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>
            <div id="fidelidad-selected-info" style="display:none; margin-bottom: 10px; font-size: 13px; color: #6200ee; font-weight: bold;"></div>
            <button id="fidelidad-submit" class="fidelidad-button" disabled>SUMAR PUNTOS</button>
            <div id="fidelidad-status" style="margin-top:10px; font-size: 12px; text-align: center;"></div>
        </div>
    `;

    // --- ESTRATEGIA DE INFILTRACIÓN (v29) ---
    // Buscamos el modal para inyectarnos ADENTRO y saltar el focus-trap
    const modalSelectors = ['.modal-content', '.modal-body', '.bootbox', '.ui-dialog-content', '.sky-modal', '[role="dialog"]'];
    let injector = document.body;
    for (let sel of modalSelectors) {
        const found = document.querySelector(sel);
        if (found) {
            injector = found;
            console.log("🎯 [Club Fidelidad] Infiltrando en modal:", sel);
            break;
        }
    }
    injector.appendChild(panel);

    const searchInput = document.getElementById('fidelidad-search');
    const resultsDiv = document.getElementById('fidelidad-results');
    const submitBtn = document.getElementById('fidelidad-submit');
    const selectedInfo = document.getElementById('fidelidad-selected-info');
    const statusDiv = document.getElementById('fidelidad-status');

    function killEvent(e) {
        if (document.activeElement === searchInput) {
            e.stopPropagation();
            e.stopImmediatePropagation();
        }
    }

    window.addEventListener('keydown', killEvent, true);
    window.addEventListener('keyup', killEvent, true);
    window.addEventListener('keypress', killEvent, true);

    document.getElementById('fidelidad-close').onclick = () => {
        window.removeEventListener('keydown', killEvent, true);
        window.removeEventListener('keyup', killEvent, true);
        window.removeEventListener('keypress', killEvent, true);
        panel.remove();
    };

    // FOCO PERSISTENTE MIENTRAS ESTÉ ACTIVO
    let focusInterval;
    searchInput.onfocus = () => {
        focusInterval = setInterval(() => {
            if (document.activeElement !== searchInput && document.getElementById('fidelidad-panel')) {
                searchInput.focus();
            }
        }, 50);
    };
    searchInput.onblur = () => clearInterval(focusInterval);

    setTimeout(() => searchInput.focus(), 300);

    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value;
        if (q.length < 3) {
            resultsDiv.style.display = 'none';
            return;
        }
        searchTimeout = setTimeout(() => searchClients(q), 500);
    };

    async function searchClients(q) {
        if (!config.apiUrl || !config.apiKey) {
            statusDiv.innerText = '⚠️ Configura la API';
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
            <div class="fidelidad-result-item" data-id="${c.id}" data-name="${c.name}" data-dni="${c.dni}">
                <div>${c.name}</div>
                <div class="dni">DNI: ${c.dni}</div>
            </div>
        `).join('');
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
        if (!selectedClient) return;
        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';
        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'v29_modal_infiltration',
                    concept: 'Compra en local',
                    applyWhatsApp: true
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
            statusDiv.innerText = '❌ Error de conexión';
            submitBtn.disabled = false;
        }
    };

    function renderSuccess(data) {
        const body = document.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div class="fidelidad-success" style="text-align: center; color: #4caf50; padding: 10px;">
                <div style="font-size: 30px;">✅</div>
                <div style="font-weight: bold; margin: 5px 0;">¡Éxito!</div>
                <div style="font-size: 12px; color: #666;">Se sumaron ${data.pointsAdded} puntos.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#eee; color:#333; margin-top:15px;" id="cf-final-close">CERRAR</button>
            </div>
        `;
        document.getElementById('cf-final-close').onclick = () => panel.remove();
    }
}
