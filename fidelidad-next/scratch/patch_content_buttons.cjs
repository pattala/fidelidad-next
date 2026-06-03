const fs = require('fs');
const file = 'extension-club-fidelidad/content.js';
let content = fs.readFileSync(file, 'utf8');

// 1. Add `pendingMB` variable and update tab-sorteos count
const renderBlockStart = "const pendingB = birthdays.filter";
const pendingMBDecl = "const pendingMB = (fullData.mysteryBoxes || []).filter(mb => getStatus(mb.alertId) === 'pending');\n        ";
content = content.replace(renderBlockStart, pendingMBDecl + renderBlockStart);

const oldSorteosTab = /SORTEOS \(\$\{fullData\.mysteryBoxes \? fullData\.mysteryBoxes\.length : 0\}\)/;
content = content.replace(oldSorteosTab, "SORTEOS (${pendingMB.length})");

// 2. Pass pendingMB to renderMysteryBoxes
const oldRenderCall = /\? renderMysteryBoxes\(fullData\.mysteryBoxes \|\| \[\]\)/;
content = content.replace(oldRenderCall, "? renderMysteryBoxes(pendingMB)");

// 3. Update generateWhatsAppToken
const whatsappHook = "} else if (type === 'pointsAssignments') {";
const mysteryBoxMsg = `} else if (type === 'mysteryBox') {
            const tpl = templates.whatsappMysteryBox || \`¡Hola {nombre}! 🎁 ¡Acabas de ganarte un Sorteo Sorpresa! Ingresá a la App de {tienda} para abrirla.\`;
            msg = tpl;
        } else if (type === 'pointsAssignments') {`;
content = content.replace(whatsappHook, mysteryBoxMsg);

// 4. Bind events in attachActions
const attachActionsHook = "ui.querySelectorAll('.cf-v35-card-close').forEach(btn => btn.onclick = () => updateStorage(btn.dataset.id, 'dismissed'));";
const bindMysteryBoxBtns = `ui.querySelectorAll('.cf-action-dismiss').forEach(btn => btn.onclick = () => updateStorage(btn.dataset.id, 'dismissed'));
        ui.querySelectorAll('.cf-action-whatsapp').forEach(btn => btn.onclick = () => {
            const url = generateWhatsAppToken(btn.dataset.type, btn.dataset.phone, btn.dataset.name, btn.dataset.extra, config, btn.dataset.socio, btn.dataset.date);
            if (url) window.open(url, '_blank');
            updateStorage(btn.dataset.id, 'sent');
        });
        ui.querySelectorAll('.cf-v35-card-close').forEach(btn => btn.onclick = () => updateStorage(btn.dataset.id, 'dismissed'));`;
content = content.replace(attachActionsHook, bindMysteryBoxBtns);

// Ensure the renderMysteryBoxes template passes data-name properly
const oldWAButton = /<button class="cf-action-btn cf-action-whatsapp" data-id="\$\{b\.alertId\}" data-type="\$\{b\.type\}" data-phone="\$\{b\.phone\}"/;
const newWAButton = `<button class="cf-action-btn cf-action-whatsapp" data-id="\${b.alertId}" data-type="\${b.type}" data-phone="\${b.phone}" data-name="\${b.userName || 'Socio'}"`;
content = content.replace(oldWAButton, newWAButton);

// Version Bump to V56
content = content.replace(/V55/g, 'V56');

fs.writeFileSync(file, content);

const clientProfileFile = 'src/modules/client/pages/ClientProfilePage.tsx';
let clientProfileTSX = fs.readFileSync(clientProfileFile, 'utf8');
clientProfileTSX = clientProfileTSX.replace(/V55/g, 'V56');
fs.writeFileSync(clientProfileFile, clientProfileTSX);

console.log("Patched content.js with button events and count filtering, bumped to V56");
