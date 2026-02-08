
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
        const amountEl = document.getElementById('cf-display-amount');
        if (amountEl) amountEl.innerText = `$ ${detectedAmount.toLocaleString('es-AR')}`;
        const inputMonto = document.getElementById('cf-input-amount');
        if (inputMonto && !inputMonto.value) inputMonto.value = detectedAmount;
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';

    const today = new Date().toISOString().split('T')[0];

    panel.innerHTML = `
        <div class="fidelidad-header">
            <div class="fidelidad-header-title">
                <h1>Sumar Puntos</h1>
                <span id="cf-client-name-header" style="font-size: 10px; opacity: 0.8; display: block;">Seleccione un cliente</span>
            </div>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <!-- PESTAÑAS -->
            <div class="cf-tabs">
                <button id="tab-monto" class="cf-tab active">Por Monto ($)</button>
                <button id="tab-directo" class="cf-tab">Puntos Directos</button>
            </div>

            <!-- BUSCADOR PREDICTIVO -->
            <div class="fidelidad-search-container">
                <label class="cf-label">Buscar Socio (Nombre, DNI o ID)</label>
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Escriba para buscar..." autocomplete="off">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>

            <!-- FORMULARIO DE PUNTOS -->
            <div id="cf-points-form" style="display:none;">
                <div class="cf-field">
                    <label id="cf-amount-label" class="cf-label font-bold">Monto de la Compra ($)</label>
                    <div class="cf-input-group">
                        <span id="cf-currency-symbol" class="cf-addon">$</span>
                        <input type="number" id="cf-input-amount" class="fidelidad-input cf-input-big" value="${detectedAmount}">
                    </div>
                </div>

                <div class="cf-grid">
                    <div class="cf-field">
                        <label class="cf-label">Concepto</label>
                        <input type="text" id="cf-concept" class="fidelidad-input" value="Compra en local">
                    </div>
                    <div class="cf-field">
                        <label class="cf-label">Fecha</label>
                        <input type="date" id="cf-date" class="fidelidad-input" value="${today}">
                    </div>
                </div>

                <!-- PROMOCIONES -->
                <div id="cf-promos-container" class="cf-promos-box">
                    <label class="cf-checkbox-label">
                        <input type="checkbox" id="cf-apply-promos" checked> Aplicar Promociones / Bonus
                    </label>
                    <div id="cf-promos-list" class="cf-promos-list">
                        <!-- Se llena vía API -->
                    </div>
                </div>

                <label class="cf-checkbox-label" style="margin-top: 10px;">
                    <input type="checkbox" id="cf-notify-wa" checked> Notificar por WhatsApp
                </label>

                <button id="fidelidad-submit" class="fidelidad-button">ASIGNAR PUNTOS</button>
            </div>

            <div id="fidelidad-status" style="margin-top:10px; font-size: 12px; text-align: center;"></div>
        </div>
    `;

    // --- ESTRATEGIA DE INFILTRACIÓN (v29) ---
    const modalSelectors = ['.modal-content', '.modal-body', '.bootbox', '.ui-dialog-content', '.sky-modal', '[role="dialog"]'];
    let injector = document.body;
    for (let sel of modalSelectors) {
        const found = document.querySelector(sel);
        if (found) {
            injector = found;
            break;
        }
    }
    injector.appendChild(panel);

    // --- DRAGGABLE LOGIC ---
    let isDragging = false;
    let offset = { x: 0, y: 0 };
    const header = panel.querySelector('.fidelidad-header');

    header.onmousedown = (e) => {
        if (e.target.id === 'fidelidad-close') return;
        isDragging = true;
        offset.x = e.clientX - panel.offsetLeft;
        offset.y = e.clientY - panel.offsetTop;
        panel.style.transition = 'none';
        header.style.cursor = 'grabbing';
    };

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - offset.x) + 'px';
        panel.style.top = (e.clientY - offset.y) + 'px';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        header.style.cursor = 'move';
    });

    // ELEMENTOS
    const searchInput = document.getElementById('fidelidad-search');
    const resultsDiv = document.getElementById('fidelidad-results');
    const pointsForm = document.getElementById('cf-points-form');
    const submitBtn = document.getElementById('fidelidad-submit');
    const statusDiv = document.getElementById('fidelidad-status');
    const clientHeader = document.getElementById('cf-client-name-header');
    const promosList = document.getElementById('cf-promos-list');

    // TABS LOGIC
    let isPesos = true;
    document.getElementById('tab-monto').onclick = () => {
        isPesos = true;
        document.getElementById('tab-monto').classList.add('active');
        document.getElementById('tab-directo').classList.remove('active');
        document.getElementById('cf-amount-label').innerText = 'Monto de la Compra ($)';
        document.getElementById('cf-currency-symbol').innerText = '$';
        document.getElementById('cf-promos-container').style.display = 'block';
    };
    document.getElementById('tab-directo').onclick = () => {
        isPesos = false;
        document.getElementById('tab-monto').classList.remove('active');
        document.getElementById('tab-directo').classList.add('active');
        document.getElementById('cf-amount-label').innerText = 'Cantidad de Puntos';
        document.getElementById('cf-currency-symbol').innerText = 'pts';
        document.getElementById('cf-promos-container').style.display = 'none';
    };

    function killEvent(e) {
        if (document.activeElement === searchInput || document.activeElement.tagName === 'INPUT') {
            e.stopPropagation();
            // No stopImmediatePropagation to allow default typing but block sitewide shortcuts
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

    // FOCO PERSISTENTE SOLO EN EL SEARCH INICIAL
    setTimeout(() => searchInput.focus(), 300);

    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value;
        if (q.length < 3) {
            resultsDiv.style.display = 'none';
            return;
        }
        resultsDiv.innerHTML = '<div class="fidelidad-result-item" style="text-align:center; color:#888;">Buscando...</div>';
        resultsDiv.style.display = 'block';
        searchTimeout = setTimeout(() => searchClients(q), 400);
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
            if (data.ok && data.clients && data.clients.length > 0) {
                renderResults(data.clients, data.activePromotions || []);
            } else {
                resultsDiv.innerHTML = '<div class="fidelidad-result-item" style="cursor:default; color:#666; text-align:center;">No se encontraron socios</div>';
                resultsDiv.style.display = 'block';
            }
        } catch (e) {
            statusDiv.innerText = '❌ Error de conexión';
        }
    }

    function renderResults(clients, promotions) {
        resultsDiv.innerHTML = '';
        clients.forEach(c => {
            const item = document.createElement('div');
            item.className = 'fidelidad-result-item';
            item.innerHTML = `
                <div style="font-weight: 700; color: #111827; pointer-events: none;">${c.name}</div>
                <div class="dni" style="font-size: 11px; color: #6b7280; margin-top: 2px; pointer-events: none;">
                    DNI: ${c.dni || 'S/D'} | Socio: ${c.socio_number || 'N/A'}
                </div>
            `;
            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                selectedClient = { id: c.id, name: c.name };
                console.log("🎯 Socio seleccionado:", selectedClient);

                // UI Update
                clientHeader.innerText = `Socio: ${selectedClient.name}`;
                searchInput.value = selectedClient.name;
                resultsDiv.style.display = 'none';

                // Show Form & All Options
                pointsForm.style.display = 'block';
                statusDiv.innerText = '';

                // Render Promos
                if (promotions && promotions.length > 0) {
                    promosList.innerHTML = promotions.map(p => `
                        <label class="cf-promo-item">
                            <input type="checkbox" class="cf-promo-check" value="${p.id}" checked>
                            <div class="cf-promo-info">
                                <span class="cf-promo-name">${p.name || p.title}</span>
                                <span class="cf-promo-desc">${p.rewardType === 'MULTIPLIER' ? 'Multiplicador x' + p.rewardValue : 'Bonus +' + p.rewardValue + ' pts'}</span>
                            </div>
                        </label>
                    `).join('');
                } else {
                    promosList.innerHTML = '<div style="font-size:10px; color:#999; padding: 5px 0;">No hay promociones activas.</div>';
                }

                // Focus amount input
                setTimeout(() => {
                    const amountInput = document.getElementById('cf-input-amount');
                    if (amountInput) amountInput.focus();
                }, 100);
            };
            resultsDiv.appendChild(item);
        });
        resultsDiv.style.display = 'block';
    }

    submitBtn.onclick = async () => {
        if (!selectedClient) return;

        const amount = parseFloat(document.getElementById('cf-input-amount').value);
        if (isNaN(amount) || amount <= 0) {
            statusDiv.innerText = '❌ Ingrese un monto válido';
            return;
        }

        const bonusIds = Array.from(document.querySelectorAll('.cf-promo-check:checked')).map(el => el.value);
        const concept = document.getElementById('cf-concept').value;
        const date = document.getElementById('cf-date').value;
        const applyWhatsApp = document.getElementById('cf-notify-wa').checked;
        const applyPromos = document.getElementById('cf-apply-promos').checked;

        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';

        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: amount,
                    reason: isPesos ? 'external_integration' : 'manual',
                    concept: concept,
                    date: date,
                    bonusIds: applyPromos ? bonusIds : [],
                    applyWhatsApp: applyWhatsApp
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
            <div class="fidelidad-success" style="text-align: center; color: #16a34a; padding: 10px;">
                <div style="font-size: 40px;">✅</div>
                <div style="font-weight: bold; font-size: 18px; margin: 5px 0;">¡Puntos Asignados!</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 15px;">Se sumaron ${data.pointsAdded} puntos a ${selectedClient.name}.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">ENVIAR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#f3f4f6; color:#374151; margin-top:15px; border: 1px solid #d1d5db;" id="cf-final-close">CERRAR</button>
            </div>
        `;
        document.getElementById('cf-final-close').onclick = () => panel.remove();
    }
}
