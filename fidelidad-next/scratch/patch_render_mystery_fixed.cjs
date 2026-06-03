const fs = require('fs');

const contentFile = 'extension-club-fidelidad/content.js';
let contentJS = fs.readFileSync(contentFile, 'utf8');

const renderMysteryBoxesFunc = `
        const renderMysteryBoxes = (boxes) => {
            if (!boxes || boxes.length === 0) return '<div style="padding:20px; text-align:center; opacity:0.5; font-size:12px;">No hay sorteos pendientes</div>';
            return boxes.map(b => \`
                <div style="background:\${'#fff7ed'}; border-left:4px solid \${'#fb923c'}; margin-bottom:8px; padding:12px; border-radius:8px; box-shadow:0 2px 4px rgba(0,0,0,0.05);">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div style="flex:1;">
                            <div style="display:flex; align-items:center; gap:6px;">
                                <span style="font-size:14px;">🎁</span>
                                <span style="font-weight:900; font-size:12px; color:#1f2937;">\${b.userName || 'Socio'}</span>
                            </div>
                            <div style="font-size:10px; color:#6b7280; margin-top:4px;">
                                \${b.socioNumber ? 'Socio: ' + b.socioNumber + ' | ' : ''} Tel: \${b.phone || '-'}
                            </div>
                            <div style="font-size:10px; color:#9a3412; margin-top:2px; font-weight:bold;">
                                Monto: $\${b.amount || 0}
                            </div>
                        </div>
                        <div style="display:flex; gap:4px;">
                            <button class="cf-action-btn cf-action-whatsapp" data-id="\${b.alertId}" data-type="\${b.type}" data-phone="\${b.phone}" style="background:#22c55e; color:white; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:10px;">
                                WA
                            </button>
                            <button class="cf-action-btn cf-action-dismiss" data-id="\${b.alertId}" data-type="\${b.type}" style="background:#e5e7eb; color:#374151; border:none; padding:6px 10px; border-radius:6px; cursor:pointer; font-weight:bold; font-size:10px;">
                                OK
                            </button>
                        </div>
                    </div>
                </div>
            \`).join('');
        };
`;

// Find `const render = () => {`
const targetPoint = 'const render = () => {';
contentJS = contentJS.replace(targetPoint, targetPoint + renderMysteryBoxesFunc);

contentJS = contentJS.replace(/V54/g, 'V55');

fs.writeFileSync(contentFile, contentJS);

const clientProfileFile = 'src/modules/client/pages/ClientProfilePage.tsx';
let clientProfileTSX = fs.readFileSync(clientProfileFile, 'utf8');
clientProfileTSX = clientProfileTSX.replace(/V54/g, 'V55');
fs.writeFileSync(clientProfileFile, clientProfileTSX);

console.log('Patched content.js with renderMysteryBoxes and bumped to V55');
