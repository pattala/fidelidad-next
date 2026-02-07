// Integrador Fidelidad - Versión BÁSICA v12
console.log("🚀 [Club Fidelidad] Cargando Versión Básica v12...");

let config = { apiUrl: '', apiKey: '' };

// Cargar configuración
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    config = res;
    console.log("📦 [Club Fidelidad] Configuración:", config.apiUrl ? "URL OK" : "URL Vacía");
});

function detect() {
    const text = document.body.innerText.toUpperCase();
    const isBilling = text.includes('TOTAL A PAGAR') || text.includes('CONFIRMAR FACTURA');
    const panel = document.getElementById('cf-basic-panel');

    if (!isBilling) {
        if (panel) panel.remove();
        return;
    }

    if (!panel) inject();
}

function inject() {
    if (document.getElementById('cf-basic-panel')) return;

    const div = document.createElement('div');
    div.id = 'cf-basic-panel';
    div.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        z-index: 9999999;
        width: 300px;
        background: white;
        border: 2px solid #10b981;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 10px 30px rgba(0,0,0,0.2);
        font-family: Arial, sans-serif;
    `;

    div.innerHTML = `
        <h3 style="margin:0 0 15px 0; color:#10b981; text-align:center;">FIDELIDAD</h3>
        
        <div style="margin-bottom:15px;">
            <label style="font-size:12px; font-weight:bold; color:#666;">DNI O NOMBRE:</label>
            <input type="text" id="cf-dni" placeholder="Escribir aquí..." style="width:100%; padding:10px; margin-top:5px; border:1px solid #ccc; border-radius:5px; box-sizing:border-box;">
        </div>

        <button id="cf-btn" style="width:100%; padding:12px; background:#10b981; color:white; border:none; border-radius:8px; font-weight:bold; cursor:pointer;">BUSCAR Y ASIGNAR</button>
        
        <div id="cf-msg" style="margin-top:10px; font-size:12px; text-align:center; color:#666;"></div>
    `;

    document.body.appendChild(div);

    const btn = document.getElementById('cf-btn');
    const input = document.getElementById('cf-dni');
    const msg = document.getElementById('cf-msg');

    // SOLUCIÓN PARA PODER ESCRIBIR:
    // Solo detenemos la propagación del teclado si el foco está en nuestro input
    input.onkeydown = (e) => e.stopPropagation();
    input.onkeyup = (e) => e.stopPropagation();

    btn.onclick = async () => {
        const q = input.value;
        if (!q) return alert("Por favor ingresá un DNI o Nombre");
        if (!config.apiUrl) return alert("Falta configurar la URL del sistema en la extensión");

        msg.innerText = "Buscando cliente...";
        btn.disabled = true;

        try {
            // 1. Buscar Cliente
            const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            const data = await res.json();

            if (data.ok && data.clients.length > 0) {
                const client = data.clients[0];
                msg.innerText = `Asignando a ${client.name}...`;

                // 2. Intentar asignar 1 punto (Prueba básica)
                const resAsig = await fetch(`${config.apiUrl}/api/assign-points`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'x-api-key': config.apiKey
                    },
                    body: JSON.stringify({
                        uid: client.id,
                        amount: 1,
                        reason: 'external_integration',
                        concept: 'Prueba Extensión'
                    })
                });
                const dataAsig = await resAsig.json();

                if (dataAsig.ok) {
                    msg.innerHTML = `<b style="color:green;">✅ ¡Éxito! +1 punto a ${client.name}</b>`;
                } else {
                    msg.innerHTML = `<b style="color:red;">❌ Error: ${dataAsig.error}</b>`;
                }
            } else {
                msg.innerHTML = `<b style="color:red;">❌ Cliente no encontrado</b>`;
            }
        } catch (e) {
            msg.innerHTML = `<b style="color:red;">❌ Error de conexión</b>`;
        }
        btn.disabled = false;
    };
}

setInterval(detect, 2000);
