// VERSIÓN 17 - INYECCIÓN INTRAMODAL (Adaptación al bloqueo del sitio)
console.log("💉 [Club Fidelidad] v17: Iniciando Inyección Intramodal...");

let config = { apiUrl: '', apiKey: '' };
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => { config = res; });

function run() {
    // 1. Buscamos el modal de facturación (el cuadro blanco)
    const allDivs = document.querySelectorAll('div');
    let modalCobro = null;
    let targetEl = null;

    for (let div of allDivs) {
        if (div.innerText.toUpperCase().includes('TOTAL A PAGAR $:') && div.style.display !== 'none') {
            // Encontramos el elemento que tiene el monto
            targetEl = div;
            // Subimos hasta encontrar el contenedor blanco (el modal)
            modalCobro = div.closest('div[style*="background-color: white"]') || div.parentElement;
            break;
        }
    }

    const existing = document.getElementById('cf-internal-panel');

    if (!targetEl) {
        if (existing) existing.remove();
        return;
    }

    // 2. Si ya encontramos el lugar y no está el panel, lo inyectamos ADENTRO
    if (!existing) {
        injectInside(targetEl);
    }
}

function injectInside(parent) {
    console.log("✨ [Club Fidelidad] Inyectando dentro del modal...");

    const container = document.createElement('div');
    container.id = 'cf-internal-panel';
    container.style.cssText = `
        margin-top: 20px !important;
        padding: 15px !important;
        background: #f0fdf4 !important;
        border: 2px solid #10b981 !important;
        border-radius: 12px !important;
        font-family: sans-serif !important;
        display: block !important;
    `;

    container.innerHTML = `
        <div style="font-weight:bold; color:#065f46; margin-bottom:10px; text-align:center; font-size:14px;">FIDELIDAD: ASIGNAR PUNTOS</div>
        <div style="margin-bottom:10px;">
            <input type="text" id="cf-dni-input" placeholder="DNI DEL CLIENTE..." 
                   style="width:100% !important; height:40px !important; border:1px solid #10b981 !important; border-radius:6px !important; padding:0 10px !important; font-size:16px !important; background:white !important; color:black !important; display:block !important;">
        </div>
        <button id="cf-save-btn" style="width:100%; height:40px; background:#10b981; color:white; border:none; border-radius:6px; font-weight:bold; cursor:pointer;">SUMAR PUNTOS</button>
        <div id="cf-res-msg" style="margin-top:8px; text-align:center; font-size:12px; color:#333;"></div>
    `;

    // Insertamos el panel justo después del texto del monto
    parent.after(container);

    const input = document.getElementById('cf-dni-input');
    const btn = document.getElementById('cf-save-btn');
    const msg = document.getElementById('cf-res-msg');

    // Al estar ADENTRO del modal, el sitio ya no bloquea el foco.
    input.onclick = (e) => { e.stopPropagation(); input.focus(); };

    btn.onclick = async () => {
        const dni = input.value;
        if (!dni) return alert("Ingresá un DNI");

        btn.disabled = true;
        msg.innerText = "Procesando...";

        try {
            // Buscamos monto
            const textoMonto = parent.innerText;
            const match = textoMonto.match(/([0-9.,]+)/);
            let monto = 1;
            if (match) {
                let s = match[0];
                if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
                else if (s.includes(',')) s = s.replace(',', '.');
                monto = parseFloat(s);
            }

            // 1. Buscar
            const r1 = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(dni)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            const d1 = await r1.json();

            if (d1.ok && d1.clients.length > 0) {
                const c = d1.clients[0];
                msg.innerText = "Asignando a " + c.name + "...";

                // 2. Asignar
                const r2 = await fetch(`${config.apiUrl}/api/assign-points`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                    body: JSON.stringify({ uid: c.id, amount: monto, reason: 'v17_internal', concept: 'Venta Facturador' })
                });
                const d2 = await r2.json();
                if (d2.ok) msg.innerHTML = "<b style='color:green'>✅ ¡PUNTOS ASIGNADOS!</b>";
                else msg.innerText = "Error: " + d2.error;
            } else {
                msg.innerText = "Cliente no encontrado";
            }
        } catch (e) {
            msg.innerText = "Error de red";
        }
        btn.disabled = false;
    };
}

// Ejecución periódica para detectar el modal
setInterval(run, 1500);
