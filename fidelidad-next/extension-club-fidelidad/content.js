// Club Fidelidad - Content Script (VERSIÓN EMPLEADO V45 - RESCUE STABLE)
if (window.location.href.includes('fidelidad-next.vercel.app') || window.location.href.includes('/admin') || window.location.href.includes('pattala.com')) {
    console.log("🛡️ [Club Fidelidad] Extensión desactivada en el Dashboard.");
} else {
    console.log("🚀 [Club Fidelidad] V45: Iniciando extensión.");

let config = { apiUrl: '', apiKey: '' };
let detectedAmount = 0;
let detectedDiscounts = 0;
let apiRatios = { base: 100, perPeso: 1, discountK: 0 };
let currentPromos = [];
let enablePetModule = false;

const getIdentifier = (item) => item?.socioNumber || item?.phone || item?.telefono || item?.dni || item?.userId || 'unknown';

// Cargar configuración de storage
chrome.storage.local.get(['appName', 'apiUrl', 'apiKey', 'dismissedAlerts'], (res) => {
    config = res;
    if (res.apiUrl && res.apiKey) {
        // Trigger Engine (Solo motor diario unificado)

        fetch(`${res.apiUrl}/api/engine-daily?mode=daily&trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': res.apiKey }
        }).then(r => r.json())
        .then(data => {
                console.log("💎 [Club Fidelidad] API FULL DATA:", data);
                
                const serverProcessed = data.processedAlerts || {};
                chrome.storage.local.get(['dismissedAlerts'], (store) => {
                    let localList = store.dismissedAlerts || [];
                    if (!Array.isArray(localList)) localList = [];

                    // 1. MEZCLAR estados del servidor con locales
                    Object.keys(serverProcessed).forEach(id => {
                        const status = serverProcessed[id];
                        const exists = localList.find(d => d.id === id);
                        if (!exists) {
                            localList.push({ id, status, timestamp: Date.now() });
                        } else if (exists.status !== status) {
                            exists.status = status; // Prioridad al servidor
                        }
                    });

                    chrome.storage.local.set({ dismissedAlerts: localList }, () => {
                        const curY = new Date().getFullYear().toString();
                        const bList = data.birthdays || [];
                        const eList = data.expirations || [];
                        const pList = data.petAlerts || [];
                        const rList = data.redemptions || [];
                        const aList = data.pointsAssignments || [];

                        // GUARDAR CONFIGURACIÓN COMPLETA GLOBALMENTE
                        if (data.config) {
                            config = { ...config, ...data.config };
                        }

                        const getStatus = (id) => {
                            const entry = localList.find(d => d.id === id);
                            return entry ? entry.status : 'pending';
                        };

                        const filteredBirthdays = bList.filter(b => getStatus(`birthday-${getIdentifier(b)}-${curY}`) === 'pending');
                        const filteredExpirations = eList.filter(e => getStatus(`expiration-${getIdentifier(e)}-${e.nextExpirationDate || 'today'}-${e.points || 0}`) === 'pending');
                        const filteredPetAlerts = pList.filter(p => getStatus(`pet-${getIdentifier(p)}-${p.petName}-${p.lastFoodAlertDate || 'today'}-${p.points || 0}`) === 'pending');
                        const filteredRedemptions = rList.filter(r => getStatus(r.alertId) === 'pending');
                        const filteredAssignments = aList.filter(a => getStatus(a.alertId) === 'pending');

                        const total = filteredBirthdays.length + filteredExpirations.length + filteredPetAlerts.length + filteredRedemptions.length + filteredAssignments.length;
                        const processedData = {
                            ...data,
                            dismissedAlerts: localList,
                            birthdays: { list: bList }, 
                            expirations: { list: eList },
                            petAlerts: { list: pList },
                            redemptions: { list: rList },
                            pointsAssignments: { list: aList }
                        };

                        if (total > 0 || localList.length > 0) {
                            showGlobalAlert(processedData, config);
                        }
                    });
                });
            }).catch(e => console.error("❌ [Club Fidelidad] Error:", e.message));
    }
});

    if (!document.getElementById('cf-v35-styles')) {
        const style = document.createElement('style');
        style.id = 'cf-v35-styles';
        style.textContent = `
            .cf-v35-glass {
                background: rgba(13, 10, 42, 0.98); backdrop-filter: blur(25px); -webkit-backdrop-filter: blur(25px);
                border: 1px solid rgba(255,255,255,0.15); border-radius: 36px;
                box-shadow: 0 50px 100px -20px rgba(0,0,0,0.85); color: white;
                font-family: system-ui, -apple-system, sans-serif; pointer-events: auto;
            }
            .cf-v35-bubble {
                width: 78px; height: 78px; background: linear-gradient(135deg, #6366f1, #8b5cf6);
                border-radius: 50%; display: flex; align-items:center; justify-content:center;
                cursor: grab; border: 4px solid white; box-shadow: 0 20px 50px rgba(99, 102, 241, 0.6);
                transition: transform 0.2s; animation: cf-v35-float 4s infinite ease-in-out; pointer-events: auto;
            }
            .cf-v35-panel { width: 400px; max-height: 580px; display: flex; flex-direction: column; overflow: hidden; animation: cf-v35-pop 0.3s cubic-bezier(0,1,0.2,1); }
            .cf-v35-card { position: relative; background: rgba(255,255,255,0.07); border-radius: 30px; padding: 20px; margin-bottom: 12px; border: 1px solid rgba(255,255,255,0.1); }
            .cf-v35-card-close { position: absolute; top: 15px; right: 15px; background: none; border: none; color: rgba(255,255,255,0.4); font-size: 20px; cursor: pointer; transition: color 0.2s; }
            .cf-v35-card-close:hover { color: #ef4444; }
            .cf-v35-btn-wa {
                background: linear-gradient(135deg, #25D366, #128C7E); color: white; border: none;
                border-radius: 18px; padding: 12px; font-weight: 900; font-size: 12px;
                text-transform: uppercase; cursor: pointer; width: 100%; transition: all 0.2s;
            }
            .cf-v35-btn-wa:hover { filter: brightness(1.1); transform: scale(1.02); }
            @keyframes cf-v35-float { 0%,100% {transform:translateY(0)} 50% {transform:translateY(-12px)} }
            @keyframes cf-v35-pop { from {opacity:0; transform:scale(0.8) translateY(40px)} to {opacity:1; transform:scale(1) translateY(0)} }
            .cf-scrollbar::-webkit-scrollbar { width: 4px; }
            .cf-scrollbar::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.15); border-radius: 10px; }
        `;
        document.head.appendChild(style);
    }

    const generateWhatsAppToken = (type, phone, name, extra, cfg, socioNumber) => {
        if (!phone) return null;
        let p = phone.replace(/\D/g, '');
        if (!p.startsWith('54') && p.length === 10) p = '549' + p;
        const templates = cfg?.messaging?.templates || {};
        const firstName = name.split(' ')[0];
        const socioInfo = socioNumber ? ` (Socio #${socioNumber})` : "";
        let msg = "";
        
        if (type === 'birthdays') {
            const points = cfg?.birthdayPoints || 100;
            if (cfg?.enableBirthdayBonus !== false) {
                msg = (templates.birthday || `¡Feliz cumple {nombre}{socioInfo}! \u{1F382}\u{1F38A} Te regalamos {puntos} puntos. \u2728`).replace(/{puntos}/g, points.toString());
            } else { msg = templates.birthdaySimple || `¡Feliz cumple {nombre}{socioInfo}! \u{1F382}\u{1F38A} \u2728`; }
        } else if (type === 'expirations') {
            msg = (templates.expirationWarning || `¡Hola {nombre}{socioInfo}! \u{1F4E3} {puntos} pts por vencer.`).replace(/{puntos}/g, extra);
        } else if (type === 'petAlerts') {
            msg = (templates.petFoodAlert || `¡Hola {nombre}{socioInfo}! \u{1F43E} Reposición de {mascota}.`).replace(/{mascota}/g, extra);
        } else if (type === 'redemptions') {
            msg = (templates.redemption || `¡Canje exitoso {nombre}! \u{1F381} Canjeaste {premio}. Código: {codigo}`).replace(/{premio}/g, extra).replace(/{codigo}/g, socioNumber);
        } else if (type === 'pointsAssignments') {
            msg = (templates.pointsAdded || `¡Hola {nombre}! \u{1F4B0} Sumaste {puntos} puntos.`).replace(/{puntos}/g, extra);
        }
        msg = msg.replace(/{nombre}/g, firstName).replace(/{socioInfo}/g, socioInfo).replace(/{tienda}/g, cfg?.siteName || cfg?.appName || 'la tienda');
        return `https://api.whatsapp.com/send?phone=${p}&text=${encodeURIComponent(msg)}`;
    };

function showGlobalAlert(fullData, config) {
    const curY = new Date().getFullYear().toString();
    const birthdays = fullData.birthdays?.list || [];
    const expirations = fullData.expirations?.list || [];
    const petAlerts = fullData.petAlerts?.list || [];

    let isExpanded = false;
    let activeTab = 'pending'; 
    let pos = { x: 0, y: 0 };
    let dragStart = { x: 0, y: 0 };
    let isDragging = false;

    let container = document.getElementById('cf-v35-bubble');
    if (container) container.remove();
    container = document.createElement('div');
    container.id = 'cf-v35-bubble';
    container.style.cssText = `position:fixed; bottom:30px; right:30px; z-index:999999999; pointer-events:none; font-family: 'Outfit', sans-serif;`;

    const mouseUp = () => { isDragging = false; document.removeEventListener('mousemove', onMouseMove); };
    const onMouseMove = (e) => { 
        if (isDragging) {
            pos.x = e.clientX - dragStart.x; pos.y = e.clientY - dragStart.y;
            container.style.transform = `translate(${pos.x}px, ${pos.y}px)`;
        }
    };

    const render = () => {
        container.innerHTML = '';
        const ui = document.createElement('div');
        ui.style.pointerEvents = 'auto';

        const dismissed = fullData.dismissedAlerts || [];
        const getStatus = (id) => {
            const entry = dismissed.find(d => d.id === id);
            return entry ? entry.status : 'pending';
        };

        const curY = new Date().getFullYear().toString();

        const pendingB = birthdays.filter(b => getStatus(`birthday-${getIdentifier(b)}-${curY}`) === 'pending');
        const pendingE = expirations.filter(e => getStatus(`expiration-${getIdentifier(e)}-${e.nextExpirationDate || 'today'}-${e.points || 0}`) === 'pending');
        const pendingP = petAlerts.filter(p => getStatus(`pet-${getIdentifier(p)}-${p.petName}-${p.lastFoodAlertDate || 'today'}-${p.points || 0}`) === 'pending');
        const pendingR = (fullData.redemptions?.list || []).filter(r => getStatus(r.alertId) === 'pending');
        const pendingA = (fullData.pointsAssignments?.list || []).filter(a => getStatus(a.alertId) === 'pending');
        
        const procB = birthdays.filter(b => getStatus(`birthday-${getIdentifier(b)}-${curY}`) !== 'pending');
        const procE = expirations.filter(e => getStatus(`expiration-${getIdentifier(e)}-${e.nextExpirationDate || 'today'}-${e.points || 0}`) !== 'pending');
        const procP = petAlerts.filter(p => getStatus(`pet-${getIdentifier(p)}-${p.petName}-${p.lastFoodAlertDate || 'today'}-${p.points || 0}`) !== 'pending');
        const procR = (fullData.redemptions?.list || []).filter(r => getStatus(r.alertId) !== 'pending');
        const procA = (fullData.pointsAssignments?.list || []).filter(a => getStatus(a.alertId) !== 'pending');

        const totalPending = pendingB.length + pendingE.length + pendingP.length + pendingR.length + pendingA.length;
        const totalProcessed = [...procB, ...procE, ...procP, ...procR, ...procA].length;

        if (isExpanded) {
            ui.className = 'cf-v35-glass cf-v35-panel';
            ui.innerHTML = `
                <div style="padding:16px; cursor:grab; border-bottom:1px solid rgba(255,255,255,0.1); display:flex; justify-content:space-between; align-items:center;" id="cf-v35-drag">
                    <div style="display:flex; align-items:center; gap:10px;">
                        <span style="font-size:24px;">\u{1F680}</span>
                        <div>
                            <div style="font-weight:900; font-size:12px; text-transform:uppercase;">Club Fidelidad</div>
                            <div style="font-size:10px; opacity:0.6;">Gestión de Alertas</div>
                        </div>
                    </div>
                    <button id="cf-v35-close" style="background:none; border:none; color:white; font-size:24px; cursor:pointer;">×</button>
                </div>
                <div style="display:flex; background:rgba(0,0,0,0.2); padding:4px;">
                    <button id="tab-pending" style="flex:1; padding:8px; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; ${activeTab === 'pending' ? 'background:rgba(255,255,255,0.15); color:white;' : 'background:none; color:rgba(255,255,255,0.4);'}">
                        PENDIENTES (${totalPending})
                    </button>
                    <button id="tab-processed" style="flex:1; padding:8px; border:none; border-radius:8px; font-size:11px; font-weight:800; cursor:pointer; ${activeTab === 'processed' ? 'background:rgba(255,255,255,0.15); color:white;' : 'background:none; color:rgba(255,255,255,0.4);'}">
                        PROCESADOS
                    </button>
                </div>
                <div style="padding:16px; overflow-y:auto; flex:1;" class="cf-scrollbar">
                    ${activeTab === 'pending' ? renderList(pendingB, pendingE, pendingP, pendingR, pendingA, 'pending', curY, fullData) : renderList(procB, procE, procP, procR, procA, 'processed', curY, fullData)}
                </div>
            `;
            ui.querySelector('#cf-v35-drag').onmousedown = (e) => {
                isDragging = true; dragStart.x = e.clientX - pos.x; dragStart.y = e.clientY - pos.y;
                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', mouseUp);
            };
            ui.querySelector('#cf-v35-close').onclick = () => { isExpanded = false; render(); };
            ui.querySelector('#tab-pending').onclick = () => { activeTab = 'pending'; render(); };
            ui.querySelector('#tab-processed').onclick = () => { activeTab = 'processed'; render(); };
            attachActions(ui, fullData, render);
        } else {
            ui.className = 'cf-v35-bubble';
            const countHtml = `<div style="position:absolute; top:-8px; right:-8px; background:#ef4444; color:white; font-size:10px; font-weight:900; padding:4px 8px; border-radius:20px; border:2px solid white; box-shadow:0 4px 12px rgba(0,0,0,0.2); pointer-events:none;">${totalPending} / ${totalProcessed}</div>`;
            ui.innerHTML = `<span style="font-size:28px;">\u{1F4E3}</span>${countHtml}`;
            ui.onmousedown = (e) => {
                isDragging = true; dragStart.x = e.clientX - pos.x; dragStart.y = e.clientY - pos.y;
                document.addEventListener('mousemove', onMouseMove); document.addEventListener('mouseup', mouseUp);
            };
            ui.onclick = (e) => { if (Math.abs(e.clientX - (pos.x + dragStart.x)) < 5) { isExpanded = true; render(); } };
        }
        container.appendChild(ui);
    };

    const renderList = (births, exps, pets, reds, asigs, mode, curY, fullData) => {
        let html = '';
        if (births.length > 0) {
            html += `<div style="margin-bottom:16px;"><div style="font-size:10px; font-weight:900; color:#ec4899; text-transform:uppercase; margin-bottom:8px;">\u{1F382} Cumpleaños</div>`;
            html += births.map(c => renderCard(c, 'birthday', `birthday-${getIdentifier(c)}-${curY}`, mode, fullData)).join('');
            html += `</div>`;
        }
        if (exps.length > 0) {
            html += `<div style="margin-bottom:16px;"><div style="font-size:10px; font-weight:900; color:#f59e0b; text-transform:uppercase; margin-bottom:8px;">\u23F3 Vencimientos</div>`;
            html += exps.map(e => renderCard(e, 'expiration', `expiration-${getIdentifier(e)}-${e.nextExpirationDate || 'today'}-${e.points || 0}`, mode, fullData)).join('');
            html += `</div>`;
        }
        if (pets.length > 0) {
            html += `<div style="margin-bottom:16px;"><div style="font-size:10px; font-weight:900; color:#6366f1; text-transform:uppercase; margin-bottom:8px;">\u{1F43E} Mascotas</div>`;
            html += pets.map(p => renderCard(p, 'pet', `pet-${getIdentifier(p)}-${p.petName}-${p.lastFoodAlertDate || 'today'}-${p.points || 0}`, mode, fullData)).join('');
            html += `</div>`;
        }
        if (reds.length > 0) {
            html += `<div style="margin-bottom:16px;"><div style="font-size:10px; font-weight:900; color:#10b981; text-transform:uppercase; margin-bottom:8px;">\u{1F381} Canjes</div>`;
            html += reds.map(r => renderCard(r, 'redemption', r.alertId, mode, fullData)).join('');
            html += `</div>`;
        }
        if (asigs.length > 0) {
            html += `<div style="margin-bottom:16px;"><div style="font-size:10px; font-weight:900; color:#10b981; text-transform:uppercase; margin-bottom:8px;">\u{1F4B0} Asignaciones</div>`;
            html += asigs.map(a => renderCard(a, 'pointsAssignment', a.alertId, mode, fullData)).join('');
            html += `</div>`;
        }
        return html || '<div style="text-align:center; padding:40px; opacity:0.4;">Sin registros</div>';
    };

    const renderCard = (item, type, id, mode, fullData) => {
        const dismissed = fullData.dismissedAlerts || [];
        const entry = dismissed.find(d => d.id === id);
        const status = entry ? entry.status : 'pending';
        let statusIcon = '';
        if (status === 'sent') statusIcon = '<span style="color:#25D366; font-size:14px; margin-left:auto; filter: drop-shadow(0 0 2px rgba(37,211,102,0.4)); font-weight:bold;">\u2714\u2714</span>';
        if (status === 'dismissed') statusIcon = '<span style="color:#f87171; font-size:14px; margin-left:auto; font-weight:bold;">\u2714</span>';

        return `<div class="cf-v35-card" style="${mode === 'processed' ? 'opacity:0.8; filter:grayscale(0.5);' : ''}">
            <div style="display:flex; justify-content:space-between; align-items:start;">
                <div style="flex:1;">
                    <div style="font-weight:800; font-size:14px; display:flex; align-items:center; gap:6px;">
                        ${item.name} <span style="font-size:9px; opacity:0.4;">#${item.socioNumber || 'S/N'}</span> ${statusIcon}
                    </div>
                    <div style="font-size:10px; opacity:0.6; margin-top:2px;">
                        ${type === 'pet' ? `🐾 ${item.petName}` : type === 'expiration' ? `⏳ ${item.points} pts` : type === 'redemption' ? `🎁 ${item.prizeName}` : type === 'pointsAssignment' ? `💰 +${item.points} pts` : '🎂 Cumpleaños'}
                    </div>
                </div>
                ${mode === 'pending' ? `<button class="cf-v35-card-close" data-id="${id}">×</button>` : `<button class="cf-v35-card-delete" data-id="${id}" style="background:none; border:none; color:white; opacity:0.4; cursor:pointer;">🗑️</button>`}
            </div>
            <div style="margin-top:10px;">
                <button class="cf-v35-btn-wa" data-id="${id}" data-type="${type === 'pet' ? 'petAlerts' : type === 'redemption' ? 'redemptions' : type === 'pointsAssignment' ? 'pointsAssignments' : type + 's'}" data-phone="${item.phone}" data-name="${item.name}" data-socio="${type === 'redemption' ? (item.redemptionCode || '') : (item.socioNumber || '')}" data-extra="${type === 'pet' ? item.petName : type === 'redemption' ? item.prizeName : item.points || ''}" style="${mode === 'processed' ? 'background:rgba(255,255,255,0.1);' : ''}">
                    ${mode === 'pending' ? '📳 Enviar WhatsApp' : '🔄 Re-enviar'}
                </button>
            </div>
        </div>`;
    };

    const attachActions = (ui, fullData, render) => {
        const updateStorage = async (alertId, status) => {
            // 1. Local Sync (Immediate feedback)
            chrome.storage.local.get(['dismissedAlerts'], (store) => {
                let list = store.dismissedAlerts || [];
                list = list.filter(d => d.id !== alertId);
                if (status) list.push({ id: alertId, status, timestamp: Date.now() });
                chrome.storage.local.set({ dismissedAlerts: list }, () => {
                    fullData.dismissedAlerts = list;
                    render();
                });
            });

            // 2. Cloud Sync (for Dashboard Parity)
            try {
                fetch(`${config.apiUrl}/api/sync-alerts`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                    body: JSON.stringify({ 
                        alertId, 
                        action: status || 'delete',
                        date: fullData.referenceDate // USAR FECHA DE REFERENCIA DEL MOTOR
                    })
                });
            } catch (e) { console.warn("Sync error:", e); }
        };
        ui.querySelectorAll('.cf-v35-card-close').forEach(btn => btn.onclick = () => updateStorage(btn.dataset.id, 'dismissed'));
        ui.querySelectorAll('.cf-v35-card-delete').forEach(btn => btn.onclick = () => updateStorage(btn.dataset.id, null));
        ui.querySelectorAll('.cf-v35-btn-wa').forEach(btn => btn.onclick = () => {
            const url = generateWhatsAppToken(btn.dataset.type, btn.dataset.phone, btn.dataset.name, btn.dataset.extra, config, btn.dataset.socio);
            if (url) window.open(url, '_blank');
            updateStorage(btn.dataset.id, 'sent');
        });
    };

    render();
    document.body.appendChild(container);
}


// Refresca el contador C/V del widget si ya está visible
// Refresca el contador C/V del widget si ya está visible
async function refreshAlertCounts() {
    if (!config.apiUrl || !config.apiKey) return;
    try {
        const r = await fetch(`${config.apiUrl}/api/engine-daily?mode=daily&trigger=extension`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey }
        });
        const data = await r.json();
        if (data.ok) {
            const serverProcessed = data.processedAlerts || {};
            chrome.storage.local.get(['dismissedAlerts'], (store) => {
                let localList = store.dismissedAlerts || [];
                if (!Array.isArray(localList)) localList = [];

                // MEZCLAR con prioridad al servidor
                Object.keys(serverProcessed).forEach(id => {
                    const status = serverProcessed[id];
                    const exists = localList.find(d => d.id === id);
                    if (!exists) localList.push({ id, status, timestamp: Date.now() });
                    else if (exists.status !== status) exists.status = status;
                });

                chrome.storage.local.set({ dismissedAlerts: localList }, () => {
                    const curY = new Date().getFullYear().toString();
                    const bList = data.birthdays || [];
                    const eList = data.expirations || [];
                    const pList = data.petAlerts || [];
                    const rList = data.redemptions || [];
                    const aList = data.pointsAssignments || [];

                    const getStatus = (id) => {
                        const entry = localList.find(d => d.id === id);
                        return entry ? entry.status : 'pending';
                    };

                    const filteredBirthdays = bList.filter(b => getStatus(`birthday-${getIdentifier(b)}-${curY}`) === 'pending');
                    const filteredExpirations = eList.filter(e => getStatus(`expiration-${getIdentifier(e)}-${e.nextExpirationDate || 'today'}-${e.points || 0}`) === 'pending');
                    const filteredPetAlerts = pList.filter(p => getStatus(`pet-${getIdentifier(p)}-${p.petName}-${p.lastFoodAlertDate || 'today'}-${p.points || 0}`) === 'pending');
                    const filteredRedemptions = rList.filter(r => getStatus(r.alertId) === 'pending');
                    const filteredAssignments = aList.filter(a => getStatus(a.alertId) === 'pending');

                    const total = filteredBirthdays.length + filteredExpirations.length + filteredPetAlerts.length + filteredRedemptions.length + filteredAssignments.length;
                    const processedData = {
                        ...data,
                        dismissedAlerts: localList,
                        birthdays: { list: bList },
                        expirations: { list: eList },
                        petAlerts: { list: pList },
                        redemptions: { list: rList },
                        pointsAssignments: { list: aList }
                    };

                    if (total > 0 || localList.length > 0) {
                        showGlobalAlert(processedData, config);
                    } else {
                        const w = document.getElementById('cf-v35-bubble');
                        if (w) w.remove();
                    }
                });
            });
        }
    } catch (e) {
        console.warn('[Club Fidelidad] Error refrescando contadores:', e.message);
    }
}

// Auto-refresh when regaining focus (e.g. returning from Admin Panel)
window.addEventListener('focus', () => {
    refreshAlertCounts();
    // Also re-trigger amount detection in case the DOM changed while away
    setTimeout(() => detectAmount(), 500);
});

// Función para buscar el monto en el sitio
function detectAmount() {
    const selectors = [
        '#cpbtc_total',
        'input[name="cpbtc_total"]',
        '#total_pago',
        'input[name="total_pago"]',
        '#monto_pago',
        'input[name="monto_pago"]',
        '#importe_total',
        'input[name="importe_total"]',
        '.total-import'
    ];

    let input = null;
    for (let s of selectors) {
        input = document.querySelector(s);
        if (input) break;
    }

    let val = 0;
    if (input && input.value) {
        val = parseFloat(input.value.replace(/[^0-9.,]/g, '').replace(',', '.'));
    } else {
        const bodyContent = document.body.innerText;
        const match = bodyContent.match(/Total a pagar \$:\s*([0-9.,]+)/i) ||
            bodyContent.match(/Total a pagar\s*\$?:\s*([0-9.,]+)/i) ||
            bodyContent.match(/Monto Total\s*\$?:\s*([0-9.,]+)/i);

        if (match && match[1]) {
            val = parseFloat(match[1].replace(/[^0-9.,]/g, '').replace(',', '.'));
        }
    }

    // --- NUEVO: DETECCIÓN DE DESCUENTOS (ITEMS NEGATIVOS) ---
    let discountSum = 0;
    try {
        const rows = document.querySelectorAll('table tbody tr');
        rows.forEach(row => {
            const cells = row.querySelectorAll('td');
            // La columna 6 (índice 5) suele ser el Total por ítem
            if (cells.length >= 6) {
                const rowText = row.innerText.toUpperCase();
                const totalText = cells[5].innerText.trim();
                
                // Detectamos por signo menos o por palabras clave de descuento/combo
                const isNegative = totalText.startsWith('-') || totalText.includes('(');
                // --- CONFIGURACIÓN DE PALABRAS CLAVE ---
                // Si necesitas agregar más palabras, agrégalas aquí abajo usando || rowText.includes('NUEVA_PALABRA')
                const hasDiscountKeyword = rowText.includes('DESCUENTO') || 
                                           rowText.includes('PROMO') || 
                                           rowText.includes('COMBO') || 
                                           rowText.includes('BONIF');

                if (isNegative || hasDiscountKeyword) {
                    const numeric = Math.abs(parseFloat(totalText.replace(/[^0-9.,-]/g, '').replace(',', '.')));
                    if (!isNaN(numeric)) discountSum += numeric;
                }
            }
        });
        
        // Búsqueda genérica refinada si la tabla no dio resultados
        if (discountSum === 0) {
            document.querySelectorAll('td, span, div').forEach(el => {
                const text = el.innerText.trim();
                // Regex mejorado para capturar montos negativos o entre paréntesis
                if (((text.startsWith('-') || (text.startsWith('(') && text.endsWith(')'))) && text.length > 1 && text.length < 20 && !el.children.length)) {
                    const numeric = Math.abs(parseFloat(text.replace(/[^0-9.,-]/g, '').replace(',', '.')));
                    if (!isNaN(numeric) && numeric > 1) { 
                         discountSum += numeric;
                    }
                }
            });
        }
    } catch (e) {
        console.warn('[Club Fidelidad] Error rastreando descuentos:', e);
    }
    detectedDiscounts = discountSum;

    if (!isNaN(val) && val > 0) {
        const panelExists = document.getElementById('fidelidad-panel');
        if (val !== detectedAmount || !panelExists) {
            console.log(`💰 [Club Fidelidad] Monto detectado: ${val}`);
            detectedAmount = val;
            showFidelidadPanel();
        }
    } else {
        // Reset detected amount if no input is found so it can trigger again when it appears
        if (detectedAmount > 0) detectedAmount = 0;
    }
}

let detectTimeout = null;
const observer = new MutationObserver(() => {
    // Debounce reducido para activación más rápida
    if (detectTimeout) clearTimeout(detectTimeout);
    detectTimeout = setTimeout(() => detectAmount(), 150);
});
observer.observe(document.body, { childList: true, subtree: true, attributes: true, characterData: true });
// Initial detection sequence
detectAmount();
setTimeout(detectAmount, 1000);
setTimeout(detectAmount, 2500);

function showFidelidadPanel() {
    if (document.getElementById('fidelidad-panel')) {
        const amountEl = document.getElementById('cf-display-amount');
        const inputMonto = document.getElementById('cf-input-amount');
        const baseActual = detectedAmount - detectedDiscounts;

        if (amountEl) {
            amountEl.innerHTML = `$ ${detectedAmount.toLocaleString('es-AR')} ${detectedDiscounts > 0 ? `<span style="font-size: 10px; color: #ef4444; font-weight: normal; margin-left:8px;">(Base: $${baseActual.toLocaleString('es-AR')})</span>` : ''}`;
        }
        
        // Solo actualizar si el input está vacío o aún no tiene el monto detectado (para no pisar cambios manuales)
        if (inputMonto && (!inputMonto.value || inputMonto.dataset.autoFilled === 'true')) {
            inputMonto.value = baseActual;
            inputMonto.dataset.autoFilled = 'true';
        }
        return;
    }

    const panel = document.createElement('div');
    panel.id = 'fidelidad-panel';
    panel.className = 'fidelidad-panel';

    const today = new Date().toISOString().split('T')[0];

    panel.innerHTML = `
        <div class="fidelidad-header">
            <div class="fidelidad-header-title">
                <h1 id="cf-main-title">Sumar Puntos <span style="font-size: 10px; color: #e5e7eb; font-weight: normal; margin-left: 8px; opacity: 0.9;">(${config.appName || config.apiUrl || 'Configurando...'})</span></h1>
                <span id="cf-client-name-header" style="font-size: 10px; opacity: 0.8; display: block;">Seleccione un cliente</span>
            </div>
            <span class="fidelidad-close" id="fidelidad-close">×</span>
        </div>
        <div class="fidelidad-body">
            <!-- BUSCADOR PREDICTIVO -->
            <div class="fidelidad-search-container">
                <label class="cf-label">Buscar Socio (Nombre, DNI o ID)</label>
                <input type="text" id="fidelidad-search" class="fidelidad-input" placeholder="Escriba para buscar..." autocomplete="off">
                <div id="fidelidad-results" class="fidelidad-results" style="display:none;"></div>
            </div>

            <!-- TABS (Solo aparecen cuando hay cliente seleccionado) -->
            <div id="cf-tabs-container" class="cf-tabs" style="display:none; margin-top: 15px;">
                <button class="cf-tab active" data-tab="sumar">Sumar</button>
                <button class="cf-tab" data-tab="canjes">Canjear</button>
            </div>

            <!-- CONTENIDO TAB: SUMAR -->
            <div id="cf-tab-content-sumar" class="cf-tab-content" style="display:none;">
                <div id="cf-points-form">
                    <div class="cf-field">
                        <label id="cf-amount-label" class="cf-label font-bold">Monto de la Compra ($)</label>
                        <div class="cf-input-group">
                            <span id="cf-currency-symbol" class="cf-addon">$</span>
                            <input type="number" id="cf-input-amount" class="fidelidad-input cf-input-big" value="${detectedAmount - detectedDiscounts}" data-auto-filled="true">
                        </div>
                        <div id="cf-display-amount" style="font-size: 11px; margin-top: 4px; color: #6b7280;">
                            $ ${detectedAmount.toLocaleString('es-AR')} ${detectedDiscounts > 0 ? `<span style="color:#ef4444;">(-$${detectedDiscounts.toLocaleString('es-AR')} desc.)</span>` : ''}
                        </div>
                        <div id="cf-preview-container" class="cf-preview-box" style="margin-top: 8px; font-size: 12px; color: #6b7280; display: none;">
                            <!-- Preview text will be injected here -->
                        </div>
                    </div>

                    <div class="cf-grid">
                        <div class="cf-field">
                            <label class="cf-label">Concepto</label>
                            <input type="text" id="cf-concept" class="fidelidad-input" value="Compra en local">
                        </div>
                        <div class="cf-field">
                            <label class="cf-label">Fecha</label>
                            <input type="date" id="cf-date" class="fidelidad-input" value="${today}">
                        </div>
                    </div>

                    <!-- PROMOCIONES Y OPCIONES -->
                    <div id="cf-promos-container" class="cf-promos-box" style="margin-top: 20px;">
                        <label class="cf-checkbox-label">
                            <input type="checkbox" id="cf-apply-promos" checked> Aplicar Promociones / Bonus
                        </label>
                        <div id="cf-promos-list" class="cf-promos-list">
                            <!-- Se llena vía API -->
                        </div>
                        <label class="cf-checkbox-label" style="margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
                            <input type="checkbox" id="cf-notify-wa" ${config.messaging?.whatsappEnabled !== false ? 'checked' : ''}> Notificar por WhatsApp
                        </label>
                        <!-- Sección Pet: se renderiza dinámicamente si enablePetModule=true y el cliente tiene mascotas -->
                        <div id="cf-pet-food-section" style="display:none; margin-top: 12px; padding-top: 12px; border-top: 1px solid #f3f4f6;">
                            <label class="cf-checkbox-label" style="color: #c2410c; font-weight: 700;">
                                <input type="checkbox" id="cf-pet-food-check"> \u{1F43E} Reposición de Alimento
                            </label>
                            <div id="cf-pet-list" style="display:none; padding-left: 20px; margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px;"></div>
                        </div>
                    </div>

                    <button id="fidelidad-submit" class="fidelidad-button">Asignar Puntos</button>
                </div>
            </div>

            <!-- CONTENIDO TAB: CANJES -->
            <div id="cf-tab-content-canjes" class="cf-tab-content" style="display:none;">
                <div class="cf-prizes-summary" style="margin-bottom: 12px; background: #eeeff3; padding: 10px; border-radius: 12px; text-align: center;">
                    <span style="font-size: 11px; color: #4b5563; font-weight: 700;">Saldo disponible: <strong id="cf-client-points-balance" style="color: #16a34a; font-size: 14px;">0</strong> pts</span>
                </div>
                <div id="cf-prizes-list" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px; padding: 2px;">
                    <!-- Se llena vía API -->
                </div>
            </div>

            <div id="fidelidad-status" style="margin-top:10px; font-size: 12px; text-align: center;"></div>
        </div>
    `;

    // --- ESTRATEGIA DE INFILTRACIÓN (v29) ---
    const modalSelectors = ['.modal-content', '.modal-body', '.bootbox', '.ui-dialog-content', '.sky-modal', '[role="dialog"]'];
    let injector = document.body;
    for (let sel of modalSelectors) {
        const found = document.querySelector(sel);
        if (found) {
            injector = found;
            break;
        }
    }
    injector.appendChild(panel);

    // --- DRAGGABLE LOGIC ---
    let isDragging = false;
    let offset = { x: 0, y: 0 };
    const header = panel.querySelector('.fidelidad-header');

    header.onmousedown = (e) => {
        if (e.target.id === 'fidelidad-close') return;
        isDragging = true;
        offset.x = e.clientX - panel.offsetLeft;
        offset.y = e.clientY - panel.offsetTop;
        panel.style.transition = 'none';
        header.style.cursor = 'grabbing';
    };

    document.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        panel.style.left = (e.clientX - offset.x) + 'px';
        panel.style.top = (e.clientY - offset.y) + 'px';
        panel.style.bottom = 'auto';
        panel.style.right = 'auto';
    });

    document.addEventListener('mouseup', () => {
        isDragging = false;
        header.style.cursor = 'move';
    });

    // ELEMENTOS
    const searchInput = document.getElementById('fidelidad-search');
    const resultsDiv = document.getElementById('fidelidad-results');
    const pointsForm = document.getElementById('cf-points-form');
    const submitBtn = document.getElementById('fidelidad-submit');
    const statusDiv = document.getElementById('fidelidad-status');
    const clientHeader = document.getElementById('cf-client-name-header');
    const promosList = document.getElementById('cf-promos-list');
    const inputMonto = document.getElementById('cf-input-amount');
    const promosContainer = document.getElementById('cf-promos-container');
    const tabsContainer = document.getElementById('cf-tabs-container');
    const tabSumar = document.getElementById('cf-tab-content-sumar');
    const tabCanjes = document.getElementById('cf-tab-content-canjes');
    const prizesList = document.getElementById('cf-prizes-list');
    const mainTitle = document.getElementById('cf-main-title');
    // MANTENER SIEMPRE EN PESOS EN LA EXTENSIÓN
    let isPesos = true;

    inputMonto.oninput = () => updatePointsPreview();

    function updatePointsPreview() {
        const val = parseFloat(inputMonto.value);
        const previewContainer = document.getElementById('cf-preview-container');
        if (!previewContainer) return;

        if (isNaN(val) || val <= 0 || !selectedClient) {
            previewContainer.style.display = 'none';
            return;
        }

        let ptsBase = 0;
        if (isPesos) {
            const curAcc = selectedClient.accumulated_balance || 0;
            // SI EL MONTO COINCIDE CON EL DETECTADO, RESTAMOS DESCUENTOS
            let effectiveVal = val;
            if (val === detectedAmount) {
                effectiveVal = val - detectedDiscounts;
            }
            const total = effectiveVal + curAcc;
            ptsBase = Math.floor((total / (apiRatios.base || 100)) * (apiRatios.perPeso || 1));
        } else {
            ptsBase = Math.floor(val);
        }

        const ptsAfterPromo = ptsBase;

        let bonus = 0;
        const applyPromos = document.getElementById('cf-apply-promos').checked;
        if (applyPromos) {
            const selectedIds = Array.from(document.querySelectorAll('.cf-promo-check:checked')).map(el => el.value);
            currentPromos.filter(p => selectedIds.includes(p.id)).forEach(b => {
                const isFlash = b.isFlash;
                const rType = isFlash ? (b.flashRewardType || b.rewardType) : b.rewardType;
                const rValue = isFlash ? (b.flashRewardValue ?? b.rewardValue) : b.rewardValue;

                if (rType === 'MULTIPLIER') bonus += Math.floor(ptsAfterPromo * (rValue - 1));
                else bonus += (rValue || 0);
            });
        }

        // --- FACTOR K: RECUPERACIÓN POR DESCUENTO ---
        let bonusK = 0;
        if (isPesos && detectedDiscounts > 0 && apiRatios.discountK > 0) {
            const ptsPerCurrency = (apiRatios.perPeso || 1) / (apiRatios.base || 100);
            const lostPoints = detectedDiscounts * ptsPerCurrency;
            bonusK = Math.floor(lostPoints * (apiRatios.discountK / 100));
            bonus += bonusK;
        }

        const totalFinal = ptsAfterPromo + bonus;
        previewContainer.style.display = 'block';
        
        previewContainer.innerHTML = `
            <div style="font-weight: bold; color: #374151;">\u2728 Se asignarán: <strong style="color: #059669;">${totalFinal} puntos</strong></div>
            <div style="font-size: 10px; color: #6b7280; margin-top: 2px;">
                Cálculo: $${val.toLocaleString('es-AR')} / ${apiRatios.base} x ${apiRatios.perPeso}
                ${(bonus - bonusK) > 0 ? ` + ${bonus - bonusK} pts promos` : ''}
                ${bonusK > 0 ? ` + ${bonusK} pts Bono Descuento (K)` : ''}
            </div>
            ${(detectedDiscounts > 0) ? `<div style="font-size: 10px; color: #ef4444; font-weight: 700;">📉 El sistema restó $${detectedDiscounts.toLocaleString('es-AR')} de descuentos detectados.</div>` : ''}
        `;
    }

    // MASTER TOGGLE PROMOS
    const masterApply = document.getElementById('cf-apply-promos');
    masterApply.onchange = (e) => {
        const active = e.target.checked;
        promosList.style.opacity = active ? '1' : '0.4';
        promosList.style.pointerEvents = active ? 'all' : 'none';
        // Disable individual checkboxes to stay in sync with UI
        const checks = promosList.querySelectorAll('.cf-promo-check');
        checks.forEach(c => {
            c.disabled = !active;
        });
        updatePointsPreview();
    };

    // TAB SWITCHING LOGIC
    tabsContainer.querySelectorAll('.cf-tab').forEach(tab => {
        tab.onclick = () => {
            const target = tab.dataset.tab;
            tabsContainer.querySelectorAll('.cf-tab').forEach(t => t.classList.remove('active'));
            tab.classList.add('active');

            if (target === 'sumar') {
                tabSumar.style.display = 'block';
                tabCanjes.style.display = 'none';
                mainTitle.innerText = 'Sumar Puntos';
            } else {
                tabSumar.style.display = 'none';
                tabCanjes.style.display = 'block';
                mainTitle.innerText = 'Canjear Premios';
            }
        };
    });

    function killEvent(e) {
        if (document.activeElement === searchInput || document.activeElement.tagName === 'INPUT') {
            e.stopPropagation();
            // No stopImmediatePropagation to allow default typing but block sitewide shortcuts
        }
    }

    window.addEventListener('keydown', killEvent, true);
    window.addEventListener('keyup', killEvent, true);
    window.addEventListener('keypress', killEvent, true);

    document.getElementById('fidelidad-close').onclick = () => {
        window.removeEventListener('keydown', killEvent, true);
        window.removeEventListener('keyup', killEvent, true);
        window.removeEventListener('keypress', killEvent, true);
        panel.remove();
    };

    // FOCO PERSISTENTE SOLO EN EL SEARCH INICIAL
    setTimeout(() => searchInput.focus(), 300);

    let searchTimeout;
    searchInput.oninput = (e) => {
        clearTimeout(searchTimeout);
        const q = e.target.value;
        if (q.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }
        resultsDiv.innerHTML = '<div class="fidelidad-result-item" style="text-align:center; color:#888;">Buscando...</div>';
        resultsDiv.style.display = 'block';
        searchTimeout = setTimeout(() => searchClients(q), 150);
    };

    async function searchClients(q) {
        if (!config.apiUrl || !config.apiKey) {
            statusDiv.innerText = '\u26A0\uFE0F Configura la API';
            return;
        }
        try {
                        const res = await fetch(`${config.apiUrl}/api/assign-points?q=${encodeURIComponent(q)}`, {
                headers: { 'x-api-key': config.apiKey }
            });
            
            if (!res.ok) {
                statusDiv.innerText = `\u274C Error API (${res.status})`;
                return;
            }

            const data = await res.json();
            if (data.ok) {
                apiRatios.base = data.pointsMoneyBase || 100;
                apiRatios.perPeso = data.pointsPerPeso || 1;
                apiRatios.discountK = data.discountRecoveryRatio || 0;
                enablePetModule = data.enablePetModule === true; // Flag dinámico de la instancia

                if (data.clients && data.clients.length > 0) {
                    renderResults(data.clients, data.activePromotions || [], data.activePrizes || []);
                    // Refrescar contador C/V del widget (igual que promos: datos frescos en cada búsqueda)
                    refreshAlertCounts();
                } else {
                    resultsDiv.innerHTML = '<div class="fidelidad-result-item" style="cursor:default; color:#666; text-align:center;">No se encontraron socios</div>';
                    resultsDiv.style.display = 'block';
                }
            } else {
                statusDiv.innerText = `\u274C Error: ${data.error || 'Respuesta inválida'}`;
            }
        } catch (e) {
            console.error("🔍 [Club Fidelidad] Error en fetch:", e);
            statusDiv.innerText = '\u274C Error de conexión';
        }
    }

    function renderResults(clients, promotions, allPrizes) {
        resultsDiv.innerHTML = '';
        clients.forEach(c => {
            const item = document.createElement('div');
            item.className = 'fidelidad-result-item';
            item.innerHTML = `
                <div style="font-weight: 700; color: #111827; pointer-events: none;">${c.name}</div>
                <div class="dni" style="font-size: 11px; color: #6b7280; margin-top: 2px; pointer-events: none;">
                    DNI: ${c.dni || 'S/D'} | Socio: ${c.socioNumber || 'N/A'}
                </div>
            `;
            item.onclick = (e) => {
                e.preventDefault();
                e.stopPropagation();

                selectedClient = { id: c.id, name: c.name, accumulated_balance: c.accumulated_balance || 0, pets: c.pets || [] };

                // UI Update
                clientHeader.innerText = `Socio: ${selectedClient.name}`;
                searchInput.value = selectedClient.name;
                resultsDiv.style.display = 'none';

                pointsForm.style.display = 'block';
                tabSumar.style.display = 'block';
                tabsContainer.style.display = 'flex';
                statusDiv.innerText = '';

                // Actualizar balance en pestaña canjes
                const balanceEl = document.getElementById('cf-client-points-balance');
                if (balanceEl) balanceEl.innerText = c.accumulated_points ?? (c.points ?? (c.puntos ?? 0));

                // --- SECCIÓN PET FOOD: Mostrar solo si el módulo está activo y el cliente tiene mascotas ---
                const petFoodSection = document.getElementById('cf-pet-food-section');
                const petListDiv = document.getElementById('cf-pet-list');
                const petFoodCheck = document.getElementById('cf-pet-food-check');
                const clientPets = selectedClient.pets || [];

                if (petFoodSection) {
                    if (enablePetModule && clientPets.length > 0) {
                        petFoodSection.style.display = 'block';
                        // Renderizar checkboxes de mascotas si hay más de una
                        if (petListDiv) {
                            if (clientPets.length > 1) {
                                petListDiv.style.display = 'flex';
                                petListDiv.innerHTML = clientPets.map(pet =>
                                    `<label style="display:flex; align-items:center; gap:4px; background:#fff7ed; border:1px solid #fed7aa; padding:3px 8px; border-radius:8px; cursor:pointer; font-size:10px; font-weight:700; color:#9a3412;">
                                        <input type="checkbox" class="cf-pet-check" value="${pet.id}" checked> ${pet.name || 'Mascota'}
                                    </label>`
                                ).join('');
                            } else {
                                // Solo 1 mascota: sin checkboxes individuales
                                petListDiv.style.display = 'none';
                            }
                        }
                        // Toggle: mostrar/ocultar lista al marcar el check principal
                        if (petFoodCheck) {
                            petFoodCheck.onchange = () => {
                                if (petListDiv && clientPets.length > 1) {
                                    petListDiv.style.display = petFoodCheck.checked ? 'flex' : 'none';
                                }
                            };
                        }
                    } else {
                        petFoodSection.style.display = 'none';
                        if (petFoodCheck) petFoodCheck.checked = false;
                    }
                }

                // --- TAB CANJES: Renderizar Premios ---
                renderPrizes(allPrizes, (c.accumulated_points ?? (c.points ?? (c.puntos ?? 0))));

                // Renderizar Promos con Lógica de Horarios (Paridad con Admin)
                currentPromos = promotions || [];
                const activePromos = currentPromos.filter(p => p.rewardType === 'FIXED' || p.rewardType === 'MULTIPLIER' || p.rewardType === 'TEXT' || p.rewardType === 'INFO');

                if (activePromos.length > 0) {
                    const GRACE_PERIOD_MINS = 15;

                    function getARTime() {
                        const offsetStored = localStorage.getItem('fiddle_simulated_date_offset');
                        const offset = offsetStored ? parseInt(offsetStored, 10) : 0;
                        const now = new Date();
                        if (offset !== 0) {
                            now.setTime(now.getTime() + (offset * 24 * 60 * 60 * 1000));
                        }

                        const formatter = new Intl.DateTimeFormat('es-AR', {
                            timeZone: 'America/Argentina/Buenos_Aires',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit',
                            hour12: false
                        });
                        const parts = formatter.formatToParts(now);
                        const h = parts.find(p => p.type === 'hour').value;
                        const m = parts.find(p => p.type === 'minute').value;
                        // Ensure 2-digit padding for h and m
                        const paddedH = h.padStart(2, '0');
                        const paddedM = m.padStart(2, '0');
                        return { h: Number(h), m: Number(m), hhmm: `${paddedH}:${paddedM}`, now };
                    }

                    promosList.innerHTML = activePromos.map(p => {
                        const isFlash = p.isFlash;
                        const rType = isFlash ? (p.flashRewardType || p.rewardType) : p.rewardType;
                        const rValue = isFlash ? (p.flashRewardValue || p.rewardValue) : p.rewardValue;
                        const rText = isFlash ? (p.flashRewardText || p.rewardText || '') : (p.rewardText || '');
                        const label = rType === 'MULTIPLIER' ? `Multiplicador x${rValue}` : (rType === 'FIXED' ? `Bonus +${rValue} pts` : (rText || 'Promo activa'));
                        const title = p.title || p.name;
                        const timeRange = (p.startTime || p.endTime) ?
                            `<span class="cf-promo-time">⏰ ${p.startTime || '00:00'} a ${p.endTime || '23:59'} hs</span>` : '';

                        return `
                            <label class="cf-promo-item" data-promo-id="${p.id}">
                                <input type="checkbox" class="cf-promo-check" value="${p.id}" checked>
                                <div class="cf-promo-info">
                                    <div style="display: flex; align-items: center; gap: 4px;">
                                        <span class="cf-promo-name">${title}</span>
                                        <div class="cf-promo-status-container" data-id="${p.id}"></div>
                                        ${isFlash ? '<span class="cf-promo-status" style="background:#fef3c7; color:#92400e; font-size: 7px; border: 1px solid #f59e0b;">⚡ FLASH</span>' : ''}
                                    </div>
                                    <div style="display: flex; align-items: center; gap: 6px; margin-top: 2px;">
                                        <span class="cf-promo-desc">${label}</span>
                                        ${timeRange}
                                    </div>
                                </div>
                            </label>
                        `;
                    }).join('');

                    // Función de actualización de contadores
                    if (window.cfTimerInterval) clearInterval(window.cfTimerInterval);

                    const updateTimers = () => {
                        const { h: curH, m: curM, hhmm: curHHmm, now } = getARTime();

                        activePromos.forEach(p => {
                            const container = promosList.querySelector(`.cf-promo-status-container[data-id="${p.id}"]`);
                            if (!container) return;

                            let statusHtml = '';
                            if (p.startTime || p.endTime) {
                                // Transition: Active until the exact second of endTime.
                                // If curHHmm >= p.endTime, it's either in Grace or Expired.
                                const isExpiredToday = p.endTime && curHHmm >= p.endTime;

                                if (isExpiredToday) {
                                    // Calculation for internal grace period (Tolerance)
                                    const [endH, endM] = p.endTime.split(':').map(Number);
                                    const endTimeDate = new Date(now);
                                    endTimeDate.setHours(endH, endM, 0, 0);
                                    let diff = (endTimeDate.getTime() + (GRACE_PERIOD_MINS * 60 * 1000)) - now.getTime();

                                    if (diff > 0) {
                                        const mm = Math.floor(diff / (1000 * 60));
                                        const ss = Math.floor((diff % (1000 * 60)) / 1000);
                                        const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`;
                                        statusHtml = `
                                            <span class="cf-promo-status grace">TOLERANCIA</span>
                                            <span class="cf-promo-time" style="color:#9a3412; font-weight:900;">CIERRA EN: ${timeStr}</span>
                                        `;
                                    } else {
                                        // Fully expired and outside grace
                                        statusHtml = '';
                                        const item = promosList.querySelector(`.cf-promo-item[data-promo-id="${p.id}"]`);
                                        if (item) {
                                            item.style.opacity = '0.5';
                                            item.querySelector('input').checked = false;
                                        }
                                    }
                                } else {
                                    const isNotStartedYet = p.startTime && curHHmm < p.startTime;
                                    if (isNotStartedYet) {
                                        statusHtml = `<span class="cf-promo-status" style="background:#f3f4f6; color:#6b7280;">PRÓXIMAMENTE</span>`;
                                    } else {
                                        // Active: Show countdown until the end time
                                        const [endH, endM] = (p.endTime || '23:59').split(':').map(Number);
                                        const endTimeDate = new Date(now);
                                        endTimeDate.setHours(endH, endM, 0, 0);
                                        let diff = endTimeDate.getTime() - now.getTime();

                                        // Protection against negative values just before transition
                                        if (diff < 0) diff = 0;

                                        const mm = Math.floor(diff / (1000 * 60));
                                        const ss = Math.floor((diff % (1000 * 60)) / 1000);
                                        const timeStr = `${mm}:${ss.toString().padStart(2, '0')}`;

                                        statusHtml = `
                                            <span class="cf-promo-status active">¡ACTIVA!</span>
                                            <span class="cf-promo-time" style="color:#166534; font-weight:900;">TERMINA EN: ${timeStr}</span>
                                        `;
                                    }
                                }
                            }
                            container.innerHTML = statusHtml;
                        });
                    };

                    updateTimers();
                    window.cfTimerInterval = setInterval(updateTimers, 1000);

                    // Add listeners to new checkboxes
                    const checks = promosList.querySelectorAll('.cf-promo-check');
                    checks.forEach(check => {
                        check.onchange = () => updatePointsPreview();
                    });
                } else {
                    promosList.innerHTML = '<div style="font-size:10px; color:#999; padding: 5px 0;">No hay promociones disponibles para aplicar.</div>';
                }

                updatePointsPreview();

                // Focus amount input
                setTimeout(() => {
                    const amountInput = document.getElementById('cf-input-amount');
                    if (amountInput) amountInput.focus();
                }, 100);
            };
            resultsDiv.appendChild(item);
        });
        resultsDiv.style.display = 'block';
    }

    submitBtn.onclick = async () => {
        if (!selectedClient) return;

        const amount = parseFloat(document.getElementById('cf-input-amount').value);
        if (isNaN(amount) || amount <= 0) {
            statusDiv.innerText = '\u274C Ingrese un monto válido';
            return;
        }

        const bonusIds = Array.from(document.querySelectorAll('.cf-promo-check:checked')).map(el => el.value);
        const concept = document.getElementById('cf-concept').value;
        const date = document.getElementById('cf-date').value;
        const applyWhatsApp = document.getElementById('cf-notify-wa').checked;
        const applyPromos = document.getElementById('cf-apply-promos').checked;

        // Pet Food Data (solo si el módulo esta activo en esta instancia)
        const petFoodCheck = document.getElementById('cf-pet-food-check');
        const isPetFood = petFoodCheck ? petFoodCheck.checked : false;
        const petIds = isPetFood
            ? Array.from(document.querySelectorAll('.cf-pet-check:checked')).map(el => el.value)
            : [];

        // Si no seleccionó ninguna mascota pero marcó el check, tomar todas
        const finalPetIds = (isPetFood && petIds.length === 0 && selectedClient.pets?.length > 0)
            ? selectedClient.pets.map(p => p.id)
            : petIds;

        submitBtn.disabled = true;
        submitBtn.innerText = 'PROCESANDO...';

        try {
            const res = await fetch(`${config.apiUrl}/api/assign-points`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    amount: amount,
                    reason: isPesos ? 'external_integration' : 'manual',
                    concept: concept,
                    date: date,
                    bonusIds: applyPromos ? bonusIds : [],
                    applyWhatsApp: applyWhatsApp,
                    isPetFood: isPetFood,
                    petIds: finalPetIds
                })
            });
            const data = await res.json();
            if (data.ok) {
                // AUTO-OPEN WHATSAPP if requested
                if (data.whatsappLink && applyWhatsApp) {
                    setTimeout(() => {
                        const link = document.createElement('a');
                        link.href = data.whatsappLink;
                        link.target = '_blank';
                        link.rel = 'noopener noreferrer';
                        document.body.appendChild(link);
                        link.click();
                        document.body.removeChild(link);
                    }, 300);
                }
                renderSuccess(data);
            } else {
                statusDiv.innerText = `\u274C Error: ${data.error}`;
                submitBtn.disabled = false;
                submitBtn.innerText = 'REINTENTAR';
            }
        } catch (e) {
            statusDiv.innerText = '\u274C Error de conexión';
            submitBtn.disabled = false;
        }
    };

    function renderSuccess(data) {
        const body = document.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div class="fidelidad-success" style="text-align: center; color: #16a34a; padding: 10px;">
                <div style="font-size: 40px;">\u2705</div>
                <div style="font-weight: bold; font-size: 18px; margin: 5px 0;">¡Puntos Asignados!</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 15px;">Se sumaron ${data.pointsAdded} puntos a ${selectedClient.name}.</div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link" id="cf-wa-link-success">RE-ENVIAR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#f3f4f6; color:#374151; margin-top:15px; border: 1px solid #d1d5db;" id="cf-final-close">CERRAR</button>
            </div>
        `;
        // Auto-open WhatsApp si hay link (misma lógica que el panel admin)
        if (data.whatsappLink) {
            setTimeout(() => {
                const link = document.createElement('a');
                link.href = data.whatsappLink;
                link.target = '_blank';
                link.rel = 'noopener noreferrer';
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            }, 400);
        }
        document.getElementById('cf-final-close').onclick = () => {
            window.removeEventListener('keydown', killEvent, true);
            window.removeEventListener('keyup', killEvent, true);
            window.removeEventListener('keypress', killEvent, true);
            panel.remove();
        };
    }
    function renderPrizes(prizes, userPoints) {
        const prizesList = document.getElementById('cf-prizes-list');
        if (!prizesList) return;

        prizesList.innerHTML = '';
        if (prizes.length === 0) {
            prizesList.innerHTML = '<div style="grid-column: 1 / span 2; text-align: center; color: #9ca3af; font-size: 12px; padding: 20px;">No hay premios disponibles</div>';
            return;
        }

        prizes.forEach(p => {
            const canAfford = userPoints >= p.pointsRequired;
            const hasStock = (p.stock || 0) > 0;
            const isDisabled = !canAfford || !hasStock;

            const card = document.createElement('div');
            card.style.cssText = `
                background: white; border: 1px solid #e5e7eb; border-radius: 12px; padding: 8px;
                display: flex; flex-direction: column; gap: 6px; transition: all 0.2s;
                ${isDisabled ? 'opacity: 0.6; filter: grayscale(0.5);' : 'cursor: default;'}
            `;

            card.innerHTML = `
                <div style="height: 60px; background: #f9fafb; border-radius: 8px; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                    ${p.image ? `<img src="${p.image}" style="width: 100%; height: 100%; object-fit: cover;">` : '<span style="font-size: 24px;">\u{1F381}</span>'}
                </div>
                <div style="flex: 1;">
                    <div style="font-size: 11px; font-weight: 800; color: #1f2937; line-height: 1.2; height: 26px; overflow: hidden;">${p.name}</div>
                    <div style="font-size: 12px; font-weight: 900; color: #16a34a; margin-top: 4px;">${p.pointsRequired} pts</div>
                </div>
                <button class="cf-redeem-btn" data-id="${p.id}" ${isDisabled ? 'disabled' : ''} style="
                    width: 100%; padding: 6px; border-radius: 6px; border: none;
                    background: ${isDisabled ? '#d1d5db' : '#16a34a'};
                    color: white; font-size: 10px; font-weight: 800; cursor: ${isDisabled ? 'not-allowed' : 'pointer'};
                ">
                    ${!hasStock ? 'SIN STOCK' : (canAfford ? 'CANJEAR' : 'FALTAN PTS')}
                </button>
            `;

            if (!isDisabled) {
                card.querySelector('.cf-redeem-btn').onclick = () => redeemPrize(p);
            }
            prizesList.appendChild(card);
        });
    }

    async function redeemPrize(prize) {
        if (!confirm(`¿Canjear "${prize.name}" por ${prize.pointsRequired} puntos para ${selectedClient.name}?`)) return;

        const prizesList = document.getElementById('cf-prizes-list');
        const originalContent = prizesList.innerHTML;

        prizesList.innerHTML = '<div style="grid-column: 1 / span 2; text-align: center; padding: 40px; color: #16a34a;">Procesando canje...</div>';

        try {
            const res = await fetch(`${config.apiUrl}/api/redeem-prize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'x-api-key': config.apiKey },
                body: JSON.stringify({
                    uid: selectedClient.id,
                    prizeId: prize.id
                })
            });
            const data = await res.json();
            if (data.ok) {
                renderRedemptionSuccess(data, prize);
            } else {
                alert(`Error al canjear: ${data.error}`);
                prizesList.innerHTML = originalContent;
            }
        } catch (e) {
            alert("Error de conexión al procesar canje");
            prizesList.innerHTML = originalContent;
        }
    }

    function renderRedemptionSuccess(data, prize) {
        const body = document.querySelector('.fidelidad-body');
        body.innerHTML = `
            <div class="fidelidad-success" style="text-align: center; color: #16a34a; padding: 10px;">
                <div style="font-size: 40px;">\u{1F381}</div>
                <div style="font-weight: bold; font-size: 18px; margin: 5px 0;">¡Canje Exitoso!</div>
                <div style="font-size: 14px; color: #666; margin-bottom: 15px;">
                    ${selectedClient.name} canjeó <strong>${prize.name}</strong>.<br>
                    Nuevo saldo: <strong>${data.newBalance} pts</strong>.
                </div>
                ${data.whatsappLink ? `<a href="${data.whatsappLink}" target="_blank" class="fidelidad-wa-link">ENVIAR WHATSAPP</a>` : ''}
                <button class="fidelidad-button" style="background:#f3f4f6; color:#374151; margin-top:15px; border: 1px solid #d1d5db;" id="cf-final-close">CERRAR</button>
            </div>
        `;
        document.getElementById('cf-final-close').onclick = () => {
            window.removeEventListener('keydown', killEvent, true);
            window.removeEventListener('keyup', killEvent, true);
            window.removeEventListener('keypress', killEvent, true);
            panel.remove();
        };
    }
}

}
