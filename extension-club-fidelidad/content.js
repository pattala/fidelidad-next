
// Club Fidelidad - Content Script (VERSIÓN 25 - SUPER AGGRESSIVE TYPING FIX)
console.log("🚀 [Club Fidelidad] v25: Iniciando versión con fijación de escritura agresiva");

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

    if (input && input.value) {
        let val = parseFloat(input.value.replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0) {
            const panelExists = document.getElementById('fidelidad-panel');
            if (val !== detectedAmount || !panelExists) {
                console.log(`💰 [Club Fidelidad] Monto detectado: ${val} (Input: ${input.id || input.name || 'class'})`);
                detectedAmount = val;
                showFidelidadPanel();
            }
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

    document.body.appendChild(panel);

    const searchInput = document.getElementById('fidelidad-search');
    const resultsDiv = document.getElementById('fidelidad-results');
    const submitBtn = document.getElementById('fidelidad-submit');
    const selectedInfo = document.getElementById('fidelidad-selected-info');
    const statusDiv = document.getElementById('fidelidad-status');

    document.getElementById('fidelidad-close').onclick = () => panel.remove();

    // --- FIX ESCRITURA AGRESIVO (v25) ---
    // Atrapamos TODOS los eventos de teclado antes de que lleguen al sistema de facturación
    const killEvent = (e) => {
        if (document.activeElement === searchInput) {
            e.stopPropagation();
            e.stopImmediatePropagation();
            // Permitimos que el evento siga su curso normal dentro del input, 
            // pero que nadie más lo vea.
        }
    };

    // Usamos 'true' para la fase de CAPTURA (antes que nadie)
    window.addEventListener('keydown', killEvent, true);
    window.addEventListener('keyup', killEvent, true);
    window.addEventListener('keypress', killEvent, true);

    // PROTECCIÓN DE FOCO: Si el sitio nos intenta sacar el foco, lo recuperamos
    searchInput.addEventListener('blur', () => {
        // Solo si el panel sigue existiendo, re-enfocamos después de un breve delay
        // si el usuario está interactuando con el componente.
        setTimeout(() => {
            if (document.getElementById('fidelidad-panel') && searchInput.value.length > 0) {
                // Si hay texto, es muy probable que el usuario siga queriendo escribir
                // searchInput.focus(); // Comentado por seguridad, activar si blur es el problema
            }
        }, 10);
    });

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
                    reason: 'v25_aggressive_fix',
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
