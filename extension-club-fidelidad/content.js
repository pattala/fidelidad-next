
// Club Fidelidad - Content Script (VERSIÓN 22 - CALCO DEL ORIGINAL)
console.log("🔌 [Club Fidelidad] v22: Restauración Manual de la Versión que Funciona");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;

// Cargar configuración de storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
});

// Función para buscar el monto en el sitio (IDEM ORIGINAL)
function detectAmount() {
    // Buscamos el input por ID (como en la original) o por NAME (por si las dudas)
    let input = document.getElementById('cpbtc_total') || document.querySelector('input[name="cpbtc_total"]');

    if (input && input.value) {
        let val = parseFloat(input.value.replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0 && val !== detectedAmount) {
            detectedAmount = val;
            console.log("💰 [Club Fidelidad] Monto:", detectedAmount);
            showFidelidadPanel();
        }
    }
}

// Observar cambios en el DOM
const observer = new MutationObserver(() => {
    detectAmount();
});
observer.observe(document.body, { childList: true, subtree: true });

// Detección inicial
detectAmount();

function showFidelidadPanel() {
    // Evitar duplicados
    if (document.getElementById('fidelidad-panel')) {
        const amountEl = document.querySelector('.fidelidad-amount');
        if (amountEl) amountEl.innerText = `$ ${detectedAmount.toLocaleString('es-AR')}`;
        return;
    }

    console.log("✨ [Club Fidelidad] Mostrando panel...");

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
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Buscar por Nombre o DNI (mín 3 carac.)..." autocomplete="off">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>
            <div id="fidelidad-selected-info" style="display:none; margin-bottom: 10px; font-size: 13px; color: #6200ee; font-weight: bold;"></div>
            <button id="fidelidad-submit" class="fidelidad-button" disabled>SUMAR PUNTOS</button>
            <div id="fidelidad-status" style="margin-top:10px; font-size: 12px; text-align: center;"></div>
        </div>
    `;

    document.body.appendChild(panel);

    // Eventos
    document.getElementById('fidelidad-close').onclick = () => panel.remove();

    const searchInput = document.getElementById('fidelidad-search');
    const resultsDiv = document.getElementById('fidelidad-results');
    const submitBtn = document.getElementById('fidelidad-submit');
    const selectedInfo = document.getElementById('fidelidad-selected-info');
    const statusDiv = document.getElementById('fidelidad-status');

    // FIX ESCRITURA: Para que el sistema de facturación no bloquee las teclas
    const preventSiteFocusTrap = (e) => e.stopPropagation();
    searchInput.addEventListener('keydown', preventSiteFocusTrap, true);
    searchInput.addEventListener('keyup', preventSiteFocusTrap, true);
    searchInput.addEventListener('keypress', preventSiteFocusTrap, true);

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
                headers: {
                    'Content-Type': 'application/json',
                    'x-api-key': config.apiKey
                },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: detectedAmount,
                    reason: 'external_integration',
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
            submitBtn.innerText = 'REINTENTAR';
        }
    };

    function renderSuccess(data) {
        const body = panel.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div class="fidelidad-success" style="text-align: center; color: #4caf50; padding: 10px;">
                <div style="font-size: 30px;">✅</div>
                <div style="font-weight: bold; margin: 5px 0;">¡Puntos Asignados!</div>
                <div style="font-size: 12px; color: #666; margin-bottom: 10px;">Sumaste ${data.pointsAdded} puntos.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">ABRIR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#eee; color:#333; margin-top:15px;" id="cf-final-close">CERRAR</button>
            </div>
        `;
        document.getElementById('cf-final-close').onclick = () => panel.remove();
    }
}
