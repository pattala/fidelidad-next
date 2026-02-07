// Integrador Fidelidad v19 - LA VERSIÓN AZUL (The Original feel)
console.log("🔵 [Club Fidelidad] v19: Modo 'Versión Azul' activado");

// Limpieza total de versiones anteriores
(function clearOld() {
    const ids = ['cf-panel-v18', 'cf-internal-panel', 'cf-host', 'cf-panel-v14', 'fidelidad-panel', 'cf-basic-panel', 'cf-panel'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.remove();
    });
})();

let config = { apiUrl: '', apiKey: '' };
let montoTotal = 0;

// Cargar Config
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
});

// Detector de monto (Simple)
function scan() {
    const bodyText = document.body.innerText;
    if (bodyText.includes('TOTAL A PAGAR $:')) {
        const match = bodyText.match(/TOTAL A PAGAR \$: ([0-9.,]+)/i);
        if (match) {
            let s = match[1].replace(/\./g, '').replace(',', '.');
            montoTotal = parseFloat(s) || 0;
            const mEl = document.getElementById('cf-blue-monto');
            if (mEl) mEl.innerText = "$" + match[1];
        }
    }
}

// Inyección del Panel Azul
function check() {
    const isBilling = document.body.innerText.includes('CONFIRMAR FACTURA') || document.body.innerText.includes('TOTAL A PAGAR');
    const panel = document.getElementById('cf-panel-blue');

    if (!isBilling) {
        if (panel) panel.remove();
        return;
    }

    if (!panel) {
        injectBlue();
    }
    scan();
}

function injectBlue() {
    const div = document.createElement('div');
    div.id = 'cf-panel-blue';
    // Estilo "Azul" original simple
    div.style.cssText = `
        position: fixed !important;
        top: 30px !important;
        right: 30px !important;
        width: 300px !important;
        background: #f0f7ff !important;
        border: 3px solid #1e40af !important;
        border-radius: 8px !important;
        z-index: 2147483647 !important;
        padding: 15px !important;
        box-shadow: 0 4px 20px rgba(0,0,0,0.4) !important;
        font-family: 'Arial', sans-serif !important;
        display: block !important;
        color: #1e3a8a !important;
    `;

    div.innerHTML = `
        <div style="font-weight:bold; font-size:16px; margin-bottom:10px; text-align:center; border-bottom: 1px solid #1e40af; padding-bottom:5px;">
            FIDELIDAD - CLIENTES
        </div>
        <div style="text-align:center; margin-bottom:15px;">
            <div style="font-size:10px; color:#1e40af; font-weight:bold; text-transform:uppercase;">Monto Detectado</div>
            <div id="cf-blue-monto" style="font-size:24px; font-weight:900;">$0.00</div>
        </div>
        
        <div style="margin-bottom:10px;">
            <label style="font-size:11px; font-weight:bold; display:block; margin-bottom:4px;">BUSCAR (DNI o Nombre):</label>
            <input type="text" id="cf-blue-input" autocomplete="off" 
                   style="width:100% !important; border:1px solid #1e40af !important; border-radius:4px !important; padding:8px !important; font-size:15px !important; box-sizing:border-box !important; background:white !important; color:black !important; display:block !important;">
            <div id="cf-blue-results" style="display:none; position:absolute; width:264px; background:white; border:1px solid #1e40af; border-radius:4px; max-height:120px; overflow-y:auto; z-index:99999;"></div>
        </div>

        <button id="cf-blue-btn" style="width:100%; background:#1e40af; color:white; border:none; padding:12px; border-radius:4px; font-weight:bold; cursor:pointer; font-size:14px;">ASIGNAR PUNTOS</button>
        <div id="cf-blue-status" style="margin-top:10px; font-size:11px; text-align:center;"></div>
    `;

    document.body.appendChild(div);

    const input = document.getElementById('cf-blue-input');
    const btn = document.getElementById('cf-blue-btn');
    const status = document.getElementById('cf-blue-status');
    const results = document.getElementById('cf-blue-results');

    // --- EL ARREGLO PARA QUE TE DEJE ESCRIBIR ---
    // Atrapamos el teclado en fase de captura para que el sitio no lo vea.
    const keyStopper = (e) => {
        if (document.activeElement === input) {
            e.stopPropagation();
            // e.stopImmediatePropagation(); // Usar si stopPropagation no alcanza
        }
    };
    input.addEventListener('keydown', keyStopper, true);
    input.addEventListener('keyup', keyStopper, true);
    input.addEventListener('keypress', keyStopper, true);

    // Prevención de pérdida de foco
    input.addEventListener('blur', () => {
        // Si el usuario estaba escribiendo, intentamos mantener el foco
        // Pero con cuidado de no romper el resto de la página
    });

    let timer;
    input.oninput = () => {
        const q = input.value;
        clearTimeout(timer);
        if (q.length < 2) { results.style.display = 'none'; return; }

        timer = setTimeout(async () => {
            if (!config.apiUrl) return;
            try {
                const r = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': config.apiKey }
                });
                const d = await r.json();
                if (d.ok && d.clients.length > 0) {
                    results.innerHTML = d.clients.map(c => `
                        <div class="blue-it" data-id="${c.id}" data-name="${c.name}" data-dni="${c.dni}" style="padding:8px; border-bottom:1px solid #eee; cursor:pointer; color:black;">
                            <b style="font-size:13px;">${c.name}</b><br><small>DNI: ${c.dni}</small>
                        </div>
                    `).join('');
                    results.style.display = 'block';

                    results.querySelectorAll('.blue-it').forEach(item => {
                        item.onmousedown = (e) => {
                            e.preventDefault();
                            const cid = item.dataset.id;
                            const cname = item.dataset.name;
                            input.value = cname;
                            results.style.display = 'none';
                            input.dataset.selectedId = cid;
                            status.innerHTML = `<b style="color:#1e40af">Cliente: ${cname}</b>`;
                        };
                    });
                }
            } catch (e) { }
        }, 300);
    };

    btn.onclick = async () => {
        const clientId = input.dataset.selectedId;
        if (!clientId) return alert("Por favor buscá y seleccioná un cliente de la lista");

        btn.disabled = true;
        btn.innerText = "PROCESANDO...";
        status.innerText = "Sincronizando puntos...";

        try {
            const r = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: clientId,
                    amount: montoTotal,
                    reason: 'v19_blue_back',
                    concept: 'Venta local',
                    applyWhatsApp: true
                })
            });
            const d = await r.json();
            if (d.ok) {
                status.innerHTML = "<b style='color:green'>✅ ¡ÉXITO! PUNTOS ASIGNADOS</b>";
                setTimeout(() => { div.remove(); }, 3000);
            } else {
                status.innerText = "Error: " + d.error;
                btn.disabled = false;
                btn.innerText = "REINTENTAR";
            }
        } catch (e) {
            status.innerText = "Error de conexión";
            btn.disabled = false;
            btn.innerText = "REINTENTAR";
        }
    };
}

setInterval(check, 1000);
