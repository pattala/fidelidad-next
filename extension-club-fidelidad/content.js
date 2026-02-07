
// Club Fidelidad - Content Script (VERSIÓN 21 - RESTAURACIÓN TOTAL)
console.log("🔌 [Club Fidelidad] v21: Restaurando versión original (Violeta)");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let selectedClient = null;

// Cargar configuración de storage
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    console.log("📦 [Club Fidelidad] Configuración cargada");
});

// Función para buscar el monto en el sitio
function detectAmount() {
    // Usamos el ID original que sabemos que funciona en tu facturador
    const input = document.getElementById('cpbtc_total');

    if (input && input.value) {
        let val = parseFloat(input.value.replace(/[^0-9.,]/g, '').replace(',', '.'));

        // Si el valor es válido y mayor a cero
        if (!isNaN(val) && val > 0) {
            // Si el monto cambió o el panel no existe, lo mostramos
            if (val !== detectedAmount || !document.getElementById('fidelidad-panel')) {
                detectedAmount = val;
                console.log("💰 [Club Fidelidad] Monto detectado:", detectedAmount);
                showFidelidadPanel();
            }
        }
    } else {
        // Si no está el input del monto, removemos el panel
        const existing = document.getElementById('fidelidad-panel');
        if (existing) {
            existing.remove();
            detectedAmount = 0;
            selectedClient = null;
        }
    }
}

// Observar el DOM para detectar apariciones del modal
const observer = new MutationObserver(() => {
    detectAmount();
});
observer.observe(document.body, { childList: true, subtree: true });

// Ejecución inicial
detectAmount();

function showFidelidadPanel() {
    // Si ya existe, solo actualizamos el monto
    if (document.getElementById('fidelidad-panel')) {
        const amountEl = document.querySelector('.fidelidad-amount');
        if (amountEl) amountEl.innerText = `$ ${detectedAmount.toLocaleString('es-AR')}`;
        return;
    }

    console.log("✨ [Club Fidelidad] Inyectando panel violeta original");

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
            <div class="fidelidad-search-container">
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
    document.getElementById('fidelidad-close').onclick = () => {
        panel.remove();
    };

    const searchInput = document.getElementById('fidelidad-search');
    const resultsDiv = document.getElementById('fidelidad-results');
    const submitBtn = document.getElementById('fidelidad-submit');
    const selectedInfo = document.getElementById('fidelidad-selected-info');
    const statusDiv = document.getElementById('fidelidad-status');

    // ARREGLO PARA ESCRIBIR: stopPropagation para saltar el bloqueo del facturador
    const stopPropagation = (e) => e.stopPropagation();
    searchInput.addEventListener('keydown', stopPropagation, true);
    searchInput.addEventListener('keyup', stopPropagation, true);
    searchInput.addEventListener('keypress', stopPropagation, true);

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
                    reason: 'v21_legacy_restored',
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
