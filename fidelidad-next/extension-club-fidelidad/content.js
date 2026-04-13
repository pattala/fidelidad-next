// Club Fidelidad - Content Script (VERSIÓN 31 - DRAG & LOGS FIX)
console.log("🚀 [Club Fidelidad] V31: Iniciando script con arreglos de arrastre y nuevos logs.");

let config = { apiUrl: '', apiKey: '' };
let apiRatios = { base: 100, perPeso: 1, penaltyStep: 15, minFloor: 25 };
let detectedAmount = 0;
let detectedDiscounts = 0;
let selectedClient = null;
let currentPromos = []; // Store calculable promos globally for this context

// Cargar configuración de storage
chrome.storage.local.get(['appName', 'apiUrl', 'apiKey'], (res) => {
    config = res;
    console.log("⚙️ [Integrador] Configura-Check:", res.apiUrl ? `URL: ${res.apiUrl}` : "❌ URL NO ENCONTRADA", res.apiKey ? "✅ API KEY OK" : "❌ KEY NO ENCONTRADA");

    // --- DAILY CHECK: cumpleaños + vencimientos (1x/día, silencioso) ---
    if (res.apiUrl && res.apiKey) {
        console.log("🔍 [Club Fidelidad] Consultando pendientes a servidor...");
        const offsetStored = localStorage.getItem('fiddle_simulated_date_offset');
        const offset = offsetStored ? parseInt(offsetStored, 10) : 0;
        const now = new Date();
        if (offset !== 0) {
            now.setTime(now.getTime() + (offset * 24 * 60 * 60 * 1000));
        }
        // --- EXPLICIT TRIGGER: CAMPAIGN ENGINE (Mantenimiento y Difusión) ---
        fetch(`${res.apiUrl}/api/engine-campaigns?trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': res.apiKey }
        }).catch(e => console.error("❌ [Club Fidelidad] Error en trigger campañas:", e.message));

        fetch(`${res.apiUrl}/api/engine-daily?mode=daily&trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': res.apiKey },
            body: JSON.stringify({
                simulatedDate: now.toISOString()
            })
        }).then(r => {
            if (!r.ok) throw new Error(`HTTP Error ${r.status}`);
            return r.json();
        })
            .then(data => {
                if (!data) return;

                // Si el motor ya corrió hoy (skip), pero avisa que los pending son 0,
                // de todos modos hay que limpiar la pantalla si había widget viejo.
                if (data.skip) {
                    console.log("ℹ️ [Club Fidelidad] Motor ya ejecutado hoy. Validando pendientes...");
                    const bCount = data.summary?.totalToday || 0;
                    const eCount = data.expirations?.summary?.totalInWindow || 0;
                    if (bCount === 0 && eCount === 0) {
                        const existingWidget = document.getElementById('cf-floating-alert');
                        if (existingWidget) existingWidget.remove();
                    } else {
                        showGlobalAlert(bCount, eCount, res.apiUrl);
                    }
                    return;
                }

                console.log("📊 [Club Fidelidad] Respuesta de pendientes:", data);
                if (data.ok) {
                    const birthdayCount = data.birthdays?.totalToday || 0;
                    const expirationCount = data.expirations?.summary?.totalInWindow || 0;

                    if (birthdayCount > 0 || expirationCount > 0) {
                        showGlobalAlert(birthdayCount, expirationCount, res.apiUrl);
                    } else {
                        console.log("ℹ️ [Club Fidelidad] Nada pendiente para alertar hoy.");
                        const existingWidget = document.getElementById('cf-floating-alert');
                        if (existingWidget) existingWidget.remove();
                    }
                }
            })
            .catch(e => console.error("❌ [Club Fidelidad] Error en check diario:", e.message));
    }
});

