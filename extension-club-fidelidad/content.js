// VERSIÓN 16 - MÁXIMO AISLAMIENTO (EL ÚLTIMO RECURSO)
console.log("🚀 [Club Fidelidad] Iniciando Versión 16 - Aislamiento Total");

// 1. Limpieza absoluta
if (document.getElementById('cf-host')) document.getElementById('cf-host').remove();

// 2. Crear un HOST para el Shadow DOM
// El Shadow DOM es la ÚNICA forma de que el sitio NO pueda ver nuestras teclas.
const host = document.createElement('div');
host.id = 'cf-host';
host.style.cssText = `
    position: fixed !important;
    top: 50px !important;
    right: 20px !important;
    z-index: 2147483647 !important;
    display: block !important;
    pointer-events: auto !important;
`;
document.documentElement.appendChild(host);

const shadow = host.attachShadow({ mode: 'open' });

// 3. Estilos dentro de la burbuja
const style = document.createElement('style');
style.textContent = `
    .panel {
        width: 320px;
        background: white;
        border: 4px solid #10b981;
        border-radius: 15px;
        padding: 20px;
        box-shadow: 0 10px 50px rgba(0,0,0,0.5);
        font-family: Arial, sans-serif;
    }
    .monto { font-size: 32px; font-weight: 900; color: #059669; text-align: center; margin: 10px 0; }
    input { 
        width: 100%; height: 45px; border: 2px solid #ccc; border-radius: 8px; 
        padding: 0 10px; font-size: 16px; box-sizing: border-box; margin-bottom: 20px; 
        display: block !important; visibility: visible !important;
    }
    button { 
        width: 100%; background: #10b981; color: white; border: none; 
        padding: 15px; border-radius: 10px; font-weight: bold; cursor: pointer; 
    }
`;
shadow.appendChild(style);

const panel = document.createElement('div');
panel.className = 'panel';
panel.innerHTML = `
    <div style="text-align:center; color:#10b981; font-weight:bold;">FIDELIDAD</div>
    <div id="monto-val" class="monto">$0.00</div>
    <input type="text" id="dni-input" placeholder="ESCRIBÍ DNI ACÁ" autocomplete="off">
    <button id="btn-save">ASIGNAR PUNTOS</button>
    <div id="status" style="margin-top:10px; text-align:center; font-size:12px;"></div>
`;
shadow.appendChild(panel);

// 4. Lógica de Negocio
const input = shadow.getElementById('dni-input');
const btn = shadow.getElementById('btn-save');
const montoEl = shadow.getElementById('monto-val');
const status = shadow.getElementById('status');

let config = { apiUrl: '', apiKey: '' };
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => { config = res; });

// Detector de monto agresivo
setInterval(() => {
    const labels = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, p');
    for (let l of labels) {
        if (l.innerText.toUpperCase().includes('TOTAL A PAGAR $:')) {
            const matches = l.innerText.match(/TOTAL A PAGAR \$: ([0-9.,]+)/i);
            if (matches) montoEl.innerText = "$" + matches[1];
            break;
        }
    }
}, 1000);

// SOLUCIÓN AL TECLADO:
// Detener la propagación en el Shadow Host evita que los eventos suban a la página de facturación.
input.onkeydown = (e) => e.stopPropagation();
input.onkeyup = (e) => e.stopPropagation();
input.onkeypress = (e) => e.stopPropagation();

btn.onclick = async () => {
    const q = input.value;
    if (!q) return alert("Ingresá un DNI");

    btn.disabled = true;
    status.innerText = "Procesando...";

    try {
        const r = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
            headers: { 'x-api-key': config.apiKey }
        });
        const d = await r.json();

        if (d.ok && d.clients.length > 0) {
            const c = d.clients[0];
            const amt = parseFloat(montoEl.innerText.replace('$', '').replace(/\./g, '').replace(',', '.')) || 0;

            const r2 = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({ uid: c.id, amount: amt, reason: 'v16_shadow_fix', concept: 'Venta local' })
            });
            const d2 = await r2.json();
            if (d2.ok) status.innerHTML = "<b style='color:green'>✅ ¡ÉXITO!</b>";
            else status.innerText = "Error: " + d2.error;
        } else {
            status.innerText = "Cliente no encontrado";
        }
    } catch (e) {
        status.innerText = "Error de red";
    }
    btn.disabled = false;
};
