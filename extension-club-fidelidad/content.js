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

    // Heartbeat log opcional (cada 5 escaneos para no saturar)
    if (window.scanCount === undefined) window.scanCount = 0;
    window.scanCount++;
    if (window.scanCount % 5 === 0) console.log("👀 [Club Fidelidad] Escaneando pantalla en busca de montos...");

    // 1. Intentar por el ID que conocemos (campo oculto o visible)
    let el = document.getElementById('cpbtc_total') || document.querySelector('input[name="cpbtc_total"]');
    if (el && el.value) {
        amount = parseValue(el.value);
        if (amount > 0) console.log("🔍 [Club Fidelidad] Input detectado:", amount);
    }

    // 2. Búsqueda por Texto Visible (Ej: "Total a pagar $: 2.00")
    if (!amount) {
        // Buscamos en TODOS los elementos de texto corto (h1, h2, h3, div, span, b)
        const candidates = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label');
        for (let cand of candidates) {
            const text = cand.innerText.toUpperCase();
            if (text.includes('TOTAL') && (text.includes('$') || text.match(/\d/))) {
                // Intentamos extraer el número de ese mismo texto
                let extracted = parseValue(text);
                if (extracted > 0) {
                    amount = extracted;
                    console.log("🎯 [Club Fidelidad] Texto con monto detectado:", text, "->", amount);
                    break;
                }
            }
        }
    }

    // 3. Si encontramos algo válido...
    if (amount > 0 && amount !== detectedAmount) {
        console.log("💰 [Club Fidelidad] ¡NUEVO MONTO!: $", amount);
        detectedAmount = amount;
        showFidelidadPanel();
    }
}

function parseValue(text) {
    if (!text) return 0;
    // Eliminamos todo lo que no sea número, coma o punto
    // Pero ojo: si hay un "$", queremos lo que está después
    let cleaning = text.split('$');
    let toParse = cleaning.length > 1 ? cleaning[1] : cleaning[0];

    // Quitamos espacios y caracteres raros, dejamos solo digitos y separadores
    let valClean = toParse.replace(/[^0-9,.]/g, '').trim();

    // Caso especial: si tiene coma y punto (ej: 1.250,50)
    if (valClean.includes('.') && valClean.includes(',')) {
        valClean = valClean.replace(/\./g, '').replace(',', '.');
    } else {
        // Si solo tiene coma, es el decimal (formato AR)
        valClean = valClean.replace(',', '.');
    }

    return parseFloat(valClean) || 0;
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