function showGlobalAlert(birthdays, expirations, adminUrl) {
    // Si el widget ya existe, solo actualizamos los contadores
    const existingWidget = document.getElementById('cf-floating-alert');
    if (existingWidget) {
        const countEl = existingWidget.querySelector('#cf-alert-counts');
        if (countEl) {
            countEl.innerHTML = `${birthdays > 0 ? `🎂 C: ${birthdays}` : ''} ${expirations > 0 ? `⏳ V: ${expirations}` : ''}`;
        }
        if (birthdays === 0 && expirations === 0) existingWidget.remove();
        return;
    }

    chrome.storage.local.get(['cf_alert_minimized'], (result) => {
        let isMinimized = result.cf_alert_minimized || false;
        let isDraggingActive = false;

        const widget = document.createElement('div');
        widget.id = 'cf-floating-alert';
        widget.style.cssText = `
            position: fixed;
            bottom: 20px;
            left: 20px;
            z-index: 2147483647;
            font-family: system-ui, -apple-system, sans-serif;
            display: flex;
            flex-direction: column;
            transition: opacity 0.3s ease, transform 0.3s ease;
            user-select: none;
        `;

        const renderContent = () => {
            if (isMinimized) {
                widget.innerHTML = `
                    <div id="cf-alert-min" style="
                        background: #f59e0b; color: white; width: 48px; height: 48px; border-radius: 50%;
                        box-shadow: 0 10px 25px rgba(245, 158, 11, 0.4); display: flex; align-items: center; justify-content: center;
                        cursor: grab; position: relative; border: 2px solid white;
                    ">
                        <span style="font-size: 24px;">📢</span>
                        <span style="position: absolute; top: -5px; right: -5px; background: white; color: #b45309; font-size: 10px; font-weight: 900; width: 20px; height: 20px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
                            ${birthdays + expirations}
                        </span>
                    </div>
                `;
                widget.onclick = (e) => {
                    if (isDraggingActive) return;
                    isMinimized = false;
                    chrome.storage.local.set({ cf_alert_minimized: false });
                    renderContent();
                };
            } else {
                widget.innerHTML = `
                    <div id="cf-alert-main" style="
                        background: white; padding: 12px 16px; border-radius: 16px;
                        box-shadow: 0 10px 25px rgba(0,0,0,0.15); border: 1px solid #fee2e2;
                        display: flex; align-items: center; gap: 12px; min-width: 200px;
                    ">
                        <div id="cf-drag-handle" style="cursor: grab; background: #fef3c7; width: 32px; height: 32px; display: flex; align-items: center; justify-content: center; border-radius: 50%;">
                            <span style="font-size: 18px;">📢</span>
                        </div>
                        <div style="flex: 1;">
                            <h4 style="margin: 0; font-size: 13px; font-weight: 800; color: #92400e;">${config.appName || 'Sistema de Beneficios'}</h4>
                            <p id="cf-alert-counts" style="margin: 0; font-size: 11px; color: #b45309; line-height: 1.2;">
                                ${birthdays > 0 ? `🎂 C: ${birthdays}` : ''} 
                                ${expirations > 0 ? `⏳ V: ${expirations}` : ''}
                            </p>
                        </div>
                        <div style="display: flex; gap: 4px; align-items: center;">
                            <a href="${adminUrl}/admin/dashboard" target="_blank" style="
                                background: #f59e0b; color: white; padding: 6px 12px; border-radius: 8px;
                                text-decoration: none; font-size: 10px; font-weight: bold; text-transform: uppercase;
                            ">Panel</a>
                            <button id="cf-alert-minimize" title="Minimizar" style="background:none; border:none; color:#d1d5db; cursor:pointer; font-size:20px;">–</button>
                            <button id="cf-alert-close" title="Cerrar" style="background:none; border:none; color:#d1d5db; cursor:pointer; font-size:20px;">×</button>
                        </div>
                    </div>
                `;
                widget.querySelector('#cf-alert-close').onclick = (e) => {
                    e.stopPropagation();
                    widget.remove();
                };
                widget.querySelector('#cf-alert-minimize').onclick = (e) => {
                    e.stopPropagation();
                    isMinimized = true;
                    chrome.storage.local.set({ cf_alert_minimized: true });
                    renderContent();
                };
            }
            setupDragging();
        };

        const setupDragging = () => {
            const handle = isMinimized ? widget : widget.querySelector('#cf-drag-handle');
            if (!handle) return;

            let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
            handle.onmousedown = (e) => {
                e.preventDefault();
                isDraggingActive = false;
                pos3 = e.clientX;
                pos4 = e.clientY;
                document.onmouseup = () => {
                    document.onmouseup = null;
                    document.onmousemove = null;
                    if (handle.style) handle.style.cursor = 'grab';
                };
                document.onmousemove = (me) => {
                    me.preventDefault();
                    isDraggingActive = true;
                    if (handle.style) handle.style.cursor = 'grabbing';
                    pos1 = pos3 - me.clientX;
                    pos2 = pos4 - me.clientY;
                    pos3 = me.clientX;
                    pos4 = me.clientY;
                    widget.style.top = (widget.offsetTop - pos2) + "px";
                    widget.style.left = (widget.offsetLeft - pos1) + "px";
                    widget.style.bottom = 'auto';
                };
            };
        };

        renderContent();
        document.body.appendChild(widget);
        widget.style.opacity = '0';
        widget.style.transform = 'translateY(20px)';
        setTimeout(() => { widget.style.opacity = '1'; widget.style.transform = 'translateY(0)'; }, 100);
    });
}

