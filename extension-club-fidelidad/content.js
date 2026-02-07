// Integrador Fidelidad - BACK TO BASICS v13
console.log("🚀 [Club Fidelidad] v13: Reconstrucción desde Cero");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;

// Cargar configuración
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
});

// Función de detección periódica
function runLoop() {
    const text = document.body.innerText.toUpperCase();
    const isVisible = text.includes('TOTAL A PAGAR $:');
    const existing = document.getElementById('fidelidad-panel');

    if (!isVisible) {
        if (existing) existing.remove();
        detectedAmount = 0;
        return;
    }

    // Detectar monto del sitio
    let amountFound = 0;
    const allElements = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of allElements) {
        const content = el.innerText.trim();
        if (content.toUpperCase().includes('TOTAL A PAGAR $:')) {
            amountFound = parseValue(content);
            if (amountFound > 0) break;
        }
    }

    if (amountFound > 0) {
        detectedAmount = amountFound;
        if (!existing) {
            injectPanel();
        } else {
            // Actualizar monto si el panel ya existe
            const valEl = document.getElementById('cf-amount-val');
            if (valEl) valEl.innerText = `$${detectedAmount}`;
        }
    }
}

function parseValue(t) {
    let parts = t.split('$');
    let str = parts.length > 1 ? parts[1] : parts[0];
    let clean = str.replace(/[^0-9,.]/g, '').trim();
    if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
    else if (clean.includes(',')) clean = clean.replace(',', '.');
    return parseFloat(clean) || 0;
}

function injectPanel() {
    if (document.getElementById('fidelidad-panel')) return;

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    // Estilo ultra-básico directo
    panel.setAttribute('style', 'position:fixed; top:20px; right:20px; z-index:2147483647; background:white; border:3px solid #10b981; border-radius:15px; width:300px; padding:20px; box-shadow:0 15px 40px rgba(0,0,0,0.5); font-family:Arial, sans-serif; display:block !important;');

    panel.innerHTML = `
        <div style="text-align:center; margin-bottom:15px;">
            <h2 style="margin:0; color:#10b981; font-size:18px;">SUMAR PUNTOS</h2>
            <div id="cf-amount-val" style="font-size:32px; font-weight:bold; color:#059669; margin-top:5px;">$${detectedAmount}</div>
        </div>

        <div style="margin-bottom:15px;">
            <label style="font-size:11px; font-weight:bold; color:#666; display:block; margin-bottom:5px;">CLIENTE (DNI o Nombre)</label>
            <input type="text" id="cf-search-input" placeholder="Escribir aquí..." 
                   style="width:100% !important; height:40px !important; border:1px solid #ccc !important; border-radius:8px !important; padding:0 10px !important; box-sizing:border-box !important; font-size:14px !important; display:block !important; background:white !important; color:black !important;">
            <div id="cf-results-list" style="display:none; background:white; border:1px solid #ddd; border-radius:8px; margin-top:5px; max-height:150px; overflow-y:auto;"></div>
        </div>

        <button id="cf-assign-btn" style="width:100%; background:#10b981; color:white; border:none; padding:15px; border-radius:10px; font-weight:bold; font-size:14px; cursor:pointer;">ASIGNAR PUNTOS</button>
        
        <div id="cf-status-msg" style="margin-top:10px; font-size:12px; text-align:center; color:#666;"></div>
    `;

    document.body.appendChild(panel);

    const input = document.getElementById('cf-search-input');
    const results = document.getElementById('cf-results-list');
    const btn = document.getElementById('cf-assign-btn');
    const status = document.getElementById('cf-status-msg');

    let selectedClient = null;

    // EL SECRETO: Forzar el foco y no bloquear nada globalmente
    input.addEventListener('click', () => input.focus());

    // Evitar que el sitio intercepte las teclas MIENTRAS estamos en el input
    const stopSiteInput = (e) => e.stopPropagation();
    input.addEventListener('keydown', stopSiteInput);
    input.addEventListener('keyup', stopSiteInput);

    let searchTimer;
    input.addEventListener('input', (e) => {
        const q = e.target.value;
        clearTimeout(searchTimer);
        if (q.length < 2) {
            results.style.display = 'none';
            return;
        }
        searchTimer = setTimeout(async () => {
            if (!config.apiUrl) return;
            try {
                const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': config.apiKey }
                });
                const data = await res.json();
                if (data.ok && data.clients.length > 0) {
                    renderSearch(data.clients);
                } else {
                    results.innerHTML = '<div style="padding:10px; font-size:12px;">Sin resultados</div>';
                    results.style.display = 'block';
                }
            } catch (err) { }
        }, 300);
    });

    function renderSearch(clients) {
        results.innerHTML = clients.map(c => `
            <div class="cf-item" data-id="${c.id}" data-name="${c.name}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                <b style="display:block; font-size:13px;">${c.name}</b>
                <small style="color:#888">DNI: ${c.dni}</small>
            </div>
        `).join('');
        results.style.display = 'block';

        results.querySelectorAll('.cf-item').forEach(item => {
            item.onclick = (e) => {
                e.stopPropagation();
                selectedClient = { id: item.dataset.id, name: item.dataset.name };
                input.value = selectedClient.name;
                results.style.display = 'none';
                status.innerHTML = `<span style="color:#059669; font-weight:bold;">Seleccionado: ${selectedClient.name}</span>`;
            };
        });
    }

    btn.onclick = async () => {
        if (!selectedClient) return alert("Primero buscá y seleccioná un cliente");
        if (!config.apiUrl) return alert("Falta configurar la URL");

        btn.disabled = true;
        btn.innerText = "PROCESANDO...";
        status.innerText = "Sincronizando puntos...";

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
                    concept: 'Venta Facturador',
                    applyWhatsApp: true // Por defecto en esta versión básica
                })
            });
            const data = await res.json();
            if (data.ok) {
                status.innerHTML = `<b style="color:#10b981; font-size:14px;">✅ ¡PUNTOS ASIGNADOS! (+${data.pointsAdded})</b>`;
                setTimeout(() => panel.remove(), 3000);
            } else {
                status.innerHTML = `<b style="color:red;">❌ Error: ${data.error}</b>`;
                btn.disabled = false;
                btn.innerText = "REINTENTAR";
            }
        } catch (e) {
            status.innerHTML = '<b style="color:red;">❌ Error de conexión</b>';
            btn.disabled = false;
        }
    };
}

// Ejecutar cada segundo
setInterval(runLoop, 1000);
