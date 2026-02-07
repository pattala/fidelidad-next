// Integrador Fidelidad v11 - RECONSTRUCCIÓN SIMPLE (Volviendo a las raíces)
console.log("🚀 [Club Fidelidad] Iniciando Integrador v11 (Versión Simple)");

let state = {
    amount: 0,
    client: null,
    base: 100,
    ratio: 1,
    promos: [],
    apiUrl: '',
    apiKey: ''
};

// Carga de configuración
chrome.storage.local.get(['apiUrl', 'apiKey'], (res) => {
    state.apiUrl = res.apiUrl;
    state.apiKey = res.apiKey;
    if (state.apiUrl) fetchBaseData();
});

// Proxy para evitar CORS usando el Background script
async function callApi(url, method = 'GET', body = null) {
    return new Promise((resolve) => {
        chrome.runtime.sendMessage({
            type: 'API_CALL',
            params: { url, method, body }
        }, res => resolve(res && res.ok ? res.data : { ok: false }));
    });
}

async function fetchBaseData() {
    const data = await callApi(`${state.apiUrl}/api/assign-points?q=___`);
    if (data.ok) {
        state.base = Number(data.pointsMoneyBase) || 100;
        state.ratio = Number(data.pointsPerPeso) || 1;
        state.promos = data.activePromotions || [];
        refreshPromos();
        refreshPoints();
    }
}

function refreshPoints() {
    const ptsEl = document.getElementById('cf-preview-pts');
    if (!ptsEl) return;

    let basePts = Math.floor((state.amount / state.base) * state.ratio);
    let bonus = 0;
    let mult = 1;

    document.querySelectorAll('.cf-chk:checked').forEach(chk => {
        const p = state.promos.find(x => x.id === chk.dataset.id);
        if (p) {
            if (p.rewardType === 'FIXED') bonus += Number(p.rewardValue);
            if (p.rewardType === 'MULTIPLIER') mult *= Number(p.rewardValue);
        }
    });

    ptsEl.innerText = `Equivale a ${Math.floor(basePts * mult) + bonus} puntos`;
}

function refreshPromos() {
    const box = document.getElementById('cf-promo-box');
    if (!box || !state.promos.length) return;

    box.innerHTML = state.promos.map(p => `
        <label style="display:flex; align-items:center; gap:8px; margin-bottom:6px; cursor:pointer; font-size:12px;">
            <input type="checkbox" class="cf-chk" data-id="${p.id}" checked style="width:16px; height:16px;">
            <span style="flex:1">${p.title}</span>
            <b style="background:#10b981; color:white; padding:2px 6px; border-radius:4px; font-size:10px;">${p.rewardType === 'MULTIPLIER' ? 'x' + p.rewardValue : '+' + p.rewardValue}</b>
        </label>
    `).join('');

    box.querySelectorAll('.cf-chk').forEach(c => c.onchange = refreshPoints);
}

function detect() {
    const text = document.body.innerText.toUpperCase();
    const isBilling = text.includes('TOTAL A PAGAR') || text.includes('CONFIRMAR FACTURA');
    const panel = document.getElementById('cf-panel');

    if (!isBilling) {
        if (panel) panel.remove();
        state.amount = 0;
        return;
    }

    let val = 0;
    const Els = document.querySelectorAll('h1, h2, h3, h4, h5, div, span, b, td, label, p');
    for (let el of Els) {
        const t = el.innerText.trim();
        if (t.toUpperCase().includes('TOTAL A PAGAR $:')) {
            val = parse(t);
            break;
        }
    }

    if (val > 0) {
        if (Math.abs(val - state.amount) > 0.1) {
            state.amount = val;
            const inp = document.getElementById('cf-amount-input');
            if (inp) inp.value = String(val).replace('.', ',');
            refreshPoints();
        }
        if (!panel) inject();
    }
}

function parse(t) {
    let s = t.split('$')[1] || t;
    let c = s.replace(/[^0-9,.]/g, '').trim();
    if (c.includes('.') && c.includes(',')) c = c.replace(/\./g, '').replace(',', '.');
    else if (c.includes(',')) c = c.replace(',', '.');
    return parseFloat(c) || 0;
}