// Refresca el contador C/V del widget si ya está visible
async function refreshAlertCounts() {
    if (!config.apiUrl || !config.apiKey) return;
    try {
        // Dispara el check en modo SILENCIOSO y "Diario" a la API oficial
        const r = await fetch(`${config.apiUrl}/api/engine-daily?mode=daily&trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey }
        });
        const data = await r.json();
        if (data.ok) {
            const birthdayCount = data.summary?.totalToday || 0;
            const expirationCount = data.expirations?.summary?.totalInWindow || 0;
            // showGlobalAlert ahora actualiza en lugar de ignorar si ya existe
            if (birthdayCount > 0 || expirationCount > 0) {
                showGlobalAlert(birthdayCount, expirationCount, config.apiUrl);
            } else {
                // Si ya no hay nada pendiente, ocultar el widget
                const w = document.getElementById('cf-floating-alert');
                if (w) w.remove();
            }
        }
    } catch (e) {
        console.warn('[Club Fidelidad] Error refrescando contadores:', e.message);
    }
}

// Auto-refresh when regaining focus (e.g. returning from Admin Panel)
window.addEventListener('focus', () => {
    refreshAlertCounts();
    // Also re-trigger amount detection in case the DOM changed while away
    setTimeout(() => detectAmount(), 500);
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

    // --- NUEVO: DETECCIÓN DE DESCUENTOS (ITEMS NEGATIVOS) ---
    let discountSum = 0;
    try {
        const rows = document.querySelectorAll('table tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            // La columna 6 (índice 5) suele ser el Total por ítem
            if (cells.length >= 6) {
                const rowText = row.innerText.toUpperCase();
                const totalText = cells[5].innerText.trim();
                
                // Detectamos por signo menos o por palabras clave de descuento/combo
                const isNegative = totalText.startsWith('-') || totalText.includes('(');
                // --- CONFIGURACIÓN DE PALABRAS CLAVE ---
                // Si necesitas agregar más palabras, agrégalas aquí abajo usando || rowText.includes('NUEVA_PALABRA')
                const hasDiscountKeyword = rowText.includes('DESCUENTO') || 
                                           rowText.includes('PROMO') || 
                                           rowText.includes('COMBO') || 
                                           rowText.includes('BONIF');

                if (isNegative || hasDiscountKeyword) {
                    const numeric = Math.abs(parseFloat(totalText.replace(/[^0-9.,-]/g, '').replace(',', '.')));
                    if (!isNaN(numeric)) discountSum += numeric;
                }
            }
        });
        
        // Búsqueda genérica refinada si la tabla no dio resultados
        if (discountSum === 0) {
            document.querySelectorAll('td, span, div').forEach(el => {
                const text = el.innerText.trim();
                // Regex mejorado para capturar montos negativos o entre paréntesis
                if (((text.startsWith('-') || (text.startsWith('(') && text.endsWith(')'))) && text.length > 1 && text.length < 20 && !el.children.length)) {
                    const numeric = Math.abs(parseFloat(text.replace(/[^0-9.,-]/g, '').replace(',', '.')));
                    if (!isNaN(numeric) && numeric > 1) { 
                         discountSum += numeric;
                    }
                }
            });
        }
    } catch (e) {
        console.warn('[Club Fidelidad] Error rastreando descuentos:', e);
    }
    detectedDiscounts = discountSum;

    if (!isNaN(val) && val > 0) {
        const panelExists = document.getElementById('fidelidad-panel');
        if (val !== detectedAmount || !panelExists) {
            console.log(`💰 [Club Fidelidad] Monto detectado: ${val}`);
            detectedAmount = val;
            showFidelidadPanel();
        }
    } else {
        // Reset detected amount if no input is found so it can trigger again when it appears
        if (detectedAmount > 0) detectedAmount = 0;
    }
}

let detectTimeout = null;
const observer = new MutationObserver(() => {
    // Debounce reducido para activación más rápida
    if (detectTimeout) clearTimeout(detectTimeout);
    detectTimeout = setTimeout(() => detectAmount(), 150);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
// Initial detection sequence
detectAmount();
setTimeout(detectAmount, 1000);
setTimeout(detectAmount, 2500);

function showFidelidadPanel() {
    if (document.getElementById('fidelidad-panel')) {
        const amountEl = document.getElementById('cf-display-amount');
        const inputMonto = document.getElementById('cf-input-amount');
        const baseActual = detectedAmount - detectedDiscounts;

        if (amountEl) {
            amountEl.innerHTML = `$ ${detectedAmount.toLocaleString('es-AR')} ${detectedDiscounts > 0 ? `<span style="font-size: 10px; color: #ef4444; font-weight: normal; margin-left:8px;">(Base: $${baseActual.toLocaleString('es-AR')})</span>` : ''}`;
        }
        
        // Solo actualizar si el input está vacío o aún no tiene el monto detectado (para no pisar cambios manuales)
        if (inputMonto && (!inputMonto.value || inputMonto.dataset.autoFilled === 'true')) {
            inputMonto.value = baseActual;
            inputMonto.dataset.autoFilled = 'true';
        }
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';

    const today = new Date().toISOString().split('T')[0];

    panel.innerHTML = `
        <div class="fidelidad-header">
            <div class="fidelidad-header-title">
                <h1 id="cf-main-title">Sumar Puntos <span style="font-size: 10px; color: #e5e7eb; font-weight: normal; margin-left: 8px; opacity: 0.9;">(${config.appName || config.apiUrl || 'Configurando...'})</span></h1>
                <span id="cf-client-name-header" style="font-size: 10px; opacity: 0.8; display: block;">Seleccione un cliente</span>
            </div>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <!-- BUSCADOR PREDICTIVO -->
            <div class="fidelidad-search-container">
                <label class="cf-label">Buscar Socio (Nombre, DNI o ID)</label>
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Escriba para buscar..." autocomplete="off">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>

            <!-- TABS (Solo aparecen cuando hay cliente seleccionado) -->
            <div id="cf-tabs-container" class="cf-tabs" style="display:none; margin-top: 15px;">
                <button class="cf-tab active" data-tab="sumar">Sumar</button>
                <button class="cf-tab" data-tab="canjes">Canjear</button>
            </div>

            <!-- CONTENIDO TAB: SUMAR -->
            <div id="cf-tab-content-sumar" class="cf-tab-content" style="display:none;">
                <div id="cf-points-form">
                    <div class="cf-field">
                        <label id="cf-amount-label" class="cf-label font-bold">Monto de la Compra ($)</label>
                        <div class="cf-input-group">
                            <span id="cf-currency-symbol" class="cf-addon">$</span>
                            <input type="number" id="cf-input-amount" class="fidelidad-input cf-input-big" value="${detectedAmount - detectedDiscounts}" data-auto-filled="true">
                        </div>
                        <div id="cf-display-amount" style="font-size: 11px; margin-top: 4px; color: #6b7280;">
                            $ ${detectedAmount.toLocaleString('es-AR')} ${detectedDiscounts > 0 ? `<span style="color:#ef4444;">(-$${detectedDiscounts.toLocaleString('es-AR')} desc.)</span>` : ''}
                        </div>
                        <div id="cf-preview-container" class="cf-preview-box" style="margin-top: 8px; font-size: 12px; color: #6b7280; display: none;">
                            <!-- Preview text will be injected here -->
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

                    <!-- PROMOCIONES Y OPCIONES -->
                    <div id="cf-promos-container" class="cf-promos-box" style="margin-top: 20px;">
                        <label class="cf-checkbox-label">
                            <input type="checkbox" id="cf-apply-promos" checked> Aplicar Promociones / Bonus
                        </label>
                        <div id="cf-promos-list" class="cf-promos-list">
                            <!-- Se llena vía API -->
                        </div>
                        <label class="cf-checkbox-label" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
                            <input type="checkbox" id="cf-notify-wa"> Notificar por WhatsApp
                        </label>
                    </div>

                    <button id="fidelidad-submit" class="fidelidad-button">Asignar Puntos</button>
                </div>
            </div>

            <!-- CONTENIDO TAB: CANJES -->
            <div id="cf-tab-content-canjes" class="cf-tab-content" style="display:none;">
                <div class="cf-prizes-summary" style="margin-bottom: 12px; background: #eeeff3; padding: 10px; border-radius: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #4b5563; font-weight: 700;">Saldo disponible: <strong id="cf-client-points-balance" style="color: #16a34a; font-size: 14px;">0</strong> pts</span>
                </div>
                <div id="cf-prizes-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 2px;">
                    <!-- Se llena vía API -->
                </div>
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
    const inputMonto = document.getElementById('cf-input-amount');
    const promosContainer = document.getElementById('cf-promos-container');
    const tabsContainer = document.getElementById('cf-tabs-container');
    const tabSumar = document.getElementById('cf-tab-content-sumar');
    const tabCanjes = document.getElementById('cf-tab-content-canjes');
    const prizesList = document.getElementById('cf-prizes-list');
    const mainTitle = document.getElementById('cf-main-title');
    // MANTENER SIEMPRE EN PESOS EN LA EXTENSIÓN
    let isPesos = true;

    inputMonto.oninput = () => updatePointsPreview();

    function updatePointsPreview() {
        const val = parseFloat(inputMonto.value);
        const previewContainer = document.getElementById('cf-preview-container');
        if (!previewContainer) return;

        if (isNaN(val) || val <= 0 || !selectedClient) {
            previewContainer.style.display = 'none';
            return;
        }

        let ptsBase = 0;
        if (isPesos) {
            const curAcc = selectedClient.accumulated_balance || 0;
            // SI EL MONTO COINCIDE CON EL DETECTADO, RESTAMOS DESCUENTOS
            let effectiveVal = val;
            if (val === detectedAmount) {
                effectiveVal = val - detectedDiscounts;
            }
            const total = effectiveVal + curAcc;
            ptsBase = Math.floor((total / (apiRatios.base || 100)) * (apiRatios.perPeso || 1));
        } else {
            ptsBase = Math.floor(val);
        }

        const ptsAfterPromo = ptsBase;

        let bonus = 0;
        const applyPromos = document.getElementById('cf-apply-promos').checked;
        if (applyPromos) {
            const selectedIds = Array.from(document.querySelectorAll('.cf-promo-check:checked')).map(el => el.value);
            currentPromos.filter(p => selectedIds.includes(p.id)).forEach(b => {
                const isFlash = b.isFlash;
                const rType = isFlash ? (b.flashRewardType || b.rewardType) : b.rewardType;
                const rValue = isFlash ? (b.flashRewardValue ?? b.rewardValue) : b.rewardValue;

                if (rType === 'MULTIPLIER') bonus += Math.floor(ptsAfterPromo * (rValue - 1));
                else bonus += (rValue || 0);
            });
        }

        // --- FACTOR K: RECUPERACIÓN POR DESCUENTO ---
        let bonusK = 0;
        if (isPesos && detectedDiscounts > 0 && apiRatios.discountK > 0) {
            const ptsPerCurrency = (apiRatios.perPeso || 1) / (apiRatios.base || 100);
            const lostPoints = detectedDiscounts * ptsPerCurrency;
            bonusK = Math.floor(lostPoints * (apiRatios.discountK / 100));
            bonus += bonusK;
        }

        const totalFinal = ptsAfterPromo + bonus;
        previewContainer.style.display = 'block';
        
        previewContainer.innerHTML = `
            <div style="font-weight: bold; color: #374151;">✨ Se asignarán: <strong style="color: #059669;">${totalFinal} puntos</strong></div>
            <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
                Cálculo: $${val.toLocaleString('es-AR')} / ${apiRatios.base} x ${apiRatios.perPeso}
                ${(bonus - bonusK) > 0 ? ` + ${bonus - bonusK} pts promos` : ''}
                ${bonusK > 0 ? ` + ${bonusK} pts Bono Descuento (K)` : ''}
            </div>
            ${(detectedDiscounts > 0) ? `<div style="font-size: 10px; color: #ef4444; font-weight: 700;">📉 El sistema restó $${detectedDiscounts.toLocaleString('es-AR')} de descuentos detectados.</div>` : ''}
        `;
    }

    // MASTER TOGGLE PROMOS
    const masterApply = document.getElementById('cf-apply-promos');
    masterApply.onchange = (e) => {
        const active = e.target.checked;
        promosList.style.opacity = active ? '1' : '0.4';
        promosList.style.pointerEvents = active ? 'all' : 'none';
        // Disable individual checkboxes to stay in sync with UI
        const checks = promosList.querySelectorAll('.cf-promo-check');
        checks.forEach(c => {
            c.disabled = !active;
        });
        updatePointsPreview();
    };

    // TAB SWITCHING LOGIC
    tabsContainer.querySelectorAll('.cf-tab').forEach(tab => {
        tab.onclick = () => {
            const target = tab.dataset.tab;
            tabsContainer.querySelectorAll('.cf-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (target === 'sumar') {
                tabSumar.style.display = 'block';
                tabCanjes.style.display = 'none';
                mainTitle.innerText = 'Sumar Puntos';
            } else {
                tabSumar.style.display = 'none';
                tabCanjes.style.display = 'block';
                mainTitle.innerText = 'Canjear Premios';
            }
        };
    });

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
        if (q.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }
        resultsDiv.innerHTML = '<div class="fidelidad-result-item" style="text-align:center; color:#888;">Buscando...</div>';
        resultsDiv.style.display = 'block';
        searchTimeout = setTimeout(() => searchClients(q), 150);
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
            if (data.ok) {
                apiRatios.base = data.pointsMoneyBase || 100;
                apiRatios.perPeso = data.pointsPerPeso || 1;
                apiRatios.discountK = data.discountRecoveryRatio || 0;

                if (data.clients && data.clients.length > 0) {
                    renderResults(data.clients, data.activePromotions || [], data.activePrizes || []);
                    // Refrescar contador C/V del widget (igual que promos: datos frescos en cada búsqueda)
                    refreshAlertCounts();
                } else {
                    resultsDiv.innerHTML = '<div class="fidelidad-result-item" style="cursor:default; color:#666; text-align:center;">No se encontraron socios</div>';
                    resultsDiv.style.display = 'block';
                }
            } else {
                statusDiv.innerText = '❌ Error de conexión';
            }
        } catch (e) {
            statusDiv.innerText = '❌ Error de conexión';
        }
    }

    function renderResults(clients, promotions, allPrizes) {
        resultsDiv.innerHTML = '';
        clients.forEach(c => {
            const item = document.createElement('div');
            item.className = 'fidelidad-result-item';
            item.innerHTML = `
                <div style="font-weight: 700; color: #111827; pointer-events: none;">${c.name}</div>
                <div class="dni" style="font-size: 11px; color: #6b7280; margin-top: 2px; pointer-events: none;">
                    DNI: ${c.dni || 'S/D'} | Socio: ${c.socioNumber || 'N/A'}
                </div>
            `;
            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                selectedClient = { id: c.id, name: c.name, accumulated_balance: c.accumulated_balance || 0 };

                // UI Update
                clientHeader.innerText = `Socio: ${selectedClient.name}`;
                searchInput.value = selectedClient.name;
                resultsDiv.style.display = 'none';

                pointsForm.style.display = 'block';
                tabSumar.style.display = 'block';
                tabsContainer.style.display = 'flex';
                statusDiv.innerText = '';

                // Actualizar balance en pestaña canjes
                const balanceEl = document.getElementById('cf-client-points-balance');
                if (balanceEl) balanceEl.innerText = c.accumulated_points ?? (c.points ?? (c.puntos ?? 0));

                // --- TAB CANJES: Renderizar Premios ---
                renderPrizes(allPrizes, (c.accumulated_points ?? (c.points ?? (c.puntos ?? 0))));

                // Renderizar Promos con Lógica de Horarios (Paridad con Admin)
                currentPromos = promotions || [];
                const activePromos = currentPromos.filter(p => p.rewardType === 'FIXED' || p.rewardType === 'MULTIPLIER' || p.rewardType === 'TEXT' || p.rewardType === 'INFO');

                if (activePromos.length > 0) {
                    const GRACE_PERIOD_MINS = 15;

                    function getARTime() {
                        const offsetStored = localStorage.getItem('fiddle_simulated_date_offset');
                        const offset = offsetStored ? parseInt(offsetStored, 10) : 0;
                        const now = new Date();
                        if (offset !== 0) {
                            now.setTime(now.getTime() + (offset * 24 * 60 * 60 * 1000));
                        }

                        const formatter = new Intl.DateTimeFormat('es-AR', {
                            timeZone: 'America/Argentina/Buenos_Aires',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        });
                        const parts = formatter.formatToParts(now);
                        const h = parts.find(p => p.type === 'hour').value;
                        const m = parts.find(p => p.type === 'minute').value;
                        // Ensure 2-digit padding for h and m
                        const paddedH = h.padStart(2, '0');
                        const paddedM = m.padStart(2, '0');
                        return { h: Number(h), m: Number(m), hhmm: `${paddedH}:${paddedM}`, now };
                    }

                    promosList.innerHTML = activePromos.map(p => {
                        const isFlash = p.isFlash;
                        const rType = isFlash ? (p.flashRewardType || p.rewardType) : p.rewardType;
                        const rValue = isFlash ? (p.flashRewardValue || p.rewardValue) : p.rewardValue;
                        const rText = isFlash ? (p.flashRewardText || p.rewardText) : p.rewardText;
                        const label = rType === 'MULTIPLIER' ? `Multiplicador x${rValue}` : (rType === 'FIXED' ? `Bonus +${rValue} pts` : rText);
                        const title = p.title || p.name;
                        const timeRange = (p.startTime || p.endTime) ?
                            `<span class="cf-promo-time">⏰ ${p.startTime || '00:00'} a ${p.endTime || '23:59'} hs</span>` : '';

                        return `
                            <label class="cf-promo-item" data-promo-id="${p.id}">
                                <input type="checkbox" class="cf-promo-check" value="${p.id}" checked>
                                <div class="cf-promo-info">
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <span class="cf-promo-name">${title}</span>
                                        <div class="cf-promo-status-container" data-id="${p.id}"></div>
                                        ${isFlash ? '<span class="cf-promo-status" style="background:#fef3c7; color:#92400e; font-size: 7px; border: 1px solid #f59e0b;">⚡ FLASH</span>' : ''}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                        <span class="cf-promo-desc">${label}</span>
                                        ${timeRange}
                                    </div>
                                </div>
                            </label>
                        `;
                    }).join('');

                    // Función de actualización de contadores
                    if (window.cfTimerInterval) clearInterval(window.cfTimerInterval);

                    const updateTimers = () => {
                        const { h: curH, m: curM, hhmm: curHHmm, now } = getARTime();

                        activePromos.forEach(p => {
                            const container = promosList.querySelector(`.cf-promo-status-container[data-id="${p.id}"]`);
                            if (!container) return;

                            let statusHtml = '';
                            if (p.startTime || p.endTime) {
                                // Transition: Active until the exact second of endTime.
                                // If curHHmm >= p.endTime, it's either in Grace or Expired.
                                const isExpiredToday = p.endTime && curHHmm >= p.endTime;

                                if (isExpiredToday) {
                                    // Calculation for internal grace period (Tolerance)
                                    const [endH, endM] = p.endTime.split(':').map(Number);
                                    const endTimeDate = new Date(now);
                                    endTimeDate.setHours(endH, endM, 0, 0);
                                    let diff = (endTimeDate.getTime() + (GRACE_PERIOD_MINS * 60 * 1000)) - now.getTime();

                                    if (diff > 0) {
                                        const mm = Math.floor(diff / (1000 * 60));
                                        const ss = Math.floor((diff % (1000 * 60)) / 1000);
                                        const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`;
                                        statusHtml = `
                                            <span class="cf-promo-status grace">TOLERANCIA</span>
                                            <span class="cf-promo-time" style="color:#9a3412; font-weight:900;">CIERRA EN: ${timeStr}</span>
                                        `;
                                    } else {
                                        // Fully expired and outside grace
                                        statusHtml = '';
                                        const item = promosList.querySelector(`.cf-promo-item[data-promo-id="${p.id}"]`);
                                        if (item) {
                                            item.style.opacity = '0.5';
                                            item.querySelector('input').checked = false;
                                        }
                                    }
                                } else {
                                    const isNotStartedYet = p.startTime && curHHmm < p.startTime;
                                    if (isNotStartedYet) {
                                        statusHtml = `<span class="cf-promo-status" style="background:#f3f4f6; color:#6b7280;">PRÓXIMAMENTE</span>`;
                                    } else {
                                        // Active: Show countdown until the end time
                                        const [endH, endM] = (p.endTime || '23:59').split(':').map(Number);
                                        const endTimeDate = new Date(now);
                                        endTimeDate.setHours(endH, endM, 0, 0);
                                        let diff = endTimeDate.getTime() - now.getTime();

                                        // Protection against negative values just before transition
                                        if (diff < 0) diff = 0;

                                        const mm = Math.floor(diff / (1000 * 60));
                                        const ss = Math.floor((diff % (1000 * 60)) / 1000);
                                        const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`;

                                        statusHtml = `
                                            <span class="cf-promo-status active">¡ACTIVA!</span>
                                            <span class="cf-promo-time" style="color:#166534; font-weight:900;">TERMINA EN: ${timeStr}</span>
                                        `;
                                    }
                                }
                            }
                            container.innerHTML = statusHtml;
                        });
                    };

                    updateTimers();
                    window.cfTimerInterval = setInterval(updateTimers, 1000);

                    // Add listeners to new checkboxes
                    const checks = promosList.querySelectorAll('.cf-promo-check');
                    checks.forEach(check => {
                        check.onchange = () => updatePointsPreview();
                    });
                } else {
                    promosList.innerHTML = '<div style="font-size:10px; color:#999; padding: 5px 0;">No hay promociones disponibles para aplicar.</div>';
                }

                updatePointsPreview();

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
                    promosCount: promosCount,
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
        document.getElementById('cf-final-close').onclick = () => {
            window.removeEventListener('keydown', killEvent, true);
            window.removeEventListener('keyup', killEvent, true);
            window.removeEventListener('keypress', killEvent, true);
            panel.remove();
        };
    }
    function renderPrizes(prizes, userPoints) {
        const prizesList = document.getElementById('cf-prizes-list');
        if (!prizesList) return;

        prizesList.innerHTML = '';
        if (prizes.length === 0) {
            prizesList.innerHTML = '<div style="grid-column: 1 / span 2; text-align: center; color: #9ca3af; font-size: 12px; padding: 20px;">No hay premios disponibles</div>';
            return;
        }

        prizes.forEach(p => {
            const canAfford = userPoints >= p.pointsRequired;
            const hasStock = (p.stock || 0) > 0;
            const isDisabled = !canAfford || !hasStock;

            const card = document.createElement('div');
            card.style.cssText = `
                background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px;
                display: flex; flex-direction: column; gap: 6px; transition: all 0.2s;
                ${isDisabled ? 'opacity: 0.6; filter: grayscale(0.5);' : 'cursor: default;'}
            `;

            card.innerHTML = `
                <div style="height: 60px; background: #f9fafb; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="font-size: 24px;">🎁</span>'}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 11px; font-weight: 800; color: #1f2937; line-height: 1.2; height: 26px; overflow: hidden;">${p.name}</div>
                    <div style="font-size: 12px; font-weight: 900; color: #16a34a; margin-top: 4px;">${p.pointsRequired} pts</div>
                </div>
                <button class="cf-redeem-btn" data-id="${p.id}" ${isDisabled ? 'disabled' : ''} style="
                    width: 100%; padding: 6px; border-radius: 6px; border: none;
                    background: ${isDisabled ? '#d1d5db' : '#16a34a'};
                    color: white; font-size: 10px; font-weight: 800; cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                ">
                    ${!hasStock ? 'SIN STOCK' : (canAfford ? 'CANJEAR' : 'FALTAN PTS')}
                </button>
            `;

            if (!isDisabled) {
                card.querySelector('.cf-redeem-btn').onclick = () => redeemPrize(p);
            }
            prizesList.appendChild(card);
        });
    }

    async function redeemPrize(prize) {
        if (!confirm(`¿Canjear "${prize.name}" por ${prize.pointsRequired} puntos para ${selectedClient.name}?`)) return;

        const prizesList = document.getElementById('cf-prizes-list');
        const originalContent = prizesList.innerHTML;

        prizesList.innerHTML = '<div style="grid-column: 1 / span 2; text-align: center; padding: 40px; color: #16a34a;">Procesando canje...</div>';

        try {
            const res = await fetch(`${config.apiUrl}/api/redeem-prize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    prizeId: prize.id
                })
            });
            const data = await res.json();
            if (data.ok) {
                renderRedemptionSuccess(data, prize);
            } else {
                alert(`Error al canjear: ${data.error}`);
                prizesList.innerHTML = originalContent;
            }
        } catch (e) {
            alert("Error de conexión al procesar canje");
            prizesList.innerHTML = originalContent;
        }
    }

    function renderRedemptionSuccess(data, prize) {
        const body = document.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div class="fidelidad-success" style="text-align: center; color: #16a34a; padding: 10px;">
                <div style="font-size: 40px;">🎁</div>
                <div style="font-weight: bold; font-size: 18px; margin: 5px 0;">¡Canje Exitoso!</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 15px;">
                    ${selectedClient.name} canjeó <strong>${prize.name}</strong>.<br>
                    Nuevo saldo: <strong>${data.newBalance} pts</strong>.
                </div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">ENVIAR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#f3f4f6; color:#374151; margin-top:15px; border: 1px solid #d1d5db;" id="cf-final-close">CERRAR</button>
            </div>
        `;
        document.getElementById('cf-final-close').onclick = () => {
            window.removeEventListener('keydown', killEvent, true);
            window.removeEventListener('keyup', killEvent, true);
            window.removeEventListener('keypress', killEvent, true);
            panel.remove();
        };
    }
}
