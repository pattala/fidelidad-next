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
function detectAmount() {
    let amount = 0;

    // 1. Intentar por el ID que conocemos
    let el = document.getElementById('cpbtc_total') || document.querySelector('input[name="cpbtc_total"]');

    if (el) {
        console.log("🔍 [Club Fidelidad] Encontrado elemento cpbtc_total. Valor actual:", el.value);
        amount = parseValue(el.value);
    }

    // 2. Si no hay monto, buscar cualquier input que contenga "total" en su ID o nombre
    if (!amount) {
        const allInputs = Array.from(document.querySelectorAll('input'));
        const totalInput = allInputs.find(i => (i.id && i.id.toLowerCase().includes('total')) || (i.name && i.name.toLowerCase().includes('total')));
        if (totalInput && totalInput.value) {
            console.log("🔍 [Club Fidelidad] Encontrado posible input de total (" + totalInput.id + "):", totalInput.value);
            amount = parseValue(totalInput.value);
        }
    }

    // 3. Fallback: Buscar en el texto de la pantalla (Tablas/Grillas)
    if (!amount) {
        // Buscamos en todas las celdas de tabla o divs que parezcan montos
        const elements = Array.from(document.querySelectorAll('td, span, b, strong'));
        for (let i = 0; i < elements.length; i++) {
            const text = elements[i].innerText.trim();
            if (text.toUpperCase() === 'TOTAL' || text.toUpperCase() === 'TOTAL:') {
                // El valor suele estar en el siguiente elemento o el siguiente <td>
                const next = elements[i].nextElementSibling || (elements[i].parentElement && elements[i].parentElement.nextElementSibling);
                if (next) {
                    let val = parseValue(next.innerText);
                    if (val > 0) {
                        console.log("🔍 [Club Fidelidad] Encontrado texto 'TOTAL' y valor al lado:", val);
                        amount = val;
                        break;
                    }
                }
            }
        }
    }

    if (amount > 0 && amount !== detectedAmount) {
        console.log("💰 [Club Fidelidad] ¡EXCELENTE! Monto detectado: $", amount);
        detectedAmount = amount;
        showFidelidadPanel();
    }
}

function parseValue(text) {
    if (!text) return 0;
    // Quitamos "$" y limpiamos formato decimal (cambiamos , por .)
    let cleaned = text.replace(/[^0-9,.]/g, '').replace(',', '.');
    return parseFloat(cleaned) || 0;
}

// Escaneo continuo
setInterval(detectAmount, 3000);
detectAmount();

function showFidelidadPanel() {
    // Evitar duplicados
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
            <div class="fidelidad-amount">$ ${detectedAmount.toLocaleString('es-AR')}</div>
            <div class="fidelidad-search-container">
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