setInterval(detect, 1000);

function inject() {
    if (document.getElementById('cf-panel')) return;

    const div = document.createElement('div');
    div.id = 'cf-panel';
    // Estilos simples pero elegantes (Inyección directa, sin Shadow DOM para máxima compatibilidad)
    div.style.cssText = `
        position: fixed; top: 20px; right: 20px; width: 320px; 
        background: white; z-index: 2147483647; border: 2px solid #10b981; 
        border-radius: 16px; padding: 0; box-shadow: 0 10px 40px rgba(0,0,0,0.3);
        font-family: sans-serif; display: block; color: #1f2937;
    `;

    div.innerHTML = `
        <div id="cf-drag" style="background:#10b981; color:white; padding:12px 18px; border-radius:14px 14px 0 0; font-weight:800; font-size:13px; cursor:move; display:flex; justify-content:space-between;">
            <span>CLUB FIDELIDAD</span>
            <span onclick="this.closest('#cf-panel').remove()" style="cursor:pointer">✕</span>
        </div>
        <div style="padding:18px;">
            <label style="font-size:10px; font-weight:800; color:#9ca3af; display:block; margin-bottom:5px;">TOTAL VENTA</label>
            <input type="text" id="cf-amount-input" value="${String(state.amount).replace('.', ',')}" 
                style="width:100%; border:2px solid #f3f4f6; border-radius:10px; padding:10px; font-size:20px; font-weight:900; text-align:center; color:#059669; margin-bottom:10px; box-sizing:border-box;">
            <div id="cf-preview-pts" style="text-align:center; color:#059669; font-weight:700; font-size:13px; margin-bottom:15px; background:#ecfdf5; padding:6px; border-radius:8px;">Calculando...</div>

            <label style="font-size:10px; font-weight:800; color:#9ca3af; display:block; margin-bottom:5px;">BUSCAR CLIENTE</label>
            <input type="text" id="cf-search" placeholder="Escribir DNI o Nombre..." 
                style="width:100%; border:2px solid #f3f4f6; border-radius:10px; padding:12px; font-size:14px; margin-bottom:10px; box-sizing:border-box; outline:none;">
            <div id="cf-results" style="display:none; position:absolute; background:white; border:1px solid #ddd; border-radius:8px; width:284px; max-height:150px; overflow-y:auto; z-index:10; box-shadow:0 4px 10px rgba(0,0,0,0.1);"></div>
            <div id="cf-sel-box" style="display:none; padding:10px; border:2px solid #10b981; border-radius:10px; background:#ecfdf5; color:#065f46; font-weight:800; text-align:center; margin-bottom:15px; font-size:13px;"></div>

            <div style="background:#f9fafb; border-radius:10px; padding:10px; border:1px solid #f3f4f6; margin-bottom:15px;">
                <div style="font-size:9px; font-weight:900; color:#9ca3af; margin-bottom:8px;">PROMOS ACTIVAS</div>
                <div id="cf-promo-box">
                    <div style="font-size:11px; color:#999; text-align:center;">Cargando...</div>
                </div>
            </div>

            <label style="display:flex; align-items:center; gap:8px; margin-bottom:15px; cursor:pointer; font-weight:700; color:#059669; font-size:12px;">
                <input type="checkbox" id="cf-wa" checked style="width:16px; height:16px;">
                <span>Informar por WhatsApp</span>
            </label>

            <button id="cf-confirm" disabled style="width:100%; background:#10b981; color:white; border:none; padding:15px; border-radius:12px; font-weight:800; font-size:14px; cursor:pointer;">OTORGAR PUNTOS</button>
            <div id="cf-status" style="text-align:center; margin-top:10px; font-size:11px; color:#6b7280;"></div>
        </div>
    `;

    document.body.appendChild(div);

    // LOGICA DE INTERACCION SIMPLE
    const sInp = document.getElementById('cf-search');
    const aInp = document.getElementById('cf-amount-input');
    const rBox = document.getElementById('cf-results');
    const sBtn = document.getElementById('cf-confirm');
    const drag = document.getElementById('cf-drag');

    // Detener la propagación solo cuando el usuario interactúa para no interferir con el sitio
    [div, sInp, aInp].forEach(el => {
        el.addEventListener('keydown', e => e.stopPropagation(), true);
        el.addEventListener('keyup', e => e.stopPropagation(), true);
        el.addEventListener('mousedown', e => e.stopPropagation(), true);
    });

    aInp.oninput = (e) => {
        state.amount = parseFloat(e.target.value.replace(',', '.')) || 0;
        refreshPoints();
    };

    let t;
    sInp.oninput = (e) => {
        const q = e.target.value;
        clearTimeout(t);
        if (q.length < 2) { rBox.style.display = 'none'; return; }
        t = setTimeout(async () => {
            const res = await callApi(`${state.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`);
            if (res.ok) showResults(res.clients);
        }, 300);
    };

    function showResults(cls) {
        if (!cls.length) { rBox.innerHTML = '<div style="padding:10px; font-size:12px;">Sin resultados</div>'; }
        else {
            rBox.innerHTML = cls.map(c => `
                <div class="row" data-id="${c.id}" data-name="${c.name}" style="padding:10px; border-bottom:1px solid #eee; cursor:pointer;">
                    <b style="font-size:13px; display:block;">${c.name}</b>
                    <small style="color:#666">DNI: ${c.dni}</small>
                </div>
            `).join('');
        }
        rBox.style.display = 'block';
        rBox.querySelectorAll('.row').forEach(row => {
            row.onmousedown = (e) => {
                e.preventDefault(); e.stopPropagation();
                state.client = { id: row.dataset.id, name: row.dataset.name };
                const sel = document.getElementById('cf-sel-box');
                sel.innerText = `Beneficiario: ${state.client.name}`;
                sel.style.display = 'block';
                rBox.style.display = 'none';
                sInp.value = state.client.name;
                sBtn.disabled = false;
            };
        });
    }

    sBtn.onclick = async () => {
        sBtn.disabled = true;
        sBtn.innerText = 'PROCESANDO...';
        const st = document.getElementById('cf-status');
        st.innerText = 'Sincronizando...';

        const bIds = Array.from(document.querySelectorAll('.cf-chk:checked')).map(c => c.dataset.id);
        const res = await callApi(`${state.apiUrl}/api/assign-points`, 'POST', {
            uid: state.client.id,
            amount: state.amount,
            reason: 'external_integration',
            concept: 'Venta facturador',
            bonusIds: bIds,
            applyWhatsApp: document.getElementById('cf-wa').checked
        });

        if (res.ok) {
            document.querySelector('#cf-panel .padding').innerHTML = `
                <div style="text-align:center; padding:20px 0;">
                    <div style="font-size:40px; margin-bottom:10px;">✅</div>
                    <div style="font-weight:800; font-size:18px; color:#10b981;">¡Éxito!</div>
                    <p style="font-size:13px; color:#666;">Sumaste ${res.pointsAdded} puntos.</p>
                    ${res.whatsappLink ? `<a href="${res.whatsappLink}" target="_blank" style="display:block; background:#25d366; color:white; padding:14px; border-radius:10px; font-weight:800; text-decoration:none; margin-bottom:10px; font-size:13px;">ENVIAR WHATSAPP</a>` : ''}
                    <button onclick="document.getElementById('cf-panel').remove()" style="width:100%; padding:10px; border:none; border-radius:8px; cursor:pointer;">CERRAR</button>
                </div>
            `;
        } else {
            st.innerText = '❌ Error al asignar'; sBtn.disabled = false; sBtn.innerText = 'REINTENTAR';
        }
    };

    // Arrastre simple
    let isD = false, ox, oy;
    drag.onmousedown = e => {
        isD = true; ox = e.clientX - div.offsetLeft; oy = e.clientY - div.offsetTop;
        e.preventDefault(); e.stopPropagation();
    };
    document.onmousemove = e => {
        if (!isD) return;
        div.style.left = (e.clientX - ox) + 'px';
        div.style.top = (e.clientY - oy) + 'px';
    };
    document.onmouseup = () => isD = false;

    if (state.promos.length) refreshPromos();
}
