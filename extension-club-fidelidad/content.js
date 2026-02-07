
// Club Fidelidad - Content Script (VERSIÓN ORIGINAL RECUPERADA v20)
console.log("✅ [Club Fidelidad] v20: Restaurando versión original funcional");

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
    // ESTA ES LA CLAVE: El ID del input original que el facturador usa para el monto
    const input = document.getElementById('cpbtc_total');
    if (input && input.value) {
        let val = parseFloat(input.value.replace(/[^0-9.,]/g, '').replace(',', '.'));
        if (!isNaN(val) && val > 0 && val !== detectedAmount) {
            detectedAmount = val;
            console.log("💰 [Club Fidelidad] Monto detectado:", detectedAmount);
            showFidelidadPanel();
        }
    }
}

// Observar cambios en el DOM
const observer = new MutationObserver(() => {
    detectAmount();
});

observer.observe(document.body, { childList: true, subtree: true });

// También ejecutamos la detección inicialmente
detectAmount();

function showFidelidadPanel() {
    // Evitar duplicados
    if (document.getElementById('fidelidad-panel')) {
        // Actualizar el monto en el panel existente si es necesario
        const amountEl = document.querySelector('.fidelidad-amount');
        if (amountEl) amountEl.innerText = `$ ${detectedAmount.toLocaleString('es-AR')}`;
        return;
    }

    console.log("✨ [Club Fidelidad] Inyectando panel original");

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';

    // Inyectamos los estilos directamente para asegurar que se vea como la original
    const style = document.createElement('style');
    style.textContent = `
        .fidelidad-panel {
            position: fixed; bottom: 20px; right: 20px; width: 320px; 
            background: white; border-radius: 16px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.3);
            z-index: 2147483647; font-family: sans-serif; border: 1px solid #e0e0e0; overflow: hidden;
            color: #333;
        }
        .fidelidad-header { background: #6200ee; color: white; padding: 12px 16px; display: flex; justify-content: space-between; align-items: center; }
        .fidelidad-header h1 { font-size: 14px; margin: 0; font-weight: 600; }
        .fidelidad-body { padding: 16px; }
        .fidelidad-amount { font-size: 24px; font-weight: bold; color: #333; margin-bottom: 12px; text-align: center; }
        .fidelidad-input { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 8px; box-sizing: border-box; font-size: 13px; outline: none; margin-bottom: 10px; display: block !important; background: white !important; color: black !important; }
        .fidelidad-results { max-height: 150px; overflow-y: auto; border: 1px solid #eee; border-radius: 8px; margin-top: -6px; margin-bottom: 10px; background: white; }
        .fidelidad-result-item { padding: 8px 12px; cursor: pointer; font-size: 13px; border-bottom: 1px solid #f9f9f9; }
        .fidelidad-result-item:hover { background: #f5f5f5; }
        .fidelidad-result-item .dni { font-size: 11px; color: #888; }
        .fidelidad-button { width: 100%; padding: 12px; background: #6200ee; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer; }
        .fidelidad-button:disabled { background: #ccc; cursor: not-allowed; }
        .fidelidad-wa-link { display: block; text-align: center; background: #25d366; color: white; text-decoration: none; padding: 12px; border-radius: 8px; margin-top: 10px; font-weight: bold; }
        .fidelidad-close { cursor: pointer; font-size: 18px; }
    `;
    document.head.appendChild(style);

    panel.innerHTML = `
        <div class="fidelidad-header">
            <h1>Sumar Puntos</h1>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <div class="fidelidad-amount">$ ${detectedAmount.toLocaleString('es-AR')}</div>
            <div class="fidelidad-search-container" style="position:relative;">
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Buscar por Nombre o DNI (mín 3 carac.)...">
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

    // SOLUCIÓN CLAVE PARA ESCRIBIR: stopPropagation para que el facturador no controle el teclado
    const preventSiteControl = (e) => e.stopPropagation();
    searchInput.addEventListener('keydown', preventSiteControl, true);
    searchInput.addEventListener('keyup', preventSiteControl, true);
    searchInput.addEventListener('keypress', preventSiteControl, true);

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
            <div class="fidelidad-success" style="text-align: center; color: #4caf50; padding: 20px;">
                <div style="font-size: 40px;">✅</div>
                <div style="font-weight: bold; margin: 10px 0;">¡Puntos Asignados!</div>
                <div style="font-size: 13px; color: #666;">Se sumaron ${data.pointsAdded} puntos a ${selectedClient.name}.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">ABRIR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#eee; color:#333; margin-top:20px;" onclick="document.getElementById('fidelidad-panel').remove()">CERRAR</button>
            </div>
        `;
    }
}
