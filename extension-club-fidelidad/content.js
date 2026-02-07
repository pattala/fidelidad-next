// Integrador Fidelidad v18 - EL RETORNO (Simple & Funcional)
console.log("🚀 [Club Fidelidad] v18: Reconstrucción 'La Primera Version'");

// 1. Limpieza de cualquier rastro previo para evitar conflictos
['cf-panel', 'cf-host', 'cf-basic-panel', 'fidelidad-panel', 'cf-panel-v14', 'cf-host-shadow', 'cf-panel-v15'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.remove();
});

let state = {
    apiUrl: '',
    apiKey: '',
    monto: 0,
    cliente: null
};

// Cargar configuración
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    state.apiUrl = res.apiUrl;
    state.apiKey = res.apiKey;
});

// DETECTOR DE MONTO (Simple y robusto)
function updateMonto() {
    const text = document.body.innerText.toUpperCase();
    if (text.includes('TOTAL A PAGAR $:')) {
        const matches = document.body.innerText.match(/TOTAL A PAGAR \$: ([0-9.,]+)/i);
        if (matches && matches[1]) {
            let s = matches[1];
            if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
            else if (s.includes(',')) s = s.replace(',', '.');
            state.monto = parseFloat(s) || 0;

            // Si el panel existe, actualizamos el texto
            const mEl = document.getElementById('cf-monto-display');
            if (mEl) mEl.innerText = "$" + state.monto;
        }
    }
}

// INYECTOR DE PANEL (Casi idéntico a la primera versión)
function checkAndInject() {
    const text = document.body.innerText.toUpperCase();
    const isBilling = text.includes('TOTAL A PAGAR') || text.includes('CONFIRMAR FACTURA');
    const existing = document.getElementById('cf-panel-v18');

    if (!isBilling) {
        if (existing) {
            existing.remove();
            state.monto = 0;
        }
        return;
    }

    if (!existing) {
        inject();
    }
    updateMonto();
}

function inject() {
    const div = document.createElement('div');
    div.id = 'cf-panel-v18';
    div.style.cssText = `
        position: fixed !important;
        top: 20px !important;
        right: 20px !important;
        width: 300px !important;
        background: white !important;
        border: 4px solid #10b981 !important;
        border-radius: 12px !important;
        z-index: 2147483647 !important;
        padding: 20px !important;
        box-shadow: 0 10px 40px rgba(0,0,0,0.5) !important;
        font-family: Arial, sans-serif !important;
        display: block !important;
    `;

    div.innerHTML = `
        <div style="text-align:center; margin-bottom:15px;">
            <b style="color:#10b981; font-size:18px;">FIDELIDAD</b>
            <div id="cf-monto-display" style="font-size:32px; font-weight:900; color:#059669; margin:5px 0;">$${state.monto}</div>
        </div>

        <div style="margin-bottom:15px;">
            <label style="font-size:11px; font-weight:bold; color:#666; display:block; margin-bottom:5px;">BUSCAR CLIENTE</label>
            <input type="text" id="cf-input-search" placeholder="DNI o Nombre..." 
                   style="width:100% !important; height:40px !important; border:2px solid #ccc !important; border-radius:6px !important; padding:0 10px !important; box-sizing:border-box !important; font-size:16px !important; display:block !important; background:white !important; color:black !important; pointer-events:auto !important;">
            <div id="cf-results-box" style="display:none; background:white; border:1px solid #ddd; border-radius:8px; margin-top:5px; max-height:150px; overflow-y:auto;"></div>
        </div>

        <button id="cf-btn-go" style="width:100%; height:45px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; font-size:14px; cursor:pointer;">OTORGAR PUNTOS</button>
        
        <div id="cf-msg-status" style="margin-top:10px; font-size:12px; text-align:center; color:#666;"></div>
    `;

    document.body.appendChild(div);

    const input = document.getElementById('cf-input-search');
    const results = document.getElementById('cf-results-box');
    const btn = document.getElementById('cf-btn-go');
    const status = document.getElementById('cf-msg-status');

    // --- EL GRAN FIX PARA PODER ESCRIBIR EN EL MODAL ---
    // Usamos el modo "Captura" (true) para interceptar las teclas ANTES que el facturador.
    // Esto es lo más potente que existe en Javascript para ganar la guerra del teclado.
    const keyFix = (e) => {
        if (document.activeElement === input) {
            e.stopImmediatePropagation();
        }
    };
    window.addEventListener('keydown', keyFix, true);
    window.addEventListener('keyup', keyFix, true);
    window.addEventListener('keypress', keyFix, true);

    // Click forzado
    input.onclick = (e) => {
        e.stopPropagation();
        input.focus();
    };

    let timer;
    input.oninput = () => {
        const q = input.value;
        clearTimeout(timer);
        if (q.length < 2) { results.style.display = 'none'; return; }

        timer = setTimeout(async () => {
            if (!state.apiUrl) return;
            try {
                const r = await fetch(`${state.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                    headers: { 'x-api-key': state.apiKey }
                });
                const d = await r.json();
                if (d.ok && d.clients.length > 0) {
                    results.innerHTML = d.clients.map(c => `
                        <div class="it" data-id="${c.id}" data-name="${c.name}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; color:black;">
                            <b>${c.name}</b><br><small>DNI: ${c.dni}</small>
                        </div>
                    `).join('');
                    results.style.display = 'block';

                    results.querySelectorAll('.it').forEach(item => {
                        item.onclick = (e) => {
                            e.stopPropagation();
                            state.cliente = { id: item.dataset.id, name: item.dataset.name };
                            input.value = state.cliente.name;
                            results.style.display = 'none';
                            status.innerHTML = `<b style="color:#059669">Cliente: ${state.cliente.name}</b>`;
                        };
                    });
                }
            } catch (e) { }
        }, 300);
    };

    btn.onclick = async () => {
        if (!state.cliente) return alert("Buscá y seleccioná un cliente");
        btn.disabled = true;
        status.innerText = "Asignando puntos...";

        try {
            const r = await fetch(`${state.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': state.apiKey },
                body: JSON.stringify({
                    uid: state.cliente.id,
                    amount: state.monto,
                    reason: 'v18_final_fix',
                    concept: 'Venta Facturador',
                    applyWhatsApp: true
                })
            });
            const d = await r.json();
            if (d.ok) {
                status.innerHTML = "<b style='color:#10b981; font-size:14px;'>✅ ¡PUNTOS ASIGNADOS!</b>";
                setTimeout(() => div.remove(), 3000);
            } else {
                status.innerText = "Error: " + d.error;
                btn.disabled = false;
            }
        } catch (e) {
            status.innerText = "Error de red";
            btn.disabled = false;
        }
    };
}

// Escanear cada segundo
setInterval(checkAndInject, 1000);
