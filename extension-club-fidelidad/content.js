
// Integrador Fidelidad v23 - EL INTEGRAL FINAL
console.log("🔵 [Club Fidelidad] v23: Iniciando versión azul con detección de texto y drag");

let config = { apiUrl: '', apiKey: '' };
let state = {
    amount: 0,
    client: null,
    isDragging: false,
    offsetX: 0,
    offsetY: 0
};

// Cargar Config
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
});

// DETECTOR AGRESIVO POR TEXTO (Para que aparezca siempre)
function runDetection() {
    const text = document.body.innerText.toUpperCase();
    const isVisible = text.includes('TOTAL A PAGAR') || text.includes('CONFIRMAR FACTURA');
    const existing = document.getElementById('cf-final-panel');

    if (!isVisible) {
        if (existing) existing.remove();
        return;
    }

    // Buscar el monto en el texto de la página
    let valFound = 0;
    const all = document.querySelectorAll('div, span, b, td, h1, h2, h3, label');
    for (let el of all) {
        const t = el.innerText.trim();
        if (t.toUpperCase().includes('TOTAL A PAGAR $:')) {
            const parts = t.split('$');
            const clean = (parts[1] || parts[0]).replace(/[^0-9,.]/g, '').replace(',', '.');
            valFound = parseFloat(clean) || 0;
            break;
        }
    }

    if (valFound > 0) {
        state.amount = valFound;
        if (!existing) inject();
        else {
            const amtEl = existing.querySelector('#cf-amt-display');
            if (amtEl) amtEl.innerText = `$ ${valFound.toLocaleString('es-AR')}`;
        }
    }
}

function inject() {
    if (document.getElementById('cf-final-panel')) return;

    const div = document.createElement('div');
    div.id = 'cf-final-panel';
    div.style.cssText = `
        position: fixed !important; top: 40px !important; right: 20px !important;
        width: 320px !important; background: #f0f7ff !important; border: 3px solid #1e40af !important;
        border-radius: 12px !important; z-index: 2147483647 !important; padding: 0 !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important; font-family: sans-serif !important;
    `;

    div.innerHTML = `
        <div id="cf-blue-header" style="background:#1e40af; color:white; padding:10px 15px; border-radius:8px 8px 0 0; cursor:move; display:flex; justify-content:space-between; font-weight:bold; font-size:14px;">
            <span>CLUB FIDELIDAD</span>
            <span onclick="this.closest('#cf-final-panel').remove()" style="cursor:pointer">✕</span>
        </div>
        <div style="padding:20px;">
            <div style="text-align:center; margin-bottom:15px;">
                <div style="font-size:10px; color:#1e40af; font-weight:bold; text-transform:uppercase;">Monto de Venta</div>
                <div id="cf-amt-display" style="font-size:28px; font-weight:900; color:#1e3a8a;">$ ${state.amount.toLocaleString('es-AR')}</div>
            </div>

            <div style="margin-bottom:15px;">
                <label style="font-size:11px; font-weight:bold; color:#1e40af; display:block; margin-bottom:5px;">BUSCAR CLIENTE</label>
                <input type="text" id="cf-blue-input" placeholder="Nombre o DNI..." 
                    style="width:100% !important; height:42px !important; border:2px solid #1e40af !important; border-radius:8px !important; padding:0 12px !important; box-sizing:border-box !important; font-size:15px !important; display:block !important; background:white !important; color:black !important;">
                <div id="cf-blue-results" style="display:none; background:white; border:1px solid #1e40af; border-radius:8px; margin-top:5px; max-height:140px; overflow-y:auto; z-index:99999;"></div>
            </div>

            <button id="cf-blue-confirm" style="width:100%; height:48px; background:#1e40af; color:white; border:none; border-radius:8px; font-weight:bold; font-size:15px; cursor:pointer;">OTORGAR PUNTOS</button>
            <div id="cf-blue-status" style="margin-top:12px; text-align:center; font-size:12px; color:#1e3a8a;"></div>
        </div>
    `;

    document.body.appendChild(div);

    const input = document.getElementById('cf-blue-input');
    const results = document.getElementById('cf-blue-results');
    const btn = document.getElementById('cf-blue-confirm');
    const status = document.getElementById('cf-blue-status');
    const header = document.getElementById('cf-blue-header');

    // ARREGLO DE ESCRITURA (CAPTURA FRONTAL)
    const stopProp = (e) => { if (document.activeElement === input) e.stopPropagation(); };
    input.addEventListener('keydown', stopProp, true);
    input.addEventListener('keyup', stopProp, true);
    input.addEventListener('keypress', stopProp, true);

    // BÚSQUEDA
    let timer;
    input.oninput = () => {
        const q = input.value;
        clearTimeout(timer);
        if (q.length < 2) { results.style.display = 'none'; return; }
        timer = setTimeout(async () => {
            try {
                const r = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': config.apiKey }
                });
                const data = await r.json();
                if (data.ok && data.clients.length > 0) {
                    results.innerHTML = data.clients.map(c => `
                        <div class="row" data-id="${c.id}" data-name="${c.name}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; color:black;">
                            <b>${c.name}</b><br><small style="color:#666">DNI: ${c.dni}</small>
                        </div>
                    `).join('');
                    results.style.display = 'block';
                    results.querySelectorAll('.row').forEach(row => {
                        row.onclick = (e) => {
                            e.stopPropagation();
                            state.client = { id: row.dataset.id, name: row.dataset.name };
                            input.value = state.client.name;
                            results.style.display = 'none';
                            status.innerHTML = `Cliente: <b>${state.client.name}</b>`;
                        };
                    });
                }
            } catch (err) { }
        }, 300);
    };

    // BOTÓN ASIGNAR
    btn.onclick = async () => {
        if (!state.client) return alert("Por favor seleccioná un cliente");
        btn.disabled = true;
        btn.innerText = "Sincronizando...";
        try {
            const r = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: state.client.id,
                    amount: state.amount,
                    reason: 'v23_final_blue',
                    concept: 'Venta local',
                    applyWhatsApp: true
                })
            });
            const d = await r.json();
            if (d.ok) {
                status.innerHTML = "<b style='color:green'>✅ ¡PUNTOS ASIGNADOS!</b>";
                setTimeout(() => div.remove(), 3000);
            } else {
                status.innerText = "Error: " + d.error; btn.disabled = false; btn.innerText = "OTORGAR PUNTOS";
            }
        } catch (e) {
            status.innerText = "Error de conexión"; btn.disabled = false;
        }
    };

    // FUNCIÓN DRAG (ARRASTRAR)
    header.onmousedown = (e) => {
        state.isDragging = true;
        state.offsetX = e.clientX - div.offsetLeft;
        state.offsetY = e.clientY - div.offsetTop;
        e.preventDefault();
    };
    document.addEventListener('mousemove', (e) => {
        if (!state.isDragging) return;
        div.style.left = (e.clientX - state.offsetX) + 'px';
        div.style.top = (e.clientY - state.offsetY) + 'px';
        div.style.right = 'auto';
    });
    document.addEventListener('mouseup', () => { state.isDragging = false; });
}

setInterval(runDetection, 1500);
