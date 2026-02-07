// VERSIÓN 15 - EL MANTRA DE LA SIMPLICIDAD (Basado en el éxito de la Imagen 1)
console.log("🎯 [Club Fidelidad] v15: Rompiendo el bloqueo del modal");

// 1. LIMPIEZA TOTAL
if (document.getElementById('cf-panel-v15')) document.getElementById('cf-panel-v15').remove();

// 2. CREACIÓN DEL PANEL (Igual al que te dejó escribir en la Imagen 1)
const panel = document.createElement('div');
panel.id = 'cf-panel-v15';
panel.style.cssText = `
    position: fixed !important;
    top: 60px !important;
    right: 20px !important;
    width: 320px !important;
    background: white !important;
    border: 3px solid #10b981 !important;
    border-radius: 15px !important;
    z-index: 2147483647 !important;
    padding: 20px !important;
    box-shadow: 0 10px 50px rgba(0,0,0,0.6) !important;
    font-family: Arial, sans-serif !important;
    color: black !important;
`;

panel.innerHTML = `
    <div style="text-align:center; margin-bottom:15px;">
        <h2 style="color:#10b981; margin:0; font-size:20px;">FIDELIDAD</h2>
        <div id="cf-monto" style="font-size:30px; font-weight:900; color:#059669; margin:5px 0;">$0.00</div>
    </div>

    <div style="margin-bottom:15px;">
        <label style="font-size:11px; font-weight:bold; color:#666; display:block; margin-bottom:5px;">BUSCAR CLIENTE (DNI O NOMBRE)</label>
        <input type="text" id="cf-search" placeholder="Escribí acá..." 
               style="width:100% !important; height:45px !important; border:2px solid #ddd !important; border-radius:8px !important; padding:0 10px !important; font-size:16px !important; display:block !important; background:white !important; color:black !important;">
        <div id="cf-res" style="display:none; border:1px solid #ccc; border-radius:8px; margin-top:5px; max-height:120px; overflow-y:auto; background:white;"></div>
    </div>

    <button id="cf-btn" style="width:100%; background:#10b981; color:white; border:none; padding:15px; border-radius:10px; font-weight:bold; font-size:14px; cursor:pointer;">OTORGAR PUNTOS</button>
    <div id="cf-status" style="margin-top:10px; text-align:center; font-size:12px; color:#666;"></div>
`;

document.body.appendChild(panel);

const input = document.getElementById('cf-search');
const btn = document.getElementById('cf-btn');
const montoEl = document.getElementById('cf-monto');
const resBox = document.getElementById('cf-res');
const status = document.getElementById('cf-status');

let config = { apiUrl: '', apiKey: '' };
let selectedClient = null;
let currentAmount = 0;

// Cargar config
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
});

// DETECTOR DE MONTO (Imagen 2 detectada!)
setInterval(() => {
    const labels = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, p');
    for (let l of labels) {
        const t = l.innerText.toUpperCase();
        if (t.includes('TOTAL A PAGAR $:')) {
            let val = t.split('$')[1] || t;
            let clean = val.replace(/[^0-9,.]/g, '').trim();
            if (clean.includes('.') && clean.includes(',')) clean = clean.replace(/\./g, '').replace(',', '.');
            else if (clean.includes(',')) clean = clean.replace(',', '.');
            currentAmount = parseFloat(clean) || 0;
            montoEl.innerText = "$" + currentAmount;
            break;
        }
    }
}, 1000);

// 🛡️ SOLUCIÓN AL BLOQUEO DEL MODAL (Captura de teclado agresiva)
// Esto evita que el sitio "robe" las letras cuando estás en el modal de confirmación
const preventSteal = (e) => {
    e.stopPropagation(); // Detiene al sitio
};
input.addEventListener('keydown', preventSteal, true); // true es la clave: fase de captura
input.addEventListener('keyup', preventSteal, true);
input.addEventListener('keypress', preventSteal, true);
input.onclick = (e) => {
    e.stopPropagation();
    input.focus();
};

// BUSCADOR SIMPLE
let timer;
input.oninput = () => {
    clearTimeout(timer);
    if (input.value.length < 2) { resBox.style.display = 'none'; return; }
    timer = setTimeout(async () => {
        try {
            const r = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(input.value)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            const d = await r.json();
            if (d.ok && d.clients.length > 0) {
                resBox.innerHTML = d.clients.map(c => `
                    <div class="it" data-id="${c.id}" data-name="${c.name}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer; color:black;">
                        <b>${c.name}</b><br><small>DNI: ${c.dni}</small>
                    </div>
                `).join('');
                resBox.style.display = 'block';
                resBox.querySelectorAll('.it').forEach(i => {
                    i.onclick = (e) => {
                        e.stopPropagation();
                        selectedClient = { id: i.dataset.id, name: i.dataset.name };
                        input.value = selectedClient.name;
                        resBox.style.display = 'none';
                        status.innerText = "Cliente seleccionado: " + selectedClient.name;
                    };
                });
            }
        } catch (e) { }
    }, 300);
};

// BOTÓN FINAL
btn.onclick = async () => {
    if (!selectedClient) return alert("Buscá y seleccioná un cliente primero");
    btn.disabled = true;
    status.innerText = "Sincronizando...";

    try {
        const r = await fetch(`${config.apiUrl}/api/assign-points`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
            body: JSON.stringify({
                uid: selectedClient.id,
                amount: currentAmount,
                reason: 'v15_fixed',
                concept: 'Venta local',
                applyWhatsApp: true
            })
        });
        const d = await r.json();
        if (d.ok) {
            status.innerHTML = "<b style='color:green'>✅ ¡ÉXITO! PUNTOS ASIGNADOS</b>";
            setTimeout(() => { if (document.getElementById('cf-panel-v15')) document.getElementById('cf-panel-v15').remove(); }, 3000);
        } else {
            status.innerText = "Error: " + d.error;
            btn.disabled = false;
        }
    } catch (e) {
        status.innerText = "Error de conexión";
        btn.disabled = false;
    }
};
