// VERSIÓN 14 - RETORNO AL ORIGEN ABSOLUTO
console.log("🔌 [Club Fidelidad] v14: Modo Supervivencia (Original)");

// 1. ELIMINAR CUALQUIER RASTRO PREVIO
const old = document.getElementById('cf-panel-v14');
if (old) old.remove();

// 2. CREAR PANEL SIN ESTILOS COMPLEJOS
const panel = document.createElement('div');
panel.id = 'cf-panel-v14';
panel.style.cssText = `
    position: fixed !important;
    top: 50px !important;
    right: 20px !important;
    width: 300px !important;
    padding: 20px !important;
    background: #ffffff !important;
    border: 4px solid #10b981 !important;
    border-radius: 10px !important;
    z-index: 2147483647 !important;
    box-shadow: 0 0 20px rgba(0,0,0,0.5) !important;
    display: block !important;
`;

panel.innerHTML = `
    <h2 style="color:#10b981; margin:0 0 10px 0; font-family:sans-serif;">FIDELIDAD</h2>
    <div id="cf-monto-label" style="font-size:24px; font-weight:bold; margin-bottom:10px; font-family:sans-serif;">Intentando leer monto...</div>
    <input type="text" id="cf-input-dni" placeholder="ESCRIBÍ DNI ACÁ" 
           style="width:100% !important; height:40px !important; border:2px solid #ccc !important; padding:5px !important; font-size:16px !important; margin-bottom:10px !important; display:block !important; background:white !important; color:black !important; pointer-events:auto !important;">
    <button id="cf-btn-asignar" style="width:100%; height:40px; background:#10b981; color:white; border:none; font-weight:bold; cursor:pointer;">BUSCAR Y ASIGNAR</button>
    <div id="cf-info" style="margin-top:10px; font-family:sans-serif; font-size:12px; color:#333;"></div>
`;

document.body.appendChild(panel);

const input = document.getElementById('cf-input-dni');
const btn = document.getElementById('cf-btn-asignar');
const label = document.getElementById('cf-monto-label');
const info = document.getElementById('cf-info');

// CARGAR CONFIGURACIÓN
let apiUrl = '', apiKey = '';
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    apiUrl = res.apiUrl;
    apiKey = res.apiKey;
});

// DETECTOR DE MONTO ULTRA SIMPLE
setInterval(() => {
    const txt = document.body.innerText.toUpperCase();
    if (txt.includes('TOTAL A PAGAR $:')) {
        const matches = document.body.innerText.match(/TOTAL A PAGAR \$: ([0-9.,]+)/i);
        if (matches && matches[1]) {
            label.innerText = "$" + matches[1];
        }
    }
}, 1000);

// REGLA DE ORO PARA EL INPUT:
// No bloqueamos nada excepto lo mínimo necesario
input.onfocus = () => { console.log("Input enfocado"); };
input.onclick = (e) => { e.stopPropagation(); input.focus(); };

btn.onclick = async () => {
    const q = input.value;
    if (!q) return alert("Ingresá un DNI");

    btn.disabled = true;
    info.innerText = "Buscando...";

    try {
        const r = await fetch(`${apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
            headers: { 'x-api-key': apiKey }
        });
        const d = await r.json();

        if (d.ok && d.clients.length > 0) {
            const c = d.clients[0];
            info.innerText = "Asignando a: " + c.name;

            let amt = parseFloat(label.innerText.replace('$', '').replace(/\./g, '').replace(',', '.')) || 1;

            const r2 = await fetch(`${apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': apiKey },
                body: JSON.stringify({ uid: c.id, amount: amt, reason: 'v14_reversion', concept: 'Venta Directa' })
            });
            const d2 = await r2.json();
            if (d2.ok) info.innerHTML = "<b style='color:green'>PUNTOS ASIGNADOS!</b>";
            else info.innerText = "Error: " + d2.error;
        } else {
            info.innerText = "Cliente no encontrado";
        }
    } catch (e) {
        info.innerText = "Error de conexión";
    }
    btn.disabled = false;
};
